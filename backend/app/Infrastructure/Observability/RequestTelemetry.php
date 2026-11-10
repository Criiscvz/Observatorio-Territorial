<?php

declare(strict_types=1);

namespace App\Infrastructure\Observability;

use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use OpenTelemetry\API\Common\Time\Clock;
use OpenTelemetry\API\Trace\SpanInterface;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;
use OpenTelemetry\Context\Context;
use OpenTelemetry\Context\ScopeInterface;
use OpenTelemetry\SDK\Common\Attribute\Attributes;
use OpenTelemetry\SDK\Resource\ResourceInfo;
use OpenTelemetry\SDK\Trace\Sampler\ParentBased;
use OpenTelemetry\SDK\Trace\Sampler\TraceIdRatioBasedSampler;
use OpenTelemetry\SDK\Trace\SpanExporter\InMemoryExporter;
use OpenTelemetry\SDK\Trace\SpanProcessor\SimpleSpanProcessor;
use OpenTelemetry\SDK\Trace\TracerProvider;
use OpenTelemetry\SDK\Trace\TracerProviderInterface;

/** FPM request-local lifecycle, explicit parents, bounded spans and no network exporter. */
final class RequestTelemetry
{
    private ?SpanInterface $root = null;
    private ?ScopeInterface $scope = null;
    private ?TracerProviderInterface $provider = null;
    private ?InMemoryExporter $exporter = null;
    private ?string $requestId = null;
    private int $started = 0;
    private int $children = 0;
    private array $stats = [];
    private \WeakMap $http;

    public function __construct() { $this->http = new \WeakMap(); }

    public function begin(string $requestId): void
    {
        $this->reset();
        $this->requestId = $requestId;
        $this->stats = ['db_count'=>0,'db_duration_ms'=>0.0,'http_count'=>0,'http_duration_ms'=>0.0,'dropped_spans'=>0];
        $this->exporter = new InMemoryExporter();
        $this->provider = TracerProvider::builder()
            ->setResource(ResourceInfo::create(Attributes::create(['service.name'=>'observatorio-api'])))
            ->setSampler(new ParentBased(new TraceIdRatioBasedSampler(max(0, min(1, (float) config('observability.sample_rate', 0.1))))))
            ->addSpanProcessor(new SimpleSpanProcessor($this->exporter))->build();
        $this->started = Clock::getDefault()->now();
        // Untrusted traceparent/baggage/request IDs are deliberately not extracted.
        $this->root = $this->provider->getTracer('observatorio.http')->spanBuilder('HTTP request')
            ->setParent(Context::getRoot())->setSpanKind(SpanKind::KIND_SERVER)->startSpan();
        $this->scope = $this->root->activate();
    }

    public function active(): bool { return $this->root !== null; }

    public function correlation(): array
    {
        if (! $this->root) return [];
        return ['request_id'=>$this->requestId, 'trace_id'=>$this->root->getContext()->getTraceId(),
            'span_id'=>$this->root->getContext()->getSpanId(), 'release'=>config('observability.release')];
    }

    public function database(string $system, string $operation, float $duration, bool $failed = false): void
    {
        if (! $this->root) return;
        $this->stats['db_count']++;
        $this->stats['db_duration_ms'] += max(0, $duration);
        $this->child(['component'=>'database','db_system'=>$system,'operation'=>$operation], $duration, $failed);
    }

    public function sending(ClientRequest $request): void
    {
        if (! $this->root || count($this->http) >= 32) return;
        $url = parse_url($request->url());
        if (($url['scheme'] ?? '') !== 'https') return;
        $target = match ($url['host'] ?? '') {
            'graph.microsoft.com' => 'microsoft_graph', 'login.microsoftonline.com' => 'microsoft_identity', default=>null,
        };
        if ($target) $this->http[$request->toPsrRequest()] = [$target, Clock::getDefault()->now()];
    }

    public function received(ClientRequest $request, ?int $status): void
    {
        $key = $request->toPsrRequest();
        if (! $this->root || ! isset($this->http[$key])) return;
        [$target, $start] = $this->http[$key]; unset($this->http[$key]);
        $duration = max(0, (Clock::getDefault()->now() - $start) / 1000000);
        $this->stats['http_count']++; $this->stats['http_duration_ms'] += $duration;
        $this->child(['component'=>'http_client','target'=>$target,'method'=>$request->method(),'status'=>$status],
            $duration, $status === null || $status >= 400);
    }

    private function child(array $attributes, float $duration, bool $failed): void
    {
        if (! $this->root || ! $this->provider || ! $this->root->isRecording()) return;
        if ($this->children++ >= 32) { $this->stats['dropped_spans']++; return; }
        $end = Clock::getDefault()->now();
        $safe = SafeLogProcessor::context($attributes);
        $span = $this->provider->getTracer('observatorio.dependencies')->spanBuilder($safe['component'])
            ->setParent($this->root->storeInContext(Context::getRoot()))->setSpanKind(SpanKind::KIND_CLIENT)
            ->setStartTimestamp(max($this->started, $end - (int) (max(0, min(3600000, $duration)) * 1000000)))
            ->setAttributes($safe)->startSpan();
        if ($failed) $span->setStatus(StatusCode::STATUS_ERROR);
        $span->end($end);
    }

    public function finish(Request $request, int $status): void
    {
        try {
            if (! $this->root) return;
            $duration = max(0, (Clock::getDefault()->now() - $this->started) / 1000000);
            /** @var \Illuminate\Routing\Route|null $route A 404 may have no resolved route. */
            $route = $request->route();
            $context = SafeLogProcessor::context($this->stats + ['component'=>'server',
                'method'=>$request->method(), 'route'=>$route instanceof \Illuminate\Routing\Route ? $route->uri() : 'UNMATCHED',
                'status'=>$status, 'duration_ms'=>$duration, 'sampled'=>$this->root->getContext()->isSampled(),
                'slow'=>$duration >= max(1, (int) config('observability.slow_request_ms', 1500))]);
            $this->root->updateName('HTTP '.($context['method'] ?? 'OTHER').' '.($context['route'] ?? 'UNMATCHED'));
            $this->root->setAttributes($context);
            if ($status >= 500) $this->root->setStatus(StatusCode::STATUS_ERROR);
            $this->root->end();
            foreach ($this->exporter?->getSpans() ?? [] as $span) {
                // Export a positive projection, never SDK events/resources, stack traces or arbitrary attributes.
                $data = SafeLogProcessor::context($span->getAttributes()->toArray() + [
                    'trace_id'=>$span->getTraceId(),'span_id'=>$span->getSpanId(),'parent_span_id'=>$span->getParentSpanId(),
                    'span_status'=>$span->getStatus()->getCode(),'duration_ms'=>($span->getEndEpochNanos()-$span->getStartEpochNanos())/1000000]);
                Log::info('OTEL_SPAN', $data);
            }
            Log::log($status >= 500 ? 'error' : ($context['slow'] ? 'warning' : 'info'), 'HTTP_REQUEST_COMPLETED', $context);
        } finally { $this->reset(); }
    }

    public function reset(): void
    {
        $this->scope?->detach();
        $this->scope = null; $this->root = null; $this->provider = null; $this->exporter = null;
        $this->http = new \WeakMap(); $this->requestId = null; $this->children = 0; $this->stats = [];
    }
}

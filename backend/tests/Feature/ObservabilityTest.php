<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Infrastructure\Observability\ConfigureSafeLogging;
use App\Infrastructure\Observability\RequestTelemetry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Monolog\Handler\StreamHandler;
use OpenTelemetry\API\Trace\Span;
use Tests\TestCase;

final class ObservabilityTest extends TestCase
{
    private $stream;
    private const SECRET = 'sensitive-fixture-never-in-telemetry';

    protected function setUp(): void
    {
        parent::setUp();
        $this->stream = fopen('php://memory', 'w+');
        config(['app.debug'=>false, 'observability.enabled'=>true, 'observability.sample_rate'=>1,
            'observability.release'=>'1234567', 'logging.default'=>'observability-test',
            'logging.channels.observability-test'=>['driver'=>'monolog','handler'=>StreamHandler::class,
                'handler_with'=>['stream'=>$this->stream], 'tap'=>[ConfigureSafeLogging::class], 'level'=>'debug']]);
        Log::forgetChannel('observability-test');
    }

    protected function tearDown(): void
    {
        app(RequestTelemetry::class)->reset();
        parent::tearDown();
        if (is_resource($this->stream)) fclose($this->stream);
    }

    private function records(): array
    {
        rewind($this->stream);
        $text = stream_get_contents($this->stream);
        $this->assertStringNotContainsString(self::SECRET, $text);
        return array_map(fn ($line) => json_decode($line, true, flags: JSON_THROW_ON_ERROR),
            array_values(array_filter(explode("\n", trim($text)))));
    }

    private function event(string $name): array { return array_values(array_filter($this->records(), fn ($r) => $r['message'] === $name)); }

    public function test_request_database_and_microsoft_spans_have_one_parent_without_payloads(): void
    {
        Http::preventStrayRequests();
        Http::fake(['graph.microsoft.com/*'=>Http::response(['password'=>self::SECRET], 503)]);
        Route::post('/api/observe/{publication}', function (Request $request) {
            DB::select('select ? as private_value', [self::SECRET]);
            Http::withToken(self::SECRET)->post('https://graph.microsoft.com/v1.0/'.self::SECRET.'?secret='.self::SECRET, ['password'=>self::SECRET]);
            Log::warning('SharePoint publication import failed', ['sharepoint_file_id'=>self::SECRET,'exception'=>\RuntimeException::class]);
            return response()->json(['ok'=>true]);
        });
        $response = $this->withHeaders(['X-Request-ID'=>self::SECRET, 'traceparent'=>'00-'.str_repeat('a',32).'-'.str_repeat('b',16).'-01'])
            ->postJson('/api/observe/'.self::SECRET.'?token='.self::SECRET, ['password'=>self::SECRET]);
        $response->assertOk();
        $summary = $this->event('HTTP_REQUEST_COMPLETED')[0]['context'];
        $this->assertSame($response->headers->get('X-Request-ID'), $summary['request_id']);
        $this->assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', $summary['request_id']);
        $this->assertSame('api/observe/{publication}', $summary['route']);
        $this->assertNotSame(str_repeat('a',32), $summary['trace_id']);
        $this->assertSame(1, $summary['db_count']); $this->assertSame(1, $summary['http_count']);
        $spans = array_column($this->event('OTEL_SPAN'), 'context');
        $this->assertCount(3, $spans);
        foreach ($spans as $span) {
            $this->assertSame($summary['trace_id'], $span['trace_id']);
            if ($span['component'] !== 'server') $this->assertSame($summary['span_id'], $span['parent_span_id']);
        }
        $http = array_values(array_filter($spans, fn ($s) => $s['component']==='http_client'))[0];
        $this->assertSame('microsoft_graph', $http['target']);
        $this->assertSame('Error', $http['span_status']); $this->assertSame(503, $http['status']);
        $this->assertCount(1, $this->event('SHAREPOINT_IMPORT_FAILED'));
        $this->assertFalse(app(RequestTelemetry::class)->active());
        $this->assertFalse(Span::getCurrent()->getContext()->isValid());
    }

    public function test_exception_is_correlated_but_its_message_previous_exception_and_trace_are_not_logged(): void
    {
        Route::get('/api/observe-error', fn () => throw new \RuntimeException(self::SECRET, previous:new \LogicException(self::SECRET)));
        $response = $this->getJson('/api/observe-error')->assertStatus(500);
        $this->assertStringNotContainsString(self::SECRET, $response->getContent());
        $error = $this->event('APPLICATION_EXCEPTION')[0]['context'];
        $this->assertSame(\RuntimeException::class, $error['exception']);
        $this->assertSame($response->headers->get('X-Request-ID'), $error['request_id']);
        $this->assertSame(500, $this->event('HTTP_REQUEST_COMPLETED')[0]['context']['status']);
        $this->assertSame('Error', $this->event('OTEL_SPAN')[0]['context']['span_status']);
    }

    public function test_logs_drop_unknown_messages_context_objects_and_extra_fields(): void
    {
        Log::channel('observability-test')->getLogger()->pushProcessor(
            fn (\Monolog\LogRecord $record) => $record->with(extra:['session'=>self::SECRET]));
        Log::error('SQL password='.self::SECRET, ['validated'=>['password'=>self::SECRET], 'headers'=>['Cookie'=>self::SECRET],
            'route'=>self::SECRET, 'request_id'=>self::SECRET, 'exception'=>new \RuntimeException(self::SECRET)]);
        $record = $this->records()[0];
        $this->assertSame('APPLICATION_LOG', $record['message']);
        $this->assertSame(['exception'=>\RuntimeException::class], $record['context']);
        $this->assertEmpty($record['extra']);
    }

    public function test_sequential_requests_get_fresh_ids_and_leave_no_active_context(): void
    {
        Route::get('/api/observe-ok', fn () => response()->json(['ok'=>true]));
        $first = $this->getJson('/api/observe-ok')->assertOk();
        $second = $this->getJson('/api/observe-ok')->assertOk();
        $this->assertNotSame($first->headers->get('X-Request-ID'), $second->headers->get('X-Request-ID'));
        $summaries = array_column($this->event('HTTP_REQUEST_COMPLETED'), 'context');
        $this->assertNotSame($summaries[0]['trace_id'], $summaries[1]['trace_id']);
        $this->assertFalse(app(RequestTelemetry::class)->active());
    }

    public function test_unmatched_route_and_sensitive_query_are_not_recorded(): void
    {
        $this->getJson('/api/'.self::SECRET.'?token='.self::SECRET)->assertNotFound();
        $this->assertSame('UNMATCHED', $this->event('HTTP_REQUEST_COMPLETED')[0]['context']['route']);
    }

    public function test_zero_sampling_retains_operational_summary_and_query_count(): void
    {
        config(['observability.sample_rate'=>0]);
        Route::get('/api/observe-zero', function () { DB::select('select 1'); return response()->json(['ok'=>true]); });
        $this->getJson('/api/observe-zero')->assertOk();
        $this->assertCount(0, $this->event('OTEL_SPAN'));
        $summary = $this->event('HTTP_REQUEST_COMPLETED')[0]['context'];
        $this->assertFalse($summary['sampled']); $this->assertSame(1,$summary['db_count']);
    }

    public function test_many_queries_are_counted_but_spans_are_bounded(): void
    {
        Route::get('/api/observe-many', function () { for($i=0;$i<40;$i++) DB::select('select 1'); return response()->json(['ok'=>true]); });
        $this->getJson('/api/observe-many')->assertOk();
        $this->assertCount(33, $this->event('OTEL_SPAN'));
        $summary = $this->event('HTTP_REQUEST_COMPLETED')[0]['context'];
        $this->assertSame(40,$summary['db_count']); $this->assertSame(8,$summary['dropped_spans']);
    }

    public function test_connection_failure_has_safe_error_span(): void
    {
        Http::fake(['graph.microsoft.com/*'=>Http::failedConnection(self::SECRET)]);
        Route::get('/api/observe-client-error', function () {
            try { Http::get('https://graph.microsoft.com/'.self::SECRET); } catch (\Throwable) {}
            return response()->json(['ok'=>true]);
        });
        $this->getJson('/api/observe-client-error')->assertOk();
        $span = $this->event('OTEL_SPAN')[0]['context'];
        $this->assertSame('http_client',$span['component']); $this->assertSame('Error',$span['span_status']);
        $this->assertArrayNotHasKey('status',$span);
    }

    public function test_optional_mongodb_query_log_is_not_counted_twice(): void
    {
        Route::get('/api/observe-mongo-log', function () {
            app(RequestTelemetry::class)->database('mongodb','find',1.0);
            $connection = new \Illuminate\Database\Connection(fn () => null, '', '', ['driver'=>'mongodb','name'=>'synthetic']);
            event(new \Illuminate\Database\Events\QueryExecuted(json_encode(['find'=>self::SECRET]), [], 1.0, $connection));
            return response()->json(['ok'=>true]);
        });
        $this->getJson('/api/observe-mongo-log')->assertOk();
        $this->assertSame(1, $this->event('HTTP_REQUEST_COMPLETED')[0]['context']['db_count']);
        $this->assertCount(2, $this->event('OTEL_SPAN'));
    }

    public function test_unavailable_log_sink_does_not_change_successful_response(): void
    {
        Log::partialMock()->shouldReceive('info')->andThrow(new \RuntimeException(self::SECRET));
        Route::get('/api/observe-sink-down', fn () => response()->json(['ok'=>true]));
        $this->getJson('/api/observe-sink-down')->assertOk()->assertJson(['ok'=>true]);
        $this->assertFalse(app(RequestTelemetry::class)->active());
    }

    public function test_disabled_tracing_does_not_emit_spans_or_header(): void
    {
        config(['observability.enabled'=>false]);
        Route::get('/api/observe-disabled', fn () => response()->json(['ok'=>true]));
        $response = $this->getJson('/api/observe-disabled')->assertOk();
        $this->assertFalse($response->headers->has('X-Request-ID'));
        $this->assertSame([], $this->records());
    }
}

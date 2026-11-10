<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Infrastructure\Observability\RequestTelemetry;
use Closure;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class ObserveRequest
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('observability.enabled')) return $next($request);
        $id = (string) Str::uuid();
        $telemetry = app(RequestTelemetry::class);
        try { $telemetry->begin($id); } catch (\Throwable) { $telemetry->reset(); }
        $response = null;
        try {
            try { $response = $next($request); }
            catch (\Throwable $exception) {
                $handler = app(ExceptionHandler::class);
                $handler->report($exception);
                $response = $handler->render($request, $exception);
            }
        } finally {
            // Monitoring must not make a successful operation fail if a sink is unavailable.
            try { $telemetry->finish($request, $response?->getStatusCode() ?? 500); }
            catch (\Throwable) { $telemetry->reset(); }
        }
        $response->headers->set('X-Request-ID', $id);
        return $response;
    }
}

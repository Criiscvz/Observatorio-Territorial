<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(\App\Infrastructure\Observability\RequestTelemetry::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \Illuminate\Support\Facades\DB::listen(function (\Illuminate\Database\Events\QueryExecuted $event): void {
            $telemetry = app(\App\Infrastructure\Observability\RequestTelemetry::class);
            if (! $telemetry->active()) return;
            // MongoDB's optional Laravel query log also emits QueryExecuted; the driver observer already counts it.
            if ($event->connection->getDriverName() === 'mongodb') return;
            $system = match ($event->connection->getDriverName()) { 'pgsql'=>'postgresql', 'sqlite'=>'sqlite', 'mysql'=>'mysql', default=>'other' };
            preg_match('/^\s*(SELECT|INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK)\b/i', $event->sql, $matches);
            $telemetry->database($system, strtoupper($matches[1] ?? 'OTHER'), (float) $event->time);
        });
        \Illuminate\Support\Facades\Event::listen(\Illuminate\Http\Client\Events\RequestSending::class,
            fn ($event) => app(\App\Infrastructure\Observability\RequestTelemetry::class)->sending($event->request));
        \Illuminate\Support\Facades\Event::listen(\Illuminate\Http\Client\Events\ResponseReceived::class,
            fn ($event) => app(\App\Infrastructure\Observability\RequestTelemetry::class)->received($event->request, $event->response->status()));
        \Illuminate\Support\Facades\Event::listen(\Illuminate\Http\Client\Events\ConnectionFailed::class,
            fn ($event) => app(\App\Infrastructure\Observability\RequestTelemetry::class)->received($event->request, null));
        if (function_exists('MongoDB\\Driver\\Monitoring\\addSubscriber')) {
            $observer = new \App\Infrastructure\Observability\MongoCommandObserver();
            \MongoDB\Driver\Monitoring\addSubscriber($observer);
            $this->app->terminating(fn () => \MongoDB\Driver\Monitoring\removeSubscriber($observer));
        }
        \Illuminate\Support\Facades\Gate::policy(\App\Models\User::class, \App\Policies\ObservatoryAccessPolicy::class);
        \Illuminate\Support\Facades\Gate::policy(\App\Models\ObservatorioPublicacion::class, \App\Policies\ObservatorioPublicacionPolicy::class);
        RateLimiter::for('email-verification', function (Request $request) {
            $email = Str::lower((string) $request->input('email', ''));
            return Limit::perMinute(10)->by($request->ip().'|'.hash('sha256', $email));
        });

        RateLimiter::for('email-verification-resend', function (Request $request) {
            $email = Str::lower((string) $request->input('email', ''));
            return Limit::perMinutes(10, 3)->by($request->ip().'|'.hash('sha256', $email));
        });

        RateLimiter::for('google-oauth', fn (Request $request) =>
            Limit::perMinute(10)->by($request->ip())
        );
    }
}

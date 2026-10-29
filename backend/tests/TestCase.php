<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Abort before database-reset traits run unless the configured database is
     * unmistakably disposable. This is a second line of defence in addition to
     * the forced PHPUnit environment variables.
     */
    protected function setUpTraits()
    {
        $connection = (string) config('database.default');
        $database = config("database.connections.{$connection}.database");
        $url = config("database.connections.{$connection}.url");

        $isInMemorySqlite = $connection === 'sqlite' && $database === ':memory:' && blank($url);
        $isLocalTestPostgres = $connection === 'pgsql'
            && $this->isLocalDatabaseUrl($url)
            && $this->isTestDatabaseName((string) $database, $url);

        if (! app()->environment('testing') || (! $isInMemorySqlite && ! $isLocalTestPostgres)) {
            throw new \RuntimeException(sprintf(
                'Unsafe test database configuration blocked (environment=%s, connection=%s, database=%s).',
                app()->environment(),
                $connection,
                is_scalar($database) ? (string) $database : 'unknown',
            ));
        }

        return parent::setUpTraits();
    }

    private function isLocalDatabaseUrl(mixed $url): bool
    {
        if (blank($url)) {
            $host = (string) config('database.connections.pgsql.host');

            return in_array($host, ['127.0.0.1', 'localhost', '::1', 'postgres'], true);
        }

        $host = parse_url((string) $url, PHP_URL_HOST);

        return is_string($host)
            && in_array(strtolower($host), ['127.0.0.1', 'localhost', '::1', 'postgres'], true);
    }

    private function isTestDatabaseName(string $database, mixed $url): bool
    {
        if (filled($url)) {
            $path = parse_url((string) $url, PHP_URL_PATH);
            $database = is_string($path) ? ltrim($path, '/') : '';
        }

        return preg_match('/(?:^|_)(?:test|testing)$/i', $database) === 1;
    }
}

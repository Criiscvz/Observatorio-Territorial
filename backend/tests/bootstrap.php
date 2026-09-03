<?php

declare(strict_types=1);

/**
 * PHPUnit database isolation.
 *
 * Production-style DB_* and database URL variables are deliberately ignored.
 * PostgreSQL tests require an explicit TEST_DB_* configuration pointing to a
 * local host and to a database whose name clearly identifies it as disposable.
 */

$setEnvironment = static function (string $key, string $value): void {
    putenv("{$key}={$value}");
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
};

// Keep these keys present but empty so Laravel's .env loader cannot repopulate
// them with a production URL after this bootstrap has started.
$setEnvironment('DATABASE_URL', '');
$setEnvironment('DB_URL', '');
$setEnvironment('APP_ENV', 'testing');

$testConnection = getenv('TEST_DB_CONNECTION') ?: 'sqlite';

if ($testConnection === 'pgsql') {
    $host = strtolower((string) (getenv('TEST_DB_HOST') ?: '127.0.0.1'));
    $database = (string) getenv('TEST_DB_DATABASE');
    $localHosts = ['127.0.0.1', 'localhost', '::1', 'postgres'];

    if (! in_array($host, $localHosts, true)
        || preg_match('/(?:^|_)(?:test|testing)$/i', $database) !== 1) {
        throw new RuntimeException(sprintf(
            'Unsafe TEST_DB_* configuration blocked (host=%s, database=%s).',
            $host,
            $database ?: 'missing',
        ));
    }

    $setEnvironment('DB_CONNECTION', 'pgsql');
    $setEnvironment('DB_HOST', $host);
    $setEnvironment('DB_PORT', (string) (getenv('TEST_DB_PORT') ?: '5432'));
    $setEnvironment('DB_DATABASE', $database);
    $setEnvironment('DB_USERNAME', (string) (getenv('TEST_DB_USERNAME') ?: 'postgres'));
    $setEnvironment('DB_PASSWORD', (string) (getenv('TEST_DB_PASSWORD') ?: ''));
    $setEnvironment('DB_SSLMODE', 'disable');
} else {
    $setEnvironment('DB_CONNECTION', 'sqlite');
    $setEnvironment('DB_DATABASE', ':memory:');
}

require dirname(__DIR__).'/vendor/autoload.php';

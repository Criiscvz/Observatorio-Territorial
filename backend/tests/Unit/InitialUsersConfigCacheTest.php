<?php

declare(strict_types=1);

namespace Tests\Unit;

use Illuminate\Filesystem\Filesystem;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Process\Process;

class InitialUsersConfigCacheTest extends TestCase
{
    public function test_seeder_uses_cached_configuration_when_original_environment_is_absent(): void
    {
        $project = dirname(__DIR__, 2);
        $temporaryRoot = sys_get_temp_dir().'/initial-users-config-test-'.bin2hex(random_bytes(12));
        $files = new Filesystem();
        $files->makeDirectory($temporaryRoot.'/bootstrap/cache', 0700, true);
        $files->makeDirectory($temporaryRoot.'/config', 0700, true);
        $files->makeDirectory($temporaryRoot.'/storage/logs', 0700, true);

        try {
            // A minimal application never loads the project's .env or writes its cache.
            foreach (['app.php', 'database.php', 'initial_users.php'] as $config) {
                $files->copy($project.'/config/'.$config, $temporaryRoot.'/config/'.$config);
            }
            $files->copy($project.'/tests/Fixtures/initial-users-app.php', $temporaryRoot.'/bootstrap/app.php');
            $environment = [
                'APP_ENV' => 'testing',
                'APP_KEY' => 'base64:'.base64_encode(str_repeat('t', 32)),
                'APP_CONFIG_CACHE' => $temporaryRoot.'/bootstrap/cache/config.php',
                'DB_CONNECTION' => 'sqlite',
                'DB_DATABASE' => ':memory:',
                'DB_URL' => '',
                'DATABASE_URL' => '',
                'CACHE_STORE' => 'array',
                'SESSION_DRIVER' => 'array',
                'QUEUE_CONNECTION' => 'sync',
                'LOG_CHANNEL' => 'stderr',
                'ADMIN_NAME' => 'Cached Administrator',
                'ADMIN_EMAIL' => 'cached-admin@example.test',
                'ADMIN_PASSWORD' => 'synthetic-cache-password-only',
                'INITIAL_USER_NAME' => 'Cached User',
                'INITIAL_USER_EMAIL' => 'cached-user@example.test',
                'INITIAL_USER_PASSWORD' => 'synthetic-cache-password-only',
                'SUBSCRIBER_NAME' => 'Cached Subscriber',
                'SUBSCRIBER_EMAIL' => 'cached-subscriber@example.test',
                'SUBSCRIBER_PASSWORD' => 'synthetic-cache-password-only',
            ];

            $cache = new Process([PHP_BINARY, $project.'/tests/Fixtures/initial-users-cache-process.php', 'cache', $temporaryRoot], $temporaryRoot, $environment);
            $cache->setTimeout(30)->run();
            $this->assertSame(0, $cache->getExitCode(), $cache->getErrorOutput());
            $this->assertFileExists($environment['APP_CONFIG_CACHE']);

            foreach (['ADMIN', 'INITIAL_USER', 'SUBSCRIBER'] as $prefix) {
                foreach (['NAME', 'EMAIL', 'PASSWORD'] as $suffix) {
                    $environment[$prefix.'_'.$suffix] = false;
                }
            }

            $verify = new Process([PHP_BINARY, $project.'/tests/Fixtures/initial-users-cache-process.php', 'verify', $temporaryRoot], $temporaryRoot, $environment);
            $verify->setTimeout(30)->run();
            $this->assertSame(0, $verify->getExitCode(), $verify->getErrorOutput());
            $this->assertSame('cached-seeder-ok:3', trim($verify->getOutput()));
        } finally {
            // Only the unique application root created above is removed.
            $files->deleteDirectory($temporaryRoot);
        }
    }
}

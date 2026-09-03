<?php

namespace Tests\Unit;

use Tests\TestCase;

class TestDatabaseIsolationTest extends TestCase
{
    public function test_phpunit_uses_only_the_explicit_test_database_configuration(): void
    {
        $connection = (string) config('database.default');
        $expectedConnection = (string) (getenv('TEST_DB_CONNECTION') ?: 'sqlite');

        $this->assertSame($expectedConnection, $connection);
        $this->assertSame('', (string) config("database.connections.{$connection}.url"));

        if ($connection === 'pgsql') {
            $this->assertSame((string) getenv('TEST_DB_HOST'), (string) config('database.connections.pgsql.host'));
            $this->assertSame((string) getenv('TEST_DB_DATABASE'), (string) config('database.connections.pgsql.database'));
            $this->assertSame((string) getenv('TEST_DB_USERNAME'), (string) config('database.connections.pgsql.username'));
            $this->assertSame((string) getenv('TEST_DB_PASSWORD'), (string) config('database.connections.pgsql.password'));
        }
    }
}

<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Infrastructure\Services\StatisticsService;
use MongoDB\Client;
use MongoDB\Database;
use Tests\TestCase;

/** Real aggregation semantics, isolated from all application/production databases. */
class StatisticsFilterLiteralTest extends TestCase
{
    private ?Database $mongo = null;
    private ?string $namespace = null;

    protected function setUp(): void
    {
        parent::setUp();
        $host = getenv('TEST_MONGO_HOST') ?: '';
        if ($host === '') $this->markTestSkipped('Disposable MongoDB service is not configured.');
        $port = getenv('TEST_MONGO_PORT') ?: '';
        if (! app()->environment('testing') || ! in_array($host, ['127.0.0.1', 'localhost', 'mongo', 'mongodb'], true)
            || ! ctype_digit($port) || (int) $port < 1 || (int) $port > 65535) {
            throw new \RuntimeException('Unsafe test MongoDB configuration blocked.');
        }
        // This name is generated here, never taken from MONGODB_URI or a user-supplied database name.
        $this->namespace = 'obs_filter_literal_'.bin2hex(random_bytes(8)).'_test';
        $this->mongo = (new Client('mongodb://'.$host.':'.$port, ['serverSelectionTimeoutMS' => 5000]))
            ->selectDatabase($this->namespace);
        $this->mongo->command(['ping' => 1]);
    }

    protected function tearDown(): void
    {
        try {
            if ($this->mongo !== null && $this->namespace !== null) {
                $this->assertMatchesRegularExpression('/^obs_filter_literal_[a-f0-9]{16}_test$/', $this->namespace);
                $this->assertSame($this->namespace, $this->mongo->getDatabaseName());
                $this->mongo->drop();
            }
        } finally {
            parent::tearDown();
        }
    }

    public function test_dollar_prefixed_operands_are_data_for_all_expression_comparisons(): void
    {
        $collection = $this->mongo->selectCollection('synthetic_rows');
        $values = ['$$undefined_variable', '$field_reference', 'plain_text'];
        $collection->insertMany(array_map(fn ($value) => ['data' => ['value' => $value]], $values));
        $builder = new \ReflectionMethod(StatisticsService::class, 'buildFilterMatch');
        $service = app(StatisticsService::class);
        foreach ($values as $value) {
            foreach (['eq' => 1, 'neq' => 2, 'in' => 1, 'not_in' => 2] as $operator => $expected) {
                $filter = ['column' => 'value', 'operator' => $operator,
                    'value' => in_array($operator, ['in', 'not_in'], true) ? [$value] : $value];
                $match = $builder->invoke($service, [$filter]);
                $this->assertSame($expected, $collection->countDocuments($match), $operator.' must compare literal data.');
            }
        }
    }
}

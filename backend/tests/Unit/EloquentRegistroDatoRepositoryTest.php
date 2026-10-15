<?php

namespace Tests\Unit;

use App\Infrastructure\Persistence\Eloquent\Models\RegistroDatoModel;
use App\Infrastructure\Persistence\Eloquent\Repositories\EloquentRegistroDatoRepository;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class EloquentRegistroDatoRepositoryTest extends TestCase
{
    #[DataProvider('invalidColumns')]
    public function test_rejects_malicious_column_names_before_running_a_query(string $method, array $columns): void
    {
        $repository = new EloquentRegistroDatoRepository(new RegistroDatoModel());
        DB::enableQueryLog();

        try {
            $repository->{$method}('dataset-id', ...$columns);
            $this->fail('An invalid JSON key must be rejected.');
        } catch (InvalidArgumentException) {
            $this->assertSame([], DB::getQueryLog());
        } finally {
            DB::disableQueryLog();
        }
    }

    public static function invalidColumns(): iterable
    {
        $methods = [
            'getCategoricalFrequencies' => 1,
            'getNumericStats' => 1,
            'getHistogram' => 1,
            'getScatterData' => 2,
            'getGroupedAverages' => 2,
            'getContingencyTable' => 2,
            'getTimeSeriesAverage' => 2,
            'getStackedTimeData' => 2,
        ];

        foreach ($methods as $method => $count) {
            foreach (["categoria' OR 1=1 --", "value\n", '', 'x->>y', 'x;DROP TABLE users;--'] as $invalid) {
                for ($position = 0; $position < $count; $position++) {
                    $columns = array_fill(0, $count, 'valid_key');
                    $columns[$position] = $invalid;
                    yield $method.'-'.$position.'-'.bin2hex($invalid) => [$method, $columns];
                }
            }
        }
    }

    public function test_accepts_normalized_imported_column_names(): void
    {
        $repository = new EloquentRegistroDatoRepository(new RegistroDatoModel());

        $reflection = new \ReflectionMethod($repository, 'sanitizeColumn');
        $reflection->setAccessible(true);

        $this->assertSame('poblacion_2026', $reflection->invoke($repository, 'poblacion_2026'));
    }

    public function test_json_keys_and_dataset_ids_are_bound_not_interpolated(): void
    {
        $repository = new EloquentRegistroDatoRepository(new RegistroDatoModel());
        $reflection = new \ReflectionMethod($repository, 'datasetColumns');
        $query = $reflection->invoke($repository, "dataset' --", ['value' => 'poblacion_2026']);

        $this->assertSame(['poblacion_2026', "dataset' --"], $query->getBindings());
        $this->assertStringNotContainsString('poblacion_2026', $query->toSql());
        $this->assertStringNotContainsString("dataset' --", $query->toSql());
        $this->assertStringContainsString('CAST(? AS text)', $query->toSql());
    }

    public function test_histogram_rejects_zero_bins_before_querying(): void
    {
        $repository = new EloquentRegistroDatoRepository(new RegistroDatoModel());
        $this->expectException(InvalidArgumentException::class);
        $repository->getHistogram('dataset-id', 'value', 0);
    }
}

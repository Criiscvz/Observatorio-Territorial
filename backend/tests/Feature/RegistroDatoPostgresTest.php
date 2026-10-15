<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Infrastructure\Persistence\Eloquent\Models\RegistroDatoModel;
use App\Infrastructure\Persistence\Eloquent\Repositories\EloquentRegistroDatoRepository;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Real PostgreSQL JSONB regressions; no application migrations or persistent fixtures. */
class RegistroDatoPostgresTest extends TestCase
{
    private EloquentRegistroDatoRepository $repository;

    protected function setUp(): void
    {
        parent::setUp();

        if (config('database.default') !== 'pgsql') {
            $this->markTestSkipped('Requires the explicit isolated TEST_DB_* PostgreSQL configuration.');
        }

        DB::statement('CREATE TEMPORARY TABLE registros_datos (id bigserial, dataset_id text NOT NULL, data jsonb NOT NULL, created_at timestamp, updated_at timestamp)');
        $this->repository = new EloquentRegistroDatoRepository(new RegistroDatoModel());
        $this->repository->insertBatch('dataset-test', [
            ['grupo' => 'A', 'valor' => 0, 'otro' => 2, 'fecha' => '2026-01-01', '2026' => 'numeric-key'],
            ['grupo' => 'A', 'valor' => 1, 'otro' => 4, 'fecha' => '2026-01-01'],
            ['grupo' => 'B', 'valor' => 2, 'otro' => 6, 'fecha' => '2026-01-02'],
            ['grupo' => 'B', 'valor' => 3, 'otro' => 8, 'fecha' => '2026-01-02'],
            ['grupo' => 'B', 'valor' => 4, 'otro' => 10, 'fecha' => '2026-01-02'],
            ['grupo' => 'A', 'valor' => 'not-numeric', 'otro' => 'invalid', 'fecha' => null],
            ['grupo' => null, 'valor' => null],
            ['unrelated' => 'missing-keys'],
        ]);
        $this->repository->insertBatch('foreign-dataset', [
            ['grupo' => 'FOREIGN', 'valor' => 1000, 'otro' => 2000, 'fecha' => '2099-01-01'],
        ]);
    }

    protected function tearDown(): void
    {
        if (isset($this->repository)) {
            DB::statement('DROP TABLE IF EXISTS pg_temp.registros_datos');
        }

        parent::tearDown();
    }

    public function test_frequencies_are_scoped_and_preserve_literal_numeric_json_keys(): void
    {
        $rows = $this->repository->getCategoricalFrequencies('dataset-test', 'grupo');
        $counts = array_column($rows, 'frecuencia', 'categoria');
        $this->assertEquals(['A' => 3, 'B' => 3], $counts);
        $this->assertCount(1, $this->repository->getCategoricalFrequencies('dataset-test', 'grupo', 1));
        $numericKey = $this->repository->getCategoricalFrequencies('dataset-test', '2026');
        $this->assertSame('numeric-key', $numericKey[0]->categoria);
    }

    public function test_numeric_statistics_ignore_missing_null_and_non_numeric_values(): void
    {
        $stats = $this->repository->getNumericStats('dataset-test', 'valor');
        $this->assertSame(5, (int) $stats['count']);
        $this->assertEqualsWithDelta(2, (float) $stats['mean'], 0.00001);
        $this->assertEqualsWithDelta(0, (float) $stats['min'], 0.00001);
        $this->assertEqualsWithDelta(4, (float) $stats['max'], 0.00001);
        $this->assertEqualsWithDelta(10, (float) $stats['sum'], 0.00001);
        $this->assertEqualsWithDelta(sqrt(2.5), (float) $stats['std'], 0.00001);
        $this->assertEqualsWithDelta(2, (float) $stats['median'], 0.00001);
    }

    public function test_histogram_includes_zero_and_combines_the_maximum_into_the_last_bin(): void
    {
        $this->assertSame([
            ['range' => '0.00 - 2.00', 'count' => 2],
            ['range' => '2.00 - 4.00', 'count' => 3],
        ], $this->repository->getHistogram('dataset-test', 'valor', 2));
        $this->assertSame([], $this->repository->getHistogram('empty-dataset', 'valor'));
        $this->repository->insertBatch('constant-dataset', [['valor' => 5], ['valor' => 5]]);
        $this->assertSame([], $this->repository->getHistogram('constant-dataset', 'valor'));
    }

    public function test_negative_decimal_values_are_bound_and_keep_numeric_results(): void
    {
        $this->repository->insertBatch('decimal-dataset', [
            ['valor' => '-1.5', 'otro' => '2.5'],
            ['valor' => '0.0', 'otro' => '-3.75'],
            ['valor' => '1.5', 'otro' => '5.5'],
            ['valor' => '1e3', 'otro' => 'invalid'],
        ]);
        $stats = $this->repository->getNumericStats('decimal-dataset', 'valor');
        $this->assertSame(3, (int) $stats['count']);
        $this->assertEqualsWithDelta(-1.5, (float) $stats['min'], 0.00001);
        $this->assertEqualsWithDelta(1.5, (float) $stats['max'], 0.00001);
        $this->assertEqualsWithDelta(0, (float) $stats['mean'], 0.00001);
        $this->assertSame([
            ['range' => '-1.50 - 0.00', 'count' => 1],
            ['range' => '0.00 - 1.50', 'count' => 2],
        ], $this->repository->getHistogram('decimal-dataset', 'valor', 2));
        $scatter = $this->repository->getScatterData('decimal-dataset', 'valor', 'otro');
        $this->assertContains([-1.5, 2.5], $scatter);
        $this->assertCount(3, $scatter);
    }

    public function test_scatter_and_grouped_averages_keep_the_existing_contract(): void
    {
        $scatter = $this->repository->getScatterData('dataset-test', 'valor', 'otro');
        $this->assertCount(5, $scatter);
        $this->assertContains([0.0, 2.0], $scatter);
        $this->assertNotContains([1000.0, 2000.0], $scatter);
        $this->assertCount(2, $this->repository->getScatterData('dataset-test', 'valor', 'otro', 2));
        $averages = $this->repository->getGroupedAverages('dataset-test', 'grupo', 'valor');
        $this->assertSame('B', $averages[0]->categoria);
        $this->assertEqualsWithDelta(3, (float) $averages[0]->promedio, 0.00001);
        $this->assertSame(3, (int) $averages[0]->count);
        $this->assertEqualsWithDelta(0.5, (float) $averages[1]->promedio, 0.00001);
    }

    public function test_contingency_and_time_series_preserve_categories_counts_and_dates(): void
    {
        $table = $this->repository->getContingencyTable('dataset-test', 'grupo', 'otro');
        $this->assertEqualsCanonicalizing(['A', 'B'], $table['categories']);
        $this->assertSame(1, $table['series']['2']['A']);
        $this->assertArrayNotHasKey('2000', $table['series']);
        $time = $this->repository->getTimeSeriesAverage('dataset-test', 'fecha', 'valor');
        $this->assertSame(['2026-01-01', '2026-01-02'], array_column($time, 'fecha'));
        $this->assertEqualsWithDelta(0.5, (float) $time[0]->avg_value, 0.00001);
        $this->assertEqualsWithDelta(3, (float) $time[1]->avg_value, 0.00001);
        $this->assertSame(3, (int) $time[1]->count);
    }

    public function test_stacked_time_series_fills_missing_pairs_and_respects_date_limit(): void
    {
        $this->assertSame([
            'labels_x' => ['2026-01-01', '2026-01-02'],
            'categories' => ['A', 'B'],
            'series' => [
                ['name' => 'A', 'data' => [2, 0]],
                ['name' => 'B', 'data' => [0, 3]],
            ],
        ], $this->repository->getStackedTimeData('dataset-test', 'fecha', 'grupo'));
        $limited = $this->repository->getStackedTimeData('dataset-test', 'fecha', 'grupo', 1);
        $this->assertSame(['2026-01-01'], $limited['labels_x']);
        $this->assertSame([2], $limited['series'][0]['data']);
    }

    public function test_dataset_id_remains_a_bound_value_and_all_json_keys_are_bindings(): void
    {
        DB::enableQueryLog();
        $this->assertSame([], $this->repository->getCategoricalFrequencies("dataset-test' OR 1=1 --", 'grupo'));
        $this->repository->getNumericStats('dataset-test', 'valor');
        $this->repository->getHistogram('dataset-test', 'valor', 2);
        $this->repository->getScatterData('dataset-test', 'valor', 'otro');
        $this->repository->getGroupedAverages('dataset-test', 'grupo', 'valor');
        $this->repository->getContingencyTable('dataset-test', 'grupo', 'otro');
        $this->repository->getTimeSeriesAverage('dataset-test', 'fecha', 'valor');
        $this->repository->getStackedTimeData('dataset-test', 'fecha', 'grupo');

        foreach (DB::getQueryLog() as $query) {
            $this->assertStringContainsString('CAST(? AS text)', $query['query']);
            foreach (['grupo', 'valor', 'otro', "dataset-test' OR 1=1 --"] as $input) {
                $this->assertStringNotContainsString($input, $query['query']);
            }
            $this->assertNotEmpty($query['bindings']);
        }
        DB::disableQueryLog();
        $this->assertSame(9, DB::table('registros_datos')->count());
    }
}

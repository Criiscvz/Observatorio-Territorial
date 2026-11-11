<?php

// Streamed into the disposable E2E container, never copied into production images.
declare(strict_types=1);

if (PHP_SAPI !== 'cli' || getenv('OBSERVATORIO_E2E') !== '1') {
    throw new RuntimeException('Isolated MongoDB verification required.');
}

require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$connection = config('database.connections.mongodb');
if (config('app.url') !== 'http://localhost:4500'
    || $connection['database'] !== 'observatorio_portable_test'
    || parse_url($connection['dsn'], PHP_URL_HOST) !== 'mongo') {
    throw new RuntimeException('Disposable MongoDB connection required.');
}

$check = static function (bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
};
$repository = new App\Infrastructure\Persistence\Mongo\Repositories\MongoRegistroDatoRepository();
$dataset = 'dependency-e2e-'.Illuminate\Support\Str::uuid();
$other = 'dependency-e2e-'.Illuminate\Support\Str::uuid();

try {
    $check($repository->insertBatch($dataset, [
        ['nombre' => 'Primero', 'grupo' => 'A', 'valor' => 10, 'detalle' => ['activo' => true]],
        ['nombre' => 'Segundo', 'grupo' => 'A', 'valor' => 20],
        ['nombre' => 'Tercero', 'grupo' => 'B', 'valor' => 30],
    ]) === 3, 'MongoDB batch insertion failed.');
    $repository->insertBatch($other, [['nombre' => 'Other dataset', 'valor' => 999]]);
    $check($repository->countByDatasetId($dataset) === 3, 'MongoDB dataset scope failed.');
    $rows = $repository->findByDatasetId($dataset);
    $check($rows->count() === 3 && $rows->first()->data['detalle']['activo'] === true,
        'MongoDB nested document hydration failed.');
    $page = $repository->findByDatasetIdPaginated($dataset, 2);
    $check($page->total() === 3 && $page->count() === 2 && $page->lastPage() === 2,
        'MongoDB Eloquent pagination failed.');
    $native = Illuminate\Support\Facades\DB::connection('mongodb')->getMongoDB()
        ->selectCollection('registros_datos')->findOne(['dataset_id' => $dataset]);
    $check($native['created_at'] instanceof MongoDB\BSON\UTCDateTime, 'MongoDB BSON date persistence failed.');
    $check($repository->getCategoricalFrequencies($dataset, 'grupo') === [
        ['categoria' => 'A', 'frecuencia' => 2], ['categoria' => 'B', 'frecuencia' => 1],
    ], 'MongoDB aggregation hydration failed.');
    $stats = $repository->getNumericStats($dataset, 'valor');
    $check($stats['count'] === 3 && $stats['mean'] === 20.0 && $stats['median'] === 20.0,
        'MongoDB numeric aggregation failed.');
    $check($repository->deleteByDatasetId($dataset)
        && $repository->countByDatasetId($dataset) === 0
        && $repository->countByDatasetId($other) === 1, 'MongoDB scoped deletion failed.');
    echo json_encode(['ok' => true, 'checks' => 8, 'syntheticOnly' => true], JSON_THROW_ON_ERROR);
} finally {
    $repository->deleteByDatasetId($dataset);
    $repository->deleteByDatasetId($other);
}

<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Infrastructure\Persistence\Mongo\Models\RegistroDatoMongoModel;
use App\Infrastructure\Persistence\Mongo\Repositories\MongoRegistroDatoRepository;
use App\Models\Dataset;
use App\Models\RegistroDato;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;

class MigrarDatasetsAMongo extends Command
{
    protected $signature = 'datasets:migrar-a-mongo
        {--dataset= : UUID de un dataset específico}
        {--dry-run : Solo mostrar qué se migraría}';

    protected $description = 'Migra los registros de datasets desde PostgreSQL (JSONB) hacia MongoDB de forma idempotente';

    private const BATCH_SIZE = 500;

    public function __construct(
        // Clase concreta a propósito: el binding de la interfaz puede apuntar a Pg o Mongo según config.
        private readonly MongoRegistroDatoRepository $mongoRepo,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $datasetId = $this->option('dataset');

        if ($dryRun) {
            $this->warn('Modo dry-run: no se escribirá nada en MongoDB.');
        }

        $datasets = $this->resolveDatasets($datasetId);

        if ($datasets === null) {
            return self::FAILURE;
        }

        if ($datasets->isEmpty()) {
            $this->warn('No hay datasets para migrar.');
            return self::SUCCESS;
        }

        $rows = [];
        $hasErrors = false;

        foreach ($datasets as $dataset) {
            $id = (string) $dataset->id;
            $pgCount = RegistroDato::where('dataset_id', $id)->count();

            try {
                $mongoCount = $this->mongoRepo->countByDatasetId($id);
            } catch (\Throwable $e) {
                $this->error("  {$dataset->nombre}: no se pudo consultar MongoDB — {$e->getMessage()}");
                $rows[] = [$dataset->nombre, $pgCount, '-', 'ninguna', 'ERROR (conexión Mongo)'];
                $hasErrors = true;
                continue;
            }

            if ($pgCount === 0) {
                $rows[] = [$dataset->nombre, $pgCount, $mongoCount, 'omitir', 'sin registros en PG'];
                continue;
            }

            if ($pgCount === $mongoCount) {
                $rows[] = [$dataset->nombre, $pgCount, $mongoCount, 'omitir', 'ya migrado'];
                continue;
            }

            if ($dryRun) {
                $rows[] = [$dataset->nombre, $pgCount, $mongoCount, 'migrar', 'pendiente (dry-run)'];
                continue;
            }

            $this->line("Migrando '{$dataset->nombre}' ({$pgCount} registros)...");

            try {
                $finalCount = $this->migrateDataset($id);
            } catch (\Throwable $e) {
                $this->error("  Falló la migración de '{$dataset->nombre}': {$e->getMessage()}");
                $rows[] = [$dataset->nombre, $pgCount, '-', 'migrar', 'ERROR: ' . $e->getMessage()];
                $hasErrors = true;
                continue;
            }

            if ($finalCount === $pgCount) {
                $rows[] = [$dataset->nombre, $pgCount, $finalCount, 'migrar', 'OK'];
            } else {
                $rows[] = [$dataset->nombre, $pgCount, $finalCount, 'migrar', 'ERROR: conteos no coinciden'];
                $hasErrors = true;
            }
        }

        $this->newLine();
        $this->table(
            ['Dataset', 'PG', 'Mongo', 'Acción', 'Resultado'],
            $rows,
        );

        if (! $dryRun) {
            $this->ensureIndex();
        }

        if ($hasErrors) {
            $this->error('Migración finalizada con errores. Revisá el detalle por dataset.');
            return self::FAILURE;
        }

        $this->info($dryRun ? 'Dry-run finalizado.' : 'Migración finalizada correctamente.');
        return self::SUCCESS;
    }

    /**
     * Devuelve los datasets a procesar, o null si el --dataset indicado no existe.
     *
     * @return Collection<int, Dataset>|null
     */
    private function resolveDatasets(?string $datasetId): ?Collection
    {
        // withTrashed: los registros de datasets soft-deleted siguen en PG y deben poder migrarse.
        $query = Dataset::withTrashed()->orderBy('nombre');

        if ($datasetId !== null && $datasetId !== '') {
            $query->where('id', $datasetId);
            $datasets = $query->get();

            if ($datasets->isEmpty()) {
                $this->error("No existe un dataset con id {$datasetId}.");
                return null;
            }

            return $datasets;
        }

        return $query->get();
    }

    /**
     * Copia todos los registros del dataset desde PG a MongoDB y devuelve el conteo final en Mongo.
     * Borra primero los documentos previos para que reintentos parciales no dupliquen datos.
     */
    private function migrateDataset(string $datasetId): int
    {
        $this->mongoRepo->deleteByDatasetId($datasetId);

        RegistroDato::where('dataset_id', $datasetId)
            ->orderBy('id')
            ->chunkById(self::BATCH_SIZE, function (Collection $registros) use ($datasetId): void {
                // El cast 'array' del model ya decodifica el JSONB; el fallback cubre filas con data null.
                $records = $registros
                    ->map(fn (RegistroDato $registro): array => $registro->data ?? [])
                    ->all();

                $this->mongoRepo->insertBatch($datasetId, $records);
            });

        return $this->mongoRepo->countByDatasetId($datasetId);
    }

    /**
     * createIndex es idempotente en MongoDB: si ya existe con la misma definición, no hace nada.
     */
    private function ensureIndex(): void
    {
        try {
            RegistroDatoMongoModel::raw(
                fn ($collection) => $collection->createIndex(['dataset_id' => 1])
            );
            $this->line('Índice { dataset_id: 1 } verificado en la colección registros_datos.');
        } catch (\Throwable $e) {
            $this->warn('No se pudo crear el índice dataset_id: ' . $e->getMessage());
        }
    }
}

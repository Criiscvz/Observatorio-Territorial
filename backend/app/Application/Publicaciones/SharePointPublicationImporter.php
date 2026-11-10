<?php

declare(strict_types=1);

namespace App\Application\Publicaciones;

use App\Models\AtlasCategoria;
use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use App\Infrastructure\Services\PublicationPdfStorage;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/** Application coordination; HTTP validation and resource serialization belong to the controller. */
final class SharePointPublicationImporter
{
    public function __construct(private readonly PublicationPdfStorage $pdfStorage) {}

    public function savePdf(User $actor, ?Departamento $departamento, array $file, string $tipo, bool $refresh = false): ObservatorioPublicacion
    {
        $this->ensureCanImport($actor, $departamento, $tipo);
        $existing = $this->find($departamento, (string) $file['id']);
        if ($existing?->archivo_pdf && ! $refresh) return $existing;
        $oldPath = null;
        $path = $this->pdfStorage->copyFromSharePoint($file, $departamento?->id);
        try {
            $publication = DB::transaction(function () use ($actor, $departamento, $file, $tipo, $path, $refresh, &$oldPath) {
                $this->lockImportScope($actor, $departamento, $tipo);
                $existing = $this->find($departamento, (string) $file['id']);
                if ($existing) {
                    $existing = ObservatorioPublicacion::whereKey($existing->id)->lockForUpdate()->firstOrFail();
                    if ($existing->archivo_pdf && ! $refresh) return $existing;
                    $oldPath = $existing->archivo_pdf;
                    $existing->update(['archivo_pdf' => $path, 'nombre_archivo_original' => $file['name'],
                        'sharepoint_last_modified_at' => $file['last_modified_at'] ?? $existing->sharepoint_last_modified_at,
                        'sharepoint_synced_at' => now(), 'sharepoint_sync_status' => 'sincronizado', 'sharepoint_error' => null]);
                    return $existing;
                }
                return $this->createSharePointPdfPublication($actor, $departamento, $file, $tipo, pdfPath: $path);
            });
        } catch (\Throwable $error) {
            $this->pdfStorage->discard($path);
            throw $error;
        }
        if ($publication->archivo_pdf !== $path) $this->pdfStorage->discard($path);
        if ($oldPath && $oldPath !== $path && ! PublicationOrigins::hasTarget($publication->id)) $this->pdfStorage->discard($oldPath);
        return $publication;
    }

    public function importPdfs(
        User $actor,
        ?Departamento $departamento,
        array $fileIds,
        string $tipo,
        callable $resolveFile,
        ?string $categoriaId = null,
    ): array {
        $this->ensureCanImport($actor, $departamento, $tipo);
        $summary = [
            'imported' => [],
            'duplicates' => [],
            'rejected' => [],
            'errors' => [],
        ];

        foreach ($fileIds as $fileId) {
            $copiedPath = null;
            try {
                $file = $resolveFile($fileId);
                $this->ensureCanImport($actor, $departamento, $tipo);
                $existing = $this->find($departamento, (string) $file['id']);
                if (! $existing?->archivo_pdf) $copiedPath = $this->pdfStorage->copyFromSharePoint($file, $departamento?->id);
                $result = DB::transaction(function () use ($actor, $departamento, $file, $tipo, $categoriaId, $copiedPath) {
                    // Match native Atlas creation: category first, global counter second.
                    $this->lockAtlasCategory(['atlas_categoria_id' => $categoriaId]);
                    $this->lockImportScope($actor, $departamento, $tipo);
                    $existing = $this->find($departamento, (string) $file['id']);
                    if ($existing) {
                        $existing = ObservatorioPublicacion::whereKey($existing->id)->lockForUpdate()->firstOrFail();
                        $usedCopy = ! $existing->archivo_pdf;
                        if ($usedCopy) {
                            abort_unless($copiedPath, 409, 'El archivo cambió durante la importación. Inténtalo de nuevo.');
                            $existing->update(['archivo_pdf' => $copiedPath]);
                        }
                        return ['publication' => $existing, 'duplicate' => true, 'used_copy' => $usedCopy];
                    }
                    abort_unless($copiedPath, 409, 'El archivo cambió durante la importación. Inténtalo de nuevo.');
                    $publication = $this->createSharePointPdfPublication($actor, $departamento, $file, $tipo, $categoriaId, $copiedPath);
                    return ['publication' => $publication, 'duplicate' => false, 'used_copy' => true];
                });
                if ($result['used_copy']) $copiedPath = null;
                if ($result['duplicate']) {
                    $summary['duplicates'][] = ['sharepoint_file_id' => $file['id'], 'name' => $file['name'],
                        'publicacion_id' => $result['publication']->id, 'message' => 'El archivo ya habia sido importado.'];
                } else {
                    $summary['imported'][] = $result['publication']->refresh();
                }
            } catch (ValidationException $exception) {
                $summary['errors'][] = [
                    'sharepoint_file_id' => $fileId,
                    'message' => 'La categoría ya no está disponible. Selecciona otra categoría.',
                ];
            } catch (RuntimeException $exception) {
                $message = $exception->getMessage();
                $bucket = str_contains(strtolower($message), 'pdf') ? 'rejected' : 'errors';
                $summary[$bucket][] = [
                    'sharepoint_file_id' => $fileId,
                    'message' => $bucket === 'rejected' ? 'El archivo no es un PDF válido o supera el máximo de 20 MB.'
                        : 'No se pudo importar el archivo seleccionado.',
                ];
            } catch (\Throwable $exception) {
                Log::warning('SharePoint publication import failed', [
                    'sharepoint_file_id' => $fileId,
                    'tipo' => $tipo,
                    'departamento_id' => $departamento?->id,
                    'exception' => $exception::class,
                ]);
                $summary['errors'][] = [
                    'sharepoint_file_id' => $fileId,
                    'message' => 'No se pudo importar el archivo seleccionado.',
                ];
            } finally {
                if ($copiedPath) $this->pdfStorage->discard($copiedPath);
            }
        }

        return [
            'data' => $summary,
            'totals' => [
                'imported' => count($summary['imported']),
                'duplicates' => count($summary['duplicates']),
                'rejected' => count($summary['rejected']),
                'errors' => count($summary['errors']),
            ],
        ];
    }

    public function upsertLink(
        User $actor,
        Departamento $departamento,
        array $file,
        string $tipo,
        string $descripcion,
    ): ObservatorioPublicacion {
        $this->ensureCanImport($actor, $departamento, $tipo);
        return DB::transaction(function () use ($actor, $departamento, $file, $tipo, $descripcion) {
            $this->lockImportScope($actor, $departamento, $tipo);
            $existing = $this->find($departamento, (string) $file['id']);
            $lastModified = $file['last_modified_at'] ? Carbon::parse($file['last_modified_at']) : now();
            $linkUrl = $tipo === 'REPORTE' ? $file['powerbi_url'] : $file['web_url'];

            if ($existing) {
                $existing->update([
                    'tipo' => $tipo,
                    'titulo' => pathinfo((string) $file['name'], PATHINFO_FILENAME) ?: (string) $file['name'],
                    'fecha_publicacion' => $lastModified->toDateString(),
                    'link_url' => $linkUrl,
                    'descripcion' => $existing->descripcion ?: $descripcion,
                    'autores' => $file['created_by'] ?? $existing->autores,
                    'fuente' => 'SharePoint',
                    'archivo_pdf' => $tipo === 'ATLAS' ? $existing->archivo_pdf : null,
                    'nombre_archivo_original' => $tipo === 'ATLAS' ? $file['name'] : null,
                    'sharepoint_url' => $file['web_url'],
                    'sharepoint_file_name' => $file['name'],
                    'sharepoint_file_type' => $file['mime_type'],
                    'sharepoint_file_size' => $file['size'],
                    'sharepoint_last_modified_at' => $file['last_modified_at'],
                    'sharepoint_sync_status' => 'sincronizado',
                    'sharepoint_synced_at' => now(),
                    'sharepoint_error' => null,
                ]);

                return $existing;
            }

            $counter = DB::table('publicacion_contadores')->where('tipo', $tipo)->lockForUpdate()->first();
            abort_unless($counter, 500, 'No se pudo generar el codigo de publicacion.');
            $number = (int) $counter->siguiente_numero;
            DB::table('publicacion_contadores')->where('tipo', $tipo)->update(['siguiente_numero' => $number + 1]);

            return ObservatorioPublicacion::create([
                'departamento_id' => $departamento->id,
                'creado_por' => $actor->id,
                'tipo' => $tipo,
                'estado' => 'PUBLICACION',
                'solo_suscriptores' => false,
                'codigo' => $this->codePrefix($tipo).str_pad((string) $number, 4, '0', STR_PAD_LEFT),
                'titulo' => pathinfo((string) $file['name'], PATHINFO_FILENAME) ?: (string) $file['name'],
                'fecha_publicacion' => $lastModified->toDateString(),
                'link_url' => $linkUrl,
                'descripcion' => $descripcion,
                'autores' => $file['created_by'] ?? null,
                'fuente' => 'SharePoint',
                'archivo_pdf' => null,
                'nombre_archivo_original' => $tipo === 'ATLAS' ? $file['name'] : null,
                'sharepoint_url' => $file['web_url'],
                'sharepoint_file_id' => $file['id'],
                'sharepoint_file_name' => $file['name'],
                'sharepoint_file_type' => $file['mime_type'],
                'sharepoint_file_size' => $file['size'],
                'sharepoint_last_modified_at' => $file['last_modified_at'],
                'sharepoint_sync_status' => 'sincronizado',
                'sharepoint_synced_at' => now(),
                'sharepoint_error' => null,
            ]);
        });
    }

    private function createSharePointPdfPublication(
        User $actor,
        ?Departamento $departamento,
        array $file,
        string $tipo,
        ?string $categoriaId = null,
        ?string $pdfPath = null,
    ): ObservatorioPublicacion {
        $this->ensureCanImport($actor, $departamento, $tipo);
        $this->lockAtlasCategory(['atlas_categoria_id' => $categoriaId]);
        $counter = DB::table('publicacion_contadores')->where('tipo', $tipo)->lockForUpdate()->first();
        abort_unless($counter, 500, 'No se pudo generar el codigo de publicacion.');
        $number = (int) $counter->siguiente_numero;
        DB::table('publicacion_contadores')->where('tipo', $tipo)->update(['siguiente_numero' => $number + 1]);
        $lastModified = $file['last_modified_at'] ? Carbon::parse($file['last_modified_at']) : now();
        $isArticulo = $tipo === 'ARTICULO';
        $codePrefix = $this->codePrefix($tipo);

        return ObservatorioPublicacion::create([
            'departamento_id' => $departamento?->id,
            ...($tipo === 'ATLAS' ? ['atlas_categoria_id' => $categoriaId] : []),
            'creado_por' => $actor->id,
            'tipo' => $tipo,
            'estado' => 'PUBLICACION',
            'solo_suscriptores' => false,
            'codigo' => $codePrefix.str_pad((string) $number, 4, '0', STR_PAD_LEFT),
            'titulo' => pathinfo((string) $file['name'], PATHINFO_FILENAME) ?: (string) $file['name'],
            'fecha_publicacion' => $lastModified->toDateString(),
            'link_url' => $file['web_url'],
            'descripcion' => match ($tipo) {
                'ARTICULO' => 'Artículo PDF importado desde SharePoint.',
                'REPORTE' => 'Reporte PDF importado desde SharePoint.',
                'LIBRO' => 'Libro PDF importado desde SharePoint.',
                default => 'Atlas PDF importado desde SharePoint.',
            },
            'autores' => $file['created_by'] ?? ($isArticulo ? 'ULEAM' : null),
            'fuente' => 'SharePoint',
            'archivo_pdf' => $pdfPath,
            'nombre_archivo_original' => $file['name'],
            'sharepoint_url' => $file['web_url'],
            'sharepoint_file_id' => $file['id'],
            'sharepoint_file_name' => $file['name'],
            'sharepoint_file_type' => $file['mime_type'],
            'sharepoint_file_size' => $file['size'],
            'sharepoint_last_modified_at' => $file['last_modified_at'],
            'sharepoint_sync_status' => 'sincronizado',
            'sharepoint_synced_at' => now(),
            'sharepoint_error' => null,
        ]);
    }

    public function find(
        ?Departamento $departamento,
        string $sharePointFileId,
    ): ?ObservatorioPublicacion {
        $query = ObservatorioPublicacion::query()
            ->where('sharepoint_file_id', $sharePointFileId);

        if ($departamento) {
            $query->where('departamento_id', $departamento->id);
        } else {
            $query->whereNull('departamento_id');
        }

        return $query->first();
    }

    private function lockAtlasCategory(array $data): void
    {
        if (! empty($data['atlas_categoria_id']) && ! AtlasCategoria::whereKey($data['atlas_categoria_id'])->lockForUpdate()->first()) {
            throw ValidationException::withMessages(['atlas_categoria_id' => 'La categoría ya no está disponible. Selecciona otra categoría.']);
        }
    }

    /** Serialize imports per observatory, or globally for Atlas, before rechecking duplicates. */
    private function lockImportScope(User $actor, ?Departamento $department, string $type): void
    {
        $this->ensureCanImport($actor, $department, $type);
        if ($department) {
            Departamento::whereKey($department->id)->lockForUpdate()->firstOrFail();
        } else {
            abort_unless(DB::table('publicacion_contadores')->where('tipo', 'ATLAS')->lockForUpdate()->first(), 503);
        }
    }

    private function ensureCanImport(User $actor, ?Departamento $department, string $type): void
    {
        abort_unless($actor->is_active && ! $actor->trashed() && $actor->isAdmin(), 403,
            'Solo administración puede importar desde SharePoint.');
        abort_if($department?->trashed(), 404);
        abort_unless(in_array($type, ['ARTICULO', 'REPORTE', 'LIBRO', 'ATLAS'], true)
            && ($department !== null || $type === 'ATLAS'), 422, 'El destino de importación no es válido.');
    }

    private function codePrefix(string $tipo): string
    {
        return match ($tipo) {
            'ARTICULO' => 'ART-',
            'REPORTE' => 'REP-',
            'LIBRO' => 'LIB-',
            default => 'ATL-',
        };
    }
}

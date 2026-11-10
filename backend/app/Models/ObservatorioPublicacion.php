<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ObservatorioPublicacion extends Model
{
    use HasUuids;

    public const ESTADOS = ['PUBLICACION', 'EN_REVISION', 'SUSPENDIDO', 'ARCHIVADO', 'RECHAZADO'];
    public const ESTADOS_CON_OBSERVACION = ['SUSPENDIDO', 'ARCHIVADO', 'RECHAZADO'];

    protected $table = 'observatorio_publicaciones';
    protected $fillable = ['observacion_revision', 'fecha_revision', 'atlas_categoria_id', 'departamento_id', 'creado_por', 'tipo', 'estado', 'solo_suscriptores', 'codigo', 'titulo', 'fecha_publicacion', 'link_url', 'descripcion', 'autores', 'fuente', 'archivo_pdf', 'nombre_archivo_original', 'sharepoint_url', 'sharepoint_file_id', 'sharepoint_file_name', 'sharepoint_file_type', 'sharepoint_file_size', 'sharepoint_last_modified_at', 'sharepoint_sync_status', 'sharepoint_synced_at', 'sharepoint_error'];
    protected $casts = ['fecha_revision' => 'datetime', 'fecha_publicacion' => 'date:Y-m-d', 'solo_suscriptores' => 'boolean', 'autores' => 'array', 'sharepoint_last_modified_at' => 'datetime', 'sharepoint_synced_at' => 'datetime'];

    protected static function booted(): void
    {
        // A preserved tombstone must never become a routable active publication.
        static::addGlobalScope('legacy_not_deleted', fn (Builder $query) =>
            $query->whereNull($query->getModel()->qualifyColumn('eliminado_legado_at')));
    }

    public function hasPrivateLegacyAccess(): bool
    {
        return $this->visibilidad_legada !== null
            && ! in_array($this->visibilidad_legada, ['publico', 'suscriptor'], true);
    }

    public function scopePublicLegacyAccess(Builder $query): Builder
    {
        return $query->where(fn (Builder $q) => $q->whereNull('visibilidad_legada')
            ->orWhereIn('visibilidad_legada', ['publico', 'suscriptor']));
    }

    public function scopeVisibleLegacyAccess(Builder $query, ?User $user): Builder
    {
        if ($user?->isAdmin()) { return $query; }

        return $query->where(function (Builder $visible) use ($user): void {
            $visible->publicLegacyAccess();
            if ($user?->isObservatoryAdmin()) {
                $visible->orWhere(fn (Builder $manager) => $manager->whereIn('tipo', ['ARTICULO', 'REPORTE', 'LIBRO'])
                    ->whereIn('departamento_id', $user->observatoryIds('puede_revisar')));
            } elseif ($user?->isEditor()) {
                $visible->orWhere(fn (Builder $owned) => $owned->whereIn('tipo', ['ARTICULO', 'REPORTE', 'LIBRO'])
                    ->where('creado_por', $user->id)->whereIn('departamento_id', $user->departamentos()
                        ->wherePivotIn('rol', ['ADMIN', 'EDITOR'])->pluck('departamentos.id')));
            }
        });
    }

    public function setAutoresAttribute(mixed $value): void
    {
        $autores = is_array($value) ? $value : [$value];
        $autores = array_values(array_filter(array_map(
            fn (mixed $autor): string => is_string($autor) ? trim($autor) : '',
            $autores,
        )));

        $this->attributes['autores'] = $autores
            ? json_encode($autores, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)
            : null;
    }

    public function atlasCategoria(): BelongsTo
    {
        return $this->belongsTo(AtlasCategoria::class, 'atlas_categoria_id');
    }

    public function scopeInPublicAtlasCategories(Builder $query): Builder
    {
        return $query->where(fn (Builder $q) => $q->whereNull('atlas_categoria_id')
            ->orWhereHas('atlasCategoria', fn (Builder $category) => $category->where('publico', true)));
    }

    public function departamento(): BelongsTo
    {
        return $this->belongsTo(Departamento::class, 'departamento_id');
    }

    public function creadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }
}

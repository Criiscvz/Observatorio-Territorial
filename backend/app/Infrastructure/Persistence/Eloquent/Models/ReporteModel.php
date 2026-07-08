<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Builder;

class ReporteModel extends Model
{
    use HasUuids;
    use SoftDeletes;

    protected $table = 'reportes';

    protected $fillable = [
        'categoria_id',
        'departamento_id',
        'nombre_indicador',
        'descripcion_indicador',
        'fecha_publicacion',
        'link_url',
        'ficha_indicador',
        'fuente',
        'visibilidad',
    ];

    protected $casts = [
        'fecha_publicacion' => 'date',
    ];

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(CategoriaDatasetModel::class, 'categoria_id');
    }

    public function departamento(): BelongsTo
    {
        return $this->belongsTo(DepartamentoModel::class, 'departamento_id');
    }

    /** Scope: filtrar por departamento */
    public function scopeDelDepartamento(Builder $query, string $departamentoId): Builder
    {
        return $query->where('departamento_id', $departamentoId);
    }
}

<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class DatasetModel extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'datasets';

    protected $fillable = [
        'departamento_id',
        'categoria_id',
        'subido_por',
        'nombre',
        'nombre_archivo',
        'descripcion',
        'enlace_fuente',
        'estado',
        'total_registros',
        'fecha_carga',
    ];

    protected $casts = [
        'fecha_carga' => 'datetime',
        'total_registros' => 'integer',
    ];

    public function departamento(): BelongsTo
    {
        return $this->belongsTo(DepartamentoModel::class, 'departamento_id');
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(CategoriaDatasetModel::class, 'categoria_id');
    }

    public function subidoPor(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'subido_por');
    }

    public function variablesMetadatos(): HasMany
    {
        return $this->hasMany(VariableMetadatoModel::class, 'dataset_id');
    }

    public function registrosDatos(): HasMany
    {
        return $this->hasMany(RegistroDatoModel::class, 'dataset_id');
    }

    public function fuentes(): HasMany
    {
        return $this->hasMany(DatasetFuenteModel::class, 'dataset_id');
    }

    public function graficosPredeterminados(): HasMany
    {
        return $this->hasMany(GraficoPredeterminadoModel::class, 'dataset_id');
    }

    public function scopeCompletados($query)
    {
        return $query->where('estado', 'COMPLETADO');
    }

    public function scopePendientes($query)
    {
        return $query->where('estado', 'PENDIENTE');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Dataset extends Model
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

    /**
     * Departamento al que pertenece
     */
    public function departamento(): BelongsTo
    {
        return $this->belongsTo(Departamento::class, 'departamento_id');
    }

    /**
     * Usuario que subió el dataset
     */
    public function subidoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'subido_por');
    }

    /**
     * Metadatos de variables del dataset
     */
    public function variablesMetadatos(): HasMany
    {
        return $this->hasMany(VariableMetadato::class, 'dataset_id');
    }

    /**
     * Registros de datos del dataset
     */
    public function registrosDatos(): HasMany
    {
        return $this->hasMany(RegistroDato::class, 'dataset_id');
    }

    /**
     * Scope para datasets completados
     */
    public function scopeCompletados($query)
    {
        return $query->where('estado', 'COMPLETADO');
    }

    /**
     * Scope para datasets pendientes
     */
    public function scopePendientes($query)
    {
        return $query->where('estado', 'PENDIENTE');
    }
}

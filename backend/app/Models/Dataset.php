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

    protected $fillable = [
        'departamento_id',
        'subido_por',
        'nombre',
        'nombre_archivo',
        'descripcion',
        'estado',
        'total_registros',
        'fecha_carga',
    ];

    protected $casts = [
        'fecha_carga' => 'datetime',
        'total_registros' => 'integer',
    ];

    /**
     * Departamento al que pertenece este dataset
     */
    public function departamento(): BelongsTo
    {
        return $this->belongsTo(Departamento::class);
    }

    /**
     * Usuario que subió el dataset
     */
    public function subidoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'subido_por');
    }

    /**
     * Metadatos de las variables/columnas
     */
    public function variablesMetadatos(): HasMany
    {
        return $this->hasMany(VariableMetadato::class)->orderBy('orden');
    }

    /**
     * Registros de datos del dataset
     */
    public function registrosDatos(): HasMany
    {
        return $this->hasMany(RegistroDato::class);
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

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VariableMetadato extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'variables_metadatos';

    protected $fillable = [
        'dataset_id',
        'nombre_columna',
        'nombre_original',
        'tipo_dato',
        'tipo_detectado',
        'es_visible',
        'orden',
        'opciones',
    ];

    protected $casts = [
        'es_visible' => 'boolean',
        'orden' => 'integer',
        'opciones' => 'array',
    ];

    /**
     * Dataset al que pertenece
     */
    public function dataset(): BelongsTo
    {
        return $this->belongsTo(Dataset::class, 'dataset_id');
    }

    /**
     * Scope para variables visibles
     */
    public function scopeVisibles($query)
    {
        return $query->where('es_visible', true);
    }
}

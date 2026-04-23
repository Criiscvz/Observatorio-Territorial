<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VariableMetadatoModel extends Model
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

    public function dataset(): BelongsTo
    {
        return $this->belongsTo(DatasetModel::class, 'dataset_id');
    }

    public function scopeVisibles($query)
    {
        return $query->where('es_visible', true);
    }
}

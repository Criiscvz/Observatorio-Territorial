<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RegistroDato extends Model
{
    use HasFactory;

    protected $table = 'registros_datos';

    protected $fillable = [
        'dataset_id',
        'data',
    ];

    protected $casts = [
        'data' => 'array',
    ];

    /**
     * Dataset al que pertenece
     */
    public function dataset(): BelongsTo
    {
        return $this->belongsTo(Dataset::class, 'dataset_id');
    }

    /**
     * Obtener valor de una columna específica
     */
    public function getValue(string $columna): mixed
    {
        return $this->data[$columna] ?? null;
    }
}

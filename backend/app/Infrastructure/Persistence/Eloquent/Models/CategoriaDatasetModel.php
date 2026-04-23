<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CategoriaDatasetModel extends Model
{
    use HasUuids;

    protected $table = 'categorias_dataset';

    protected $fillable = [
        'nombre',
        'codigo',
        'descripcion',
        'icono',
        'color',
        'orden',
        'activo',
    ];

    protected $casts = [
        'orden' => 'integer',
        'activo' => 'boolean',
    ];

    public function datasets(): HasMany
    {
        return $this->hasMany(DatasetModel::class, 'categoria_id');
    }
}

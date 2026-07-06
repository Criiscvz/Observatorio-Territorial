<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ArticuloModel extends Model
{
    use HasUuids;
    use SoftDeletes;

    protected $table = 'articulos';

    protected $fillable = [
        'categoria_id',
        'departamento_id',
        'titulo',
        'descripcion',
        'autor',
        'fuente',
        'estado',
        'enlace',
        'fecha_publicacion',
        'fecha_recepcion',
    ];

    protected $casts = [
        'fecha_publicacion' => 'date',
        'fecha_recepcion' => 'date',
    ];

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(CategoriaDatasetModel::class, 'categoria_id');
    }

    public function departamento(): BelongsTo
    {
        return $this->belongsTo(DepartamentoModel::class, 'departamento_id');
    }
}

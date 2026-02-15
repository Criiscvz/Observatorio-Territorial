<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GraficoPredeterminadoModel extends Model
{
    use HasUuids;

    protected $table = 'graficos_predeterminados';

    protected $fillable = [
        'dataset_id',
        'titulo',
        'descripcion',
        'tipo_grafico',
        'tipo_analisis',
        'variable_x_id',
        'variable_y_id',
        'filtros',
        'configuracion',
        'orden',
        'activo',
        'creado_por',
    ];

    protected $casts = [
        'filtros' => 'array',
        'configuracion' => 'array',
        'orden' => 'integer',
        'activo' => 'boolean',
    ];

    public function dataset(): BelongsTo
    {
        return $this->belongsTo(DatasetModel::class, 'dataset_id');
    }

    public function variableX(): BelongsTo
    {
        return $this->belongsTo(VariableMetadatoModel::class, 'variable_x_id');
    }

    public function variableY(): BelongsTo
    {
        return $this->belongsTo(VariableMetadatoModel::class, 'variable_y_id');
    }

    public function creadoPor(): BelongsTo
    {
        return $this->belongsTo(UserModel::class, 'creado_por');
    }
}

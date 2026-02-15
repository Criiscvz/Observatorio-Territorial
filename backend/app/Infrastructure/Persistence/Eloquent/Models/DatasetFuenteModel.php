<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DatasetFuenteModel extends Model
{
    use HasUuids;

    protected $table = 'dataset_fuentes';

    protected $fillable = [
        'dataset_id',
        'titulo',
        'url',
        'descripcion',
        'orden',
    ];

    protected $casts = [
        'orden' => 'integer',
    ];

    public function dataset(): BelongsTo
    {
        return $this->belongsTo(DatasetModel::class, 'dataset_id');
    }
}

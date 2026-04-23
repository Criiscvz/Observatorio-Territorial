<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RegistroDatoModel extends Model
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

    public function dataset(): BelongsTo
    {
        return $this->belongsTo(DatasetModel::class, 'dataset_id');
    }

    public function getValue(string $columna): mixed
    {
        return $this->data[$columna] ?? null;
    }
}

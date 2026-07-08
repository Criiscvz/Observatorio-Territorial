<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Infrastructure\Persistence\Eloquent\Models\DepartamentoModel;

class PermisoModel extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'permisos';

    protected $fillable = [
        'user_id',
        'modulo',
        'nivel',
        'departamento_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(UserModel::class);
    }

    public function departamento(): BelongsTo
    {
        return $this->belongsTo(DepartamentoModel::class, 'departamento_id');
    }
}

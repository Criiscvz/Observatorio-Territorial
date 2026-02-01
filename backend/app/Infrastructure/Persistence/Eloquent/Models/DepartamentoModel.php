<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class DepartamentoModel extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'departamentos';

    protected $fillable = [
        'nombre',
        'codigo_interno',
        'descripcion',
        'icono',
        'publico',
    ];

    protected $casts = [
        'publico' => 'boolean',
    ];

    public function usuarios(): BelongsToMany
    {
        return $this->belongsToMany(UserModel::class, 'usuario_departamento', 'departamento_id', 'user_id')
            ->withPivot('rol')
            ->withTimestamps();
    }

    public function datasets(): HasMany
    {
        return $this->hasMany(DatasetModel::class, 'departamento_id');
    }

    public function scopePublicos($query)
    {
        return $query->where('publico', true);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Departamento extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    protected $table = 'departamentos';

    protected $fillable = [
        'nombre',
        'codigo_interno',
        'descripcion',
        'publico',
    ];

    protected $casts = [
        'publico' => 'boolean',
    ];

    /**
     * Usuarios del departamento
     */
    public function usuarios(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'usuario_departamento', 'departamento_id', 'user_id')
            ->withPivot('rol')
            ->withTimestamps();
    }

    /**
     * Datasets del departamento
     */
    public function datasets(): HasMany
    {
        return $this->hasMany(Dataset::class, 'departamento_id');
    }

    /**
     * Scope para departamentos públicos
     */
    public function scopePublicos($query)
    {
        return $query->where('publico', true);
    }
}

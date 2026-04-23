<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class UserModel extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens;

    protected $table = 'users';

    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function perfil(): HasOne
    {
        return $this->hasOne(PerfilModel::class, 'user_id');
    }

    public function departamentos(): BelongsToMany
    {
        return $this->belongsToMany(DepartamentoModel::class, 'usuario_departamento', 'user_id', 'departamento_id')
            ->withPivot('rol')
            ->withTimestamps();
    }

    public function datasets(): HasMany
    {
        return $this->hasMany(DatasetModel::class, 'subido_por');
    }

    public function tieneRolEnDepartamento(string $departamentoId, string $rol): bool
    {
        return $this->departamentos()
            ->where('departamento_id', $departamentoId)
            ->wherePivot('rol', $rol)
            ->exists();
    }

    public function esAdminDeAlgunDepartamento(): bool
    {
        return $this->departamentos()
            ->wherePivot('rol', 'ADMIN')
            ->exists();
    }
}

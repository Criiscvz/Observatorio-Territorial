<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Perfil del usuario
     */
    public function perfil(): HasOne
    {
        return $this->hasOne(Perfil::class);
    }

    /**
     * Departamentos a los que pertenece el usuario
     */
    public function departamentos(): BelongsToMany
    {
        return $this->belongsToMany(Departamento::class, 'usuario_departamento')
            ->withPivot('rol')
            ->withTimestamps();
    }

    /**
     * Datasets subidos por el usuario
     */
    public function datasets(): HasMany
    {
        return $this->hasMany(Dataset::class, 'subido_por');
    }

    /**
     * Verificar si el usuario tiene un rol específico en un departamento
     */
    public function tieneRolEnDepartamento(string $departamentoId, string $rol): bool
    {
        return $this->departamentos()
            ->where('departamento_id', $departamentoId)
            ->wherePivot('rol', $rol)
            ->exists();
    }

    /**
     * Verificar si el usuario es admin de algún departamento
     */
    public function esAdminDeAlgunDepartamento(): bool
    {
        return $this->departamentos()
            ->wherePivot('rol', 'ADMIN')
            ->exists();
    }
}

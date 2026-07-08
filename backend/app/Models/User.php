<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Permiso;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens, SoftDeletes;

    /**
     * Boot method para proteger la asignación de los roles ADMIN y EDITOR
     */
    protected static function boot(): void
    {
        parent::boot();

        // Proteger la asignación de los roles ADMIN/EDITOR al crear usuarios
        static::creating(function (User $user) {
            // Si se intenta crear un usuario con rol ADMIN o EDITOR
            if (in_array($user->rol, ['ADMIN', 'EDITOR'])) {
                // Verificar si hay un usuario autenticado que sea ADMIN
                $currentUser = auth()->user();

                // Si no hay usuario autenticado o no es admin, forzar rol USER
                // NOTA: Esto permite crear admins via seeder (no hay usuario autenticado en CLI)
                // pero protege la API de crear admins sin autorización
                if ($currentUser && !$currentUser->isAdmin()) {
                    $user->rol = 'USER';
                }
            }
        });

        // Proteger la actualización del rol a ADMIN o EDITOR
        static::updating(function (User $user) {
            // Si se intenta cambiar el rol a ADMIN o EDITOR
            if ($user->isDirty('rol') && in_array($user->rol, ['ADMIN', 'EDITOR'])) {
                $currentUser = auth()->user();

                // Solo permitir si el usuario actual es admin
                if (!$currentUser || !$currentUser->isAdmin()) {
                    $user->rol = $user->getOriginal('rol');
                }
            }
        });
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'rol',
        'is_active',
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
            'is_active' => 'boolean',
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
     * Permisos del usuario (Atlas, Reportes, Observatorios)
     */
    public function permisos(): HasMany
    {
        return $this->hasMany(Permiso::class, 'user_id');
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

    /**
     * Verificar si el usuario tiene rol global ADMIN
     */
    public function isAdmin(): bool
    {
        return $this->rol === 'ADMIN';
    }

    /**
     * Verificar si el usuario tiene rol global USER
     */
    public function isUser(): bool
    {
        return $this->rol === 'USER';
    }

    /**
     * Verificar si el usuario tiene rol global EDITOR
     */
    public function isEditor(): bool
    {
        return $this->rol === 'EDITOR';
    }

    /**
     * Verificar si el usuario tiene rol global SUBSCRIBER
     */
    public function isSubscriber(): bool
    {
        return $this->rol === 'SUBSCRIBER';
    }

    /**
     * Verificar si el usuario tiene un rol global específico
     */
    public function hasRole(string $role): bool
    {
        return $this->rol === $role;
    }

    /**
     * Verificar si el usuario está activo
     */
    public function isActive(): bool
    {
        return $this->is_active;
    }

    /**
     * Activar usuario
     */
    public function activate(): void
    {
        $this->is_active = true;
        $this->save();
    }

    /**
     * Desactivar/Bloquear usuario
     */
    public function deactivate(): void
    {
        $this->is_active = false;
        $this->save();
    }
}

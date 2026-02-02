<?php

declare(strict_types=1);

namespace App\Application\User\UseCases;

use App\Application\User\DTOs\UpdateUserDTO;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class UpdateUserUseCase
{
    /**
     * Actualiza un usuario existente.
     * Solo puede ser ejecutado por un administrador.
     */
    public function execute(UpdateUserDTO $dto): User
    {
        return DB::transaction(function () use ($dto) {
            // Verificar que el usuario que ejecuta la acción es admin
            $admin = User::findOrFail($dto->adminId);

            if (!$admin->isAdmin()) {
                throw new AccessDeniedHttpException('Solo los administradores pueden actualizar usuarios');
            }

            // Buscar el usuario a modificar
            $user = User::with('perfil')->find($dto->userId);

            if (!$user) {
                throw new NotFoundHttpException('Usuario no encontrado');
            }

            // Actualizar datos básicos
            if ($dto->name !== null) {
                $user->name = $dto->name;
            }

            if ($dto->email !== null && $dto->email !== $user->email) {
                // Verificar que el nuevo email no esté en uso
                if (User::where('email', $dto->email)->where('id', '!=', $user->id)->exists()) {
                    throw new ConflictHttpException('El email ya está en uso por otro usuario');
                }
                $user->email = $dto->email;
            }

            if ($dto->password !== null) {
                $user->password = Hash::make($dto->password);
            }

            if ($dto->rol !== null) {
                if (!in_array($dto->rol, ['ADMIN', 'USER'])) {
                    throw new \InvalidArgumentException('Rol inválido. Los roles permitidos son: ADMIN, USER');
                }
                $user->rol = $dto->rol;
            }

            if ($dto->isActive !== null) {
                $user->is_active = $dto->isActive;
            }

            $user->save();

            // Actualizar perfil
            $perfilData = array_filter([
                'telefono' => $dto->telefono,
                'cargo' => $dto->cargo,
                'bio' => $dto->bio,
            ], fn($value) => $value !== null);

            if (!empty($perfilData)) {
                if ($user->perfil) {
                    $user->perfil->update($perfilData);
                } else {
                    $user->perfil()->create($perfilData);
                }
            }

            // Recargar relaciones
            $user->load(['perfil', 'departamentos']);

            return $user;
        });
    }
}

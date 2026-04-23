<?php

declare(strict_types=1);

namespace App\Application\User\UseCases;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DeleteUserUseCase
{
    /**
     * Elimina un usuario (soft delete).
     * Solo puede ser ejecutado por un administrador.
     */
    public function execute(int $userId, int $adminId): bool
    {
        return DB::transaction(function () use ($userId, $adminId) {
            // Verificar que el usuario que ejecuta la acción es admin
            $admin = User::findOrFail($adminId);

            if (!$admin->isAdmin()) {
                throw new AccessDeniedHttpException('Solo los administradores pueden eliminar usuarios');
            }

            // No permitir auto-eliminación
            if ($userId === $adminId) {
                throw new BadRequestHttpException('No puedes eliminarte a ti mismo');
            }

            // Buscar el usuario a eliminar
            $user = User::find($userId);

            if (!$user) {
                throw new NotFoundHttpException('Usuario no encontrado');
            }

            // Eliminar tokens de acceso
            $user->tokens()->delete();

            // Soft delete del usuario
            $user->delete();

            return true;
        });
    }
}

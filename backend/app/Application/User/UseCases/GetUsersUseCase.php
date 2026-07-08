<?php

declare(strict_types=1);

namespace App\Application\User\UseCases;

use App\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class GetUsersUseCase
{
    /**
     * Obtiene la lista de usuarios.
     * Solo puede ser ejecutado por un administrador.
     */
    public function execute(int $adminId, int $perPage = 15, ?string $search = null): LengthAwarePaginator
    {
        // Verificar que el usuario que ejecuta la acción es admin
        $admin = User::findOrFail($adminId);

        if (!$admin->isAdmin()) {
            throw new AccessDeniedHttpException('Solo los administradores pueden ver la lista de usuarios');
        }

        $query = User::with(['perfil', 'departamentos'])->orderBy('created_at', 'desc');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%' . $search . '%')
                  ->orWhere('email', 'like', '%' . $search . '%');
            });
        }

        return $query->paginate($perPage);
    }
}

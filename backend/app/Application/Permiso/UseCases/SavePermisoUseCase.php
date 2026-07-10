<?php

declare(strict_types=1);

namespace App\Application\Permiso\UseCases;

use App\Application\Permiso\DTOs\PermisoResponseDTO;
use App\Domain\Permiso\Entities\Permiso;
use App\Domain\Permiso\Repositories\PermisoRepositoryInterface;
use App\Models\Departamento;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SavePermisoUseCase
{
    public function __construct(
        private readonly PermisoRepositoryInterface $permisoRepository,
    ) {}

    /**
     * Guarda o actualiza un permiso para un usuario.
     * Si el nivel es 'ninguno', elimina el permiso si existe.
     */
    public function execute(int $userId, string $modulo, string $nivel, ?string $departamentoId = null): ?PermisoResponseDTO
    {
        // Si es "ninguno", eliminar el permiso existente
        if ($nivel === Permiso::NIVEL_NINGUNO) {
            $existing = $this->permisoRepository->findOne($userId, $modulo, $departamentoId);
            if ($existing) {
                $this->permisoRepository->delete($existing->id);
            }
            return PermisoResponseDTO::fromNivel($userId, $modulo, $nivel, $departamentoId);
        }

        $permiso = Permiso::create(
            userId: $userId,
            modulo: $modulo,
            nivel: $nivel,
            departamentoId: $departamentoId,
        );

        $saved = $this->permisoRepository->save($permiso);

        return PermisoResponseDTO::fromEntity($saved);
    }

    /**
     * Guarda múltiples permisos de una vez (reemplaza todos los del usuario).
     * @param array $permisosData - Array de [modulo, nivel, departamento_id?]
     */
    public function saveAll(int $userId, array $permisosData): array
    {
        $user = User::query()->findOrFail($userId);

        // Obtener permisos actuales para detectar los que ya no existen
        $existing = $this->permisoRepository->findByUserId($userId);
        $observatorioPermisos = array_values(array_filter(
            $permisosData,
            fn(array $data) => ($data['modulo'] ?? null) === Permiso::MODULO_OBSERVATORIOS
        ));

        if ($this->hasActiveObservatorioPermission($observatorioPermisos) && ! in_array($user->rol, ['ADMIN', 'EDITOR'], true)) {
            throw ValidationException::withMessages([
                'user_id' => ['Solo usuarios ADMIN o EDITOR pueden recibir permisos de edición sobre Observatorios.'],
            ]);
        }

        // Construir key para identificar permisos existentes
        $incomingKeys = [];
        $results = [];

        foreach ($permisosData as $data) {
            $modulo = $data['modulo'];
            $nivel = $data['nivel'];
            $departamentoId = $data['departamento_id'] ?? null;

            $key = $modulo . '|' . ($departamentoId ?? '');
            $incomingKeys[] = $key;

            $result = $this->execute($userId, $modulo, $nivel, $departamentoId);
            if ($result) {
                $results[] = $result;
            }
        }

        // Eliminar permisos que ya no están en la nueva configuración
        foreach ($existing as $permiso) {
            $key = $permiso->modulo . '|' . ($permiso->departamentoId ?? '');
            if (!in_array($key, $incomingKeys)) {
                $this->permisoRepository->delete($permiso->id);
            }
        }

        if (!empty($observatorioPermisos)) {
            $this->syncObservatorioAccess($userId, $observatorioPermisos);
        }

        return $results;
    }

    /**
     * Mantiene sincronizada la tabla operativa usuario_departamento.
     *
     * La pantalla de permisos guarda configuracion en la tabla permisos, pero el
     * listado de Observatorios y la subida de publicaciones validan la pivote
     * usuario_departamento. Por eso reflejamos aqui el acceso real.
     */
    private function syncObservatorioAccess(int $userId, array $observatorioPermisos): void
    {
        $desired = [];

        foreach ($observatorioPermisos as $permiso) {
            $nivel = $permiso['nivel'] ?? Permiso::NIVEL_NINGUNO;
            $departamentoId = $permiso['departamento_id'] ?? null;

            if ($nivel === Permiso::NIVEL_NINGUNO) {
                continue;
            }

            $rol = $this->mapNivelToDepartamentoRole($nivel);
            if ($rol === null) {
                continue;
            }

            $departamentoIds = $departamentoId === null
                ? Departamento::query()->pluck('id')->all()
                : [$departamentoId];

            foreach ($departamentoIds as $id) {
                $desired[$id] = $rol;
            }
        }

        DB::transaction(function () use ($userId, $desired): void {
            DB::table('usuario_departamento')
                ->where('user_id', $userId)
                ->when(
                    !empty($desired),
                    fn($query) => $query->whereNotIn('departamento_id', array_keys($desired))
                )
                ->delete();

            foreach ($desired as $departamentoId => $rol) {
                $existing = DB::table('usuario_departamento')
                    ->where('user_id', $userId)
                    ->where('departamento_id', $departamentoId)
                    ->first();

                if ($existing) {
                    DB::table('usuario_departamento')
                        ->where('id', $existing->id)
                        ->update([
                            'rol' => $rol,
                            'updated_at' => now(),
                        ]);
                    continue;
                }

                DB::table('usuario_departamento')->insert([
                    'id' => Str::uuid()->toString(),
                    'user_id' => $userId,
                    'departamento_id' => $departamentoId,
                    'rol' => $rol,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });
    }

    private function mapNivelToDepartamentoRole(string $nivel): ?string
    {
        return match ($nivel) {
            Permiso::NIVEL_LECTURA => 'LECTOR',
            Permiso::NIVEL_ESCRITURA => 'EDITOR',
            Permiso::NIVEL_ADMIN => 'ADMIN',
            default => null,
        };
    }

    private function hasActiveObservatorioPermission(array $observatorioPermisos): bool
    {
        foreach ($observatorioPermisos as $permiso) {
            if (($permiso['nivel'] ?? Permiso::NIVEL_NINGUNO) !== Permiso::NIVEL_NINGUNO) {
                return true;
            }
        }

        return false;
    }
}

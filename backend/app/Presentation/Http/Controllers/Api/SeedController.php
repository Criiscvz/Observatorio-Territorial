<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Database\Seeders\AdminUserSeeder;
use Database\Seeders\DepartamentoSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

/**
 * @OA\Tag(
 *     name="Seed",
 *     description="Endpoints para inicializar datos del sistema"
 * )
 */
class SeedController extends Controller
{
    /**
     * @OA\Post(
     *     path="/api/seed/admin",
     *     summary="Crear usuario administrador inicial",
     *     tags={"Seed"},
     *     @OA\Parameter(
     *         name="X-Seed-Token",
     *         in="header",
     *         required=true,
     *         description="Token de seguridad para ejecutar seeders",
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Usuario administrador creado exitosamente",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Usuario administrador creado exitosamente")
     *         )
     *     ),
     *     @OA\Response(
     *         response=403,
     *         description="Token de seguridad inválido"
     *     )
     * )
     */
    public function seedAdmin(Request $request): JsonResponse
    {
        if (!$this->validateSeedToken($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Token de seguridad inválido',
            ], 403);
        }

        try {
            // Validar que las credenciales estén configuradas
            if (empty(env('ADMIN_EMAIL')) || empty(env('ADMIN_PASSWORD'))) {
                return response()->json([
                    'success' => false,
                    'message' => 'Las variables ADMIN_EMAIL y ADMIN_PASSWORD deben estar configuradas en .env',
                ], 400);
            }

            $seeder = new AdminUserSeeder();
            $seeder->setCommand($this->createFakeCommand());
            $seeder->run();

            return response()->json([
                'success' => true,
                'message' => 'Usuario administrador creado exitosamente',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear usuario administrador: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * @OA\Post(
     *     path="/api/seed/departamentos",
     *     summary="Crear departamentos iniciales",
     *     tags={"Seed"},
     *     @OA\Parameter(
     *         name="X-Seed-Token",
     *         in="header",
     *         required=true,
     *         description="Token de seguridad para ejecutar seeders",
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Departamentos creados exitosamente",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Departamentos creados exitosamente"),
     *             @OA\Property(
     *                 property="departamentos",
     *                 type="array",
     *                 @OA\Items(type="string", example="Social")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=403,
     *         description="Token de seguridad inválido"
     *     )
     * )
     */
    public function seedDepartamentos(Request $request): JsonResponse
    {
        if (!$this->validateSeedToken($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Token de seguridad inválido',
            ], 403);
        }

        try {
            $seeder = new DepartamentoSeeder();
            $seeder->setCommand($this->createFakeCommand());
            $seeder->run();

            return response()->json([
                'success' => true,
                'message' => 'Departamentos creados exitosamente',
                'departamentos' => ['Social', 'Laboral', 'Electoral', 'Turístico'],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear departamentos: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * @OA\Post(
     *     path="/api/seed/all",
     *     summary="Ejecutar todos los seeders iniciales",
     *     tags={"Seed"},
     *     @OA\Parameter(
     *         name="X-Seed-Token",
     *         in="header",
     *         required=true,
     *         description="Token de seguridad para ejecutar seeders",
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="Todos los seeders ejecutados exitosamente",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Datos iniciales creados exitosamente")
     *         )
     *     ),
     *     @OA\Response(
     *         response=403,
     *         description="Token de seguridad inválido"
     *     )
     * )
     */
    public function seedAll(Request $request): JsonResponse
    {
        if (!$this->validateSeedToken($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Token de seguridad inválido',
            ], 403);
        }

        try {
            // Validar configuración de admin
            $adminConfigured = !empty(env('ADMIN_EMAIL')) && !empty(env('ADMIN_PASSWORD'));

            // Ejecutar seeders en orden
            if ($adminConfigured) {
                $adminSeeder = new AdminUserSeeder();
                $adminSeeder->setCommand($this->createFakeCommand());
                $adminSeeder->run();
            }

            $departamentoSeeder = new DepartamentoSeeder();
            $departamentoSeeder->setCommand($this->createFakeCommand());
            $departamentoSeeder->run();

            return response()->json([
                'success' => true,
                'message' => 'Datos iniciales creados exitosamente',
                'data' => [
                    'admin_created' => $adminConfigured,
                    'departamentos' => ['Social', 'Laboral', 'Electoral', 'Turístico'],
                ],
                'warnings' => !$adminConfigured ? ['Usuario admin no creado: configura ADMIN_EMAIL y ADMIN_PASSWORD en .env'] : [],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al ejecutar seeders: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Validar el token de seguridad para ejecutar seeders.
     */
    private function validateSeedToken(Request $request): bool
    {
        $token = $request->header('X-Seed-Token');
        $expectedToken = env('SEED_TOKEN');

        // Si no hay token configurado, no permitir el acceso
        if (empty($expectedToken)) {
            return false;
        }

        return $token === $expectedToken;
    }

    /**
     * Crear un comando falso para los seeders.
     */
    private function createFakeCommand(): \Illuminate\Console\Command
    {
        return new class extends \Illuminate\Console\Command {
            public function info($string, $verbosity = null)
            {
                // Silenciar salida en contexto HTTP
            }

            public function error($string, $verbosity = null)
            {
                // Silenciar salida en contexto HTTP
            }
        };
    }
}

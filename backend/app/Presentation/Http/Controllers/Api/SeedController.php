<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use OpenApi\Attributes as OA;
use App\Http\Controllers\Controller;
use Database\Seeders\AdminUserSeeder;
use Database\Seeders\DepartamentoSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

#[OA\Tag(name: 'Seed', description: 'Endpoints para inicializar datos del sistema')]
class SeedController extends Controller
{
    #[OA\Post(
        path: '/seed/admin',
        summary: 'Crear usuario administrador inicial',
        tags: ['Seed'],
        parameters: [
            new OA\Parameter(
                name: 'X-Seed-Token',
                in: 'header',
                required: true,
                description: 'Token de seguridad para ejecutar seeders',
                schema: new OA\Schema(type: 'string')
            )
        ],
        responses: [
            new OA\Response(response: 200, description: 'Usuario administrador creado exitosamente'),
            new OA\Response(response: 403, description: 'Token de seguridad inválido')
        ]
    )]
    public function seedAdmin(Request $request): JsonResponse
    {
        if (!$this->validateSeedToken($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Token de seguridad inválido',
            ], 403);
        }

        try {
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

    #[OA\Post(
        path: '/seed/departamentos',
        summary: 'Crear departamentos iniciales',
        tags: ['Seed'],
        parameters: [
            new OA\Parameter(
                name: 'X-Seed-Token',
                in: 'header',
                required: true,
                description: 'Token de seguridad para ejecutar seeders',
                schema: new OA\Schema(type: 'string')
            )
        ],
        responses: [
            new OA\Response(response: 200, description: 'Departamentos creados exitosamente'),
            new OA\Response(response: 403, description: 'Token de seguridad inválido')
        ]
    )]
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

    #[OA\Post(
        path: '/seed/all',
        summary: 'Ejecutar todos los seeders iniciales',
        tags: ['Seed'],
        parameters: [
            new OA\Parameter(
                name: 'X-Seed-Token',
                in: 'header',
                required: true,
                description: 'Token de seguridad para ejecutar seeders',
                schema: new OA\Schema(type: 'string')
            )
        ],
        responses: [
            new OA\Response(response: 200, description: 'Todos los seeders ejecutados exitosamente'),
            new OA\Response(response: 403, description: 'Token de seguridad inválido')
        ]
    )]
    public function seedAll(Request $request): JsonResponse
    {
        if (!$this->validateSeedToken($request)) {
            return response()->json([
                'success' => false,
                'message' => 'Token de seguridad inválido',
            ], 403);
        }

        try {
            $adminConfigured = !empty(env('ADMIN_EMAIL')) && !empty(env('ADMIN_PASSWORD'));

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

    private function validateSeedToken(Request $request): bool
    {
        $token = $request->header('X-Seed-Token');
        $expectedToken = env('SEED_TOKEN');

        if (empty($expectedToken)) {
            return false;
        }

        return $token === $expectedToken;
    }

    private function createFakeCommand(): \Illuminate\Console\Command
    {
        return new class extends \Illuminate\Console\Command {
            public function info($string, $verbosity = null) {}
            public function error($string, $verbosity = null) {}
        };
    }
}

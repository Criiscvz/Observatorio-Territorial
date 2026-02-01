<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use OpenApi\Attributes as OA;
use App\Application\User\DTOs\UpdateUserRoleDTO;
use App\Application\User\UseCases\GetUsersUseCase;
use App\Application\User\UseCases\UpdateUserRoleUseCase;
use App\Http\Controllers\Controller;
use App\Presentation\Http\Requests\User\UpdateUserRoleRequest;
use App\Presentation\Http\Resources\Auth\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[OA\Tag(name: 'Users', description: 'Gestión de usuarios (solo administradores)')]
class UserController extends Controller
{
    public function __construct(
        private readonly GetUsersUseCase $getUsersUseCase,
        private readonly UpdateUserRoleUseCase $updateUserRoleUseCase,
    ) {}

    #[OA\Get(
        path: '/users',
        summary: 'Listar todos los usuarios (solo admin)',
        security: [['sanctum' => []]],
        tags: ['Users'],
        parameters: [
            new OA\Parameter(name: 'per_page', in: 'query', required: false, schema: new OA\Schema(type: 'integer', default: 15))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Lista de usuarios'),
            new OA\Response(response: 403, description: 'No autorizado')
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $users = $this->getUsersUseCase->execute($request->user()->id, $perPage);

        return response()->json([
            'data' => UserResource::collection($users->items()),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    #[OA\Patch(
        path: '/users/{id}/role',
        summary: 'Cambiar rol de un usuario (solo admin)',
        security: [['sanctum' => []]],
        tags: ['Users'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['rol'],
                properties: [
                    new OA\Property(property: 'rol', type: 'string', enum: ['ADMIN', 'USER'], example: 'USER')
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Rol actualizado'),
            new OA\Response(response: 403, description: 'No autorizado'),
            new OA\Response(response: 404, description: 'Usuario no encontrado')
        ]
    )]
    public function updateRole(UpdateUserRoleRequest $request, int $id): JsonResponse
    {
        $dto = UpdateUserRoleDTO::fromArray(
            array_merge($request->validated(), ['user_id' => $id]),
            $request->user()->id
        );

        $user = $this->updateUserRoleUseCase->execute($dto);

        return response()->json([
            'message' => 'Rol actualizado exitosamente',
            'user' => new UserResource($user),
        ]);
    }
}

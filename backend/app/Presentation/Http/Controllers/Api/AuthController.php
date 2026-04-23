<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use OpenApi\Attributes as OA;
use App\Application\Auth\DTOs\LoginDTO;
use App\Application\Auth\DTOs\RegisterDTO;
use App\Application\Auth\UseCases\GetCurrentUserUseCase;
use App\Application\Auth\UseCases\LoginUseCase;
use App\Application\Auth\UseCases\LogoutUseCase;
use App\Application\Auth\UseCases\RegisterUseCase;
use App\Http\Controllers\Controller;
use App\Presentation\Http\Requests\Auth\LoginRequest;
use App\Presentation\Http\Requests\Auth\RegisterRequest;
use App\Presentation\Http\Resources\Auth\AuthResource;
use App\Presentation\Http\Resources\Auth\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[OA\Tag(name: 'Auth', description: 'Endpoints de autenticación')]
class AuthController extends Controller
{
    public function __construct(
        private readonly LoginUseCase $loginUseCase,
        private readonly RegisterUseCase $registerUseCase,
        private readonly LogoutUseCase $logoutUseCase,
        private readonly GetCurrentUserUseCase $getCurrentUserUseCase,
    ) {}

    #[OA\Post(
        path: '/login',
        summary: 'Iniciar sesión',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email', 'password'],
                properties: [
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'admin@example.com'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', example: 'password123')
                ]
            )
        ),
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Login exitoso'),
            new OA\Response(response: 422, description: 'Credenciales inválidas')
        ]
    )]
    public function login(LoginRequest $request): JsonResponse
    {
        $dto = LoginDTO::fromArray($request->validated());
        $result = $this->loginUseCase->execute($dto);

        return response()->json(new AuthResource($result));
    }

    #[OA\Post(
        path: '/register',
        summary: 'Registrar nuevo usuario',
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'email', 'password', 'password_confirmation'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'John Doe'),
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'user@example.com'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', example: 'password123'),
                    new OA\Property(property: 'password_confirmation', type: 'string', format: 'password', example: 'password123')
                ]
            )
        ),
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 201, description: 'Registro exitoso'),
            new OA\Response(response: 422, description: 'Datos inválidos')
        ]
    )]
    public function register(RegisterRequest $request): JsonResponse
    {
        $dto = RegisterDTO::fromArray($request->validated());
        $result = $this->registerUseCase->execute($dto);

        return response()->json(new AuthResource($result), 201);
    }

    #[OA\Post(
        path: '/logout',
        summary: 'Cerrar sesión',
        security: [['sanctum' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Logout exitoso')
        ]
    )]
    public function logout(Request $request): JsonResponse
    {
        $this->logoutUseCase->execute($request->user());

        return response()->json(['message' => 'Sesión cerrada exitosamente']);
    }

    #[OA\Get(
        path: '/user',
        summary: 'Obtener usuario actual',
        security: [['sanctum' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Datos del usuario')
        ]
    )]
    public function user(Request $request): JsonResponse
    {
        $user = $this->getCurrentUserUseCase->execute($request->user());

        return response()->json(new UserResource($user));
    }
}

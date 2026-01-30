<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Application\Auth\DTOs\LoginDTO;
use App\Application\Auth\DTOs\RegisterDTO;
use App\Application\Auth\UseCases\GetCurrentUserUseCase;
use App\Application\Auth\UseCases\LoginUseCase;
use App\Application\Auth\UseCases\LogoutUseCase;
use App\Application\Auth\UseCases\RegisterUseCase;
use App\Http\Controllers\Controller;
use App\Presentation\Http\Requests\LoginRequest;
use App\Presentation\Http\Requests\RegisterRequest;
use App\Presentation\Http\Resources\AuthResource;
use App\Presentation\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @OA\Tag(
 *     name="Auth",
 *     description="Endpoints de autenticación"
 * )
 */
class AuthController extends Controller
{
    public function __construct(
        private readonly LoginUseCase $loginUseCase,
        private readonly RegisterUseCase $registerUseCase,
        private readonly LogoutUseCase $logoutUseCase,
        private readonly GetCurrentUserUseCase $getCurrentUserUseCase,
    ) {}

    /**
     * @OA\Post(
     *     path="/api/login",
     *     summary="Iniciar sesión",
     *     tags={"Auth"},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"email","password"},
     *             @OA\Property(property="email", type="string", format="email"),
     *             @OA\Property(property="password", type="string", format="password")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Login exitoso"),
     *     @OA\Response(response=422, description="Credenciales inválidas")
     * )
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $dto = LoginDTO::fromArray($request->validated());
        $result = $this->loginUseCase->execute($dto);
        
        return response()->json(new AuthResource($result));
    }

    /**
     * @OA\Post(
     *     path="/api/register",
     *     summary="Registrar nuevo usuario",
     *     tags={"Auth"},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"name","email","password","password_confirmation"},
     *             @OA\Property(property="name", type="string"),
     *             @OA\Property(property="email", type="string", format="email"),
     *             @OA\Property(property="password", type="string", format="password"),
     *             @OA\Property(property="password_confirmation", type="string", format="password")
     *         )
     *     ),
     *     @OA\Response(response=201, description="Registro exitoso"),
     *     @OA\Response(response=422, description="Datos inválidos")
     * )
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $dto = RegisterDTO::fromArray($request->validated());
        $result = $this->registerUseCase->execute($dto);
        
        return response()->json(new AuthResource($result), 201);
    }

    /**
     * @OA\Post(
     *     path="/api/logout",
     *     summary="Cerrar sesión",
     *     tags={"Auth"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=200, description="Logout exitoso")
     * )
     */
    public function logout(Request $request): JsonResponse
    {
        $this->logoutUseCase->execute($request->user());
        
        return response()->json(['message' => 'Sesión cerrada exitosamente']);
    }

    /**
     * @OA\Get(
     *     path="/api/user",
     *     summary="Obtener usuario actual",
     *     tags={"Auth"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=200, description="Datos del usuario")
     * )
     */
    public function user(Request $request): JsonResponse
    {
        $result = $this->getCurrentUserUseCase->execute($request->user());
        
        return response()->json(new UserResource((object) $result));
    }
}

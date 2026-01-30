<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

class AuthController extends Controller
{
    #[OA\Post(
        path: '/auth/register',
        summary: 'Registrar nuevo usuario',
        description: 'Crea una nueva cuenta de usuario en el sistema',
        tags: ['Autenticación'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'email', 'password', 'password_confirmation'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Juan Pérez'),
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'juan@uleam.edu.ec'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', example: 'password123'),
                    new OA\Property(property: 'password_confirmation', type: 'string', format: 'password', example: 'password123'),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: 'Usuario creado exitosamente',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Usuario creado exitosamente'),
                        new OA\Property(property: 'user', type: 'object'),
                        new OA\Property(property: 'token', type: 'string'),
                    ]
                )
            ),
            new OA\Response(response: 422, description: 'Error de validación'),
        ]
    )]
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        // Crear perfil vacío
        $user->perfil()->create([]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Usuario creado exitosamente',
            'user' => $user->load('perfil'),
            'token' => $token,
        ], 201);
    }

    #[OA\Post(
        path: '/auth/login',
        summary: 'Iniciar sesión',
        description: 'Autentica un usuario y devuelve un token de acceso',
        tags: ['Autenticación'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email', 'password'],
                properties: [
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'juan@uleam.edu.ec'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', example: 'password123'),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Login exitoso',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Login exitoso'),
                        new OA\Property(property: 'user', type: 'object'),
                        new OA\Property(property: 'token', type: 'string'),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'Credenciales inválidas'),
        ]
    )]
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if (!Auth::attempt($validated)) {
            throw ValidationException::withMessages([
                'email' => ['Las credenciales proporcionadas son incorrectas.'],
            ]);
        }

        $user = User::where('email', $validated['email'])->firstOrFail();
        
        // Revocar tokens anteriores
        $user->tokens()->delete();
        
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login exitoso',
            'user' => $user->load(['perfil', 'departamentos']),
            'token' => $token,
        ]);
    }

    #[OA\Post(
        path: '/auth/logout',
        summary: 'Cerrar sesión',
        description: 'Revoca el token actual del usuario',
        tags: ['Autenticación'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Sesión cerrada exitosamente',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Sesión cerrada exitosamente'),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'No autenticado'),
        ]
    )]
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Sesión cerrada exitosamente',
        ]);
    }

    #[OA\Get(
        path: '/auth/user',
        summary: 'Obtener usuario actual',
        description: 'Devuelve la información del usuario autenticado',
        tags: ['Autenticación'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Usuario actual',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'user', type: 'object'),
                    ]
                )
            ),
            new OA\Response(response: 401, description: 'No autenticado'),
        ]
    )]
    public function user(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user()->load(['perfil', 'departamentos']),
        ]);
    }
}

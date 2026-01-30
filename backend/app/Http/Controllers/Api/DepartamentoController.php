<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Departamento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;

class DepartamentoController extends Controller
{
    #[OA\Get(
        path: '/departamentos',
        summary: 'Listar departamentos',
        description: 'Obtiene la lista de departamentos del usuario autenticado',
        tags: ['Departamentos'],
        security: [['sanctum' => []]],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Lista de departamentos',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'departamentos', type: 'array', items: new OA\Items(type: 'object')),
                    ]
                )
            ),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $departamentos = $request->user()->departamentos()->with('datasets')->get();

        return response()->json([
            'departamentos' => $departamentos,
        ]);
    }

    #[OA\Post(
        path: '/departamentos',
        summary: 'Crear departamento',
        description: 'Crea un nuevo departamento',
        tags: ['Departamentos'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['nombre'],
                properties: [
                    new OA\Property(property: 'nombre', type: 'string', example: 'Bienestar Estudiantil'),
                    new OA\Property(property: 'descripcion', type: 'string', example: 'Departamento de bienestar'),
                    new OA\Property(property: 'publico', type: 'boolean', example: false),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Departamento creado'),
            new OA\Response(response: 422, description: 'Error de validación'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:255',
            'descripcion' => 'nullable|string',
            'publico' => 'boolean',
        ]);

        // Generar código interno único
        $codigoInterno = 'DEP-' . strtoupper(Str::random(6));
        while (Departamento::where('codigo_interno', $codigoInterno)->exists()) {
            $codigoInterno = 'DEP-' . strtoupper(Str::random(6));
        }

        $departamento = Departamento::create([
            ...$validated,
            'codigo_interno' => $codigoInterno,
        ]);

        // Asignar al usuario creador como ADMIN
        $request->user()->departamentos()->attach($departamento->id, [
            'id' => Str::uuid()->toString(),
            'rol' => 'ADMIN',
        ]);

        return response()->json([
            'message' => 'Departamento creado exitosamente',
            'departamento' => $departamento->load('usuarios'),
        ], 201);
    }

    #[OA\Get(
        path: '/departamentos/{id}',
        summary: 'Obtener departamento',
        description: 'Obtiene un departamento específico',
        tags: ['Departamentos'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Departamento encontrado'),
            new OA\Response(response: 404, description: 'No encontrado'),
        ]
    )]
    public function show(Request $request, Departamento $departamento): JsonResponse
    {
        // Verificar acceso
        if (!$request->user()->departamentos()->where('departamento_id', $departamento->id)->exists()) {
            return response()->json(['message' => 'No autorizado'], 403);
        }

        return response()->json([
            'departamento' => $departamento->load(['usuarios', 'datasets.variablesMetadatos']),
        ]);
    }

    #[OA\Put(
        path: '/departamentos/{id}',
        summary: 'Actualizar departamento',
        description: 'Actualiza un departamento existente',
        tags: ['Departamentos'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'nombre', type: 'string'),
                    new OA\Property(property: 'descripcion', type: 'string'),
                    new OA\Property(property: 'publico', type: 'boolean'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Departamento actualizado'),
            new OA\Response(response: 403, description: 'No autorizado'),
        ]
    )]
    public function update(Request $request, Departamento $departamento): JsonResponse
    {
        // Verificar que sea ADMIN del departamento
        if (!$request->user()->tieneRolEnDepartamento($departamento->id, 'ADMIN')) {
            return response()->json(['message' => 'Solo administradores pueden editar'], 403);
        }

        $validated = $request->validate([
            'nombre' => 'sometimes|string|max:255',
            'descripcion' => 'nullable|string',
            'publico' => 'boolean',
        ]);

        $departamento->update($validated);

        return response()->json([
            'message' => 'Departamento actualizado',
            'departamento' => $departamento->fresh(),
        ]);
    }

    #[OA\Delete(
        path: '/departamentos/{id}',
        summary: 'Eliminar departamento',
        description: 'Elimina un departamento (soft delete)',
        tags: ['Departamentos'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Departamento eliminado'),
            new OA\Response(response: 403, description: 'No autorizado'),
        ]
    )]
    public function destroy(Request $request, Departamento $departamento): JsonResponse
    {
        if (!$request->user()->tieneRolEnDepartamento($departamento->id, 'ADMIN')) {
            return response()->json(['message' => 'Solo administradores pueden eliminar'], 403);
        }

        $departamento->delete();

        return response()->json([
            'message' => 'Departamento eliminado exitosamente',
        ]);
    }

    #[OA\Get(
        path: '/public/departamentos',
        summary: 'Listar departamentos públicos',
        description: 'Obtiene la lista de departamentos públicos (sin autenticación)',
        tags: ['Público'],
        responses: [
            new OA\Response(response: 200, description: 'Lista de departamentos públicos'),
        ]
    )]
    public function publicIndex(): JsonResponse
    {
        $departamentos = Departamento::publicos()
            ->select(['id', 'nombre', 'descripcion', 'codigo_interno'])
            ->withCount('datasets')
            ->get();

        return response()->json([
            'departamentos' => $departamentos,
        ]);
    }
}

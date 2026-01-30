<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RegistroDato;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class RegistroDatoController extends Controller
{
    #[OA\Get(
        path: '/registros-datos',
        summary: 'Listar registros de datos',
        description: 'Obtiene los registros de un dataset con paginación',
        tags: ['Registros Datos'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'dataset_id', in: 'query', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 50)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Lista paginada de registros'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'dataset_id' => 'required|uuid|exists:datasets,id',
            'per_page' => 'integer|min:1|max:100',
        ]);

        $perPage = $request->get('per_page', 50);

        $registros = RegistroDato::where('dataset_id', $request->dataset_id)
            ->paginate($perPage);

        return response()->json($registros);
    }

    #[OA\Get(
        path: '/registros-datos/{id}',
        summary: 'Obtener registro',
        description: 'Obtiene un registro específico',
        tags: ['Registros Datos'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Registro encontrado'),
        ]
    )]
    public function show(RegistroDato $registroDato): JsonResponse
    {
        return response()->json([
            'registro' => $registroDato,
        ]);
    }
}

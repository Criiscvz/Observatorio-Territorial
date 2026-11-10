<?php

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AtlasCategoria;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AtlasCategoriaController extends Controller
{
    public function index()
    {
        return response()->json(['data' => AtlasCategoria::orderBy('nombre')->get()]);
    }

    public function indexPublico()
    {
        return response()->json(['data' => AtlasCategoria::where('publico', true)->orderBy('nombre')->get()]);
    }

    public function directory(Request $request)
    {
        return $this->directoryResponse($request, false);
    }

    public function publicDirectory(Request $request)
    {
        return $this->directoryResponse($request, true);
    }

    private function directoryResponse(Request $request, bool $public)
    {
        $filters = $request->validate(['q' => ['nullable', 'string', 'max:200']]);
        $scope = function ($q) use ($public): void {
            $q->where('tipo', 'ATLAS')->whereNull('departamento_id');
            if ($public) { $q->publicLegacyAccess()->where('estado', 'PUBLICACION'); }
        };
        $categories = AtlasCategoria::query()->when($public, fn ($q) => $q->where('publico', true))
            ->withCount(['publicaciones as publicaciones_total' => $scope]);
        if (filled($filters['q'] ?? null)) {
            // Category/name and publication matches are evaluated in SQL without returning all publications.
            $categories->where(function ($q) use ($scope, $filters): void {
                \App\Application\Publicaciones\PublicationLibrarySearch::apply($q, $filters['q'], false, ['nombre', 'descripcion']);
                $q->orWhereHas('publicaciones', function ($p) use ($scope, $filters): void {
                    $scope($p); \App\Application\Publicaciones\PublicationLibrarySearch::apply($p, $filters['q']);
                });
            });
        }
        $data = $categories->orderBy('nombre')->orderBy('id')->get()->map(fn ($category) => [
            'id' => $category->id, 'nombre' => $category->nombre, 'descripcion' => $category->descripcion,
            'icono' => $category->icono, 'publico' => $category->publico, 'publicaciones_total' => (int) $category->publicaciones_total,
        ]);
        $unassigned = $public ? 0 : \App\Models\ObservatorioPublicacion::where('tipo', 'ATLAS')->whereNull('departamento_id')->whereNull('atlas_categoria_id')->count();
        return response()->json(['data' => $data, 'unassigned_total' => $unassigned]);
    }

    public function store(Request $request)
    {
        return $this->save($request, new AtlasCategoria(), 201);
    }

    public function update(Request $request, AtlasCategoria $categoria)
    {
        return $this->save($request, $categoria, 200);
    }

    private function save(Request $request, AtlasCategoria $categoria, int $status)
    {
        if (is_string($request->input('nombre'))) {
            $request->merge(['nombre' => AtlasCategoria::normalize($request->input('nombre'))]);
        }
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:150'],
            'descripcion' => ['nullable', 'string', 'max:3000'],
            'publico' => ['sometimes', 'boolean'],
            'icono' => ['sometimes', 'nullable', 'string', 'max:50', Rule::in(config('atlas.category_icons'))],
        ], ['nombre.required' => 'El nombre de la categoría es obligatorio.']);
        $key = AtlasCategoria::key($data['nombre']);
        if (AtlasCategoria::withTrashed()->where('nombre_clave', $key)
            ->when($categoria->exists, fn ($q) => $q->where('id', '!=', $categoria->id))->exists()) {
            throw ValidationException::withMessages(['nombre' => 'Ya existe una categoría con ese nombre (incluso si fue eliminada).']);
        }
        try {
            $categoria->fill($data)->save();
        } catch (QueryException $e) {
            if (in_array((string) $e->getCode(), ['23505', '23000'], true)) {
                throw ValidationException::withMessages(['nombre' => 'Ya existe una categoría con ese nombre.']);
            }
            throw $e;
        }
        return response()->json(['data' => $categoria, 'message' => 'Categoría guardada correctamente.'], $status);
    }

    public function destroy(AtlasCategoria $categoria)
    {
        return DB::transaction(function () use ($categoria) {
            $categoria = AtlasCategoria::whereKey($categoria->id)->lockForUpdate()->firstOrFail();
            if ($categoria->publicaciones()->exists()) {
                return response()->json(['message' => 'La categoría tiene contenido asociado. Primero debes reasignar o gestionar ese contenido.'], 409);
            }
            $categoria->delete();
            return response()->json(['message' => 'Categoría eliminada correctamente.']);
        });
    }
}

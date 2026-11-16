<?php

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AtlasCategoria;
use App\Presentation\Http\Requests\Atlas\AtlasDirectoryRequest;
use App\Presentation\Http\Requests\Atlas\SaveAtlasCategoriaRequest;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
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

    public function directory(AtlasDirectoryRequest $request)
    {
        return $this->directoryResponse($request, false);
    }

    public function publicDirectory(AtlasDirectoryRequest $request)
    {
        return $this->directoryResponse($request, true);
    }

    private function directoryResponse(AtlasDirectoryRequest $request, bool $public)
    {
        $filters = $request->validated();
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

    public function store(SaveAtlasCategoriaRequest $request)
    {
        return $this->save($request, new AtlasCategoria(), 201);
    }

    public function update(SaveAtlasCategoriaRequest $request, AtlasCategoria $categoria)
    {
        return $this->save($request, $categoria, 200);
    }

    private function save(SaveAtlasCategoriaRequest $request, AtlasCategoria $categoria, int $status)
    {
        $data = $request->validated();
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

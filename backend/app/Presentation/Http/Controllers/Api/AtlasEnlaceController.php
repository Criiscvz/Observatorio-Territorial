<?php

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AtlasCategoria;
use App\Models\ObservatorioPublicacion;
use App\Presentation\Http\Requests\Atlas\SaveAtlasEnlaceRequest;
use App\Presentation\Http\Resources\Publicacion\PublicacionResource;
use Illuminate\Support\Facades\DB;

class AtlasEnlaceController extends Controller
{
    public function store(SaveAtlasEnlaceRequest $request, AtlasCategoria $categoria)
    {
        return $this->save($request, $categoria, new ObservatorioPublicacion());
    }

    public function update(SaveAtlasEnlaceRequest $request, ObservatorioPublicacion $publicacion)
    {
        $this->ensureGlobalAtlas($publicacion);
        $data = $request->validated();
        return $this->save($request, AtlasCategoria::findOrFail($data['atlas_categoria_id']), $publicacion);
    }

    private function save(SaveAtlasEnlaceRequest $request, AtlasCategoria $categoria, ObservatorioPublicacion $publication)
    {
        $data = $request->safe()->except('atlas_categoria_id');
        $created = ! $publication->exists;
        DB::transaction(function () use ($data, $request, $categoria, $publication, $created) {
            // Lock both categories in stable order when a legacy item is reassigned.
            $ids = array_values(array_unique(array_filter([$categoria->id, $publication->atlas_categoria_id])));
            $categories = AtlasCategoria::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $target = $categories->get($categoria->id);
            abort_unless($target, 422, 'La categoría ya no está disponible.');
            if (! $created) {
                $fresh = ObservatorioPublicacion::whereKey($publication->id)->lockForUpdate()->firstOrFail();
                $this->ensureGlobalAtlas($fresh);
                $publication->setRawAttributes($fresh->getAttributes(), true);
            }
            if ($created) {
                $counter = DB::table('publicacion_contadores')->where('tipo', 'ATLAS')->lockForUpdate()->first();
                abort_unless($counter, 503, 'No se pudo asignar el código de Atlas.');
                DB::table('publicacion_contadores')->where('tipo', 'ATLAS')->update(['siguiente_numero' => $counter->siguiente_numero + 1]);
                $publication->fill(['tipo' => 'ATLAS', 'departamento_id' => null, 'creado_por' => $request->user()->id,
                    'estado' => 'PUBLICACION', 'solo_suscriptores' => false,
                    'codigo' => 'ATL-'.str_pad((string) $counter->siguiente_numero, 4, '0', STR_PAD_LEFT)]);
            }
            $oldCategory = $publication->atlas_categoria_id;
            $publication->fill($data);
            $publication->atlas_categoria_id = $target->id;
            $publication->save();
            if ($oldCategory && $oldCategory !== $target->id) {
                AtlasCategoria::whereKey($oldCategory)->where('publicacion_destacada_id', $publication->id)
                    ->update(['publicacion_destacada_id' => null]);
            }
        });
        return (new PublicacionResource($publication->fresh()->load(['atlasCategoria', 'creadoPor'])))->response()->setStatusCode($created ? 201 : 200);
    }

    private function ensureGlobalAtlas(ObservatorioPublicacion $publication): void
    {
        abort_unless($publication->tipo === 'ATLAS' && $publication->departamento_id === null, 404);
    }

}

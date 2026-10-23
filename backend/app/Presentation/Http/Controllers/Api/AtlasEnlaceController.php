<?php

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AtlasCategoria;
use App\Models\ObservatorioPublicacion;
use App\Presentation\Http\Resources\Publicacion\PublicacionResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AtlasEnlaceController extends Controller
{
    public function store(Request $request, AtlasCategoria $categoria)
    {
        return $this->save($request, $categoria, new ObservatorioPublicacion());
    }

    public function update(Request $request, ObservatorioPublicacion $publicacion)
    {
        $this->ensureGlobalAtlas($publicacion);
        $data = $request->validate(['atlas_categoria_id' => ['required', 'uuid', Rule::exists('atlas_categorias', 'id')->whereNull('deleted_at')]]);
        return $this->save($request, AtlasCategoria::findOrFail($data['atlas_categoria_id']), $publicacion);
    }

    private function save(Request $request, AtlasCategoria $categoria, ObservatorioPublicacion $publication)
    {
        $request->merge(['titulo' => is_string($request->titulo) ? trim($request->titulo) : $request->titulo]);
        $data = $request->validate([
            'titulo' => ['required', 'string', 'max:255'],
            'fecha_publicacion' => ['required', 'date_format:Y-m-d'],
            'link_url' => ['required', 'url:http,https', 'max:2048'],
            'fuente' => ['nullable', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string', 'max:3000'],
            'mostrar_en_portal' => ['required', 'boolean'],
            'archivo' => ['prohibited'],
        ]);
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
            $publication->fill(collect($data)->except('mostrar_en_portal')->all());
            $publication->atlas_categoria_id = $target->id;
            $publication->save();
            if ($oldCategory && $oldCategory !== $target->id) {
                AtlasCategoria::whereKey($oldCategory)->where('publicacion_destacada_id', $publication->id)
                    ->update(['publicacion_destacada_id' => null]);
            }
            if ($data['mostrar_en_portal']) {
                $this->ensureSelectable($publication);
                $target->publicacion_destacada_id = $publication->id;
                $target->save();
            } elseif ($target->publicacion_destacada_id === $publication->id) {
                $target->publicacion_destacada_id = null;
                $target->save();
            }
        });
        return (new PublicacionResource($publication->fresh()->load(['atlasCategoria', 'creadoPor'])))->response()->setStatusCode($created ? 201 : 200);
    }

    public function select(Request $request, AtlasCategoria $categoria)
    {
        $data = $request->validate(['publicacion_id' => ['required', 'uuid']]);
        DB::transaction(function () use ($categoria, $data) {
            $category = AtlasCategoria::whereKey($categoria->id)->lockForUpdate()->firstOrFail();
            $publication = ObservatorioPublicacion::whereKey($data['publicacion_id'])
                ->where('atlas_categoria_id', $category->id)->lockForUpdate()->firstOrFail();
            $this->ensureGlobalAtlas($publication);
            $this->ensureSelectable($publication);
            $category->publicacion_destacada_id = $publication->id;
            $category->save();
        });
        return response()->json(['data' => $categoria->fresh(), 'message' => 'Atlas seleccionado para el portal.']);
    }

    private function ensureGlobalAtlas(ObservatorioPublicacion $publication): void
    {
        abort_unless($publication->tipo === 'ATLAS' && $publication->departamento_id === null, 404);
    }

    private function ensureSelectable(ObservatorioPublicacion $publication): void
    {
        if ($publication->estado !== 'PUBLICACION' || $publication->solo_suscriptores) {
            throw ValidationException::withMessages(['mostrar_en_portal' => 'Solo se pueden mostrar Atlas publicados y sin restricción de suscripción.']);
        }
        if (! $publication->link_url && ! $publication->archivo_pdf && ! $publication->sharepoint_url) {
            throw ValidationException::withMessages(['mostrar_en_portal' => 'El Atlas no tiene un enlace o archivo disponible.']);
        }
    }
}

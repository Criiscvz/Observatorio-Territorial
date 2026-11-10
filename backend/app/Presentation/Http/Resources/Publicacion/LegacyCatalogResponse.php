<?php

declare(strict_types=1);

namespace App\Presentation\Http\Resources\Publicacion;

use App\Application\Publicaciones\PublicPublicationCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Array shape retained only for old consumers; the new catalog is paginated. */
class LegacyCatalogResponse
{
    public function index(Request $request, string $type): JsonResponse
    {
        $filters = $request->validate(['departamento_id' => ['nullable', 'uuid'], 'categoria_id' => ['nullable', 'uuid']]);
        $rows = app(PublicPublicationCatalog::class)->ordered(['tipo' => $type, ...$filters])->get();
        return response()->json($rows->map(function ($row) use ($request, $type): array {
            $p = (new CatalogPublicationResource($row))->resolve($request);
            $common = array_intersect_key($p, array_flip(['id', 'codigo', 'fuente', 'fecha_publicacion', 'fecha_recepcion',
                'categoria_id', 'departamento_id', 'categoria', 'departamento', 'bloqueado', 'download_url',
                'sharepoint_url', 'created_at', 'updated_at']));
            $common['visibilidad'] = $p['solo_suscriptores'] ? 'suscriptor' : 'publico';
            if ($type === 'ARTICULO') {
                return [...$common, 'titulo' => $p['titulo'], 'descripcion' => $p['descripcion'],
                    'autor' => $row->origen === 'publicaciones' ? $p['autores'] : ($p['autores'][0] ?? null),
                    'estado' => 'PUBLICACION', 'enlace' => $p['download_url'] ?: $p['link_url'], 'link_url' => $p['link_url']];
            }
            return [...$common, 'autores' => $p['autores'], 'nombre_indicador' => $p['titulo'],
                'descripcion_indicador' => $p['descripcion'], 'link_url' => $p['link_url'],
                'ficha_indicador' => $p['download_url'] ?: $p['ficha_indicador'] ?: $p['sharepoint_url']];
        })->all());
    }
}

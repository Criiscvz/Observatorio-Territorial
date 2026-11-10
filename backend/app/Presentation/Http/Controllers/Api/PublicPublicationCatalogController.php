<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Application\Publicaciones\PublicPublicationCatalog;
use App\Http\Controllers\Controller;
use App\Models\Departamento;
use App\Presentation\Http\Resources\Publicacion\CatalogPublicationResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PublicPublicationCatalogController extends Controller
{
    public function index(Request $request, PublicPublicationCatalog $catalog): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'tipo' => ['nullable', 'in:'.implode(',', PublicPublicationCatalog::TYPES)],
            'departamento_id' => ['nullable', 'uuid'], 'categoria_id' => ['nullable', 'uuid'],
            'q' => ['nullable', 'string', 'max:200'], 'page' => ['sometimes', 'integer', 'min:1', 'max:1000000'],
            'per_page' => ['sometimes', 'integer', 'in:20'],
        ]);
        if (filled($filters['departamento_id'] ?? null)) {
            abort_unless(Departamento::query()->publicos()->whereKey($filters['departamento_id'])->exists(), 404);
        }
        $counts = $catalog->query(array_diff_key($filters, ['tipo' => true, 'q' => true]))
            ->selectRaw('tipo, COUNT(*) total')->groupBy('tipo')->pluck('total', 'tipo');
        $page = $catalog->ordered($filters)->paginate(20)->withQueryString();
        return CatalogPublicationResource::collection($page)->additional([
            'counts' => array_replace(array_fill_keys(PublicPublicationCatalog::TYPES, 0), $counts->map(fn ($n) => (int) $n)->all()),
        ]);
    }
}

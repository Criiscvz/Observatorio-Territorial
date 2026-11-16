<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Application\Publicaciones\PublicPublicationCatalog;
use App\Http\Controllers\Controller;
use App\Models\Departamento;
use App\Presentation\Http\Resources\Publicacion\CatalogPublicationResource;
use App\Presentation\Http\Requests\Publicacion\PublicCatalogRequest;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PublicPublicationCatalogController extends Controller
{
    public function index(PublicCatalogRequest $request, PublicPublicationCatalog $catalog): AnonymousResourceCollection
    {
        $filters = $request->validated();
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

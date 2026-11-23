<?php

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BarometroPublicacion;
use App\Presentation\Http\Requests\Barometro\SaveBarometroPublicacionRequest;
use App\Presentation\Http\Requests\Publicacion\PublicationInputRules;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BarometroPublicacionController extends Controller
{
    public function counts(): JsonResponse
    {
        $counts = BarometroPublicacion::query()->selectRaw('seccion, COUNT(*) AS total')
            ->groupBy('seccion')->pluck('total', 'seccion');

        return response()->json(['data' => (object) $counts->all()]);
    }

    public function publicIndex(Request $request, string $seccion): AnonymousResourceCollection
    {
        $filters = $request->validate(PublicationInputRules::pagination() + ['q' => PublicationInputRules::text(200)]);

        return $this->page($seccion, $filters['q'] ?? '', 'PUBLICACION');
    }

    public function index(Request $request, string $seccion): AnonymousResourceCollection
    {
        $filters = $request->validate(PublicationInputRules::pagination() + [
            'q' => PublicationInputRules::text(200),
            'estado' => ['nullable', Rule::in(BarometroPublicacion::STATES)],
        ]);

        return $this->page($seccion, $filters['q'] ?? '', $filters['estado'] ?? null);
    }

    private function page(string $seccion, string $term, ?string $state): AnonymousResourceCollection
    {
        $query = BarometroPublicacion::query()->where('seccion', $seccion);
        if ($state !== null) {
            $query->where('estado', $state);
        }
        if ($term !== '') {
            $pattern = '%'.strtr(Str::lower($term), ['!' => '!!', '%' => '!%', '_' => '!_']).'%';
            $query->where(function (Builder $search) use ($pattern): void {
                $search->whereRaw("LOWER(titulo) LIKE ? ESCAPE '!'", [$pattern])
                    ->orWhereRaw("LOWER(fuente) LIKE ? ESCAPE '!'", [$pattern]);
            });
        }

        return JsonResource::collection($query->orderByDesc('fecha_publicacion')->orderByDesc('id')->paginate(20));
    }

    public function store(SaveBarometroPublicacionRequest $request, string $seccion): JsonResponse
    {
        $publication = new BarometroPublicacion($request->validated());
        $publication->seccion = $seccion;
        $publication->save();

        return response()->json(['data' => $publication], 201);
    }

    public function update(SaveBarometroPublicacionRequest $request, string $seccion, string $publicacion): JsonResponse
    {
        $publication = BarometroPublicacion::query()->where('seccion', $seccion)->findOrFail($publicacion);
        $publication->update($request->validated());

        return response()->json(['data' => $publication]);
    }
}

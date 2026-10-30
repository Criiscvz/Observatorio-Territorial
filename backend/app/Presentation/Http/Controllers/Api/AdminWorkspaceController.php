<?php

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminWorkspaceController extends Controller
{
    public function configuration(): JsonResponse
    {
        return response()->json(['visor_geografico_url' => DB::table('site_settings')
            ->where('key', 'visor_geografico_url')->value('value') ?? config('portal.visor_geografico_url')]);
    }

    public function updateConfiguration(Request $request): JsonResponse
    {
        $data = $request->validate(['visor_geografico_url' => ['required', 'string', 'max:2048', 'url:http,https']]);
        $timestamp = now();
        DB::table('site_settings')->upsert([
            ['key' => 'visor_geografico_url', 'value' => $data['visor_geografico_url'], 'created_at' => $timestamp, 'updated_at' => $timestamp],
        ], ['key'], ['value', 'updated_at']);

        return $this->configuration();
    }

    protected function publications(): Builder
    {
        return ObservatorioPublicacion::query()->visibleLegacyAccess(request()->user())->whereHas('departamento')
            ->whereIn('tipo', ['ARTICULO', 'REPORTE', 'LIBRO']);
    }

    protected function publicationRow(ObservatorioPublicacion $item): array
    {
        return ['id' => $item->id, 'departamento_id' => $item->departamento_id,
            'departamento_nombre' => $item->departamento?->nombre, 'titulo' => $item->titulo,
            'tipo' => $item->tipo, 'estado' => $item->estado, 'codigo' => $item->codigo,
            'capabilities' => app(\App\Policies\ObservatorioPublicacionPolicy::class)->capabilities(request()->user(), $item),
            'observacion_revision' => $item->observacion_revision,
            'fecha_revision' => $item->fecha_revision?->toIso8601String(),
            'fecha_publicacion' => $item->fecha_publicacion?->format('Y-m-d')];
    }

    public function summary(): JsonResponse
    {
        $query = $this->publications();

        return response()->json([
            'observatorios_total' => Departamento::count(),
            'publicaciones_total' => (clone $query)->count(),
            'pendientes_total' => (clone $query)->where('estado', 'EN_REVISION')->count(),
            'observatorios' => Departamento::orderBy('nombre')->limit(5)->get(['id', 'nombre', 'publico']),
            'pendientes' => (clone $query)->with('departamento:id,nombre')->where('estado', 'EN_REVISION')
                ->orderBy('created_at')->orderBy('id')->limit(5)->get()->map(fn ($item) => $this->publicationRow($item)),
        ]);
    }

    public function indexPublications(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'estado' => ['nullable', 'in:'.implode(',', ObservatorioPublicacion::ESTADOS)],
            'tipo' => ['nullable', 'in:ARTICULO,REPORTE,LIBRO'],
            'departamento_id' => ['nullable', 'uuid'], 'q' => ['nullable', 'string', 'max:255'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $query = $this->publications()->with('departamento:id,nombre');
        foreach (['estado', 'tipo', 'departamento_id'] as $key) {
            if (! empty($filters[$key])) {
                $query->where($key, $filters[$key]);
            }
        }
        if (! empty($filters['q'])) {
            $query->whereRaw('LOWER(titulo) LIKE ?', ['%'.mb_strtolower($filters['q']).'%']);
        }
        $items = $query->orderByDesc('updated_at')->orderBy('id')->paginate(20);

        return response()->json(['data' => $items->getCollection()->map(fn ($item) => $this->publicationRow($item)),
            'meta' => ['current_page' => $items->currentPage(), 'last_page' => $items->lastPage(),
                'total' => $items->total(), 'from' => $items->firstItem(), 'to' => $items->lastItem(), 'per_page' => $items->perPage()]]);
    }
}

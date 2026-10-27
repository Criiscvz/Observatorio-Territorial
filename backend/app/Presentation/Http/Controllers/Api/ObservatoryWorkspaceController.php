<?php

namespace App\Presentation\Http\Controllers\Api;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class ObservatoryWorkspaceController extends AdminWorkspaceController
{
    protected function publications(): Builder
    {
        return parent::publications()->whereIn('departamento_id', request()->user()->observatoryIds());
    }

    public function summary(): JsonResponse
    {
        $user = request()->user();
        $assigned = $user->departamentos();
        $query = $this->publications();
        $pending = (clone $query)->where('estado', 'EN_REVISION')
            ->whereIn('departamento_id', $user->observatoryIds('puede_revisar'));

        return response()->json([
            'observatorios_total' => (clone $assigned)->count(),
            'publicaciones_total' => (clone $query)->count(),
            'pendientes_total' => (clone $pending)->count(),
            'observatorios' => $assigned->orderBy('nombre')->limit(5)->get(['departamentos.id', 'nombre', 'publico']),
            'pendientes' => $pending->with('departamento:id,nombre')->orderBy('created_at')->orderBy('id')
                ->limit(5)->get()->map(fn ($item) => $this->publicationRow($item)),
        ]);
    }
}

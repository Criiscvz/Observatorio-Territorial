<?php

namespace App\Presentation\Http\Controllers\Api;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class EditorWorkspaceController extends AdminWorkspaceController
{
    protected function publications(): Builder
    {
        $user = request()->user();

        return parent::publications()->where('creado_por', $user->id)
            ->whereIn('departamento_id', $user->departamentos()
                ->wherePivotIn('rol', ['ADMIN', 'EDITOR'])->pluck('departamentos.id'));
    }

    public function summary(): JsonResponse
    {
        $assigned = request()->user()->departamentos()->wherePivotIn('rol', ['ADMIN', 'EDITOR']);
        $query = $this->publications();

        return response()->json([
            'observatorios_total' => (clone $assigned)->count(),
            'publicaciones_total' => (clone $query)->count(),
            'pendientes_total' => (clone $query)->where('estado', 'EN_REVISION')->count(),
            'observatorios' => (clone $assigned)->orderBy('nombre')->limit(5)
                ->get(['departamentos.id', 'nombre', 'publico']),
            'pendientes' => (clone $query)->with('departamento:id,nombre')->where('estado', 'EN_REVISION')
                ->orderBy('created_at')->orderBy('id')->limit(5)
                ->get()->map(fn ($item) => $this->publicationRow($item)),
        ]);
    }
}

<?php

declare(strict_types=1);

namespace App\Support\Authorization;

use App\Infrastructure\Persistence\Eloquent\Models\DatasetModel;
use App\Infrastructure\Persistence\Eloquent\Models\VariableMetadatoModel;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Applies the observatory-level rule for resources that belong to a department.
 *
 * A global administrator can manage every observatory. An editor must also have
 * an ADMIN or EDITOR role in the target observatory's pivot record.
 */
final class DepartamentoResourceAuthorizer
{
    public function ensureCanManageDepartamento(User $user, ?string $departamentoId): void
    {
        if ($user->isAdmin()) {
            return;
        }

        $canManage = $user->isEditor()
            && $departamentoId !== null
            && DB::table('usuario_departamento')
                ->where('user_id', $user->id)
                ->where('departamento_id', $departamentoId)
                ->whereIn('rol', ['ADMIN', 'EDITOR'])
                ->exists();

        abort_unless($canManage, 403, 'No tienes permisos de edición para este observatorio.');
    }

    public function findManagedDataset(User $user, string $datasetId): DatasetModel
    {
        $dataset = DatasetModel::find($datasetId);

        abort_unless($dataset, 404, 'Dataset no encontrado.');

        $this->ensureCanManageDepartamento($user, $dataset->departamento_id);

        return $dataset;
    }

    /**
     * Prevents a graph from referencing metadata belonging to another dataset.
     */
    public function ensureVariablesBelongToDataset(
        string $datasetId,
        ?string $variableXId,
        ?string $variableYId = null,
    ): void {
        foreach (array_filter([
            'variable_x_id' => $variableXId,
            'variable_y_id' => $variableYId,
        ]) as $field => $variableId) {
            $belongsToDataset = VariableMetadatoModel::query()
                ->whereKey($variableId)
                ->where('dataset_id', $datasetId)
                ->exists();

            if (! $belongsToDataset) {
                throw ValidationException::withMessages([
                    $field => ['La variable debe pertenecer al mismo dataset.'],
                ]);
            }
        }
    }
}

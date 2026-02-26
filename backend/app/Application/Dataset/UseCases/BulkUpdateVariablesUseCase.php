<?php

declare(strict_types=1);

namespace App\Application\Dataset\UseCases;

use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class BulkUpdateVariablesUseCase
{
    public function __construct(
        private readonly VariableMetadatoRepositoryInterface $variableRepository,
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
    ) {}

    /**
     * Bulk update multiple variables with the same operation.
     *
     * @param array $variableIds List of variable UUIDs
     * @param int $userId Authenticated user ID
     * @param array $data Fields to update (es_visible, tipo_dato)
     * @return array Summary of updated variables
     */
    public function execute(array $variableIds, int $userId, array $data): array
    {
        if (empty($variableIds)) {
            throw new HttpException(Response::HTTP_BAD_REQUEST, 'No se proporcionaron variables');
        }

        $updated = [];
        $errors = [];
        $verifiedDatasets = [];

        foreach ($variableIds as $variableId) {
            try {
                $variable = $this->variableRepository->findById($variableId);
                if (!$variable) {
                    $errors[] = ['id' => $variableId, 'error' => 'Variable no encontrada'];
                    continue;
                }

                // Cache dataset access verification
                if (!isset($verifiedDatasets[$variable->datasetId])) {
                    $dataset = $this->datasetRepository->findById($variable->datasetId);
                    if (!$dataset) {
                        $errors[] = ['id' => $variableId, 'error' => 'Dataset no encontrado'];
                        continue;
                    }

                    $role = $this->departamentoRepository->getUserRole($dataset->departamentoId, $userId);
                    if (!in_array($role, ['ADMIN', 'EDITOR'])) {
                        throw new HttpException(Response::HTTP_FORBIDDEN, 'No tienes permisos para modificar variables');
                    }
                    $verifiedDatasets[$variable->datasetId] = true;
                }

                $updatedVariable = $variable->update(
                    tipoDato: $data['tipo_dato'] ?? null,
                    esVisible: $data['es_visible'] ?? null,
                );

                $saved = $this->variableRepository->update($updatedVariable);
                $updated[] = $saved->toArray();
            } catch (HttpException $e) {
                throw $e;
            } catch (\Exception $e) {
                $errors[] = ['id' => $variableId, 'error' => $e->getMessage()];
            }
        }

        return [
            'updated' => count($updated),
            'errors' => count($errors),
            'variables' => $updated,
        ];
    }
}

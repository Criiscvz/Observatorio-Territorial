<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Dataset;

use App\Infrastructure\Persistence\Eloquent\Models\GraficoPredeterminadoModel;
use App\Rules\BoundedJsonData;
use App\Support\Authorization\DepartamentoResourceAuthorizer;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SaveGraficoPredeterminadoRequest extends DatasetMutationRequest
{
    private string $managedDatasetId;
    private ?GraficoPredeterminadoModel $managedChart = null;

    public function authorize(DepartamentoResourceAuthorizer $authorizer): bool
    {
        if (! $this->user()) return false;

        if ($this->isMethod('post')) {
            $datasetId = (string) $this->route('datasetId');
        } else {
            $this->managedChart = GraficoPredeterminadoModel::find($this->route('id'));
            abort_unless($this->managedChart, 404, 'Gráfico no encontrado');
            $datasetId = $this->managedChart->dataset_id;
        }

        $this->managedDatasetId = $authorizer->findManagedDataset($this->user(), $datasetId)->id;

        return true;
    }

    public function rules(): array
    {
        $presence = $this->isMethod('post') ? [] : ['sometimes'];
        $variable = fn () => Rule::exists('variables_metadatos', 'id')->where('dataset_id', $this->managedDatasetId);

        $rules = [
            'titulo' => [...$presence, ...$this->textRules(255, true)],
            'descripcion' => $this->textRules(1000),
            'analisis' => $this->textRules(5000),
            'tipo_grafico' => [...$presence, ...$this->textRules(50, true)],
            'tipo_analisis' => ['bail', ...$presence, 'required', 'string', Rule::in(['univariable', 'bivariable'])],
            'variable_x_id' => ['bail', ...$presence, 'required', 'uuid', $variable()],
            'variable_y_id' => ['bail', 'nullable', 'uuid', $variable()],
            'orden' => ['bail', 'sometimes', 'required', 'integer', 'min:0', 'max:2147483647'],
            'activo' => ['bail', 'sometimes', 'required', 'boolean'],
            'filtros' => ['bail', 'nullable', 'array', 'list', 'max:20', new BoundedJsonData],
            // Keys remain extensible for saved legacy options; values are bounded JSON data.
            'configuracion' => ['bail', 'nullable', 'array', new BoundedJsonData(object: true)],
        ];

        // Do not expand wildcard rules/exists queries for an oversized or non-list payload.
        $filters = $this->input('filtros');
        if (! is_array($filters) || ! array_is_list($filters) || count($filters) > 20) return $rules;

        return $rules + [
            'filtros.*' => ['bail', 'required', 'array:column,operator,value,type'],
            'filtros.*.column' => [...$this->textRules(255, true),
                Rule::exists('variables_metadatos', 'nombre_columna')->where('dataset_id', $this->managedDatasetId)],
            'filtros.*.operator' => ['bail', 'required', 'string', Rule::in([
                'eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte', 'between', 'contains', 'not_contains',
            ])],
            'filtros.*.value' => ['present'],
            'filtros.*.type' => ['bail', 'nullable', 'string', Rule::in(['NUMERICO', 'CATEGORICO', 'FECHA', 'TEXTO'])],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $analysis = $this->input('tipo_analisis', $this->managedChart?->tipo_analisis);
            $y = $this->exists('variable_y_id') ? $this->input('variable_y_id') : $this->managedChart?->variable_y_id;
            if ($analysis === 'bivariable' && ! $y) {
                $validator->errors()->add('variable_y_id', 'El análisis bivariable requiere una segunda variable.');
            }

            $filters = $this->input('filtros');
            if (! is_array($filters) || count($filters) > 20) return;
            foreach ($filters as $index => $filter) {
                if (! is_array($filter) || ! is_string($filter['operator'] ?? null)) continue;
                $value = $filter['value'] ?? null;
                $operator = $filter['operator'];
                $scalar = fn (mixed $v): bool => $v === null || is_bool($v) || is_int($v)
                    || (is_float($v) && is_finite($v)) || (is_string($v) && mb_strlen($v) <= 512 && ! str_contains($v, "\0"));
                $valid = $scalar($value);
                if (in_array($operator, ['in', 'not_in', 'between'], true)) {
                    $valid = is_array($value) && array_is_list($value) && count($value) >= 1 && count($value) <= 100;
                    if ($valid) foreach ($value as $item) $valid = $valid && $scalar($item) && $item !== null;
                    if ($operator === 'between') $valid = $valid && count($value) === 2;
                } elseif (in_array($operator, ['contains', 'not_contains'], true)) {
                    $valid = $valid && is_string($value) && $value !== '';
                } elseif (in_array($operator, ['gt', 'gte', 'lt', 'lte'], true)) {
                    $valid = $valid && $value !== null && ! is_bool($value) && $value !== '';
                }
                if (! $valid) $validator->errors()->add('filtros.'.$index.'.value', 'El valor no es válido para este operador.');
            }
        }];
    }

    public function datasetId(): string
    {
        return $this->managedDatasetId;
    }

    public function grafico(): GraficoPredeterminadoModel
    {
        abort_unless($this->managedChart, 404, 'Gráfico no encontrado');

        return $this->managedChart;
    }
}

<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Stats;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StatsRequest extends FormRequest
{
    // Gráficos para variables numéricas
    public const NUMERIC_CHARTS = ['histogram', 'bar', 'line', 'area', 'gauge', 'horizontal_bar', 'pictorial_bar'];
    
    // Gráficos para variables categóricas
    public const CATEGORICAL_CHARTS = ['bar', 'pie', 'donut', 'funnel', 'treemap', 'radar', 'line', 'area', 'horizontal_bar', 'rose', 'polar_bar', 'pictorial_bar'];
    
    // Todos los gráficos univariables permitidos
    public const ALL_UNIVARIABLE_CHARTS = ['bar', 'pie', 'donut', 'histogram', 'line', 'area', 'funnel', 'treemap', 'gauge', 'radar', 'wordcloud', 'horizontal_bar', 'rose', 'polar_bar', 'pictorial_bar'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'dataset_id' => ['required', 'uuid'],
            'variable_id' => ['nullable', 'uuid'],
            'variable_x_id' => ['nullable', 'uuid'],
            'variable_y_id' => ['nullable', 'uuid'],
            'chart_type' => ['nullable', 'string', Rule::in(self::ALL_UNIVARIABLE_CHARTS)],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'filters' => ['nullable', 'array'],
            'filters.*.column' => ['required_with:filters', 'string'],
            'filters.*.operator' => ['required_with:filters', 'string', Rule::in(['eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte', 'between', 'contains', 'not_contains'])],
            'filters.*.value' => ['required_with:filters'],
        ];
    }

    /**
     * Obtener gráficos compatibles según tipo de variable
     */
    public static function getCompatibleCharts(string $tipoDato): array
    {
        return match ($tipoDato) {
            'NUMERICO' => self::NUMERIC_CHARTS,
            'CATEGORICO', 'TEXTO' => self::CATEGORICAL_CHARTS,
            'FECHA' => ['line', 'area', 'bar'],
            default => self::CATEGORICAL_CHARTS,
        };
    }

    /**
     * Verificar si un tipo de gráfico es compatible con un tipo de variable
     */
    public static function isChartCompatible(string $chartType, string $tipoDato): bool
    {
        return in_array($chartType, self::getCompatibleCharts($tipoDato));
    }
}

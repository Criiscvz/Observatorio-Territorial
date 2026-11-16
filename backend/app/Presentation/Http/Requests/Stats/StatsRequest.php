<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Stats;

use App\Domain\Statistics\UnivariableChartTypes;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StatsRequest extends FormRequest
{
    // Gráficos para variables numéricas
    public const NUMERIC_CHARTS = UnivariableChartTypes::NUMERIC;

    // Gráficos para variables categóricas
    public const CATEGORICAL_CHARTS = UnivariableChartTypes::CATEGORICAL;

    // Todos los gráficos univariables permitidos
    public const ALL_UNIVARIABLE_CHARTS = UnivariableChartTypes::ALL;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'variable_id' => ['bail', 'required', 'string', 'uuid'],
            'chart_type' => ['bail', 'nullable', 'string', Rule::in(self::ALL_UNIVARIABLE_CHARTS)],
        ] + StatisticsInputRules::common();
    }

    /**
     * Obtener gráficos compatibles según tipo de variable
     */
    public static function getCompatibleCharts(string $tipoDato): array
    {
        return UnivariableChartTypes::compatibleWith($tipoDato);
    }

    /**
     * Verificar si un tipo de gráfico es compatible con un tipo de variable
     */
    public static function isChartCompatible(string $chartType, string $tipoDato): bool
    {
        return UnivariableChartTypes::isCompatible($chartType, $tipoDato);
    }
}

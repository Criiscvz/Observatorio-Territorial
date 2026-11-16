<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Stats;

use App\Rules\{DatabaseText, StatisticsFilters};

final class StatisticsInputRules
{
    public static function common(): array
    {
        return ['dataset_id' => ['bail', 'required', 'string', 'uuid'],
            'chart_type' => ['bail', 'nullable', 'string', 'max:100', new DatabaseText],
            'limit' => ['bail', 'nullable', 'integer', 'min:1', 'max:100'],
            'filters' => ['bail', 'nullable', 'array', new StatisticsFilters]];
    }
}

<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;
use App\Presentation\Http\Requests\Stats\StatisticsInputRules;

class UnivariableStatsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'variable_id' => ['bail', 'required', 'string', 'uuid'],
        ] + StatisticsInputRules::common();
    }
}

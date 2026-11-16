<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Stats;

use Illuminate\Foundation\Http\FormRequest;

class BivariableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'variable_x_id' => ['bail', 'required', 'string', 'uuid'],
            'variable_y_id' => ['bail', 'required', 'string', 'uuid'],
        ] + StatisticsInputRules::common();
    }
}

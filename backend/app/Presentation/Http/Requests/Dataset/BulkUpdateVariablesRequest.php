<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Dataset;

use Illuminate\Foundation\Http\FormRequest;
class BulkUpdateVariablesRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()?->isAdmin() || $this->user()?->isEditor(); }
    public function rules(): array
    {
        $ids = $this->input('variable_ids');
        return ['variable_ids' => ['bail', 'required', 'array', 'list', 'min:1', 'max:200'],
            ...(is_array($ids) && array_is_list($ids) && count($ids) <= 200
                ? ['variable_ids.*' => ['bail', 'required', 'string', 'uuid']] : []),
            'es_visible' => ['bail', 'sometimes', 'boolean'],
            'tipo_dato' => ['bail', 'sometimes', 'string', 'in:NUMERICO,CATEGORICO,TEXTO,FECHA']];
    }
}

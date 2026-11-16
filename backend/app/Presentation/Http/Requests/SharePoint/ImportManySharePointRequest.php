<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\SharePoint;

use App\Models\Departamento;
use App\Rules\SharePointItemId;
use Illuminate\Validation\Rule;

class ImportManySharePointRequest extends SharePointRequest
{
    public function rules(): array
    {
        $rules = ['sharepoint_file_ids' => ['bail', 'required', 'array', 'list', 'min:1', 'max:50']];
        $ids = $this->input('sharepoint_file_ids');
        if (is_array($ids) && array_is_list($ids) && count($ids) <= 50) {
            $rules['sharepoint_file_ids.*'] = ['bail', 'required', 'string', 'max:1024', 'distinct:strict', new SharePointItemId];
        }
        if (! $this->route('departamento') instanceof Departamento) {
            $rules['atlas_categoria_id'] = ['bail', 'nullable', 'uuid', Rule::exists('atlas_categorias', 'id')->whereNull('deleted_at')];
        }
        return $rules;
    }
}

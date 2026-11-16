<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Stats;

use App\Rules\DatabaseText;
use Illuminate\Foundation\Http\FormRequest;
class UpdateStopwordsRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() !== null; }
    public function rules(): array
    {
        $words = $this->input('stopwords');
        return ['stopwords' => ['bail', 'required', 'array', 'list', 'min:1', 'max:1000'],
            ...(is_array($words) && array_is_list($words) && count($words) <= 1000
                ? ['stopwords.*' => ['bail', 'string', 'max:100', new DatabaseText]] : [])];
    }
}

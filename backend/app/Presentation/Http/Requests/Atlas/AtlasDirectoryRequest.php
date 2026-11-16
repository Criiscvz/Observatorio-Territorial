<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Atlas;

use App\Presentation\Http\Requests\Publicacion\PublicationInputRules;
use Illuminate\Foundation\Http\FormRequest;

class AtlasDirectoryRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array { return ['q' => PublicationInputRules::text(200)]; }
}

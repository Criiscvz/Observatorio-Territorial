<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\SharePoint;

use App\Presentation\Http\Requests\Publicacion\PublicationInputRules;
use App\Rules\SharePointItemId;

class ImportSharePointRequest extends SharePointRequest
{
    public function rules(): array
    {
        return [
            'sharepoint_file_id' => ['bail', 'required', 'string', 'max:1024', new SharePointItemId],
            'descripcion' => PublicationInputRules::text(3000),
        ];
    }
}

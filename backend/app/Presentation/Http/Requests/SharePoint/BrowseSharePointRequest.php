<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\SharePoint;

use App\Rules\SharePointItemId;

class BrowseSharePointRequest extends SharePointRequest
{
    public function rules(): array
    {
        return ['item_id' => ['bail', 'nullable', 'string', 'max:1024', new SharePointItemId]];
    }
}

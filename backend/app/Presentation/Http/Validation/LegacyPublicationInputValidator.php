<?php

declare(strict_types=1);

namespace App\Presentation\Http\Validation;

use App\Application\Publicaciones\LegacyPublicationInput;
use App\Presentation\Http\Requests\Publicacion\{StoreLegacyPublicationRequest, UpdateConvertedPublicationRequest};
use App\Support\Http\FormRequestResolver;
use Illuminate\Http\Request;

final class LegacyPublicationInputValidator implements LegacyPublicationInput
{
    public function create(Request $request, string $source): array
    {
        return FormRequestResolver::validated($request, StoreLegacyPublicationRequest::class, ['legacy_source' => $source]);
    }

    public function update(Request $request, string $source): array
    {
        return FormRequestResolver::validated($request, UpdateConvertedPublicationRequest::class, ['legacy_source' => $source]);
    }
}

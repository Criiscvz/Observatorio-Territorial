<?php

declare(strict_types=1);

namespace App\Support\Http;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Request;
/** Resolve a transport-specific request only after the locked legacy branch is known. */
final class FormRequestResolver
{
    /** @param class-string<FormRequest> $class */
    public static function validated(Request $request, string $class, array $context = []): array
    {
        $form = $class::createFrom($request);
        $form->attributes->add($context);
        $form->setContainer(app())->setRedirector(app('redirect'));
        $form->validateResolved();
        return $form->validated();
    }
}

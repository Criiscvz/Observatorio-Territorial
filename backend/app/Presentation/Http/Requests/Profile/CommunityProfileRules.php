<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Profile;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Rules\DatabaseText;

final class CommunityProfileRules
{
    public static function rules(Request $request): array
    {
        $institutionType = $request->input('institucion_tipo', $request->user()?->perfil?->institucion_tipo);

        return [
            'vinculo' => ['bail', 'sometimes', 'nullable', 'string', Rule::in(['ESTUDIANTE', 'DOCENTE', 'INVESTIGADOR', 'PERSONAL_ADMINISTRATIVO', 'PUBLICO_GENERAL'])],
            'institucion_tipo' => ['bail', 'sometimes', 'nullable', 'string', Rule::in(['ULEAM', 'OTRA', 'NINGUNA'])],
            'institucion' => [
                'bail', Rule::requiredIf($institutionType === 'OTRA' && ($request->exists('institucion') || $request->exists('institucion_tipo'))),
                'nullable', 'string', 'max:255', new DatabaseText,
            ],
            'interes_departamento_id' => [
                'bail', 'sometimes', 'nullable', 'uuid',
                Rule::exists('departamentos', 'id')->where('publico', true)->whereNull('deleted_at'),
            ],
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Profile;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class CommunityProfileRules
{
    public static function rules(Request $request): array
    {
        $institutionType = $request->input('institucion_tipo', $request->user()?->perfil?->institucion_tipo);

        return [
            'vinculo' => ['sometimes', 'nullable', Rule::in(['ESTUDIANTE', 'DOCENTE', 'INVESTIGADOR', 'PERSONAL_ADMINISTRATIVO', 'PUBLICO_GENERAL'])],
            'institucion_tipo' => ['sometimes', 'nullable', Rule::in(['ULEAM', 'OTRA', 'NINGUNA'])],
            'institucion' => [
                Rule::requiredIf($institutionType === 'OTRA' && ($request->exists('institucion') || $request->exists('institucion_tipo'))),
                'nullable', 'string', 'max:255',
            ],
            'interes_departamento_id' => [
                'sometimes', 'nullable', 'uuid',
                Rule::exists('departamentos', 'id')->where('publico', true)->whereNull('deleted_at'),
            ],
        ];
    }
}

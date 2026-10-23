<?php

declare(strict_types=1);

namespace App\Application\Profile\Services;

use App\Models\User;
use Illuminate\Support\Arr;

final class CommunityProfileUpdater
{
    public function execute(User $user, array $data): void
    {
        $profile = Arr::only($data, ['vinculo', 'institucion_tipo', 'institucion']);
        if (array_key_exists('institucion_tipo', $data) || array_key_exists('institucion', $data)) {
            $type = $data['institucion_tipo'] ?? null;
            if (! array_key_exists('institucion_tipo', $data)) {
                $type = $user->perfil?->institucion_tipo;
            }
            $profile['institucion'] = match ($type) {
                'ULEAM' => 'ULEAM',
                'OTRA' => trim((string) ($data['institucion'] ?? $user->perfil?->institucion)),
                default => null,
            };
        }
        if ($profile !== []) {
            $user->perfil()->updateOrCreate([], $profile);
        }
        if (array_key_exists('interes_departamento_id', $data)) {
            $user->intereses()->sync($data['interes_departamento_id'] ? [$data['interes_departamento_id']] : []);
        }
    }
}

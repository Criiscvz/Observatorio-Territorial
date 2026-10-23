<?php

declare(strict_types=1);

namespace App\Presentation\Http\Resources\Auth;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'rol' => $this->rol ?? 'USER',
            'is_active' => $this->is_active ?? true,
            'perfil' => $this->whenLoaded('perfil', fn() => [
                'id' => $this->perfil->id,
                'telefono' => $this->perfil->telefono,
                'cargo' => $this->perfil->cargo,
                'avatar' => $this->perfil->avatar,
                'bio' => $this->perfil->bio,
                'vinculo' => $this->perfil->vinculo,
                'institucion_tipo' => $this->perfil->institucion_tipo,
                'institucion' => $this->perfil->institucion,
            ]),
            'intereses' => $this->whenLoaded('intereses', fn () => $this->intereses
                ->filter(fn ($observatorio) => $observatorio->publico)
                ->map(fn ($observatorio) => ['id' => $observatorio->id, 'nombre' => $observatorio->nombre])
                ->values()),
            'departamentos' => $this->whenLoaded(
                'departamentos',
                fn() =>
                $this->departamentos->map(fn($d) => [
                    'id' => $d->id,
                    'nombre' => $d->nombre,
                    'codigo_interno' => $d->codigo_interno,
                    'descripcion' => $d->descripcion,
                    'publico' => $d->publico,
                    'rol' => $d->pivot->rol,
                    'assigned_at' => $d->pivot->created_at?->toISOString(),
                ])
            ),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}

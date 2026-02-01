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
            'perfil' => $this->whenLoaded('perfil', fn() => [
                'id' => $this->perfil->id,
                'telefono' => $this->perfil->telefono,
                'cargo' => $this->perfil->cargo,
                'avatar' => $this->perfil->avatar,
                'bio' => $this->perfil->bio,
            ]),
            'departamentos' => $this->whenLoaded(
                'departamentos',
                fn() =>
                $this->departamentos->map(fn($d) => [
                    'id' => $d->id,
                    'nombre' => $d->nombre,
                    'codigo_interno' => $d->codigo_interno,
                    'rol' => $d->pivot->rol,
                ])
            ),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}

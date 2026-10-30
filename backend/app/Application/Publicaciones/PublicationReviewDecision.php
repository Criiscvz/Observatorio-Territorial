<?php

declare(strict_types=1);

namespace App\Application\Publicaciones;

use Carbon\CarbonImmutable;

/** Only the fields owned by the editorial decision; no client metadata or permissions. */
final readonly class PublicationReviewDecision
{
    public function __construct(
        public string $state,
        public ?string $observation,
        public ?CarbonImmutable $reviewedAt,
    ) {}

    public function attributes(): array
    {
        return ['estado' => $this->state, 'observacion_revision' => $this->observation,
            'fecha_revision' => $this->reviewedAt];
    }
}

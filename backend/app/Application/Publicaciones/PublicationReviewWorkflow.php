<?php

declare(strict_types=1);

namespace App\Application\Publicaciones;

use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/** Called inside the caller's transaction, with the current locked publication on update. */
final class PublicationReviewWorkflow
{
    public function forCreation(User $actor, Departamento $department, string $type, array $input): PublicationReviewDecision
    {
        Gate::forUser($actor)->authorize('create', [ObservatorioPublicacion::class, $department]);
        abort_if($type === 'ATLAS' && ! $actor->isAdmin(), 403);
        if (! $actor->canReviewObservatory($department->id)) {
            abort_unless($actor->isEditor(), 403);
            $this->denyEditorObservation($input);
            return new PublicationReviewDecision('EN_REVISION', null, null);
        }

        return $this->decision($input['estado'] ?? 'EN_REVISION', $input['observacion_revision'] ?? null,
            required: $type !== 'ATLAS');
    }

    public function forUpdate(User $actor, ObservatorioPublicacion $publication, array $input): PublicationReviewDecision
    {
        Gate::forUser($actor)->authorize('update', $publication);
        if (! $actor->can('review', $publication) && ! ($publication->tipo === 'ATLAS' && $actor->isAdmin())) {
            abort_unless($actor->isEditor(), 403);
            $this->denyEditorObservation($input);
            // An editor corrects content, never silently reopens or publishes a decision.
            return new PublicationReviewDecision($publication->estado, $publication->observacion_revision,
                $publication->fecha_revision ? CarbonImmutable::instance($publication->fecha_revision) : null);
        }

        return $this->decision($input['estado'] ?? $publication->estado,
            $input['observacion_revision'] ?? $publication->observacion_revision, $publication,
            required: $publication->tipo !== 'ATLAS');
    }

    /** Accepted only by the compatibility adapters; native requests retain their enum validation. */
    public static function legacyState(string $state): string
    {
        return match ($state) { 'PUBLICADO' => 'PUBLICACION', 'BORRADOR' => 'EN_REVISION', default => $state };
    }

    private function denyEditorObservation(array $input): void
    {
        $reason = $input['observacion_revision'] ?? null;
        if ($reason !== null && (! is_string($reason) || trim($reason) !== '')) {
            throw ValidationException::withMessages(['observacion_revision' => 'Solo el responsable de revisión puede registrar observaciones.']);
        }
    }

    private function decision(mixed $state, mixed $observation, ?ObservatorioPublicacion $publication = null, bool $required = true): PublicationReviewDecision
    {
        if (! is_string($state) || ! in_array($state, ObservatorioPublicacion::ESTADOS, true)) {
            throw ValidationException::withMessages(['estado' => 'El estado de publicación no es válido.']);
        }
        if ($observation !== null && (! is_string($observation) || mb_strlen($observation) > 2000)) {
            throw ValidationException::withMessages(['observacion_revision' => 'La observación debe ser texto y no superar los 2000 caracteres.']);
        }
        $reason = in_array($state, ObservatorioPublicacion::ESTADOS_CON_OBSERVACION, true)
            ? trim($observation ?? '') : '';
        if ($required && in_array($state, ObservatorioPublicacion::ESTADOS_CON_OBSERVACION, true) && $reason === '') {
            throw ValidationException::withMessages(['observacion_revision' => 'Indica el motivo de la suspensión, archivo o rechazo de la publicación.']);
        }
        $sameDecision = $publication && $publication->estado === $state
            && trim($publication->observacion_revision ?? '') === $reason;
        $date = $reason === '' ? null : ($sameDecision && $publication->fecha_revision
            ? CarbonImmutable::instance($publication->fecha_revision) : CarbonImmutable::now());

        return new PublicationReviewDecision($state, $reason !== '' ? $reason : null, $date);
    }
}

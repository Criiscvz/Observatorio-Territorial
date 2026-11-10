<?php

declare(strict_types=1);

namespace App\Infrastructure\Observability;

use MongoDB\Driver\Monitoring\CommandFailedEvent;
use MongoDB\Driver\Monitoring\CommandStartedEvent;
use MongoDB\Driver\Monitoring\CommandSubscriber;
use MongoDB\Driver\Monitoring\CommandSucceededEvent;

final class MongoCommandObserver implements CommandSubscriber
{
    private array $pending = [];
    private ?string $requestId = null;

    public function commandStarted(CommandStartedEvent $event): void
    {
        $telemetry = app(RequestTelemetry::class);
        if (! $telemetry->active()) return;
        $id = $telemetry->correlation()['request_id'];
        if ($id !== $this->requestId) { $this->requestId = $id; $this->pending = []; }
        if (count($this->pending) >= 32) return;
        // Never inspect the command document, database name, server or identifiers.
        $operation = $event->getCommandName();
        if (in_array($operation, ['find','insert','update','delete','aggregate','count','distinct','ping','getMore','findAndModify','bulkWrite'], true)) {
            $this->pending[$event->getRequestId()] = $operation;
        }
    }

    public function commandSucceeded(CommandSucceededEvent $event): void { $this->complete($event, false); }
    public function commandFailed(CommandFailedEvent $event): void { $this->complete($event, true); }

    private function complete(CommandSucceededEvent|CommandFailedEvent $event, bool $failed): void
    {
        $operation = $this->pending[$event->getRequestId()] ?? null;
        unset($this->pending[$event->getRequestId()]);
        $telemetry = app(RequestTelemetry::class);
        if ($operation && $telemetry->active() && $telemetry->correlation()['request_id'] === $this->requestId) {
            $telemetry->database('mongodb', $operation, $event->getDurationMicros()/1000, $failed);
        }
    }
}

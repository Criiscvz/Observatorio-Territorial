<?php

declare(strict_types=1);

namespace App\Infrastructure\Observability;

use Illuminate\Log\Logger;
use Monolog\Formatter\JsonFormatter;
use Monolog\Handler\FormattableHandlerInterface;

final class ConfigureSafeLogging
{
    public function __invoke(Logger $logger): void
    {
        $monolog = $logger->getLogger();
        if (! $monolog instanceof \Monolog\Logger) return;
        $monolog->pushProcessor(new SafeLogProcessor());
        foreach ($monolog->getHandlers() as $handler) {
            if ($handler instanceof FormattableHandlerInterface) $handler->setFormatter(new JsonFormatter());
        }
    }
}

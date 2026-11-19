<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Infrastructure\Mail\HttpVerificationRelay;
use Illuminate\Console\Command;
use Throwable;

final class CheckVerificationDelivery extends Command
{
    protected $signature = 'verification:check-delivery';
    protected $description = 'Comprueba el canal Gmail sin enviar un correo ni mostrar credenciales.';

    public function handle(HttpVerificationRelay $relay): int
    {
        if (config('verification.delivery') !== 'gmail_relay') {
            $this->error('El canal de verificación Gmail por HTTPS no está seleccionado.');
            return self::FAILURE;
        }
        try {
            $relay->check();
            $this->info('Conexión y autenticación de Gmail correctas. No se envió ningún correo.');
            return self::SUCCESS;
        } catch (Throwable $exception) {
            $this->error(match ($exception->getCode()) {
                2001 => 'Gmail rechazó la autenticación. Revisa la contraseña de aplicación de la cuenta remitente.',
                2002 => 'No se pudo conectar con Gmail desde el servicio de envío.',
                default => 'El canal de verificación no está disponible. Revisa su configuración.',
            });
            return self::FAILURE;
        }
    }
}

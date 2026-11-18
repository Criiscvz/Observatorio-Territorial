<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

use App\Application\Auth\Contracts\VerificationCodeSender;
use App\Mail\EmailVerificationCodeMail;
use Illuminate\Support\Facades\Mail;
use RuntimeException;

final class ConfiguredVerificationCodeSender implements VerificationCodeSender
{
    public function __construct(private readonly HttpVerificationRelay $relay) {}

    public function send(string $recipient, string $code): void
    {
        switch (config('verification.delivery')) {
            case 'gmail_relay':
                $this->relay->send($recipient, $code);
                return;
            case 'mail':
                Mail::to($recipient)->send(new EmailVerificationCodeMail($code));
                return;
            default:
                throw new RuntimeException('El canal de verificación no está configurado.');
        }
    }
}

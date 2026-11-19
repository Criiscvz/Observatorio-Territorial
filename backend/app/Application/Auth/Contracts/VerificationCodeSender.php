<?php

declare(strict_types=1);

namespace App\Application\Auth\Contracts;

interface VerificationCodeSender
{
    public function send(string $recipient, string $code): void;
}

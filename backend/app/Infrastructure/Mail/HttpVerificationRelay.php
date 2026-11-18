<?php

declare(strict_types=1);

namespace App\Infrastructure\Mail;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

final class HttpVerificationRelay
{
    public function send(string $recipient, string $code): void
    {
        if (!filter_var($recipient, FILTER_VALIDATE_EMAIL) || strlen($recipient) > 255 || !preg_match('/\A[0-9]{6}\z/', $code)) {
            throw new RuntimeException('Los datos del correo de verificación no son válidos.');
        }
        $this->request('verification', $recipient, $code);
    }

    /** Authenticates the configured SMTP channel without sending a message. */
    public function check(): void
    {
        $this->request('check', '', '');
    }

    private function request(string $kind, string $recipient, string $code): void
    {
        $url = config('verification.relay_url');
        $secret = config('verification.relay_secret');
        $parts = is_string($url) ? parse_url($url) : false;
        if (!is_array($parts) || ($parts['scheme'] ?? null) !== 'https' || empty($parts['host'])
            || ($parts['path'] ?? '') !== '/_internal/verification-mail'
            || isset($parts['user']) || isset($parts['pass'])
            || isset($parts['query']) || isset($parts['fragment']) || (isset($parts['port']) && $parts['port'] !== 443)
            || !is_string($secret) || !preg_match('/\A[a-f0-9]{64}\z/i', $secret)) {
            throw new RuntimeException('El canal de verificación no está configurado.');
        }

        $binarySecret = hex2bin($secret);
        if ($binarySecret === false) throw new RuntimeException('El canal de verificación no está configurado.');
        $timestamp = now()->timestamp;
        $nonce = (string) Str::uuid();
        $canonical = implode("\n", ['observatorio-verification/v1', $kind, (string) $timestamp, $nonce, $recipient, $code]);
        $signature = hash_hmac('sha256', $canonical, $binarySecret);

        try {
            // Fixed operator-configured destination; never follow a redirect carrying a code/signature.
            // No automatic retry: an ambiguous SMTP result must not send duplicate messages.
            $response = Http::acceptJson()->asJson()->withOptions(['allow_redirects' => false, 'verify' => true])
                ->withHeaders(['X-Observatorio-Signature' => $signature])
                ->connectTimeout(5)->timeout(20)
                ->post($url, compact('kind', 'timestamp', 'nonce', 'recipient', 'code'));
        } catch (Throwable) {
            // Provider bodies and HTTP exception chains can include credentials, addresses or codes.
            throw new RuntimeException('No fue posible enviar el código de verificación.');
        }
        if ($response->status() !== 200 || $response->json('ok') !== true) {
            // Only the operator's connection check distinguishes these fixed error categories.
            $errorCode = $kind === 'check' && $response->status() === 503
                ? match ($response->json('error')) { 'mail_authentication_failed' => 2001, 'mail_connection_failed' => 2002, default => 0 }
                : 0;
            throw new RuntimeException('No fue posible enviar el código de verificación.', $errorCode);
        }
    }
}

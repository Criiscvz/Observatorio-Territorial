<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Mail\EmailVerificationCodeMail;
use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Exception\InvalidArgumentException;
use Tests\TestCase;

class MailTransportCompatibilityTest extends TestCase
{
    public function test_verification_email_builds_with_the_real_mime_stack_without_sending_network_mail(): void
    {
        config()->set('mail.default', 'array');
        config()->set('mail.mailers.array', ['transport' => 'array']);
        config()->set('mail.from', [
            'address' => 'noreply@example.test',
            'name' => 'Observatorio test',
        ]);

        $mailer = Mail::mailer('array');
        $transport = $mailer->getSymfonyTransport();
        $this->assertInstanceOf(ArrayTransport::class, $transport);

        $mailer->to('recipient@example.test')->send(new EmailVerificationCodeMail('123456'));

        $this->assertCount(1, $transport->messages());
        $message = $transport->messages()->last()->getOriginalMessage();
        $this->assertSame('recipient@example.test', $message->getTo()[0]->getAddress());
        $this->assertSame('noreply@example.test', $message->getFrom()[0]->getAddress());
        $this->assertSame('Verifica tu correo electrónico', $message->getSubject());
        $this->assertStringContainsString('123456', $message->getHtmlBody());
    }

    public function test_a_recipient_address_cannot_inject_an_additional_header(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('control characters');

        new Address("recipient@example.test\r\nBcc: other@example.test");
    }
}

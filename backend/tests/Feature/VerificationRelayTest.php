<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Application\Auth\Services\EmailVerificationService;
use App\Infrastructure\Mail\HttpVerificationRelay;
use App\Models\{EmailVerificationCode, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\{ConnectionException, Request};
use Illuminate\Support\Facades\{Hash, Http, Mail};
use RuntimeException;
use Tests\TestCase;

class VerificationRelayTest extends TestCase
{
    use RefreshDatabase;

    private const URL = 'https://relay.example.test/_internal/verification-mail';

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake(); Http::preventStrayRequests();
        config()->set('verification', ['delivery' => 'gmail_relay', 'relay_url' => self::URL, 'relay_secret' => str_repeat('1a', 32)]);
    }

    public function test_registration_sends_a_signed_code_and_the_existing_verification_flow_still_works(): void
    {
        Http::fake([self::URL => Http::response(['ok' => true])]);
        $this->postJson('/api/register', ['name' => 'Synthetic relay user', 'email' => 'recipient@gmail.com',
            'password' => 'alameda junto al mar', 'password_confirmation' => 'alameda junto al mar'])
            ->assertCreated()->assertJsonPath('email_sent', true)->assertJsonPath('verification_required', true);
        $user = User::where('email', 'recipient@gmail.com')->firstOrFail();
        $request = Http::recorded()->first()[0];
        $body = $request->data();
        $this->assertSame(['kind', 'timestamp', 'nonce', 'recipient', 'code'], array_keys($body));
        $this->assertSame('verification', $body['kind']); $this->assertSame($user->email, $body['recipient']);
        $this->assertMatchesRegularExpression('/\A[0-9]{6}\z/', $body['code']);
        $canonical = implode("\n", ['observatorio-verification/v1', 'verification', (string) $body['timestamp'], $body['nonce'], $body['recipient'], $body['code']]);
        $this->assertSame(hash_hmac('sha256', $canonical, str_repeat(hex2bin('1a'), 32)), $request->header('X-Observatorio-Signature')[0]);
        $stored = EmailVerificationCode::where('user_id', $user->id)->firstOrFail();
        $this->assertTrue(Hash::check($body['code'], $stored->code_hash));
        $this->assertNull($user->email_verified_at);
        $this->postJson('/api/verify-email-code', ['email' => $user->email, 'code' => $body['code']])->assertOk();
        $this->assertNotNull($user->fresh()->email_verified_at); Mail::assertNothingSent();
    }

    public function test_outlook_uses_the_same_authenticated_transport_without_domain_restrictions(): void
    {
        Http::fake([self::URL => Http::response(['ok' => true])]);
        app(HttpVerificationRelay::class)->send('recipient@outlook.com', '135790');
        Http::assertSent(fn (Request $request) => $request['recipient'] === 'recipient@outlook.com');
        Mail::assertNothingSent();
    }

    public function test_a_failed_provider_leaves_the_account_pending_and_removes_the_undelivered_code(): void
    {
        Http::fake([self::URL => Http::response(['ok' => false], 503)]);
        $this->postJson('/api/register', ['name' => 'Synthetic relay failure', 'email' => 'pending@example.test',
            'password' => 'alameda junto al mar', 'password_confirmation' => 'alameda junto al mar'])
            ->assertCreated()->assertJsonPath('email_sent', false)->assertJsonPath('resend_after', 0);
        $user = User::where('email', 'pending@example.test')->firstOrFail();
        $this->assertNull($user->email_verified_at);
        $this->assertDatabaseMissing('email_verification_codes', ['user_id' => $user->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $user->id]);
        Http::assertSentCount(1); Mail::assertNothingSent();
    }

    public function test_delivery_failure_can_be_retried_immediately_with_a_new_nonce_and_code(): void
    {
        $user = User::withoutEvents(fn () => User::factory()->create(['email_verified_at' => null]));
        Http::fake([self::URL => Http::sequence()->push(['ok' => false], 503)->push(['ok' => true])]);
        $service = app(EmailVerificationService::class);
        try { $service->send($user); $this->fail('Expected a delivery failure.'); } catch (RuntimeException) {}
        $service->send($user);
        $this->assertDatabaseCount('email_verification_codes', 1);
        $requests = Http::recorded();
        $this->assertNotSame($requests[0][0]['nonce'], $requests[1][0]['nonce']);
        Http::assertSentCount(2); Mail::assertNothingSent();
    }

    public function test_transport_check_authenticates_without_sending_a_verification_message(): void
    {
        Http::fake([self::URL => Http::response(['ok' => true])]);
        $this->artisan('verification:check-delivery')->expectsOutput('Conexión y autenticación de Gmail correctas. No se envió ningún correo.')->assertSuccessful();
        Http::assertSent(fn (Request $request) => $request['kind'] === 'check' && $request['code'] === '' && $request['recipient'] === '');
        Mail::assertNothingSent(); $this->assertDatabaseCount('email_verification_codes', 0);
    }

    public function test_transport_errors_do_not_disclose_codes_credentials_or_provider_bodies(): void
    {
        Http::fake([self::URL => Http::sequence()->push(['ok' => false, 'private' => 'synthetic-provider-data'], 503)
            ->push(['ok' => true], 302)->push(['ok' => false], 200)]);
        for ($attempt = 0; $attempt < 3; $attempt++) {
            try { app(HttpVerificationRelay::class)->send('recipient@example.test', '135790'); $this->fail('Expected rejection.'); }
            catch (RuntimeException $exception) {
                $this->assertSame('No fue posible enviar el código de verificación.', $exception->getMessage());
                $this->assertNull($exception->getPrevious());
            }
        }
        Http::assertSentCount(3);
        Mail::assertNothingSent();
    }

    public function test_connection_failure_is_not_retried_or_wrapped_with_sensitive_context(): void
    {
        Http::fake(fn () => throw new ConnectionException('synthetic-provider-data'));
        try { app(HttpVerificationRelay::class)->send('recipient@example.test', '135790'); $this->fail('Expected rejection.'); }
        catch (RuntimeException $exception) {
            $this->assertNull($exception->getPrevious()); $this->assertStringNotContainsString('synthetic-provider-data', $exception->getMessage());
        }
        Mail::assertNothingSent();
    }

    public function test_operator_check_displays_only_fixed_failure_categories(): void
    {
        Http::fake([self::URL => Http::sequence()->push(['error' => 'mail_authentication_failed', 'private' => 'synthetic-provider-data'], 503)
            ->push(['error' => 'mail_connection_failed'], 503)->push(['error' => 'synthetic-provider-data'], 503)]);
        foreach (['Gmail rechazó la autenticación. Revisa la contraseña de aplicación de la cuenta remitente.',
            'No se pudo conectar con Gmail desde el servicio de envío.',
            'El canal de verificación no está disponible. Revisa su configuración.'] as $message) {
            $this->artisan('verification:check-delivery')->expectsOutput($message)->assertFailed();
        }
        Mail::assertNothingSent();
    }

    public function test_bad_destination_or_signing_key_fails_before_any_network_request(): void
    {
        foreach (['http://relay.example.test/_internal/verification-mail', 'https://user:pass@relay.example.test/_internal/verification-mail',
            'https://relay.example.test/other-path', 'https://relay.example.test:8443/_internal/verification-mail',
            self::URL.'?redirect=other', self::URL.'#fragment', ''] as $url) {
            config()->set('verification.relay_url', $url);
            try { app(HttpVerificationRelay::class)->check(); $this->fail('Expected rejection.'); } catch (RuntimeException) {}
        }
        config()->set('verification.relay_url', self::URL); config()->set('verification.relay_secret', 'invalid');
        try { app(HttpVerificationRelay::class)->check(); $this->fail('Expected rejection.'); } catch (RuntimeException) {}
        Http::assertNothingSent(); Mail::assertNothingSent();
    }

    public function test_invalid_recipient_and_code_fail_before_network_or_mail(): void
    {
        foreach ([["recipient@example.test\r\nBcc: other@example.test", '135790'], ['recipient@example.test', '13579'],
            ['recipient@example.test', "135790\n"]] as [$recipient, $code]) {
            try { app(HttpVerificationRelay::class)->send($recipient, $code); $this->fail('Expected rejection.'); } catch (RuntimeException) {}
        }
        Http::assertNothingSent(); Mail::assertNothingSent();
    }

    public function test_the_default_mail_transport_remains_available_for_the_future_host(): void
    {
        config()->set('verification.delivery', 'mail');
        $user = User::withoutEvents(fn () => User::factory()->create(['email_verified_at' => null]));
        app(EmailVerificationService::class)->send($user);
        Mail::assertSent(\App\Mail\EmailVerificationCodeMail::class); Http::assertNothingSent();
    }
}

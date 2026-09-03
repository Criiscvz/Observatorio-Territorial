<?php

namespace Tests\Feature;

use App\Mail\EmailVerificationCodeMail;
use App\Models\EmailVerificationCode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Tests\TestCase;

class EmailVerificationAuthTest extends TestCase
{
    use RefreshDatabase;

    private const EMAIL = 'new-user@example.test';
    private const PASSWORD = 'secure-password';

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    public function test_new_registration_requires_email_verification_and_correct_code_grants_access(): void
    {
        [$user, $code] = $this->registerAndCaptureCode();

        $this->assertNull($user->email_verified_at);
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $user->id]);

        $stored = EmailVerificationCode::where('user_id', $user->id)->firstOrFail();
        $this->assertNotSame($code, $stored->code_hash);
        $this->assertTrue(Hash::check($code, $stored->code_hash));

        $this->postJson('/api/login', ['email' => self::EMAIL, 'password' => self::PASSWORD])
            ->assertForbidden()
            ->assertJsonPath('code', 'EMAIL_VERIFICATION_REQUIRED');

        $this->postJson('/api/verify-email-code', ['email' => self::EMAIL, 'code' => $code])
            ->assertOk()
            ->assertJsonStructure(['user', 'token']);

        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->assertNotNull($stored->fresh()->used_at);
    }

    public function test_incorrect_expired_and_used_codes_are_rejected(): void
    {
        [$user, $code] = $this->registerAndCaptureCode();

        $this->postJson('/api/verify-email-code', ['email' => self::EMAIL, 'code' => '000000'])
            ->assertUnprocessable();
        $this->assertSame(1, EmailVerificationCode::where('user_id', $user->id)->firstOrFail()->attempts);

        EmailVerificationCode::where('user_id', $user->id)->update(['expires_at' => now()->subSecond()]);
        $this->postJson('/api/verify-email-code', ['email' => self::EMAIL, 'code' => $code])
            ->assertUnprocessable();

        EmailVerificationCode::where('user_id', $user->id)->update([
            'expires_at' => now()->addMinutes(10), 'used_at' => null,
        ]);
        $this->postJson('/api/verify-email-code', ['email' => self::EMAIL, 'code' => $code])->assertOk();
        $this->postJson('/api/verify-email-code', ['email' => self::EMAIL, 'code' => $code])->assertUnprocessable();
    }

    public function test_new_code_invalidates_previous_code_and_resend_has_cooldown(): void
    {
        [$user, $oldCode] = $this->registerAndCaptureCode();

        $this->postJson('/api/resend-verification-code', ['email' => self::EMAIL])
            ->assertOk()
            ->assertJsonPath('message', 'Si la cuenta requiere verificación, recibirás un nuevo código.');

        $this->travel(61)->seconds();
        $this->postJson('/api/resend-verification-code', ['email' => self::EMAIL])->assertOk();
        $newCode = $this->lastSentCode();

        $this->postJson('/api/verify-email-code', ['email' => self::EMAIL, 'code' => $oldCode])->assertUnprocessable();
        $this->postJson('/api/verify-email-code', ['email' => self::EMAIL, 'code' => $newCode])->assertOk();
        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_three_wrong_attempts_invalidate_the_code(): void
    {
        [$user, $code] = $this->registerAndCaptureCode();

        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->postJson('/api/verify-email-code', ['email' => self::EMAIL, 'code' => '000000'])
                ->assertUnprocessable();
        }

        $verification = EmailVerificationCode::where('user_id', $user->id)->firstOrFail();
        $this->assertSame(3, $verification->attempts);
        $this->assertNotNull($verification->used_at);
        $this->postJson('/api/verify-email-code', ['email' => self::EMAIL, 'code' => $code])->assertUnprocessable();
    }

    public function test_preexisting_verified_user_still_logs_in_normally(): void
    {
        $user = User::factory()->create([
            'email' => 'existing@example.test',
            'password' => Hash::make(self::PASSWORD),
            'email_verified_at' => now(),
        ]);
        $user->perfil()->create([]);

        $this->postJson('/api/login', ['email' => $user->email, 'password' => self::PASSWORD])
            ->assertOk()
            ->assertJsonStructure(['token']);
    }

    public function test_email_provider_failure_leaves_no_valid_code(): void
    {
        Mail::shouldReceive('to')->once()->andThrow(new RuntimeException('SMTP unavailable'));

        $this->postJson('/api/register', [
            'name' => 'New User', 'email' => self::EMAIL,
            'password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD,
        ])->assertCreated()
            ->assertJsonPath('email_sent', false)
            ->assertJsonPath('resend_after', 0);

        $user = User::where('email', self::EMAIL)->firstOrFail();
        $this->assertDatabaseMissing('email_verification_codes', ['user_id' => $user->id]);
    }

    public function test_unverified_account_without_a_code_can_request_one_immediately(): void
    {
        $user = User::factory()->create([
            'email' => self::EMAIL,
            'password' => Hash::make(self::PASSWORD),
            'email_verified_at' => null,
        ]);
        $user->perfil()->create([]);

        $this->postJson('/api/resend-verification-code', ['email' => self::EMAIL])->assertOk();
        Mail::assertSent(EmailVerificationCodeMail::class);
        $this->assertDatabaseHas('email_verification_codes', ['user_id' => $user->id, 'attempts' => 0]);
    }

    public function test_resend_response_does_not_reveal_whether_an_email_exists(): void
    {
        $expected = 'Si la cuenta requiere verificación, recibirás un nuevo código.';

        $unknown = $this->postJson('/api/resend-verification-code', ['email' => 'unknown@example.test'])
            ->assertOk()
            ->json('message');

        [$user] = $this->registerAndCaptureCode();
        $existing = $this->postJson('/api/resend-verification-code', ['email' => $user->email])
            ->assertOk()
            ->json('message');

        $this->assertSame($expected, $unknown);
        $this->assertSame($unknown, $existing);
    }

    public function test_resend_endpoint_is_rate_limited_by_backend(): void
    {
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->postJson('/api/resend-verification-code', ['email' => 'limited@example.test'])
                ->assertOk();
        }

        $this->postJson('/api/resend-verification-code', ['email' => 'limited@example.test'])
            ->assertTooManyRequests();
    }

    public function test_existing_mixed_case_email_can_still_log_in(): void
    {
        $user = User::factory()->create([
            'email' => 'Existing.User@Example.Test',
            'password' => Hash::make(self::PASSWORD),
            'email_verified_at' => now(),
        ]);
        $user->perfil()->create([]);

        $this->postJson('/api/login', [
            'email' => 'existing.user@example.test',
            'password' => self::PASSWORD,
        ])->assertOk()->assertJsonStructure(['token']);
    }

    private function registerAndCaptureCode(): array
    {
        $this->postJson('/api/register', [
            'name' => 'New User', 'email' => self::EMAIL,
            'password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD,
        ])->assertCreated()->assertJsonPath('verification_required', true);

        return [User::where('email', self::EMAIL)->firstOrFail(), $this->lastSentCode()];
    }

    private function lastSentCode(): string
    {
        $code = '';
        Mail::assertSent(EmailVerificationCodeMail::class, function (EmailVerificationCodeMail $mail) use (&$code) {
            $code = $mail->code;
            return true;
        });
        return $code;
    }
}

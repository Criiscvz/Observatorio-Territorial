<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use App\Presentation\Http\Requests\Auth\LoginRequest;
use App\Presentation\Http\Requests\User\AccountInputRules;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Auth, DB, Hash, Http, Mail, Validator};
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PasswordPolicyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        Mail::fake();
    }

    public static function contracts(): array
    {
        $cases = json_decode(file_get_contents(__DIR__.'/../Fixtures/password-policy-cases.json'), true, 512, JSON_THROW_ON_ERROR);
        return array_combine(array_column($cases, 'name'), array_map(fn ($case) => [$case], $cases));
    }

    #[DataProvider('contracts')]
    public function test_the_shared_contract_matches_creation_and_login(array $case): void
    {
        $new = Validator::make(['password' => $case['value']], ['password' => AccountInputRules::password()]);
        $login = Validator::make(['email' => 'synthetic@example.test', 'password' => $case['value']], (new LoginRequest)->rules());
        $this->assertSame($case['validNew'], $new->passes(), 'Creation contract: '.$case['name']);
        $this->assertSame($case['validLogin'], $login->passes(), 'Login contract: '.$case['name']);
        Mail::assertNothingSent();
    }

    public static function rejectedNewPasswords(): array
    {
        return [['Short-A1!xyz'], ['passwordpassword'], ['   PASSWORDPASSWORD  '],
            [str_repeat('é', 40)], [str_repeat('z', 20)], ["valid-length\0invalid"], ["binary\xFFinvalid-password"]];
    }

    private function user(string $role = 'USER', string $password = 'old12345'): User
    {
        return User::withoutEvents(fn () => User::factory()->create(['rol' => $role, 'password' => $password,
            'is_active' => true, 'email_verified_at' => now()]));
    }

    private function snapshot(): array
    {
        return [DB::table('users')->orderBy('id')->get()->toJson(), DB::table('personal_access_tokens')->orderBy('id')->get()->toJson(),
            DB::table('sessions')->orderBy('id')->get()->toJson(), DB::table('password_reset_tokens')->orderBy('email')->get()->toJson()];
    }

    #[DataProvider('rejectedNewPasswords')]
    public function test_all_write_entrypoints_reject_bad_passwords_without_changing_accounts(string $password): void
    {
        $admin = $this->user('ADMIN'); $target = $this->user(); $target->createToken('synthetic-unchanged');
        Sanctum::actingAs($admin);
        $before = $this->snapshot();
        foreach ([['POST', '/api/users'], ['PUT', '/api/users/'.$target->id], ['PATCH', '/api/users/'.$target->id.'/password']] as [$method, $route]) {
            $this->call($method, $route, ['name' => 'Synthetic policy user', 'email' => 'policy-new@example.test',
                'password' => $password, 'password_confirmation' => $password], [], [], ['HTTP_ACCEPT' => 'application/json'])
                ->assertUnprocessable()->assertJsonValidationErrors('password');
            $this->assertSame($before, $this->snapshot());
        }
        Auth::forgetGuards(); Auth::shouldUse('web');
        $this->call('POST', '/api/register', ['name' => 'Synthetic policy user', 'email' => 'policy-new@example.test',
            'password' => $password, 'password_confirmation' => $password], [], [], ['HTTP_ACCEPT' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->assertSame($before, $this->snapshot());
        Mail::assertNothingSent();
    }

    public function test_an_existing_short_password_still_logs_in_and_admin_recovery_preserves_the_new_phrase(): void
    {
        $target = $this->user(); $admin = $this->user('ADMIN');
        $this->postJson('/api/login', ['email' => $target->email, 'password' => 'old12345'])->assertOk();
        Auth::guard('web')->logout(); Auth::forgetGuards(); Auth::shouldUse('web');
        $token = $target->createToken('synthetic-revoke');
        Sanctum::actingAs($admin);
        $password = '   alameda mar sol   ';
        $this->patchJson('/api/users/'.$target->id.'/password', ['password' => $password, 'password_confirmation' => $password])
            ->assertOk()->assertJsonMissing(['password' => $password]);
        $fresh = $target->fresh();
        $this->assertTrue(Hash::check($password, $fresh->password));
        $this->assertFalse(Hash::check(trim($password), $fresh->password));
        $this->assertSame('USER', $fresh->rol); $this->assertTrue($fresh->is_active);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $token->accessToken->id]);
        Auth::forgetGuards(); Auth::shouldUse('web');
        $this->postJson('/api/login', ['email' => $target->email, 'password' => 'old12345'])->assertUnprocessable();
        $this->postJson('/api/login', ['email' => $target->email, 'password' => $password])->assertOk();
        Mail::assertNothingSent();
    }

    public function test_an_empty_optional_edit_keeps_the_password_and_session_tokens(): void
    {
        $admin = $this->user('ADMIN'); $target = $this->user();
        $target->createToken('synthetic-kept'); Sanctum::actingAs($admin);
        $before = [$target->getRawOriginal('password'), DB::table('personal_access_tokens')->orderBy('id')->get()->toJson()];
        $this->putJson('/api/users/'.$target->id, ['password' => ''])->assertOk();
        $this->assertSame($before, [$target->fresh()->getRawOriginal('password'), DB::table('personal_access_tokens')->orderBy('id')->get()->toJson()]);
    }

    public function test_every_blocked_password_is_rejected_without_network_access(): void
    {
        foreach (config('password_policy.blockedPasswords') as $password) {
            $this->assertFalse(Validator::make(['password' => $password], ['password' => AccountInputRules::password()])->passes());
        }
        Mail::assertNothingSent();
    }

    public function test_invalid_login_transport_is_rejected_without_changing_accounts(): void
    {
        $target = $this->user(); $before = $this->snapshot();
        foreach ([str_repeat('x', 4097), "bad\0password", "bad\xFFpassword"] as $password) {
            $this->call('POST', '/api/login', ['email' => $target->email, 'password' => $password], [], [], ['HTTP_ACCEPT' => 'application/json'])
                ->assertUnprocessable()->assertJsonValidationErrors('password');
        }
        $this->assertSame($before, $this->snapshot());
    }
}

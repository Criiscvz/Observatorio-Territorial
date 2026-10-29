<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminUserPasswordTest extends TestCase
{
    use RefreshDatabase;

    private const OLD_PASSWORD = 'Original-password-123';
    private const NEW_PASSWORD = 'Nueva-password-456';

    private function user(string $role = 'USER'): User
    {
        return User::withoutEvents(fn () => User::factory()->create(['rol' => $role, 'password' => self::OLD_PASSWORD,
            'email_verified_at' => now(), 'is_active' => true]));
    }

    private function payload(): array
    {
        return ['password' => self::NEW_PASSWORD, 'password_confirmation' => self::NEW_PASSWORD];
    }

    public function test_admin_changes_a_persisted_password_and_login_uses_only_the_new_credential(): void
    {
        $admin = $this->user('ADMIN'); $user = $this->user();
        $before = $user->getRawOriginal('password');
        $this->actingAs($admin, 'web')->patchJson('/api/users/'.$user->id.'/password', [
            ...$this->payload(), 'rol' => 'ADMIN', 'is_active' => false, 'email' => 'other@example.test',
        ])->assertOk()->assertJsonPath('reauthenticate', false)
            ->assertJsonMissing(['password' => self::NEW_PASSWORD])->assertJsonMissing(['password' => $before]);
        $fresh = $user->fresh();
        $this->assertNotSame($before, $fresh->getRawOriginal('password'));
        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $fresh->password));
        $this->assertFalse(Hash::check(self::OLD_PASSWORD, $fresh->password));
        $this->assertSame('USER', $fresh->rol); $this->assertSame($user->email, $fresh->email); $this->assertTrue($fresh->is_active);
        Auth::guard('web')->logout(); Auth::forgetGuards(); Auth::shouldUse('web');
        $this->postJson('/api/login', ['email' => $user->email, 'password' => self::OLD_PASSWORD])->assertUnprocessable();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => self::NEW_PASSWORD])->assertOk()
            ->assertJsonPath('user.id', $user->id);
    }

    public function test_validation_does_not_modify_password_or_revoke_tokens(): void
    {
        $admin = $this->user('ADMIN'); $user = $this->user();
        $token = $user->createToken('keep-on-validation-error');
        $before = $user->getRawOriginal('password');
        Sanctum::actingAs($admin);
        foreach ([[], ['password' => 'short', 'password_confirmation' => 'short'],
            ['password' => self::NEW_PASSWORD, 'password_confirmation' => 'Does-not-match'],
            ['password' => null, 'password_confirmation' => null],
            ['password' => str_repeat('é', 40), 'password_confirmation' => str_repeat('é', 40)],
        ] as $invalid) {
            $this->patchJson('/api/users/'.$user->id.'/password', $invalid)->assertUnprocessable();
            $this->assertSame($before, $user->fresh()->getRawOriginal('password'));
            $this->assertDatabaseHas('personal_access_tokens', ['id' => $token->accessToken->id]);
        }
    }

    public function test_other_roles_and_anonymous_requests_cannot_reset_any_password(): void
    {
        $user = $this->user(); $before = $user->getRawOriginal('password');
        $this->patchJson('/api/users/'.$user->id.'/password', $this->payload())->assertUnauthorized();
        foreach (['ADMIN_OBSERVATORIO','EDITOR','SUBSCRIBER','USER'] as $role) {
            Sanctum::actingAs($this->user($role));
            $this->patchJson('/api/users/'.$user->id.'/password', $this->payload())->assertForbidden();
            $this->assertSame($before, $user->fresh()->getRawOriginal('password'));
        }
    }

    public function test_only_target_sessions_and_tokens_are_revoked(): void
    {
        config(['session.driver' => 'database']);
        $admin = $this->user('ADMIN'); $user = $this->user();
        $adminToken = $admin->createToken('admin-retained'); $userToken = $user->createToken('target-revoked');
        foreach (['target-session' => $user, 'admin-session' => $admin] as $id => $account) {
            DB::table('sessions')->insert(['id' => $id, 'user_id' => $account->id, 'payload' => base64_encode(serialize([])), 'last_activity' => time()]);
        }
        $this->withToken($adminToken->plainTextToken)->patchJson('/api/users/'.$user->id.'/password', $this->payload())->assertOk();
        $this->assertDatabaseMissing('sessions', ['id' => 'target-session']);
        $this->assertDatabaseHas('sessions', ['id' => 'admin-session']);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $userToken->accessToken->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $adminToken->accessToken->id]);
        Auth::forgetGuards();
        $this->withToken($userToken->plainTextToken)->getJson('/api/user')->assertUnauthorized();
        Auth::forgetGuards();
        $this->withToken($adminToken->plainTextToken)->getJson('/api/user')->assertOk()->assertJsonPath('id', $admin->id);
    }

    public function test_changing_own_password_ends_the_current_browser_session(): void
    {
        $admin = $this->user('ADMIN'); $sessionKey = Auth::guard('web')->getName();
        $this->withHeader('Origin', 'http://localhost:4200')->withSession([$sessionKey => $admin->id, '_token' => 'before-password-change'])
            ->patchJson('/api/users/'.$admin->id.'/password', $this->payload())->assertOk()
            ->assertJsonPath('reauthenticate', true)->assertSessionMissing($sessionKey);
        Auth::forgetGuards();
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_users_role_filter_and_search_apply_before_pagination(): void
    {
        $admin = $this->user('ADMIN'); $this->user('ADMIN_OBSERVATORIO'); $this->user('USER');
        User::withoutEvents(fn () => $this->user('EDITOR')->update(['name' => 'Carlos Mendoza']));
        Sanctum::actingAs($admin);
        $this->getJson('/api/users?rol=EDITOR&search=CARLOS&per_page=1')->assertOk()
            ->assertJsonPath('meta.total', 1)->assertJsonCount(1, 'data')->assertJsonPath('data.0.rol', 'EDITOR');
        $this->getJson('/api/users?rol=ADMIN_OBSERVATORIO')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/users?rol=INVALID')->assertUnprocessable();
        $this->patchJson('/api/users/999999/password', $this->payload())->assertNotFound();
    }
}

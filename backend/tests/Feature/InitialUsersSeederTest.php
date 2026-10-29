<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class InitialUsersSeederTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN_EMAIL = 'initial-admin@example.test';
    private const USER_EMAIL = 'initial-user@example.test';
    private const PASSWORD = 'test-password-123';

    public function test_initial_users_are_created_updated_and_can_login(): void
    {
        config(['initial_users.users' => [
            ['name' => 'Test Administrator', 'email' => self::ADMIN_EMAIL, 'password' => self::PASSWORD, 'rol' => 'ADMIN'],
            ['name' => 'Test User', 'email' => self::USER_EMAIL, 'password' => self::PASSWORD, 'rol' => 'USER'],
        ]]);

        $this->seed(AdminUserSeeder::class);

        $admin = User::where('email', self::ADMIN_EMAIL)->firstOrFail();
        $normalUser = User::where('email', self::USER_EMAIL)->firstOrFail();

        $admin->forceFill([
            'password' => Hash::make('old-password'),
            'rol' => 'USER',
            'is_active' => false,
        ])->saveQuietly();

        $normalUser->forceFill([
            'password' => Hash::make('old-password'),
            'rol' => 'ADMIN',
            'is_active' => false,
        ])->saveQuietly();

        $this->seed(AdminUserSeeder::class);
        $this->seed(AdminUserSeeder::class);

        $this->assertSame(1, User::where('email', self::ADMIN_EMAIL)->count());
        $this->assertSame(1, User::where('email', self::USER_EMAIL)->count());

        $admin->refresh();
        $normalUser->refresh();

        $this->assertSame('ADMIN', $admin->rol);
        $this->assertTrue($admin->is_active);
        $this->assertTrue(Hash::check(self::PASSWORD, $admin->password));

        $this->assertSame('USER', $normalUser->rol);
        $this->assertTrue($normalUser->is_active);
        $this->assertTrue(Hash::check(self::PASSWORD, $normalUser->password));

        $this->withHeader('Origin', 'http://localhost:4200')->postJson('/api/login', [
            'email' => self::ADMIN_EMAIL,
            'password' => self::PASSWORD,
        ])
            ->assertOk()
            ->assertJsonPath('user.email', self::ADMIN_EMAIL)
            ->assertJsonPath('user.rol', 'ADMIN')
            ->assertJsonMissing(['token']);

        $this->withHeader('Origin', 'http://localhost:4200')->postJson('/api/login', [
            'email' => self::USER_EMAIL,
            'password' => self::PASSWORD,
        ])
            ->assertOk()
            ->assertJsonPath('user.email', self::USER_EMAIL)
            ->assertJsonPath('user.rol', 'USER')
            ->assertJsonMissing(['token']);
    }

    public function test_missing_or_incomplete_configuration_does_not_create_default_users(): void
    {
        config(['initial_users.users' => [
            ['name' => null, 'email' => null, 'password' => null, 'rol' => 'ADMIN'],
            ['name' => 'Incomplete', 'email' => 'invalid-email', 'password' => self::PASSWORD, 'rol' => 'USER'],
            ['name' => 'Incomplete', 'email' => 'incomplete@example.test', 'password' => '', 'rol' => 'SUBSCRIBER'],
        ]]);

        $this->seed(AdminUserSeeder::class);

        $this->assertDatabaseCount('users', 0);
    }

    public function test_configured_deleted_user_is_restored_without_duplicates(): void
    {
        config(['initial_users.users' => [
            ['name' => 'Restored Admin', 'email' => self::ADMIN_EMAIL, 'password' => self::PASSWORD, 'rol' => 'ADMIN'],
        ]]);
        $this->seed(AdminUserSeeder::class);
        $user = User::where('email', self::ADMIN_EMAIL)->firstOrFail();
        $user->delete();

        $this->seed(AdminUserSeeder::class);

        $this->assertSame(1, User::withTrashed()->where('email', self::ADMIN_EMAIL)->count());
        $this->assertFalse($user->fresh()->trashed());
        $this->assertTrue($user->fresh()->is_active);
    }
}

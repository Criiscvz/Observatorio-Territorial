<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Env;
use Tests\TestCase;

class InitialUsersSeederTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN_EMAIL = 'initial-admin@example.test';
    private const USER_EMAIL = 'initial-user@example.test';
    private const PASSWORD = 'test-password-123';

    public function test_initial_users_are_created_updated_and_can_login(): void
    {
        $environment = Env::getRepository();
        $environment->set('ADMIN_NAME', 'Test Administrator');
        $environment->set('ADMIN_EMAIL', self::ADMIN_EMAIL);
        $environment->set('ADMIN_PASSWORD', self::PASSWORD);
        $environment->set('INITIAL_USER_NAME', 'Test User');
        $environment->set('INITIAL_USER_EMAIL', self::USER_EMAIL);
        $environment->set('INITIAL_USER_PASSWORD', self::PASSWORD);

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

        $this->postJson('/api/login', [
            'email' => self::ADMIN_EMAIL,
            'password' => self::PASSWORD,
        ])
            ->assertOk()
            ->assertJsonPath('user.email', self::ADMIN_EMAIL)
            ->assertJsonPath('user.rol', 'ADMIN')
            ->assertJsonStructure(['token']);

        $this->postJson('/api/login', [
            'email' => self::USER_EMAIL,
            'password' => self::PASSWORD,
        ])
            ->assertOk()
            ->assertJsonPath('user.email', self::USER_EMAIL)
            ->assertJsonPath('user.rol', 'USER')
            ->assertJsonStructure(['token']);
    }
}

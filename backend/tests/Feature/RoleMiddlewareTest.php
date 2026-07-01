<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoleMiddlewareTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Registrar una ruta de prueba temporal protegida por el middleware de roles
        Route::middleware(['web', 'role:ADMIN,EDITOR'])->get('/_test/role-middleware', function () {
            return response()->json(['message' => 'allowed']);
        });
    }

    /**
     * Test ADMIN role is allowed.
     */
    public function test_admin_is_allowed_by_middleware(): void
    {
        $user = new User([
            'id' => 1,
            'name' => 'Test Admin',
            'email' => 'admin@test.com',
            'rol' => 'ADMIN',
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/_test/role-middleware');

        $response->assertStatus(200);
        $response->assertJson(['message' => 'allowed']);
    }

    /**
     * Test EDITOR role is allowed.
     */
    public function test_editor_is_allowed_by_middleware(): void
    {
        $user = new User([
            'id' => 2,
            'name' => 'Test Editor',
            'email' => 'editor@test.com',
            'rol' => 'EDITOR',
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/_test/role-middleware');

        $response->assertStatus(200);
        $response->assertJson(['message' => 'allowed']);
    }

    /**
     * Test USER role is forbidden.
     */
    public function test_user_is_forbidden_by_middleware(): void
    {
        $user = new User([
            'id' => 3,
            'name' => 'Test User',
            'email' => 'user@test.com',
            'rol' => 'USER',
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/_test/role-middleware');

        $response->assertStatus(403);
    }

    /**
     * Test SUBSCRIBER role is forbidden.
     */
    public function test_subscriber_is_forbidden_by_middleware(): void
    {
        $user = new User([
            'id' => 4,
            'name' => 'Test Subscriber',
            'email' => 'sub@test.com',
            'rol' => 'SUBSCRIBER',
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/_test/role-middleware');

        $response->assertStatus(403);
    }
}

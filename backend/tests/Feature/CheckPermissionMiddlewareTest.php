<?php

namespace Tests\Feature;

use App\Models\User;
use App\Domain\Permiso\Entities\Permiso;
use App\Domain\Permiso\Repositories\PermisoRepositoryInterface;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Mockery\MockInterface;
use Tests\TestCase;

class CheckPermissionMiddlewareTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Registrar una ruta de prueba temporal protegida por el middleware de permisos
        Route::middleware(['web', 'permission:atlas,escritura'])->get('/_test/permission-middleware', function () {
            return response()->json(['message' => 'allowed']);
        });
    }

    /**
     * Test ADMIN role is allowed regardless of specific permissions in database.
     */
    public function test_admin_is_allowed_automatically(): void
    {
        $user = new User([
            'id' => 1,
            'name' => 'Test Admin',
            'email' => 'admin@test.com',
            'rol' => 'ADMIN',
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/_test/permission-middleware');

        $response->assertStatus(200);
        $response->assertJson(['message' => 'allowed']);
    }

    /**
     * Test user with enough permissions (escritura) is allowed.
     */
    public function test_user_with_sufficient_permission_is_allowed(): void
    {
        $user = new User([
            'id' => 2,
            'name' => 'Test User',
            'email' => 'user@test.com',
            'rol' => 'USER',
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $this->mock(PermisoRepositoryInterface::class, function (MockInterface $mock) {
            $mock->shouldReceive('findByUserId')->with(2)->andReturn(collect([
                new Permiso(
                    id: 'permiso-1',
                    userId: 2,
                    modulo: 'atlas',
                    nivel: 'escritura'
                )
            ]));
        });

        $response = $this->getJson('/_test/permission-middleware');

        $response->assertStatus(200);
        $response->assertJson(['message' => 'allowed']);
    }

    /**
     * Test user with admin permission is also allowed (admin > escritura).
     */
    public function test_user_with_admin_permission_is_allowed_for_escritura(): void
    {
        $user = new User([
            'id' => 3,
            'name' => 'Test User 2',
            'email' => 'user2@test.com',
            'rol' => 'USER',
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $this->mock(PermisoRepositoryInterface::class, function (MockInterface $mock) {
            $mock->shouldReceive('findByUserId')->with(3)->andReturn(collect([
                new Permiso(
                    id: 'permiso-2',
                    userId: 3,
                    modulo: 'atlas',
                    nivel: 'admin'
                )
            ]));
        });

        $response = $this->getJson('/_test/permission-middleware');

        $response->assertStatus(200);
    }

    /**
     * Test user with insufficient permissions (lectura) is forbidden.
     */
    public function test_user_with_insufficient_permission_is_forbidden(): void
    {
        $user = new User([
            'id' => 4,
            'name' => 'Test User 3',
            'email' => 'user3@test.com',
            'rol' => 'USER',
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $this->mock(PermisoRepositoryInterface::class, function (MockInterface $mock) {
            $mock->shouldReceive('findByUserId')->with(4)->andReturn(collect([
                new Permiso(
                    id: 'permiso-3',
                    userId: 4,
                    modulo: 'atlas',
                    nivel: 'lectura'
                )
            ]));
        });

        $response = $this->getJson('/_test/permission-middleware');

        $response->assertStatus(403);
        $response->assertJsonStructure(['message', 'modulo', 'nivel_requerido', 'nivel_usuario']);
    }
}

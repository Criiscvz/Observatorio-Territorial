<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AtlasCategoria;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CsrfProtectionTest extends TestCase
{
    private const PREVIEW = 'observatorio-territorial-git-segurida-9d1ee7-criiscvzs-projects.vercel.app';
    private const PRODUCTION = 'observatorio-territorial-dun.vercel.app';
    private const TOKEN = 'synthetic-session-csrf-token-for-isolated-tests';
    private const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        // TestCase checks isolation before any schema operation. Never migrate a
        // configured application database or depend on an external service here.
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $this->assertEmpty(config('database.connections.sqlite.url'));
        $this->assertSame('array', config('session.driver'));
        $this->assertSame(ValidateCsrfToken::class, config('sanctum.middleware.validate_csrf_token'));

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('password');
            $table->string('rol');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('observatorio_publicaciones', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->softDeletes();
        });
        (require database_path('migrations/2026_09_27_000001_create_atlas_categorias.php'))->up();
        (require database_path('migrations/2026_10_07_000001_add_visibility_and_icon_to_atlas_categorias.php'))->up();

        $this->admin = User::create([
            'name' => 'Isolated CSRF administrator',
            'email' => 'csrf-admin@example.test',
            'password' => Hash::make('isolated-test-password'),
            'rol' => 'ADMIN',
            'is_active' => true,
        ]);
        $category = new AtlasCategoria([
            'nombre' => 'Original category',
            'publico' => false,
            'icono' => null,
        ]);
        $category->id = self::CATEGORY_ID;
        $category->save();

        config(['sanctum.stateful' => [self::PREVIEW, self::PRODUCTION]]);
        $this->actingAs($this->admin, 'web');
        $this->withSession(['_token' => self::TOKEN]);

        // Laravel bypasses CSRF when the application environment is exactly
        // "testing". Change only this disposable application instance AFTER
        // isolation checks. The real Sanctum/ValidateCsrfToken pipeline stays on.
        $this->app['env'] = 'csrf-enforced-testing';
        $this->assertFalse($this->app->runningUnitTests());
    }

    public static function protectedWrites(): array
    {
        $category = '/api/atlas/categorias/'.self::CATEGORY_ID;
        $department = '/api/departamentos/'.self::CATEGORY_ID;
        $publication = '/api/departamentos/publicaciones/'.self::CATEGORY_ID;
        $routes = [
            'login' => ['POST', '/api/login'],
            'registration' => ['POST', '/api/register'],
            'logout' => ['POST', '/api/logout'],
            'create category' => ['POST', '/api/atlas/categorias'],
            'update category' => ['PUT', $category],
            'delete category' => ['DELETE', $category],
            'create observatory' => ['POST', '/api/departamentos'],
            'update observatory' => ['PUT', $department],
            'delete observatory' => ['DELETE', $department],
            'upload Atlas' => ['POST', '/api/departamentos/publicaciones/atlas-global'],
            'update publication' => ['PATCH', $publication],
            'delete publication' => ['DELETE', $publication],
        ];
        $cases = [];
        foreach ($routes as $name => [$method, $path]) {
            $cases[$name.' without token'] = [$method, $path, null];
            $cases[$name.' with incorrect token'] = [$method, $path, 'incorrect-csrf-token'];
        }

        return $cases;
    }

    #[DataProvider('protectedWrites')]
    public function test_stateful_writes_reject_missing_or_incorrect_token_without_changing_data(
        string $method,
        string $path,
        ?string $token,
    ): void {
        $headers = $this->frontendHeaders();
        if ($token !== null) {
            $headers['X-CSRF-TOKEN'] = $token;
        }

        $this->json($method, $path, [
            'nombre' => 'Must not be saved', 'publico' => true,
        ], $headers)->assertStatus(419)->assertJsonPath('message', 'CSRF token mismatch.');

        $this->assertFixturesUnchanged();
        $this->assertAuthenticatedAs($this->admin, 'web');
    }

    public function test_malformed_encrypted_xsrf_header_is_rejected(): void
    {
        $this->postJson('/api/atlas/categorias', ['nombre' => 'Must not be saved'],
            $this->frontendHeaders() + ['X-XSRF-TOKEN' => 'not-an-encrypted-cookie'])
            ->assertStatus(419);
        $this->assertFixturesUnchanged();
    }

    public function test_csrf_cookie_without_header_does_not_authorize_a_write(): void
    {
        $cookie = $this->getJson('/sanctum/csrf-cookie', $this->frontendHeaders())
            ->assertNoContent()->getCookie('XSRF-TOKEN', false);
        $this->assertNotNull($cookie);

        $this->withCredentials()->withUnencryptedCookie('XSRF-TOKEN', $cookie->getValue())
            ->postJson('/api/atlas/categorias', ['nombre' => 'Must not be saved'], $this->frontendHeaders())
            ->assertStatus(419);
        $this->assertFixturesUnchanged();
    }

    public function test_encrypted_cookie_header_from_csrf_endpoint_allows_a_valid_write(): void
    {
        $cookie = $this->getJson('/sanctum/csrf-cookie', $this->frontendHeaders())
            ->assertNoContent()->getCookie('XSRF-TOKEN', false);
        $this->assertNotNull($cookie);

        $this->postJson('/api/atlas/categorias', [
            'nombre' => 'Created only in memory', 'publico' => false,
        ], $this->frontendHeaders() + ['X-XSRF-TOKEN' => $cookie->getValue()])
            ->assertCreated()->assertJsonPath('data.nombre', 'Created only in memory');
        $this->assertDatabaseCount('atlas_categorias', 2);
        $this->assertDatabaseHas('atlas_categorias', ['nombre' => 'Created only in memory']);
    }

    public function test_token_from_a_previous_session_is_rejected_after_rotation(): void
    {
        $cookie = $this->getJson('/sanctum/csrf-cookie', $this->frontendHeaders())
            ->assertNoContent()->getCookie('XSRF-TOKEN', false);
        $this->assertNotNull($cookie);
        $this->withSession(['_token' => 'replacement-synthetic-session-token']);

        $this->postJson('/api/atlas/categorias', ['nombre' => 'Must not be saved'],
            $this->frontendHeaders() + ['X-XSRF-TOKEN' => $cookie->getValue()])
            ->assertStatus(419);
        $this->assertFixturesUnchanged();
    }

    public function test_matching_csrf_header_allows_update_from_production_origin(): void
    {
        $this->putJson('/api/atlas/categorias/'.self::CATEGORY_ID, [
            'nombre' => 'Updated only in memory', 'publico' => false,
        ], $this->frontendHeaders(self::PRODUCTION) + ['X-CSRF-TOKEN' => self::TOKEN])
            ->assertOk()->assertJsonPath('data.nombre', 'Updated only in memory');
        $this->assertDatabaseHas('atlas_categorias', [
            'id' => self::CATEGORY_ID, 'nombre' => 'Updated only in memory', 'deleted_at' => null,
        ]);
    }

    public function test_matching_token_allows_deletion_of_an_isolated_category(): void
    {
        $this->deleteJson('/api/atlas/categorias/'.self::CATEGORY_ID, [],
            $this->frontendHeaders() + ['X-CSRF-TOKEN' => self::TOKEN])
            ->assertOk();
        $this->assertSoftDeleted('atlas_categorias', ['id' => self::CATEGORY_ID]);
    }

    public function test_valid_csrf_token_does_not_bypass_administrator_role_requirement(): void
    {
        $this->actingAs((new User())->forceFill([
            'id' => $this->admin->id, 'rol' => 'EDITOR', 'password' => $this->admin->password,
        ]), 'web');

        $this->postJson('/api/atlas/categorias', ['nombre' => 'Must not be saved'],
            $this->frontendHeaders() + ['X-CSRF-TOKEN' => self::TOKEN])
            ->assertForbidden();
        $this->assertFixturesUnchanged();
    }

    public function test_origin_header_alone_triggers_csrf_validation_for_a_trusted_frontend(): void
    {
        $this->postJson('/api/atlas/categorias', ['nombre' => 'Must not be saved'], [
            'Origin' => 'https://'.self::PREVIEW,
        ])->assertStatus(419);
        $this->assertFixturesUnchanged();
    }

    public function test_authenticated_get_remains_available_without_a_csrf_header(): void
    {
        $this->getJson('/api/atlas/categorias', $this->frontendHeaders())
            ->assertOk()->assertJsonPath('data.0.nombre', 'Original category');
        $this->assertFixturesUnchanged();
    }

    private function frontendHeaders(string $host = self::PREVIEW): array
    {
        return [
            'Origin' => 'https://'.$host,
            'Referer' => 'https://'.$host.'/admin/dashboard',
        ];
    }

    private function assertFixturesUnchanged(): void
    {
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('atlas_categorias', 1);
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
        $this->assertDatabaseHas('atlas_categorias', [
            'id' => self::CATEGORY_ID, 'nombre' => 'Original category',
            'publico' => false, 'deleted_at' => null,
        ]);
    }
}

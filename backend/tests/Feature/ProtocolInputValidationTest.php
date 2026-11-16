<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Application\Auth\Services\GoogleOAuthService;
use App\Models\{Departamento, ObservatorioPublicacion, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Cache, Http, RateLimiter, Storage};
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ProtocolInputValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.frontend_url' => 'https://portal.example.test', 'filesystems.default' => 'local']);
        Http::preventStrayRequests();
        Storage::fake('local');
    }

    public function test_login_rejects_array_email_before_normalization_or_database_access(): void
    {
        $this->postJson('/api/login', ['email' => ['bad'], 'password' => 'synthetic-password'])
            ->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertGuest();
        Http::assertNothingSent();
    }

    public static function invalidCallbacks(): array
    {
        $state = str_repeat('a', 43);
        return [
            [['code' => ['bad'], 'state' => $state]],
            [['code' => 'opaque', 'state' => ['bad']]],
            [['code' => str_repeat('x', 4097), 'state' => $state]],
            [['code' => "bad\0code", 'state' => $state]],
            [['code' => 'opaque', 'state' => str_repeat('a', 44)]],
            [['code' => 'opaque', 'state' => str_repeat('/', 43)]],
            [['code' => ' opaque ', 'state' => $state]],
            [['code' => 'opaque', 'state' => ' '.$state.' ']],
        ];
    }

    #[DataProvider('invalidCallbacks')]
    public function test_malformed_callback_does_not_redeem_code_or_consume_state(array $query): void
    {
        $state = str_repeat('a', 43);
        $key = 'google-oauth-state:'.hash('sha256', $state);
        Cache::put($key, ['nonce' => 'synthetic-nonce', 'verifier' => 'synthetic-verifier'], 600);
        $this->mock(GoogleOAuthService::class)->shouldNotReceive('handleCallback');
        $response = $this->get('/api/auth/google/callback?'.http_build_query($query));
        $response->assertRedirect('https://portal.example.test/auth/login?google_error=failed');
        $this->assertNotNull(Cache::get($key));
        $this->assertDatabaseCount('oauth_login_codes', 0);
        $this->assertGuest();
        Http::assertNothingSent();
    }

    public function test_storage_alias_cannot_read_pdf_outside_public_images(): void
    {
        Storage::put('publicaciones/private-test.pdf', '%PDF-synthetic-private');
        Storage::put('public/fichas/private-test.pdf', '%PDF-synthetic-private');
        // Laravel's registered private-storage route must keep requiring its signature.
        foreach (['/storage/avatars/%2e%2e/%2e%2e/publicaciones/private-test.pdf', '/storage/fichas/private-test.pdf'] as $url) {
            $this->assertContains($this->get($url)->status(), [403, 404]);
        }
        $this->assertSame('%PDF-synthetic-private', Storage::get('publicaciones/private-test.pdf'));
        Http::assertNothingSent();
    }

    public function test_valid_callback_uses_query_values_and_keeps_the_frontend_handoff(): void
    {
        $code = '4/opaque-google-code+example'; $state = str_repeat('A', 43);
        $this->mock(GoogleOAuthService::class)->shouldReceive('handleCallback')->once()
            ->with($code, $state)->andReturn('synthetic-login-code');
        $this->call('GET', '/api/auth/google/callback?'.http_build_query(['code' => $code, 'state' => $state]),
            [], [], [], ['CONTENT_TYPE' => 'application/json'],
            json_encode(['code' => ['body-must-not-override'], 'state' => ['body-must-not-override']]))
            ->assertRedirect('https://portal.example.test/auth/google/callback?code=synthetic-login-code');
        Http::assertNothingSent();
    }

    public function test_missing_or_denied_callback_keeps_a_fixed_cancellation_redirect(): void
    {
        $this->mock(GoogleOAuthService::class)->shouldNotReceive('handleCallback');
        foreach (['', '?error=access_denied', '?error=0', '?error%5B%5D=untrusted'] as $query) {
            $this->get('/api/auth/google/callback'.$query)
                ->assertRedirect('https://portal.example.test/auth/login?google_error=cancelled');
        }
        Http::assertNothingSent();
    }

    public function test_well_formed_expired_state_keeps_the_fixed_failure_redirect(): void
    {
        config(['services.google.client_id' => 'synthetic-client', 'services.google.client_secret' => 'synthetic-test-only',
            'services.google.redirect' => 'https://api.example.test/api/auth/google/callback']);
        $this->get('/api/auth/google/callback?code=opaque&state='.str_repeat('x', 43))
            ->assertRedirect('https://portal.example.test/auth/login?google_error=failed');
        $this->assertDatabaseCount('oauth_login_codes', 0);
        Http::assertNothingSent();
    }

    public function test_email_limiters_handle_invalid_types_and_keep_identity_private(): void
    {
        foreach (['email-verification', 'email-verification-resend'] as $name) {
            $limiter = RateLimiter::limiter($name);
            $limit = fn ($email, $ip = '127.0.0.1') => $limiter(Request::create('/synthetic', 'POST',
                ['email' => $email], [], [], ['REMOTE_ADDR' => $ip]));
            $key = $limit('  Example@EXAMPLE.TEST  ')->key;
            $this->assertSame($key, $limit('example@example.test')->key);
            $this->assertStringNotContainsString('example', $key);
            $this->assertNotSame($key, $limit('example@example.test', '127.0.0.2')->key);
            foreach ([[], ['bad'], null, 123, "bad\xFF", str_repeat('x', 1021)] as $invalid) {
                $this->assertSame($limit('')->key, $limit($invalid)->key);
            }
        }
    }

    public static function invalidContexts(): array
    {
        return [[['management']], ['admin'], ["manage\0ment"], [str_repeat('a', 201)]];
    }

    #[DataProvider('invalidContexts')]
    public function test_legacy_read_context_is_validated_before_loading_the_document(mixed $context): void
    {
        foreach (['/api/articulos/'.Str::uuid(), '/api/reportes/'.Str::uuid(), '/api/reportes/fichas/test.pdf', '/api/articulos', '/api/reportes'] as $url) {
            $this->getJson($url.'?'.http_build_query(['context' => $context]))->assertUnprocessable()
                ->assertJsonValidationErrors('context');
        }
        Http::assertNothingSent();
    }

    public function test_management_context_still_requires_ownership_and_assignment(): void
    {
        $editor = User::factory()->create(['rol' => 'EDITOR']);
        $department = Departamento::create(['nombre' => 'Synthetic', 'codigo_interno' => 'protocol-test', 'publico' => true]);
        $editor->departamentos()->attach($department->id, ['id' => (string) Str::uuid(), 'rol' => 'EDITOR']);
        $publication = ObservatorioPublicacion::create(['departamento_id' => $department->id, 'creado_por' => $editor->id,
            'tipo' => 'ARTICULO', 'codigo' => 'ART-PROTOCOL', 'titulo' => 'Synthetic review', 'estado' => 'EN_REVISION',
            'fecha_publicacion' => '2026-11-16', 'archivo_pdf' => 'publicaciones/synthetic.pdf']);
        Storage::put('publicaciones/synthetic.pdf', "%PDF-1.4\nSynthetic\n%%EOF");
        $url = '/api/departamentos/publicaciones/'.$publication->id.'/download';
        $this->getJson($url.'?context=management')->assertNotFound();
        Sanctum::actingAs($editor);
        $this->getJson($url.'?context%5B%5D=management')->assertUnprocessable()->assertJsonValidationErrors('context');
        $this->getJson($url.'?context=public')->assertNotFound();
        $this->get($url.'?context=management')->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $editor->departamentos()->detach($department->id);
        $this->getJson($url.'?context=management')->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_login_keeps_normalization_and_accepts_existing_short_passwords(): void
    {
        User::factory()->create(['email' => 'existing@example.test', 'password' => 'old-pass',
            'is_active' => true, 'email_verified_at' => now()]);
        $this->postJson('/api/login', ['email' => '  EXISTING@EXAMPLE.TEST  ', 'password' => 'old-pass'])->assertOk();
        $this->assertAuthenticated();
    }

    public function test_invalid_utf8_email_is_rejected_before_login_or_registration_normalization(): void
    {
        foreach (['/api/login', '/api/register'] as $url) {
            $this->call('POST', $url, ['email' => "invalid\xFF@example.test", 'password' => 'test-pass',
                'password_confirmation' => 'test-pass', 'name' => 'Synthetic'], [], [], ['HTTP_ACCEPT' => 'application/json'])
                ->assertUnprocessable()->assertJsonValidationErrors('email');
        }
        $this->assertDatabaseCount('users', 0);
        Http::assertNothingSent();
    }

    public function test_avatar_filename_is_bounded_and_public_avatar_access_is_preserved(): void
    {
        Storage::put('public/avatars/synthetic.png', 'synthetic-image');
        $this->get('/api/avatars/synthetic.png')->assertOk()->assertSeeText('synthetic-image');
        $this->get('/api/avatars/'.str_repeat('a', 251).'.png')->assertNotFound();
        $this->get('/api/avatars/bad%00name.png')->assertNotFound();
    }

    public function test_observatory_ids_are_checked_before_auth_or_sql_and_the_public_alias_remains_reachable(): void
    {
        foreach (['GET', 'PUT', 'DELETE'] as $method) {
            $this->json($method, '/api/departamentos/not-a-uuid')->assertNotFound();
        }
        $this->getJson('/api/departamentos/publicos')->assertOk()->assertExactJson([]);
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        foreach (['GET', 'PUT', 'DELETE'] as $method) {
            $this->json($method, '/api/departamentos/not-a-uuid')->assertNotFound();
        }
        $this->assertDatabaseCount('departamentos', 0);
    }
}

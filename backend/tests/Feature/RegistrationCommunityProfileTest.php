<?php

namespace Tests\Feature;

use App\Models\Departamento;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RegistrationCommunityProfileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    private function account(array $extra = []): array
    {
        return array_merge(['name' => 'Persona de Prueba', 'email' => 'community@example.test',
            'password' => 'test-password-123', 'password_confirmation' => 'test-password-123'], $extra);
    }

    private function observatory(bool $public = true): Departamento
    {
        return Departamento::create(['nombre' => 'Observatorio de prueba', 'codigo_interno' => fake()->unique()->bothify('OBS-####??'), 'publico' => $public]);
    }

    public function test_registration_can_omit_the_entire_profile(): void
    {
        $this->postJson('/api/register', $this->account())->assertCreated()->assertJsonPath('verification_required', true);
        $user = User::where('email', 'community@example.test')->firstOrFail();
        $this->assertNull($user->perfil->vinculo);
        $this->assertNull($user->perfil->institucion_tipo);
        $this->assertCount(0, $user->intereses);
        $this->assertNull($user->email_verified_at);
    }

    public function test_registration_saves_preferences_without_granting_access(): void
    {
        $observatory = $this->observatory();
        $this->postJson('/api/register', $this->account(['vinculo' => 'DOCENTE', 'institucion_tipo' => 'OTRA',
            'institucion' => 'Universidad de ejemplo', 'interes_departamento_id' => $observatory->id, 'rol' => 'ADMIN']))->assertCreated();
        $user = User::where('email', 'community@example.test')->firstOrFail();
        $this->assertSame('DOCENTE', $user->perfil->vinculo);
        $this->assertSame('Universidad de ejemplo', $user->perfil->institucion);
        $this->assertSame('USER', $user->rol);
        $this->assertTrue($user->intereses->contains('id', $observatory->id));
        $this->assertDatabaseCount('usuario_departamento', 0);
    }

    public function test_uleam_name_is_normalized_by_the_server(): void
    {
        $this->postJson('/api/register', $this->account(['institucion_tipo' => 'ULEAM', 'institucion' => 'Untrusted label']))->assertCreated();
        $this->assertSame('ULEAM', User::where('email', 'community@example.test')->firstOrFail()->perfil->institucion);
    }

    public function test_private_and_deleted_observatories_cannot_be_selected(): void
    {
        $private = $this->observatory(false);
        $deleted = $this->observatory();
        $deleted->delete();
        foreach ([$private->id, $deleted->id] as $id) {
            $this->postJson('/api/register', $this->account(['interes_departamento_id' => $id]))->assertUnprocessable()->assertJsonValidationErrors('interes_departamento_id');
        }
        $this->assertDatabaseMissing('users', ['email' => 'community@example.test']);
    }

    public function test_another_institution_requires_its_name(): void
    {
        $this->postJson('/api/register', $this->account(['institucion_tipo' => 'OTRA']))->assertUnprocessable()->assertJsonValidationErrors('institucion');
        $this->assertDatabaseMissing('users', ['email' => 'community@example.test']);
    }

    public function test_invalid_affiliation_is_rejected(): void
    {
        $this->postJson('/api/register', $this->account(['vinculo' => 'ADMIN']))->assertUnprocessable()->assertJsonValidationErrors('vinculo');
    }

    public function test_profile_can_be_completed_later_and_preferences_can_be_cleared(): void
    {
        $user = User::factory()->create();
        $user->perfil()->create([]);
        $observatory = $this->observatory();
        Sanctum::actingAs($user);
        $this->putJson('/api/profile', ['vinculo' => 'ESTUDIANTE', 'institucion_tipo' => 'ULEAM', 'interes_departamento_id' => $observatory->id])
            ->assertOk()->assertJsonPath('data.perfil.vinculo', 'ESTUDIANTE')->assertJsonPath('data.intereses.0.id', $observatory->id);
        $this->putJson('/api/profile', ['bio' => 'Mi biografía'])->assertOk()->assertJsonPath('data.perfil.vinculo', 'ESTUDIANTE');
        $this->putJson('/api/profile', ['vinculo' => null, 'institucion_tipo' => null, 'institucion' => null, 'interes_departamento_id' => null])
            ->assertOk()->assertJsonPath('data.perfil.vinculo', null)->assertJsonPath('data.perfil.institucion', null)->assertJsonCount(0, 'data.intereses');
        $this->assertDatabaseCount('usuario_departamento', 0);
    }

    public function test_new_public_observatories_are_available_without_changing_the_schema(): void
    {
        $observatory = $this->observatory();
        $this->getJson('/api/publico/departamentos')->assertOk()->assertJsonFragment(['id' => $observatory->id]);
        $this->postJson('/api/register', $this->account(['interes_departamento_id' => $observatory->id]))->assertCreated();
        $this->assertDatabaseHas('usuario_intereses', ['departamento_id' => $observatory->id]);
    }
}

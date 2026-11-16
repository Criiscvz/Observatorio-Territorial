<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\{Departamento, User};
use App\Presentation\Http\Requests\Permiso\SavePermisosRequest;
use App\Presentation\Http\Requests\User\AccountInputRules;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{Auth, DB, Hash, Http, Mail, Storage, Validator};
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AccountInputValidationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $target;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = $this->user('ADMIN');
        $this->target = $this->user();
        Sanctum::actingAs($this->admin);
        Storage::fake('local');
        Mail::fake();
        Http::preventStrayRequests();
    }

    private function user(string $role = 'USER'): User
    {
        return User::withoutEvents(fn () => User::factory()->create([
            'rol' => $role, 'is_active' => true, 'email_verified_at' => now(),
        ]));
    }

    private function department(bool $public = false): Departamento
    {
        return Departamento::create(['nombre' => 'Ensayo cuentas', 'codigo_interno' => (string) Str::uuid(), 'publico' => $public]);
    }

    private function assign(User $user, Departamento $department, bool $editors = false): void
    {
        $user->departamentos()->attach($department->id, ['id' => (string) Str::uuid(),
            'rol' => $user->isObservatoryAdmin() ? 'ADMIN' : 'EDITOR', 'puede_agregar_editores' => $editors]);
    }

    private function snapshot(): array
    {
        $rows = [];
        foreach (['users', 'perfiles', 'permisos', 'usuario_departamento', 'usuario_intereses', 'personal_access_tokens', 'sessions'] as $table) {
            $query = DB::table($table);
            if ($table === 'usuario_intereses') $query->orderBy('user_id')->orderBy('departamento_id');
            else $query->orderBy('id');
            $rows[$table] = $query->get()->toJson();
        }
        return $rows;
    }

    private function payload(): array
    {
        return ['name' => 'Cuenta sintética', 'email' => 'new-account@example.test', 'password' => 'Synthetic-new-123'];
    }

    public static function invalidFilters(): array
    {
        return [['search', ['bad']], ['search', "A\0B"], ['search', str_repeat('x', 256)],
            ['search', "bad\xFFname"], ['page', 0], ['page', 1000001], ['page', ['bad']],
            ['per_page', 0], ['per_page', 101], ['per_page', ['bad']]];
    }

    #[DataProvider('invalidFilters')]
    public function test_admin_and_supervisor_filters_reject_invalid_input_without_writes(string $field, mixed $value): void
    {
        $before = $this->snapshot();
        $this->getJson('/api/users?'.http_build_query([$field => $value]))
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $supervisor = $this->user('ADMIN_OBSERVATORIO');
        Sanctum::actingAs($supervisor);
        $this->getJson('/api/observatorio-admin/users?'.http_build_query([$field => $value]))
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        // The only change in between was this test's synthetic supervisor.
        unset($before['users']);
        $after = $this->snapshot(); unset($after['users']);
        $this->assertSame($before, $after);
    }

    public function test_filters_and_pagination_keep_their_role_scope_and_response_contract(): void
    {
        $own = $this->department(); $foreign = $this->department();
        $manager = $this->user('ADMIN_OBSERVATORIO'); $this->assign($manager, $own, true);
        $editor = $this->user('EDITOR'); $this->assign($editor, $own);
        $outside = $this->user('EDITOR'); $this->assign($outside, $foreign);
        $editor->update(['name' => 'Editora de ensayo']);
        $this->getJson('/api/users?rol=EDITOR&search=EDITORA&per_page=1')->assertOk()
            ->assertJsonPath('meta.total', 1)->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('data.0.id', $editor->id)->assertJsonMissingPath('data.0.password');
        $this->getJson('/api/users?page=1000000&per_page=100')->assertOk()->assertJsonCount(0, 'data');
        foreach ([['rol' => ['EDITOR']], ['rol' => 'UNKNOWN']] as $bad) {
            $this->getJson('/api/users?'.http_build_query($bad))->assertUnprocessable();
        }
        Sanctum::actingAs($manager);
        $this->getJson('/api/observatorio-admin/users?purpose=permissions&per_page=1')->assertOk()
            ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $editor->id)
            ->assertJsonPath('data.0.departamentos.0.id', $own->id)->assertJsonMissing(['id' => $foreign->id]);
        foreach ([['purpose' => ['permissions']], ['purpose' => 'all']] as $bad) {
            $this->getJson('/api/observatorio-admin/users?'.http_build_query($bad))->assertUnprocessable();
        }
        $manager->departamentos()->detach(); $manager->unsetRelation('departamentos');
        $this->getJson('/api/observatorio-admin/users?purpose=permissions')->assertOk()
            ->assertJsonCount(0, 'data')->assertJsonPath('meta.access_capabilities.can_assign_editors', false);
    }

    public static function invalidUserFields(): array
    {
        return [['name', "A\0B"], ['name', ['bad']], ['name', str_repeat('a', 256)],
            ['email', ['bad']], ['email', "bad\0@example.test"], ['rol', ['ADMIN']],
            ['rol', true], ['rol', 1], ['rol', str_repeat('x', 256)],
            ['telefono', "A\0B"], ['cargo', ['bad']], ['bio', str_repeat('a', 501)],
            ['is_active', 'false']];
    }

    #[DataProvider('invalidUserFields')]
    public function test_invalid_admin_create_and_update_do_not_change_accounts(string $field, mixed $value): void
    {
        $before = $this->snapshot();
        $this->postJson('/api/users', array_replace($this->payload(), [$field => $value]))
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->putJson('/api/users/'.$this->target->id, [$field => $value])
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        if ($field === 'rol') {
            $this->patchJson('/api/users/'.$this->target->id.'/role', [$field => $value])
                ->assertUnprocessable()->assertJsonValidationErrors($field);
        }
        $this->assertSame($before, $this->snapshot());
    }

    public static function invalidPasswords(): array
    {
        return [['short'], [str_repeat('a', 73)], [str_repeat('é', 37)], ["Valid\0password-123"], [['invalid']]];
    }

    #[DataProvider('invalidPasswords')]
    public function test_all_password_writes_reject_invalid_credentials_without_revocation(mixed $password): void
    {
        $token = $this->target->createToken('retained-on-error');
        $before = $this->snapshot();
        $this->postJson('/api/users', array_replace($this->payload(), ['password' => $password]))
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->putJson('/api/users/'.$this->target->id, ['password' => $password])
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->patchJson('/api/users/'.$this->target->id.'/password', ['password' => $password, 'password_confirmation' => $password])
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->postJson('/api/register', array_replace($this->payload(), ['password' => $password, 'password_confirmation' => $password]))
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->assertSame($before, $this->snapshot());
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $token->accessToken->id]);
        Mail::assertNothingSent();
    }

    public function test_password_rules_reject_non_utf8_and_accept_exactly_72_bytes(): void
    {
        foreach (["Valid\xFFpassword", "Valid\0password"] as $password) {
            $this->assertTrue(Validator::make(['password' => $password], ['password' => AccountInputRules::password()])->fails());
        }
        $password = str_repeat('é', 36);
        $this->postJson('/api/users', [...$this->payload(), 'rol' => ' suscriptor ', 'password' => $password])
            ->assertCreated()->assertJsonPath('data.rol', 'SUBSCRIBER')->assertJsonMissingPath('data.password');
        $created = User::where('email', $this->payload()['email'])->firstOrFail();
        $this->assertTrue(Hash::check($password, $created->password));
        $this->putJson('/api/users/'.$this->target->id, ['password' => str_repeat('a', 72), 'rol' => ' subscriptor '])
            ->assertOk()->assertJsonPath('data.rol', 'SUBSCRIBER');
        $this->assertTrue(Hash::check(str_repeat('a', 72), $this->target->fresh()->password));
        $this->patchJson('/api/users/'.$this->target->id.'/role', ['rol' => ' editor '])->assertOk()->assertJsonPath('user.rol', 'EDITOR');
    }

    public static function invalidStatuses(): array
    {
        return [[null], ['false'], ['true'], [2], [[]], ['yes']];
    }

    #[DataProvider('invalidStatuses')]
    public function test_invalid_status_is_not_coerced_and_does_not_revoke_tokens(mixed $value): void
    {
        $this->target->createToken('retained-status');
        $before = $this->snapshot();
        $this->patchJson('/api/users/'.$this->target->id.'/status', ['is_active' => $value])
            ->assertUnprocessable()->assertJsonValidationErrors('is_active');
        $this->assertSame($before, $this->snapshot());
    }

    public function test_boolean_status_and_omitted_toggle_keep_the_existing_behavior(): void
    {
        foreach ([false, true, 0, 1, '0', '1'] as $value) {
            $this->patchJson('/api/users/'.$this->target->id.'/status', ['is_active' => $value])
                ->assertOk()->assertJsonPath('data.is_active', (bool) $value);
        }
        $this->patchJson('/api/users/'.$this->target->id.'/status', [])->assertOk()->assertJsonPath('data.is_active', false);
        $this->patchJson('/api/users/'.$this->target->id.'/status', [])->assertOk()->assertJsonPath('data.is_active', true);
        $this->patchJson('/api/users/'.$this->admin->id.'/status', ['is_active' => false])->assertStatus(400);
        $this->assertTrue($this->admin->fresh()->is_active);
    }

    public static function invalidProfileFields(): array
    {
        return [['name', ['invalid']], ['name', "A\0B"], ['telefono', "A\0B"], ['cargo', ['invalid']],
            ['bio', str_repeat('x', 501)], ['institucion', "A\0B"], ['institucion_tipo', ['OTRA']],
            ['vinculo', ['DOCENTE']], ['interes_departamento_id', ['invalid']]];
    }

    #[DataProvider('invalidProfileFields')]
    public function test_invalid_profile_data_leaves_account_profile_and_preferences_unchanged(string $field, mixed $value): void
    {
        Sanctum::actingAs($this->target);
        $before = $this->snapshot();
        $this->putJson('/api/profile', [$field => $value])->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertSame($before, $this->snapshot());
    }

    public function test_registration_rejects_malformed_email_and_community_data_before_creating_or_mailing(): void
    {
        $before = $this->snapshot();
        foreach ([['email' => ['bad']], ['institucion' => "A\0B"], ['vinculo' => ['DOCENTE']]] as $bad) {
            $this->postJson('/api/register', array_replace($this->payload(), ['password_confirmation' => $this->payload()['password']], $bad))
                ->assertUnprocessable();
        }
        $this->assertSame($before, $this->snapshot());
        Mail::assertNothingSent();
    }

    public function test_all_active_roles_can_only_update_their_own_public_profile_fields(): void
    {
        $department = $this->department(true);
        foreach (AccountInputRules::ROLES as $role) {
            $user = $this->user($role); Sanctum::actingAs($user);
            $this->putJson('/api/profile', ['name' => 'Perfil propio', 'vinculo' => 'DOCENTE', 'institucion_tipo' => 'OTRA',
                'institucion' => 'Instituto de ensayo', 'interes_departamento_id' => $department->id,
                'rol' => 'ADMIN', 'is_active' => false, 'user_id' => $this->target->id, 'email' => 'forged@example.test'])
                ->assertOk()->assertJsonPath('data.id', $user->id)->assertJsonPath('data.perfil.institucion', 'Instituto de ensayo');
            $this->assertSame($role, $user->fresh()->rol);
            $this->assertSame($user->email, $user->fresh()->email);
            $this->assertTrue($user->fresh()->is_active);
        }
        $this->assertDatabaseCount('usuario_departamento', 0);
    }

    public function test_invalid_avatars_preserve_the_previous_file_and_do_not_create_new_files(): void
    {
        $disk = Storage::disk('local'); $disk->put('public/avatars/previous.png', 'previous-synthetic');
        $this->target->perfil()->create(['avatar' => 'http://localhost/api/avatars/previous.png']);
        Sanctum::actingAs($this->target); $before = $this->snapshot();
        $invalid = [UploadedFile::fake()->image('executable.php'), UploadedFile::fake()->create('fake.png', 10, 'application/pdf'),
            UploadedFile::fake()->image('large.png')->size(2049), UploadedFile::fake()->image('wide.png', 4097, 1)];
        foreach ($invalid as $file) {
            $this->postJson('/api/profile/avatar', ['avatar' => $file])->assertUnprocessable()->assertJsonValidationErrors('avatar');
            $this->assertSame($before, $this->snapshot());
            $this->assertSame(['public/avatars/previous.png'], $disk->allFiles('public/avatars'));
        }
        $this->postJson('/api/profile/avatar', ['avatar' => ['not-a-file']])->assertUnprocessable();
    }

    public function test_valid_avatar_uses_existing_storage_and_only_replaces_the_owners_file(): void
    {
        Sanctum::actingAs($this->target);
        $this->postJson('/api/profile/avatar', ['avatar' => UploadedFile::fake()->image('portrait.png', 128, 128), 'user_id' => $this->admin->id])
            ->assertOk()->assertJsonPath('data.id', $this->target->id);
        $url = $this->target->fresh()->perfil->avatar;
        $this->assertStringEndsWith('.png', $url);
        Storage::disk('local')->assertExists('public/avatars/'.basename($url));
        $this->assertNull($this->admin->fresh()->perfil);
        $this->deleteJson('/api/profile/avatar')->assertOk()->assertJsonPath('data.perfil.avatar', null);
    }

    public function test_invalid_permission_batches_leave_roles_flags_and_assignments_unchanged(): void
    {
        $editor = $this->user('EDITOR'); $department = $this->department(); $this->assign($editor, $department);
        $row = ['modulo' => 'observatorios', 'nivel' => 'escritura', 'departamento_id' => $department->id];
        $before = $this->snapshot();
        foreach ([[], 'invalid', [null], [['modulo' => ['bad'], 'nivel' => 'escritura']],
            [array_replace($row, ['departamento_id' => ['bad']])], [array_replace($row, ['puede_revisar' => 'false'])],
            ['named' => $row], array_fill(0, SavePermisosRequest::MAX_PERMISSIONS + 1, $row)] as $batch) {
            $this->putJson('/api/permisos/users/'.$editor->id.'/permisos', ['permisos' => $batch])->assertUnprocessable();
            $this->assertSame($before, $this->snapshot());
        }
    }

    public function test_oversized_batch_does_not_expand_wildcards_or_query_each_department(): void
    {
        $editor = $this->user('EDITOR'); $department = $this->department(); $queries = 0;
        DB::listen(function ($query) use (&$queries): void { if (str_contains($query->sql, 'departamentos')) $queries++; });
        $this->putJson('/api/permisos/users/'.$editor->id.'/permisos', [
            'permisos' => array_fill(0, SavePermisosRequest::MAX_PERMISSIONS + 1,
                ['modulo' => 'observatorios', 'nivel' => 'escritura', 'departamento_id' => $department->id]),
        ])->assertUnprocessable()->assertJsonValidationErrors('permisos');
        $this->assertSame(0, $queries);
    }

    public function test_delegated_scope_and_permission_authorization_run_before_field_validation(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO'); $department = $this->department(); $this->assign($manager, $department, true);
        Sanctum::actingAs($manager);
        $this->putJson('/api/observatorio-admin/users/'.$this->target->id.'/permisos', ['permisos' => [null]])->assertUnprocessable();
        $manager->departamentos()->updateExistingPivot($department->id, ['puede_agregar_editores' => false]);
        $this->putJson('/api/observatorio-admin/users/'.$this->target->id.'/permisos', ['permisos' => [null]])->assertForbidden();
        $this->assertSame('USER', $this->target->fresh()->rol);
        $this->assertDatabaseMissing('usuario_departamento', ['user_id' => $this->target->id]);
    }

    public function test_unauthorized_roles_cannot_validate_or_mutate_global_accounts(): void
    {
        foreach (['USER', 'EDITOR', 'SUBSCRIBER', 'ADMIN_OBSERVATORIO'] as $role) {
            Sanctum::actingAs($this->user($role)); $before = $this->snapshot();
            $this->getJson('/api/users?search[]=bad')->assertForbidden();
            $this->postJson('/api/users', ['rol' => ['ADMIN']])->assertForbidden();
            $this->putJson('/api/users/'.$this->target->id, ['rol' => ['ADMIN']])->assertForbidden();
            $this->patchJson('/api/users/'.$this->target->id.'/status', ['is_active' => 'false'])->assertForbidden();
            $this->patchJson('/api/users/'.$this->target->id.'/role', ['rol' => ['ADMIN']])->assertForbidden();
            $this->assertSame($before, $this->snapshot());
        }
        $this->app['auth']->forgetGuards(); Auth::shouldUse('web');
        foreach (['/api/users', '/api/observatorio-admin/users', '/api/profile'] as $path) $this->getJson($path)->assertUnauthorized();
        $this->putJson('/api/profile', ['name' => ['bad']])->assertUnauthorized();
        $this->postJson('/api/profile/avatar', [])->assertUnauthorized();
    }

    public function test_malformed_and_overflowing_user_route_ids_fail_before_type_casts_or_sql(): void
    {
        foreach (['not-an-id', '0', '-1', '1.5', '1e3', str_repeat('9', 40)] as $id) {
            $this->getJson('/api/users/'.$id)->assertNotFound();
            $this->putJson('/api/users/'.$id, [])->assertNotFound();
            $this->patchJson('/api/users/'.$id.'/role', ['rol' => ['bad']])->assertNotFound();
            $this->patchJson('/api/users/'.$id.'/status', [])->assertNotFound();
            $this->patchJson('/api/users/'.$id.'/password', [])->assertNotFound();
            $this->deleteJson('/api/users/'.$id)->assertNotFound();
            $this->getJson('/api/accesos/usuarios/'.$id)->assertNotFound();
            $this->putJson('/api/permisos/users/'.$id.'/permisos', [])->assertNotFound();
            $this->getJson('/api/observatorio-admin/users/'.$id.'/permisos')->assertNotFound();
        }
        $this->getJson('/api/users/999999999999999999')->assertNotFound();
    }
}

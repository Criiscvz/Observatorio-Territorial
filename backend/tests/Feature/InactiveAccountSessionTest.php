<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class InactiveAccountSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_deactivated_browser_session_is_denied_and_invalidated_before_admin_actions(): void
    {
        config(['sanctum.stateful' => ['localhost:4200']]);
        $user = User::factory()->create(['rol' => 'ADMIN', 'is_active' => true]);
        $key = Auth::guard('web')->getName();
        DB::table('users')->where('id', $user->id)->update(['is_active' => false]);
        $this->withHeader('Origin', 'http://localhost:4200')->withSession([$key => $user->id])
            ->getJson('/api/admin/inicio')->assertUnauthorized()->assertSessionMissing($key);
        Auth::forgetGuards();
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_deactivated_bearer_account_cannot_use_an_existing_token(): void
    {
        $user = User::factory()->create(['rol' => 'ADMIN', 'is_active' => true]);
        $token = $user->createToken('synthetic-fixture')->plainTextToken;
        DB::table('users')->where('id', $user->id)->update(['is_active' => false]);
        $this->withToken($token)->getJson('/api/admin/inicio')->assertUnauthorized();
    }

    public function test_active_session_and_anonymous_public_health_remain_available(): void
    {
        $this->getJson('/api/health')->assertOk()->assertJsonPath('ok', true);
        $user = User::factory()->create(['rol' => 'ADMIN', 'is_active' => true]);
        $this->actingAs($user, 'web')->getJson('/api/admin/inicio')->assertOk();
    }
}

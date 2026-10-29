<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class SessionLogoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_logout_invalidates_the_browser_session_when_sanctum_is_the_request_guard(): void
    {
        config(['sanctum.stateful' => ['localhost:4200']]);
        $user = User::factory()->create(['rol' => 'ADMIN', 'email_verified_at' => now()]);
        $sessionKey = Auth::guard('web')->getName();

        $this->withHeader('Origin', 'http://localhost:4200')
            ->withSession([$sessionKey => $user->id, '_token' => 'old-session-token'])
            ->postJson('/api/logout')
            ->assertOk()
            ->assertSessionMissing($sessionKey);

        $this->assertNotSame('old-session-token', session()->token());
        Auth::forgetGuards();
        $this->getJson('/api/user')->assertUnauthorized();
    }
}

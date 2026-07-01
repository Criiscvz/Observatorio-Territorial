<?php

namespace Tests\Unit;

use App\Models\User;
use Tests\TestCase;

class UserTest extends TestCase
{
    /**
     * Test user role helpers.
     */
    public function test_user_role_helpers(): void
    {
        $admin = new User(['rol' => 'ADMIN']);
        $user = new User(['rol' => 'USER']);
        $editor = new User(['rol' => 'EDITOR']);
        $subscriber = new User(['rol' => 'SUBSCRIBER']);

        $this->assertTrue($admin->isAdmin());
        $this->assertFalse($admin->isUser());
        $this->assertFalse($admin->isEditor());
        $this->assertFalse($admin->isSubscriber());

        $this->assertTrue($user->isUser());
        $this->assertFalse($user->isAdmin());
        $this->assertFalse($user->isEditor());
        $this->assertFalse($user->isSubscriber());

        $this->assertTrue($editor->isEditor());
        $this->assertFalse($editor->isAdmin());
        $this->assertFalse($editor->isUser());
        $this->assertFalse($editor->isSubscriber());

        $this->assertTrue($subscriber->isSubscriber());
        $this->assertFalse($subscriber->isAdmin());
        $this->assertFalse($subscriber->isUser());
        $this->assertFalse($subscriber->isEditor());
    }

    /**
     * Test hasRole method.
     */
    public function test_has_role_helper(): void
    {
        $editor = new User(['rol' => 'EDITOR']);

        $this->assertTrue($editor->hasRole('EDITOR'));
        $this->assertFalse($editor->hasRole('ADMIN'));
    }
}

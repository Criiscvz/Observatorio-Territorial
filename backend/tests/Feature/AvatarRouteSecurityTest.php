<?php

namespace Tests\Feature;

use Tests\TestCase;

class AvatarRouteSecurityTest extends TestCase
{
    public function test_avatar_route_rejects_paths_and_non_image_filenames(): void
    {
        foreach ([
            '/api/avatars/../.env',
            '/api/avatars/avatar.png/../../.env',
            '/api/avatars/avatar.exe',
            '/api/avatars/avatar.png.txt',
        ] as $path) {
            $this->getJson($path)->assertNotFound();
        }
    }
}

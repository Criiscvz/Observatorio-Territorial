<?php

namespace Tests\Feature;

use Tests\TestCase;

class SeedRoutesDisabledTest extends TestCase
{
    public function test_seed_routes_are_not_exposed_over_http(): void
    {
        foreach (['admin', 'departamentos', 'all'] as $route) {
            $this->postJson("/api/seed/{$route}")
                ->assertNotFound();
        }
    }
}

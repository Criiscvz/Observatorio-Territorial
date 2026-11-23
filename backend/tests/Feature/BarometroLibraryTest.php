<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BarometroLibraryTest extends TestCase
{
    use RefreshDatabase;

    private const ADMIN = '/api/admin/barometro';

    private const PUBLIC = '/api/publico/barometro';

    public function test_admin_publishes_in_one_library_and_archiving_removes_the_report_from_public_view(): void
    {
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        $path = self::ADMIN.'/investigacion/publicaciones';
        $public = self::PUBLIC.'/investigacion/publicaciones';
        $id = $this->postJson($path, $this->publication())->assertCreated()->json('data.id');

        $this->getJson(self::ADMIN.'/secciones')->assertOk()->assertJsonPath('data.investigacion', 1);
        $this->getJson($path.'?estado=EN_REVISION')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson($public)->assertOk()->assertJsonCount(0, 'data');

        $published = $this->publication(['estado' => 'PUBLICACION']);
        $this->patchJson(self::ADMIN.'/vinculacion/publicaciones/'.$id, $published)->assertNotFound();
        $this->patchJson($path.'/'.$id, $published)->assertOk()->assertJsonPath('data.estado', 'PUBLICACION');
        $this->getJson($public.'?q=ULEAM')->assertOk()->assertJsonPath('data.0.id', $id)->assertJsonPath('meta.per_page', 20);
        $this->getJson($public.'?q=%25')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson(self::PUBLIC.'/vinculacion/publicaciones')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson(self::PUBLIC.'/barometro/publicaciones')->assertOk()->assertJsonCount(0, 'data');

        $this->patchJson($path.'/'.$id, $this->publication(['estado' => 'ARCHIVADO']))->assertOk();
        $this->getJson($public.'?estado=ARCHIVADO')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_only_admins_can_manage_library_entries_and_only_public_power_bi_links_are_accepted(): void
    {
        $path = self::ADMIN.'/barometro/publicaciones';
        $admin = User::factory()->create(['rol' => 'ADMIN']);
        $this->postJson($path, $this->publication())->assertUnauthorized();
        Sanctum::actingAs(User::factory()->create(['rol' => 'EDITOR']));
        $this->getJson($path)->assertForbidden();
        $this->postJson($path, $this->publication())->assertForbidden();

        Sanctum::actingAs($admin);
        foreach (['https://example.test/view?r=x', 'https://app.powerbi.com.example.test/view?r=x',
            'https://app.powerbi.com/reportEmbed?reportId=x', 'https://app.powerbi.com/view?r=&r=x'] as $link) {
            $this->postJson($path, $this->publication(['link_url' => $link]))
                ->assertUnprocessable()->assertJsonValidationErrors('link_url');
        }
        $this->postJson($path, $this->publication(['archivo' => 'documento.pdf']))
            ->assertUnprocessable()->assertJsonValidationErrors('archivo');
        $this->postJson(self::ADMIN.'/otra/publicaciones', $this->publication())->assertNotFound();
        $this->assertDatabaseCount('barometro_publicaciones', 0);
    }

    private function publication(array $fields = []): array
    {
        return array_replace([
            'titulo' => 'Resultados de investigación', 'fuente' => 'ULEAM', 'descripcion' => 'Resultados del periodo.',
            'fecha_publicacion' => '2026-11-23', 'link_url' => 'https://app.powerbi.com/view?r=reporte-publico',
            'estado' => 'EN_REVISION',
        ], $fields);
    }
}

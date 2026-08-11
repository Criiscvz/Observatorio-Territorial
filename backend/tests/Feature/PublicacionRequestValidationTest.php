<?php

namespace Tests\Feature;

use App\Presentation\Http\Requests\Publicacion\StorePublicacionRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class PublicacionRequestValidationTest extends TestCase
{
    public function test_reporte_con_url_no_requiere_pdf(): void
    {
        $payload = [
            'tipo' => 'REPORTE',
            'titulo' => 'Reporte Power BI prueba',
            'fecha_publicacion' => '2026-07-09',
            'link_url' => 'https://app.powerbi.com/view?r=test',
            'descripcion' => 'Reporte de prueba',
            'fuente' => 'Power BI',
        ];

        $validator = $this->validatorFor($payload);

        $this->assertTrue($validator->passes(), json_encode($validator->errors()->toArray()));
    }

    public function test_reporte_sin_url_falla_por_url_y_no_por_pdf(): void
    {
        $payload = [
            'tipo' => 'REPORTE',
            'titulo' => 'Reporte sin URL',
            'fecha_publicacion' => '2026-07-09',
            'descripcion' => 'Reporte de prueba',
            'fuente' => 'Power BI',
        ];

        $validator = $this->validatorFor($payload);

        $this->assertFalse($validator->passes());
        $this->assertArrayHasKey('link_url', $validator->errors()->toArray());
        $this->assertArrayNotHasKey('archivo', $validator->errors()->toArray());
    }

    public function test_reporte_con_pdf_es_valido(): void
    {
        $payload = [
            'tipo' => 'REPORTE',
            'titulo' => 'Reporte Power BI prueba',
            'fecha_publicacion' => '2026-07-09',
            'link_url' => 'https://app.powerbi.com/view?r=test',
            'archivo' => UploadedFile::fake()->create('reporte.pdf', 100, 'application/pdf'),
        ];

        $validator = $this->validatorFor($payload);

        $this->assertTrue($validator->passes(), json_encode($validator->errors()->toArray()));
    }

    public function test_articulo_con_pdf_y_metadatos_opcionales_es_valido(): void
    {
        $payload = [
            'tipo' => 'ARTICULO',
            'titulo' => 'Articulo de prueba',
            'fecha_publicacion' => '2026-07-09',
            'archivo' => UploadedFile::fake()->create('articulo.pdf', 100, 'application/pdf'),
        ];

        $validator = $this->validatorFor($payload);

        $this->assertTrue($validator->passes(), json_encode($validator->errors()->toArray()));
    }

    public function test_articulo_sin_pdf_falla_por_archivo(): void
    {
        $payload = [
            'tipo' => 'ARTICULO',
            'titulo' => 'Articulo sin PDF',
            'fecha_publicacion' => '2026-07-09',
        ];

        $validator = $this->validatorFor($payload);

        $this->assertFalse($validator->passes());
        $this->assertArrayHasKey('archivo', $validator->errors()->toArray());
    }

    public function test_libro_con_pdf_y_metadatos_opcionales_es_valido(): void
    {
        $payload = [
            'tipo' => 'LIBRO',
            'titulo' => 'Libro de prueba',
            'fecha_publicacion' => '2026-07-09',
            'archivo' => UploadedFile::fake()->create('libro.pdf', 100, 'application/pdf'),
        ];

        $validator = $this->validatorFor($payload);

        $this->assertTrue($validator->passes(), json_encode($validator->errors()->toArray()));
    }

    public function test_atlas_sin_pdf_falla_por_pdf(): void
    {
        $payload = [
            'tipo' => 'ATLAS',
            'titulo' => 'Atlas sin PDF',
            'fecha_publicacion' => '2026-07-09',
            'descripcion' => 'Atlas de prueba',
            'fuente' => 'SharePoint',
        ];

        $validator = $this->validatorFor($payload);

        $this->assertFalse($validator->passes());
        $this->assertArrayHasKey('archivo', $validator->errors()->toArray());
    }

    private function validatorFor(array $payload): \Illuminate\Validation\Validator
    {
        $request = StorePublicacionRequest::create(
            '/api/departamentos/test/publicaciones',
            'POST',
            $payload,
        );
        $request->setContainer($this->app);

        return Validator::make($payload, $request->rules(), $request->messages());
    }
}

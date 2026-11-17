<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Infrastructure\Services\ExcelReaderService;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Csv;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Writer\Xls;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use App\Domain\Dataset\Exceptions\InvalidImportSchema;

class ExcelReaderServiceTest extends TestCase
{
    /** @var list<string> */
    private array $temporaryFiles = [];

    protected function tearDown(): void
    {
        foreach ($this->temporaryFiles as $path) {
            if (is_file($path)) {
                unlink($path);
            }
        }

        parent::tearDown();
    }

    public static function workbookFormats(): array
    {
        return ['xlsx' => ['xlsx'], 'csv' => ['csv'], 'xls' => ['xls']];
    }

    private function workbook(string $format, array $rows): string
    {
        // Object-storage downloads use an extensionless local temporary path.
        $path = tempnam(sys_get_temp_dir(), 'excel-reader-test-');

        if ($path === false) {
            throw new RuntimeException('Could not create an isolated workbook fixture.');
        }

        $this->temporaryFiles[] = $path;
        $spreadsheet = new Spreadsheet;

        try {
            $spreadsheet->getActiveSheet()->fromArray($rows, null, 'A1', true);
            $writer = match ($format) { 'csv' => new Csv($spreadsheet), 'xls' => new Xls($spreadsheet), default => new Xlsx($spreadsheet) };
            $writer->save($path);
        } finally {
            $spreadsheet->disconnectWorksheets();
        }

        return $path;
    }

    #[DataProvider('workbookFormats')]
    public function test_analysis_preserves_metadata_and_preview_for_local_workbooks(string $format): void
    {
        $path = $this->workbook($format, [
            ['Grupo', 'Valor', 'Fecha de muestra', 'Descripción'],
            ['Centro', 42.5, '2026-01-01', ' Primera '],
            ['Centro', -2, '2026-01-02', 'Segunda'],
            ['Centro', 0, '2026-01-03', 'Tercera'],
            ['Centro', 10, '2026-01-04', 'Cuarta'],
            ['Centro', 100, '2026-01-05', 'Quinta'],
        ]);
        $originalHash = hash_file('sha256', $path);

        $analysis = (new ExcelReaderService)->analyze($path);

        $this->assertSame(5, $analysis['total_filas']);
        $this->assertSame(
            ['grupo', 'valor', 'fecha_de_muestra', 'descripcion'],
            array_column($analysis['columnas'], 'nombre_columna'),
        );
        $this->assertSame(
            ['CATEGORICO', 'NUMERICO', 'FECHA', 'TEXTO'],
            array_column($analysis['columnas'], 'tipo_detectado'),
        );
        $this->assertSame(['Centro'], $analysis['columnas'][0]['opciones']);
        $this->assertCount(5, $analysis['preview']);
        $this->assertEquals(42.5, $analysis['preview'][0]['valor']);
        $this->assertSame('2026-01-01', $analysis['preview'][0]['fecha_de_muestra']);
        $this->assertSame($originalHash, hash_file('sha256', $path));
    }

    #[DataProvider('workbookFormats')]
    public function test_import_preserves_conversion_and_does_not_modify_the_source(string $format): void
    {
        $path = $this->workbook($format, [
            ['Grupo', 'Valor', 'Fecha', 'Descripción'],
            [' Centro ', 42.5, '2026-01-01', ' Primera '],
            ['Norte', 0, '2026-01-02', 'Segunda'],
        ]);
        $originalHash = hash_file('sha256', $path);
        $columns = [
            ['nombre_columna' => 'grupo', 'tipo_dato' => 'CATEGORICO'],
            ['nombre_columna' => 'valor', 'tipo_dato' => 'NUMERICO'],
            ['nombre_columna' => 'fecha', 'tipo_dato' => 'FECHA'],
            ['nombre_columna' => 'descripcion', 'tipo_dato' => 'TEXTO'],
        ];

        $rows = iterator_to_array((new ExcelReaderService)->import($path, $columns));

        $this->assertSame([
            ['grupo' => 'Centro', 'valor' => 42.5, 'fecha' => '2026-01-01', 'descripcion' => 'Primera'],
            ['grupo' => 'Norte', 'valor' => 0.0, 'fecha' => '2026-01-02', 'descripcion' => 'Segunda'],
        ], $rows);
        $this->assertSame($originalHash, hash_file('sha256', $path));
    }

    public function test_an_empty_workbook_keeps_the_existing_validation_error(): void
    {
        $path = $this->workbook('xlsx', []);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('El archivo no tiene encabezados válidos');

        (new ExcelReaderService)->analyze($path);
    }

    #[DataProvider('workbookFormats')]
    public function test_renamed_columns_use_original_headers_and_exclude_unselected_columns(string $format): void
    {
        $path = $this->workbook($format, [["\u{00a0} Grupo \u{00a0}", 'Valor'], ['Centro', 2], ['Norte', 0]]);
        $rows = iterator_to_array((new ExcelReaderService)->import($path, [
            ['nombre_columna' => 'renamed', 'nombre_original' => 'Valor', 'tipo_dato' => 'NUMERICO'],
        ]));
        $this->assertSame([['renamed' => 2.0], ['renamed' => 0.0]], $rows);
        $rows = iterator_to_array((new ExcelReaderService)->import($path, [
            ['nombre_columna' => 'group_name', 'nombre_original' => 'Grupo', 'tipo_dato' => 'TEXTO'],
        ]));
        $this->assertSame([['group_name' => 'Centro'], ['group_name' => 'Norte']], $rows);
    }

    public static function invalidHeaders(): array
    {
        return [[['Grupo', 'Grúpo']], [['!!!']], [[str_repeat('x', 256)]],
            [array_map(fn ($i) => 'Campo '.$i, range(0, 200))]];
    }

    #[DataProvider('invalidHeaders')]
    public function test_invalid_source_headers_reject_analysis_and_import_consistently(array $headers): void
    {
        $path = $this->workbook('xlsx', [$headers, array_fill(0, count($headers), 'value')]);
        foreach (['analyze', 'import'] as $mode) {
            try {
                if ($mode === 'analyze') (new ExcelReaderService)->analyze($path);
                else iterator_to_array((new ExcelReaderService)->import($path, [['nombre_columna' => 'grupo', 'tipo_dato' => 'TEXTO']]));
                $this->fail('Invalid headers reached the import.');
            } catch (InvalidImportSchema $e) { $this->assertSame('archivo', $e->field); }
        }
    }
}

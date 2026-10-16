<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PublicationSourceMigrationTest extends TestCase
{
    private function migration(): object
    {
        return require database_path('migrations/2026_08_11_000001_make_observatorio_publicaciones_fuente_nullable.php');
    }

    public function test_sqlite_changes_nullability_without_postgresql_only_syntax_or_data_loss(): void
    {
        $this->assertSame('sqlite', DB::getDriverName());
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('observatorio_publicaciones', function (Blueprint $table): void {
            $table->id();
            $table->string('fuente');
        });
        DB::table('observatorio_publicaciones')->insert(['id' => 1, 'fuente' => 'Synthetic source']);

        // Local SQLite 3.53 accepts this newer syntax, while the CI runner does
        // not. Reject it here too so a newer developer machine cannot mask it.
        DB::connection()->beforeExecuting(static function (string $query): void {
            if (preg_match('/ALTER\s+COLUMN\s+fuente\s+DROP\s+NOT\s+NULL/i', $query)) {
                throw new \RuntimeException('PostgreSQL-style column alteration is not portable to supported SQLite versions.');
            }
        });

        $this->migration()->up();

        DB::table('observatorio_publicaciones')->insert(['id' => 2, 'fuente' => null]);
        $this->assertSame('Synthetic source', DB::table('observatorio_publicaciones')->where('id', 1)->value('fuente'));
        $this->assertNull(DB::table('observatorio_publicaciones')->where('id', 2)->value('fuente'));
        $this->assertSame(2, DB::table('observatorio_publicaciones')->count());
    }

    public function test_postgresql_keeps_the_existing_migration_statement(): void
    {
        Schema::shouldReceive('hasTable')->once()->with('observatorio_publicaciones')->andReturn(true);
        DB::shouldReceive('getDriverName')->once()->andReturn('pgsql');
        DB::shouldReceive('statement')->once()
            ->with('ALTER TABLE observatorio_publicaciones ALTER COLUMN fuente DROP NOT NULL')
            ->andReturn(true);

        $this->migration()->up();
    }

    public function test_absent_table_does_not_run_any_alteration(): void
    {
        Schema::shouldReceive('hasTable')->once()->with('observatorio_publicaciones')->andReturn(false);
        DB::shouldReceive('statement')->never();

        $this->migration()->up();
    }
}

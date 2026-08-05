<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('publicacion_contadores')->updateOrInsert(
            ['tipo' => 'LIBRO'],
            ['siguiente_numero' => 1]
        );

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE observatorio_publicaciones DROP CONSTRAINT IF EXISTS observatorio_publicaciones_tipo_check');
            DB::statement("ALTER TABLE observatorio_publicaciones ADD CONSTRAINT observatorio_publicaciones_tipo_check CHECK (tipo IN ('ARTICULO', 'REPORTE', 'LIBRO', 'ATLAS'))");
            DB::statement('ALTER TABLE observatorio_publicaciones ALTER COLUMN departamento_id DROP NOT NULL');
        }

        DB::table('observatorio_publicaciones')
            ->where('tipo', 'ATLAS')
            ->whereNotNull('departamento_id')
            ->update([
                'tipo' => 'LIBRO',
            ]);

        DB::statement("UPDATE observatorio_publicaciones SET codigo = regexp_replace(codigo, '^ATL-', 'LIB-') WHERE tipo = 'LIBRO' AND codigo LIKE 'ATL-%'");

        $nextLibro = DB::table('observatorio_publicaciones')
            ->where('tipo', 'LIBRO')
            ->selectRaw("COALESCE(MAX(CAST(regexp_replace(codigo, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1 AS next_number")
            ->value('next_number') ?? 1;

        DB::table('publicacion_contadores')->updateOrInsert(
            ['tipo' => 'LIBRO'],
            ['siguiente_numero' => max(1, (int) $nextLibro)]
        );
    }

    public function down(): void
    {
        DB::table('observatorio_publicaciones')
            ->where('tipo', 'LIBRO')
            ->update([
                'tipo' => 'ATLAS',
            ]);

        DB::statement("UPDATE observatorio_publicaciones SET codigo = regexp_replace(codigo, '^LIB-', 'ATL-') WHERE tipo = 'ATLAS' AND codigo LIKE 'LIB-%'");

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE observatorio_publicaciones DROP CONSTRAINT IF EXISTS observatorio_publicaciones_tipo_check');
            DB::statement("ALTER TABLE observatorio_publicaciones ADD CONSTRAINT observatorio_publicaciones_tipo_check CHECK (tipo IN ('ARTICULO', 'REPORTE', 'ATLAS'))");
        }

        DB::table('publicacion_contadores')->where('tipo', 'LIBRO')->delete();
    }
};

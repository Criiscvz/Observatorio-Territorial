<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('observatorio_publicaciones')) {
            return;
        }

        DB::statement('ALTER TABLE observatorio_publicaciones ALTER COLUMN archivo_pdf DROP NOT NULL');
        DB::statement('ALTER TABLE observatorio_publicaciones ALTER COLUMN nombre_archivo_original DROP NOT NULL');
    }

    public function down(): void
    {
        // Se mantiene nullable: Reporte no debe requerir PDF.
    }
};

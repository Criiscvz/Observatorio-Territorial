<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE observatorio_publicaciones DROP CONSTRAINT IF EXISTS observatorio_publicaciones_sharepoint_file_id_unique');
        DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS observatorio_publicaciones_departamento_sharepoint_file_unique ON observatorio_publicaciones (departamento_id, sharepoint_file_id) WHERE sharepoint_file_id IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS observatorio_publicaciones_departamento_sharepoint_file_unique');
        DB::statement('ALTER TABLE observatorio_publicaciones ADD CONSTRAINT observatorio_publicaciones_sharepoint_file_id_unique UNIQUE (sharepoint_file_id)');
    }
};

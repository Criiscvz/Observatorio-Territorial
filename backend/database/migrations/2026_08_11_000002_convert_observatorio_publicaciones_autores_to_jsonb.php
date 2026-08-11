<?php

declare(strict_types=1);

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

        DB::statement(<<<'SQL'
            ALTER TABLE observatorio_publicaciones
            ALTER COLUMN autores TYPE jsonb
            USING CASE
                WHEN autores IS NULL OR btrim(autores) = '' THEN NULL
                ELSE jsonb_build_array(autores)
            END
        SQL);
    }

    public function down(): void
    {
        // Converting JSON arrays back to a single text value would lose author boundaries.
    }
};

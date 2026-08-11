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

        DB::statement('ALTER TABLE observatorio_publicaciones ALTER COLUMN fuente DROP NOT NULL');
    }

    public function down(): void
    {
        // Existing records may intentionally have no source, so restoring NOT NULL is unsafe.
    }
};

<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('observatorio_publicaciones')) {
            return;
        }

        if (DB::getDriverName() === 'sqlite') {
            // Laravel rebuilds the table where older SQLite versions cannot
            // alter a column's nullability directly. Keep the PostgreSQL SQL below.
            Schema::table('observatorio_publicaciones', function (Blueprint $table): void {
                $table->string('fuente')->nullable()->change();
            });

            return;
        }

        DB::statement('ALTER TABLE observatorio_publicaciones ALTER COLUMN fuente DROP NOT NULL');
    }

    public function down(): void
    {
        // Existing records may intentionally have no source, so restoring NOT NULL is unsafe.
    }
};

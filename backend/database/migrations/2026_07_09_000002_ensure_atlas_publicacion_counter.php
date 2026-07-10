<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('publicacion_contadores')->updateOrInsert(
            ['tipo' => 'ATLAS'],
            ['siguiente_numero' => 1]
        );
    }

    public function down(): void
    {
        DB::table('publicacion_contadores')->where('tipo', 'ATLAS')->delete();
    }
};

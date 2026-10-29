<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('atlas_categorias', function (Blueprint $table) {
            $table->boolean('publico')->default(false);
            $table->string('icono', 50)->nullable();
        });
        // Existing categories were public before this setting was introduced.
        DB::table('atlas_categorias')->update(['publico' => true]);
    }

    public function down(): void
    {
        Schema::table('atlas_categorias', function (Blueprint $table) {
            $table->dropColumn(['publico', 'icono']);
        });
    }
};

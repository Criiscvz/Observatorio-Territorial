<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('graficos_predeterminados', function (Blueprint $table) {
            $table->text('analisis')->nullable()->after('descripcion');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('graficos_predeterminados', function (Blueprint $table) {
            $table->dropColumn('analisis');
        });
    }
};

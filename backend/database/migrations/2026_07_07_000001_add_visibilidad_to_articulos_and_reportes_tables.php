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
        Schema::table('articulos', function (Blueprint $table) {
            $table->string('visibilidad')->default('publico')->after('enlace');
        });

        Schema::table('reportes', function (Blueprint $table) {
            $table->string('visibilidad')->default('publico')->after('ficha_indicador');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('articulos', function (Blueprint $table) {
            $table->dropColumn('visibilidad');
        });

        Schema::table('reportes', function (Blueprint $table) {
            $table->dropColumn('visibilidad');
        });
    }
};

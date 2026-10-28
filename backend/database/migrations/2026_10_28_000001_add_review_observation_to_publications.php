<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('observatorio_publicaciones', function (Blueprint $table): void {
            $table->text('observacion_revision')->nullable();
            $table->timestamp('fecha_revision')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('observatorio_publicaciones', function (Blueprint $table): void {
            $table->dropColumn(['observacion_revision', 'fecha_revision']);
        });
    }
};

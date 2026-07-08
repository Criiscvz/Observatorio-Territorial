<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('permisos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('modulo', 50); // 'atlas', 'reportes', 'observatorios'
            $table->string('nivel', 20)->default('ninguno'); // 'ninguno', 'lectura', 'escritura', 'admin'
            $table->uuid('departamento_id')->nullable();
            $table->timestamps();

            $table->foreign('departamento_id')
                ->references('id')
                ->on('departamentos')
                ->onDelete('cascade');

            $table->unique(['user_id', 'modulo', 'departamento_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('permisos');
    }
};

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
        Schema::create('usuario_departamento', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('departamento_id')->constrained('departamentos')->cascadeOnDelete();
            $table->enum('rol', ['ADMIN', 'EDITOR', 'LECTOR'])->default('LECTOR');
            $table->timestamps();
            
            // Índice único para evitar duplicados
            $table->unique(['user_id', 'departamento_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('usuario_departamento');
    }
};

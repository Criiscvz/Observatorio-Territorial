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
        Schema::create('variables_metadatos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('dataset_id')->constrained('datasets')->cascadeOnDelete();
            $table->string('nombre_columna');
            $table->string('nombre_original');
            $table->enum('tipo_dato', ['NUMERICO', 'CATEGORICO', 'FECHA', 'TEXTO'])->default('TEXTO');
            $table->enum('tipo_detectado', ['NUMERICO', 'CATEGORICO', 'FECHA', 'TEXTO'])->default('TEXTO');
            $table->boolean('es_visible')->default(true);
            $table->integer('orden')->default(0);
            $table->json('opciones')->nullable(); // Para almacenar valores únicos en categóricos
            $table->timestamps();
            
            // Índice para búsqueda rápida
            $table->index(['dataset_id', 'nombre_columna']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('variables_metadatos');
    }
};

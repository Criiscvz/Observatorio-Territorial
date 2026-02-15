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
        Schema::create('graficos_predeterminados', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('dataset_id')->constrained('datasets')->cascadeOnDelete();
            $table->string('titulo');
            $table->text('descripcion')->nullable();
            $table->string('tipo_grafico'); // bar, pie, line, scatter, histogram, wordcloud, etc.
            $table->string('tipo_analisis'); // univariable, bivariable
            $table->foreignUuid('variable_x_id')->constrained('variables_metadatos')->cascadeOnDelete();
            $table->foreignUuid('variable_y_id')->nullable()->constrained('variables_metadatos')->cascadeOnDelete();
            $table->json('filtros')->nullable(); // Predefined filters config
            $table->json('configuracion')->nullable(); // Additional chart config (colors, labels, etc.)
            $table->integer('orden')->default(0);
            $table->boolean('activo')->default(true);
            $table->foreignId('creado_por')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index('dataset_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('graficos_predeterminados');
    }
};

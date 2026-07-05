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
        Schema::create('reportes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('categoria_id')
                ->nullable()
                ->constrained('categorias_dataset')
                ->nullOnDelete();
            $table->string('nombre_indicador');
            $table->text('descripcion_indicador')->nullable();
            $table->date('fecha_publicacion')->nullable();
            $table->string('link_url')->nullable();
            // Ruta del archivo de la ficha del indicador subido a storage (no el binario)
            $table->string('ficha_indicador')->nullable();
            $table->string('fuente')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('categoria_id');
            $table->index('fecha_publicacion');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reportes');
    }
};

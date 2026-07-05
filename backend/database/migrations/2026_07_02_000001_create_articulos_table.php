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
        Schema::create('articulos', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('categoria_id')
                ->nullable()
                ->constrained('categorias_dataset')
                ->nullOnDelete();
            $table->string('titulo');
            $table->text('descripcion')->nullable();
            $table->string('autor')->nullable();
            $table->string('fuente')->nullable();
            $table->date('fecha_publicacion')->nullable();
            $table->date('fecha_recepcion')->nullable();
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
        Schema::dropIfExists('articulos');
    }
};

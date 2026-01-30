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
        Schema::create('datasets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('departamento_id')->constrained('departamentos')->cascadeOnDelete();
            $table->foreignId('subido_por')->constrained('users')->cascadeOnDelete();
            $table->string('nombre');
            $table->string('nombre_archivo');
            $table->text('descripcion')->nullable();
            $table->enum('estado', ['PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'ERROR'])->default('PENDIENTE');
            $table->integer('total_registros')->default(0);
            $table->timestamp('fecha_carga')->useCurrent();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('datasets');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('registros_datos', function (Blueprint $table) {
            $table->id(); // BIGSERIAL para mejor rendimiento
            $table->foreignUuid('dataset_id')->constrained('datasets')->cascadeOnDelete();
            $table->jsonb('data'); // JSONB para datos del Excel
            $table->timestamps();
            
            // Índice GIN para búsquedas rápidas en JSONB
            $table->index('dataset_id');
        });
        
        // Crear índice GIN para JSONB (solo PostgreSQL)
        if (config('database.default') === 'pgsql') {
            DB::statement('CREATE INDEX registros_datos_data_gin ON registros_datos USING GIN (data)');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('registros_datos');
    }
};

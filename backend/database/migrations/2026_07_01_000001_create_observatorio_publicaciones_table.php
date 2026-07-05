<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('publicacion_contadores', function (Blueprint $table) {
            $table->string('tipo', 20)->primary();
            $table->unsignedBigInteger('siguiente_numero')->default(1);
        });
        DB::table('publicacion_contadores')->insert([
            ['tipo' => 'ARTICULO', 'siguiente_numero' => 1],
            ['tipo' => 'REPORTE', 'siguiente_numero' => 1],
        ]);
        Schema::create('observatorio_publicaciones', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('departamento_id')->constrained('departamentos')->cascadeOnDelete();
            $table->foreignId('creado_por')->constrained('users')->restrictOnDelete();
            $table->enum('tipo', ['ARTICULO', 'REPORTE', 'ATLAS']);
            $table->string('codigo')->unique();
            $table->string('titulo');
            $table->date('fecha_publicacion');
            $table->string('link_url', 2048);
            $table->text('descripcion')->nullable();
            $table->text('autores')->nullable();
            $table->string('fuente');
            $table->string('archivo_pdf');
            $table->string('nombre_archivo_original');
            $table->timestamps();
            $table->index(['departamento_id', 'tipo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('observatorio_publicaciones');
        Schema::dropIfExists('publicacion_contadores');
    }
};

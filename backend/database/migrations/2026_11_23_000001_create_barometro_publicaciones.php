<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('barometro_publicaciones', function (Blueprint $table) {
            $table->id();
            $table->string('seccion', 20);
            $table->string('estado', 20);
            $table->string('titulo');
            $table->date('fecha_publicacion');
            $table->string('fuente')->nullable();
            $table->text('descripcion')->nullable();
            $table->string('link_url', 2048);
            $table->timestamps();
            $table->index(['seccion', 'estado', 'fecha_publicacion', 'id'], 'barometro_biblioteca_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('barometro_publicaciones');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('atlas_categorias', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('nombre', 150);
            $table->string('nombre_clave', 150)->unique();
            $table->text('descripcion')->nullable();
            // Stable seed identity survives administrative renames and soft deletion.
            $table->string('clave_inicial')->nullable()->unique();
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::table('observatorio_publicaciones', function (Blueprint $table) {
            $table->foreignUuid('atlas_categoria_id')->nullable()
                ->constrained('atlas_categorias')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('observatorio_publicaciones', function (Blueprint $table) {
            $table->dropForeign(['atlas_categoria_id']);
            $table->dropColumn('atlas_categoria_id');
        });
        Schema::dropIfExists('atlas_categorias');
    }
};

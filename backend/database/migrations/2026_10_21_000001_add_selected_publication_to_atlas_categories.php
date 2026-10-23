<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('atlas_categorias', function (Blueprint $table) {
            $table->foreignUuid('publicacion_destacada_id')->nullable()
                ->constrained('observatorio_publicaciones')->nullOnDelete();
        });
        // Keep existing documents; select the newest public document in each category.
        DB::table('atlas_categorias')->orderBy('id')->each(function ($category) {
            $id = DB::table('observatorio_publicaciones')->where('atlas_categoria_id', $category->id)
                ->where('tipo', 'ATLAS')->whereNull('departamento_id')->where('estado', 'PUBLICACION')
                ->where('solo_suscriptores', false)->orderByDesc('fecha_publicacion')->orderByDesc('created_at')->value('id');
            if ($id) DB::table('atlas_categorias')->where('id', $category->id)->update(['publicacion_destacada_id' => $id]);
        });
    }

    public function down(): void
    {
        Schema::table('atlas_categorias', fn (Blueprint $table) => $table->dropConstrainedForeignId('publicacion_destacada_id'));
    }
};

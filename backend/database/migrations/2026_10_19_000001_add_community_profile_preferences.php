<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('perfiles', function (Blueprint $table) {
            $table->string('vinculo', 40)->nullable();
            $table->string('institucion_tipo', 10)->nullable();
            $table->string('institucion')->nullable();
        });

        Schema::create('usuario_intereses', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('departamento_id')->constrained('departamentos')->cascadeOnDelete();
            $table->timestamps();
            $table->primary(['user_id', 'departamento_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usuario_intereses');
        Schema::table('perfiles', fn (Blueprint $table) => $table->dropColumn(['vinculo', 'institucion_tipo', 'institucion']));
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('observatorio_publicaciones')) {
            return;
        }

        Schema::table('observatorio_publicaciones', function (Blueprint $table) {
            if (! Schema::hasColumn('observatorio_publicaciones', 'estado')) {
                $table->string('estado', 30)->default('PUBLICACION')->after('tipo');
            }

            if (! Schema::hasColumn('observatorio_publicaciones', 'solo_suscriptores')) {
                $table->boolean('solo_suscriptores')->default(false)->after('estado');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('observatorio_publicaciones')) {
            return;
        }

        Schema::table('observatorio_publicaciones', function (Blueprint $table) {
            if (Schema::hasColumn('observatorio_publicaciones', 'solo_suscriptores')) {
                $table->dropColumn('solo_suscriptores');
            }

            if (Schema::hasColumn('observatorio_publicaciones', 'estado')) {
                $table->dropColumn('estado');
            }
        });
    }
};

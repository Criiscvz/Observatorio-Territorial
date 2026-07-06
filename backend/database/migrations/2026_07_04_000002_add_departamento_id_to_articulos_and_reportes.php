<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('articulos', function (Blueprint $table) {
            $table->foreignUuid('departamento_id')->nullable()->after('categoria_id')
                ->constrained('departamentos')->nullOnDelete();
        });
        Schema::table('reportes', function (Blueprint $table) {
            $table->foreignUuid('departamento_id')->nullable()->after('categoria_id')
                ->constrained('departamentos')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('articulos', fn (Blueprint $table) => $table->dropConstrainedForeignId('departamento_id'));
        Schema::table('reportes', fn (Blueprint $table) => $table->dropConstrainedForeignId('departamento_id'));
    }
};

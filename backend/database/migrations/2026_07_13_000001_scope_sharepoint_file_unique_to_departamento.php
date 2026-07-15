<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('observatorio_publicaciones', function (Blueprint $table): void {
            $table->dropUnique(['sharepoint_file_id']);
            $table->unique(
                ['departamento_id', 'sharepoint_file_id'],
                'observatorio_publicaciones_departamento_sharepoint_file_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::table('observatorio_publicaciones', function (Blueprint $table): void {
            $table->dropUnique('observatorio_publicaciones_departamento_sharepoint_file_unique');
            $table->unique('sharepoint_file_id');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('observatorio_publicaciones', function (Blueprint $table) {
            $table->string('archivo_pdf')->nullable()->change();
            $table->string('nombre_archivo_original')->nullable()->change();
            $table->string('sharepoint_file_name')->nullable()->after('sharepoint_file_id');
            $table->string('sharepoint_file_type', 120)->nullable()->after('sharepoint_file_name');
            $table->unsignedBigInteger('sharepoint_file_size')->nullable()->after('sharepoint_file_type');
            $table->timestamp('sharepoint_last_modified_at')->nullable()->after('sharepoint_file_size');
            $table->unique('sharepoint_file_id');
        });
    }

    public function down(): void
    {
        Schema::table('observatorio_publicaciones', function (Blueprint $table) {
            $table->dropUnique(['sharepoint_file_id']);
            $table->dropColumn([
                'sharepoint_file_name',
                'sharepoint_file_type',
                'sharepoint_file_size',
                'sharepoint_last_modified_at',
            ]);
            $table->string('archivo_pdf')->nullable(false)->change();
            $table->string('nombre_archivo_original')->nullable(false)->change();
        });
    }
};

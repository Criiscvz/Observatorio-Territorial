<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('observatorio_publicaciones', function (Blueprint $table) {
            $table->string('sharepoint_url', 2048)->nullable()->after('nombre_archivo_original');
            $table->string('sharepoint_file_id')->nullable()->after('sharepoint_url');
            $table->string('sharepoint_sync_status', 20)->default('pendiente')->after('sharepoint_file_id');
            $table->timestamp('sharepoint_synced_at')->nullable()->after('sharepoint_sync_status');
            $table->text('sharepoint_error')->nullable()->after('sharepoint_synced_at');
        });

        DB::table('publicacion_contadores')->updateOrInsert(
            ['tipo' => 'ATLAS'],
            ['siguiente_numero' => 1]
        );
    }

    public function down(): void
    {
        Schema::table('observatorio_publicaciones', function (Blueprint $table) {
            $table->dropColumn([
                'sharepoint_url',
                'sharepoint_file_id',
                'sharepoint_sync_status',
                'sharepoint_synced_at',
                'sharepoint_error',
            ]);
        });
    }
};

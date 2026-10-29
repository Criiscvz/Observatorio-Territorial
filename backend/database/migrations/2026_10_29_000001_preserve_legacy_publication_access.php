<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('observatorio_publicaciones', function (Blueprint $table): void {
            // Null means a native publication; existing access remains unchanged.
            $table->string('visibilidad_legada', 20)->nullable();
            $table->timestamp('eliminado_legado_at')->nullable();
        });
    }

    public function down(): void
    {
        // Removing a restriction while preserving its row could publish private data.
        if (DB::table('observatorio_publicaciones')->whereNotNull('visibilidad_legada')
            ->orWhereNotNull('eliminado_legado_at')->exists()) {
            throw new RuntimeException('Preserved access data requires reconciliation before removing its schema.');
        }
        Schema::table('observatorio_publicaciones', fn (Blueprint $table) =>
            $table->dropColumn(['visibilidad_legada', 'eliminado_legado_at']));
    }
};

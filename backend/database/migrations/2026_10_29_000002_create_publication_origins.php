<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('publication_origins', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('source_table', 20);
            $table->string('source_kind', 20)->default('legacy');
            $table->uuid('source_id');
            $table->foreignUuid('target_id')->unique()->constrained('observatorio_publicaciones')->restrictOnDelete();
            $table->foreignUuid('categoria_id')->nullable()->constrained('categorias_dataset')->nullOnDelete();
            $table->date('fecha_recepcion')->nullable();
            $table->string('legacy_file_name')->nullable()->index();
            $table->timestamps();
            $table->unique(['source_table', 'source_id']);
        });
    }

    public function down(): void
    {
        if (DB::table('publication_origins')->exists()) {
            throw new RuntimeException('Resolve converted origins before removing their identity map.');
        }
        Schema::drop('publication_origins');
    }
};

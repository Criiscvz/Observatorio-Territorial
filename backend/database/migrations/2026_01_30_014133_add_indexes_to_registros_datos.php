<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Agregar índice en dataset_id si no existe
        if (!$this->indexExists('registros_datos', 'registros_datos_dataset_id_index')) {
            Schema::table('registros_datos', function (Blueprint $table) {
                $table->index('dataset_id', 'registros_datos_dataset_id_index');
            });
        }
    }

    public function down(): void
    {
        Schema::table('registros_datos', function (Blueprint $table) {
            $table->dropIndex('registros_datos_dataset_id_index');
        });
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $result = DB::select("
            SELECT indexname FROM pg_indexes 
            WHERE tablename = ? AND indexname = ?
        ", [$table, $indexName]);
        
        return count($result) > 0;
    }
};

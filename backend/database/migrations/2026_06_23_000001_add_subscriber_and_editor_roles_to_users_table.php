<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            // PostgreSQL usa un constraint CHECK llamado users_rol_check para las columnas enum
            DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_rol_check");
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_rol_check CHECK (rol::text = ANY (ARRAY['ADMIN'::character varying, 'USER'::character varying, 'SUBSCRIBER'::character varying, 'EDITOR'::character varying]::text[]))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            // Revertir a la restricción original de ADMIN y USER
            DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_rol_check");
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_rol_check CHECK (rol::text = ANY (ARRAY['ADMIN'::character varying, 'USER'::character varying]::text[]))");
        }
    }
};

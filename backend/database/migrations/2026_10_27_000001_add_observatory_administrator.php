<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_rol_check');
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_rol_check CHECK (rol IN ('ADMIN','USER','SUBSCRIBER','EDITOR','ADMIN_OBSERVATORIO'))");
        } else {
            Schema::table('users', fn (Blueprint $table) => $table->string('rol', 32)->default('USER')->change());
        }
        Schema::table('usuario_departamento', function (Blueprint $table) {
            $table->boolean('puede_revisar')->default(false);
            $table->boolean('puede_agregar_editores')->default(false);
        });
    }

    public function down(): void
    {
        // Refuse a rollback that would silently revoke an existing administrator.
        if (DB::table('users')->where('rol', 'ADMIN_OBSERVATORIO')->exists()) {
            throw new RuntimeException('Reasigna los administradores de observatorio antes de revertir esta migración.');
        }
        Schema::table('usuario_departamento', fn (Blueprint $table) => $table->dropColumn(['puede_revisar', 'puede_agregar_editores']));
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_rol_check');
            DB::statement("ALTER TABLE users ADD CONSTRAINT users_rol_check CHECK (rol IN ('ADMIN','USER','SUBSCRIBER','EDITOR'))");
        }
    }
};

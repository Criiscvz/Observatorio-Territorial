<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Seed the application's database with admin user.
     */
    public function run(): void
    {
        $adminEmail = env('ADMIN_EMAIL');
        $adminPassword = env('ADMIN_PASSWORD');
        $adminName = env('ADMIN_NAME', 'Administrador');

        // Validar que las credenciales estén configuradas
        if (empty($adminEmail) || empty($adminPassword)) {
            $this->command->error('❌ Error: Las variables ADMIN_EMAIL y ADMIN_PASSWORD deben estar configuradas en el archivo .env');
            $this->command->info('Agrega las siguientes variables a tu archivo .env:');
            $this->command->info('  ADMIN_EMAIL=tu_email@ejemplo.com');
            $this->command->info('  ADMIN_PASSWORD=tu_contraseña_segura');
            return;
        }

        // Verificar si ya existe el usuario admin
        $existingAdmin = User::where('email', $adminEmail)->first();

        if ($existingAdmin) {
            $this->command->info("ℹ️ El usuario administrador ya existe: {$adminEmail}");
            return;
        }

        User::create([
            'name' => $adminName,
            'email' => $adminEmail,
            'password' => Hash::make($adminPassword),
            'rol' => 'ADMIN',
            'email_verified_at' => now(),
        ]);

        $this->command->info("✅ Usuario administrador creado exitosamente: {$adminEmail}");
    }
}

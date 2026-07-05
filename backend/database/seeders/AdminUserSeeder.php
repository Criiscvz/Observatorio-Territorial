<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Seed the application's database with required initial users.
     */
    public function run(): void
    {
        $users = [
            [
                'name' => env('ADMIN_NAME'),
                'email' => env('ADMIN_EMAIL'),
                'password' => env('ADMIN_PASSWORD'),
                'rol' => 'ADMIN',
            ],
            [
                'name' => env('INITIAL_USER_NAME'),
                'email' => env('INITIAL_USER_EMAIL'),
                'password' => env('INITIAL_USER_PASSWORD'),
                'rol' => 'USER',
            ],
        ];

        foreach ($users as $userData) {
            if (!$this->hasValidConfiguration($userData)) {
                $this->command?->warn("Usuario inicial {$userData['rol']} omitido: configura nombre, email y contraseña en .env.");
                continue;
            }

            $user = User::withTrashed()->where('email', $userData['email'])->first();

            User::withoutEvents(function () use ($user, $userData): void {
                if ($user) {
                    if ($user->trashed()) {
                        $user->restore();
                    }

                    $user->forceFill([
                        'name' => $userData['name'],
                        'password' => Hash::make($userData['password']),
                        'rol' => $userData['rol'],
                        'is_active' => true,
                        'email_verified_at' => $user->email_verified_at ?? now(),
                    ])->save();

                    return;
                }

                User::create([
                    'name' => $userData['name'],
                    'email' => $userData['email'],
                    'password' => Hash::make($userData['password']),
                    'rol' => $userData['rol'],
                    'is_active' => true,
                    'email_verified_at' => now(),
                ]);
            });

            $this->command?->info("Usuario inicial asegurado: {$userData['email']} ({$userData['rol']})");
        }
    }

    private function hasValidConfiguration(array $userData): bool
    {
        return filled($userData['name'])
            && filter_var($userData['email'], FILTER_VALIDATE_EMAIL) !== false
            && filled($userData['password']);
    }
}

<?php

declare(strict_types=1);

use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

require dirname(__DIR__, 2).'/vendor/autoload.php';

$mode = $argv[1] ?? '';
$temporaryRoot = $argv[2] ?? '';
$resolvedRoot = realpath($temporaryRoot);
$temporaryParent = realpath(sys_get_temp_dir());
if (! in_array($mode, ['cache', 'verify'], true)
    || $resolvedRoot === false
    || dirname($resolvedRoot) !== $temporaryParent
    || ! str_starts_with(basename($resolvedRoot), 'initial-users-config-test-')) {
    throw new RuntimeException('Only an explicitly disposable test application is allowed.');
}

$app = require $resolvedRoot.'/bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();

if (! $app->environment('testing')
    || config('database.default') !== 'sqlite'
    || config('database.connections.sqlite.database') !== ':memory:'
    || filled(config('database.connections.sqlite.url'))) {
    throw new RuntimeException('Unsafe cached-seeder database configuration blocked.');
}

if ($mode === 'cache') {
    exit($kernel->call('config:cache'));
}

if (! $app->configurationIsCached() || getenv('ADMIN_PASSWORD') !== false) {
    throw new RuntimeException('The verification process must use cache without the original credentials in its environment.');
}

Schema::create('users', function (Blueprint $table): void {
    $table->id();
    $table->string('name');
    $table->string('email')->unique();
    $table->string('password');
    $table->string('rol');
    $table->boolean('is_active');
    $table->timestamp('email_verified_at')->nullable();
    $table->rememberToken();
    $table->timestamps();
    $table->softDeletes();
});

(new AdminUserSeeder())->run();
(new AdminUserSeeder())->run();

foreach (['ADMIN' => 'cached-admin@example.test', 'USER' => 'cached-user@example.test', 'SUBSCRIBER' => 'cached-subscriber@example.test'] as $role => $email) {
    $user = User::where('email', $email)->firstOrFail();
    if ($user->rol !== $role || ! $user->is_active || ! Hash::check('synthetic-cache-password-only', $user->password)) {
        throw new RuntimeException('Cached seeder did not preserve the configured user contract.');
    }
}

if (User::count() !== 3) {
    throw new RuntimeException('Cached seeder created duplicates.');
}

echo 'cached-seeder-ok:3';

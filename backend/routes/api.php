<?php

use App\Presentation\Http\Controllers\Api\PublicController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
| Rutas organizadas por módulos para mejor mantenibilidad.
| Similar a la estructura de FastAPI/NestJS.
|--------------------------------------------------------------------------
*/

// ============ DOCUMENTACIÓN API (Swagger) ============
Route::get('/documentation', function () {
    $path = storage_path('api-docs/api-docs.json');
    if (!File::exists($path)) {
        return response()->json(['error' => 'Documentación no generada. Ejecuta: php artisan swagger:generate'], 404);
    }
    return response()->file($path, ['Content-Type' => 'application/json']);
});

Route::get('/docs', function () {
    return view('swagger');
});

// ============ ARCHIVOS PÚBLICOS (Avatares) ============
Route::get('/avatars/{filename}', function (string $filename) {
    $path = 'public/avatars/' . $filename;
    
    if (!Storage::exists($path)) {
        abort(404, 'Avatar no encontrado');
    }
    
    $file = Storage::get($path);
    $mimeType = Storage::mimeType($path);
    
    return response($file, 200)
        ->header('Content-Type', $mimeType)
        ->header('Cache-Control', 'public, max-age=31536000')
        ->header('Access-Control-Allow-Origin', '*')
        ->header('Cross-Origin-Resource-Policy', 'cross-origin');
})->where('filename', '.*');

// ============ AUTH ============
require __DIR__ . '/modules/auth.php';

// ============ PROFILE ============
require __DIR__ . '/modules/profile.php';

// ============ SEED (Inicialización) ============
require __DIR__ . '/modules/seed.php';

// ============ RUTAS PÚBLICAS ============
Route::prefix('publico')->group(__DIR__ . '/modules/publico.php');

// Compatibilidad con ruta antigua
Route::get('/departamentos/publicos', [PublicController::class, 'departamentos']);

// ============ MÓDULOS PROTEGIDOS ============
Route::prefix('departamentos')->group(__DIR__ . '/modules/departamentos.php');
Route::prefix('datasets')->group(__DIR__ . '/modules/datasets.php');
Route::prefix('variables')->group(__DIR__ . '/modules/variables.php');
Route::prefix('stats')->group(__DIR__ . '/modules/stats.php');
Route::prefix('users')->group(__DIR__ . '/modules/users.php');

// ============ CATEGORÍAS Y RECURSOS RELACIONADOS ============
Route::prefix('categorias')->group(__DIR__ . '/modules/categorias.php');
require __DIR__ . '/modules/graficos.php';
require __DIR__ . '/modules/fuentes.php';

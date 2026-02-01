<?php

use App\Presentation\Http\Controllers\Api\PublicController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\File;

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

// ============ AUTH ============
require __DIR__ . '/modules/auth.php';

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

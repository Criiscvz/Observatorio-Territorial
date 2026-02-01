<?php

use App\Presentation\Http\Controllers\Api\PublicController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
| Rutas organizadas por módulos para mejor mantenibilidad.
| Similar a la estructura de FastAPI/NestJS.
|--------------------------------------------------------------------------
*/

// ============ AUTH ============
require __DIR__ . '/modules/auth.php';

// ============ RUTAS PÚBLICAS ============
Route::prefix('publico')->group(__DIR__ . '/modules/publico.php');

// Compatibilidad con ruta antigua
Route::get('/departamentos/publicos', [PublicController::class, 'departamentos']);

// ============ MÓDULOS PROTEGIDOS ============
Route::prefix('departamentos')->group(__DIR__ . '/modules/departamentos.php');
Route::prefix('datasets')->group(__DIR__ . '/modules/datasets.php');
Route::prefix('variables')->group(__DIR__ . '/modules/variables.php');
Route::prefix('stats')->group(__DIR__ . '/modules/stats.php');

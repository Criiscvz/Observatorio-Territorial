<?php

use App\Presentation\Http\Controllers\Api\AuthController;
use App\Presentation\Http\Controllers\Api\DashboardController;
use App\Presentation\Http\Controllers\Api\DatasetController;
use App\Presentation\Http\Controllers\Api\DepartamentoController;
use App\Presentation\Http\Controllers\Api\PublicController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Rutas públicas de autenticación
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

// ============ RUTAS PÚBLICAS (sin autenticación) ============
Route::prefix('publico')->group(function () {
    // Departamentos públicos
    Route::get('/departamentos', [PublicController::class, 'departamentos']);
    Route::get('/departamentos/{id}', [PublicController::class, 'departamento']);
    
    // Datasets públicos
    Route::get('/datasets/{id}/data', [PublicController::class, 'datasetData']);
    
    // Estadísticas públicas
    Route::post('/stats/univariable', [PublicController::class, 'univariable']);
    Route::post('/stats/bivariable', [PublicController::class, 'bivariable']);
});

// Compatibilidad con ruta antigua
Route::get('/departamentos/publicos', [PublicController::class, 'departamentos']);

// Rutas protegidas (requieren autenticación)
Route::middleware('auth:sanctum')->group(function () {
    // Auth - disponible para todos los usuarios autenticados
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    // ============ RUTAS PARA USUARIOS NORMALES (lectura) ============
    // Departamentos - solo lectura para usuarios normales
    Route::get('/departamentos', [DepartamentoController::class, 'index']);
    Route::get('/departamentos/{departamento}', [DepartamentoController::class, 'show']);

    // Datasets - solo lectura para usuarios normales
    Route::get('/datasets', [DatasetController::class, 'index']);
    Route::get('/datasets/{dataset}', [DatasetController::class, 'show']);
    Route::get('/datasets/{dataset}/data', [DatasetController::class, 'data']);

    // Dashboard / Stats - disponible para todos los autenticados
    Route::post('/stats/univariable', [DashboardController::class, 'univariable']);
    Route::post('/stats/bivariable', [DashboardController::class, 'bivariable']);

    // ============ RUTAS SOLO ADMIN ============
    Route::middleware('role:ADMIN')->group(function () {
        // Departamentos - crear, editar, eliminar
        Route::post('/departamentos', [DepartamentoController::class, 'store']);
        Route::put('/departamentos/{departamento}', [DepartamentoController::class, 'update']);
        Route::delete('/departamentos/{departamento}', [DepartamentoController::class, 'destroy']);

        // Datasets - crear, analizar, importar
        Route::post('/datasets', [DatasetController::class, 'store']);
        Route::post('/datasets/{dataset}/analyze', [DatasetController::class, 'analyze']);
        Route::post('/datasets/{dataset}/import', [DatasetController::class, 'import']);

        // Variables - editar
        Route::put('/variables/{variable}', [DatasetController::class, 'updateVariable']);
    });
});

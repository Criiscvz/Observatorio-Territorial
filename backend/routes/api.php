<?php

use App\Presentation\Http\Controllers\Api\AuthController;
use App\Presentation\Http\Controllers\Api\DashboardController;
use App\Presentation\Http\Controllers\Api\DatasetController;
use App\Presentation\Http\Controllers\Api\DepartamentoController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Rutas públicas de autenticación
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

// Departamentos públicos (sin autenticación)
Route::get('/departamentos/publicos', [DepartamentoController::class, 'publicos']);

// Rutas protegidas
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    // Departamentos
    Route::apiResource('departamentos', DepartamentoController::class);

    // Datasets
    Route::apiResource('datasets', DatasetController::class)->only(['index', 'store', 'show']);
    Route::post('/datasets/{dataset}/analyze', [DatasetController::class, 'analyze']);
    Route::post('/datasets/{dataset}/import', [DatasetController::class, 'import']);
    Route::get('/datasets/{dataset}/data', [DatasetController::class, 'data']);

    // Variables
    Route::put('/variables/{variable}', [DatasetController::class, 'updateVariable']);

    // Dashboard / Stats
    Route::post('/stats/univariable', [DashboardController::class, 'univariable']);
    Route::post('/stats/bivariable', [DashboardController::class, 'bivariable']);
});

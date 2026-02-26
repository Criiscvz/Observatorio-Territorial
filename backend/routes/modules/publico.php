<?php

use App\Presentation\Http\Controllers\Api\PublicController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Routes (sin autenticación)
|--------------------------------------------------------------------------
*/

// Departamentos públicos
Route::get('/departamentos', [PublicController::class, 'departamentos']);
Route::get('/departamentos/{id}', [PublicController::class, 'departamento']);

// Datasets públicos
Route::get('/datasets/{id}/data', [PublicController::class, 'datasetData']);

// Estadísticas públicas
Route::post('/stats/univariable', [PublicController::class, 'univariable']);
Route::post('/stats/bivariable', [PublicController::class, 'bivariable']);
Route::post('/stats/text-analysis', [PublicController::class, 'textAnalysis']);

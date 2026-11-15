<?php

use App\Presentation\Http\Controllers\Api\GraficoPredeterminadoController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Gráficos Predeterminados Routes
|--------------------------------------------------------------------------
*/

// Lectura pública (gráficos de datasets públicos)
Route::get('/datasets/{datasetId}/graficos-predeterminados', [GraficoPredeterminadoController::class, 'index'])->whereUuid('datasetId');

// Escritura - admin y editor autenticados
Route::middleware(['auth:sanctum', 'role:ADMIN,EDITOR'])->group(function () {
    Route::post('/datasets/{datasetId}/graficos-predeterminados', [GraficoPredeterminadoController::class, 'store'])->whereUuid('datasetId');
    Route::put('/graficos-predeterminados/{id}', [GraficoPredeterminadoController::class, 'update'])->whereUuid('id');
    Route::delete('/graficos-predeterminados/{id}', [GraficoPredeterminadoController::class, 'destroy'])->whereUuid('id');
});

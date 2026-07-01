<?php

use App\Presentation\Http\Controllers\Api\DatasetFuenteController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Dataset Fuentes Routes
|--------------------------------------------------------------------------
*/

// Lectura pública
Route::get('/datasets/{datasetId}/fuentes', [DatasetFuenteController::class, 'index']);

// Escritura - admin y editor autenticados
Route::middleware(['auth:sanctum', 'role:ADMIN,EDITOR'])->group(function () {
    Route::post('/datasets/{datasetId}/fuentes', [DatasetFuenteController::class, 'store']);
    Route::put('/fuentes/{id}', [DatasetFuenteController::class, 'update']);
    Route::delete('/fuentes/{id}', [DatasetFuenteController::class, 'destroy']);
});

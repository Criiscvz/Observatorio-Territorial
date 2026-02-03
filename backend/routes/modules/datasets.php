<?php

use App\Presentation\Http\Controllers\Api\DatasetController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Datasets Routes
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {
    // Lectura - todos los usuarios autenticados
    Route::get('/', [DatasetController::class, 'index']);
    Route::get('/{dataset}', [DatasetController::class, 'show']);
    Route::get('/{dataset}/data', [DatasetController::class, 'data']);

    // Escritura - solo admin
    Route::middleware('role:ADMIN')->group(function () {
        Route::post('/', [DatasetController::class, 'store']);
        Route::post('/{dataset}/analyze', [DatasetController::class, 'analyze']);
        Route::post('/{dataset}/import', [DatasetController::class, 'import']);
        Route::delete('/{dataset}', [DatasetController::class, 'destroy']);
    });
});

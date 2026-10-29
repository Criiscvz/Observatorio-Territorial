<?php

use App\Presentation\Http\Controllers\Api\DatasetController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Datasets Routes
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', 'role:ADMIN,USER,SUBSCRIBER,SUSCRIPTOR,SUBSCRIPTOR'])->group(function () {
    // El editor trabaja con publicaciones; los otros roles conservan su lectura.
    Route::get('/', [DatasetController::class, 'index']);
    Route::get('/{dataset}', [DatasetController::class, 'show']);
    Route::get('/{dataset}/data', [DatasetController::class, 'data']);

    // Escritura - solo administración.
    Route::middleware('role:ADMIN')->group(function () {
        Route::post('/', [DatasetController::class, 'store']);
        Route::put('/{dataset}', [DatasetController::class, 'update']);
        Route::post('/{dataset}/analyze', [DatasetController::class, 'analyze']);
        Route::post('/{dataset}/import', [DatasetController::class, 'import']);
        Route::delete('/{dataset}', [DatasetController::class, 'destroy']);
    });
});

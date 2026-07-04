<?php

use App\Presentation\Http\Controllers\Api\ArticuloController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Artículos Routes
|--------------------------------------------------------------------------
*/

// Lectura pública
Route::get('/', [ArticuloController::class, 'index']);
Route::get('/{id}', [ArticuloController::class, 'show'])->whereUuid('id');

// Escritura - solo admin autenticado
Route::middleware(['auth:sanctum', 'role:ADMIN'])->group(function () {
    Route::post('/', [ArticuloController::class, 'store']);
    Route::put('/{id}', [ArticuloController::class, 'update'])->whereUuid('id');
    Route::delete('/{id}', [ArticuloController::class, 'destroy'])->whereUuid('id');
});

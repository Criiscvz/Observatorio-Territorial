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

// Escritura - validación dinámica de permisos
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/', [ArticuloController::class, 'store'])->middleware('permission:atlas,escritura');
    Route::put('/{id}', [ArticuloController::class, 'update'])->whereUuid('id')->middleware('permission:atlas,escritura');
    Route::delete('/{id}', [ArticuloController::class, 'destroy'])->whereUuid('id')->middleware('permission:atlas,admin');
});

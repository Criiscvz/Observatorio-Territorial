<?php

use App\Presentation\Http\Controllers\Api\ReporteController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Reportes Routes
|--------------------------------------------------------------------------
*/

// Lectura pública
// IMPORTANTE: /fichas/{filename} debe declararse ANTES de /{id}
Route::get('/fichas/{filename}', [ReporteController::class, 'ficha']);
Route::get('/', [ReporteController::class, 'index']);
Route::get('/{id}', [ReporteController::class, 'show'])->whereUuid('id');

// Escritura - validación dinámica de permisos
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/', [ReporteController::class, 'store'])->middleware('permission:reportes,escritura');
    Route::put('/{id}', [ReporteController::class, 'update'])->middleware('permission:reportes,escritura');
    Route::delete('/{id}', [ReporteController::class, 'destroy'])->middleware('permission:reportes,admin');
});

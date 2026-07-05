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

// Escritura - solo admin autenticado
Route::middleware(['auth:sanctum', 'role:ADMIN'])->group(function () {
    Route::post('/', [ReporteController::class, 'store']);
    Route::put('/{id}', [ReporteController::class, 'update']);
    Route::delete('/{id}', [ReporteController::class, 'destroy']);
});

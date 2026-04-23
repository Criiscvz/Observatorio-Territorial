<?php

use App\Presentation\Http\Controllers\Api\DepartamentoController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Departamentos Routes
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {
    // Lectura - todos los usuarios autenticados
    Route::get('/', [DepartamentoController::class, 'index']);
    Route::get('/{departamento}', [DepartamentoController::class, 'show']);

    // Escritura - solo admin
    Route::middleware('role:ADMIN')->group(function () {
        Route::post('/', [DepartamentoController::class, 'store']);
        Route::put('/{departamento}', [DepartamentoController::class, 'update']);
        Route::delete('/{departamento}', [DepartamentoController::class, 'destroy']);
    });
});

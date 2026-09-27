<?php

use App\Presentation\Http\Controllers\Api\AtlasCategoriaController;
use Illuminate\Support\Facades\Route;

Route::get('/publico/atlas/categorias', [AtlasCategoriaController::class, 'index']);
Route::prefix('atlas/categorias')->middleware(['auth:sanctum', 'role:ADMIN'])->group(function () {
    Route::get('/', [AtlasCategoriaController::class, 'index']);
    Route::post('/', [AtlasCategoriaController::class, 'store']);
    Route::put('/{categoria}', [AtlasCategoriaController::class, 'update']);
    Route::delete('/{categoria}', [AtlasCategoriaController::class, 'destroy']);
});

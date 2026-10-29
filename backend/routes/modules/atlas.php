<?php

use App\Presentation\Http\Controllers\Api\AtlasCategoriaController;
use App\Presentation\Http\Controllers\Api\AtlasEnlaceController;
use Illuminate\Support\Facades\Route;

Route::get('/publico/atlas/categorias', [AtlasCategoriaController::class, 'indexPublico']);
Route::prefix('atlas/categorias')->middleware(['auth:sanctum', 'role:ADMIN'])->group(function () {
    Route::get('/', [AtlasCategoriaController::class, 'index']);
    Route::post('/', [AtlasCategoriaController::class, 'store']);
    Route::put('/{categoria}', [AtlasCategoriaController::class, 'update']);
    Route::delete('/{categoria}', [AtlasCategoriaController::class, 'destroy']);
    Route::post('/{categoria}/enlaces', [AtlasEnlaceController::class, 'store']);
});
Route::patch('/atlas/enlaces/{publicacion}', [AtlasEnlaceController::class, 'update'])->middleware(['auth:sanctum', 'role:ADMIN']);

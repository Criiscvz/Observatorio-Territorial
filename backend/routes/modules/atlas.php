<?php

use App\Presentation\Http\Controllers\Api\AtlasCategoriaController;
use App\Presentation\Http\Controllers\Api\AtlasEnlaceController;
use Illuminate\Support\Facades\Route;

Route::get('/publico/atlas/categorias', [AtlasCategoriaController::class, 'indexPublico']);
Route::get('/publico/atlas/directorio', [AtlasCategoriaController::class, 'publicDirectory']);
Route::prefix('atlas/categorias')->middleware(['auth:sanctum', 'role:ADMIN'])->group(function () {
    Route::get('/directorio', [AtlasCategoriaController::class, 'directory']);
    Route::get('/', [AtlasCategoriaController::class, 'index']);
    Route::post('/', [AtlasCategoriaController::class, 'store']);
    Route::put('/{categoria}', [AtlasCategoriaController::class, 'update'])->whereUuid('categoria');
    Route::delete('/{categoria}', [AtlasCategoriaController::class, 'destroy'])->whereUuid('categoria');
    Route::post('/{categoria}/enlaces', [AtlasEnlaceController::class, 'store'])->whereUuid('categoria');
});
Route::patch('/atlas/enlaces/{publicacion}', [AtlasEnlaceController::class, 'update'])->middleware(['auth:sanctum', 'role:ADMIN'])->whereUuid('publicacion');

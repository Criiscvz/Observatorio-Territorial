<?php

use App\Presentation\Http\Controllers\Api\ObservatorioPublicacionController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/{departamento}/publicaciones', [ObservatorioPublicacionController::class, 'index']);
    Route::get('/{departamento}/publicaciones/articulos', [ObservatorioPublicacionController::class, 'articulos']);
    Route::get('/{departamento}/publicaciones/reportes', [ObservatorioPublicacionController::class, 'reportes']);
    Route::get('/publicaciones/{publicacion}/download', [ObservatorioPublicacionController::class, 'download']);
    Route::post('/{departamento}/publicaciones', [ObservatorioPublicacionController::class, 'store'])->middleware('role:ADMIN');
    Route::patch('/publicaciones/{publicacion}', [ObservatorioPublicacionController::class, 'update'])->middleware('role:ADMIN');
});

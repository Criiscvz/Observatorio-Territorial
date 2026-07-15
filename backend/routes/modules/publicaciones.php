<?php

use App\Presentation\Http\Controllers\Api\ObservatorioPublicacionController;
use Illuminate\Support\Facades\Route;

Route::get('/publicaciones/{publicacion}/download', [ObservatorioPublicacionController::class, 'download']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/{departamento}/publicaciones', [ObservatorioPublicacionController::class, 'index']);
    Route::get('/{departamento}/publicaciones/articulos', [ObservatorioPublicacionController::class, 'articulos']);
    Route::get('/{departamento}/publicaciones/reportes', [ObservatorioPublicacionController::class, 'reportes']);
    Route::get('/{departamento}/publicaciones/atlas', [ObservatorioPublicacionController::class, 'atlas']);
    Route::get('/{departamento}/publicaciones/can-upload', [ObservatorioPublicacionController::class, 'canUpload']);
    Route::get('/{departamento}/publicaciones/reportes/sharepoint/files', [ObservatorioPublicacionController::class, 'sharePointPowerBiLinks'])->middleware('role:ADMIN');
    Route::get('/{departamento}/publicaciones/reportes/sharepoint/browse', [ObservatorioPublicacionController::class, 'browseSharePointReportes'])->middleware('role:ADMIN');
    Route::post('/{departamento}/publicaciones/reportes/sharepoint/import', [ObservatorioPublicacionController::class, 'importSharePointReporte'])->middleware('role:ADMIN');
    Route::post('/{departamento}/publicaciones/reportes/sharepoint/import-many', [ObservatorioPublicacionController::class, 'importManySharePointReportes'])->middleware('role:ADMIN');
    Route::post('/{departamento}/publicaciones/reportes/sharepoint/sync', [ObservatorioPublicacionController::class, 'syncSharePointReportes'])->middleware('role:ADMIN');
    Route::get('/{departamento}/publicaciones/articulos/sharepoint/browse', [ObservatorioPublicacionController::class, 'browseSharePointArticulos'])->middleware('role:ADMIN');
    Route::post('/{departamento}/publicaciones/articulos/sharepoint/import-many', [ObservatorioPublicacionController::class, 'importManySharePointArticulos'])->middleware('role:ADMIN');
    Route::get('/{departamento}/publicaciones/atlas/sharepoint/files', [ObservatorioPublicacionController::class, 'sharePointFiles'])->middleware('role:ADMIN');
    Route::get('/{departamento}/publicaciones/atlas/sharepoint/browse', [ObservatorioPublicacionController::class, 'browseSharePointAtlas'])->middleware('role:ADMIN');
    Route::post('/{departamento}/publicaciones/atlas/sharepoint/import', [ObservatorioPublicacionController::class, 'importSharePointAtlas'])->middleware('role:ADMIN');
    Route::post('/{departamento}/publicaciones/atlas/sharepoint/import-many', [ObservatorioPublicacionController::class, 'importManySharePointAtlas'])->middleware('role:ADMIN');
    Route::post('/{departamento}/publicaciones/atlas/sharepoint/sync', [ObservatorioPublicacionController::class, 'syncSharePointAtlas'])->middleware('role:ADMIN');
    Route::get('/publicaciones/atlas/recientes', [ObservatorioPublicacionController::class, 'recentAtlasReports']);
    Route::post('/{departamento}/publicaciones', [ObservatorioPublicacionController::class, 'store'])->middleware('role:ADMIN,EDITOR');
    Route::patch('/publicaciones/{publicacion}', [ObservatorioPublicacionController::class, 'update'])->middleware('role:ADMIN,EDITOR');
    Route::delete('/publicaciones/{publicacion}', [ObservatorioPublicacionController::class, 'destroy'])->middleware('role:ADMIN,EDITOR');
});

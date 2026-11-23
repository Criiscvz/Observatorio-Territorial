<?php

use App\Models\BarometroPublicacion;
use App\Presentation\Http\Controllers\Api\BarometroPublicacionController;
use Illuminate\Support\Facades\Route;

Route::get('/publico/barometro/{seccion}/publicaciones', [BarometroPublicacionController::class, 'publicIndex'])
    ->whereIn('seccion', BarometroPublicacion::SECTIONS);

Route::prefix('admin/barometro')->middleware(['auth:sanctum', 'role:ADMIN'])->group(function () {
    Route::get('/secciones', [BarometroPublicacionController::class, 'counts']);
    Route::get('/{seccion}/publicaciones', [BarometroPublicacionController::class, 'index'])
        ->whereIn('seccion', BarometroPublicacion::SECTIONS);
    Route::post('/{seccion}/publicaciones', [BarometroPublicacionController::class, 'store'])
        ->whereIn('seccion', BarometroPublicacion::SECTIONS);
    Route::patch('/{seccion}/publicaciones/{publicacion}', [BarometroPublicacionController::class, 'update'])
        ->whereIn('seccion', BarometroPublicacion::SECTIONS)->where('publicacion', '[1-9][0-9]{0,17}');
});

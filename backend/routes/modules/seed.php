<?php

use App\Presentation\Http\Controllers\Api\SeedController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Seed Routes
|--------------------------------------------------------------------------
| Rutas para inicializar datos del sistema.
| Estas rutas requieren un token de seguridad (X-Seed-Token).
|--------------------------------------------------------------------------
*/

Route::prefix('seed')->group(function () {
    Route::post('/admin', [SeedController::class, 'seedAdmin']);
    Route::post('/departamentos', [SeedController::class, 'seedDepartamentos']);
    Route::post('/all', [SeedController::class, 'seedAll']);
});

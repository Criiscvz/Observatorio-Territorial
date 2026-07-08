<?php

use App\Presentation\Http\Controllers\Api\PermisoController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Permisos Routes
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', 'role:ADMIN'])->group(function () {
    Route::get('/users/{user}/permisos', [PermisoController::class, 'show']);
    Route::put('/users/{user}/permisos', [PermisoController::class, 'save']);
});

// El usuario autenticado puede ver sus propios permisos
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/mis-permisos', [PermisoController::class, 'myPermissions']);
});

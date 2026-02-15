<?php

use App\Presentation\Http\Controllers\Api\CategoriaDatasetController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Categorías Routes
|--------------------------------------------------------------------------
*/

// Rutas públicas (sin autenticación)
Route::get('/', [CategoriaDatasetController::class, 'index']);
Route::get('/{codigo}', [CategoriaDatasetController::class, 'show']);
Route::get('/{codigo}/datasets', [CategoriaDatasetController::class, 'datasets']);

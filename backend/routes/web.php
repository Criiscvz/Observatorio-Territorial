<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Ruta de login (requerida por Sanctum para redirección)
Route::get('/login', function () {
    return response()->json(['message' => 'No autenticado.'], 401);
})->name('login');

// Private local storage is served only by Laravel's signed routes. Public avatars
// use /api/avatars/{filename}; publication files use their authorized read endpoint.

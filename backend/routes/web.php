<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

Route::get('/', function () {
    return view('welcome');
});

// Ruta de login (requerida por Sanctum para redirección)
Route::get('/login', function () {
    return response()->json(['message' => 'No autenticado.'], 401);
})->name('login');

// Ruta para servir archivos de storage con CORS (desarrollo)
Route::get('/storage/{path}', function (string $path) {
    $disk = Storage::disk(config('filesystems.default'));
    $path = 'public/' . ltrim($path, '/');

    if (! $disk->exists($path)) {
        abort(404);
    }

    $mimeType = $disk->mimeType($path) ?: 'application/octet-stream';
    $content = $disk->get($path);

    return response($content, 200)
        ->header('Content-Type', $mimeType)
        ->header('Access-Control-Allow-Origin', '*')
        ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        ->header('Access-Control-Allow-Headers', '*');
})->where('path', '.*');

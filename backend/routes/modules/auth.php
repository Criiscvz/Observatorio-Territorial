<?php

use App\Presentation\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Auth Routes
|--------------------------------------------------------------------------
*/

// Rutas públicas
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);
Route::post('/verify-email-code', [AuthController::class, 'verifyEmailCode'])
    ->middleware('throttle:10,1');
Route::post('/resend-verification-code', [AuthController::class, 'resendVerificationCode'])
    ->middleware('throttle:3,10');
Route::get('/auth/google/redirect', [AuthController::class, 'googleRedirect'])
    ->middleware('throttle:10,1');
Route::get('/auth/google/callback', [AuthController::class, 'googleCallback'])
    ->middleware('throttle:10,1');
Route::post('/auth/google/exchange', [AuthController::class, 'googleExchange'])
    ->middleware('throttle:10,1');

// Rutas protegidas
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
});

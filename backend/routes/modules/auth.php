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
    ->middleware('throttle:email-verification');
Route::post('/resend-verification-code', [AuthController::class, 'resendVerificationCode'])
    ->middleware('throttle:email-verification-resend');
Route::get('/auth/google/redirect', [AuthController::class, 'googleRedirect'])
    ->middleware('throttle:google-oauth');
Route::get('/auth/google/callback', [AuthController::class, 'googleCallback'])
    ->middleware('throttle:google-oauth');
Route::post('/auth/google/exchange', [AuthController::class, 'googleExchange'])
    ->middleware('throttle:google-oauth');

// Rutas protegidas
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
});

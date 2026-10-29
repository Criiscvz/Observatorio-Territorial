<?php

use App\Presentation\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| User Routes (Admin Only)
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', 'role:ADMIN'])->group(function () {
    Route::get('/', [UserController::class, 'index']);
    Route::post('/', [UserController::class, 'store']);
    Route::get('/{id}', [UserController::class, 'show']);
    Route::put('/{id}', [UserController::class, 'update']);
    Route::delete('/{id}', [UserController::class, 'destroy']);
    Route::patch('/{id}/role', [UserController::class, 'updateRole']);
    Route::patch('/{id}/password', [UserController::class, 'changePassword'])->middleware('throttle:20,1');
    Route::patch('/{id}/status', [UserController::class, 'toggleStatus']);
});

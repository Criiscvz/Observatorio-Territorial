<?php

use App\Presentation\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| User Routes (Admin Only)
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/', [UserController::class, 'index']);
    Route::patch('/{id}/role', [UserController::class, 'updateRole']);
});

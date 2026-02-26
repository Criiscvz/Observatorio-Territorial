<?php

use App\Presentation\Http\Controllers\Api\DashboardController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Stats Routes (Dashboard)
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/univariable', [DashboardController::class, 'univariable']);
    Route::post('/bivariable', [DashboardController::class, 'bivariable']);
    Route::post('/text-analysis', [DashboardController::class, 'textAnalysis']);
});

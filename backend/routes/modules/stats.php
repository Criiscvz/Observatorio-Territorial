<?php

use App\Presentation\Http\Controllers\Api\DashboardController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Stats Routes (Dashboard)
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')
    ->where(['datasetId' => '[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}'])->group(function () {
    Route::post('/univariable', [DashboardController::class, 'univariable']);
    Route::post('/bivariable', [DashboardController::class, 'bivariable']);
    Route::post('/text-analysis', [DashboardController::class, 'textAnalysis']);
    Route::get('/datasets/{datasetId}/stopwords', [DashboardController::class, 'getStopwords']);
    Route::put('/datasets/{datasetId}/stopwords', [DashboardController::class, 'updateStopwords']);
});

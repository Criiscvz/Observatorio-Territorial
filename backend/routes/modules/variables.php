<?php

use App\Presentation\Http\Controllers\Api\DatasetController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Variables Routes
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', 'role:ADMIN,EDITOR'])
    ->where(['variable' => '[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}'])->group(function () {
    Route::put('/{variable}', [DatasetController::class, 'updateVariable']);
    Route::post('/bulk-update', [DatasetController::class, 'bulkUpdateVariables']);
});

<?php

use App\Presentation\Http\Controllers\Api\DatasetController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Variables Routes
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', 'role:ADMIN,EDITOR'])->group(function () {
    Route::put('/{variable}', [DatasetController::class, 'updateVariable']);
    Route::post('/bulk-update', [DatasetController::class, 'bulkUpdateVariables']);
});

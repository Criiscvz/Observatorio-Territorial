<?php

declare(strict_types=1);

namespace App\Application\User\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class UserPasswordSessions
{
    public function revoke(User $user): void
    {
        $user->tokens()->delete();
        if (config('session.driver') === 'database') {
            DB::connection(config('session.connection'))
                ->table(config('session.table', 'sessions'))->where('user_id', $user->id)->delete();
        }
    }
}

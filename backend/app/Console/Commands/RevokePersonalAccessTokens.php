<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Laravel\Sanctum\PersonalAccessToken;

class RevokePersonalAccessTokens extends Command
{
    protected $signature = 'security:revoke-personal-access-tokens {--force : Confirm execution in production}';

    protected $description = 'Revoca los tokens Bearer de Sanctum tras migrar a sesiones con cookies HttpOnly.';

    public function handle(): int
    {
        if ($this->laravel->environment('production') && !$this->option('force')) {
            $this->error('En producción debes confirmar con --force.');

            return self::FAILURE;
        }

        $count = PersonalAccessToken::query()->delete();
        $this->info("Se revocaron {$count} tokens de acceso personal.");

        return self::SUCCESS;
    }
}

<?php

declare(strict_types=1);

namespace App\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

// Domain Interfaces
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\RegistroDatoRepositoryInterface;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use App\Domain\User\Repositories\UserRepositoryInterface;

// Infrastructure Implementations
use App\Infrastructure\Persistence\Eloquent\Repositories\EloquentDepartamentoRepository;
use App\Infrastructure\Persistence\Eloquent\Repositories\EloquentDatasetRepository;
use App\Infrastructure\Persistence\Eloquent\Repositories\EloquentRegistroDatoRepository;
use App\Infrastructure\Persistence\Eloquent\Repositories\EloquentVariableMetadatoRepository;
use App\Infrastructure\Persistence\Eloquent\Repositories\EloquentUserRepository;

class RepositoryServiceProvider extends ServiceProvider
{
    /**
     * All repository bindings.
     *
     * @var array<class-string, class-string>
     */
    public array $bindings = [
        DepartamentoRepositoryInterface::class => EloquentDepartamentoRepository::class,
        DatasetRepositoryInterface::class => EloquentDatasetRepository::class,
        RegistroDatoRepositoryInterface::class => EloquentRegistroDatoRepository::class,
        VariableMetadatoRepositoryInterface::class => EloquentVariableMetadatoRepository::class,
        UserRepositoryInterface::class => EloquentUserRepository::class,
    ];

    /**
     * Register services.
     */
    public function register(): void
    {
        foreach ($this->bindings as $interface => $implementation) {
            $this->app->bind($interface, $implementation);
        }
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }
}

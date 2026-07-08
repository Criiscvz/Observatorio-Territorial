<?php

declare(strict_types=1);

namespace App\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

// Domain Interfaces
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\RegistroDatoRepositoryInterface;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use App\Domain\Permiso\Repositories\PermisoRepositoryInterface;
use App\Domain\User\Repositories\UserRepositoryInterface;
use App\Domain\Statistics\Services\StatisticsServiceInterface;

// Infrastructure Implementations
use App\Infrastructure\Persistence\Eloquent\Repositories\EloquentDepartamentoRepository;
use App\Infrastructure\Persistence\Eloquent\Repositories\EloquentDatasetRepository;
use App\Infrastructure\Persistence\Eloquent\Repositories\EloquentPermisoRepository;
use App\Infrastructure\Persistence\Eloquent\Repositories\EloquentRegistroDatoRepository;
use App\Infrastructure\Persistence\Eloquent\Repositories\EloquentVariableMetadatoRepository;
use App\Infrastructure\Persistence\Eloquent\Repositories\EloquentUserRepository;
use App\Infrastructure\Persistence\Mongo\Repositories\MongoRegistroDatoRepository;
use App\Infrastructure\Services\StatisticsService;
use App\Infrastructure\Services\TextProcessingService;

class RepositoryServiceProvider extends ServiceProvider
{
    /**
     * All repository bindings.
     *
     * @var array<class-string, class-string>
     */
    public array $bindings = [
        // Repositories
        DepartamentoRepositoryInterface::class => EloquentDepartamentoRepository::class,
        DatasetRepositoryInterface::class => EloquentDatasetRepository::class,
        RegistroDatoRepositoryInterface::class => MongoRegistroDatoRepository::class,
        VariableMetadatoRepositoryInterface::class => EloquentVariableMetadatoRepository::class,
        UserRepositoryInterface::class => EloquentUserRepository::class,
        PermisoRepositoryInterface::class => EloquentPermisoRepository::class,
        // Services
        StatisticsServiceInterface::class => StatisticsService::class,
    ];

    /**
     * Register services.
     */
    public function register(): void
    {
        foreach ($this->bindings as $interface => $implementation) {
            $this->app->bind($interface, $implementation);
        }

        // Singleton services
        $this->app->singleton(TextProcessingService::class);
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }
}

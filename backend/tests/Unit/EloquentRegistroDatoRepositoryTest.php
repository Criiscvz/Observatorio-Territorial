<?php

namespace Tests\Unit;

use App\Infrastructure\Persistence\Eloquent\Models\RegistroDatoModel;
use App\Infrastructure\Persistence\Eloquent\Repositories\EloquentRegistroDatoRepository;
use InvalidArgumentException;
use Tests\TestCase;

class EloquentRegistroDatoRepositoryTest extends TestCase
{
    public function test_rejects_malicious_column_names_before_running_a_query(): void
    {
        $repository = new EloquentRegistroDatoRepository(new RegistroDatoModel());
        $maliciousColumn = "categoria' OR 1=1 --";

        $this->expectException(InvalidArgumentException::class);

        $repository->getCategoricalFrequencies('dataset-id', $maliciousColumn);
    }

    public function test_accepts_normalized_imported_column_names(): void
    {
        $repository = new EloquentRegistroDatoRepository(new RegistroDatoModel());

        $reflection = new \ReflectionMethod($repository, 'sanitizeColumn');
        $reflection->setAccessible(true);

        $this->assertSame('poblacion_2026', $reflection->invoke($repository, 'poblacion_2026'));
    }
}

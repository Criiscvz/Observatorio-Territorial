<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Application\Dashboard\DTOs\StatsRequestDTO;
use App\Application\Dashboard\UseCases\GetUnivariableStatsUseCase;
use App\Domain\Dataset\Entities\Dataset;
use App\Domain\Dataset\Entities\VariableMetadato;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use App\Domain\Departamento\Entities\Departamento;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Statistics\Services\StatisticsServiceInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpKernel\Exception\HttpException;

final class UnivariableStatsUseCaseTest extends TestCase
{
    public static function chartRequests(): array
    {
        return [
            'numeric fallback' => ['NUMERICO', 'pie', 'histogram', 'getNumericStats'],
            'categorical fallback' => ['CATEGORICO', 'histogram', 'pie', 'getCategoricalStats'],
            'date fallback' => ['FECHA', 'wordcloud', 'line', 'getDateStats'],
            'text fallback' => ['TEXTO', 'gauge', 'bar', 'getTextSummaryStats'],
            'text wordcloud' => ['TEXTO', 'wordcloud', 'wordcloud', 'getWordCloudData'],
            'categorical wordcloud' => ['CATEGORICO', 'wordcloud', 'wordcloud', 'getWordCloudData'],
            'numeric default' => ['NUMERICO', null, 'histogram', 'getNumericStats'],
            'date default' => ['FECHA', null, 'line', 'getDateStats'],
            'compatible request' => ['NUMERICO', 'horizontal_bar', 'horizontal_bar', 'getNumericStats'],
        ];
    }

    #[DataProvider('chartRequests')]
    public function test_chart_selection_and_statistics_do_not_require_an_http_request(
        string $type, ?string $requested, string $expected, string $method,
    ): void {
        [$useCase, $stats] = $this->useCase($type, true);
        $filters = [['column' => 'grupo', 'operator' => 'eq', 'value' => 'A']];
        $stats->expects(self::once())->method($method)->with('dataset', 'columna', 17, $filters)
            ->willReturn(['data' => [['value' => 3]], 'stats' => ['count' => 3]]);

        $result = $useCase->execute(new StatsRequestDTO('dataset', 'variable', 42, $requested, 17, $filters));

        self::assertSame($expected, $result->chartType);
        self::assertSame('variable', $result->variableId);
        self::assertSame('columna', $result->nombreVariable);
        self::assertSame([['value' => 3]], $result->data);
        self::assertSame(['count' => 3], $result->stats);
    }

    public function test_unauthorized_statistics_are_denied_before_reading_data(): void
    {
        [$useCase, $stats] = $this->useCase('NUMERICO', false);
        $stats->expects(self::never())->method('getNumericStats');
        try {
            $useCase->execute(new StatsRequestDTO('dataset', 'variable', 42));
            self::fail('Unauthorized statistics were returned.');
        } catch (HttpException $exception) {
            self::assertSame(403, $exception->getStatusCode());
        }
    }

    private function useCase(string $type, bool $public): array
    {
        $datasets = $this->createMock(DatasetRepositoryInterface::class);
        $variables = $this->createMock(VariableMetadatoRepositoryInterface::class);
        $departments = $this->createMock(DepartamentoRepositoryInterface::class);
        $stats = $this->createMock(StatisticsServiceInterface::class);
        $variables->method('findById')->with('variable')->willReturn(new VariableMetadato(
            'variable', 'dataset', 'columna', 'Columna original', $type, $type, true, 0,
        ));
        $datasets->method('findById')->with('dataset')->willReturn(new Dataset(
            'dataset', 'department', null, 42, 'Synthetic dataset', 'data.csv', null, null, 'COMPLETADO', 3, null,
        ));
        $departments->method('findById')->with('department')->willReturn(new Departamento(
            'department', 'Synthetic department', 'TEST', null, null, $public,
        ));
        $departments->method('existsForUser')->with('department', 42)->willReturn(false);
        return [new GetUnivariableStatsUseCase($datasets, $departments, $variables, $stats), $stats];
    }
}

<?php

declare(strict_types=1);

namespace App\Domain\Statistics;

/** Compatibility contract of the retained statistics API, independent of HTTP. */
final class UnivariableChartTypes
{
    public const NUMERIC = ['histogram', 'bar', 'line', 'area', 'gauge', 'horizontal_bar', 'pictorial_bar'];
    public const CATEGORICAL = ['bar', 'pie', 'donut', 'funnel', 'treemap', 'radar', 'line', 'area', 'horizontal_bar', 'rose', 'polar_bar', 'pictorial_bar', 'wordcloud'];
    public const ALL = ['bar', 'pie', 'donut', 'histogram', 'line', 'area', 'funnel', 'treemap', 'gauge', 'radar', 'wordcloud', 'horizontal_bar', 'rose', 'polar_bar', 'pictorial_bar'];

    /** @return list<string> */
    public static function compatibleWith(string $dataType): array
    {
        return match ($dataType) {
            'NUMERICO' => self::NUMERIC,
            'FECHA' => ['line', 'area', 'bar'],
            default => self::CATEGORICAL,
        };
    }

    public static function isCompatible(string $chartType, string $dataType): bool
    {
        return in_array($chartType, self::compatibleWith($dataType), true);
    }

    public static function defaultFor(string $dataType): string
    {
        return match ($dataType) {
            'NUMERICO' => 'histogram',
            'CATEGORICO' => 'pie',
            'FECHA' => 'line',
            default => 'bar',
        };
    }
}

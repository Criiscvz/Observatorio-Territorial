<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use Tests\Architecture\DependencyDirection;

final class ArchitectureTest extends TestCase
{
    public function test_existing_domain_and_application_follow_dependency_direction(): void
    {
        // Dataset/Barometer redesign is deferred. This existing dependency
        // must not spread; removing it later also requires removing its entry.
        $exceptions = [
            'Application/Dashboard/UseCases/GetUnivariableStatsUseCase.php' => ['App\\Presentation\\Http\\Requests\\Stats\\StatsRequest'],
            // Existing compatibility PDF adapter; replacing its controller call
            // needs a dedicated download-use-case change and regression tests.
            'Application/Publicaciones/LegacyPublicationBridge.php' => ['App\\Presentation\\Http\\Controllers\\Api\\ObservatorioPublicacionController'],
        ];
        $files = 0;
        foreach (['Domain', 'Application'] as $layer) {
            $directory = dirname(__DIR__, 2).'/app/'.$layer;
            foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS)) as $file) {
                if ($file->getExtension() !== 'php') continue;
                $relative = $layer.'/'.str_replace('\\', '/', substr($file->getPathname(), strlen($directory) + 1));
                $actual = DependencyDirection::violations(file_get_contents($file->getPathname()), $layer);
                self::assertSame($exceptions[$relative] ?? [], $actual, $relative);
                unset($exceptions[$relative]);
                $files++;
            }
        }
        self::assertSame([], $exceptions, 'Remove stale architecture exceptions.');
        self::assertGreaterThan(50, $files, 'Architecture scope unexpectedly empty.');
    }

    public function test_parser_detects_aliases_group_imports_and_fully_qualified_dependencies(): void
    {
        foreach ([
            '<?php use App\\Models\\User as Account; new Account;',
            '<?php use App\\Models\\{User};',
            '<?php function user(\\App\\Models\\User $user): void {}',
            '<?php class Invalid extends \\App\\Models\\User {}',
        ] as $source) {
            self::assertSame(['App\\Models\\User'], DependencyDirection::violations($source, 'Domain'));
        }
    }

    public function test_application_cannot_reintroduce_a_presentation_dependency(): void
    {
        self::assertSame(['App\\Presentation\\Http\\Requests\\Stats\\StatsRequest'], DependencyDirection::violations(
            '<?php \\App\\Presentation\\Http\\Requests\\Stats\\StatsRequest::isChartCompatible();', 'Application'
        ));
    }

    public function test_domain_contracts_and_comments_are_not_false_positives(): void
    {
        self::assertSame([], DependencyDirection::violations(
            '<?php use Illuminate\\Support\\Collection; use App\\Domain\\User\\Entities\\User; // App\\Models\\User', 'Domain'
        ));
    }
}

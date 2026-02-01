<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use OpenApi\Generator;
use OpenApi\Analysers\ReflectionAnalyser;
use OpenApi\Analysers\DocBlockAnnotationFactory;
use OpenApi\Analysers\AttributeAnnotationFactory;

class GenerateSwaggerDocs extends Command
{
    protected $signature = 'swagger:generate';
    protected $description = 'Generate Swagger/OpenAPI documentation';

    public function handle(): int
    {
        $this->info('Generating Swagger documentation...');

        // Suppress warnings temporarily
        $oldErrorLevel = error_reporting(E_ALL & ~E_WARNING & ~E_USER_WARNING);

        try {
            $generator = new Generator();

            // Configure to use ReflectionAnalyser with both DocBlock and Attribute factories
            $analyser = new ReflectionAnalyser([
                new DocBlockAnnotationFactory(),
                new AttributeAnnotationFactory(),
            ]);
            $generator->setAnalyser($analyser);

            $openapi = $generator->generate([
                base_path('app/Http/Controllers'),
                base_path('app/Presentation/Http/Controllers'),
            ]);

            $outputPath = storage_path('api-docs/api-docs.json');

            // Ensure directory exists
            if (!is_dir(dirname($outputPath))) {
                mkdir(dirname($outputPath), 0755, true);
            }

            file_put_contents($outputPath, $openapi->toJson());

            $this->info('Documentation generated successfully at: ' . $outputPath);
            $this->info('Paths found: ' . (isset($openapi->paths) ? count($openapi->paths) : 0));

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Error generating documentation: ' . $e->getMessage());
            return Command::FAILURE;
        } finally {
            // Restore error reporting
            error_reporting($oldErrorLevel);
        }
    }
}

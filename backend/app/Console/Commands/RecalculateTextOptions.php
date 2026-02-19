<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RecalculateTextOptions extends Command
{
    protected $signature = 'variables:recalculate-options {--dataset= : Optional dataset ID to limit scope}';
    protected $description = 'Recalculate opciones for TEXTO variables that have no options set';

    public function handle(): int
    {
        $query = DB::table('variables_metadatos')
            ->where('tipo_dato', 'TEXTO')
            ->whereNull('opciones');

        if ($datasetId = $this->option('dataset')) {
            $query->where('dataset_id', $datasetId);
        }

        $variables = $query->get();
        $this->info("Found {$variables->count()} TEXTO variables to process.");

        $bar = $this->output->createProgressBar($variables->count());
        $bar->start();

        foreach ($variables as $variable) {
            $col = $variable->nombre_columna;

            // Get all text values for this variable
            $values = DB::table('registros_datos')
                ->where('dataset_id', $variable->dataset_id)
                ->whereRaw("data->>? IS NOT NULL AND data->>? != ''", [$col, $col])
                ->selectRaw("data->>? as val", [$col])
                ->pluck('val')
                ->toArray();

            if (empty($values)) {
                $bar->advance();
                continue;
            }

            $uniqueCount = count(array_unique($values));

            $opciones = null;
            if ($uniqueCount <= 100) {
                $opciones = array_values(array_unique($values));
                sort($opciones);
            } else {
                $freq = array_count_values(array_map('strval', $values));
                arsort($freq);
                $opciones = array_values(array_slice(array_keys($freq), 0, 50));
            }

            if ($opciones) {
                DB::table('variables_metadatos')
                    ->where('id', $variable->id)
                    ->update(['opciones' => json_encode($opciones)]);
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info('Done!');

        return Command::SUCCESS;
    }
}

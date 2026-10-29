<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Application\Publicaciones\LegacyPublicationRehearsal;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;
use Throwable;

class RehearseLegacyPublications extends Command
{
    protected $signature = 'publications:rehearse-legacy
        {action=preview : prepare, preview, apply or rollback}
        {--manifest= : Private manifest file, never a URL}
        {--batch= : UUID of the batch to roll back}';
    protected $description = 'Rehearse legacy publication conversion only in explicitly enabled disposable databases';

    public function handle(LegacyPublicationRehearsal $rehearsal): int
    {
        try {
            $rehearsal->assertDisposable();
            $action = $this->argument('action');
            if ($action === 'prepare') { $rehearsal->prepare(); $result = ['prepared' => true]; }
            elseif ($action === 'rollback') { $result = $rehearsal->rollback((string) $this->option('batch')); }
            elseif (in_array($action, ['preview', 'apply'], true)) {
                $file = (string) $this->option('manifest');
                if (str_contains($file, '://') || str_starts_with($file, '\\\\') || str_starts_with($file, '//')
                    || ! is_file($file) || is_link($file) || filesize($file) > 1024 * 1024) {
                    $this->error('A private local manifest of at most 1 MB is required.'); return self::FAILURE;
                }
                $manifest = json_decode(file_get_contents($file), true, 64, JSON_THROW_ON_ERROR);
                $result = $rehearsal->{$action}($manifest);
            } else { $this->error('Unknown rehearsal action.'); return self::FAILURE; }
            // Only counters/blocker codes and fixture IDs are printed; no source snapshots.
            $this->line(json_encode($result, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
            return isset($result['ready']) && ! $result['ready'] ? self::FAILURE : self::SUCCESS;
        } catch (ValidationException) {
            $this->error('Invalid rehearsal manifest; values suppressed.');
        } catch (Throwable) {
            $this->error('Rehearsal blocked or failed. No raw manifest, source values or credentials are printed.');
        }
        return self::FAILURE;
    }
}

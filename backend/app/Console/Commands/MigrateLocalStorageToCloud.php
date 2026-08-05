<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

class MigrateLocalStorageToCloud extends Command
{
    protected $signature = 'storage:migrate-local
        {source : Absolute or relative directory containing legacy files}
        {--prefix= : Prefix to add to uploaded object keys}
        {--dry-run : List files without uploading them}';

    protected $description = 'Copies legacy local files to the configured persistent filesystem disk.';

    public function handle(): int
    {
        $source = base_path($this->argument('source'));
        $prefix = trim((string) $this->option('prefix'), '/');

        if (! is_dir($source)) {
            $this->error("Directory does not exist: {$source}");
            return self::FAILURE;
        }

        $disk = Storage::disk(config('filesystems.default'));
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($source));

        foreach ($files as $file) {
            /** @var SplFileInfo $file */
            if (! $file->isFile()) {
                continue;
            }

            $relativePath = ltrim(str_replace('\\', '/', substr($file->getPathname(), strlen($source))), '/');
            $destination = ltrim($prefix.'/'.$relativePath, '/');
            $this->line(($this->option('dry-run') ? '[dry-run] ' : '').$destination);

            if (! $this->option('dry-run')) {
                $stream = fopen($file->getPathname(), 'rb');
                $disk->writeStream($destination, $stream);
                fclose($stream);
            }
        }

        return self::SUCCESS;
    }
}

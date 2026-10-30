<?php

namespace Tests\Feature;

use App\Infrastructure\Services\PublicationPdfStorage;
use App\Infrastructure\Services\SharePointService;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\FilesystemOperator;
use Tests\TestCase;

class PublicationPdfStorageTest extends TestCase
{
    public function test_store_and_read_use_the_configured_private_disk_and_unique_pdf_names(): void
    {
        config(['filesystems.default' => 'local']); Storage::fake('local');
        $storage = app(PublicationPdfStorage::class);
        $one = $storage->storeUploaded(UploadedFile::fake()->createWithContent('same.pdf', '%PDF-1.7 synthetic'), 'publicaciones/synthetic');
        $two = $storage->storeUploaded(UploadedFile::fake()->createWithContent('same.pdf', '%PDF-1.7 second'), 'publicaciones/synthetic');
        $this->assertNotSame($one, $two); $this->assertStringEndsWith('.pdf', $one);
        $stream = $storage->readStream($one);
        try { $this->assertSame('%PDF-1.7 synthetic', stream_get_contents($stream)); }
        finally { fclose($stream); }
        $storage->discard($two); Storage::assertExists($one); Storage::assertMissing($two);
    }

    public function test_sharepoint_temporary_file_is_removed_even_when_writing_fails(): void
    {
        config(['filesystems.default' => 'synthetic-s3', 'filesystems.disks.synthetic-s3.driver' => 's3']);
        Log::spy(); $temporary = tempnam(sys_get_temp_dir(), 'pdf-storage-test-');
        file_put_contents($temporary, '%PDF-1.7 synthetic');
        $provider = $this->mock(SharePointService::class);
        $provider->shouldReceive('downloadPdf')->once()->with('synthetic')->andReturn($temporary);
        $driver = \Mockery::mock(FilesystemOperator::class); $writtenStream = null; $writtenPath = null;
        $driver->shouldReceive('writeStream')->once()->andReturnUsing(function ($path, $stream) use (&$writtenStream, &$writtenPath) {
            $writtenStream = $stream; $writtenPath = $path;
            throw new \RuntimeException('synthetic-private-provider-diagnostic');
        });
        $disk = \Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('getDriver')->once()->andReturn($driver);
        $disk->shouldReceive('delete')->once()->with(\Mockery::on(function ($path) use (&$writtenPath) { return $path === $writtenPath; }))->andReturn(true);
        Storage::shouldReceive('disk')->with('synthetic-s3')->andReturn($disk);
        try {
            app(PublicationPdfStorage::class)->copyFromSharePoint(['id' => 'synthetic', 'name' => 'synthetic.pdf', 'size' => 100], 'synthetic');
            $this->fail('Expected storage failure.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e) {
            $this->assertSame(503, $e->getStatusCode());
            $this->assertStringNotContainsString('private-provider', $e->getMessage());
        } finally {
            $this->assertFileDoesNotExist($temporary);
            if (is_file($temporary)) unlink($temporary);
        }
        $this->assertFalse(is_resource($writtenStream));
        Log::shouldHaveReceived('error')->with('ATLAS_STORAGE_WRITE_FAILED', \Mockery::on(fn ($context) =>
            ! str_contains(json_encode($context), 'private-provider') && ! isset($context['message'])))->once();
    }

    public function test_storage_outage_is_not_a_missing_file_and_diagnostics_are_redacted(): void
    {
        config(['filesystems.default' => 'synthetic-s3']); Log::spy();
        $driver = \Mockery::mock(FilesystemOperator::class);
        $driver->shouldReceive('readStream')->once()->with('private.pdf')->andThrow(new \RuntimeException('synthetic-private-read-diagnostic'));
        $disk = \Mockery::mock(FilesystemAdapter::class); $disk->shouldReceive('getDriver')->once()->andReturn($driver);
        Storage::shouldReceive('disk')->with('synthetic-s3')->andReturn($disk);
        try {
            app(PublicationPdfStorage::class)->readStream('private.pdf'); $this->fail('Expected outage.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e) {
            $this->assertSame(503, $e->getStatusCode());
            $this->assertStringNotContainsString('private-read', $e->getMessage());
        }
        Log::shouldHaveReceived('error')->with('ATLAS_STORAGE_READ_FAILED', \Mockery::on(fn ($context) =>
            ! str_contains(json_encode($context), 'private-read') && ! isset($context['path'])))->once();
    }

    public function test_cleanup_failure_does_not_mask_the_original_operation_error(): void
    {
        config(['filesystems.default' => 'synthetic']); Log::spy();
        $disk = \Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('delete')->once()->with('uncommitted.pdf')->andThrow(new \RuntimeException('synthetic-private-delete-diagnostic'));
        Storage::shouldReceive('disk')->with('synthetic')->andReturn($disk);
        app(PublicationPdfStorage::class)->discard('uncommitted.pdf');
        Log::shouldHaveReceived('warning')->with('PUBLICATION_PDF_CLEANUP_FAILED', ['exception' => \RuntimeException::class])->once();
        $this->assertTrue(true);
    }

    public function test_oversize_sharepoint_metadata_rejects_before_downloading(): void
    {
        $this->mock(SharePointService::class)->shouldNotReceive('downloadPdf');
        $this->expectException(\RuntimeException::class);
        app(PublicationPdfStorage::class)->copyFromSharePoint(['id' => 'large', 'size' => 20 * 1024 * 1024 + 1], 'synthetic');
    }

    public function test_required_deletion_rejects_unconfirmed_storage_removal(): void
    {
        config(['filesystems.default' => 'synthetic']);
        $disk = \Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('exists')->once()->with('retained.pdf')->andReturn(true);
        $disk->shouldReceive('delete')->once()->with('retained.pdf')->andReturn(false);
        Storage::shouldReceive('disk')->with('synthetic')->andReturn($disk);
        try {
            app(PublicationPdfStorage::class)->deleteStored('retained.pdf'); $this->fail('Unconfirmed removal accepted.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e) { $this->assertSame(503, $e->getStatusCode()); }
    }
}

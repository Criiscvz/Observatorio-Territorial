param(
    [ValidateSet('all', 'sqlite', 'postgres')]
    [string]$Suite = 'all',
    [string]$PhpImage = 'observatorio-backend-atlas:test',
    [ValidateSet('/atlas', '/app', '/var/www/html')]
    [string]$PhpWorkdir = '/atlas',
    [string]$PostgresImage = 'postgres:16-alpine'
)

$ErrorActionPreference = 'Stop'
$securityRepoPath = Split-Path -Parent $PSScriptRoot
$securityBackendPath = (Resolve-Path -LiteralPath (Join-Path $securityRepoPath 'backend')).Path.Replace('\', '/')
$securityLockHash = (Get-FileHash -LiteralPath (Join-Path $securityBackendPath 'composer.lock') -Algorithm SHA256).Hash.ToLowerInvariant()

# Never build/pull, execute the deployment entrypoint, or mount .env / user data.
$securityImageHash = & docker run --rm --pull never --network none --entrypoint sha256sum $PhpImage "$PhpWorkdir/composer.lock"
if ($LASTEXITCODE -ne 0 -or ($securityImageHash -split '\s+')[0] -ne $securityLockHash) {
    throw 'The existing test image must contain vendor dependencies matching backend/composer.lock.'
}

function Invoke-IsolatedBackendTests {
    param([string]$NetworkMode, [string[]]$Environment = @(), [string]$Filter = '')

    $securityDockerArgs = @(
        'run', '--rm', '--pull', 'never', '--network', $NetworkMode,
        '--entrypoint', 'sh', '--workdir', $PhpWorkdir,
        '--tmpfs', "$PhpWorkdir/storage", '--tmpfs', "$PhpWorkdir/bootstrap/cache"
    )
    foreach ($securityEntry in $Environment) {
        $securityDockerArgs += @('-e', $securityEntry)
    }
    foreach ($securityFolder in @('app', 'bootstrap', 'config', 'database', 'resources', 'routes', 'tests')) {
        $securityDockerArgs += @('--mount', "type=bind,source=$securityBackendPath/$securityFolder,target=$PhpWorkdir/$securityFolder,readonly")
    }
    foreach ($securityFile in @('artisan', 'phpunit.xml', 'composer.json', 'composer.lock')) {
        $securityDockerArgs += @('--mount', "type=bind,source=$securityBackendPath/$securityFile,target=$PhpWorkdir/$securityFile,readonly")
    }
    $securityCommand = 'if test -f .env || test -f .env.testing; then echo "Refusing a test image containing an environment file"; exit 1; fi; mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache && php vendor/bin/phpunit --no-progress'
    if ($Filter) {
        $securityCommand += ' --filter "' + $Filter + '"'
    }
    $securityDockerArgs += @($PhpImage, '-c', $securityCommand)
    & docker @securityDockerArgs
    if ($LASTEXITCODE -ne 0) {
        throw 'The isolated backend suite failed.'
    }
}

if ($Suite -in @('all', 'sqlite')) {
    Invoke-IsolatedBackendTests -NetworkMode 'none'
}

if ($Suite -in @('all', 'postgres')) {
    $securityDatabaseName = 'observatorio-jsonb-test-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
    $securityDatabaseId = $null
    try {
        # The database has only loopback networking, tmpfs data, and synthetic credentials.
        $securityDatabaseId = & docker run --detach --rm --pull never --name $securityDatabaseName --network none --tmpfs /var/lib/postgresql/data:rw,nosuid,size=256m --memory 512m -e POSTGRES_DB=observatorio_jsonb_test -e POSTGRES_USER=jsonb_test -e POSTGRES_PASSWORD=synthetic-disposable-jsonb-test-only $PostgresImage
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not create the disposable PostgreSQL instance.'
        }
        $securityDatabaseId = $securityDatabaseId.Trim()
        if ($securityDatabaseId -notmatch '^[a-f0-9]{64}$') {
            throw 'Unexpected disposable container identity.'
        }

        $securityDatabaseReady = $false
        for ($securityAttempt = 0; $securityAttempt -lt 30; $securityAttempt++) {
            & docker exec $securityDatabaseId pg_isready -q -h 127.0.0.1 -U jsonb_test -d observatorio_jsonb_test
            if ($LASTEXITCODE -eq 0) {
                $securityDatabaseReady = $true
                break
            }
            Start-Sleep -Seconds 1
        }
        if (-not $securityDatabaseReady) {
            throw 'Disposable PostgreSQL did not become ready.'
        }

        Invoke-IsolatedBackendTests -NetworkMode "container:$securityDatabaseId" -Environment @(
            'TEST_DB_CONNECTION=pgsql', 'TEST_DB_HOST=127.0.0.1',
            'TEST_DB_DATABASE=observatorio_jsonb_test', 'TEST_DB_USERNAME=jsonb_test',
            'TEST_DB_PASSWORD=synthetic-disposable-jsonb-test-only'
        ) -Filter 'RegistroDatoPostgresTest|EloquentRegistroDatoRepositoryTest|TestDatabaseIsolationTest|PublicPublicationCatalogTest|LegacyPublicationRehearsalTest|LegacyPublicationBridgeTest|PublicationLibraryPaginationTest|PublicationCapabilitiesTest|PublicationReviewWorkflowTest|SharePointPublicationImporterTest|PublicationPdfStorageTest|SharePointArticleImportTest|PublicationPdfReaderTest'
    } finally {
        if ($securityDatabaseId -match '^[a-f0-9]{64}$') {
            # --rm removes only the exact disposable container started by this run.
            & docker stop --timeout 5 $securityDatabaseId | Out-Null
        }
    }
}

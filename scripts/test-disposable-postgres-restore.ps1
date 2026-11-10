param([string]$PostgresImage = 'postgres:16-alpine')

$ErrorActionPreference = 'Stop'
$restoreProbeName = 'observatorio-restore-test-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
$restoreProbeId = $null

function Assert-ProbeCommand {
    if ($LASTEXITCODE -ne 0) { throw 'The disposable backup/restore check failed.' }
}

try {
    # Only synthetic records. No host volumes, published ports, external network or application .env.
    $restoreProbeId = & docker run --detach --rm --pull never --name $restoreProbeName --network none --tmpfs /var/lib/postgresql/data:rw,nosuid,size=256m --memory 512m -e POSTGRES_DB=restore_source_test -e POSTGRES_USER=restore_test -e POSTGRES_PASSWORD=synthetic-disposable-restore-only $PostgresImage
    Assert-ProbeCommand
    $restoreProbeId = $restoreProbeId.Trim()
    if ($restoreProbeId -notmatch '^[a-f0-9]{64}$') { throw 'Unexpected disposable container identity.' }

    $restoreProbeReady = $false
    for ($restoreAttempt = 0; $restoreAttempt -lt 30; $restoreAttempt++) {
        & docker exec $restoreProbeId pg_isready -q -h 127.0.0.1 -U restore_test -d restore_source_test
        if ($LASTEXITCODE -eq 0) { $restoreProbeReady = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $restoreProbeReady) { throw 'Disposable PostgreSQL did not become ready.' }

    $restoreFixture = @'
CREATE SCHEMA restore_probe;
CREATE TABLE restore_probe.observatories (id integer PRIMARY KEY, name text NOT NULL);
CREATE TABLE restore_probe.publications (
  id integer PRIMARY KEY,
  observatory_id integer NOT NULL REFERENCES restore_probe.observatories(id),
  status text NOT NULL CHECK (status IN ('PUBLICADO', 'RECHAZADO')),
  review_reason text,
  metadata jsonb NOT NULL
);
CREATE INDEX publications_observatory_idx ON restore_probe.publications(observatory_id);
INSERT INTO restore_probe.observatories VALUES (1, 'Synthetic observatory');
INSERT INTO restore_probe.publications VALUES
 (1, 1, 'PUBLICADO', NULL, '{"pdf":"synthetic.pdf","subscriber_only":true}'),
 (2, 1, 'RECHAZADO', 'Synthetic review reason', '{"source":"synthetic","authors":["Test author"]}');
'@
    $restoreFixture | & docker exec -i $restoreProbeId psql -U restore_test -d restore_source_test -v ON_ERROR_STOP=1 -q
    Assert-ProbeCommand
    & docker exec $restoreProbeId pg_dump -U restore_test -d restore_source_test -Fc -f /tmp/restore-probe.dump
    Assert-ProbeCommand
    & docker exec $restoreProbeId createdb -U restore_test restore_destination_test
    Assert-ProbeCommand
    & docker exec $restoreProbeId pg_restore -U restore_test -d restore_destination_test --exit-on-error --no-owner --no-privileges /tmp/restore-probe.dump
    Assert-ProbeCommand

    $restoreVerification = @'
DO $$
BEGIN
 IF (SELECT count(*) FROM restore_probe.observatories) <> 1
    OR (SELECT count(*) FROM restore_probe.publications) <> 2 THEN
   RAISE EXCEPTION 'Record counts were not preserved';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM restore_probe.publications WHERE id=1 AND review_reason IS NULL
                AND metadata->>'pdf'='synthetic.pdf' AND metadata->>'subscriber_only'='true')
    OR NOT EXISTS (SELECT 1 FROM restore_probe.publications WHERE id=2 AND status='RECHAZADO'
                   AND review_reason='Synthetic review reason' AND metadata->'authors'->>0='Test author') THEN
   RAISE EXCEPTION 'Publication fields were not preserved';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='restore_probe.publications'::regclass AND contype='f')
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='restore_probe.publications'::regclass AND contype='c')
    OR to_regclass('restore_probe.publications_observatory_idx') IS NULL THEN
   RAISE EXCEPTION 'Constraints or indexes were not preserved';
 END IF;
END $$;
'@
    $restoreVerification | & docker exec -i $restoreProbeId psql -U restore_test -d restore_destination_test -v ON_ERROR_STOP=1 -q
    Assert-ProbeCommand
    Write-Output 'PASS: synthetic PostgreSQL backup/restore preserved records, JSONB, review reason, nulls, foreign key, check constraint and index.'
    Write-Output 'Scope: disposable fixture only; this does not certify application-schema or production-backup recovery.'
} finally {
    if ($restoreProbeId -match '^[a-f0-9]{64}$') {
        & docker stop --timeout 5 $restoreProbeId | Out-Null
    }
}

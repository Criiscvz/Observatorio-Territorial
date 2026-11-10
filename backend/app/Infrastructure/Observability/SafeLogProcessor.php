<?php

declare(strict_types=1);

namespace App\Infrastructure\Observability;

use Monolog\LogRecord;

/** Positive schema: unknown messages/fields and Throwable contents never reach a sink. */
final class SafeLogProcessor
{
    private const EVENTS = [
        'HTTP_REQUEST_COMPLETED', 'OTEL_SPAN', 'APPLICATION_EXCEPTION', 'APPLICATION_LOG',
        'PUBLICATION_PDF_DELETE_FAILED', 'PUBLICATION_PDF_CLEANUP_UNCONFIRMED', 'PUBLICATION_PDF_CLEANUP_FAILED',
        'ATLAS_STORAGE_READ_FAILED', 'ATLAS_STORAGE_WRITE_FAILED', 'ATLAS_STORAGE_WRITE_UNCONFIRMED',
    ];
    private const MESSAGES = [
        'Verification email delivery failed.' => 'AUTH_VERIFICATION_DELIVERY_FAILED',
        'Verification email resend failed.' => 'AUTH_VERIFICATION_RESEND_FAILED',
        'Google OAuth could not start.' => 'AUTH_OAUTH_START_FAILED',
        'Google OAuth callback failed.' => 'AUTH_OAUTH_CALLBACK_FAILED',
        'SharePoint publication import failed' => 'SHAREPOINT_IMPORT_FAILED',
    ];

    public function __invoke(LogRecord $record): LogRecord
    {
        $correlation = app()->bound(RequestTelemetry::class) ? app(RequestTelemetry::class)->correlation() : [];
        $message = in_array($record->message, self::EVENTS, true) ? $record->message
            : (self::MESSAGES[$record->message] ?? 'APPLICATION_LOG');
        $input = in_array($record->message, ['HTTP_REQUEST_COMPLETED','OTEL_SPAN'], true) ? $record->context
            : array_intersect_key($record->context, array_flip(['exception','tipo','disk','s3_code','s3_status']));
        return $record->with(message: $message, context: self::context($input + $correlation), extra: []);
    }

    public static function context(array $input): array
    {
        $output = [];
        foreach (['request_id' => '/^[0-9a-f-]{36}$/D', 'trace_id' => '/^[0-9a-f]{32}$/D',
            'span_id' => '/^[0-9a-f]{16}$/D', 'parent_span_id' => '/^[0-9a-f]{16}$/D',
            'release' => '/^[0-9a-f]{7,40}$/D'] as $key => $pattern) {
            if (isset($input[$key]) && is_string($input[$key]) && preg_match($pattern, $input[$key])) $output[$key] = $input[$key];
        }
        foreach (['duration_ms', 'db_duration_ms', 'http_duration_ms'] as $key) {
            if (isset($input[$key]) && is_numeric($input[$key]) && is_finite((float) $input[$key])) $output[$key] = round(max(0, min(3600000, (float) $input[$key])), 3);
        }
        foreach (['db_count', 'http_count', 'dropped_spans'] as $key) {
            if (isset($input[$key]) && is_int($input[$key])) $output[$key] = max(0, min(1000000, $input[$key]));
        }
        foreach (['status', 's3_status'] as $key) {
            if (isset($input[$key]) && is_int($input[$key]) && $input[$key] >= 100 && $input[$key] <= 599) $output[$key] = $input[$key];
        }
        foreach (['sampled', 'slow'] as $key) if (isset($input[$key]) && is_bool($input[$key])) $output[$key] = $input[$key];
        foreach (['method' => ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS','OTHER'],
            'component' => ['server','database','http_client'], 'operation' => ['SELECT','INSERT','UPDATE','DELETE','BEGIN','COMMIT','ROLLBACK','OTHER','find','insert','update','delete','aggregate','count','distinct','ping','getMore','findAndModify','bulkWrite'],
            'db_system' => ['postgresql','sqlite','mysql','mongodb','other'], 'target' => ['microsoft_graph','microsoft_identity'],
            'span_status' => ['Unset','Ok','Error'], 'tipo' => ['ARTICULO','LIBRO','REPORTE','ATLAS'],
            'disk' => ['local','public','s3','supabase'],
            's3_code' => ['AccessDenied','NoSuchKey','NoSuchBucket','InvalidAccessKeyId','SignatureDoesNotMatch','ExpiredToken','SlowDown','ServiceUnavailable','Unknown']] as $key => $values) {
            if (isset($input[$key]) && in_array($input[$key], $values, true)) $output[$key] = $input[$key];
        }
        // Route templates are supplied exclusively from the resolved Route, never URL/path/query/header input.
        if (isset($input['route']) && is_string($input['route']) && preg_match('/^[a-zA-Z0-9_{}?\/.-]{1,180}$/D', $input['route'])) $output['route'] = $input['route'];
        if (isset($input['exception'])) {
            $class = $input['exception'] instanceof \Throwable ? $input['exception']::class : $input['exception'];
            if (is_string($class) && preg_match('/^[a-zA-Z_\\\\][a-zA-Z0-9_\\\\]{0,180}$/D', $class)) $output['exception'] = $class;
        }
        return $output;
    }
}

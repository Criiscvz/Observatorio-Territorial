<?php

return [
    'enabled' => (bool) env('OBSERVABILITY_ENABLED', true),
    'sample_rate' => (float) env('OBSERVABILITY_SAMPLE_RATE', 0.1),
    'slow_request_ms' => (int) env('OBSERVABILITY_SLOW_REQUEST_MS', 1500),
    // A commit hash only; never copy arbitrary deployment metadata into logs.
    'release' => env('OBSERVABILITY_RELEASE', ''),
];

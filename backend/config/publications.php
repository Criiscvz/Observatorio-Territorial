<?php

return [
    // Temporary rehearsal commands also require APP_ENV=testing and a disposable DB.
    'legacy_rehearsal_enabled' => env('LEGACY_PUBLICATION_REHEARSAL_ENABLED', false),
];

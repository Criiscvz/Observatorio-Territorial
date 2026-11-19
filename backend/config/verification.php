<?php

return [
    'required' => env('EMAIL_VERIFICATION_REQUIRED', true) !== false,
    'delivery' => env('VERIFICATION_DELIVERY', 'mail'),
    'relay_url' => env('VERIFICATION_RELAY_URL'),
    'relay_secret' => env('VERIFICATION_RELAY_SECRET'),
];

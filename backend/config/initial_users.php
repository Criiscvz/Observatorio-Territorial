<?php

return [
    // No default credentials. Only the explicit CLI seeder consumes this list.
    // Keep env() here so the values survive Laravel's config:cache.
    'users' => [
        [
            'name' => env('ADMIN_NAME'),
            'email' => env('ADMIN_EMAIL'),
            'password' => env('ADMIN_PASSWORD'),
            'rol' => 'ADMIN',
        ],
        [
            'name' => env('INITIAL_USER_NAME'),
            'email' => env('INITIAL_USER_EMAIL'),
            'password' => env('INITIAL_USER_PASSWORD'),
            'rol' => 'USER',
        ],
        [
            'name' => env('SUBSCRIBER_NAME'),
            'email' => env('SUBSCRIBER_EMAIL'),
            'password' => env('SUBSCRIBER_PASSWORD'),
            'rol' => 'SUBSCRIBER',
        ],
    ],
];

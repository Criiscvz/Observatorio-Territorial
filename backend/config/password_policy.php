<?php

declare(strict_types=1);

$source = file_get_contents(__DIR__.'/../resources/security/password-policy.json');
if ($source === false) {
    throw new RuntimeException('Password policy data is required.');
}

return json_decode($source, true, 512, JSON_THROW_ON_ERROR);

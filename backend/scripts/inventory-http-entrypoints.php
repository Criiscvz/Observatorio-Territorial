<?php

declare(strict_types=1);

// Read-only route metadata. Run in the isolated testing environment, never from HTTP.
if (PHP_SAPI !== 'cli') exit(1);
$base = dirname(__DIR__);
require $base.'/vendor/autoload.php';
$app = require $base.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$rows = [];
foreach (Illuminate\Support\Facades\Route::getRoutes() as $route) {
    $action = $route->getActionName();
    $uses = $route->getAction('uses');
    $reflection = $uses instanceof Closure ? new ReflectionFunction($uses) : null;
    if ($reflection === null && str_contains($action, '@')) {
        [$class, $method] = explode('@', $action, 2);
        $reflection = new ReflectionMethod($class, $method);
    }
    $requests = []; $parameters = [];
    foreach ($reflection?->getParameters() ?? [] as $parameter) {
        $type = $parameter->getType();
        $parameters[$parameter->getName()] = $type ? (string) $type : 'mixed';
        if ($type instanceof ReflectionNamedType && ! $type->isBuiltin()
            && is_a($type->getName(), Illuminate\Foundation\Http\FormRequest::class, true)) $requests[] = $type->getName();
    }
    $source = $reflection?->getFileName();
    $source = $source ? str_replace('\\', '/', substr($source, strlen($base) + 1)) : null;
    $methods = array_values(array_diff($route->methods(), ['HEAD']));
    if ($methods === []) $methods = ['HEAD'];
    $constraints = $route->wheres; ksort($constraints);
    $rows[] = ['methods' => $methods, 'uri' => $route->uri(), 'action' => $action,
        'source' => $source, 'form_requests' => $requests, 'parameters' => $parameters,
        'constraints' => (object) $constraints, 'middleware' => $route->gatherMiddleware()];
}
usort($rows, fn ($a, $b) => [$a['uri'], implode('|', $a['methods'])] <=> [$b['uri'], implode('|', $b['methods'])]);
echo json_encode(['schema' => 1, 'scope' => 'Laravel registered routes; metadata only, not a validation coverage percentage',
    'routes' => $rows], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR).PHP_EOL;

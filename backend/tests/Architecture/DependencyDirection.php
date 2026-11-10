<?php

declare(strict_types=1);

namespace Tests\Architecture;

use PhpParser\Node;
use PhpParser\NodeFinder;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitor\NameResolver;
use PhpParser\ParserFactory;

/** Static only: never boot Laravel or resolve application dependencies. */
final class DependencyDirection
{
    /** @return list<string> */
    public static function violations(string $source, string $layer): array
    {
        $nodes = (new ParserFactory)->createForNewestSupportedVersion()->parse($source) ?? [];
        $traverser = new NodeTraverser;
        $traverser->addVisitor(new NameResolver);
        $nodes = $traverser->traverse($nodes);
        $finder = new NodeFinder;
        $dependencies = [];
        foreach ($finder->findInstanceOf($nodes, Node\Stmt\GroupUse::class) as $group) {
            foreach ($group->uses as $use) {
                $dependencies[] = $group->prefix->toString().'\\'.$use->name->toString();
            }
        }
        foreach ($finder->findInstanceOf($nodes, Node\UseItem::class) as $use) {
            $dependencies[] = $use->name->toString();
        }
        foreach ($finder->findInstanceOf($nodes, Node\Name\FullyQualified::class) as $name) {
            $dependencies[] = $name->toString();
        }
        $forbidden = $layer === 'Domain'
            ? ['App\\Application\\', 'App\\Infrastructure\\', 'App\\Presentation\\', 'App\\Models\\', 'App\\Policies\\', 'Illuminate\\Http\\', 'Illuminate\\Database\\', 'Illuminate\\Support\\Facades\\']
            : ['App\\Presentation\\'];
        $violations = array_filter($dependencies, static function (string $dependency) use ($forbidden): bool {
            foreach ($forbidden as $prefix) {
                if (str_starts_with(strtolower($dependency), strtolower($prefix))) {
                    return true;
                }
            }
            return false;
        });
        $violations = array_values(array_unique($violations));
        sort($violations);
        return $violations;
    }
}

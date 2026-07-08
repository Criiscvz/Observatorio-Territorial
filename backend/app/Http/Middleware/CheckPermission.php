<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Permiso\Repositories\PermisoRepositoryInterface;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    public function __construct(
        private readonly PermisoRepositoryInterface $permisoRepository
    ) {}

    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  $modulo   El módulo a validar ('atlas', 'reportes', 'observatorios')
     * @param  string  $nivelRequerido   Nivel mínimo requerido ('lectura', 'escritura', 'admin')
     */
    public function handle(Request $request, Closure $next, string $modulo, string $nivelRequerido): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        // El rol ADMIN global tiene acceso total por defecto
        if ($user->rol === 'ADMIN') {
            return $next($request);
        }

        // Pesos de los niveles de permisos
        $pesos = [
            'ninguno' => 0,
            'lectura' => 1,
            'escritura' => 2,
            'admin' => 3,
        ];

        $pesoRequerido = $pesos[$nivelRequerido] ?? 0;

        // Intentar obtener el ID del departamento si aplica
        $departamentoId = $request->route('departamento') ?? $request->route('id');

        // Si no es un UUID válido (por ejemplo, id numérico de artículo o usuario), ignorar
        if ($departamentoId && !preg_match('/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i', (string)$departamentoId)) {
            $departamentoId = null;
        }

        // Buscar permiso del usuario para el módulo específico
        $permisos = $this->permisoRepository->findByUserId($user->id);

        $nivelUsuario = 'ninguno';

        // 1. Si es módulo 'observatorios' y tenemos un departamento específico
        if ($modulo === 'observatorios' && $departamentoId) {
            $permisoEspecifico = $permisos->first(function ($p) use ($departamentoId) {
                return $p->modulo === 'observatorios' && $p->departamentoId === $departamentoId;
            });
            if ($permisoEspecifico) {
                $nivelUsuario = $permisoEspecifico->nivel;
            } else {
                // Fallback a permiso genérico (sin departamento_id o null)
                $permisoGenerico = $permisos->first(function ($p) {
                    return $p->modulo === 'observatorios' && ($p->departamentoId === null || $p->departamentoId === 'all');
                });
                if ($permisoGenerico) {
                    $nivelUsuario = $permisoGenerico->nivel;
                }
            }
        } else {
            // Permiso genérico para atlas, reportes o si no hay departamento_id
            $permisoGenerico = $permisos->first(function ($p) use ($modulo) {
                return $p->modulo === $modulo;
            });
            if ($permisoGenerico) {
                $nivelUsuario = $permisoGenerico->nivel;
            }
        }

        $pesoUsuario = $pesos[$nivelUsuario] ?? 0;

        if ($pesoUsuario >= $pesoRequerido) {
            return $next($request);
        }

        return response()->json([
            'message' => 'No tienes permisos para acceder a este recurso.',
            'modulo' => $modulo,
            'nivel_requerido' => $nivelRequerido,
            'nivel_usuario' => $nivelUsuario,
        ], 403);
    }
}

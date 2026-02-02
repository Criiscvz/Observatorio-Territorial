import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Rutas estáticas que se pueden pre-renderizar
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'auth/**',
    renderMode: RenderMode.Server,
  },
  {
    path: 'perfil',
    renderMode: RenderMode.Server,
  },
  // Rutas públicas con parámetros dinámicos - usar Server rendering
  {
    path: 'publico/departamentos',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'publico/departamentos/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: 'publico/datasets/:id',
    renderMode: RenderMode.Server,
  },
  // Rutas admin - siempre Server rendering (requieren auth)
  {
    path: 'admin/**',
    renderMode: RenderMode.Server,
  },
  // Fallback para cualquier otra ruta
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];

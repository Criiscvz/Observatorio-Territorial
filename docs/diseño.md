# Sistema de Diseño - Observatorio ULEAM

Este documento describe el sistema de diseño implementado en el Observatorio de Datos ULEAM, basado en una estética **Glassmorphism + Neo-SaaS** con soporte completo para temas claro y oscuro.

---

## 1. Paleta de Colores

### Tokens CSS Personalizados

El sistema utiliza variables CSS para facilitar el cambio de temas y la consistencia visual.

```css
:root {
  /* Colores de marca ULEAM */
  --uleam-red: #C8102E;
  --uleam-red-light: #E8354F;
  --uleam-red-dark: #A00D25;
  
  /* Colores primarios (Indigo) */
  --primary-50: #EEF2FF;
  --primary-100: #E0E7FF;
  --primary-500: #6366F1;
  --primary-600: #4F46E5;
  --primary-700: #4338CA;
  
  /* Superficies */
  --bg-primary: #F9FAFB;      /* Fondo principal */
  --bg-secondary: #FFFFFF;    /* Cards, paneles */
  --bg-tertiary: #F3F4F6;     /* Hover, inputs */
  --card-bg: #FFFFFF;
  
  /* Textos */
  --text-primary: #111827;
  --text-secondary: #6B7280;
  --text-tertiary: #9CA3AF;
  
  /* Bordes */
  --border-color: #E5E7EB;
  --border-hover: #D1D5DB;
}
```

### Tema Oscuro

```css
.dark {
  --bg-primary: #0F172A;
  --bg-secondary: #1E293B;
  --bg-tertiary: #334155;
  --card-bg: #1E293B;
  --text-primary: #F9FAFB;
  --text-secondary: #9CA3AF;
  --text-tertiary: #6B7280;
  --border-color: #334155;
}
```

### Paleta de Colores para Componentes

| Color | Light Mode | Dark Mode | Uso |
|-------|------------|-----------|-----|
| Purple | `#6366F1` | `#818CF8` | Primario, CTAs |
| Pink | `#EC4899` | `#F472B6` | Accent, alertas |
| Teal | `#14B8A6` | `#2DD4BF` | Éxito, datos |
| Orange | `#F59E0B` | `#FBBF24` | Warnings |
| Red | `#EF4444` | `#F87171` | Errors, ULEAM |

---

## 2. Sistema de Temas

### ThemeService

El servicio `ThemeService` gestiona el tema de la aplicación:

```typescript
import { ThemeService } from './core/services/theme.service';

// Inyectar el servicio
themeService = inject(ThemeService);

// Alternar tema
themeService.toggleTheme();

// Verificar tema actual
themeService.isDark(); // true | false

// Establecer tema específico
themeService.setTheme('dark');
```

### Toggle de Tema en Header

El header incluye un botón para cambiar entre temas:

```html
<button (click)="themeService.toggleTheme()">
  <mat-icon>
    {{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}
  </mat-icon>
</button>
```

---

## 3. Tipografía

### Jerarquía de Encabezados

```css
h1 { font-size: 2.25rem; font-weight: 700; letter-spacing: -0.025em; }
h2 { font-size: 1.875rem; font-weight: 700; }
h3 { font-size: 1.5rem; font-weight: 600; }
h4 { font-size: 1.25rem; font-weight: 600; }
h5 { font-size: 1.125rem; font-weight: 500; }
h6 { font-size: 1rem; font-weight: 500; }
```

### Fuente

- **Principal**: Inter, system-ui, -apple-system, sans-serif
- **Monospace**: Para código y datos técnicos

---

## 4. Componentes UI

### Cards

```html
<div class="card-base card-interactive">
  <!-- Contenido -->
</div>
```

Clases disponibles:
- `.card-base`: Estilos base de card
- `.card-interactive`: Efectos hover
- `.hover-lift`: Efecto de elevación al hover

### Stat Cards

Tarjetas para mostrar KPIs:

```html
<div class="stat-card" [style.--accent-color]="'99, 102, 241'">
  <div class="stat-icon">
    <mat-icon>analytics</mat-icon>
  </div>
  <div class="stat-content">
    <span class="stat-label">Total</span>
    <span class="stat-value">1,234</span>
  </div>
</div>
```

### Botones

```html
<!-- Primario (gradiente) -->
<button class="action-btn primary">
  <mat-icon>add</mat-icon>
  <span>Crear</span>
</button>

<!-- Secundario (borde) -->
<button class="action-btn secondary">
  <mat-icon>upload</mat-icon>
  <span>Importar</span>
</button>
```

### Badges

```html
<span class="badge success">Completado</span>
<span class="badge warning">Procesando</span>
<span class="badge error">Error</span>
<span class="badge info">Pendiente</span>
```

---

## 5. Layout

### Estructura Principal

```
┌─────────────────────────────────────────────────┐
│ Header (64px, sticky)                           │
│ - Logo + Brand                                  │
│ - Theme Toggle                                  │
│ - User Menu                                     │
├─────────────┬───────────────────────────────────┤
│             │                                   │
│  Sidebar    │    Main Content                   │
│  (280px)    │    (padding: 1.5rem - 2rem)       │
│             │                                   │
│  - Nav      │    <router-outlet>                │
│  - Deptos   │                                   │
│             │                                   │
└─────────────┴───────────────────────────────────┘
```

### Responsive Breakpoints

- **Mobile**: < 640px
- **Tablet**: 640px - 1023px
- **Desktop**: >= 1024px

El sidebar se convierte en drawer overlay en móviles.

---

## 6. Efectos y Animaciones

### Glassmorphism

```css
.glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
```

### Gradientes

```css
.gradient-primary {
  background: linear-gradient(135deg, var(--primary-600), #818CF8);
}

.gradient-brand {
  background: linear-gradient(135deg, #C8102E, #E8354F);
}
```

### Animaciones CSS

```css
.animate-fade-in { animation: fadeIn 0.3s ease-out; }
.animate-slide-in { animation: slideIn 0.3s ease-out; }
.animate-pulse { animation: pulse 2s infinite; }
```

### Transiciones

```css
--transition-fast: 150ms ease;
--transition-normal: 300ms ease;
--transition-slow: 500ms ease;
```

---

## 7. Sombras

```css
.shadow-soft { box-shadow: 0 2px 8px var(--shadow-color); }
.shadow-medium { box-shadow: 0 4px 16px var(--shadow-color); }
.shadow-strong { box-shadow: 0 8px 32px var(--shadow-color); }
```

En modo oscuro, las sombras se reducen o eliminan para evitar ruido visual.

---

## 8. Radios de Borde

```css
--radius-sm: 0.375rem;   /* 6px */
--radius-md: 0.5rem;     /* 8px */
--radius-lg: 0.75rem;    /* 12px */
--radius-xl: 1rem;       /* 16px */
--radius-2xl: 1.5rem;    /* 24px */
--radius-full: 9999px;   /* Circular */
```

---

## 9. Angular Material Overrides

Los componentes de Angular Material están personalizados para seguir el sistema de diseño:

- **Cards**: Bordes redondeados, sombras suaves
- **Buttons**: Gradientes, efectos hover
- **Tables**: Filas con hover, bordes sutiles
- **Forms**: Inputs con bordes redondeados
- **Menus**: Sombras y bordes consistentes
- **Tabs**: Indicadores con color primario

---

## 10. Guía de Implementación

### Agregar soporte de tema a un componente

```typescript
import { ThemeService } from './core/services/theme.service';

export class MiComponente {
  themeService = inject(ThemeService);
  
  // En el template, usar las variables CSS
  // background: var(--bg-secondary);
  // color: var(--text-primary);
}
```

### Colores dinámicos por contexto

```css
/* El color se adapta automáticamente al tema */
.mi-elemento {
  background-color: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.mi-elemento:hover {
  background-color: var(--hover-bg);
  border-color: var(--border-hover);
}
```

---

## 11. Mejores Prácticas

1. **Usar variables CSS** en lugar de colores hardcodeados
2. **Probar en ambos temas** antes de hacer deploy
3. **Seguir la jerarquía de textos** para consistencia
4. **Usar las clases utilitarias** definidas en styles.css
5. **Mantener transiciones** en todos los elementos interactivos
6. **Respetar los radios de borde** según el contexto

---

## 12. Archivos Clave

| Archivo | Descripción |
|---------|-------------|
| `src/styles.css` | Estilos globales y tokens CSS |
| `src/app/core/services/theme.service.ts` | Servicio de gestión de temas |
| `src/app/shared/components/layout/*` | Componentes de layout |

---

**Última actualización**: Enero 2026
**Versión del Design System**: 2.0

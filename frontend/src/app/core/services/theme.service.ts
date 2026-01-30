import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'observatorio-theme';
  
  // Signal reactivo para el tema actual
  readonly theme = signal<Theme>(this.getInitialTheme());
  
  // Computed para saber si es modo oscuro
  readonly isDark = () => this.theme() === 'dark';
  
  constructor() {
    // Efecto para aplicar el tema al DOM cuando cambie
    effect(() => {
      this.applyTheme(this.theme());
    });
  }
  
  /**
   * Alterna entre tema claro y oscuro
   */
  toggleTheme(): void {
    const newTheme = this.theme() === 'light' ? 'dark' : 'light';
    this.theme.set(newTheme);
    localStorage.setItem(this.STORAGE_KEY, newTheme);
  }
  
  /**
   * Establece un tema específico
   */
  setTheme(theme: Theme): void {
    this.theme.set(theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
  }
  
  /**
   * Obtiene el tema inicial desde localStorage o preferencia del sistema
   */
  private getInitialTheme(): Theme {
    // Primero verificar localStorage
    const stored = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
    if (stored && (stored === 'light' || stored === 'dark')) {
      return stored;
    }
    
    // Si no hay preferencia guardada, usar preferencia del sistema
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    return 'light';
  }
  
  /**
   * Aplica el tema al documento HTML
   */
  private applyTheme(theme: Theme): void {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      
      if (theme === 'dark') {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    }
  }
}

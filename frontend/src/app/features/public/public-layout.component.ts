import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <!-- Header público -->
    <header class="public-header">
      <div class="header-container">
        <a routerLink="/" class="logo-link">
          <img src="ULEAM.png" alt="ULEAM" class="logo">
          <span class="logo-text">Observatorio ULEAM</span>
        </a>
        
        <nav class="nav-links">
          <a routerLink="/publico/departamentos" routerLinkActive="active">
            <mat-icon>business</mat-icon>
            Departamentos
          </a>
        </nav>

        <div class="header-actions">
          <button class="theme-toggle" (click)="themeService.toggleTheme()">
            <mat-icon>{{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
          <a mat-stroked-button routerLink="/auth/login">Iniciar Sesión</a>
          <a mat-raised-button color="primary" routerLink="/auth/register">Registrarse</a>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="public-main">
      <router-outlet></router-outlet>
    </main>

    <!-- Footer -->
    <footer class="public-footer">
      <div class="footer-content">
        <div class="footer-brand">
          <img src="ULEAM.png" alt="ULEAM" class="footer-logo">
          <div>
            <p class="brand-name">Observatorio ULEAM</p>
            <p class="brand-desc">Universidad Laica Eloy Alfaro de Manabí</p>
          </div>
        </div>
        <div class="footer-links">
          <a href="https://www.uleam.edu.ec" target="_blank">Sitio Web ULEAM</a>
          <a routerLink="/">Inicio</a>
          <a routerLink="/publico/departamentos">Departamentos</a>
        </div>
        <div class="footer-copy">
          <p>© {{ currentYear }} Observatorio ULEAM. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    /* Header */
    .public-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      backdrop-filter: blur(10px);
    }

    .header-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0.75rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2rem;
    }

    .logo-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
    }

    .logo { height: 40px; }

    .logo-text {
      font-weight: 700;
      font-size: 1.125rem;
      color: var(--text-primary);
    }

    .nav-links {
      display: flex;
      gap: 0.5rem;
    }

    .nav-links a {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-lg);
      text-decoration: none;
      color: var(--text-secondary);
      font-weight: 500;
      transition: all var(--transition-fast);
    }

    .nav-links a:hover {
      background: var(--hover-bg);
      color: var(--primary-600);
    }

    .nav-links a.active {
      background: var(--primary-50);
      color: var(--primary-600);
    }

    :host-context(.dark) .nav-links a.active {
      background: rgba(99, 102, 241, 0.15);
    }

    .nav-links a mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .theme-toggle {
      width: 40px;
      height: 40px;
      border: none;
      background: transparent;
      border-radius: var(--radius-lg);
      cursor: pointer;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast);
    }

    .theme-toggle:hover {
      background: var(--hover-bg);
      color: var(--primary-600);
    }

    @media (max-width: 768px) {
      .nav-links { display: none; }
      .header-actions a[mat-stroked-button] { display: none; }
    }

    /* Main */
    .public-main {
      flex: 1;
      background: var(--bg-primary);
    }

    /* Footer */
    .public-footer {
      background: var(--bg-tertiary);
      border-top: 1px solid var(--border-color);
      padding: 2rem 1.5rem;
    }

    .footer-content {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1.5rem;
    }

    .footer-brand {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .footer-logo {
      height: 36px;
    }

    .brand-name {
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .brand-desc {
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin: 0;
    }

    .footer-links {
      display: flex;
      gap: 1.5rem;
    }

    .footer-links a {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.875rem;
      transition: color var(--transition-fast);
    }

    .footer-links a:hover {
      color: var(--primary-600);
    }

    .footer-copy p {
      color: var(--text-tertiary);
      font-size: 0.75rem;
      margin: 0;
    }

    @media (max-width: 640px) {
      .footer-content {
        flex-direction: column;
        text-align: center;
      }
      
      .footer-links {
        flex-wrap: wrap;
        justify-content: center;
      }
    }
  `]
})
export class PublicLayoutComponent {
  readonly themeService = inject(ThemeService);
  currentYear = new Date().getFullYear();
}

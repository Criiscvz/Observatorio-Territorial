import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { Departamento } from '../../core/models';
import { DepartamentoService } from '../../core/services/departamento.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <!-- Header público -->
    <header class="public-header">
      <div class="header-container">
        <a routerLink="/" class="logo-link">
          <img src="ULEAM.png" alt="ULEAM" class="logo" />
          <span class="logo-text">Observatorio ULEAM</span>
        </a>
        <div class="header-actions">
          <button class="theme-toggle" (click)="themeService.toggleTheme()">
            <mat-icon>{{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
          </button>
          <a mat-stroked-button routerLink="/auth/login">Iniciar Sesión</a>
          <a mat-raised-button color="primary" routerLink="/auth/register">Registrarse</a>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-bg"></div>
      <div class="hero-content">
        <h1 class="hero-title">
          <span class="hero-highlight">Observatorio</span> de Datos <br />Universitarios ULEAM
        </h1>
        <p class="hero-subtitle">
          Transforma tus archivos Excel en dashboards interactivos de manera automática. Analiza,
          visualiza y comparte datos de forma inteligente.
        </p>
        <div class="hero-actions">
          <a
            mat-raised-button
            color="primary"
            routerLink="/publico/departamentos"
            class="hero-btn primary"
          >
            <mat-icon>explore</mat-icon>
            Explorar Datos Públicos
          </a>
          <a mat-stroked-button routerLink="/auth/register" class="hero-btn">
            <mat-icon>person_add</mat-icon>
            Crear Cuenta Gratis
          </a>
        </div>
      </div>
      <div class="hero-illustration">
        <div class="floating-card card-1">
          <mat-icon>bar_chart</mat-icon>
          <span>Gráficos Dinámicos</span>
        </div>
        <div class="floating-card card-2">
          <mat-icon>pie_chart</mat-icon>
          <span>Análisis Visual</span>
        </div>
        <div class="floating-card card-3">
          <mat-icon>analytics</mat-icon>
          <span>Correlaciones</span>
        </div>
      </div>
    </section>

    <!-- Stats Section -->
    <section class="stats-section">
      <div class="stats-container">
        <div class="stat-item">
          <span class="stat-number">{{ departamentos().length }}</span>
          <span class="stat-label">Departamentos Públicos</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ totalDatasets }}</span>
          <span class="stat-label">Datasets Disponibles</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ formatNumber(totalRegistros) }}</span>
          <span class="stat-label">Registros Analizados</span>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features-section">
      <div class="section-header">
        <h2 class="section-title">Potentes Herramientas de Análisis</h2>
        <p class="section-subtitle">Todo lo que necesitas para convertir datos en conocimiento</p>
      </div>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">
            <mat-icon>cloud_upload</mat-icon>
          </div>
          <h3>Importación Inteligente</h3>
          <p>Sube archivos Excel o CSV y el sistema detectará automáticamente los tipos de datos</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <mat-icon>auto_graph</mat-icon>
          </div>
          <h3>Gráficos Automáticos</h3>
          <p>Genera visualizaciones instantáneas: barras, pastel, líneas, dispersión y más</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <mat-icon>compare_arrows</mat-icon>
          </div>
          <h3>Análisis Bivariable</h3>
          <p>Descubre correlaciones y relaciones entre variables con un clic</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">
            <mat-icon>share</mat-icon>
          </div>
          <h3>Comparte Públicamente</h3>
          <p>Haz públicos tus análisis para que cualquiera pueda verlos</p>
        </div>
      </div>
    </section>

    <!-- Public Departments Preview -->
    <section class="departments-section">
      <div class="section-header">
        <h2 class="section-title">Departamentos Públicos</h2>
        <p class="section-subtitle">Explora los datos compartidos por la comunidad universitaria</p>
      </div>

      @if (loading()) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Cargando departamentos...</p>
        </div>
      } @else if (departamentos().length > 0) {
        <div class="departments-grid">
          @for (depto of departamentos().slice(0, 6); track depto.id) {
            <a [routerLink]="['/publico/departamentos', depto.id]" class="department-card">
              <div class="department-avatar" [style.background]="getDeptoColor($index)">
                {{ depto.nombre.charAt(0).toUpperCase() }}
              </div>
              <div class="department-info">
                <h4>{{ depto.nombre }}</h4>
                <p>{{ depto.descripcion || 'Sin descripción' }}</p>
                <span class="dataset-count">
                  <mat-icon>table_chart</mat-icon>
                  {{ depto.datasets_count || 0 }} datasets
                </span>
              </div>
            </a>
          }
        </div>
        @if (departamentos().length > 6) {
          <div class="view-all-container">
            <a mat-stroked-button routerLink="/publico/departamentos">
              Ver todos los departamentos
              <mat-icon>arrow_forward</mat-icon>
            </a>
          </div>
        }
      } @else {
        <div class="empty-departments">
          <mat-icon>folder_off</mat-icon>
          <p>No hay departamentos públicos disponibles</p>
        </div>
      }
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <div class="cta-content">
        <h2>¿Listo para analizar tus datos?</h2>
        <p>Únete a la comunidad de investigadores y analistas de ULEAM</p>
        <a mat-raised-button color="primary" routerLink="/auth/register" class="cta-btn">
          Comenzar Ahora
          <mat-icon>arrow_forward</mat-icon>
        </a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="public-footer">
      <div class="footer-content">
        <div class="footer-brand">
          <img src="ULEAM.png" alt="ULEAM" class="footer-logo" />
          <p>Universidad Laica Eloy Alfaro de Manabí</p>
        </div>
        <div class="footer-links">
          <a href="https://www.uleam.edu.ec" target="_blank">Sitio Web ULEAM</a>
          <a routerLink="/publico/departamentos">Departamentos</a>
          <a routerLink="/auth/login">Iniciar Sesión</a>
        </div>
        <div class="footer-copy">
          <p>© {{ currentYear }} Observatorio ULEAM. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* Header */
      .public-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 100;
        background: var(--bg-secondary);
        border-bottom: 1px solid var(--border-color);
        backdrop-filter: blur(10px);
      }

      .header-container {
        max-width: 1280px;
        margin: 0 auto;
        padding: 0.75rem 1.5rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .logo-link {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        text-decoration: none;
      }

      .logo {
        height: 40px;
      }

      .logo-text {
        font-weight: 700;
        font-size: 1.125rem;
        color: var(--text-primary);
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

      /* Hero */
      .hero {
        position: relative;
        min-height: 100vh;
        display: flex;
        align-items: center;
        padding: 6rem 1.5rem 4rem;
        overflow: hidden;
      }

      .hero-bg {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          135deg,
          var(--primary-50) 0%,
          var(--bg-primary) 50%,
          var(--bg-secondary) 100%
        );
        z-index: -1;
      }

      .hero-bg::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: url('/fondo_banner.png');
        background-size: cover;
        background-position: center;
        opacity: 0.1;
      }

      :host-context(.dark) .hero-bg {
        background: linear-gradient(
          135deg,
          rgba(99, 102, 241, 0.1) 0%,
          var(--bg-primary) 50%,
          var(--bg-secondary) 100%
        );
      }

      .hero-content {
        max-width: 600px;
        z-index: 1;
      }

      .hero-title {
        font-size: 3rem;
        font-weight: 800;
        line-height: 1.1;
        color: var(--text-primary);
        margin-bottom: 1.5rem;
      }

      @media (max-width: 768px) {
        .hero-title {
          font-size: 2rem;
        }
      }

      .hero-highlight {
        color: var(--primary-600);
      }

      :host-context(.dark) .hero-highlight {
        color: var(--primary-400);
      }

      .hero-subtitle {
        font-size: 1.25rem;
        color: var(--text-secondary);
        margin-bottom: 2rem;
        line-height: 1.6;
      }

      .hero-actions {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .hero-btn {
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
      }

      .hero-btn.primary {
        box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
      }

      .hero-illustration {
        position: absolute;
        right: 5%;
        top: 50%;
        transform: translateY(-50%);
        display: none;
      }

      @media (min-width: 1024px) {
        .hero-illustration {
          display: block;
        }
      }

      .floating-card {
        position: absolute;
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: var(--radius-xl);
        padding: 1rem 1.5rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        box-shadow: 0 10px 40px var(--shadow-color);
        animation: float 3s ease-in-out infinite;
      }

      .floating-card mat-icon {
        color: var(--primary-600);
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      .floating-card span {
        font-weight: 600;
        color: var(--text-primary);
      }

      .card-1 {
        top: 0;
        right: 100px;
        animation-delay: 0s;
      }
      .card-2 {
        top: 120px;
        right: 0;
        animation-delay: 0.5s;
      }
      .card-3 {
        top: 240px;
        right: 80px;
        animation-delay: 1s;
      }

      @keyframes float {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-10px);
        }
      }

      /* Stats Section */
      .stats-section {
        background: var(--primary-600);
        padding: 3rem 1.5rem;
      }

      .stats-container {
        max-width: 1280px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 2rem;
        text-align: center;
      }

      @media (max-width: 640px) {
        .stats-container {
          grid-template-columns: 1fr;
        }
      }

      .stat-item {
        color: white;
      }

      .stat-number {
        display: block;
        font-size: 3rem;
        font-weight: 800;
        line-height: 1;
        margin-bottom: 0.5rem;
      }

      .stat-label {
        font-size: 1rem;
        opacity: 0.9;
      }

      /* Features Section */
      .features-section {
        padding: 5rem 1.5rem;
        background: var(--bg-primary);
      }

      .section-header {
        text-align: center;
        margin-bottom: 3rem;
      }

      .section-title {
        font-size: 2.25rem;
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: 0.75rem;
      }

      .section-subtitle {
        font-size: 1.125rem;
        color: var(--text-secondary);
      }

      .features-grid {
        max-width: 1280px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 2rem;
      }

      @media (max-width: 1024px) {
        .features-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 640px) {
        .features-grid {
          grid-template-columns: 1fr;
        }
      }

      .feature-card {
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: var(--radius-xl);
        padding: 2rem;
        text-align: center;
        transition: all var(--transition-normal);
      }

      .feature-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 40px var(--shadow-color);
      }

      .feature-icon {
        width: 64px;
        height: 64px;
        margin: 0 auto 1rem;
        background: var(--primary-50);
        border-radius: var(--radius-xl);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      :host-context(.dark) .feature-icon {
        background: rgba(99, 102, 241, 0.15);
      }

      .feature-icon mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: var(--primary-600);
      }

      .feature-card h3 {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 0.5rem;
      }

      .feature-card p {
        font-size: 0.875rem;
        color: var(--text-secondary);
        line-height: 1.5;
      }

      /* Departments Section */
      .departments-section {
        padding: 5rem 1.5rem;
        background: var(--bg-secondary);
      }

      .departments-grid {
        max-width: 1280px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.5rem;
      }

      @media (max-width: 1024px) {
        .departments-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 640px) {
        .departments-grid {
          grid-template-columns: 1fr;
        }
      }

      .department-card {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1.5rem;
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: var(--radius-xl);
        text-decoration: none;
        transition: all var(--transition-fast);
      }

      .department-card:hover {
        border-color: var(--primary-300);
        box-shadow: 0 8px 24px var(--shadow-color);
        transform: translateY(-2px);
      }

      .department-avatar {
        width: 56px;
        height: 56px;
        border-radius: var(--radius-lg);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 1.5rem;
        flex-shrink: 0;
      }

      .department-info h4 {
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 0.25rem;
      }

      .department-info p {
        font-size: 0.875rem;
        color: var(--text-secondary);
        margin-bottom: 0.5rem;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .dataset-count {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.75rem;
        color: var(--text-tertiary);
      }

      .dataset-count mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      .view-all-container {
        text-align: center;
        margin-top: 2rem;
      }

      .loading-container,
      .empty-departments {
        text-align: center;
        padding: 3rem;
        color: var(--text-secondary);
      }

      .empty-departments mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        opacity: 0.5;
      }

      /* CTA Section */
      .cta-section {
        padding: 5rem 1.5rem;
        background: linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%);
        text-align: center;
      }

      .cta-content h2 {
        font-size: 2rem;
        font-weight: 700;
        color: white;
        margin-bottom: 0.75rem;
      }

      .cta-content p {
        font-size: 1.125rem;
        color: rgba(255, 255, 255, 0.9);
        margin-bottom: 2rem;
      }

      .cta-btn {
        background: white !important;
        color: var(--primary-600) !important;
        padding: 0.875rem 2rem;
        font-size: 1rem;
      }

      /* Footer */
      .public-footer {
        background: var(--bg-tertiary);
        padding: 3rem 1.5rem;
      }

      .footer-content {
        max-width: 1280px;
        margin: 0 auto;
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 2rem;
      }

      .footer-brand {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .footer-logo {
        height: 40px;
      }

      .footer-brand p {
        color: var(--text-secondary);
        font-size: 0.875rem;
      }

      .footer-links {
        display: flex;
        gap: 2rem;
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
      }
    `,
  ],
})
export class PublicHomeComponent implements OnInit {
  private deptoService = inject(DepartamentoService);
  readonly themeService = inject(ThemeService);

  departamentos = signal<Departamento[]>([]);
  loading = signal(true);
  currentYear = new Date().getFullYear();

  private deptoColors = [
    '#6366F1',
    '#EC4899',
    '#14B8A6',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#06B6D4',
    '#84CC16',
    '#F97316',
    '#3B82F6',
  ];

  get totalDatasets(): number {
    return this.departamentos().reduce((sum, d) => sum + (d.datasets_count || 0), 0);
  }

  get totalRegistros(): number {
    return this.departamentos().reduce((sum, d) => {
      const datasets = d.datasets || [];
      return sum + datasets.reduce((s, ds) => s + (ds.total_registros || 0), 0);
    }, 0);
  }

  ngOnInit(): void {
    this.loadDepartamentos();
  }

  loadDepartamentos(): void {
    this.deptoService.getPublicos().subscribe({
      next: (deptos) => {
        this.departamentos.set(deptos || []);
        this.loading.set(false);
      },
      error: () => {
        this.departamentos.set([]);
        this.loading.set(false);
      },
    });
  }

  getDeptoColor(index: number): string {
    return this.deptoColors[index % this.deptoColors.length];
  }

  formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
}

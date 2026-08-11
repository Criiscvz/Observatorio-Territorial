import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID, signal, DestroyRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { APP_CONFIG } from '@core/config';
import { Departamento } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { LanguageService } from '@core/services/language.service';
import { ThemeService } from '@core/services/theme.service';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { catchError, forkJoin, of } from 'rxjs';

const EMPTY_PUBLIC_STATS = {
  observatorios: 0,
  articulos: 0,
  reportes: 0,
  libros: 0,
};

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatCardModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './public-home.component.html',
  styleUrl: './public-home.component.scss',
})
export class PublicHomeComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly deptoService = inject(DepartamentoService);
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly languageService = inject(LanguageService);

  readonly appConfig = APP_CONFIG;

  departamentos = signal<Departamento[]>([]);
  publicStats = signal(EMPTY_PUBLIC_STATS);
  loading = signal(true);
  mobileMenuOpen = signal(false);
  showObservatories = signal(false);
  showBarometer = signal(false);
  currentYear = new Date().getFullYear();

  private readonly deptoColors = [
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

  ngOnInit(): void {
    // Solo cargar datos en el navegador, no durante SSR
    if (isPlatformBrowser(this.platformId)) {
      this.loadDepartamentos();
    } else {
      // Durante SSR, simplemente marcar como no cargando
      this.loading.set(false);
    }
  }

  loadDepartamentos(): void {
    forkJoin({
      departamentos: this.deptoService.getPublicos().pipe(catchError(() => of([]))),
      stats: this.deptoService.getPublicStats().pipe(catchError(() => of(EMPTY_PUBLIC_STATS))),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ departamentos, stats }) => {
        this.departamentos.set(departamentos || []);
        this.publicStats.set(stats);
        this.loading.set(false);
      },
      error: () => {
        this.departamentos.set([]);
        this.publicStats.set(EMPTY_PUBLIC_STATS);
        this.loading.set(false);
      },
    });
  }

  getDeptoColor(index: number): string {
    return this.deptoColors[index % this.deptoColors.length];
  }

}


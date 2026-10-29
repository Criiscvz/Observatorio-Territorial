import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CategoriaDataset, Dataset } from '@core/models';
import { CategoriaService } from '@core/services/categoria.service';
import { ArticulosService, Articulo } from '@core/services/articulos.service';
import { ReportesService, Reporte } from '@core/services/reportes.service';
import { AuthService } from '@core/services/auth.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { SubscriberAccessDialogComponent } from '@shared/components/subscriber-access-dialog';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-barometer-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatChipsModule,
    MatTabsModule,
    TranslateModule,
  ],
  templateUrl: './barometer-view.component.html',
  styleUrl: './barometer-view.component.scss',
})
export class BarometerViewComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly categoriaService = inject(CategoriaService);
  private readonly articulosService = inject(ArticulosService);
  private readonly reportesService = inject(ReportesService);
  private readonly authService = inject(AuthService);
  private readonly publicacionService = inject(PublicacionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  categoria = signal<CategoriaDataset | null>(null);
  datasets = signal<Dataset[]>([]);
  articulos = signal<Articulo[]>([]);
  reportes = signal<Reporte[]>([]);
  loading = signal(true);
  error = signal(false);
  codigo = '';

  // ─── PWA Install Prompt ───
  private readonly deferredPrompt = signal<any>(null);
  readonly canInstall = computed(() => !!this.deferredPrompt());
  installOutcome = signal<'accepted' | 'dismissed' | null>(null);

  /** Maps category codes to i18n key segments */
  private readonly categoryI18nMap: Record<string, string> = {
    investigacion: 'research',
    vinculacion: 'linkage',
    barometro: 'barometerUleam',
  };

  private readonly datasetColors = [
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

  /** Artículos agrupados por categoría */
  articulosAgrupados = computed(() =>
    this.articulosService.agruparPorCategoria(this.articulos())
  );

  /** Reportes agrupados por categoría */
  reportesAgrupados = computed(() =>
    this.reportesService.agruparPorCategoria(this.reportes())
  );

  get i18nSection(): string {
    return this.categoryI18nMap[this.codigo] || 'research';
  }

  get totalRegistros(): number {
    return this.datasets().reduce((sum, ds) => sum + (ds.total_registros || 0), 0);
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Capture PWA install prompt
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt.set(e);
      });

      // Listen for successful installation
      window.addEventListener('appinstalled', () => {
        this.deferredPrompt.set(null);
        this.installOutcome.set('accepted');
      });

      this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        this.codigo = params['codigo'] || 'investigacion';
        this.loadData();
      });
    } else {
      this.loading.set(false);
    }
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(false);

    // Load category info
    this.categoriaService.getCategoriaByCodigo(this.codigo).subscribe({
      next: (cat) => this.categoria.set(cat),
      error: () => {},
    });

    // Load datasets for this category
    this.categoriaService.getDatasetsByCategoria(this.codigo).subscribe({
      next: (datasets) => {
        this.datasets.set(datasets || []);
        this.loading.set(false);
      },
      error: () => {
        this.datasets.set([]);
        this.error.set(true);
        this.loading.set(false);
      },
    });

    // Load articles (can be filtered if backend supports filtering by category code, but for now we load all or filter client side)
    this.articulosService.getAll().subscribe({
      next: (arts) => this.articulos.set(arts),
      error: () => this.articulos.set([]),
    });

    // Load reports
    this.reportesService.getAll().subscribe({
      next: (reps) => this.reportes.set(reps),
      error: () => this.reportes.set([]),
    });
  }

  getDatasetColor(index: number): string {
    return this.categoria()?.color || this.datasetColors[index % this.datasetColors.length];
  }

  getTypeClass(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO':
        return 'type-numeric';
      case 'CATEGORICO':
        return 'type-categoric';
      case 'FECHA':
        return 'type-date';
      default:
        return 'type-text';
    }
  }

  async installApp(): Promise<void> {
    const prompt = this.deferredPrompt();
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    this.installOutcome.set(outcome);
    this.deferredPrompt.set(null);
  }

  isSubscriberContent(item: Articulo | Reporte): boolean {
    return item.bloqueado === true || item.visibilidad === 'suscriptor';
  }

  canViewSubscriberContent(item: Articulo | Reporte): boolean {
    if (!this.isSubscriberContent(item)) return true;
    if (!this.authService.isAuthenticated()) return false;

    const user = this.authService.user();
    const role = String(user?.rol ?? '').toUpperCase();
    return ['ADMIN', 'SUBSCRIBER', 'SUSCRIPTOR', 'SUBSCRIPTOR'].includes(role);
  }

  showSubscriberMessage(): void {
    this.dialog.open(SubscriberAccessDialogComponent, {
      width: 'min(92vw, 460px)',
      maxWidth: '92vw',
      panelClass: 'subscriber-access-dialog-panel',
      backdropClass: 'subscriber-access-dialog-backdrop',
      autoFocus: false,
      restoreFocus: false,
      data: {
        title: 'Contenido exclusivo para suscriptores',
        message:
          'Este contenido está disponible exclusivamente para usuarios suscriptores. Inicie sesión con una cuenta suscriptora o suscríbase para obtener acceso.',
        icon: 'lock',
        closeText: 'Entendido',
      },
    });
  }

  openArticlePdf(articulo: Articulo): void {
    this.publicacionService
      .openPdf({
        download_url: articulo.download_url ?? null,
        sharepoint_url: articulo.sharepoint_url ?? null,
      })
      .subscribe((opened) => {
        if (!opened) {
          this.snackBar.open('No hay PDF disponible para esta publicación.', 'Cerrar', {
            duration: 3500,
          });
        }
      });
  }

  openReportPdf(reporte: Reporte): void {
    if (!this.hasReportPdf(reporte)) {
      return;
    }

    this.publicacionService
      .openPdf({
        download_url: reporte.download_url ?? reporte.ficha_indicador ?? null,
        sharepoint_url: reporte.sharepoint_url ?? null,
      })
      .subscribe((opened) => {
        if (!opened) {
          this.snackBar.open('No hay PDF disponible para este reporte.', 'Cerrar', {
            duration: 3500,
          });
        }
      });
  }

  hasReportPdf(reporte: Reporte): boolean {
    return [reporte.download_url, reporte.ficha_indicador, reporte.sharepoint_url]
      .some((url) => typeof url === 'string' && url.trim().length > 0);
  }
}

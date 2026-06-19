import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CategoriaDataset, Dataset } from '@core/models';
import { CategoriaService } from '@core/services/categoria.service';
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
    MatChipsModule,
    TranslateModule,
  ],
  templateUrl: './barometer-view.component.html',
  styleUrl: './barometer-view.component.scss',
})
export class BarometerViewComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly categoriaService = inject(CategoriaService);
  private readonly destroyRef = inject(DestroyRef);

  categoria = signal<CategoriaDataset | null>(null);
  datasets = signal<Dataset[]>([]);
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
}

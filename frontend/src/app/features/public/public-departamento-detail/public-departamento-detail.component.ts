import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Dataset, Departamento } from '@core/models';
import { DepartamentoService } from '@core/services/departamento.service';
import { ArticulosService, Articulo } from '@core/services/articulos.service';
import { ReportesService, Reporte } from '@core/services/reportes.service';
import { AuthService } from '@core/services/auth.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { SubscriberAccessDialogComponent } from '@shared/components/subscriber-access-dialog';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-public-departamento-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatChipsModule,
    MatTabsModule,
    TranslateModule,
  ],
  templateUrl: './public-departamento-detail.component.html',
  styleUrl: './public-departamento-detail.component.scss',
})
export class PublicDepartamentoDetailComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly deptoService = inject(DepartamentoService);
  private readonly articulosService = inject(ArticulosService);
  private readonly reportesService = inject(ReportesService);
  private readonly authService = inject(AuthService);
  private readonly publicacionService = inject(PublicacionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  departamento = signal<Departamento | null>(null);
  articulos = signal<Articulo[]>([]);
  reportes = signal<Reporte[]>([]);
  atlas = signal<ObservatorioPublicacion[]>([]);
  loading = signal(true);
  datasetSearchTerm = '';

  deptoGradient = 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)';

  private readonly datasetColors = [
    '#6366F1', '#EC4899', '#14B8A6', '#F59E0B',
    '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16',
    '#F97316', '#3B82F6',
  ];

  /** Artículos agrupados por categoría */
  articulosAgrupados = computed(() =>
    this.articulosService.agruparPorCategoria(this.articulos())
  );

  /** Reportes agrupados por categoría */
  reportesAgrupados = computed(() =>
    this.reportesService.agruparPorCategoria(this.reportes())
  );

  atlasAgrupados = computed(() => [
    {
      categoria: 'Atlas ULEAM',
      color: '#6366F1',
      items: this.atlas(),
    },
  ]);

  get datasets(): Dataset[] {
    const all = this.departamento()?.datasets || [];
    if (!this.datasetSearchTerm.trim()) return all;
    const term = this.datasetSearchTerm.toLowerCase().trim();
    return all.filter((ds) => ds.nombre.toLowerCase().includes(term));
  }

  get totalRegistros(): number {
    return this.datasets.reduce((sum, ds) => sum + (ds.total_registros || 0), 0);
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const id = params['id'];
        if (id) {
          this.loadDepartamento(id);
        }
      });
    } else {
      this.loading.set(false);
    }
  }

  loadDepartamento(id: string): void {
    this.deptoService.getPublicById(id).subscribe({
      next: (depto) => {
        this.departamento.set(depto);
        this.loading.set(false);
        // Cargar artículos y reportes filtrados por este departamento
        this.articulosService.getAll(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (arts) => this.articulos.set(arts),
          error: () => this.articulos.set([]),
        });
        this.reportesService.getAll(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (reps) => this.reportes.set(reps),
          error: () => this.reportes.set([]),
        });
        this.publicacionService
          .getPublicAtlasByDepartamento(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (items) => this.atlas.set(items),
            error: () => this.atlas.set([]),
          });
      },
      error: () => {
        this.departamento.set(null);
        this.loading.set(false);
      },
    });
  }
  getDatasetColor(index: number): string {
    return this.datasetColors[index % this.datasetColors.length];
  }

  getTypeClass(tipo: string): string {
    switch (tipo) {
      case 'NUMERICO': return 'type-numeric';
      case 'CATEGORICO': return 'type-categoric';
      case 'FECHA': return 'type-date';
      default: return 'type-text';
    }
  }

  isSubscriberContent(item: Articulo | Reporte | ObservatorioPublicacion): boolean {
    return (
      item.bloqueado === true ||
      ('visibilidad' in item && item.visibilidad === 'suscriptor') ||
      ('solo_suscriptores' in item && item.solo_suscriptores)
    );
  }

  canViewSubscriberContent(item: Articulo | Reporte | ObservatorioPublicacion): boolean {
    if (!this.isSubscriberContent(item)) return true;
    if (!this.authService.isAuthenticated()) return false;

    const user = this.authService.user();
    const role = String(user?.rol ?? '').toUpperCase();
    return ['ADMIN', 'EDITOR', 'SUBSCRIBER', 'SUSCRIPTOR', 'SUBSCRIPTOR'].includes(role);
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

  openAtlasPdf(atlas: ObservatorioPublicacion): void {
    this.publicacionService.openPdf(atlas).subscribe((opened) => {
      if (!opened) {
        this.snackBar.open('No hay PDF disponible para este Atlas.', 'Cerrar', {
          duration: 3500,
        });
      }
    });
  }
}


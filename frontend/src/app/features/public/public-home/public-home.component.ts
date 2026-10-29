import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, OnInit, PLATFORM_ID, signal, DestroyRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { APP_CONFIG } from '@core/config';
import { Departamento } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { catchError, forkJoin, of } from 'rxjs';
import { PublicNavbarComponent } from '../components/public-navbar/public-navbar.component';
import { PublicFooterComponent } from '../components/public-footer/public-footer.component';

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
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    TranslateModule,
    PublicFooterComponent,
    PublicNavbarComponent,
  ],
  templateUrl: './public-home.component.html',
  styleUrl: './public-home.component.scss',
})
export class PublicHomeComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly deptoService = inject(DepartamentoService);
  readonly authService = inject(AuthService);

  readonly appConfig = APP_CONFIG;

  departamentos = signal<Departamento[]>([]);
  readonly observatoryPageSize = 5;
  readonly observatorySearch = signal('');
  readonly observatoryPage = signal(0);
  readonly filteredObservatories = computed(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    const search = normalize(this.observatorySearch().trim());
    return this.departamentos().filter(depto => normalize(`${depto.nombre} ${depto.descripcion || ''}`).includes(search));
  });
  readonly observatoryPageCount = computed(() => Math.max(1, Math.ceil(this.filteredObservatories().length / this.observatoryPageSize)));
  readonly currentObservatoryPage = computed(() => Math.min(this.observatoryPage(), this.observatoryPageCount() - 1));
  readonly visibleObservatories = computed(() => {
    const start = this.currentObservatoryPage() * this.observatoryPageSize;
    return this.filteredObservatories().slice(start, start + this.observatoryPageSize);
  });
  readonly observatoryRangeStart = computed(() => this.filteredObservatories().length ? this.currentObservatoryPage() * this.observatoryPageSize + 1 : 0);
  readonly observatoryRangeEnd = computed(() => Math.min((this.currentObservatoryPage() + 1) * this.observatoryPageSize, this.filteredObservatories().length));
  publicStats = signal(EMPTY_PUBLIC_STATS);
  loading = signal(true);

  searchObservatories(value: string): void {
    this.observatorySearch.set(value);
    this.observatoryPage.set(0);
  }

  changeObservatoryPage(direction: number): void {
    this.observatoryPage.set(Math.max(0, Math.min(this.currentObservatoryPage() + direction, this.observatoryPageCount() - 1)));
  }

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


}

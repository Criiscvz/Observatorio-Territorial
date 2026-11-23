import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, of, switchMap } from 'rxjs';
import { BAROMETRO_SECTIONS, BarometroPublication, BarometroService } from '@core/services/barometro.service';
import { LinkLibraryEntry, PublicLinkLibraryComponent } from '../components/public-link-library.component';
import { PublicPublicationDetailsComponent } from '../components/public-publication-details.component';
import { PublicationViewerService } from '../components/publication-viewer.service';
import { barometroPublicationCode, barometroViewerItem } from './barometro-viewer-item';

@Component({
  selector: 'app-barometer-view',
  imports: [MatIconModule, RouterLink, PublicLinkLibraryComponent],
  templateUrl: './barometer-view.component.html',
  styleUrl: '../public-atlas/public-atlas.component.scss',
})
export class BarometerViewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(BarometroService);
  private readonly dialog = inject(MatDialog);
  private readonly viewer = inject(PublicationViewerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Subject<void>();
  private readonly publications = signal<BarometroPublication[]>([]);

  readonly section = signal<typeof BAROMETRO_SECTIONS[number] | undefined>(undefined);
  readonly query = signal('');
  readonly page = signal(0);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly items = computed<LinkLibraryEntry[]>(() => this.publications().map(item => ({
    ...item, id: String(item.id), codigo: barometroPublicationCode(item.id), fuente: item.fuente ?? '',
  })));

  constructor() {
    this.requests.pipe(switchMap(() => {
      this.publications.set([]);
      this.total.set(0);
      this.failed.set(false);
      const section = this.section();
      if (!section) return of(null);

      this.loading.set(true);
      const q = this.query().trim();
      return this.api.published(section.code, this.page() + 1, q).pipe(
        switchMap(result => this.page() + 1 > result.meta.last_page
          ? this.api.published(section.code, result.meta.last_page, q) : of(result)),
        catchError(() => { this.failed.set(true); return of(null); }),
      );
    }), takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result) {
        this.publications.set(result.data);
        this.total.set(result.meta.total);
        this.page.set(result.meta.current_page - 1);
      }
      this.loading.set(false);
    });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.section.set(BAROMETRO_SECTIONS.find(item => item.code === params.get('codigo')));
      this.search('');
    });
  }

  reload(): void { this.requests.next(); }

  search(value: string): void {
    this.query.set(value);
    this.page.set(0);
    this.reload();
  }

  changePage(delta: number): void {
    this.page.update(page => page + delta);
    this.reload();
  }

  open(candidate: LinkLibraryEntry, details = false): void {
    const section = this.section();
    const publication = this.publications().find(item => String(item.id) === candidate.id &&
      item.seccion === section?.code && item.estado === 'PUBLICACION');
    if (!section || !publication) return;
    const item = barometroViewerItem(publication);
    if (details) {
      this.dialog.open(PublicPublicationDetailsComponent, {
        data: {item, departmentName: section.name, context: 'barometro'},
        width: '700px', maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100dvh - 24px)',
        autoFocus: 'dialog', restoreFocus: true,
      });
    } else if (item.reportUrl) {
      this.viewer.open(item, section.name, 'report', 'barometro');
    }
  }
}

import { DatePipe, formatDate } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BAROMETRO_SECTIONS, BarometroPage, BarometroPublication, BarometroSection, BarometroService, BarometroState } from '@core/services/barometro.service';
import { Observable, Subject, catchError, map, of, switchMap } from 'rxjs';
import { barometroPublicationCode, barometroViewerItem } from '../../public/barometer-view/barometro-viewer-item';
import { powerBiEmbedUrl } from '../../public/components/publication-viewer.component';
import { PublicationViewerService } from '../../public/components/publication-viewer.service';

const states: ReadonlyArray<{value: BarometroState; label: string}> = [
  {value: 'EN_REVISION', label: 'En revisión'},
  {value: 'PUBLICACION', label: 'Publicado'},
  {value: 'ARCHIVADO', label: 'Archivado'},
];

interface EditorData {
  section: typeof BAROMETRO_SECTIONS[number];
  item: BarometroPublication | null;
}

type WorkspaceResponse = {kind: 'library'; result: BarometroPage} |
  {kind: 'directory'; result: {data: Partial<Record<BarometroSection, number>>}};

@Component({
  selector: 'app-barometro-publication-editor',
  imports: [MatDialogModule, MatIconModule, ReactiveFormsModule],
  templateUrl: './barometro-publication-editor.component.html',
  styleUrls: ['../../public/public-atlas/atlas-workspace.component.scss', './barometro-workspace.component.scss'],
})
export class BarometroPublicationEditorComponent {
  readonly data = inject<EditorData>(MAT_DIALOG_DATA);
  private readonly dialog = inject<MatDialogRef<BarometroPublicationEditorComponent, boolean>>(MatDialogRef);
  private readonly api = inject(BarometroService);
  private readonly viewer = inject(PublicationViewerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly builder = inject(FormBuilder).nonNullable;
  readonly states = states;
  readonly saving = signal(false);
  readonly error = signal('');
  readonly confirmDiscard = signal(false);

  readonly form = this.builder.group({
    titulo: [this.data.item?.titulo ?? '', [Validators.required, Validators.maxLength(255)]],
    fecha_publicacion: [this.data.item?.fecha_publicacion ?? formatDate(Date.now(), 'yyyy-MM-dd', 'en'), Validators.required],
    fuente: [this.data.item?.fuente ?? '', Validators.maxLength(255)],
    descripcion: [this.data.item?.descripcion ?? '', Validators.maxLength(3000)],
    link_url: [this.data.item?.link_url ?? '', [Validators.required, Validators.maxLength(2048),
      (control: AbstractControl) => powerBiEmbedUrl(String(control.value).trim()) ? null : {powerBi: true}]],
    estado: this.builder.control<BarometroState>(this.data.item?.estado ?? 'EN_REVISION'),
  });

  preview(): void {
    if (this.form.controls.link_url.invalid) return;
    const value = this.form.getRawValue();
    const item = barometroViewerItem({
      ...value, link_url: value.link_url.trim(), titulo: value.titulo.trim() || 'Vista previa del reporte',
      id: this.data.item?.id ?? 0, seccion: this.data.section.code,
    });
    this.viewer.open({...item, code: this.data.item ? item.code : 'Vista previa'}, this.data.section.name, 'report', 'barometro');
  }

  save(): void {
    if (this.saving()) return;
    const value = this.form.getRawValue();
    if (this.form.invalid || !value.titulo.trim()) {
      this.form.markAllAsTouched();
      this.error.set('Revisa el título, la fecha y el enlace de Power BI.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.api.save(this.data.section.code, {
      ...value, titulo: value.titulo.trim(), link_url: value.link_url.trim(),
      fuente: value.fuente.trim(), descripcion: value.descripcion.trim(),
    }, this.data.item?.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.dialog.close(true),
      error: error => {
        this.error.set(error.error?.errors?.link_url?.[0] ?? error.error?.message ?? 'No se pudo guardar la publicación.');
        this.saving.set(false);
      },
    });
  }

  close(discard = false): void {
    if (this.saving()) return;
    if (this.form.dirty && !discard) {
      this.confirmDiscard.set(true);
      return;
    }
    this.dialog.close();
  }
}

@Component({
  selector: 'app-barometro-workspace',
  imports: [DatePipe, MatIconModule, RouterLink],
  templateUrl: './barometro-workspace.component.html',
  styleUrls: ['../../public/public-atlas/atlas-workspace.component.scss', './barometro-workspace.component.scss'],
})
export class BarometroWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(BarometroService);
  private readonly dialog = inject(MatDialog);
  private readonly viewer = inject(PublicationViewerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Subject<void>();

  readonly sections = BAROMETRO_SECTIONS;
  readonly states = states;
  readonly sectionCode = signal<string | null>(null);
  readonly section = computed(() => BAROMETRO_SECTIONS.find(item => item.code === this.sectionCode()));
  readonly counts = signal<Partial<Record<BarometroSection, number>>>({});
  readonly items = signal<BarometroPublication[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly query = signal('');
  readonly status = signal<BarometroState | ''>('');
  readonly page = signal(0);
  readonly total = signal(0);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / 20)));
  readonly rangeStart = computed(() => this.total() ? this.page() * 20 + 1 : 0);
  readonly rangeEnd = computed(() => Math.min((this.page() + 1) * 20, this.total()));
  readonly code = barometroPublicationCode;

  constructor() {
    this.requests.pipe(switchMap(() => {
      this.failed.set(false);
      this.items.set([]);
      this.total.set(0);
      const section = this.section();
      if (!section && this.sectionCode() !== null) return of(null);
      this.loading.set(true);
      const q = this.query().trim();
      const status = this.status();
      const request: Observable<WorkspaceResponse> = section
        ? this.api.list(section.code, this.page() + 1, q, status).pipe(
          switchMap(result => this.page() + 1 > result.meta.last_page
            ? this.api.list(section.code, result.meta.last_page, q, status) : of(result)),
          map(result => ({kind: 'library' as const, result})),
        )
        : this.api.counts().pipe(map(result => ({kind: 'directory' as const, result})));
      return request.pipe(catchError(() => { this.failed.set(true); return of(null); }));
    }), takeUntilDestroyed(this.destroyRef)).subscribe(response => {
      if (response?.kind === 'directory') this.counts.set(response.result.data);
      if (response?.kind === 'library') {
        this.items.set(response.result.data);
        this.total.set(response.result.meta.total);
        this.page.set(response.result.meta.current_page - 1);
      }
      this.loading.set(false);
    });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.sectionCode.set(params.get('codigo'));
      this.query.set('');
      this.status.set('');
      this.page.set(0);
      this.reload();
    });
  }

  reload(): void { this.requests.next(); }

  search(value: string): void {
    this.query.set(value);
    this.page.set(0);
    this.reload();
  }

  filter(value: BarometroState | ''): void {
    this.status.set(value);
    this.page.set(0);
    this.reload();
  }

  changePage(delta: number): void {
    this.page.update(page => page + delta);
    this.reload();
  }

  statusLabel(status: BarometroState): string {
    return states.find(item => item.value === status)?.label ?? status;
  }

  edit(item: BarometroPublication | null = null): void {
    const section = this.section();
    if (!section || (item && item.seccion !== section.code)) return;
    this.dialog.open<BarometroPublicationEditorComponent, EditorData, boolean>(BarometroPublicationEditorComponent, {
      data: {section, item}, width: '720px', maxWidth: 'calc(100vw - 24px)',
      ariaLabel: item ? 'Editar publicación del Barómetro' : 'Nueva publicación del Barómetro', disableClose: true,
    }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(saved => {
      if (saved) this.reload();
    });
  }

  view(publication: BarometroPublication): void {
    const section = this.section();
    if (section?.code !== publication.seccion) return;
    const item = barometroViewerItem(publication);
    if (item.reportUrl) this.viewer.open(item, section.name, 'report', 'barometro');
  }
}

import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, DestroyRef, ElementRef, inject, OnDestroy, signal, ViewChild, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { PublicacionService } from '@core/services/publicacion.service';
import { PdfEngineService } from './pdf-engine.service';
import { hasPublicPdf } from './public-library-publication';
import type { PublicationViewerData, ReaderMode } from './publication-viewer.service';

export function powerBiEmbedUrl(value: string | null): string | null {
  try {
    const url = new URL(value || '');
    if (url.protocol !== 'https:' || url.hostname !== 'app.powerbi.com' || url.username || url.password || url.port) return null;
    if (url.pathname !== '/view' || !url.searchParams.get('r')) return null;
    return url.href;
  } catch { return null; }
}

@Component({
  selector: 'app-publication-viewer', standalone: true,
  imports: [DatePipe, MatDialogModule, MatIconModule],
  templateUrl: './publication-viewer.component.html', styleUrl: './publication-viewer.component.scss',
  encapsulation: ViewEncapsulation.None,
  host: {'[class.reader-fullscreen]': 'fullscreen()'},
})
export class PublicationViewerComponent implements AfterViewInit, OnDestroy {
  readonly data = inject<PublicationViewerData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<PublicationViewerComponent>);
  private readonly publications = inject(PublicacionService);
  private readonly engine = inject(PdfEngineService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly fullscreen = signal(false);
  readonly fullscreenBusy = signal(false);
  private mobile = false;
  private nativeFullscreen = false;
  private previousDisableClose = false;
  private readonly onFullscreenChange = () => {
    const active = globalThis.document.fullscreenElement;
    if (active === this.host.nativeElement) this.nativeFullscreen = true;
    else if (this.nativeFullscreen && (!active || !this.host.nativeElement.contains(active))) {
      this.nativeFullscreen = false;
      this.setFullscreen(false);
    }
  };
  private readonly onFullscreenKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.fullscreen()) {
      event.preventDefault(); event.stopPropagation();
      void this.leaveFullscreen();
    }
  };
  readonly item = this.data.item;
  readonly isAtlas = this.data.context === 'atlas';
  readonly hasPdf = hasPublicPdf(this.item);
  readonly reportUrl = powerBiEmbedUrl(this.item.locked ? null : this.item.reportUrl);
  readonly mode = signal<ReaderMode>(this.data.mode);
  readonly loading = signal(false);
  readonly rendering = signal(false);
  readonly error = signal('');
  readonly page = signal(1);
  readonly total = signal(0);
  readonly zoom = signal('fit');
  readonly info = signal(false);
  readonly outline = signal<{title: string; page: number}[]>([]);
  readonly reportReady = signal(false);
  readonly reportHint = signal(false);
  readonly frameVersion = signal(0);
  safeReportUrl: SafeResourceUrl | null = null;
  @ViewChild('paper') private paper?: ElementRef<HTMLCanvasElement>;
  @ViewChild('documentArea') private area?: ElementRef<HTMLElement>;
  private document?: PDFDocumentProxy;
  private task?: PDFDocumentLoadingTask;
  private renderTask?: RenderTask;
  private resize?: ResizeObserver;
  private destroyed = false;
  private renderId = 0;
  private loadId = 0;
  private frameTimer?: ReturnType<typeof setTimeout>;
  private resizeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.breakpoints.observe('(max-width: 680px)').pipe(takeUntilDestroyed()).subscribe(({matches}) => {
      this.mobile = matches;
      this.resizeDialog();
    });
    if (this.reportUrl) this.safeReportUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.reportUrl);
  }
  ngAfterViewInit(): void {
    globalThis.document.addEventListener('fullscreenchange', this.onFullscreenChange);
    globalThis.document.addEventListener('keydown', this.onFullscreenKey, true);
    if (typeof ResizeObserver !== 'undefined' && this.area) {
      this.resize = new ResizeObserver(() => {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => { if (this.document && this.zoom() === 'fit') void this.render(); }, 100);
      });
      this.resize.observe(this.area.nativeElement);
    }
    this.selectMode(this.mode());
  }
  selectMode(mode: ReaderMode): void {
    this.mode.set(mode);
    if (mode === 'pdf' && !this.document && !this.loading()) void this.load();
    if (mode === 'pdf' && this.document) requestAnimationFrame(() => void this.render());
    if (mode === 'report') this.startReportTimer();
  }
  async load(): Promise<void> {
    if (this.item.locked || !this.hasPdf) { this.error.set('Esta publicación no tiene un PDF disponible.'); return; }
    const id = ++this.loadId;
    this.error.set(''); this.loading.set(true);
    try {
      const bytes = await firstValueFrom(this.publications.loadPdf(this.item).pipe(takeUntilDestroyed(this.destroyRef)));
      if (this.destroyed || id !== this.loadId) return;
      const task = await this.engine.open(bytes);
      if (this.destroyed || id !== this.loadId) { void task.destroy(); return; }
      this.task = task;
      const document = await task.promise;
      if (this.destroyed || id !== this.loadId) return;
      this.document = document; this.total.set(document.numPages); this.page.set(1);
      this.loading.set(false);
      await this.render();
      void this.readOutline(document);
    } catch (error) {
      if (this.destroyed || id !== this.loadId) return;
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      this.error.set(status === 401 || status === 403 ? 'Tu cuenta no tiene acceso a este documento. Inicia sesión con una cuenta autorizada.'
        : status === 409 ? 'Este PDF todavía no tiene una copia guardada. Administración debe importarlo de nuevo desde SharePoint.'
        : status === 404 ? 'El PDF ya no está disponible. Comunícalo al observatorio.'
        : 'No se pudo cargar el PDF. Comprueba tu conexión e inténtalo de nuevo.');
      void this.task?.destroy(); this.task = undefined; this.document = undefined;
    } finally { if (!this.destroyed && id === this.loadId) this.loading.set(false); }
  }
  async render(): Promise<void> {
    if (!this.document || !this.paper || !this.area || this.destroyed || this.mode() !== 'pdf') return;
    const id = ++this.renderId;
    const previous = this.renderTask;
    previous?.cancel();
    try {
      if (previous) await previous.promise.catch(() => undefined);
      const pdfPage = await this.document.getPage(this.page());
      if (this.destroyed || id !== this.renderId) return;
      this.rendering.set(true);
      const canvas = this.paper.nativeElement;
      const natural = pdfPage.getViewport({scale: 1});
      const width = Math.max(100, this.area.nativeElement.clientWidth - 32);
      const scale = this.zoom() === 'fit' ? Math.min(2, width / natural.width) : Number(this.zoom()) / 100;
      const viewport = pdfPage.getViewport({scale});
      const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16_000_000 / (viewport.width * viewport.height)));
      canvas.width = Math.floor(viewport.width * ratio); canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`; canvas.style.height = `${Math.floor(viewport.height)}px`;
      this.renderTask = pdfPage.render({canvas, viewport, transform: [ratio, 0, 0, ratio, 0, 0]});
      await this.renderTask.promise;
      if (id === this.renderId) this.error.set('');
    } catch (error) {
      if (id === this.renderId && !this.destroyed && (error as Error)?.name !== 'RenderingCancelledException') this.error.set('No se pudo mostrar esta página. Intenta cargar el documento de nuevo.');
    } finally { if (id === this.renderId && !this.destroyed) this.rendering.set(false); }
  }
  go(value: number | string): void {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > this.total() || n === this.page()) return;
    this.page.set(n); this.area?.nativeElement.scrollTo?.({top: 0, left: 0}); void this.render();
  }
  setZoom(value: string): void { this.zoom.set(value); void this.render(); }
  toggleInfo(): void { this.info.update(value => !value); }
  async toggleFullscreen(): Promise<void> {
    if (this.fullscreenBusy()) return;
    if (this.fullscreen()) { await this.leaveFullscreen(); return; }
    this.fullscreenBusy.set(true);
    this.setFullscreen(true);
    try {
      // Invoke directly from the click so the browser retains user activation.
      // The expanded dialog also works where native fullscreen is unavailable.
      await this.host.nativeElement.requestFullscreen?.();
    } catch { /* Keep the expanded reader when the browser rejects fullscreen. */ }
    finally { if (!this.destroyed) this.fullscreenBusy.set(false); }
  }
  async leaveFullscreen(): Promise<void> {
    const active = globalThis.document.fullscreenElement;
    if (active && this.host.nativeElement.contains(active)) {
      try { await globalThis.document.exitFullscreen(); }
      catch { return; }
    }
    if (!this.destroyed) { this.nativeFullscreen = false; this.setFullscreen(false); }
  }
  private setFullscreen(value: boolean): void {
    if (this.destroyed || this.fullscreen() === value) return;
    if (value) {
      this.previousDisableClose = this.ref.disableClose ?? false;
      this.ref.disableClose = true;
      this.ref.addPanelClass('publication-reader-expanded');
    } else {
      this.ref.disableClose = this.previousDisableClose;
      this.ref.removePanelClass('publication-reader-expanded');
    }
    this.fullscreen.set(value);
    this.resizeDialog();
    requestAnimationFrame(() => {
      if (this.destroyed) return;
      this.host.nativeElement.querySelector<HTMLButtonElement>(value ? '[aria-label="Salir de pantalla completa"]' : '[aria-label="Pantalla completa"]')?.focus({preventScroll: true});
      if (this.document) void this.render();
    });
  }
  private resizeDialog(): void {
    const expanded = this.fullscreen() || this.mobile;
    this.ref.updateSize(expanded ? '100vw' : 'calc(100vw - 40px)', expanded ? '100dvh' : 'calc(100dvh - 32px)');
  }
  frameLoaded(): void { this.reportReady.set(true); clearTimeout(this.frameTimer); this.reportHint.set(true); }
  retryReport(): void { this.reportReady.set(false); this.frameVersion.update(value => value + 1); this.startReportTimer(); }
  private startReportTimer(): void {
    clearTimeout(this.frameTimer); this.reportHint.set(false);
    this.frameTimer = setTimeout(() => this.reportHint.set(true), 15000);
  }
  private async readOutline(document: PDFDocumentProxy): Promise<void> {
    try {
      const entries = await document.getOutline();
      const result: {title: string; page: number}[] = [];
      const visit = async (nodes: NonNullable<typeof entries>, depth = 0): Promise<void> => {
        for (const node of nodes) {
          if (result.length >= 150 || this.destroyed) break;
          const dest = typeof node.dest === 'string' ? await document.getDestination(node.dest) : node.dest;
          if (dest?.[0] !== undefined) {
            const index = typeof dest[0] === 'number' ? dest[0] : await document.getPageIndex(dest[0]);
            result.push({title: `${'· '.repeat(Math.min(depth, 2))}${node.title}`, page: index + 1});
          }
          if (node.items?.length) await visit(node.items, depth + 1);
        }
      };
      if (entries) await visit(entries);
      if (!this.destroyed) this.outline.set(result);
    } catch { /* Un documento sin índice sigue siendo legible. */ }
  }
  ngOnDestroy(): void {
    this.destroyed = true; ++this.loadId; ++this.renderId;
    globalThis.document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    globalThis.document.removeEventListener('keydown', this.onFullscreenKey, true);
    const active = globalThis.document.fullscreenElement;
    if (active && this.host.nativeElement.contains(active)) void globalThis.document.exitFullscreen().catch(() => undefined);
    this.resize?.disconnect(); clearTimeout(this.resizeTimer); clearTimeout(this.frameTimer);
    this.renderTask?.cancel(); void this.task?.destroy();
  }
}

import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { Departamento } from '@core/models';
import {
  SharePointAtlasImportResponse,
  SharePointBrowserItem,
  SharePointBrowseResponse,
} from '@core/models/publicacion/publicacion.interface';
import {
  PublicacionService,
  SharePointImportTarget,
} from '@core/services/publicacion.service';

interface DialogData {
  departamentos: Departamento[];
  target?: SharePointImportTarget;
}

@Component({
  selector: 'app-sharepoint-atlas-import-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './sharepoint-atlas-import-dialog.component.html',
  styleUrl: './sharepoint-atlas-import-dialog.component.scss',
})
export class SharePointAtlasImportDialogComponent {
  private readonly publicacionService = inject(PublicacionService);
  private readonly dialogRef = inject(MatDialogRef<SharePointAtlasImportDialogComponent>);
  private readonly destroyRef = inject(DestroyRef);
  readonly data = inject<DialogData>(MAT_DIALOG_DATA);
  readonly target: SharePointImportTarget = this.data.target ?? 'atlas';
  readonly rootLabel = this.target === 'articulos' ? 'Barómetro' : 'Atlas';
  readonly destinationLabel = this.target === 'articulos' ? 'Artículos' : 'Atlas PDF';

  selectedDepartamentoId = signal<string>(this.data.departamentos[0]?.id ?? '');
  browser = signal<SharePointBrowseResponse | null>(null);
  loading = signal(false);
  importing = signal(false);
  error = signal<string | null>(null);
  selectedFiles = signal<Map<string, SharePointBrowserItem>>(new Map());
  private readonly folderCache = new Map<string, SharePointBrowseResponse>();

  visiblePdfItems = computed(() => this.browser()?.items.filter((item) => item.selectable) ?? []);
  selectedCount = computed(() => this.selectedFiles().size);
  allVisibleSelected = computed(() => {
    const visible = this.visiblePdfItems();
    return visible.length > 0 && visible.every((item) => this.selectedFiles().has(item.id));
  });

  constructor() {
    if (this.selectedDepartamentoId()) {
      this.loadFolder(null);
    }
  }

  changeDepartamento(departamentoId: string): void {
    this.selectedDepartamentoId.set(departamentoId);
    this.selectedFiles.set(new Map());
    this.folderCache.clear();
    this.loadFolder(null);
  }

  loadFolder(itemId: string | null): void {
    const departamentoId = this.selectedDepartamentoId();
    if (!departamentoId) return;
    const cacheKey = `${departamentoId}:${itemId ?? 'root'}`;
    const cachedFolder = this.folderCache.get(cacheKey);
    if (cachedFolder) {
      this.browser.set(cachedFolder);
      this.loading.set(false);
      this.error.set(null);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.publicacionService
      .browseSharePointFolder(departamentoId, this.target, itemId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (browser) => {
          this.folderCache.set(cacheKey, browser);
          this.browser.set(browser);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudo cargar la carpeta de SharePoint.');
          this.loading.set(false);
        },
      });
  }

  openFolder(item: SharePointBrowserItem): void {
    if (item.type === 'folder') {
      this.loadFolder(item.id);
    }
  }

  goBack(): void {
    const parent = this.browser()?.parent;
    if (parent?.id) {
      this.loadFolder(parent.id);
    }
  }

  toggleFile(item: SharePointBrowserItem, checked: boolean): void {
    if (!item.selectable) return;
    const next = new Map(this.selectedFiles());
    checked ? next.set(item.id, item) : next.delete(item.id);
    this.selectedFiles.set(next);
  }

  toggleVisible(checked: boolean): void {
    const next = new Map(this.selectedFiles());
    for (const item of this.visiblePdfItems()) {
      checked ? next.set(item.id, item) : next.delete(item.id);
    }
    this.selectedFiles.set(next);
  }

  isSelected(item: SharePointBrowserItem): boolean {
    return this.selectedFiles().has(item.id);
  }

  importSelected(): void {
    const departamentoId = this.selectedDepartamentoId();
    const ids = Array.from(this.selectedFiles().keys());
    if (!departamentoId || ids.length === 0 || this.importing()) return;

    this.importing.set(true);
    this.error.set(null);
    this.publicacionService
      .importManySharePoint(departamentoId, this.target, ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.dialogRef.close(result),
        error: () => {
          this.error.set('No se pudo completar la importacion desde SharePoint.');
          this.importing.set(false);
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  formatSize(size?: number | null): string {
    if (!size) return '-';
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  resultMessage(result: SharePointAtlasImportResponse): string {
    return [
      `${result.totals.imported} importados`,
      `${result.totals.duplicates} duplicados`,
      `${result.totals.rejected} rechazados`,
      `${result.totals.errors} errores`,
    ].join(' · ');
  }
}

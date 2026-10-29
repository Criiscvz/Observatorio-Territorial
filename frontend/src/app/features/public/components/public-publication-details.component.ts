import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { hasPublicPdf, PublicLibraryPublication } from './public-library-publication';
import { PublicationViewerService, ReaderMode } from './publication-viewer.service';

@Component({
  selector: 'app-public-publication-details',
  standalone: true,
  imports: [DatePipe, MatDialogModule, MatIconModule],
  templateUrl: './public-publication-details.component.html',
  styleUrl: './public-publication-details.component.scss',
})
export class PublicPublicationDetailsComponent {
  readonly data = inject<{item: PublicLibraryPublication; departmentName: string; context?: 'atlas'}>(MAT_DIALOG_DATA);
  private readonly viewer = inject(PublicationViewerService);
  readonly hasPdf = hasPublicPdf;
  readonly item = this.data.item;
  readonly typeLabel = this.data.context === 'atlas' ? 'Atlas' : {ARTICULO: 'Artículo', REPORTE: 'Reporte Power BI', LIBRO: 'Libro PDF'}[this.item.type];

  openPdf(): void {
    if (!this.hasPdf(this.item)) return;
    this.openViewer('pdf');
  }
  openViewer(mode: ReaderMode): void {
    if (this.data.context) this.viewer.open(this.item, this.data.departmentName, mode, this.data.context);
    else this.viewer.open(this.item, this.data.departmentName, mode);
  }
}

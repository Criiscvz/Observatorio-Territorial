import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PublicLibraryPublication } from './public-library-publication';
import { PublicationViewerComponent } from './publication-viewer.component';

export type ReaderMode = 'pdf' | 'report';
export interface PublicationViewerData { item: PublicLibraryPublication; departmentName: string; mode: ReaderMode; context?: 'atlas'; localPdf?: File; }

@Injectable({providedIn: 'root'})
export class PublicationViewerService {
  private readonly dialog = inject(MatDialog);
  open(item: PublicLibraryPublication, departmentName: string, mode: ReaderMode, context?: 'atlas', localPdf?: File): void {
    if (item.locked) return;
    this.dialog.open(PublicationViewerComponent, {
      data: {item, departmentName, mode, ...(context ? {context} : {}), ...(localPdf ? {localPdf} : {})} satisfies PublicationViewerData,
      panelClass: 'publication-reader-panel', backdropClass: 'publication-reader-backdrop',
      width: 'calc(100vw - 40px)', maxWidth: '1440px', height: 'calc(100dvh - 32px)',
      maxHeight: '100dvh', autoFocus: 'dialog', restoreFocus: true,
      ariaLabel: `Visor de ${item.title}`,
    });
  }
}

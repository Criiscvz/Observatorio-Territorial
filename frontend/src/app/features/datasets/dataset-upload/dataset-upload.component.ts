import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { DatasetUploadFacade } from './dataset-upload.facade';

/**
 * Componente de vista para la carga de datasets.
 *
 * Actúa únicamente como controlador de presentación (View en MVVM):
 * - Captura eventos del DOM (drag-and-drop, selección de archivo).
 * - Delega toda la lógica de negocio y orquestación HTTP al `DatasetUploadFacade`.
 * - Expone las señales del Façade directamente a la plantilla.
 */
@Component({
  selector: 'app-dataset-upload',
  standalone: true,
  providers: [DatasetUploadFacade],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatProgressBarModule,
    MatStepperModule,
    MatCheckboxModule,
    MatChipsModule,
    MatTooltipModule,
    MatExpansionModule,
    TranslateModule,
  ],
  templateUrl: './dataset-upload.component.html',
  styleUrl: './dataset-upload.component.scss',
})
export class DatasetUploadComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  /** El Façade expone todo el estado y la lógica de negocio a la plantilla */
  readonly facade = inject(DatasetUploadFacade);

  ngOnInit(): void {
    this.facade.loadDepartamentos();

    // Pre-seleccionar departamento si viene en query params
    const deptoId = this.route.snapshot.queryParams['departamento'];
    if (deptoId) {
      this.facade.uploadForm.patchValue({ departamento_id: deptoId });
    }
  }

  // ── Manejadores de eventos DOM (sin lógica de negocio) ───────────────────

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.facade.selectedFile.set(input.files[0]);
      this.facade.error.set(null);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.facade.selectedFile.set(files[0]);
      this.facade.error.set(null);
    }
  }

  clearFile(event: Event): void {
    event.stopPropagation();
    this.facade.selectedFile.set(null);
  }
}

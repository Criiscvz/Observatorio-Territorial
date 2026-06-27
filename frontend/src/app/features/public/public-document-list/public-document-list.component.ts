import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

interface DocumentoPdf {
  id: string;
  nombre: string;
  ruta: string;
  fecha: string;
  size: string;
}

@Component({
  selector: 'app-public-document-list',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, RouterLink],
  templateUrl: './public-document-list.component.html',
  styleUrl: './public-document-list.component.scss',
})
export class PublicDocumentListComponent {
  documentos: DocumentoPdf[] = [
    {
      id: 'recuperacion-economica',
      nombre: 'Recuperación Económica',
      ruta: '/1-recuperacion-economica.pdf',
      fecha: '2025',
      size: '1.4 MB'
    },
    {
      id: 'recaudacion-tributaria',
      nombre: 'Recaudación Tributaria',
      ruta: '/observatorio/3.%20recaudacion_tributaria.pdf',
      fecha: '2025',
      size: '1.5 MB'
    }
  ];
}

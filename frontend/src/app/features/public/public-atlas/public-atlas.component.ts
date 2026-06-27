import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule } from '@ngx-translate/core';

interface PublicacionAtlas {
  id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  categoria: string;
  autor: string;
  paginas: number;
  tamano: string;
  pdfUrl: string;
}

@Component({
  selector: 'app-public-atlas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    TranslateModule,
  ],
  templateUrl: './public-atlas.component.html',
  styleUrl: './public-atlas.component.scss',
})
export class PublicAtlasComponent {
  searchTerm = signal('');
  selectedCategory = signal<string>('TODAS');

  // Datos mockeados del Atlas
  publicaciones = signal<PublicacionAtlas[]>([
    {
      id: 'pub-001',
      titulo: 'Recuperación Económica - Informe de Indicadores',
      descripcion: 'Indicadores sobre el crecimiento del Producto Interno Bruto (PIB) a nivel mundial, regional y nacional. Incluye proyecciones y análisis detallado de los sectores productivos con mayor crecimiento en el Ecuador.',
      fecha: '2025-11-20',
      categoria: 'Economía',
      autor: 'Observatorio Territorial Multidisciplinario - ULEAM',
      paginas: 9,
      tamano: '1.3 MB',
      pdfUrl: '/1-recuperacion-economica.pdf',
    },
    {
      id: 'pub-002',
      titulo: 'Atlas de la Biodiversidad Costera del Ecuador',
      descripcion: 'Estudio territorial exhaustivo sobre la preservación de ecosistemas marinos, inventariado de especies marinas locales y propuestas de zonificación para la conservación en el perfil costanero manabita.',
      fecha: '2026-03-15',
      categoria: 'Vitalidad Ecológica',
      autor: 'Facultad de Ciencias del Mar - ULEAM',
      paginas: 45,
      tamano: '4.2 MB',
      pdfUrl: '/1-recuperacion-economica.pdf', // Se usa el PDF real de prueba
    },
    {
      id: 'pub-003',
      titulo: 'Manual de Gobernanza y Presupuestos Participativos',
      descripcion: 'Un marco metodológico para guiar la toma de decisiones comunitarias y la asignación transparente de presupuestos participativos en los gobiernos autónomos descentralizados (GAD).',
      fecha: '2026-05-10',
      categoria: 'Gobernanza',
      autor: 'Observatorio de Gobernanza Territorial',
      paginas: 28,
      tamano: '2.1 MB',
      pdfUrl: '/1-recuperacion-economica.pdf', // Se usa el PDF real de prueba
    },
    {
      id: 'pub-004',
      titulo: 'Atlas Cultural de Manabí: Saberes y Expresiones Vivas',
      descripcion: 'Compendio e investigación de campo sobre la herencia cultural inmaterial de la provincia de Manabí: tradiciones orales, artesanías, música autóctona y gastronomía patrimonial.',
      fecha: '2026-01-20',
      categoria: 'Cultura',
      autor: 'Centro de Investigaciones Históricas - ULEAM',
      paginas: 60,
      tamano: '8.5 MB',
      pdfUrl: '/1-recuperacion-economica.pdf', // Se usa el PDF real de prueba
    },
  ]);

  // Categorías únicas
  categorias = computed<string[]>(() => {
    const list = this.publicaciones().map((p) => p.categoria);
    return ['TODAS', ...Array.from(new Set(list))];
  });

  // Filtrado de publicaciones
  filteredPublicaciones = computed<PublicacionAtlas[]>(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const cat = this.selectedCategory();
    let list = this.publicaciones();

    if (cat !== 'TODAS') {
      list = list.filter((p) => p.categoria === cat);
    }

    if (term) {
      list = list.filter(
        (p) =>
          p.titulo.toLowerCase().includes(term) ||
          p.descripcion.toLowerCase().includes(term) ||
          p.autor.toLowerCase().includes(term) ||
          p.categoria.toLowerCase().includes(term),
      );
    }

    return list;
  });

  onSearch(term: string): void {
    this.searchTerm.set(term);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  selectCategory(cat: string): void {
    this.selectedCategory.set(cat);
  }

  getCategoryIcon(cat: string): string {
    switch (cat) {
      case 'Economía':
        return 'trending_up';
      case 'Vitalidad Ecológica':
        return 'eco';
      case 'Gobernanza':
        return 'groups';
      case 'Cultura':
        return 'theater_comedy';
      default:
        return 'menu_book';
    }
  }

  getCategoryColor(cat: string): string {
    switch (cat) {
      case 'Economía':
        return '#C8102E'; // ULEAM Red
      case 'Vitalidad Ecológica':
        return '#10B981'; // Green
      case 'Gobernanza':
        return '#6366F1'; // Indigo
      case 'Cultura':
        return '#F59E0B'; // Amber
      default:
        return '#8B5CF6'; // Purple
    }
  }
}

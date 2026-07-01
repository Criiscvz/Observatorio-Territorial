import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface PublicacionAtlas {
  id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  categoria: string;
  autor: string;
  paginas: number;
  tamano: string;
  pdfUrl: string;
  creado_por_id: number;
}

const STORAGE_KEY = 'observatorio_atlas_publications';

const DEFAULT_PUBLICATIONS: PublicacionAtlas[] = [
  {
    id: 'pub-001',
    titulo: 'Recuperación Económica - Informe de Indicadores',
    descripcion: 'Indicadores sobre el crecimiento del Producto Interno Burto (PIB) a nivel mundial, regional y nacional. Incluye proyecciones y análisis detallado de los sectores productivos con mayor crecimiento en el Ecuador.',
    fecha: '2025-11-20',
    categoria: 'Economía',
    autor: 'Observatorio Territorial Multidisciplinario - ULEAM',
    paginas: 9,
    tamano: '1.3 MB',
    pdfUrl: '/1-recuperacion-economica.pdf',
    creado_por_id: 1,
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
    pdfUrl: '/1-recuperacion-economica.pdf',
    creado_por_id: 2,
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
    pdfUrl: '/1-recuperacion-economica.pdf',
    creado_por_id: 3,
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
    pdfUrl: '/1-recuperacion-economica.pdf',
    creado_por_id: 4,
  },
];

@Injectable({
  providedIn: 'root',
})
export class AtlasService {
  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized(): void {
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PUBLICATIONS));
    }
  }

  getPublications(): Observable<PublicacionAtlas[]> {
    this.ensureInitialized();
    const data = localStorage.getItem(STORAGE_KEY);
    return of(data ? JSON.parse(data) : DEFAULT_PUBLICATIONS);
  }

  getPublication(id: string): Observable<PublicacionAtlas | null> {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const item = list.find((p: any) => p.id === id) || null;
    return of(item);
  }

  createPublication(data: Omit<PublicacionAtlas, 'id'>, userId: number): Observable<PublicacionAtlas> {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const newPub: PublicacionAtlas = {
      ...data,
      id: 'pub-' + Math.random().toString(36).substr(2, 9),
      creado_por_id: userId,
    };
    list.push(newPub);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return of(newPub);
  }

  updatePublication(id: string, data: Partial<PublicacionAtlas>): Observable<PublicacionAtlas> {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const index = list.findIndex((p: any) => p.id === id);
    if (index === -1) {
      throw new Error('Publicación no encontrada');
    }
    const updatedPub = { ...list[index], ...data };
    list[index] = updatedPub;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return of(updatedPub);
  }

  deletePublication(id: string): Observable<boolean> {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const newList = list.filter((p: any) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    return of(true);
  }
}

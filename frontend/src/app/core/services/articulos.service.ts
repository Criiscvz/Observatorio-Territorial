import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface Articulo {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: string;          // Categoría visible al usuario
  tipo_observatorio: string;  // Código del observatorio al que pertenece
  autor: string;
  fecha: string;
  enlace?: string;            // URL del artículo/PDF
  color: string;              // Color de la card
}

export interface ObservatorioConfig {
  codigo: string;
  powerbi_url?: string;
  powerbi_label?: string;
}

// Configuración de PowerBI por observatorio/barómetro
const POWERBI_CONFIG: ObservatorioConfig[] = [
  {
    codigo: 'investigacion',
    powerbi_url: 'https://app.powerbi.com/view?r=investigacion-uleam',
    powerbi_label: 'Dashboard de Investigación',
  },
  {
    codigo: 'vinculacion',
    powerbi_url: 'https://app.powerbi.com/view?r=vinculacion-uleam',
    powerbi_label: 'Dashboard de Vinculación',
  },
  {
    codigo: 'barometro',
    powerbi_url: 'https://app.powerbi.com/view?r=barometro-uleam',
    powerbi_label: 'Barómetro ULEAM',
  },
  {
    codigo: 'economia',
    powerbi_url: 'https://app.powerbi.com/view?r=economia-uleam',
    powerbi_label: 'Dashboard Económico',
  },
  {
    codigo: 'ecologia',
    powerbi_url: 'https://app.powerbi.com/view?r=ecologia-uleam',
    powerbi_label: 'Dashboard Ecológico',
  },
  {
    codigo: 'gobernanza',
    powerbi_url: 'https://app.powerbi.com/view?r=gobernanza-uleam',
    powerbi_label: 'Dashboard de Gobernanza',
  },
  {
    codigo: 'cultura',
    powerbi_url: 'https://app.powerbi.com/view?r=cultura-uleam',
    powerbi_label: 'Dashboard Cultural',
  },
];

// Artículos mock por observatorio
const ARTICULOS_MOCK: Articulo[] = [
  // ── Investigación ──────────────────────────────────────────────────────────
  {
    id: 'art-inv-001',
    titulo: 'Producción Científica ULEAM 2024',
    descripcion: 'Análisis cuantitativo y cualitativo de la producción científica de la ULEAM durante el año 2024, incluyendo publicaciones indexadas, proyectos activos y convenios.',
    categoria: 'Ciencia y Tecnología',
    tipo_observatorio: 'investigacion',
    autor: 'Dirección de Investigación - ULEAM',
    fecha: '2025-03-15',
    enlace: '/1-recuperacion-economica.pdf',
    color: '#6366F1',
  },
  {
    id: 'art-inv-002',
    titulo: 'Impacto de Proyectos de I+D en Manabí',
    descripcion: 'Evaluación del impacto socioeconómico de los proyectos de investigación y desarrollo ejecutados por la ULEAM en la provincia de Manabí.',
    categoria: 'Impacto Social',
    tipo_observatorio: 'investigacion',
    autor: 'Centro de Investigaciones Sociales - ULEAM',
    fecha: '2025-05-20',
    enlace: '/1-recuperacion-economica.pdf',
    color: '#EC4899',
  },
  {
    id: 'art-inv-003',
    titulo: 'Fondos de Investigación: Fuentes y Distribución',
    descripcion: 'Reporte sobre las fuentes de financiamiento de investigación obtenidas, distribución por facultades y eficiencia en la ejecución presupuestaria.',
    categoria: 'Financiamiento',
    tipo_observatorio: 'investigacion',
    autor: 'Departamento Financiero - ULEAM',
    fecha: '2025-07-01',
    color: '#14B8A6',
  },

  // ── Vinculación ────────────────────────────────────────────────────────────
  {
    id: 'art-vin-001',
    titulo: 'Programas de Vinculación Comunitaria 2024',
    descripcion: 'Sistematización de los programas de vinculación con la colectividad ejecutados durante 2024, beneficiarios directos e indirectos y lecciones aprendidas.',
    categoria: 'Vinculación Social',
    tipo_observatorio: 'vinculacion',
    autor: 'Dirección de Vinculación - ULEAM',
    fecha: '2025-02-10',
    enlace: '/1-recuperacion-economica.pdf',
    color: '#F59E0B',
  },
  {
    id: 'art-vin-002',
    titulo: 'Alianzas Estratégicas con el Sector Productivo',
    descripcion: 'Informe sobre los convenios y alianzas estratégicas establecidas con empresas, gremios y organismos del sector productivo de Manabí y el Ecuador.',
    categoria: 'Convenios',
    tipo_observatorio: 'vinculacion',
    autor: 'Relaciones Institucionales - ULEAM',
    fecha: '2025-04-18',
    color: '#8B5CF6',
  },

  // ── Barómetro ULEAM ────────────────────────────────────────────────────────
  {
    id: 'art-bar-001',
    titulo: 'Barómetro de Satisfacción Estudiantil 2025',
    descripcion: 'Resultados de la encuesta de satisfacción estudiantil aplicada a 3.500 estudiantes de la ULEAM, con análisis por carreras, facultades y servicios universitarios.',
    categoria: 'Satisfacción Estudiantil',
    tipo_observatorio: 'barometro',
    autor: 'Dirección de Bienestar Estudiantil - ULEAM',
    fecha: '2025-06-01',
    enlace: '/1-recuperacion-economica.pdf',
    color: '#EF4444',
  },
  {
    id: 'art-bar-002',
    titulo: 'Indicadores de Gestión Académica',
    descripcion: 'Seguimiento de los principales indicadores de gestión académica: tasa de aprobación, deserción estudiantil, titulación oportuna y rendimiento docente.',
    categoria: 'Gestión Académica',
    tipo_observatorio: 'barometro',
    autor: 'Vicerrectorado Académico - ULEAM',
    fecha: '2025-01-20',
    color: '#06B6D4',
  },

  // ── Economía ───────────────────────────────────────────────────────────────
  {
    id: 'art-eco-001',
    titulo: 'Recuperación Económica Post-Pandemia en Manabí',
    descripcion: 'Indicadores sobre el crecimiento del PIB a nivel regional y análisis de los sectores productivos con mayor recuperación tras la pandemia.',
    categoria: 'Macroeconomía',
    tipo_observatorio: 'economia',
    autor: 'Observatorio Territorial Multidisciplinario - ULEAM',
    fecha: '2025-11-20',
    enlace: '/1-recuperacion-economica.pdf',
    color: '#C8102E',
  },
  {
    id: 'art-eco-002',
    titulo: 'Recaudación Tributaria Manabí 2024',
    descripcion: 'Análisis de la recaudación tributaria en la provincia de Manabí, tendencias, sectores de mayor aporte y proyecciones para el próximo período fiscal.',
    categoria: 'Tributación',
    tipo_observatorio: 'economia',
    autor: 'Observatorio Económico - ULEAM',
    fecha: '2025-09-15',
    color: '#F97316',
  },

  // ── Ecología ───────────────────────────────────────────────────────────────
  {
    id: 'art-ecol-001',
    titulo: 'Biodiversidad Costera del Ecuador',
    descripcion: 'Estudio territorial sobre la preservación de ecosistemas marinos e inventariado de especies en el perfil costanero manabita.',
    categoria: 'Biodiversidad',
    tipo_observatorio: 'ecologia',
    autor: 'Facultad de Ciencias del Mar - ULEAM',
    fecha: '2026-03-15',
    enlace: '/1-recuperacion-economica.pdf',
    color: '#10B981',
  },

  // ── Gobernanza ─────────────────────────────────────────────────────────────
  {
    id: 'art-gob-001',
    titulo: 'Presupuestos Participativos en GADs de Manabí',
    descripcion: 'Marco metodológico para la toma de decisiones comunitarias y asignación transparente de presupuestos en los gobiernos autónomos descentralizados.',
    categoria: 'Presupuesto Público',
    tipo_observatorio: 'gobernanza',
    autor: 'Observatorio de Gobernanza Territorial',
    fecha: '2026-05-10',
    color: '#6366F1',
  },

  // ── Cultura ────────────────────────────────────────────────────────────────
  {
    id: 'art-cul-001',
    titulo: 'Saberes y Expresiones Culturales de Manabí',
    descripcion: 'Compendio de la herencia cultural inmaterial de Manabí: tradiciones orales, artesanías, música autóctona y gastronomía patrimonial.',
    categoria: 'Patrimonio Inmaterial',
    tipo_observatorio: 'cultura',
    autor: 'Centro de Investigaciones Históricas - ULEAM',
    fecha: '2026-01-20',
    enlace: '/1-recuperacion-economica.pdf',
    color: '#F59E0B',
  },
];

@Injectable({ providedIn: 'root' })
export class ArticulosService {

  /**
   * Retorna artículos filtrados por el código del observatorio.
   * El código puede ser: investigacion, vinculacion, barometro, economia, ecologia, gobernanza, cultura
   * También acepta el codigo_interno del departamento (e.g. "eco-001") — en ese caso se busca por prefijo.
   */
  getByObservatorio(codigo: string): Observable<Articulo[]> {
    const normalizado = this.normalizarCodigo(codigo);
    const result = ARTICULOS_MOCK.filter(
      (a) => a.tipo_observatorio === normalizado
    );
    return of(result);
  }

  /**
   * Retorna la configuración de PowerBI para un observatorio dado.
   */
  getPowerBIConfig(codigo: string): ObservatorioConfig | null {
    const normalizado = this.normalizarCodigo(codigo);
    return POWERBI_CONFIG.find((c) => c.codigo === normalizado) || null;
  }

  /**
   * Retorna artículos agrupados por categoría.
   */
  agruparPorCategoria(articulos: Articulo[]): { categoria: string; items: Articulo[] }[] {
    const mapa = new Map<string, Articulo[]>();
    for (const art of articulos) {
      if (!mapa.has(art.categoria)) {
        mapa.set(art.categoria, []);
      }
      mapa.get(art.categoria)!.push(art);
    }
    return Array.from(mapa.entries()).map(([categoria, items]) => ({ categoria, items }));
  }

  /** Normaliza el codigo_interno del departamento al código de artículo */
  private normalizarCodigo(codigo: string): string {
    const lower = codigo.toLowerCase();
    if (lower.includes('investig')) return 'investigacion';
    if (lower.includes('vincul')) return 'vinculacion';
    if (lower.includes('baromet') || lower.includes('barometro')) return 'barometro';
    if (lower.includes('econ')) return 'economia';
    if (lower.includes('ecol') || lower.includes('vitalidad')) return 'ecologia';
    if (lower.includes('gobern')) return 'gobernanza';
    if (lower.includes('cultur')) return 'cultura';
    return lower;
  }
}

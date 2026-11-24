import type { BarometroPage, BarometroPublication } from '@core/services/barometro.service';

export function barometroPublication(overrides: Partial<BarometroPublication> = {}): BarometroPublication {
  return {
    id: 7,
    seccion: 'investigacion',
    titulo: 'Indicadores de investigación',
    fecha_publicacion: '2026-11-23',
    fuente: 'ULEAM',
    descripcion: 'Resultados del periodo.',
    link_url: 'https://app.powerbi.com/view?r=investigacion',
    estado: 'PUBLICACION',
    ...overrides,
  };
}

export function barometroPage(data: BarometroPublication[] = [], currentPage = 1, total = data.length): BarometroPage {
  return {
    data,
    meta: {
      total,
      current_page: currentPage,
      last_page: Math.max(1, Math.ceil(total / 20)),
      per_page: 20,
    },
  };
}

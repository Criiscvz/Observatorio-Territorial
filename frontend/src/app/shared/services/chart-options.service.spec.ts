import { TestBed } from '@angular/core/testing';
import { ChartThemeService } from '@core/services/chart-theme.service';
import { echarts } from '@core/config/echarts.config';
import { SVGRenderer } from 'echarts/renderers';
import { ChartOptionsService } from './chart-options.service';

// This spec covers polar/radar only. The real word-cloud extension is exercised
// with canvas in the browser smoke test, not in jsdom's canvas-less environment.
vi.mock('echarts-wordcloud', () => ({}));

// The SVG renderer is test-only; production keeps its existing canvas renderer.
// The chart/component registry and generated options are the real application code.
echarts.use([SVGRenderer]);

describe('ChartOptionsService rendering regressions', () => {
  let service: ChartOptionsService;
  const colors = ['#6366F1', '#EC4899', '#14B8A6', '#F59E0B', '#EF4444', '#8B5CF6'];
  const config = {
    colors, textColor: '#111827', textColorSecondary: '#6B7280',
    splitLineColor: '#E5E7EB', tooltipBg: '#fff', tooltipBorder: '#E5E7EB',
  };

  beforeEach(() => {
    // jsdom has no canvas implementation. Only font metrics used by SVG layout
    // are deterministic here; the browser smoke test uses the real canvas renderer.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      measureText: (text: string) => ({ width: text.length * 7 }),
    } as unknown as CanvasRenderingContext2D);
    TestBed.configureTestingModule({ providers: [
      ChartOptionsService,
      { provide: ChartThemeService, useValue: { getColors: () => colors, config: () => config } },
    ] });
    service = TestBed.inject(ChartOptionsService);
  });

  afterEach(() => vi.restoreAllMocks());

  function render(type: string, values: number[]) {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const data = {
      variable: 'Datos ficticios', tipo: 'categorical' as const, chart_type: 'bar' as const,
      data: { labels: values.map((_, i) => `Grupo ${i + 1}`), values },
    };
    const option = service.getUnivariableOptions(data, type);
    const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 600, height: 400 });
    try {
      chart.setOption({ ...option, animation: false });
      const svg = chart.renderToSVGString();
      expect(svg).toContain('<svg');
      expect(svg).toContain('<path');
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      return option;
    } finally {
      chart.dispose();
    }
  }

  it('renders polar bars using the production component registry', () => {
    const option = render('polar_bar', [12, 24, 18]);
    expect((option.series as any[])[0].coordinateSystem).toBe('polar');
  });

  it.each([[12, 24, 18], [0, 0, 0], [0.1, 0.2, 0.3], [140, 210, 180], [1e6, 2e6, 3e6]])(
    'renders radar values %j without unreadable tick warnings', (...values) => {
      const option = render('radar', values);
      const radar = option.radar as any;
      expect(radar.indicator.every((axis: any) => Number.isFinite(axis.max)
        && axis.max > Math.max(...values))).toBe(true);
      expect([4, 5, 6]).toContain(radar.splitNumber);
    },
  );
});

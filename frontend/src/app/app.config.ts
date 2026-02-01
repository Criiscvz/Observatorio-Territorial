import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts/core';
import { 
  BarChart, 
  PieChart, 
  LineChart, 
  ScatterChart, 
  HeatmapChart, 
  RadarChart, 
  TreemapChart, 
  FunnelChart, 
  GaugeChart,
  BoxplotChart
} from 'echarts/charts';
import { 
  GridComponent, 
  TooltipComponent, 
  LegendComponent, 
  TitleComponent, 
  DataZoomComponent, 
  GraphicComponent, 
  VisualMapComponent,
  RadarComponent,
  MarkLineComponent,
  MarkPointComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { repositoryProviders } from './core/di/providers';

// Registrar componentes de ECharts
echarts.use([
  // Charts
  BarChart,
  PieChart,
  LineChart,
  ScatterChart,
  HeatmapChart,
  RadarChart,
  TreemapChart,
  FunnelChart,
  GaugeChart,
  BoxplotChart,
  // Components
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  GraphicComponent,
  VisualMapComponent,
  RadarComponent,
  MarkLineComponent,
  MarkPointComponent,
  // Renderer
  CanvasRenderer,
]);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideEchartsCore({ echarts }),
    ...repositoryProviders,
    // Configuración de ngx-translate para internacionalización
    provideTranslateService({
      defaultLanguage: 'es',
      loader: provideTranslateHttpLoader({
        prefix: './assets/i18n/',
        suffix: '.json'
      })
    }),
  ]
};

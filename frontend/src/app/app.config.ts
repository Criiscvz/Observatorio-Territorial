import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideEchartsCore } from 'ngx-echarts';
import { provideTranslateBrowserLoader } from './core/loaders/translate-browser.loader';

import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { routes } from './app.routes';
import { repositoryProviders } from './core/di/providers';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideEchartsCore({
      echarts: () => import('./core/config/echarts.config').then((m) => m.echarts),
    }),
    ...repositoryProviders,
    // Configuración de ngx-translate para internacionalización
    provideTranslateService({
      fallbackLang: 'es',
      loader: provideTranslateBrowserLoader({
        prefix: '/assets/i18n/',
        suffix: '.json',
      }),
    }),
  ],
};

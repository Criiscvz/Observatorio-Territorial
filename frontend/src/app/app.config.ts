import { isPlatformBrowser } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  PLATFORM_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideEchartsCore } from 'ngx-echarts';
import { provideTranslateBrowserLoader } from './core/loaders/translate-browser.loader';

import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { routes } from './app.routes';
import { repositoryProviders } from './core/di/providers';
import { authInterceptor, retryInterceptor } from './core/interceptors';
import { clearLegacyApiCaches } from './core/utils/pwa-cache';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => {
      if (isPlatformBrowser(inject(PLATFORM_ID))) return clearLegacyApiCaches();
      return undefined;
    }),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, retryInterceptor])),
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
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

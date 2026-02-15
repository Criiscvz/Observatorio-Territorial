import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { TranslateLoader, Translation } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

// Traducciones básicas para SSR (carga rápida inicial)
const SSR_TRANSLATIONS: Record<string, Translation> = {
  es: {
    common: { messages: { loading: 'Cargando...' } },
    public: {
      home: {
        hero: { title: 'Dimensiones Territoriales', titleHighlight: 'Multidisciplinario ULEAM' },
      },
    },
  },
  en: {
    common: { messages: { loading: 'Loading...' } },
    public: {
      home: {
        hero: { title: 'University Data', titleHighlight: 'Observatory ULEAM' },
      },
    },
  },
};

export class TranslateBrowserLoader implements TranslateLoader {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  constructor(
    private readonly prefix: string = '/assets/i18n/',
    private readonly suffix: string = '.json',
  ) {}

  getTranslation(lang: string): Observable<Translation> {
    // En SSR, devolver traducciones mínimas para evitar errores de HTTP
    if (!isPlatformBrowser(this.platformId)) {
      return of(SSR_TRANSLATIONS[lang] || SSR_TRANSLATIONS['es'] || {});
    }

    // En el navegador, cargar traducciones completas vía HTTP
    return this.http.get<Translation>(`${this.prefix}${lang}${this.suffix}`);
  }
}

export function provideTranslateBrowserLoader(config?: { prefix?: string; suffix?: string }) {
  return {
    provide: TranslateLoader,
    useFactory: () => new TranslateBrowserLoader(config?.prefix, config?.suffix),
  };
}

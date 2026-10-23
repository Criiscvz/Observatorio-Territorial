import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
export const DEFAULT_VIEWER_URL = 'https://departamentos.uleam.edu.ec/observatorio-territorial/';
export interface SiteSettings {
    visor_geografico_url: string;
}
@Injectable({ providedIn: 'root' })
export class SiteSettingsService {
    private readonly api = inject(ApiService);
    private readonly platform = inject(PLATFORM_ID);
    readonly viewerUrl = signal(DEFAULT_VIEWER_URL);
    refreshPublic(): void {
        if (!isPlatformBrowser(this.platform))
            return;
        this.api.get<SiteSettings>('/publico/configuracion').subscribe({
            next: value => this.viewerUrl.set(value.visor_geografico_url),
            error: () => { },
        });
    }
    load(): Observable<SiteSettings> {
        return this.api.get<SiteSettings>('/admin/configuracion').pipe(tap(value => this.viewerUrl.set(value.visor_geografico_url)));
    }
    save(url: string): Observable<SiteSettings> {
        return this.api.put<SiteSettings>('/admin/configuracion', { visor_geografico_url: url })
            .pipe(tap(value => this.viewerUrl.set(value.visor_geografico_url)));
    }
}

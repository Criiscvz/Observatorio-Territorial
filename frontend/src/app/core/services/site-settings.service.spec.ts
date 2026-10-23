import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { SiteSettingsService, DEFAULT_VIEWER_URL } from './site-settings.service';
describe('SiteSettingsService', () => {
    let service: SiteSettingsService, http: HttpTestingController;
    beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }); service = TestBed.inject(SiteSettingsService); http = TestBed.inject(HttpTestingController); });
    afterEach(() => http.verify());
    it('actualiza el enlace público desde el servidor', () => { service.refreshPublic(); http.expectOne(environment.apiUrl + '/publico/configuracion').flush({ visor_geografico_url: 'https://example.test/mapa' }); expect(service.viewerUrl()).toBe('https://example.test/mapa'); });
    it('conserva el enlace anterior durante una caída de la API', () => { service.refreshPublic(); http.expectOne(environment.apiUrl + '/publico/configuracion').flush({}, { status: 503, statusText: 'Unavailable' }); expect(service.viewerUrl()).toBe(DEFAULT_VIEWER_URL); });
    it('publica el nuevo enlace solo después de que el guardado tenga éxito', () => { service.save('https://example.test/nuevo').subscribe(); expect(service.viewerUrl()).toBe(DEFAULT_VIEWER_URL); const request = http.expectOne(environment.apiUrl + '/admin/configuracion'); expect(request.request.method).toBe('PUT'); expect(request.request.body).toEqual({ visor_geografico_url: 'https://example.test/nuevo' }); request.flush({ visor_geografico_url: 'https://example.test/nuevo' }); expect(service.viewerUrl()).toBe('https://example.test/nuevo'); });
});

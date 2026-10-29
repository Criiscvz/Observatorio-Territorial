import { AuthService } from '@core/services/auth.service';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { AdminWorkspaceService } from '@core/services/admin-workspace.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { SiteSettingsService } from '@core/services/site-settings.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { MatDialog } from '@angular/material/dialog';
import { AdminHomeComponent, PublicationDestinationComponent, SiteSettingsComponent, httpUrl } from './admin-workspace.component';
describe('Panel operativo', () => {
    it('muestra los totales reales y abre cada tipo en su destino', () => {
        TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AdminWorkspaceService, useValue: { summary: () => of({ observatorios_total: 12, publicaciones_total: 35, pendientes_total: 2, observatorios: [], pendientes: [] }) } }] });
        const fixture = TestBed.createComponent(AdminHomeComponent);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.summary').textContent).toContain('35');
        const hrefs = Array.from(fixture.nativeElement.querySelectorAll('.create-link')).map((link: any) => link.getAttribute('href'));
        expect(hrefs).toEqual(['/admin/publicaciones/nueva?tipo=ARTICULO', '/admin/publicaciones/nueva?tipo=REPORTE', '/admin/publicaciones/nueva?tipo=LIBRO', '/admin/atlas/subir']);
    });
    it('muestra un error recuperable en lugar de inventar ceros', () => {
        TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AdminWorkspaceService, useValue: { summary: () => throwError(() => new Error('offline')) } }] });
        const fixture = TestBed.createComponent(AdminHomeComponent);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[role=alert]')).not.toBeNull();
        expect(fixture.nativeElement.querySelector('.summary')).toBeNull();
    });
    it('conserva el tipo elegido y exige observatorio antes de abrir el formulario existente', () => {
        TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: PublicacionService, useValue: {} }, { provide: MatDialog, useValue: {} }, { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ tipo: 'REPORTE' }) } } }, { provide: DepartamentoService, useValue: { getAll: () => of([{ id: 'salud', nombre: 'Salud' }, { id: 'laboral', nombre: 'Laboral' }]) } }] });
        const fixture = TestBed.createComponent(PublicationDestinationComponent);
        fixture.detectChanges();
        expect(fixture.componentInstance.form.controls.tipo.value).toBe('REPORTE');
        expect(fixture.nativeElement.querySelector('button[disabled]')).not.toBeNull();
        fixture.componentInstance.form.controls.departamento.setValue('laboral');
        fixture.detectChanges();
        fixture.nativeElement.querySelector('.form-footer button.primary').click();
        fixture.detectChanges();
        expect(fixture.componentInstance.destination()?.departamento.id).toBe('laboral');
        expect(fixture.nativeElement.querySelector('#publication-editor').textContent).toContain('Reporte Power BI');
    });
});
describe('Configuración del visor', () => {
    function setup() {
        const service = { viewerUrl: signal('https://example.test/original'), load: vi.fn(() => of({ visor_geografico_url: 'https://example.test/original' })), save: vi.fn() };
        TestBed.configureTestingModule({ providers: [{ provide: SiteSettingsService, useValue: service }] });
        const component = TestBed.runInInjectionContext(() => new SiteSettingsComponent());
        component.ngOnInit();
        return { component, service };
    }
    it('rechaza protocolos ejecutables y enlaces incompletos', () => {
        for (const value of ['javascript:alert(1)', 'data:text/html,test', '/mapa', ''])
            expect(httpUrl(new FormControl(value))).toEqual({ httpUrl: true });
        expect(httpUrl(new FormControl('https://mapas.example.test/?capa=1'))).toBeNull();
    });
    it('bloquea envíos duplicados mientras guarda y conserva la dirección recibida', () => {
        const { component, service } = setup();
        const response = new Subject<any>();
        service.save.mockReturnValue(response);
        component.form.controls.url.setValue('https://example.test/nuevo');
        component.save();
        component.save();
        expect(service.save).toHaveBeenCalledExactlyOnceWith('https://example.test/nuevo');
        expect(component.saving()).toBe(true);
        response.next({ visor_geografico_url: 'https://example.test/nuevo' });
        expect(component.saved()).toBe(true);
        expect(component.saving()).toBe(false);
    });
    it('no presenta éxito ni pierde lo escrito si el servidor falla', () => {
        const { component, service } = setup();
        service.save.mockReturnValue(throwError(() => new Error('offline')));
        component.form.controls.url.setValue('https://example.test/nuevo');
        component.save();
        expect(component.saved()).toBe(false);
        expect(component.form.controls.url.value).toBe('https://example.test/nuevo');
        expect(component.error()).toBeTruthy();
        component.reset();
        expect(component.form.controls.url.value).toBe('https://example.test/original');
    });
});

beforeEach(() => TestBed.configureTestingModule({providers:[{provide:AuthService,useValue:{isAdmin:()=>true,isEditor:()=>false,isObservatoryAdmin:()=>false,user:()=>({rol:'ADMIN'}),canReviewObservatory:()=>true}}]}));

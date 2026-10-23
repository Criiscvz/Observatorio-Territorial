import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { WorkspaceSidebarComponent } from './workspace-sidebar.component';
describe('Menú operativo', () => {
    beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([]), provideNoopAnimations()] }));
    it('ofrece al editor Inicio, Observatorios y Publicaciones sin Mis ni secciones administrativas', () => {
        const fixture = TestBed.createComponent(WorkspaceSidebarComponent);
        fixture.componentRef.setInput('editor', true);fixture.detectChanges();
        const links=Array.from(fixture.nativeElement.querySelectorAll('a.workspace-link')).map((el:any)=>el.getAttribute('aria-label'));
        expect(links).toEqual(['Inicio','Observatorios','Publicaciones']);
        expect(fixture.nativeElement.querySelector('.group-label')).toBeNull();
        expect(fixture.nativeElement.textContent).not.toContain('Atlas');
        expect(fixture.nativeElement.textContent).not.toContain('Barómetro');
    });
    it('abre el portal verdadero en otra pestaña y conserva una etiqueta accesible al replegar', () => {
        const fixture = TestBed.createComponent(WorkspaceSidebarComponent);
        fixture.detectChanges();
        const portal = fixture.nativeElement.querySelector('.portal-button');
        expect(portal.getAttribute('href')).toBe('/');
        expect(portal.target).toBe('_blank');
        expect(portal.rel).toContain('noopener');
        fixture.componentRef.setInput('collapsed', true);
        fixture.detectChanges();
        expect(portal.getAttribute('aria-label')).toContain('Ver portal público');
        expect(fixture.nativeElement.querySelector('.workspace-sidebar').classList.contains('collapsed')).toBe(true);
        expect(fixture.nativeElement.querySelector('.collapse-button')).toBeNull();
    });
    it('ofrece la configuración y comunica el destino sin añadir un segundo botón para replegar', () => {
        const fixture = TestBed.createComponent(WorkspaceSidebarComponent);
        fixture.detectChanges();
        const navigate = vi.fn();
        fixture.componentInstance.navigate.subscribe(navigate);
        vi.spyOn(TestBed.inject(Router),'navigateByUrl').mockResolvedValue(true);
        fixture.nativeElement.querySelector('a[href="/admin/configuracion"]').click();
        expect(navigate).toHaveBeenCalledExactlyOnceWith('/admin/configuracion');
        expect(fixture.nativeElement.querySelector('.collapse-button')).toBeNull();
        expect(fixture.nativeElement.querySelector('a[href="/admin/configuracion"]')).not.toBeNull();
    });
});

import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { MainLayoutComponent } from './main-layout.component';

describe('Apertura del panel administrativo según la sección',()=>{
  const originalWidth=window.innerWidth;
  beforeEach(()=>Object.defineProperty(window,'innerWidth',{value:1280,configurable:true}));
  afterEach(()=>Object.defineProperty(window,'innerWidth',{value:originalWidth,configurable:true}));
  function setup(url:string,admin=true,editor=false){
    const events=new Subject<NavigationEnd>();
    TestBed.configureTestingModule({providers:[{provide:Router,useValue:{url,events}},{provide:AuthService,useValue:{isAdmin:()=>admin,isEditor:()=>editor,isObservatoryAdmin:()=>false}},{provide:ThemeService,useValue:{}}]});
    const component=TestBed.runInInjectionContext(()=>new MainLayoutComponent());
    const sidenav={close:vi.fn(),toggle:vi.fn()};component.sidenav=sidenav as any;
    return {component,sidenav,go:(path:string)=>events.next(new NavigationEnd(1,path,path))};
  }
  it('abre el menú de Inicio y lo repliega al cambiar de sección',()=>{
    const {component,go}=setup('/admin/dashboard');expect(component.sidenavOpen()).toBe(true);
    go('/admin/departamentos');expect(component.sidenavOpen()).toBe(false);
    component.toggleSidenav();expect(component.sidenavOpen()).toBe(true);
    go('/admin/atlas');expect(component.sidenavOpen()).toBe(false);
    go('/admin/dashboard');expect(component.sidenavOpen()).toBe(true);
  });
  it('también mantiene el panel del editor abierto en Inicio y replegado en las otras vistas',()=>{
    const {component,go}=setup('/admin/dashboard',false,true);
    expect(component.usesWorkspaceSidebar).toBe(true);
    expect(component.sidenavOpen()).toBe(true);
    go('/admin/publicaciones');expect(component.sidenavOpen()).toBe(false);
    component.toggleSidenav();expect(component.sidenavOpen()).toBe(true);
    component.onNavigate('/admin/departamentos');expect(component.sidenavOpen()).toBe(false);
  });
  it.each(['/admin/departamentos','/admin/configuracion','/admin/departamentos/observatorio/editar'])('empieza retraído al entrar directamente en %s',path=>{
    const {component}=setup(path);expect(component.sidenavOpen()).toBe(false);
  });
  it('respeta la apertura manual en la sección actual, incluso cuando cambia solo un filtro de URL',()=>{
    const {component,go}=setup('/admin/publicaciones?estado=EN_REVISION');
    component.toggleSidenav();expect(component.sidenavOpen()).toBe(true);
    go('/admin/publicaciones?estado=PUBLICACION');expect(component.sidenavOpen()).toBe(true);
    component.onNavigate('/admin/publicaciones');expect(component.sidenavOpen()).toBe(false);
  });
  it('en móvil usa el botón de cabecera y cierra el panel al elegir un destino',()=>{
    Object.defineProperty(window,'innerWidth',{value:390,configurable:true});
    const {component,sidenav}=setup('/admin/departamentos');
    component.toggleSidenav();expect(sidenav.toggle).toHaveBeenCalledOnce();
    component.onNavigate('/admin/atlas');expect(sidenav.close).toHaveBeenCalledOnce();
  });
  it('conserva el comportamiento del menú de los otros roles',()=>{
    const {component,go}=setup('/admin/datasets',false);expect(component.sidenavOpen()).toBe(true);
    component.toggleSidenav();go('/admin/dashboard');expect(component.sidenavOpen()).toBe(false);
  });
});

import { computed, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { AccountControlsComponent } from '@shared/components/account-controls/account-controls.component';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';
import { User } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { LanguageService } from '@core/services/language.service';
import { SiteSettingsService } from '@core/services/site-settings.service';
import { ThemeService } from '@core/services/theme.service';
import { PublicNavbarComponent } from './public-navbar.component';

describe('Navegación pública compartida', () => {
  function setup(role: User['rol'] | null = 'EDITOR') {
    const user = signal<User | null>(role ? { id: 1, name: 'María Editora', email: 'editor@example.test', rol: role } : null);
    const auth = { user, isAuthenticated: computed(() => !!user()), isAdmin: computed(() => user()?.rol === 'ADMIN'),
      isEditor: computed(() => user()?.rol === 'EDITOR'), logout: vi.fn(() => of(null)) };
    const settings = { viewerUrl: signal('https://example.test/visor'), refreshPublic: vi.fn() };
    TestBed.configureTestingModule({imports: [PublicNavbarComponent, TranslateModule.forRoot()], providers: [
      provideRouter([]), {provide: AuthService, useValue: auth}, {provide: SiteSettingsService, useValue: settings},
      {provide: ThemeService, useValue: {isDark: signal(false), toggleTheme: vi.fn()}},
      {provide: LanguageService, useValue: {currentLang: signal('es'), availableLanguages: [], setLanguage: vi.fn()}},
    ]});
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', {public: {header: {goToPanel: 'Ir al panel', logoutTitle: '¿Cerrar sesión?', logoutMessage: 'Vuelve a iniciar sesión para acceder.',
      loggingOut: 'Cerrando sesión…', roles: {EDITOR: 'Editor', ADMIN: 'Administrador', USER: 'Usuario', SUBSCRIBER: 'Suscriptor'}},
      home: {nav: {geoViewer: 'Visor geográfico', dimensions: 'Observatorios', atlas: 'Atlas', barometer: 'Barómetro', barometerResearch:'Resultados Investigación ULEAM', barometerLinkage:'Resultados Vinculación ULEAM', barometerUleam:'Barómetro ULEAM'}}},
      profile: {title: 'Mi perfil'}, auth: {logout: 'Cerrar sesión'}, common: {buttons: {cancel: 'Cancelar'}}});
    translate.use('es');
    const fixture = TestBed.createComponent(PublicNavbarComponent); fixture.detectChanges();
    return {fixture, component: fixture.componentInstance, account: fixture.debugElement.query(By.directive(AccountControlsComponent))?.componentInstance as AccountControlsComponent | undefined, element: fixture.nativeElement as HTMLElement, auth, user, settings};
  }

  it.each(['ADMIN', 'EDITOR', 'USER', 'SUBSCRIBER'] as const)('muestra nombre y engranaje de perfil junto a salir para %s, sin acceso al panel en el navbar', role => {
    const {element} = setup(role);
    expect(element.querySelector('.account-copy')?.textContent).toContain('María Editora');
    expect(element.querySelector('.account-settings')?.getAttribute('href')).toBe('/perfil');
    expect(element.querySelector('.account-settings mat-icon')?.textContent).toContain('settings');
    expect(element.querySelector('.account-settings')?.nextElementSibling?.classList.contains('account-logout')).toBe(true);
    expect(element.querySelector('.account-logout')).not.toBeNull();
    expect(element.textContent).not.toContain('Ir al panel');
    expect(element.querySelector('.portal-header a[href="/admin/dashboard"]')).toBeNull();
  });

  it('conserva Observatorios y Atlas directos y el visor configurado, con Barómetro desplegable', () => {
    const {element, fixture, settings} = setup(null);
    expect([...element.querySelectorAll('.portal-navigation a')].map(a => a.getAttribute('href')))
      .toEqual(['/publico/departamentos', '/publico/atlas']);
    expect(element.querySelectorAll('.portal-navigation button')).toHaveLength(1);
    expect(element.querySelector('.portal-geo')?.getAttribute('target')).toBe('_blank');
    settings.viewerUrl.set('https://example.test/nuevo'); fixture.detectChanges();
    expect(element.querySelector('.portal-geo')?.getAttribute('href')).toBe('https://example.test/nuevo');
    expect(element.querySelector('.portal-login')).not.toBeNull();
    expect(element.querySelector('.portal-register')).not.toBeNull();
    expect(element.querySelector('.account-controls')).toBeNull();
  });

  it('abre las tres opciones originales de Barómetro y permite cerrar sin navegar', async () => {
    const {element,fixture}=setup(null);
    element.querySelector<HTMLButtonElement>('.portal-barometer')!.click();fixture.detectChanges();
    await fixture.whenStable();
    const menu=document.querySelector('.portal-barometer-menu')!;
    expect([...menu.querySelectorAll('a')].map(a=>a.getAttribute('href'))).toEqual(['/publico/barometro/investigacion','/publico/barometro/vinculacion','/publico/datasets']);
    expect(menu.textContent).toContain('Resultados Investigación ULEAM');
    expect(menu.textContent).toContain('Resultados Vinculación ULEAM');
    expect(menu.textContent).toContain('Barómetro ULEAM');
    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();fixture.detectChanges();
    await vi.waitFor(()=>expect(document.querySelector('.portal-barometer-menu')).toBeNull());
    expect(element.querySelector('.portal-barometer')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('resalta Barómetro dentro de investigación, vinculación y datasets',()=>{
    const {component}=setup(null);
    for(const url of ['/publico/barometro/investigacion','/publico/barometro/vinculacion','/publico/datasets']){
      (TestBed.inject(Router).events as Subject<NavigationEnd>).next(new NavigationEnd(1,url,url));
      expect(component.barometerActive()).toBe(true);
    }
    (TestBed.inject(Router).events as Subject<NavigationEnd>).next(new NavigationEnd(2,'/publico/atlas','/publico/atlas'));
    expect(component.barometerActive()).toBe(false);
  });

  it('no cierra sesión al abrir o cancelar la confirmación, y evita diálogos duplicados', async () => {
    const {account, auth, fixture, element} = setup();
    element.querySelector<HTMLButtonElement>('.account-logout')!.click(); fixture.detectChanges();
    account!.requestLogout();
    expect(auth.logout).not.toHaveBeenCalled();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('¿Cerrar sesión?');
    document.querySelector<HTMLButtonElement>('.confirm-dialog__cancel')!.click();
    await vi.waitFor(() => expect(account!.logoutPending()).toBe(false)); fixture.detectChanges();
    expect(auth.logout).not.toHaveBeenCalled();
    expect(account!.logoutPending()).toBe(false);
    expect(element.querySelector<HTMLButtonElement>('.account-logout')!.disabled).toBe(false);
  });

  it('ejecuta un único cierre al confirmar y bloquea el doble clic durante la petición', async () => {
    const {account, auth, fixture} = setup();
    const response = new Subject<null>(); auth.logout.mockReturnValue(response);
    account!.requestLogout(); fixture.detectChanges();
    document.querySelector<HTMLButtonElement>('.confirm-dialog__confirm')!.click(); fixture.detectChanges();
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(document.querySelector<HTMLButtonElement>('.confirm-dialog__confirm')!.disabled).toBe(true);
    account!.requestLogout(); expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
    response.next(null); response.complete();
    await vi.waitFor(() => expect(account!.logoutPending()).toBe(false)); fixture.detectChanges();
    expect(account!.logoutPending()).toBe(false);
  });

  it('cierra la navegación móvil con Escape o al elegir otra página', () => {
    const {fixture, element, component} = setup();
    element.querySelector<HTMLButtonElement>('.portal-menu-toggle')!.click(); fixture.detectChanges();
    expect(element.querySelector('.portal-menu-toggle')?.getAttribute('aria-expanded')).toBe('true');
    element.querySelector('.portal-header')!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); fixture.detectChanges();
    expect(component.menuOpen()).toBe(false);
    component.menuOpen.set(true);
    (TestBed.inject(Router).events as Subject<NavigationEnd>).next(new NavigationEnd(1, '/publico/atlas', '/publico/atlas'));
    expect(component.menuOpen()).toBe(false);
  });
});

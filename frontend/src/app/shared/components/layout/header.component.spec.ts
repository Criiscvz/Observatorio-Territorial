import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '@core/services/auth.service';
import { LanguageService } from '@core/services/language.service';
import { ThemeService } from '@core/services/theme.service';
import { HeaderComponent } from './header.component';

describe('Encabezado del espacio de trabajo', () => {
  it.each([['ADMIN','Administrador'], ['ADMIN_OBSERVATORIO','Supervisor'], ['EDITOR','Editor'], ['SUBSCRIBER','Suscriptor'], ['USER','Usuario']])('comparte la cuenta con engranaje y salida para %s, conserva el menú lateral y omite navegación pública', (role,label) => {
    const user = signal({name: 'Cuenta de prueba', rol: role});
    TestBed.configureTestingModule({imports: [HeaderComponent, TranslateModule.forRoot()], providers: [
      provideRouter([]),
      {provide: AuthService, useValue: {user, isAuthenticated: computed(() => !!user())}},
      {provide: LanguageService, useValue: {currentLang: signal('es'), availableLanguages: []}},
      {provide: ThemeService, useValue: {isDark: () => true}},
    ]});
    const fixture = TestBed.createComponent(HeaderComponent); fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.account-copy')?.textContent).toContain('Cuenta de prueba');
    expect(element.querySelector('.account-role')?.textContent?.trim()).toBe(label);
    expect(element.querySelector('.account-copy')?.textContent).not.toContain('public.header.roles.');
    expect(element.querySelector('.account-settings')?.getAttribute('href')).toBe('/perfil');
    expect(element.querySelector('.account-settings')?.nextElementSibling?.classList.contains('account-logout')).toBe(true);
    expect(element.querySelector('.account-identity button')).toBeNull();
    expect(element.querySelectorAll('a[href^="/publico"]')).toHaveLength(0);
    expect(element.querySelector('nav')).toBeNull();
    const toggle = vi.fn(); fixture.componentInstance.toggleSidenav.subscribe(toggle);
    element.querySelector<HTMLButtonElement>('[aria-controls="workspace-navigation"]')!.click();
    expect(toggle).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('menuExpanded', true); fixture.detectChanges();
    expect(element.querySelector('[aria-controls="workspace-navigation"]')?.getAttribute('aria-expanded')).toBe('true');
  });
  it('actualiza el rol al cambiar la cuenta y usa la traducción disponible sin perder el respaldo',()=>{
    const user=signal({name:'Cuenta de prueba',rol:'ADMIN_OBSERVATORIO'});
    TestBed.configureTestingModule({imports:[HeaderComponent,TranslateModule.forRoot()],providers:[
      provideRouter([]),{provide:AuthService,useValue:{user,isAuthenticated:()=>true}},
      {provide:LanguageService,useValue:{currentLang:signal('es'),availableLanguages:[]}},
      {provide:ThemeService,useValue:{isDark:()=>false}},
    ]});
    const fixture=TestBed.createComponent(HeaderComponent);fixture.detectChanges();
    const label=()=>fixture.nativeElement.querySelector('.account-role').textContent.trim();
    expect(label()).toBe('Supervisor');
    user.set({name:'Cuenta de prueba',rol:'SUBSCRIBER'});fixture.detectChanges();expect(label()).toBe('Suscriptor');
    const translate=TestBed.inject(TranslateService);
    translate.setTranslation('en',{public:{header:{roles:{SUBSCRIBER:'Subscriber'}}}});translate.use('en');
    fixture.detectChanges();expect(label()).toBe('Subscriber');
  });
});

import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthSessionService } from './auth-session.service';

describe('Sesión compartida entre pestañas', () => {
  const channels: TestChannel[] = [];
  class TestChannel {
    onmessage: ((event: MessageEvent) => void) | null = null;
    postMessage = vi.fn();
    close = vi.fn();
    constructor(readonly name: string) { channels.push(this); }
    receive(data: unknown): void { this.onmessage?.({data} as MessageEvent); }
  }
  let changes: Subject<'login' | 'logout'>;
  let auth: {checkAuth: ReturnType<typeof vi.fn>; clearAuthSilent: ReturnType<typeof vi.fn>; sessionChanges$: Subject<'login' | 'logout'>};
  let router: {url: string; navigate: ReturnType<typeof vi.fn>};
  let service: AuthSessionService;

  beforeEach(() => {
    channels.length = 0;
    vi.stubGlobal('BroadcastChannel', TestChannel);
    changes = new Subject();
    auth = {checkAuth: vi.fn(() => of(true)), clearAuthSilent: vi.fn(), sessionChanges$: changes};
    router = {url: '/publico/atlas', navigate: vi.fn(() => Promise.resolve(true))};
    TestBed.configureTestingModule({providers: [
      {provide: AuthService, useValue: auth}, {provide: Router, useValue: router},
    ]});
    service = TestBed.inject(AuthSessionService);
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });

  it('restaura la sesión antes del primer render, incluso en una ruta pública', () => {
    let valid: boolean | undefined;
    service.initialize().subscribe(value => valid = value);
    expect(auth.checkAuth).toHaveBeenCalledOnce();
    expect(valid).toBe(true);
    expect(channels[0].name).toBe('observatorio-session');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('permite abrir páginas públicas sin sesión y sin redirigir al login', () => {
    auth.checkAuth.mockReturnValue(of(false));
    service.initialize().subscribe();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('notifica login y logout sin enviar datos del usuario ni credenciales', () => {
    service.initialize().subscribe();
    changes.next('login'); changes.next('logout');
    expect(channels[0].postMessage.mock.calls).toEqual([[{type:'login'}], [{type:'logout'}]]);
  });

  it('verifica con el servidor un login recibido; nunca acepta identidad o permisos enviados por otra pestaña', () => {
    service.initialize().subscribe();
    channels[0].receive({type:'login', user:{rol:'ADMIN'}, token:'ignored'});
    expect(auth.checkAuth).toHaveBeenCalledTimes(2);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(channels[0].postMessage).not.toHaveBeenCalled();
  });

  it('actualiza el portal público al cerrar sesión en otra pestaña', () => {
    service.initialize().subscribe();
    channels[0].receive({type:'logout'});
    expect(auth.clearAuthSilent).toHaveBeenCalledOnce();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it.each(['/admin/dashboard', '/admin/atlas', '/perfil'])('sale de %s si otra pestaña cierra sesión', url => {
    router.url = url;
    service.initialize().subscribe(); channels[0].receive({type:'logout'});
    expect(router.navigate).toHaveBeenCalledWith(['/publico/departamentos']);
  });

  it('revalida al volver a una pestaña, incluso sin BroadcastChannel', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    service.initialize().subscribe();
    window.dispatchEvent(new Event('focus'));
    expect(auth.checkAuth).toHaveBeenCalledTimes(2);
    expect(channels).toHaveLength(0);
  });

  it('no duplica listeners y los retira al destruir la aplicación', () => {
    service.initialize().subscribe(); service.initialize().subscribe();
    expect(channels).toHaveLength(1);
    auth.checkAuth.mockClear();
    window.dispatchEvent(new Event('focus'));
    expect(auth.checkAuth).toHaveBeenCalledOnce();
    TestBed.resetTestingModule();
    expect(channels[0].close).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event('focus')); changes.next('login');
    expect(auth.checkAuth).toHaveBeenCalledOnce();
    expect(channels[0].postMessage).not.toHaveBeenCalled();
  });

  it('ignora mensajes desconocidos', () => {
    service.initialize().subscribe();
    channels[0].receive(null); channels[0].receive({type:'ADMIN'});
    expect(auth.checkAuth).toHaveBeenCalledOnce();
    expect(auth.clearAuthSilent).not.toHaveBeenCalled();
  });

  it('no consulta sesiones ni registra canales en SSR', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({providers: [
      {provide: PLATFORM_ID, useValue:'server'},
      {provide: AuthService, useValue:auth}, {provide: Router, useValue:router},
    ]});
    TestBed.inject(AuthSessionService).initialize().subscribe();
    expect(auth.checkAuth).not.toHaveBeenCalled();
    expect(channels).toHaveLength(0);
  });
});

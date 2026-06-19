import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { LanguageService } from './language.service';
import { TranslateService } from '@ngx-translate/core';

describe('LanguageService', () => {
  let service: LanguageService;
  let translateSpy: any;

  beforeEach(() => {
    localStorage.clear();
    // JSDOM returns 'en' by default, stub to 'es' so the service defaults to Spanish
    vi.stubGlobal('navigator', { ...navigator, language: 'es-ES' });

    translateSpy = {
      use: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        LanguageService,
        { provide: TranslateService, useValue: translateSpy },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
    service = TestBed.inject(LanguageService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to Spanish if no language saved', () => {
    expect(service.currentLang()).toBe('es');
  });

  it('should load saved language from localStorage', () => {
    localStorage.setItem('app_language', 'en');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        LanguageService,
        { provide: TranslateService, useValue: { use: vi.fn() } },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
    const freshService = TestBed.inject(LanguageService);

    expect(freshService.currentLang()).toBe('en');
  });

  describe('setLanguage()', () => {
    it('should update currentLang signal', () => {
      service.setLanguage('en');
      expect(service.currentLang()).toBe('en');
    });

    it('should call translateService.use() with the new lang', () => {
      service.setLanguage('en');
      expect(translateSpy.use).toHaveBeenCalledWith('en');
    });

    it('should persist language in localStorage', () => {
      service.setLanguage('en');
      expect(localStorage.getItem('app_language')).toBe('en');
    });

    it('should default to es for invalid language', () => {
      service.setLanguage('fr' as any);
      expect(service.currentLang()).toBe('es');
    });
  });

  describe('toggleLanguage()', () => {
    it('should switch from es to en', () => {
      service.setLanguage('es');
      service.toggleLanguage();
      expect(service.currentLang()).toBe('en');
    });

    it('should switch from en back to es', () => {
      service.setLanguage('en');
      service.toggleLanguage();
      expect(service.currentLang()).toBe('es');
    });
  });

  describe('getCurrentLanguageOption()', () => {
    it('should return the correct language option object for es', () => {
      service.setLanguage('es');
      const option = service.getCurrentLanguageOption();
      expect(option.code).toBe('es');
      expect(option.name).toBe('Español');
    });

    it('should return the correct language option object for en', () => {
      service.setLanguage('en');
      const option = service.getCurrentLanguageOption();
      expect(option.code).toBe('en');
      expect(option.name).toBe('English');
    });
  });
});

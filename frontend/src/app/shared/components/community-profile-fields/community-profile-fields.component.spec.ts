import { Pipe } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { DepartamentoService } from '@core/services/departamento.service';
import { createCommunityProfileForm } from '@core/models/user/community-profile';
import { CommunityProfileFieldsComponent } from './community-profile-fields.component';

@Pipe({ name: 'translate', standalone: true })
class MockTranslatePipe { transform(key: string) { return key; } }
describe('CommunityProfileFieldsComponent', () => {
  const changes = new Subject<void>();
  let service: { getPublicos: ReturnType<typeof vi.fn>; onDepartamentosChanged$: any };
  beforeEach(async () => {
    service = { getPublicos: vi.fn().mockReturnValue(of([{ id: 'salud', nombre: 'Salud' }])), onDepartamentosChanged$: changes };
    TestBed.overrideComponent(CommunityProfileFieldsComponent, { remove: { imports: [TranslateModule] }, add: { imports: [MockTranslatePipe] } });
    await TestBed.configureTestingModule({ imports: [CommunityProfileFieldsComponent], providers: [{ provide: DepartamentoService, useValue: service }] }).compileComponents();
  });
  function create() {
    const fixture = TestBed.createComponent(CommunityProfileFieldsComponent);
    fixture.componentRef.setInput('form', createCommunityProfileForm(new FormBuilder())); fixture.detectChanges(); return fixture;
  }
  it('fetches the catalog and picks up newly created observatories on refresh', () => {
    const fixture = create();
    expect(fixture.nativeElement.textContent).toContain('Salud');
    service.getPublicos.mockReturnValue(of([{ id: 'nuevo', nombre: 'Observatorio nuevo' }]));
    changes.next(); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Observatorio nuevo');
  });
  it('allows continuing without interests when loading fails', () => {
    service.getPublicos.mockReturnValue(throwError(() => new Error('offline')));
    const fixture = create();
    expect(fixture.componentInstance.failed()).toBe(true); expect(fixture.componentInstance.form.valid).toBe(true);
  });
  it('validates the conditional institution name', () => {
    const fixture = create(); const form = fixture.componentInstance.form;
    form.patchValue({ institucion_tipo: 'OTRA' }); expect(form.invalid).toBe(true);
    form.patchValue({ institucion: 'Universidad' }); expect(form.valid).toBe(true);
    form.patchValue({ institucion_tipo: 'ULEAM', institucion: '' }); expect(form.valid).toBe(true);
  });
});

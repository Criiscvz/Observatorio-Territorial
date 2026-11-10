import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { AdminWorkspaceService } from '@core/services/admin-workspace.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { PublicacionService } from '@core/services/publicacion.service';
import { AdminHomeComponent, WorkspacePublicationsComponent } from './admin-workspace.component';
import { PublicationDestinationComponent } from './publication-destination.component';

describe('Espacio operativo del editor', () => {
  beforeEach(() => TestBed.configureTestingModule({providers:[provideRouter([]),
    {provide:AuthService,useValue:{isAdmin:()=>false,isEditor:()=>true,isObservatoryAdmin:()=>false,user:()=>({rol:'EDITOR'}),canReviewObservatory:()=>false}},
  ]}));

  it('usa los contadores del editor y la misma distribución del inicio administrativo',()=>{
    const summary=vi.fn(()=>of({observatorios_total:2,publicaciones_total:8,pendientes_total:1,
      observatorios:[{id:'laboral',nombre:'Laboral'}],pendientes:[{id:'propia',departamento_id:'laboral',tipo:'ARTICULO',titulo:'Mi envío'}]}));
    TestBed.configureTestingModule({providers:[{provide:AdminWorkspaceService,useValue:{summary}}]});
    const fixture=TestBed.createComponent(AdminHomeComponent);fixture.detectChanges();
    expect(summary).toHaveBeenCalledWith(true);
    expect(fixture.nativeElement.querySelector('.work-grid')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.summary').textContent).toContain('Mis observatorios asignados');
    expect(fixture.nativeElement.querySelector('.summary').textContent).toContain('8');
    expect(fixture.nativeElement.querySelectorAll('.create-link')).toHaveLength(3);
    expect(fixture.nativeElement.querySelector('a[href="/admin/atlas/subir"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Mis envíos en revisión');
    expect(fixture.nativeElement.querySelector('.queue-row a').textContent).toContain('Ver envío');
  });

  it('consulta la lista propia paginada y permite editar sin presentar aprobación',()=>{
    const publications=vi.fn(()=>of({data:[{capabilities:{can_view:true,can_edit:true,can_delete:true,can_review:false},id:'propia',departamento_id:'laboral',departamento_nombre:'Laboral',titulo:'Mi artículo',tipo:'ARTICULO',estado:'EN_REVISION',codigo:'ART-1'}],meta:{total:21,from:1,to:20,current_page:1,last_page:2,per_page:20}}));
    TestBed.configureTestingModule({providers:[{provide:AdminWorkspaceService,useValue:{publications}},
      {provide:DepartamentoService,useValue:{getAll:()=>of([{id:'laboral',nombre:'Laboral'}])}},
      {provide:ActivatedRoute,useValue:{queryParamMap:of(convertToParamMap({estado:'EN_REVISION'}))}},
    ]});
    const fixture=TestBed.createComponent(WorkspacePublicationsComponent);fixture.detectChanges();
    expect(publications).toHaveBeenLastCalledWith(expect.objectContaining({estado:'EN_REVISION',page:1}),true);
    expect(fixture.nativeElement.querySelector('.btn-publication-edit').textContent).toContain('Editar');
    fixture.componentInstance.changePage(1);
    expect(publications).toHaveBeenLastCalledWith(expect.objectContaining({page:2}),true);
  });

  it.each(['ARTICULO','REPORTE','LIBRO'])('reutiliza el formulario de %s solo con observatorios asignados y fuerza revisión',tipo=>{
    const create=vi.fn(()=>of({id:'nuevo',codigo:'QA-1',titulo:'Mi publicación',estado:'EN_REVISION'} as any));
    const dialog={open:vi.fn()};
    TestBed.configureTestingModule({providers:[
      {provide:DepartamentoService,useValue:{getAll:()=>of([{id:'laboral',nombre:'Laboral'}])}},
      {provide:PublicacionService,useValue:{create}}, {provide:MatDialog,useValue:dialog},
      {provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:convertToParamMap({tipo,departamento:'no-asignado'})}}},
    ]});
    const fixture=TestBed.createComponent(PublicationDestinationComponent);fixture.detectChanges();
    const component=fixture.componentInstance;
    expect(component.form.controls.departamento.value).toBe('laboral');
    expect(fixture.nativeElement.querySelectorAll('select[formControlName=departamento] option')).toHaveLength(2);
    component.form.controls.departamento.setValue('no-asignado');component.openForm();expect(component.destination()).toBeNull();
    component.form.controls.departamento.setValue('laboral');component.openForm();fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.destination-import')).toBeNull();
    component.importSharePoint();expect(dialog.open).not.toHaveBeenCalled();
    component.publicationForm.patchValue({titulo:'Mi publicación',fecha_publicacion:'2026-10-21',estado:'PUBLICACION',solo_suscriptores:true,...(tipo==='REPORTE'?{link_url:'https://app.powerbi.com/view?r=test'}:{})});
    component.goToStep(2);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select[name=estado]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[formControlName=solo_suscriptores]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Se enviará a revisión');
    if(tipo!=='REPORTE')component.selectFile(new File(['%PDF-1.4'],'ejemplo.pdf',{type:'application/pdf'}));
    component.submit();expect(create).toHaveBeenCalledOnce();
    const [department,data]=create.mock.calls[0] as any;
    expect(department).toBe('laboral');expect(data.get('estado')).toBe('EN_REVISION');expect(data.get('solo_suscriptores')).toBe('0');
  });
});

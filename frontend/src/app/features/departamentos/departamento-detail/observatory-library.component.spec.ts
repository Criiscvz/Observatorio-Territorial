import { publicationPage } from '../../../testing/publication-page.fixture';
import { TestBed } from '@angular/core/testing';
import { ObservatorioPublicacion } from '@core/models/publicacion/publicacion.interface';
import { ObservatoryLibraryComponent } from './observatory-library.component';

describe('Biblioteca compacta por pestañas', () => {
  it('no abre un recurso con URL si la API deniega su visualización o no devuelve permisos',()=>{
    const {component}=setup([article(1)]);
    expect(component.canView(article(1))).toBe(true);
    expect(component.canView(article(1,{capabilities:undefined}))).toBe(false);
    expect(component.canView(article(1,{capabilities:{can_view:false,can_edit:false,can_delete:false,can_review:false}}))).toBe(false);
  });
  const article = (index: number, extra: Partial<ObservatorioPublicacion> = {}): ObservatorioPublicacion => ({
    capabilities:{can_view:true,can_edit:false,can_delete:false,can_review:false}, id: 'art-' + index, tipo: 'ARTICULO', titulo: 'Publicación ' + index, codigo: 'ART-' + index,
    estado: 'PUBLICACION', solo_suscriptores: false, fecha_publicacion: '2026-10-20',
    fuente: 'ULEAM', autores: ['Ana Pérez'], download_url: '/api/pdf/' + index,
    link_url: 'https://www.uleam.edu.ec/', created_at: '', updated_at: '', ...extra,
  });
  function setup(items: ObservatorioPublicacion[]) {
    const fixture = TestBed.createComponent(ObservatoryLibraryComponent);
    const respond=(filters:any={tipo:'ARTICULO'})=>{const result=publicationPage(items,filters);for(const [key,value] of Object.entries({publications:result.data,total:result.meta.total,totals:result.counts,type:filters.tipo||'ARTICULO',query:filters.q||'',page:(filters.page||1)-1}))fixture.componentRef.setInput(key,value);};
    respond();fixture.componentInstance.filtersChange.subscribe(filters=>respond({...filters,page:filters.page+1}));fixture.detectChanges();
    return {fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement};
  }
  it.each(['SUSPENDIDO','ARCHIVADO','RECHAZADO'] as const)('muestra el estado %s y su motivo completo sin perder acceso al visor',estado=>{
    const reason='Completar las referencias.\n<script>no ejecutar</script> '+ 'Explicación. '.repeat(80);
    const item=article(1,{estado,observacion_revision:reason,fecha_revision:'2026-10-28T10:00:00Z'});
    const {component,fixture,element}=setup([item]);
    expect(element.querySelector('.review-note-preview')?.textContent).toContain('Completar las referencias.');
    expect(element.querySelector('.state')?.textContent).toContain(component.stateLabel(item));
    expect(element.querySelector('[aria-label^="Editar "]')).toBeNull();
    expect(element.querySelector('[aria-label^="Eliminar "]')).toBeNull();
    component.toggle(item);fixture.detectChanges();
    expect(element.querySelector('.review-observation dd')?.textContent).toBe(reason);
    expect(element.querySelector('.review-observation script')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('.resource-actions button')!.disabled).toBe(false);
    if(estado==='RECHAZADO')expect(element.textContent).toContain('Solo consulta');
    component.search('referencias');expect(component.visible()).toHaveLength(1);
  });
  it('pagina las publicaciones reales de 20 en 20 sin perder filas y mantiene los detalles cerrados', () => {
    const {component, fixture, element} = setup(Array.from({length:47}, (_,i) => article(i)));
    expect(element.querySelectorAll('.library-row')).toHaveLength(20);
    expect(element.querySelector('.library-detail')).toBeNull();
    expect(element.querySelector('.library-pagination')?.textContent).toContain('1–20 de 47');
    element.querySelector<HTMLButtonElement>('button[aria-label="Página siguiente"]')!.click(); fixture.detectChanges();
    expect(component.visible()[0].id).toBe('art-20');expect(element.querySelectorAll('.library-row')).toHaveLength(20);
    component.changePage(1);fixture.detectChanges();expect(element.querySelectorAll('.library-row')).toHaveLength(7);
    expect(element.querySelector('.library-pagination')?.textContent).toContain('41–47 de 47');
    expect(element.querySelector<HTMLButtonElement>('button[aria-label="Página siguiente"]')!.disabled).toBe(true);
    fixture.componentRef.setInput('publications',[article(0)]);fixture.componentRef.setInput('total',1);fixture.componentRef.setInput('page',0);fixture.detectChanges();
    expect(component.currentPage()).toBe(0);expect(element.querySelectorAll('.library-row')).toHaveLength(1);
  });
  it('busca sin acentos por título, código, autor y fuente, y reinicia la página', () => {
    const items=Array.from({length:42},(_,i)=>article(i,{autores:[],fuente:'Otra fuente'}));
    items[40]=article(40,{titulo:'Atención primaria',fuente:'Ministerio de Salud'});
    const {component, fixture, element}=setup(items);component.changePage(2);
    const search=element.querySelector<HTMLInputElement>('input[type=search]')!;
    search.value='  atencion ';search.dispatchEvent(new Event('input'));fixture.detectChanges();
    expect(component.currentPage()).toBe(0);expect(component.visible().map(x=>x.id)).toEqual(['art-40']);
    for(const term of ['perez','ART-40','ministerio']){component.search(term);expect(component.visible().map(x=>x.id)).toEqual(['art-40']);}
    component.search('no existe');fixture.detectChanges();expect(element.querySelectorAll('.library-row')).toHaveLength(0);
    expect(element.textContent).toContain('No se encontraron publicaciones');expect(element.textContent).toContain('0–0 de 0');
  });
  it('conserva las tres pestañas, sus totales y excluye Atlas; cambiar de tipo cierra el detalle', () => {
    const {component, element, fixture}=setup([article(0),article(1,{tipo:'REPORTE'}),article(2,{tipo:'LIBRO'}),article(3,{tipo:'ATLAS'})]);
    const changed=vi.fn();component.typeChange.subscribe(changed);component.toggle(article(0));
    const tabs=element.querySelectorAll<HTMLButtonElement>('[role=tab]');expect(tabs).toHaveLength(3);
    tabs[1].click();fixture.detectChanges();expect(changed).toHaveBeenCalledWith('REPORTE');
    expect(component.visible().map(x=>x.id)).toEqual(['art-1']);expect(component.expandedId()).toBeNull();
    expect(component.count('ARTICULO')).toBe(1);expect(element.querySelector('.library-detail')).toBeNull();
  });
  it('abre un único detalle bajo demanda y ofrece solo Ver PDF para artículos y libros', () => {
    const items=[article(0),article(1)];const {component,element,fixture}=setup(items);
    const view=vi.fn();component.viewPublication.subscribe(view);
    element.querySelector<HTMLButtonElement>('.detail-toggle')!.click();fixture.detectChanges();
    expect(element.querySelectorAll('.library-detail')).toHaveLength(1);
    const buttons=element.querySelectorAll<HTMLButtonElement>('.resource-actions button');expect(buttons).toHaveLength(1);buttons[0].click();
    expect(buttons[0].textContent).toContain('Ver PDF');expect(element.textContent).not.toContain('Ver fuente');
    expect(view).toHaveBeenCalledWith(items[0]);
    element.querySelectorAll<HTMLButtonElement>('.detail-toggle')[1].click();fixture.detectChanges();
    expect(element.querySelectorAll('.library-detail')).toHaveLength(1);expect(component.expandedId()).toBe('art-1');
    element.querySelectorAll<HTMLButtonElement>('.detail-toggle')[1].click();fixture.detectChanges();expect(element.querySelector('.library-detail')).toBeNull();
  });
  it('ofrece solo Ver reporte para Power BI aunque no tenga un PDF adjunto',()=>{
    const report=article(1,{tipo:'REPORTE',download_url:null,link_url:'https://app.powerbi.com/view?r=publico'});
    const {component,fixture,element}=setup([report]);const view=vi.fn();component.viewPublication.subscribe(view);
    component.selectType('REPORTE');component.toggle(report);fixture.detectChanges();
    const buttons=element.querySelectorAll<HTMLButtonElement>('.resource-actions button');expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('Ver reporte');expect(buttons[0].disabled).toBe(false);buttons[0].click();expect(view).toHaveBeenCalledWith(report);
    expect(element.textContent).not.toContain('Ver fuente');expect(element.textContent).not.toContain('Ver PDF');
  });
  it('marca PDF local y de SharePoint, y deshabilita recursos ausentes, bloqueados o fuentes inválidas', () => {
    const items=[article(0),article(1,{download_url:null,sharepoint_url:'https://tenant.sharepoint.com/doc.pdf'}),article(2,{download_url:null,link_url:null}),article(3,{link_url:'javascript:alert(1)',bloqueado:true})];
    const {component,fixture,element}=setup(items);
    expect(element.querySelectorAll('.availability.available')).toHaveLength(2);
    expect(component.sourceUrl({...items[0],link_url:'ftp://example.com'})).toBeNull();
    expect(component.sourceUrl({...items[0],link_url:'javascript:alert(1)'})).toBeNull();
    for(const item of items.slice(2)){component.toggle(item);fixture.detectChanges();const buttons=element.querySelectorAll<HTMLButtonElement>('.resource-actions button');expect([...buttons].every(x=>x.disabled)).toBe(true);}
  });
  it('muestra solo las acciones autorizadas y no borra al abrir detalles', () => {
    const items=[article(0),article(1)];const {component,fixture,element}=setup(items);
    const remove=vi.fn(),edit=vi.fn();component.remove.subscribe(remove);component.edit.subscribe(edit);
    expect(element.querySelectorAll('.delete-icon')).toHaveLength(0);
    fixture.componentRef.setInput('canEdit',(x:ObservatorioPublicacion)=>x.id==='art-0');fixture.componentRef.setInput('canDelete',(x:ObservatorioPublicacion)=>x.id==='art-0');fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.detail-toggle')!.click();fixture.detectChanges();expect(remove).not.toHaveBeenCalled();
    expect(element.querySelectorAll('.delete-icon')).toHaveLength(1);
    element.querySelector<HTMLButtonElement>('button[aria-label="Editar Publicación 0"]')!.click();expect(edit).toHaveBeenCalledWith(items[0]);
    element.querySelector<HTMLButtonElement>('.delete-icon')!.click();expect(remove).toHaveBeenCalledExactlyOnceWith(items[0]);
  });
});

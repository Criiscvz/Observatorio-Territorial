import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from './api.service';
import { PublicCatalogService } from './public-catalog.service';

describe('PublicCatalogService', () => {
  it('envía filtros y página al endpoint común sin descargar el catálogo completo', () => {
    const expected={data:[],counts:{ARTICULO:0,REPORTE:0,LIBRO:0},meta:{total:0}};
    const api={get:vi.fn(() => of(expected))};
    TestBed.configureTestingModule({providers:[{provide:ApiService,useValue:api}]});
    let value:unknown;
    TestBed.inject(PublicCatalogService).getPage('dep-id','LIBRO',3,'Pérez').subscribe(r => value=r);
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/publico/publicaciones',{departamento_id:'dep-id',tipo:'LIBRO',page:'3',per_page:'20',q:'Pérez'});
    expect(value).toBe(expected);
  });
});

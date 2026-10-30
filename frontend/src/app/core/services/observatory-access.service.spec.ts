import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from './api.service';
import { ObservatoryAccessService } from './observatory-access.service';

it('pide el contexto autorizado del usuario sin enviar alcances o capacidades del navegador',()=>{
  const get=vi.fn(()=>of({capabilities:{can_view_access:true,can_manage_access:false,can_assign_editors:false,can_revoke_access:false},observatorios:[],permisos:[]}));
  TestBed.configureTestingModule({providers:[{provide:ApiService,useValue:{get}}]});
  TestBed.inject(ObservatoryAccessService).context(42).subscribe(context=>expect(context.capabilities.can_manage_access).toBe(false));
  expect(get).toHaveBeenCalledExactlyOnceWith('/accesos/usuarios/42');
});

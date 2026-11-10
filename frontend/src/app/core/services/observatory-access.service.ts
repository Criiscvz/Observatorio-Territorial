import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Departamento } from '../models';
import { PermisoConfig } from '../models/permisos';
import { AccessCapabilities } from '../models/user/user.interface';
export interface ObservatoryAccessContext {
  capabilities: AccessCapabilities;
  observatorios: Departamento[];
  permisos: PermisoConfig[];
}
@Injectable({providedIn:'root'})
export class ObservatoryAccessService {
  private readonly api = inject(ApiService);
  context(userId: number) { return this.api.get<ObservatoryAccessContext>(`/accesos/usuarios/${userId}`); }
}

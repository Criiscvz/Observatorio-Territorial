import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { PermisoConfig, SavePermisosResponse } from '../models/permisos';

@Injectable({
  providedIn: 'root',
})
export class PermisosApiService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private get base(): string { return this.auth.user()?.rol === 'ADMIN_OBSERVATORIO' ? '/observatorio-admin' : '/permisos'; }

  /** Obtiene los permisos de un usuario específico (admin) */
  getUserPermisos(userId: number): Observable<PermisoConfig[]> {
    return this.api.get<PermisoConfig[]>(`${this.base}/users/${userId}/permisos`);
  }

  /** Guarda todos los permisos de un usuario (reemplaza existentes) */
  saveUserPermisos(userId: number, permisos: PermisoConfig[]): Observable<SavePermisosResponse> {
    return this.api.put<SavePermisosResponse>(`${this.base}/users/${userId}/permisos`, { permisos });
  }

  /** Obtiene los permisos del usuario autenticado */
  getMyPermisos(): Observable<PermisoConfig[]> {
    return this.api.get<PermisoConfig[]>('/permisos/mis-permisos');
  }
}

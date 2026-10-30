import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Departamento } from '../models';
import { PublicationCapabilities } from '../models/publicacion/publicacion.interface';
export interface WorkspacePublication {
    capabilities?: PublicationCapabilities;
    id: string;
    departamento_id: string;
    departamento_nombre: string;
    titulo: string;
    tipo: string;
    estado: string;
    observacion_revision?: string | null;
    fecha_revision?: string | null;
    codigo: string;
    fecha_publicacion: string;
}
export interface WorkspaceSummary {
    observatorios_total: number;
    publicaciones_total: number;
    pendientes_total: number;
    observatorios: Departamento[];
    pendientes: WorkspacePublication[];
}
export interface WorkspacePage {
    data: WorkspacePublication[];
    meta: {
        current_page: number;
        last_page: number;
        total: number;
        from: number | null;
        to: number | null;
        per_page?: number;
    };
}
@Injectable({ providedIn: 'root' })
export class AdminWorkspaceService {
    private readonly api = inject(ApiService);
    private readonly auth = inject(AuthService);
    private base(editor: boolean) { return this.auth.user()?.rol === 'ADMIN_OBSERVATORIO' ? '/observatorio-admin' : editor ? '/editor' : '/admin'; }
    summary(editor = false) { return this.api.get<WorkspaceSummary>(`${this.base(editor)}/inicio`); }
    publications(filters: Record<string, string | number>, editor = false) { return this.api.get<WorkspacePage>(`${this.base(editor)}/publicaciones`, filters); }
}

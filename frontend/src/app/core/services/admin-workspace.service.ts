import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Departamento } from '../models';
export interface WorkspacePublication {
    id: string;
    departamento_id: string;
    departamento_nombre: string;
    titulo: string;
    tipo: string;
    estado: string;
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
    summary(editor = false) { return this.api.get<WorkspaceSummary>(editor ? '/editor/inicio' : '/admin/inicio'); }
    publications(filters: Record<string, string | number>, editor = false) { return this.api.get<WorkspacePage>(editor ? '/editor/publicaciones' : '/admin/publicaciones', filters); }
}

import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
@Component({
    selector: 'app-workspace-sidebar', standalone: true, imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
    template: `<nav class="workspace-sidebar" [class.collapsed]="collapsed()" aria-label="Espacio de trabajo">
    <div class="workspace-title"><span>Espacio de trabajo</span></div>
    @for(item of visibleMainLinks();track item.route){<a class="workspace-link" [routerLink]="item.route" routerLinkActive="active" [routerLinkActiveOptions]="{exact:item.exact||false}" [attr.aria-label]="item.label" [matTooltip]="collapsed()?item.label:''" matTooltipPosition="right" (click)="navigate.emit(item.route)"><mat-icon>{{item.icon}}</mat-icon><span>{{item.label}}</span></a>}
    @if(!editor()) {
    <span class="group-label">Gestión</span>
    @for(item of managementLinks;track item.route){<a class="workspace-link" [routerLink]="item.route" routerLinkActive="active" [attr.aria-label]="item.label" [matTooltip]="collapsed()?item.label:''" matTooltipPosition="right" (click)="navigate.emit(item.route)"><mat-icon>{{item.icon}}</mat-icon><span>{{item.label}}</span></a>}
    }
    <div class="portal-section"><a class="portal-button" routerLink="/" target="_blank" rel="noopener noreferrer" aria-label="Ver portal público, se abre en otra pestaña" [matTooltip]="collapsed()?'Ver portal público · Nueva pestaña':''" matTooltipPosition="right"><span class="portal-symbol"><mat-icon>public</mat-icon></span><span class="portal-copy"><strong>Ver portal público</strong><small>Abrir en otra pestaña</small></span><mat-icon class="portal-arrow">north_east</mat-icon></a></div>
  </nav>`,
    styleUrl: './workspace-sidebar.component.scss',
})
export class WorkspaceSidebarComponent {
    readonly editor = input(false);
    readonly collapsed = input(false);
    readonly navigate = output<string>();
    readonly mainLinks = [{ label: 'Inicio', icon: 'dashboard', route: '/admin/dashboard', exact: true }, { label: 'Observatorios', icon: 'account_balance', route: '/admin/departamentos', exact: false }, { label: 'Publicaciones', icon: 'description', route: '/admin/publicaciones', exact: false }, { label: 'Atlas', icon: 'library_books', route: '/admin/atlas', exact: false }, { label: 'Barómetro', icon: 'bar_chart', route: '/admin/datasets', exact: false }];
    readonly managementLinks = [{ label: 'Usuarios', icon: 'group', route: '/admin/usuarios' }, { label: 'Permisos', icon: 'security', route: '/admin/permisos' }, { label: 'Configuración del sitio', icon: 'tune', route: '/admin/configuracion' }];
    readonly visibleMainLinks = computed(() => this.editor() ? this.mainLinks.slice(0, 3) : this.mainLinks);
}

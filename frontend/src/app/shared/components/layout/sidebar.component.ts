import { Component, inject, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { DepartamentoService } from '../../../core/services/departamento.service';
import { Departamento } from '../../../core/models';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatListModule,
    MatIconModule,
    MatExpansionModule,
    MatDividerModule,
  ],
  template: `
    <div class="h-full bg-gray-50 border-r">
      <mat-nav-list>
        <a mat-list-item routerLink="/dashboard" routerLinkActive="bg-red-50 text-red-600">
          <mat-icon matListItemIcon>dashboard</mat-icon>
          <span matListItemTitle>Dashboard</span>
        </a>

        <mat-divider></mat-divider>

        <h3 matSubheader class="text-gray-500 font-medium">Departamentos</h3>

        @for (depto of departamentos(); track depto.id) {
          <a mat-list-item 
             [routerLink]="['/departamentos', depto.id]" 
             routerLinkActive="bg-red-50 text-red-600">
            <mat-icon matListItemIcon>folder</mat-icon>
            <span matListItemTitle>{{ depto.nombre }}</span>
            @if (depto.datasets_count) {
              <span matListItemMeta class="text-xs bg-gray-200 px-2 py-1 rounded">
                {{ depto.datasets_count }}
              </span>
            }
          </a>
        }

        @if (departamentos().length === 0) {
          <mat-list-item>
            <span class="text-gray-500 text-sm">Sin departamentos</span>
          </mat-list-item>
        }

        <mat-divider></mat-divider>

        <a mat-list-item routerLink="/departamentos/nuevo" routerLinkActive="bg-red-50 text-red-600">
          <mat-icon matListItemIcon>add_circle</mat-icon>
          <span matListItemTitle>Nuevo Departamento</span>
        </a>

        <a mat-list-item routerLink="/datasets" routerLinkActive="bg-red-50 text-red-600">
          <mat-icon matListItemIcon>table_chart</mat-icon>
          <span matListItemTitle>Todos los Datasets</span>
        </a>
      </mat-nav-list>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    .mat-mdc-list-item.bg-red-50 {
      --mdc-list-list-item-label-text-color: #dc2626;
    }
  `]
})
export class SidebarComponent implements OnInit {
  private deptoService = inject(DepartamentoService);
  departamentos = signal<Departamento[]>([]);

  ngOnInit(): void {
    this.loadDepartamentos();
  }

  loadDepartamentos(): void {
    this.deptoService.getAll().subscribe({
      next: (departamentos) => this.departamentos.set(departamentos || []),
      error: () => this.departamentos.set([])
    });
  }
}

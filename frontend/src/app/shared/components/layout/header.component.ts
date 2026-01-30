import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
  ],
  template: `
    <mat-toolbar class="bg-white shadow-sm border-b">
      <button mat-icon-button (click)="toggleSidenav.emit()">
        <mat-icon>menu</mat-icon>
      </button>

      <a routerLink="/dashboard" class="flex items-center gap-2 ml-2">
        <img src="ULEAM.png" alt="ULEAM" class="h-10">
        <span class="text-xl font-bold text-gray-800 hidden md:inline">
          Observatorio ULEAM
        </span>
      </a>

      <span class="flex-1"></span>

      @if (authService.user(); as user) {
        <button mat-button [matMenuTriggerFor]="userMenu" class="flex items-center gap-2">
          <mat-icon>account_circle</mat-icon>
          <span class="hidden md:inline">{{ user.name }}</span>
          <mat-icon>arrow_drop_down</mat-icon>
        </button>

        <mat-menu #userMenu="matMenu">
          <div class="px-4 py-2 border-b">
            <p class="font-medium">{{ user.name }}</p>
            <p class="text-sm text-gray-500">{{ user.email }}</p>
          </div>
          <button mat-menu-item routerLink="/perfil">
            <mat-icon>person</mat-icon>
            <span>Mi Perfil</span>
          </button>
          <button mat-menu-item (click)="logout()">
            <mat-icon>logout</mat-icon>
            <span>Cerrar Sesión</span>
          </button>
        </mat-menu>
      }
    </mat-toolbar>
  `,
  styles: [`
    mat-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
    }
  `]
})
export class HeaderComponent {
  authService = inject(AuthService);
  toggleSidenav = output<void>();

  logout(): void {
    this.authService.logout().subscribe();
  }
}

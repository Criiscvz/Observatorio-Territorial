import { Component, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { HeaderComponent } from './header.component';
import { SidebarComponent } from './sidebar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatSidenavModule,
    HeaderComponent,
    SidebarComponent,
  ],
  template: `
    <div class="h-screen flex flex-col">
      <app-header (toggleSidenav)="sidenav.toggle()"></app-header>

      <mat-sidenav-container class="flex-1">
        <mat-sidenav #sidenav mode="side" [opened]="sidenavOpen()" class="w-64">
          <app-sidebar></app-sidebar>
        </mat-sidenav>

        <mat-sidenav-content class="bg-gray-100">
          <main class="p-6">
            <router-outlet></router-outlet>
          </main>
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  styles: [`
    mat-sidenav-container {
      height: calc(100vh - 64px);
    }
  `]
})
export class MainLayoutComponent {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  sidenavOpen = signal(true);
}

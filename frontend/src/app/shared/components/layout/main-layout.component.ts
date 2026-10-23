import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeService } from '@core/services/theme.service';
import { HeaderComponent } from './header.component';
import { SidebarComponent } from './sidebar.component';
import { WorkspaceSidebarComponent } from './workspace-sidebar.component';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MatSidenavModule, HeaderComponent, SidebarComponent, WorkspaceSidebarComponent, TranslateModule],
  template: `
    <div class="layout-container">
      <!-- Header fijo -->
      <app-header (toggleSidenav)="toggleSidenav()" [menuExpanded]="isMobile() ? mobileOpen() : sidenavOpen()" class="layout-header"></app-header>

      <!-- Container principal -->
      <mat-sidenav-container class="layout-body" autosize>
        <!-- Sidebar -->
        <mat-sidenav
          #sidenav
          id="workspace-navigation"
          [mode]="isMobile() ? 'over' : 'side'"
          [opened]="!isMobile() && (usesWorkspaceSidebar || sidenavOpen())"
          class="layout-sidenav"
          [class.layout-sidenav--collapsed]="usesWorkspaceSidebar && !isMobile() && !sidenavOpen()"
          (openedChange)="mobileOpen.set($event)"
        >
          @if(usesWorkspaceSidebar) {
            <app-workspace-sidebar [editor]="auth.isEditor()" [collapsed]="!isMobile() && !sidenavOpen()" (navigate)="onNavigate($event)"/>
          } @else {
            <app-sidebar (navigate)="onNavigate()"></app-sidebar>
          }
        </mat-sidenav>

        <!-- Contenido principal -->
        <mat-sidenav-content class="layout-content">
          <main class="layout-main animate-fade-in">
            <router-outlet></router-outlet>
          </main>
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  styles: [
    `
      .layout-container {
        height: 100vh;
        height: 100dvh;
        width: 100%;
        min-width: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background-color: var(--bg-primary);
      }

      .layout-header {
        display: block;
        min-width: 0;
        position: sticky;
        top: 0;
        z-index: 1000;
        flex-shrink: 0;
      }

      .layout-body {
        /* The container is exposed while Material animates the content margin. */
        --mat-sidenav-content-background-color: var(--bg-primary);
        background-color: var(--bg-primary);
        flex: 1 1 0;
        min-height: 0;
        min-width: 0;
        width: 100%;
      }

      .layout-sidenav {
        width: 280px;
        background: var(--bg-secondary) !important;
        border-right: 1px solid var(--border-color) !important;
      }
      .layout-sidenav:has(app-workspace-sidebar) { width: 244px; }
      .layout-sidenav.layout-sidenav--collapsed { width: 76px; }

      .layout-content {
        background-color: var(--bg-primary) !important;
        overflow: auto;
        scrollbar-gutter: stable;
        overscroll-behavior-y: contain;
      }

      .layout-main {
        padding: 1.5rem;
        min-height: 100%;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      @media (min-width: 1024px) {
        .layout-main {
          padding: 2rem;
        }
      }

      @media (max-width: 1023px) {
        .layout-sidenav {
          width: 280px;
        }
      }
    `,
  ],
})
export class MainLayoutComponent {
  @ViewChild('sidenav') sidenav!: MatSidenav;

  private themeService = inject(ThemeService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private activePath = '';

  sidenavOpen = signal(true);
  isMobile = signal(false);
  readonly mobileOpen = signal(false);
  get usesWorkspaceSidebar(): boolean { return this.auth.isAdmin() || this.auth.isEditor(); }

  constructor() {
    this.checkScreenSize();
    this.syncRoute(this.router.url);
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(event => this.syncRoute(event.urlAfterRedirects));
  }

  private isHome(path: string): boolean {
    return path === '/admin/dashboard' || path === '/admin';
  }

  private syncRoute(url: string): void {
    const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    if (path === this.activePath) return;
    this.activePath = path;
    if (this.usesWorkspaceSidebar) this.sidenavOpen.set(this.isHome(path));
    if (this.isMobile()) this.sidenav?.close();
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    if (typeof window !== 'undefined') {
      this.isMobile.set(window.innerWidth < 1024);
    }
  }

  toggleSidenav(): void {
    if (this.isMobile()) {
      this.sidenav.toggle();
    } else {
      this.sidenavOpen.update((v) => !v);
    }
  }

  onNavigate(target?: string): void {
    if (this.isMobile()) {
      this.sidenav.close();
    } else if (this.usesWorkspaceSidebar && target && !this.isHome(target)) {
      this.sidenavOpen.set(false);
    }
  }
}

import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { userRoleLabel } from '@core/models/user/user-role.presentation';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-account-controls',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule, TranslateModule],
  template: `
    @if (auth.user(); as user) {
      <div class="account-controls">
        <div class="account-identity">
          <span class="account-avatar" aria-hidden="true">
            @if (user.perfil?.avatar) {
              <img [src]="user.perfil?.avatar" alt="" crossorigin="anonymous" />
            } @else { {{ user.name.charAt(0).toUpperCase() }} }
          </span>
          <span class="account-copy">
            <strong [matTooltip]="user.name">{{ user.name }}</strong>
            @let translatedRole = roleKey() | translate;
            @let visibleRole = translatedRole && translatedRole !== roleKey() ? translatedRole : fallbackRoleLabel();
            <span class="account-role" [matTooltip]="visibleRole">{{ visibleRole }}</span>
          </span>
        </div>
        <a class="account-icon account-settings nav-account" routerLink="/perfil" routerLinkActive="is-active" ariaCurrentWhenActive="page"
          [attr.aria-label]="'profile.title' | translate" [matTooltip]="'profile.title' | translate">
          <mat-icon>settings</mat-icon>
        </a>
        <button type="button" class="account-icon account-logout" (click)="requestLogout()" [disabled]="logoutPending()"
          [attr.aria-label]="'auth.logout' | translate" [matTooltip]="'auth.logout' | translate">
          <mat-icon>logout</mat-icon>
        </button>
      </div>
    }
  `,
  styleUrl: './account-controls.component.scss',
})
export class AccountControlsComponent {
  readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly logoutPending = signal(false);
  readonly roleKey = computed(() => `public.header.roles.${this.auth.user()?.rol ?? 'USER'}`);
  readonly fallbackRoleLabel = computed(() => userRoleLabel(this.auth.user()?.rol ?? 'USER'));

  requestLogout(): void {
    if (this.logoutPending() || !this.auth.isAuthenticated()) return;
    this.logoutPending.set(true);
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      width: '440px', maxWidth: 'calc(100vw - 32px)',
      panelClass: 'app-confirm-dialog-panel', backdropClass: 'app-confirm-dialog-backdrop',
      autoFocus: '.confirm-dialog__cancel',
      data: {
        title: this.translate.instant('public.header.logoutTitle'),
        message: this.translate.instant('public.header.logoutMessage'),
        confirmText: this.translate.instant('auth.logout'),
        cancelText: this.translate.instant('common.buttons.cancel'),
        processingText: this.translate.instant('public.header.loggingOut'),
        icon: 'logout', confirmColor: 'warn',
        confirmAction: () => this.auth.logout(),
      },
    }).afterClosed().pipe(
      finalize(() => this.logoutPending.set(false)), takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }
}

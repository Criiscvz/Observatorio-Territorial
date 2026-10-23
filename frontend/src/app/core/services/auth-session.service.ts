import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, of, timeout } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly platform = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private started = false;
  private channel?: BroadcastChannel;
  private readonly onFocus = () => this.refresh();
  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible') this.refresh();
  };

  initialize(): Observable<boolean> {
    if (!isPlatformBrowser(this.platform)) return of(false);
    if (!this.started) {
      this.started = true;
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          this.channel = new BroadcastChannel('observatorio-session');
          this.channel.onmessage = event => {
            if (event.data?.type === 'logout') {
              this.auth.clearAuthSilent();
              this.leaveProtectedPage();
            } else if (event.data?.type === 'login') {
              // Only the server can restore identity and permissions in this tab.
              this.refresh();
            }
          };
        } catch { /* Focus/visibility checks also work when channels are unavailable. */ }
      }
      this.auth.sessionChanges$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(type => {
        // Never transmit a user, role, password or token between tabs.
        this.channel?.postMessage({ type });
      });
      window.addEventListener('focus', this.onFocus);
      document.addEventListener('visibilitychange', this.onVisibility);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('focus', this.onFocus);
        document.removeEventListener('visibilitychange', this.onVisibility);
        this.channel?.close();
      });
    }
    // Do not leave the public portal/login blank during backend warmup.
    // AuthService shares the request without ref-count cancellation, so a slow
    // response still restores the user in this tab after bootstrap completes.
    return this.auth.checkAuth().pipe(timeout({ first: 1500, with: () => of(false) }));
  }

  private refresh(): void {
    this.auth.checkAuth().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(valid => {
      if (!valid) this.leaveProtectedPage();
    });
  }

  private leaveProtectedPage(): void {
    if (/^\/(admin(?:\/|$)|perfil(?:\/|$))/.test(this.router.url)) {
      void this.router.navigate(['/publico/departamentos']);
    }
  }
}

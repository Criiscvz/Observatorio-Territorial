import { Component, DestroyRef, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({ selector: 'app-google-callback', standalone: true, imports: [MatProgressSpinnerModule],
  template: '<div class="callback"><mat-spinner diameter="42"></mat-spinner><p>{{ message() }}</p></div>',
  styles: [`.callback { min-height: 100vh; display: grid; place-content: center; justify-items: center; gap: 1rem; background: var(--bg-primary); color: var(--text-primary); }`],
})
export class GoogleCallbackComponent {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly message = signal('Completando el acceso con Google…');
  constructor() {
    if (!this.isBrowser) return;
    const code = this.route.snapshot.queryParamMap.get('code');
    this.router.navigate([], { replaceUrl: true, queryParams: {} });
    if (!code) { this.router.navigate(['/auth/login'], { queryParams: { google_error: 'failed' } }); return; }
    this.auth.exchangeGoogleCode(code).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.router.navigate([this.auth.isAdmin() || this.auth.isEditor() ? '/admin/dashboard' : '/publico/departamentos']),
      error: () => this.router.navigate(['/auth/login'], { queryParams: { google_error: 'failed' } }),
    });
  }
}

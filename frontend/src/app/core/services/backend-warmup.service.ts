import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { take } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Gates HTTP calls behind a warmup ping so Render free-tier cold starts
 * don't surface as 500s to the UI.
 *
 * First subscriber to `ready$()` triggers a GET /api/health loop that
 * retries with exponential backoff until the server responds 200. Once
 * healthy, the subject stays complete — every later subscriber resolves
 * synchronously.
 */
@Injectable({ providedIn: 'root' })
export class BackendWarmupService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  private readonly healthUrl = `${environment.apiUrl}/health`;
  private readonly subject = new ReplaySubject<true>(1);
  private started = false;

  ready$(): Observable<true> {
    if (!this.started) {
      this.started = true;
      this.startWarmup();
    }
    return this.subject.asObservable().pipe(take(1));
  }

  private startWarmup(): void {
    if (!isPlatformBrowser(this.platformId)) {
      // SSR: don't gate server-rendered calls on a client-side warmup.
      this.subject.next(true);
      this.subject.complete();
      return;
    }
    this.attempt(0);
  }

  private attempt(n: number): void {
    this.http.get(this.healthUrl).subscribe({
      next: () => {
        this.subject.next(true);
        this.subject.complete();
      },
      error: () => {
        // Cold start on Render free tier can take 20–45s. Retry forever with
        // capped exponential backoff; the interceptor will eventually get
        // the green light and let queued requests through.
        const delay = Math.min(1000 * 1.5 ** n, 8000);
        setTimeout(() => this.attempt(n + 1), delay);
      },
    });
  }
}

import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '@core/services/auth.service';
import { ADMIN_ROUTES } from './admin.routes';
import { PUBLIC_ROUTES } from './public.routes';

@Component({ template: 'Dataset {{ id }}', standalone: true })
class DatasetDestination {
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
}

// Exercise the real redirect and destination guards without fetching a dataset.
function testRoutes(routes: Routes): Routes {
  return routes.map(route => route.path === 'datasets/:id' || route.path === 'dashboard'
    ? { ...route, loadComponent: undefined, component: DatasetDestination }
    : route);
}

describe('Retired dataset analysis URLs', () => {
  let role: string | null;

  beforeEach(() => {
    role = null;
    TestBed.configureTestingModule({ providers: [
      provideRouter([
        { path: 'publico', children: testRoutes(PUBLIC_ROUTES) },
        { path: 'admin', children: testRoutes(ADMIN_ROUTES) },
      ]),
      { provide: AuthService, useValue: {
        user: () => ({ rol: role }), userRole: () => role,
        hasAnyRole: (allowed: string[]) => allowed.includes(role ?? ''),
      } },
    ] });
  });

  it('redirects a public bookmark to the same dataset table without authentication', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/publico/datasets/dataset-17/variable/variable-3', DatasetDestination);
    expect(TestBed.inject(Router).url).toBe('/publico/datasets/dataset-17');
    expect(harness.routeNativeElement?.textContent).toContain('dataset-17');
  });

  for (const allowed of ['ADMIN', 'USER', 'SUBSCRIBER']) {
    it(`preserves the protected dataset destination for ${allowed}`, async () => {
      role = allowed;
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/admin/datasets/dataset-22/variable/variable-8', DatasetDestination);
      expect(TestBed.inject(Router).url).toBe('/admin/datasets/dataset-22');
      expect(harness.routeNativeElement?.textContent).toContain('dataset-22');
    });
  }

  it('does not bypass the destination role guard when using an old bookmark', async () => {
    role = 'EDITOR';
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/datasets/dataset-22/variable/variable-8');
    expect(TestBed.inject(Router).url).toBe('/admin/dashboard');
  });
});

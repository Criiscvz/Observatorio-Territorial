import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, Subject, switchMap, debounceTime } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { AdminWorkspaceService, WorkspacePage, WorkspaceSummary, WorkspacePublication } from '@core/services/admin-workspace.service';
import { SiteSettingsService } from '@core/services/site-settings.service';
import { DepartamentoService } from '@core/services/departamento.service';
import { Departamento } from '@core/models';
import { DashboardComponent } from '../dashboard/dashboard.component';
export const PUBLICATION_LABELS: Record<string, string> = { ARTICULO: 'Artículo', REPORTE: 'Reporte Power BI', LIBRO: 'Libro PDF' };
export const PUBLICATION_ICONS: Record<string, string> = { ARTICULO: 'article', REPORTE: 'bar_chart', LIBRO: 'menu_book' };
export const STATUS_LABELS: Record<string, string> = { EN_REVISION: 'En revisión', PUBLICACION: 'Publicado', SUSPENDIDO: 'Suspendido', ARCHIVADO: 'Archivado', RECHAZADO: 'Rechazado' };
@Component({ selector: 'app-admin-home', standalone: true, imports: [RouterLink, MatIconModule], templateUrl: './admin-home.component.html', styleUrl: './workspace.scss' })
export class AdminHomeComponent implements OnInit {
    readonly auth = inject(AuthService);
    readonly isEditor = this.auth.isEditor;
    private readonly service = inject(AdminWorkspaceService);
    private readonly destroyRef = inject(DestroyRef);
    readonly summary = signal<WorkspaceSummary | null>(null);
    readonly error = signal(false);
    readonly loading = signal(true);
    readonly types = PUBLICATION_LABELS;
    readonly icons = PUBLICATION_ICONS;
    readonly createOptions = [{ type: 'ARTICULO', title: 'Artículo', icon: 'article', description: 'Investigación y análisis' }, { type: 'REPORTE', title: 'Reporte Power BI', icon: 'bar_chart', description: 'Enlace a un reporte' }, { type: 'LIBRO', title: 'Libro PDF', icon: 'menu_book', description: 'Biblioteca del observatorio' }];
    ngOnInit() { this.load(); }
    load() { this.loading.set(true); this.error.set(false); this.service.summary(this.isEditor()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: value => { this.summary.set(value); this.loading.set(false); }, error: () => { this.error.set(true); this.loading.set(false); } }); }
}
@Component({ selector: 'app-workspace-entry', standalone: true, imports: [AdminHomeComponent, DashboardComponent], template: `@if(auth.isAdmin() || auth.isEditor() || auth.isObservatoryAdmin()){<app-admin-home/>} @else {<app-dashboard/>}` })
export class WorkspaceEntryComponent {
    readonly auth = inject(AuthService);
}
@Component({ selector: 'app-workspace-publications', standalone: true, imports: [RouterLink, MatIconModule, ReactiveFormsModule], templateUrl: './workspace-publications.component.html', styleUrl: './workspace.scss' })
export class WorkspacePublicationsComponent implements OnInit {
    readonly auth = inject(AuthService);
    readonly isEditor = this.auth.isEditor;
    private readonly service = inject(AdminWorkspaceService);
    private readonly departments = inject(DepartamentoService);
    private readonly route = inject(ActivatedRoute);
    private readonly destroyRef = inject(DestroyRef);
    private readonly fb = inject(FormBuilder);
    private readonly requests = new Subject<void>();
    readonly form = this.fb.nonNullable.group({ q: [''], departamento_id: [''], tipo: [''] });
    readonly items = signal<WorkspacePage | null>(null);
    readonly observatories = signal<Departamento[]>([]);
    readonly loading = signal(true);
    readonly error = signal(false);
    readonly status = signal('');
    readonly page = signal(1);
    readonly types = PUBLICATION_LABELS;
    readonly statuses = STATUS_LABELS;
    readonly tabs = [{ value: '', label: 'Todas' }, { value: 'EN_REVISION', label: 'En revisión' }, { value: 'PUBLICACION', label: 'Publicadas' }, { value: 'SUSPENDIDO', label: 'Suspendidas' }, { value: 'ARCHIVADO', label: 'Archivadas' }, { value: 'RECHAZADO', label: 'Rechazadas' }];
    canEditItem(item: WorkspacePublication): boolean {
        return item.capabilities?.can_edit === true;
    }
    ngOnInit() {
        this.requests.pipe(switchMap(() => { this.loading.set(true); this.error.set(false); return this.service.publications({ ...this.form.getRawValue(), estado: this.status(), page: this.page() }, this.isEditor()).pipe(catchError(() => { this.error.set(true); return of(null); })); }), takeUntilDestroyed(this.destroyRef)).subscribe(value => { this.items.set(value); this.loading.set(false); });
        this.form.valueChanges.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => { this.page.set(1); this.load(); });
        this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => { const value = params.get('estado') || ''; this.status.set(this.statuses[value] ? value : ''); this.page.set(1); this.load(); });
        this.departments.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: items => this.observatories.set(items), error: () => { } });
    }
    load() { this.requests.next(); }
    setStatus(value: string) { this.status.set(value); this.page.set(1); this.load(); }
    changePage(direction: number) { this.page.update(value => Math.max(1, Math.min(value + direction, this.items()?.meta.last_page || 1))); this.load(); }
}
export { PublicationDestinationComponent } from './publication-destination.component';
export function httpUrl(control: AbstractControl) { try {
    const url = new URL(String(control.value).trim());
    return ['http:', 'https:'].includes(url.protocol) ? null : { httpUrl: true };
}
catch {
    return { httpUrl: true };
} }
@Component({ selector: 'app-site-settings', standalone: true, imports: [ReactiveFormsModule, MatIconModule], templateUrl: './site-settings.component.html', styleUrl: './workspace.scss' })
export class SiteSettingsComponent implements OnInit {
    readonly service = inject(SiteSettingsService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly fb = inject(FormBuilder);
    readonly form = this.fb.nonNullable.group({ url: ['', [Validators.required, Validators.maxLength(2048), httpUrl]] });
    readonly loading = signal(true);
    readonly saving = signal(false);
    readonly error = signal('');
    readonly saved = signal(false);
    ngOnInit() { this.load(); this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.saved.set(false)); }
    load() { this.loading.set(true); this.error.set(''); this.service.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: value => { this.form.controls.url.setValue(value.visor_geografico_url); this.loading.set(false); }, error: () => { this.error.set('No se pudo cargar la configuración.'); this.loading.set(false); } }); }
    reset() { this.form.controls.url.setValue(this.service.viewerUrl()); this.form.markAsPristine(); this.saved.set(false); this.error.set(''); }
    save() { this.form.markAllAsTouched(); if (this.loading() || this.saving() || this.form.invalid)
        return; this.saving.set(true); this.saved.set(false); this.error.set(''); this.service.save(this.form.controls.url.value.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: value => { this.form.controls.url.setValue(value.visor_geografico_url); this.form.markAsPristine(); this.saved.set(true); this.saving.set(false); }, error: () => { this.error.set('No se pudieron guardar los cambios. Inténtalo de nuevo.'); this.saving.set(false); } }); }
}

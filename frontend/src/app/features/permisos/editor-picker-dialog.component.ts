import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { catchError, debounceTime, distinctUntilChanged, of, Subject, switchMap, tap } from 'rxjs';
import { User } from '@core/models';

import { UserService } from '@core/services/user.service';

@Component({selector: 'app-editor-picker-dialog', standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatIconModule],
  templateUrl: './editor-picker-dialog.component.html', styleUrl: './user-permissions-dialog.component.scss'})
export class EditorPickerDialogComponent implements OnInit {
  private readonly api = inject(UserService);

  private readonly ref = inject(MatDialogRef<EditorPickerDialogComponent, User>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = new Subject<number>();
  readonly search = new FormControl('', {nonNullable: true});
  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);

  ngOnInit(): void {
    this.requests.pipe(tap(page => { this.page.set(page); this.loading.set(true); this.error.set(''); }),
      switchMap(page => this.api.getUsers(15, page, this.search.value.trim()).pipe(
        catchError(() => { this.error.set('No se pudieron cargar los usuarios. Inténtalo nuevamente.'); return of(null); }))),
      takeUntilDestroyed(this.destroyRef)).subscribe(response => {
        this.users.set(response?.data ?? []); this.lastPage.set(response?.meta.last_page ?? 1);
        this.total.set(response?.meta.total ?? 0); this.loading.set(false);
      });
    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load(1));
    this.load(1);
  }
  load(page: number): void { this.requests.next(page); }
  choose(user: User): void {
    if (!this.loading() && user.access_capabilities?.can_assign_editors === true) this.ref.close(user);
  }
  close(): void { this.ref.close(); }
}

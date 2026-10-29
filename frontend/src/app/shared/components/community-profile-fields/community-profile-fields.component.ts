import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { Departamento } from '@core/models';
import { COMMUNITY_LINKS } from '@core/models/user/community-profile';
import { DepartamentoService } from '@core/services/departamento.service';

@Component({
  selector: 'app-community-profile-fields',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, TranslateModule],
  templateUrl: './community-profile-fields.component.html',
  styleUrl: './community-profile-fields.component.scss',
})
export class CommunityProfileFieldsComponent implements OnInit {
  @Input({ required: true }) form!: FormGroup;
  private readonly service = inject(DepartamentoService);
  private readonly destroyRef = inject(DestroyRef);
  readonly links = COMMUNITY_LINKS;
  readonly observatories = signal<Departamento[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);

  ngOnInit(): void {
    this.refresh();
    this.service.onDepartamentosChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refresh());
  }

  refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.failed.set(false);
    this.service.getPublicos().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => { this.observatories.set(data); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); },
    });
  }
}

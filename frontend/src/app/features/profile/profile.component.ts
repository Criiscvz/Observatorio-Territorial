import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, computed, ElementRef, inject, OnInit, PLATFORM_ID, signal, ViewChild, DestroyRef } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { User } from '@core/models';
import { AuthService } from '@core/services/auth.service';
import { ProfileService, UpdateProfileData } from '@core/services/profile.service';
import { ThemeService } from '@core/services/theme.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { finalize, of, switchMap, tap } from 'rxjs';
import { AccountControlsComponent } from '@shared/components/account-controls/account-controls.component';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { communityProfilePayload, createCommunityProfileForm } from '@core/models/user/community-profile';
import { CommunityProfileFieldsComponent } from '../../shared/components/community-profile-fields/community-profile-fields.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    TranslateModule,
    CommunityProfileFieldsComponent,
    AccountControlsComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  readonly themeService = inject(ThemeService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  user = signal<User | null>(null);
  loading = signal(true);
  saving = signal(false);
  readonly communityForm = createCommunityProfileForm(this.fb);
  uploadingAvatar = signal(false);
  readonly editing = signal(false);
  readonly activeTab = signal<'personal' | 'community' | 'access'>('personal');
  readonly status = signal('');
  readonly saveError = signal(false);
  readonly avatarPreview = signal<string | null>(null);
  readonly removeAvatarPending = signal(false);
  private pendingAvatar: File | null = null;
  private savedData = '';
  readonly backDestination = computed(() => ['ADMIN', 'EDITOR'].includes(this.user()?.rol ?? '') ? '/admin/dashboard' : '/');
  readonly hasWorkspace = computed(() => ['ADMIN', 'EDITOR'].includes(this.user()?.rol ?? ''));
  get hasChanges(): boolean {
    return !!this.profileForm && (JSON.stringify(this.profileData()) !== this.savedData || !!this.pendingAvatar || this.removeAvatarPending());
  }
  constructor() {
    this.destroyRef.onDestroy(() => { if (this.avatarPreview()) URL.revokeObjectURL(this.avatarPreview()!); });
  }
  assignedObservatorios = computed(() => this.user()?.departamentos ?? []);
  isAdminUser = computed(() => this.user()?.rol === 'ADMIN');

  // Computed para obtener la URL completa del avatar
  avatarUrl = computed(() => {
    if (this.removeAvatarPending()) return null;
    if (this.avatarPreview()) return this.avatarPreview();
    const avatar = this.user()?.perfil?.avatar;
    if (!avatar) return null;
    // Si ya es una URL absoluta, retornarla
    if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return avatar;
    }
    // Construir URL completa desde el backend
    const baseUrl = environment.apiUrl.replace('/api', '');
    return `${baseUrl}${avatar}`;
  });

  profileForm!: FormGroup;

  ngOnInit(): void {
    this.initForm();

    if (isPlatformBrowser(this.platformId)) {
      this.loadProfile();
    } else {
      this.loading.set(false);
    }
  }

  private initForm(): void {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255), (control: AbstractControl) => String(control.value ?? '').trim() ? null : { required: true }]],
      telefono: ['', [Validators.maxLength(20)]],
      cargo: ['', [Validators.maxLength(100)]],
      bio: ['', [Validators.maxLength(500)]],
    });
    this.profileForm.disable();
    this.communityForm.disable();
  }

  private loadProfile(): void {
    this.loading.set(true);
    this.profileService.getProfile().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (user) => {
        this.user.set(user);
        this.authService.updateUser(user);
        this.patchForm(user);
        this.loading.set(false);
      },
      error: () => {
        // Fallback to auth service user
        const authUser = this.authService.user();
        if (authUser) {
          this.user.set(authUser);
          this.patchForm(authUser);
        }
        this.loading.set(false);
      },
    });
  }

  private patchForm(user: User): void {
    this.communityForm.patchValue({
      vinculo: user.perfil?.vinculo || '',
      institucion_tipo: user.perfil?.institucion_tipo || '',
      institucion: user.perfil?.institucion || '',
      interes_departamento_id: user.intereses?.[0]?.id || '',
    });
    this.profileForm.patchValue({
      name: user.name || '',
      telefono: user.perfil?.telefono || '',
      cargo: user.perfil?.cargo || '',
      bio: user.perfil?.bio || '',
    });
    this.profileForm.markAsPristine(); this.communityForm.markAsPristine();
    this.savedData = JSON.stringify(this.profileData());
  }

  private profileData(): UpdateProfileData {
    return { ...this.profileForm.getRawValue(), name: String(this.profileForm.getRawValue().name ?? '').trim(),
      ...communityProfilePayload(this.communityForm.getRawValue()) };
  }

  startEditing(): void {
    if (!this.user() || this.saving() || this.editing()) return;
    this.patchForm(this.user()!);
    this.profileForm.enable(); this.communityForm.enable();
    this.editing.set(true); this.status.set(''); this.saveError.set(false);
    if (this.activeTab() === 'access') this.activeTab.set('personal');
  }

  cancelEditing(): void {
    if (this.saving()) return;
    this.clearAvatarDraft();
    if (this.user()) this.patchForm(this.user()!);
    this.profileForm.disable(); this.communityForm.disable();
    this.editing.set(false); this.saveError.set(false); this.status.set('profile.workspace.cancelled');
  }

  onSubmit(): void {
    if (!this.editing() || this.saving()) return;
    if (this.profileForm.invalid || this.communityForm.invalid) {
      this.profileForm.markAllAsTouched(); this.communityForm.markAllAsTouched();
      this.activeTab.set(this.profileForm.invalid ? 'personal' : 'community');
      this.status.set('profile.workspace.invalid'); this.saveError.set(true); return;
    }
    if (!this.hasChanges) return;
    this.saving.set(true); this.saveError.set(false); this.status.set('');
    const data = this.profileData();
    let profileSaved = false;
    const update = JSON.stringify(data) !== this.savedData
      ? this.profileService.updateProfile(data).pipe(tap(user => {
          this.user.set(user); this.authService.updateUser(user);
          this.savedData = JSON.stringify(data); profileSaved = true;
        }))
      : of(this.user()!);
    update.pipe(
      switchMap(user => {
        if (this.pendingAvatar) { this.uploadingAvatar.set(true); return this.profileService.uploadAvatar(this.pendingAvatar); }
        if (this.removeAvatarPending()) { this.uploadingAvatar.set(true); return this.profileService.deleteAvatar(); }
        return of(user);
      }),
      finalize(() => { this.saving.set(false); this.uploadingAvatar.set(false); }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: response => {
        const user = { ...response, intereses: response.intereses ?? this.user()?.intereses ?? [] };
        this.user.set(user); this.authService.updateUser(user); this.clearAvatarDraft(); this.patchForm(user);
        this.profileForm.disable(); this.communityForm.disable(); this.editing.set(false);
        this.status.set('profile.messages.updateSuccess');
        this.snackBar.open(this.translate.instant('profile.messages.updateSuccess'), this.translate.instant('common.buttons.close'), { duration: 3000 });
      },
      error: () => {
        const key = profileSaved ? 'profile.workspace.partialAvatarError' : 'profile.messages.updateError';
        this.status.set(key); this.saveError.set(true);
        this.snackBar.open(this.translate.instant(key), this.translate.instant('common.buttons.close'), { duration: 6000 });
      },
    });
  }

  triggerFileInput(): void {
    if (this.editing() && !this.saving()) this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    if (!this.editing() || this.saving()) return;
    const input = event.target as HTMLInputElement, file = input.files?.[0];
    if (!file) return;
    input.value = '';
    const error = !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      ? 'profile.messages.invalidFileType' : file.size > 2 * 1024 * 1024 ? 'profile.messages.fileTooLarge' : '';
    if (error) {
      this.snackBar.open(this.translate.instant(error), this.translate.instant('common.buttons.close'), { duration: 3000 }); return;
    }
    this.clearAvatarDraft(); this.pendingAvatar = file;
    this.avatarPreview.set(URL.createObjectURL(file)); this.status.set('profile.workspace.photoPending'); this.saveError.set(false);
  }

  deleteAvatar(): void {
    if (!this.editing() || this.saving()) return;
    this.clearAvatarDraft();
    this.removeAvatarPending.set(!!this.user()?.perfil?.avatar);
    this.status.set(this.removeAvatarPending() ? 'profile.workspace.photoRemovalPending' : ''); this.saveError.set(false);
  }

  private clearAvatarDraft(): void {
    if (this.avatarPreview()) URL.revokeObjectURL(this.avatarPreview()!);
    this.avatarPreview.set(null); this.pendingAvatar = null; this.removeAvatarPending.set(false);
  }

  communityLabel(group: 'links' | 'institutions', value?: string | null): string {
    return value ? (group === 'links' ? `auth.register.community.links.${value}` : `profile.workspace.institutions.${value}`) : 'profile.workspace.notAdded';
  }

  getRoleBadgeClass(): string {
    const role = this.user()?.rol ?? 'USER';
    return `badge-${role.toLowerCase()}`;
  }

  getRoleLabel(): string {
    const roleLabels: Record<string, string> = {
      ADMIN: 'profile.roles.admin',
      EDITOR: 'profile.roles.editor',
      SUBSCRIBER: 'profile.roles.subscriber',
      USER: 'profile.roles.user',
    };

    return roleLabels[this.user()?.rol ?? 'USER'] ?? 'profile.roles.user';
  }

  getObservatorioRoleLabel(role?: string | null): string {
    const labels: Record<string, string> = {
      ADMIN: 'Administrador',
      EDITOR: 'Editor',
      LECTOR: 'Lector',
    };

    return labels[String(role ?? '').toUpperCase()] ?? 'Con acceso';
  }
}

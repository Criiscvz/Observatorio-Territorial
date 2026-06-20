import { CommonModule } from '@angular/common';
import { Component, inject, DestroyRef, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { APP_CONFIG } from '@core/config';
import { AuthService } from '@core/services/auth.service';
import { LanguageService } from '@core/services/language.service';
import { ThemeService } from '@core/services/theme.service';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss',
})
export class PublicLayoutComponent {
    private readonly destroyRef = inject(DestroyRef);
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly languageService = inject(LanguageService);
  readonly appConfig = APP_CONFIG;
  currentYear = new Date().getFullYear();
  mobileMenuOpen = signal(false);
  showObservatories = signal(false);
  showBarometer = signal(false);

  logout(): void {
    this.authService.logout().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }
}


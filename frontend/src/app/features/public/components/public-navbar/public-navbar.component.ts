import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { APP_CONFIG } from '@core/config';
import { AuthService } from '@core/services/auth.service';
import { LanguageService } from '@core/services/language.service';
import { SiteSettingsService } from '@core/services/site-settings.service';
import { ThemeService } from '@core/services/theme.service';
import { AccountControlsComponent } from '@shared/components/account-controls/account-controls.component';

@Component({
  selector: 'app-public-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatMenuModule, MatTooltipModule, TranslateModule, AccountControlsComponent],
  templateUrl: './public-navbar.component.html',
  styleUrl: './public-navbar.component.scss',
})
export class PublicNavbarComponent {
  readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);
  readonly theme = inject(ThemeService);
  readonly siteSettings = inject(SiteSettingsService);
  readonly appConfig = APP_CONFIG;
  readonly menuOpen = signal(false);
  readonly barometerActive = signal(false);

  constructor() {
    this.siteSettings.refreshPublic();
    const router = inject(Router);
    const updateBarometer = (url:string) => this.barometerActive.set(/^\/publico\/(?:barometro|datasets)(?:[/?#]|$)/.test(url));
    updateBarometer(router.url);
    router.events.pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(event => { this.menuOpen.set(false); updateBarometer(event.urlAfterRedirects); });
  }

}

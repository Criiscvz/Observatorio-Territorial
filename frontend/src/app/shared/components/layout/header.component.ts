import { Component, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '@core/services/language.service';
import { ThemeService } from '@core/services/theme.service';
import { AccountControlsComponent } from '../account-controls/account-controls.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatMenuModule, MatTooltipModule, TranslateModule, AccountControlsComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly menuExpanded = input(false);
  readonly themeService = inject(ThemeService);
  readonly languageService = inject(LanguageService);
  readonly toggleSidenav = output<void>();
}

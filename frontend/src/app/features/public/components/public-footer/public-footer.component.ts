import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { APP_CONFIG } from '@core/config';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-public-footer',
  standalone: true,
  imports: [MatIconModule, TranslateModule],
  templateUrl: './public-footer.component.html',
  styleUrl: './public-footer.component.scss',
})
export class PublicFooterComponent {
  readonly appConfig = APP_CONFIG;
  readonly currentYear = new Date().getFullYear();
}

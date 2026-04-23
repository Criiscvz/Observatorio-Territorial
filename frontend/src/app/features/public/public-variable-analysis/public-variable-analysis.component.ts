import { Component } from '@angular/core';
import { VariableAnalysisComponent } from '@shared/components/variable-analysis/variable-analysis.component';

@Component({
  selector: 'app-public-variable-analysis',
  standalone: true,
  imports: [VariableAnalysisComponent],
  template: `<app-variable-analysis [isAdmin]="false" routePrefix="/publico" />`,
})
export class PublicVariableAnalysisComponent {}

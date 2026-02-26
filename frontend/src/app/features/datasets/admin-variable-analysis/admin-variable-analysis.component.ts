import { Component } from '@angular/core';
import { VariableAnalysisComponent } from '@shared/components/variable-analysis/variable-analysis.component';

@Component({
  selector: 'app-admin-variable-analysis',
  standalone: true,
  imports: [VariableAnalysisComponent],
  template: `<app-variable-analysis [isAdmin]="true" routePrefix="/admin" />`,
})
export class AdminVariableAnalysisComponent {}

import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';

export const publicationDraftGuard: CanDeactivateFn<{ canLeave(): boolean | Observable<boolean> }> = component => component.canLeave();

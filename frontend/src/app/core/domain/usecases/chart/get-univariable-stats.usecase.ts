import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ChartRepository } from '../../repositories';
import { ChartEntity, UnivariableRequest } from '../../entities';

@Injectable({ providedIn: 'root' })
export class GetUnivariableStatsUseCase {
  private readonly repository = inject(ChartRepository);

  execute(request: UnivariableRequest): Observable<ChartEntity> {
    return this.repository.getUnivariableStats(request);
  }
}

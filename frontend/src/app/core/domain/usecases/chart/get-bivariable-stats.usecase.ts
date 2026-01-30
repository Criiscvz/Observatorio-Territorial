import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ChartRepository } from '../../repositories';
import { BivariableRequest, BivariableResponse } from '../../entities';

@Injectable({ providedIn: 'root' })
export class GetBivariableStatsUseCase {
  private readonly repository = inject(ChartRepository);

  execute(request: BivariableRequest): Observable<BivariableResponse> {
    return this.repository.getBivariableStats(request);
  }
}

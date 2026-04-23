import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ChartRepository } from '../../domain/repositories';
import { BivariableRequest, BivariableResponse, ChartEntity, UnivariableRequest } from '../../domain/entities';
import { ApiDatasource } from '../datasources/remote/api.datasource';

@Injectable({ providedIn: 'root' })
export class ChartRepositoryImpl extends ChartRepository {
  private readonly api = inject(ApiDatasource);

  getUnivariableStats(request: UnivariableRequest): Observable<ChartEntity> {
    return this.api.post<ChartEntity>('/stats/univariable', request);
  }

  getBivariableStats(request: BivariableRequest): Observable<BivariableResponse> {
    return this.api.post<BivariableResponse>('/stats/bivariable', request);
  }
}

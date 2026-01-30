import { Observable } from 'rxjs';
import { BivariableRequest, BivariableResponse, ChartEntity, UnivariableRequest } from '../entities';

export abstract class ChartRepository {
  abstract getUnivariableStats(request: UnivariableRequest): Observable<ChartEntity>;
  abstract getBivariableStats(request: BivariableRequest): Observable<BivariableResponse>;
}

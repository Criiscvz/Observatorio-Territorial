import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DatasetRepository } from '../../repositories';
import { DatasetDataResponse } from '../../entities';

@Injectable({ providedIn: 'root' })
export class GetDatasetDataUseCase {
  private readonly repository = inject(DatasetRepository);

  execute(datasetId: string, page?: number, perPage?: number): Observable<DatasetDataResponse> {
    return this.repository.getData(datasetId, page, perPage);
  }
}

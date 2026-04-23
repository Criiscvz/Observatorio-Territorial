import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DatasetRepository } from '../../repositories';
import { DatasetEntity, UploadDatasetData } from '../../entities';

@Injectable({ providedIn: 'root' })
export class UploadDatasetUseCase {
  private readonly repository = inject(DatasetRepository);

  execute(data: UploadDatasetData): Observable<DatasetEntity> {
    return this.repository.upload(data);
  }
}

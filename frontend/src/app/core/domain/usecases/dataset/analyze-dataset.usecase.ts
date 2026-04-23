import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DatasetRepository } from '../../repositories';
import { AnalysisResult } from '../../entities';

@Injectable({ providedIn: 'root' })
export class AnalyzeDatasetUseCase {
  private readonly repository = inject(DatasetRepository);

  execute(datasetId: string): Observable<AnalysisResult> {
    return this.repository.analyze(datasetId);
  }
}

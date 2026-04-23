import { Observable } from 'rxjs';
import { 
  AnalysisResult, 
  ColumnConfig, 
  DatasetDataResponse, 
  DatasetEntity, 
  UploadDatasetData,
  VariableMetadatoEntity 
} from '../entities';

export abstract class DatasetRepository {
  abstract getAll(departamentoId?: string): Observable<DatasetEntity[]>;
  abstract getById(id: string): Observable<DatasetEntity>;
  abstract upload(data: UploadDatasetData): Observable<DatasetEntity>;
  abstract analyze(id: string): Observable<AnalysisResult>;
  abstract confirmImport(id: string, columnas: ColumnConfig[]): Observable<DatasetEntity>;
  abstract getData(id: string, page?: number, perPage?: number): Observable<DatasetDataResponse>;
  abstract updateVariable(variableId: string, data: Partial<VariableMetadatoEntity>): Observable<VariableMetadatoEntity>;
}

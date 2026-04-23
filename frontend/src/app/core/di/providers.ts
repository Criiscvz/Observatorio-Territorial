import { Provider } from '@angular/core';
import { AuthRepository, ChartRepository, DatasetRepository, DepartamentoRepository } from '../domain/repositories';
import { 
  AuthRepositoryImpl, 
  ChartRepositoryImpl, 
  DatasetRepositoryImpl, 
  DepartamentoRepositoryImpl 
} from '../data/repositories';

export const repositoryProviders: Provider[] = [
  { provide: AuthRepository, useClass: AuthRepositoryImpl },
  { provide: DepartamentoRepository, useClass: DepartamentoRepositoryImpl },
  { provide: DatasetRepository, useClass: DatasetRepositoryImpl },
  { provide: ChartRepository, useClass: ChartRepositoryImpl },
];

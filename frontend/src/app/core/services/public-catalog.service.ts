import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CatalogPage, CatalogPublicationType } from '../models/publicacion/public-catalog.interface';

@Injectable({ providedIn: 'root' })
export class PublicCatalogService {
  private readonly api = inject(ApiService);

  getPage(departmentId: string, type: CatalogPublicationType, page = 1, query = ''): Observable<CatalogPage> {
    return this.api.get<CatalogPage>('/publico/publicaciones', {
      departamento_id: departmentId, tipo: type, page: String(page), per_page: '20', q: query,
    });
  }
}

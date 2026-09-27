import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AtlasCategoriasComponent } from './atlas-categorias.component';

@Component({
  selector: 'app-atlas-categorias-page',
  standalone: true,
  imports: [AtlasCategoriasComponent, RouterLink, MatButtonModule],
  template: `
    <main>
      <header>
        <div><h1>Categorías de Atlas</h1><p>Crea categorías y organiza los documentos PDF de Atlas.</p></div>
        <a mat-stroked-button routerLink="/admin/atlas">Ver todos los archivos</a>
      </header>
      <app-atlas-categorias />
    </main>
  `,
  styles: [`
    main { padding: 1.5rem; color: var(--text-primary); }
    header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    h1 { margin: 0; } p { color: var(--text-secondary); }
    @media(max-width: 600px) { main { padding: .75rem; } }
  `],
})
export class AtlasCategoriasPageComponent {}

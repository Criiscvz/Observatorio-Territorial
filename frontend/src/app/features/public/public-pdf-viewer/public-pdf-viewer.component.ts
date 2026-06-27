import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-public-pdf-viewer',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './public-pdf-viewer.component.html',
  styleUrl: './public-pdf-viewer.component.scss',
})
export class PublicPdfViewerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  pdfId: string = '';
  pdfUrl: SafeResourceUrl | null = null;
  rawUrl: string = '';
  pdfName: string = '';

  private readonly pdfMap: Record<string, { url: string, name: string }> = {
    'recuperacion-economica': {
      url: '/1-recuperacion-economica.pdf',
      name: 'Recuperación Económica'
    },
    'recaudacion-tributaria': {
      url: '/observatorio/3.%20recaudacion_tributaria.pdf',
      name: 'Recaudación Tributaria'
    }
  };

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.pdfId = params.get('id') || '';
      
      const pdfData = this.pdfMap[this.pdfId];
      if (pdfData) {
        this.rawUrl = pdfData.url;
        this.pdfName = pdfData.name;
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.rawUrl);
      } else {
        // If not found, navigate back
        this.router.navigate(['/publico/departamentos']);
      }
    });
  }

  downloadPdf(): void {
    if (!this.rawUrl) return;
    
    const link = document.createElement('a');
    link.href = this.rawUrl;
    link.download = `${this.pdfName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

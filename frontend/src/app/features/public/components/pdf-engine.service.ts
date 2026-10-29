import { Injectable } from '@angular/core';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';

@Injectable({providedIn: 'root'})
export class PdfEngineService {
  async open(data: ArrayBuffer): Promise<PDFDocumentLoadingTask> {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('assets/pdfjs/pdf.worker.min.mjs', document.baseURI).href;
    return pdfjs.getDocument({data, useWasm: false,
      cMapUrl: new URL('assets/pdfjs/cmaps/', document.baseURI).href, cMapPacked: true,
      standardFontDataUrl: new URL('assets/pdfjs/standard_fonts/', document.baseURI).href,
      wasmUrl: new URL('assets/pdfjs/wasm/', document.baseURI).href});
  }
}

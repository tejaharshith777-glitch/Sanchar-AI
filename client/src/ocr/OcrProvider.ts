import Tesseract from 'tesseract.js';

/**
 * Simple OCR provider interface.
 * Allows swapping the underlying engine without touching UI components.
 */
export interface OcrProvider {
  /**
   * Recognize text from an image file (Blob/File).
   * Returns a plain string with the extracted text.
   */
  recognize(image: File | Blob): Promise<string>;
}

/**
 * Tesseract.js (v7) based implementation.
 * On-device scan — runs fully offline in this browser (Tesseract.js/WASM).
 *
 * The worker, core WASM, and language traineddata can be self-hosted under /ocr/
 * and precached by the service worker so OCR works offline after first load.
 */
export class TesseractOcrProvider implements OcrProvider {
  private worker: Tesseract.Worker | null = null;

  private async getWorker(): Promise<Tesseract.Worker> {
    if (this.worker) return this.worker;

    // createWorker(langs, oem, options) — Tesseract.js v7 API
    // Paths are relative to the web root; can be served from Vite's public folder.
    this.worker = await Tesseract.createWorker('eng', undefined, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/tesseract-core.wasm',
      langPath: '/ocr/',
      cacheMethod: 'none',       // we self-host, no CDN cache needed
      workerBlobURL: true,
    });
    return this.worker;
  }

  async recognize(image: File | Blob): Promise<string> {
    const worker = await this.getWorker();
    const { data } = await worker.recognize(image);
    return data.text;
  }
}

// Export a singleton that can be imported directly in UI components.
export const ocrProvider: OcrProvider = new TesseractOcrProvider();

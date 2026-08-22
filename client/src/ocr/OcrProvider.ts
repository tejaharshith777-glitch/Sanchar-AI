import { createWorker, Worker } from 'tesseract.js';

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
 * Tesseract based implementation.
 * The worker, core WASM, and language traineddata are self‑hosted under /ocr/.
 * They are precached by the service worker so OCR works offline after first load.
 */
export class TesseractOcrProvider implements OcrProvider {
  private worker: Worker | null = null;

  private async getWorker(): Promise<Worker> {
    if (this.worker) return this.worker;

    // Paths are relative to the web root (served from Vite's public folder).
    const workerPath = '/ocr/worker.min.js';
    const corePath = '/ocr/tesseract-core.wasm';
    const langPath = '/ocr/eng.traineddata';

    this.worker = await createWorker({
      logger: (m) => console.debug('[Tesseract]', m),
      workerPath,
      corePath,
      langPath,
    });
    await this.worker.loadLanguage('eng');
    await this.worker.initialize('eng');
    return this.worker;
  }

  async recognize(image: File | Blob): Promise<string> {
    const worker = await this.getWorker();
    const { data } = await worker.recognize(image);
    return data.text;
  }
}

// Export a singleton that can be imported directly in UI components.
export const ocrProvider = new TesseractOcrProvider();

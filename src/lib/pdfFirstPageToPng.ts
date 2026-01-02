import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let workerConfigured = false;

function ensureWorker() {
  if (workerConfigured) return;
  // pdfjs uses a global worker url; in Vite we import it as an URL.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (GlobalWorkerOptions as any).workerSrc = workerSrc;
  workerConfigured = true;
}

export async function pdfFirstPageToPngBlob(
  file: File,
  options?: { maxWidth?: number; maxScale?: number }
): Promise<Blob> {
  ensureWorker();

  const data = await file.arrayBuffer();
  const loadingTask = getDocument({ data });
  const pdf = await loadingTask.promise;

  try {
    const page = await pdf.getPage(1);

    const viewportAt1 = page.getViewport({ scale: 1 });
    const maxWidth = options?.maxWidth ?? 1600;
    const maxScale = options?.maxScale ?? 2;
    const scale = Math.min(maxWidth / viewportAt1.width, maxScale);

    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvas, viewport }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to encode PNG"))),
        "image/png"
      );
    });

    return blob;
  } finally {
    await pdf.destroy();
  }
}

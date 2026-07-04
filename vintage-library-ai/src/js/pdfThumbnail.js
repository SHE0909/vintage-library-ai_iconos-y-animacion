// =========================================================
// MINIATURA DE PORTADA A PARTIR DE LA PRIMERA PAGINA DEL PDF
// =========================================================
// La mayoria de los libros ya tienen su portada como primera pagina
// del PDF, asi que por defecto usamos esa imagen como portada del
// lomo en la estanteria, en vez de pedirle siempre al usuario que
// suba o elija una imagen aparte. El usuario igual puede reemplazarla
// subiendo su propia imagen o eligiendo una portada prediseñada.
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const TARGET_WIDTH = 420;

/**
 * Renderiza la primera pagina de un PDF (File o Blob) como una imagen
 * JPEG y la devuelve como Blob, lista para guardarse como portada.
 */
export async function generatePdfCoverThumbnail(fileOrBlob) {
  const arrayBuffer = await fileOrBlob.arrayBuffer();
  // Copiamos el buffer: pdf.js puede "transferir" (detach) el original,
  // lo cual rompe otros usos posteriores del mismo archivo.
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
  try {
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = TARGET_WIDTH / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob); else reject(new Error('No se pudo generar la miniatura.'));
      }, 'image/jpeg', 0.86);
    });
  } finally {
    pdf.destroy();
  }
}

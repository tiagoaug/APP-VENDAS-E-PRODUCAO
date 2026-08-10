import { FilePicker } from '@capawesome/capacitor-file-picker';

// Fator de escala usado pra rasterizar cada página do PDF — exportado porque o recorte
// automático (PdfPageSelectModal) precisa converter uma margem física (mm) em pixels da
// imagem renderizada, e isso depende de saber essa mesma escala.
export const PDF_RENDER_SCALE = 3;

async function loadPdf(base64: string) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return pdfjsLib.getDocument({ data: bytes }).promise;
}

async function renderPdfPageToDataUrl(pdf: Awaited<ReturnType<typeof loadPdf>>, pageNumber: number): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/png');
}

/** Renderiza TODAS as páginas de um PDF (base64, sem prefixo data:) como PNG dataURLs, em
 * ordem — carregado sob demanda (import dinâmico) porque pdfjs-dist é uma dependência
 * pesada, só usada nesse fluxo de importação de etiqueta. */
export async function renderAllPdfPages(base64: string): Promise<string[]> {
  const pdf = await loadPdf(base64);
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    pages.push(await renderPdfPageToDataUrl(pdf, i));
  }
  return pages;
}

export type LabelImportResult =
  | { kind: 'image'; dataUrl: string }
  | { kind: 'pdf'; pages: string[] };

/** Abre o seletor de arquivo nativo (imagem ou PDF) — imagem vira um único dataURL pronto pra
 * usar; PDF é rasterizado PÁGINA POR PÁGINA (todas, não só a primeira), pra quem importa um
 * PDF de várias páginas poder escolher quais viram etiqueta (ver PdfPageSelectModal).
 * Retorna null se o usuário cancelar. */
export async function pickLabelImportFile(): Promise<LabelImportResult | null> {
  const result = await FilePicker.pickFiles({
    types: ['image/png', 'image/jpeg', 'application/pdf'],
    limit: 1,
    readData: true,
  });
  const file = result.files[0];
  if (!file || !file.data) return null;
  if (file.mimeType === 'application/pdf') {
    const pages = await renderAllPdfPages(file.data);
    return { kind: 'pdf', pages };
  }
  return { kind: 'image', dataUrl: `data:${file.mimeType};base64,${file.data}` };
}

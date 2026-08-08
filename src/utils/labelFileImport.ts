import { FilePicker } from '@capawesome/capacitor-file-picker';

// Renderiza a 1ª página de um PDF como PNG — carregado sob demanda (import dinâmico) porque
// pdfjs-dist é uma dependência pesada, só usada nesse fluxo de importação de etiqueta.
async function renderPdfFirstPageToDataUrl(base64: string): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 3 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/png');
}

/** Abre o seletor de arquivo nativo (imagem ou PDF) e devolve um PNG dataURL pronto pra usar
 * como elemento de imagem no editor de etiqueta — PDF é rasterizado (1ª página), imagem é
 * usada direto. Retorna null se o usuário cancelar. */
export async function pickLabelImportImage(): Promise<string | null> {
  const result = await FilePicker.pickFiles({
    types: ['image/png', 'image/jpeg', 'application/pdf'],
    limit: 1,
    readData: true,
  });
  const file = result.files[0];
  if (!file || !file.data) return null;
  if (file.mimeType === 'application/pdf') {
    return renderPdfFirstPageToDataUrl(file.data);
  }
  return `data:${file.mimeType};base64,${file.data}`;
}

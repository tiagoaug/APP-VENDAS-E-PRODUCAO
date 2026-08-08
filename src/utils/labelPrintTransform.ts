import { PrintOptions } from '../components/LabelPrintPreviewModal';

export const DIRECTION_TO_ROTATION: Record<PrintOptions['direction'], number> = {
  down: 0, right: 90, up: 180, left: 270,
};

/**
 * Aplica "Direção de saída" (rotaciona a etiqueta inteira 0/90/180/270°) e deslocamento
 * vertical/horizontal sobre um canvas já pronto (etiqueta já composta) — usado no caminho de
 * impressão que parte de uma imagem já renderizada (ex.: o editor de etiqueta de produto,
 * que desenha tudo num único canvas via `drawFrame`), em vez de desenhar elemento por elemento
 * como o editor de etiqueta geral (`LabelEditorView`) faz internamente no seu próprio
 * `renderToCanvas`.
 */
export function applyPrintTransform(
  source: HTMLCanvasElement,
  widthMm: number,
  heightMm: number,
  opts: { offsetXmm: number; offsetYmm: number; rotationDeg: number },
  dotsPerMm: number,
): HTMLCanvasElement {
  const rotated90 = opts.rotationDeg === 90 || opts.rotationDeg === 270;
  const pxW = Math.max(1, Math.round((rotated90 ? heightMm : widthMm) * dotsPerMm));
  const pxH = Math.max(1, Math.round((rotated90 ? widthMm : heightMm) * dotsPerMm));
  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pxW, pxH);

  ctx.translate(pxW / 2, pxH / 2);
  ctx.rotate((opts.rotationDeg * Math.PI) / 180);
  ctx.translate(
    -(widthMm * dotsPerMm) / 2 + opts.offsetXmm * dotsPerMm,
    -(heightMm * dotsPerMm) / 2 + opts.offsetYmm * dotsPerMm,
  );
  ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, widthMm * dotsPerMm, heightMm * dotsPerMm);
  return canvas;
}

import { LabelElement } from '../types';
import { toDottedQRDataURL } from './dottedQRCode';
import { resolveLabelBinding, LabelBindingContext, computeGradeLayout } from './labelFieldResolvers';

// Renderização em canvas dos elementos de uma etiqueta do editor livre (Print Studio Ablemark) —
// extraída de LabelEditorView.tsx pra ser reaproveitada também fora do editor (ex.: gerar a
// miniatura de prévia de um LabelFile salvo numa lista, sem precisar abrir o editor).

// Densidade padrão de impressoras térmicas de etiqueta (203 dpi ≈ 8 pontos/mm) — não há uma
// folha de especificação da BR-L100 documentando isso, mas é o padrão quase universal do
// mercado; ajustável aqui se uma impressão real sair com proporção errada.
export const LABEL_DOTS_PER_MM = 8;

// Mesmo conjunto de fontes do editor de etiqueta de produto (PrintLabelEditorModal) — só
// famílias "seguras" pro Canvas 2D/CSS do WebView (nada de fonte customizada/embutida).
export const FONT_OPTIONS: { value: NonNullable<LabelElement['fontFamily']>; label: string; css: string }[] = [
  { value: 'helvetica', label: 'Sans',  css: 'Helvetica, Arial, sans-serif' },
  { value: 'arial',     label: 'Arial', css: 'Arial, sans-serif' },
  { value: 'times',     label: 'Serif', css: 'Georgia, serif' },
  { value: 'courier',   label: 'Mono',  css: 'monospace' },
  { value: 'avenir',    label: 'Geo',   css: '"Century Gothic","Trebuchet MS",sans-serif' },
];
export function cssFontFamily(f?: LabelElement['fontFamily']): string {
  return FONT_OPTIONS.find(o => o.value === f)?.css || FONT_OPTIONS[0].css;
}

export function loadImage(src: string, crossOrigin?: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Só necessário pra URL remota (ex.: foto do produto vinda do Storage) — sem isso o canvas
    // fica "tainted" e toDataURL()/toBlob() falham depois. dataURL local (base64) não precisa.
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem'));
    img.src = src;
  });
}

// `bindingCtx` resolve os elementos com `dataBinding` — item real (impressão/prévia em lote) ou
// `null` (placeholder de exemplo, ex.: miniatura de um modelo fora do contexto de uma venda).
export async function renderLabelElementsToCanvas(
  elements: LabelElement[],
  widthMm: number,
  heightMm: number,
  printOptions: { offsetXmm: number; offsetYmm: number; rotationDeg: number } = { offsetXmm: 0, offsetYmm: 0, rotationDeg: 0 },
  bindingCtx: LabelBindingContext | null = null,
): Promise<HTMLCanvasElement> {
  const DOTS_PER_MM = LABEL_DOTS_PER_MM;
  // "Direção de saída" gira a etiqueta inteira (0/90/180/270°) antes de comprimir — pra
  // 90°/270° a etiqueta impressa fica deitada, então o canvas físico troca largura/altura.
  const rotated90 = printOptions.rotationDeg === 90 || printOptions.rotationDeg === 270;
  const pxW = Math.max(1, Math.round((rotated90 ? heightMm : widthMm) * DOTS_PER_MM));
  const pxH = Math.max(1, Math.round((rotated90 ? widthMm : heightMm) * DOTS_PER_MM));
  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pxW, pxH);

  // Transformação global: centraliza, gira pela direção de saída, desfaz a centralização
  // (agora no sistema de coordenadas girado) e aplica o deslocamento vertical/horizontal —
  // tudo isso antes de desenhar cada elemento na sua posição normal (não rotacionada).
  ctx.translate(pxW / 2, pxH / 2);
  ctx.rotate((printOptions.rotationDeg * Math.PI) / 180);
  ctx.translate(-widthMm * DOTS_PER_MM / 2 + printOptions.offsetXmm * DOTS_PER_MM, -heightMm * DOTS_PER_MM / 2 + printOptions.offsetYmm * DOTS_PER_MM);

  for (const el of elements) {
    if (el.hidden) continue;
    const wPx = el.w * DOTS_PER_MM;
    const hPx = el.h * DOTS_PER_MM;
    const cx = (el.x + el.w / 2) * DOTS_PER_MM;
    const cy = (el.y + el.h / 2) * DOTS_PER_MM;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((el.rotation * Math.PI) / 180);

    const resolved = el.dataBinding ? resolveLabelBinding(el.dataBinding, bindingCtx, el.combineFields, el.sectorNoteFilter) : null;

    if (el.type === 'text') {
      const text = resolved ? (resolved.kind === 'text' ? resolved.text : '') : (el.text || '');
      const fontPx = Math.max(6, (el.fontSize || 4) * DOTS_PER_MM);
      const lineHeight = (el.lineHeight || 1) * fontPx * 1.15;
      // Efeito "chip" (Inverter) — fundo preto arredondado do tamanho do elemento, texto
      // branco por cima; mesmo visual de PrintLabelEditorModal.tsx (drawText, el.invert).
      if (el.invert) {
        const radius = el.borderRadius !== undefined ? el.borderRadius * DOTS_PER_MM : Math.min(hPx / 2, DOTS_PER_MM * 1.2);
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(-wPx / 2, -hPx / 2, wPx, hPx, radius);
        } else {
          ctx.rect(-wPx / 2, -hPx / 2, wPx, hPx);
        }
        ctx.fill();
      }
      ctx.fillStyle = el.invert ? '#ffffff' : '#000000';
      ctx.font = `${el.italic ? 'italic ' : ''}${el.bold ? 'bold ' : ''}${fontPx}px ${cssFontFamily(el.fontFamily)}`;
      try { (ctx as any).letterSpacing = `${el.letterSpacing || 0}px`; } catch { /* não suportado, ignora */ }
      ctx.textAlign = el.align === 'left' ? 'left' : el.align === 'right' ? 'right' : 'center';
      ctx.textBaseline = 'middle';
      const xOff = el.align === 'left' ? -wPx / 2 : el.align === 'right' ? wPx / 2 : 0;
      const lines = text.split('\n');
      const totalH = lines.length * lineHeight;
      lines.forEach((line, i) => {
        const yOff = -totalH / 2 + lineHeight * (i + 0.5);
        ctx.fillText(line, xOff, yOff, wPx);
        if (el.underline) {
          const width = ctx.measureText(line).width;
          const underlineX = el.align === 'left' ? xOff : el.align === 'right' ? xOff - width : xOff - width / 2;
          ctx.fillRect(underlineX, yOff + fontPx * 0.35, width, Math.max(1, fontPx * 0.06));
        }
      });
    } else if (el.type === 'line') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(-wPx / 2, -hPx / 2, wPx, hPx);
    } else if (el.type === 'shape') {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(1, DOTS_PER_MM * 0.25);
      const shapeRadius = (el.borderRadius || 0) * DOTS_PER_MM;
      if (shapeRadius > 0 && typeof (ctx as any).roundRect === 'function') {
        ctx.beginPath();
        (ctx as any).roundRect(-wPx / 2, -hPx / 2, wPx, hPx, shapeRadius);
        ctx.stroke();
      } else {
        ctx.strokeRect(-wPx / 2, -hPx / 2, wPx, hPx);
      }
    } else if (el.type === 'grade') {
      // Tabela tamanho×quantidade — mesma proporção da "Grade" de PrintLabelEditorModal.tsx
      // (ver computeGradeLayout), em mm relativos à própria caixa do elemento (0,0 = canto
      // superior esquerdo antes de recentralizar, por isso o -wPx/2/-hPx/2 abaixo).
      const gridEntries = resolved?.kind === 'grade' ? resolved.gridEntries : [];
      const cells = computeGradeLayout(gridEntries, 0, 0, el.w, el.h, el.fontSize || 3.5);
      const fontPx = Math.max(6, (el.fontSize || 3.5) * DOTS_PER_MM);
      // Estilo da pílula da numeração (não afeta a quantidade abaixo, que continua sempre
      // preta) — ver LabelElement.gradeSizeStyle.
      const sizeStyle = el.gradeSizeStyle || 'filled';
      cells.forEach(c => {
        const pillX = -wPx / 2 + c.pillXmm * DOTS_PER_MM;
        const pillY = -hPx / 2 + c.pillYmm * DOTS_PER_MM;
        const pillW = c.pillWmm * DOTS_PER_MM;
        const pillH = c.pillHmm * DOTS_PER_MM;
        if (sizeStyle !== 'plain') {
          ctx.beginPath();
          if (typeof (ctx as any).roundRect === 'function') {
            (ctx as any).roundRect(pillX, pillY, pillW, pillH, Math.min(pillH / 2, DOTS_PER_MM * 0.5));
          } else {
            ctx.rect(pillX, pillY, pillW, pillH);
          }
          ctx.fillStyle = sizeStyle === 'inverted' ? '#ffffff' : '#000000';
          ctx.fill();
          if (sizeStyle === 'inverted') {
            ctx.lineWidth = Math.max(1, DOTS_PER_MM * 0.25);
            ctx.strokeStyle = '#000000';
            ctx.stroke();
          }
        }
        ctx.fillStyle = sizeStyle === 'filled' ? '#ffffff' : '#000000';
        ctx.font = `900 ${fontPx}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.sz, pillX + pillW / 2, pillY + pillH / 2);
        if (c.qty !== null) {
          ctx.fillStyle = '#000000';
          ctx.font = `900 ${fontPx * 0.85}px Arial`;
          ctx.fillText(`${c.qty}`, -wPx / 2 + c.qtyCxMm * DOTS_PER_MM, -hPx / 2 + c.qtyCyMm * DOTS_PER_MM);
        }
      });
    } else if (el.type === 'qr' && el.dataBinding === 'qr') {
      if (resolved?.kind === 'qr') {
        const dataUrl = await toDottedQRDataURL(resolved.qrText, { margin: 1, width: 800 });
        const img = await loadImage(dataUrl);
        ctx.drawImage(img, -wPx / 2, -hPx / 2, wPx, hPx);
      }
    } else if (el.type === 'image' && el.dataBinding === 'photo') {
      if (resolved?.kind === 'image') {
        const img = await loadImage(resolved.imageUrl, true);
        ctx.filter = el.grayscale ? 'grayscale(1)' : 'none';
        ctx.drawImage(img, -wPx / 2, -hPx / 2, wPx, hPx);
      }
    } else if (el.imageDataUrl) {
      const img = await loadImage(el.imageDataUrl);
      ctx.filter = el.grayscale ? 'grayscale(1)' : 'none';
      ctx.drawImage(img, -wPx / 2, -hPx / 2, wPx, hPx);
    }
    ctx.restore();
  }
  return canvas;
}

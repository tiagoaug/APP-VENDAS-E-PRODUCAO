import jsPDF from 'jspdf';
import { CompanyProfile } from '../types';

// Altura fixa da faixa de identidade da empresa — mesma independente de logo carregar ou não,
// pra quem monta o layout do documento (JPG/PDF) poder reservar o espaço ANTES de desenhar de
// verdade (a foto do logo só carrega depois, de forma assíncrona).
export const BRAND_BAND_H_PX = 56;
export const BRAND_BAND_H_MM = 16;

function hasBrandContent(profile: CompanyProfile | null | undefined): boolean {
  if (!profile || profile.exportPosition === 'none') return false;
  return !!(
    (profile.showName && profile.name) ||
    (profile.showPhone && profile.phone) ||
    (profile.showAddress && profile.address) ||
    (profile.showLogo && profile.logoUrl)
  );
}

// Altura que a faixa vai ocupar (0 = desligada ou sem nenhum dado marcado pra mostrar) — chame
// isso ANTES de montar o layout do documento, pra reservar o espaço certo.
export function getBrandBandHeight(profile: CompanyProfile | null | undefined, unit: 'px' | 'mm'): number {
  if (!hasBrandContent(profile)) return 0;
  return unit === 'px' ? BRAND_BAND_H_PX : BRAND_BAND_H_MM;
}

function loadBrandImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Corta o texto com reticências se não couber na largura disponível — sem isso, telefone +
// endereço longos simplesmente vazam pra fora do canvas/página e ficam cortados no meio da palavra.
function fitCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (maxWidth <= 0 || ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid; else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo) + '…' : '';
}

function fitPdfText(doc: jsPDF, text: string, maxWidth: number): string {
  if (maxWidth <= 0 || doc.getTextWidth(text) <= maxWidth) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (doc.getTextWidth(text.slice(0, mid) + '…') <= maxWidth) lo = mid; else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo) + '…' : '';
}

/** Desenha a faixa de identidade da empresa num canvas (exports em JPG/PNG) na posição `y`,
 * ocupando BRAND_BAND_H_PX de altura — só chame se getBrandBandHeight já tiver retornado > 0. */
export async function drawCompanyBrandingOnCanvas(
  ctx: CanvasRenderingContext2D,
  profile: CompanyProfile,
  y: number,
  width: number,
): Promise<void> {
  const pad = 16;
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, y, width, BRAND_BAND_H_PX);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const lineY = profile.exportPosition === 'header' ? y + BRAND_BAND_H_PX : y;
  ctx.moveTo(0, lineY);
  ctx.lineTo(width, lineY);
  ctx.stroke();

  let textX = pad;
  if (profile.showLogo && profile.logoUrl) {
    const img = await loadBrandImage(profile.logoUrl);
    if (img) {
      const logoSize = BRAND_BAND_H_PX - 16;
      ctx.drawImage(img, pad, y + 8, logoSize, logoSize);
      textX = pad + logoSize + 10;
    }
  }

  const hasName = profile.showName && profile.name;
  const details = [profile.showPhone && profile.phone, profile.showAddress && profile.address].filter(Boolean).join(' · ');
  ctx.textAlign = 'left';
  const midY = y + BRAND_BAND_H_PX / 2;
  const maxTextWidth = width - textX - pad;
  let ty = hasName && details ? midY - 6 : midY + 4;
  if (hasName) {
    ctx.font = 'bold 13px Arial';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(fitCanvasText(ctx, profile.name!, maxTextWidth), textX, ty);
    ty += 16;
  }
  if (details) {
    ctx.font = '500 10px Arial';
    ctx.fillStyle = '#64748b';
    ctx.fillText(fitCanvasText(ctx, details, maxTextWidth), textX, ty);
  }
  ctx.restore();
}

/** Mesma ideia pro PDF (jsPDF, unidade mm) — só chame se getBrandBandHeight já tiver
 * retornado > 0. Logo em formato não suportado pelo jsPDF (ex.: WebP) simplesmente não desenha
 * a imagem, sem quebrar o resto do documento. */
export function drawCompanyBrandingOnPdf(
  doc: jsPDF,
  profile: CompanyProfile,
  y: number,
  pageWidth: number,
): void {
  const pad = 6;
  doc.setFillColor(248, 250, 252);
  doc.rect(0, y, pageWidth, BRAND_BAND_H_MM, 'F');
  doc.setDrawColor(226, 232, 240);
  const lineY = profile.exportPosition === 'header' ? y + BRAND_BAND_H_MM : y;
  doc.line(0, lineY, pageWidth, lineY);

  let textX = pad;
  if (profile.showLogo && profile.logoUrl) {
    try {
      const fmt = profile.logoUrl.includes('image/png') ? 'PNG' : 'JPEG';
      const logoSize = BRAND_BAND_H_MM - 4;
      doc.addImage(profile.logoUrl, fmt, pad, y + 2, logoSize, logoSize);
      textX = pad + logoSize + 4;
    } catch {
      // formato de imagem não suportado pelo jsPDF — segue sem logo, resto do documento intacto
    }
  }

  const hasName = profile.showName && profile.name;
  const details = [profile.showPhone && profile.phone, profile.showAddress && profile.address].filter(Boolean).join(' · ');
  const maxTextWidth = pageWidth - textX - pad;
  let ty = hasName && details ? y + BRAND_BAND_H_MM / 2 - 1 : y + BRAND_BAND_H_MM / 2 + 1.5;
  if (hasName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(fitPdfText(doc, profile.name!, maxTextWidth), textX, ty);
    ty += 4;
  }
  if (details) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(fitPdfText(doc, details, maxTextWidth), textX, ty);
  }
}

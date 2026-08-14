import { format } from 'date-fns';
import { shareImage } from './pdfExport';
import { toast } from './toast';

// Lista de produtos "em falta" — itens do Cruzamento de Estoque (Vendas) onde a demanda
// das vendas visíveis supera o estoque disponível, prontos pra imagem exportável (compra,
// grupo de fornecedores, etc.), sem precisar printar a tela.
export interface StockShortageItem {
  reference: string;
  productName: string;
  colorName: string;
  size?: string; // só varejo (pares) — atacado (caixas) não tem tamanho
  unit: 'cx' | 'pr';
  missing: number;
}

const HEADER_BG = '#0f172a'; // slate-900
const MISSING_COLOR = '#e11d48'; // rose-600

export const exportStockShortageReport = async (items: StockShortageItem[], filename: string) => {
  try {
    await generateJPG(items, filename);
  } catch (error) {
    console.error('Export error:', error);
    toast.show('Erro ao gerar imagem. Por favor, tente novamente.');
  }
};

const roundRectPath = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
};

async function generateJPG(items: StockShortageItem[], filename: string) {
  const W = 600;
  const S = 2;
  const pad = 24;
  const ROW_H = 56;

  const totalMissing = items.reduce((sum, i) => sum + i.missing, 0);

  const HEADER_H = 88, INFO_H = 60, TH_H = 34;
  const itemsH = items.length * ROW_H;
  const totalH = HEADER_H + INFO_H + TH_H + itemsH + 28;

  const canvas = document.createElement('canvas');
  canvas.width = W * S; canvas.height = totalH * S;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(S, S);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, totalH);

  let y = 0;

  // Header
  ctx.fillStyle = HEADER_BG;
  ctx.fillRect(0, y, W, HEADER_H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Produtos em Falta', W / 2, y + 36);
  ctx.font = '600 13px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Cruzamento de Estoque — Demanda x Estoque', W / 2, y + 58);
  ctx.font = '500 10px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, W / 2, y + 75);
  y += HEADER_H;

  // Info box
  roundRectPath(ctx, pad, y + 10, W - pad * 2, INFO_H - 10, 16);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('ITENS EM FALTA', pad + 14, y + 26);
  ctx.font = 'bold 17px Arial';
  ctx.fillStyle = HEADER_BG;
  ctx.fillText(`${items.length}`, pad + 14, y + 46);
  ctx.textAlign = 'right';
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('TOTAL FALTANTE', W - pad - 14, y + 26);
  ctx.font = 'bold 17px Arial';
  ctx.fillStyle = MISSING_COLOR;
  ctx.fillText(`${totalMissing}`, W - pad - 14, y + 46);
  y += INFO_H;

  // Table header
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(pad, y, W - pad * 2, TH_H);
  ctx.font = 'bold 9px Arial';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText('REF. / MODELO / COR', pad + 12, y + TH_H / 2 + 4);
  ctx.textAlign = 'right';
  ctx.fillText('FALTAM', W - pad - 12, y + TH_H / 2 + 4);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad, y + TH_H); ctx.lineTo(W - pad, y + TH_H); ctx.stroke();
  y += TH_H;

  // Rows
  items.forEach((item, i) => {
    if (i % 2 === 1) {
      roundRectPath(ctx, pad + 4, y + 4, W - pad * 2 - 8, ROW_H - 8, 14);
      ctx.fillStyle = '#fafafa';
      ctx.fill();
    }

    const title = [item.reference, item.productName].filter(Boolean).join(' • ');
    ctx.textAlign = 'left';
    ctx.font = '700 13px Arial';
    ctx.fillStyle = '#334155';
    ctx.fillText(title, pad + 12, y + 24);

    const subtitle = [item.colorName, item.size ? `Nº ${item.size}` : null].filter(Boolean).join(' · ');
    ctx.font = '500 11px Arial';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(subtitle, pad + 12, y + 40);

    ctx.textAlign = 'right';
    ctx.font = 'bold 15px Arial';
    ctx.fillStyle = MISSING_COLOR;
    ctx.fillText(`${item.missing} ${item.unit}`, W - pad - 12, y + 32);

    ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, y + ROW_H); ctx.lineTo(W - pad, y + ROW_H); ctx.stroke();
    y += ROW_H;
  });

  await shareImage(canvas.toDataURL('image/jpeg', 0.95), filename);
}

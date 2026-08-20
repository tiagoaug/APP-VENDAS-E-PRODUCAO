import { BatchLabelItem, LabelDataBinding, ProductionLot, Sector, SectorNote, ServiceOrder, Variation } from '../types';

// Funções puras de resolução de dados de etiqueta, compartilhadas entre o sistema de blocos
// fixos (PrintLabelEditorModal.tsx, "Elementos e Camadas") e o editor livre com vínculo a dados
// de venda (LabelEditorView.tsx, modo de teste em Vendas) — extraídas de
// PrintLabelEditorModal.tsx pra não duplicar essa lógica nos dois lugares.

// Junta Referência/Nome/Cor num texto só, na ordem fixa Ref → Nome → Cor, só com os campos
// marcados. Movida de PrintLabelEditorModal.tsx sem mudança de comportamento.
export function combineRefFields(
  combineFields: ('reference' | 'name' | 'color')[] | undefined,
  refText: string, nameText: string, colorText: string,
): string {
  if (!combineFields || combineFields.length === 0) return refText;
  const parts: string[] = [];
  if (combineFields.includes('reference')) parts.push(refText);
  if (combineFields.includes('name')) parts.push(nameText);
  if (combineFields.includes('color')) parts.push(colorText);
  return parts.filter(Boolean).join(' - ');
}

// "38x2-39x3" → [{sz:'38',qty:2},{sz:'39',qty:3}]. Movida de PrintLabelEditorModal.tsx sem
// mudança de comportamento (já era pura, sem dependência do componente).
export function parseSizeGridEntries(sg: string): { sz: string; qty: number | null }[] {
  return sg
    ? sg.split('-').map(tok => { const [sz, q] = tok.split('x'); return { sz, qty: q ? parseInt(q) : null }; })
    : [];
}

// Texto de observações por setor de uma variação — sem filtro, concatena todos os setores com
// cabeçalho; com filtro, pega uma nota específica (setor + nome). Movida de
// PrintLabelEditorModal.tsx: só mudou de closure (capturava `sectors` do componente) pra
// parâmetro explícito, mesmo comportamento.
export function getSectorNotesText(
  v: Variation | undefined, sectors: Sector[], filter?: { sectorId: string; noteName: string },
): string {
  if (!v?.sectorNotes) return '';
  if (filter) {
    const notes = (v.sectorNotes[filter.sectorId] || []) as SectorNote[];
    const match = notes.find(n => (n.name || '').toUpperCase() === filter.noteName.toUpperCase()) || notes.find(n => n.text);
    return match?.text || '';
  }
  return Object.entries(v.sectorNotes)
    .flatMap(([sid, notes]) => {
      const sector = sectors.find(s => s.id === sid);
      const sectorName = (sector?.name || sid).toUpperCase();
      return (notes as SectorNote[]).filter(n => n.text)
        .map(n => { const header = n.name ? `${sectorName} — ${n.name.toUpperCase()}` : sectorName; return `${header}\n${n.text}`; });
    }).join('\n');
}

// Payload do QR Code de uma etiqueta de produto — mesmo formato que scannerService.ts já
// entende (`PRD|productId|variationId|size[|SALE|saleId | |lotId|orderId|itemIdx]`). Extraída
// de PrintLabelEditorModal.tsx (qrRouteSuffix + montagem do `qd`) pra reuso.
export function buildLabelQrPayload(item: BatchLabelItem, sizeOrGrid: string): string {
  const suffix = (item.lotId && item.orderId)
    ? `|${item.lotId}|${item.orderId}|${item.itemIdx ?? ''}`
    : (item.saleId ? `|SALE|${item.saleId}` : '');
  return `PRD|${item.product.id}|${item.variation.id}|${sizeOrGrid}${suffix}`;
}

// ─── Vínculo de campo (LabelDataBinding) ↔ dado real de Vendas ────────────────────────────────

export interface LabelBindingContext {
  item: BatchLabelItem;
  // Presentes só quando o editor foi aberto a partir do PCP (ver LabelEditorSession.productionContext
  // em LabelEditorView.tsx) — usados pelos bindings 'osdata'/'sectornotes'.
  lot?: ProductionLot;
  os?: ServiceOrder | null;
  sectors?: Sector[];
}

export type ResolvedBinding =
  | { kind: 'text'; text: string }
  | { kind: 'image'; imageUrl: string }
  | { kind: 'qr'; qrText: string }
  | { kind: 'grade'; gridEntries: { sz: string; qty: number | null }[] }
  | { kind: 'empty' }; // sem dado disponível (ex.: produto sem miniatura de etiqueta cadastrada)

// Valores de exemplo mostrados ao editar um modelo fora do contexto de uma venda (sem
// LabelBindingContext) — mantém o editor útil pra desenhar/posicionar sem precisar abrir a
// partir de uma venda real toda vez.
const PLACEHOLDER_TEXT: Partial<Record<LabelDataBinding, string>> = {
  reference: 'REF-0000',
  name: 'Nome do Produto',
  color: 'Cor Exemplo',
  size: '38x2-39x3',
  customer: 'Cliente Exemplo',
  recipient: 'Destinatário Exemplo',
  packaging: 'Caixa Padrão',
  osdata: 'OS-0000 | Fornecedor Exemplo | R$ 0,00',
  sectornotes: 'Observação de exemplo do setor',
};
const PLACEHOLDER_GRADE_ENTRIES: { sz: string; qty: number | null }[] = [
  { sz: '38', qty: 2 }, { sz: '39', qty: 3 }, { sz: '40', qty: 1 },
];

// `combineFields` só se aplica ao binding 'reference' (ver LabelElement.combineFields) — junta
// Referência/Nome/Cor num texto só, na mesma ordem fixa e regra de combineRefFields.
export function resolveLabelBinding(
  binding: LabelDataBinding, ctx: LabelBindingContext | null,
  combineFields?: ('reference' | 'name' | 'color')[],
  sectorNoteFilter?: { sectorId: string; noteName: string },
): ResolvedBinding {
  if (binding === 'reference' && combineFields && combineFields.length > 0) {
    const refText = ctx ? (ctx.item.product.reference || ctx.item.product.name) : PLACEHOLDER_TEXT.reference!;
    const nameText = ctx ? ctx.item.product.name : PLACEHOLDER_TEXT.name!;
    const colorText = ctx ? (ctx.item.variation.colorName || '---') : PLACEHOLDER_TEXT.color!;
    return { kind: 'text', text: combineRefFields(combineFields, refText, nameText, colorText) };
  }
  if (!ctx) {
    if (binding === 'qr') return { kind: 'qr', qrText: 'EXEMPLO' };
    if (binding === 'grade') return { kind: 'grade', gridEntries: PLACEHOLDER_GRADE_ENTRIES };
    if (binding === 'photo') return { kind: 'empty' };
    return { kind: 'text', text: PLACEHOLDER_TEXT[binding] || '' };
  }
  const { item } = ctx;
  switch (binding) {
    case 'reference': return { kind: 'text', text: item.product.reference || item.product.name };
    case 'name': return { kind: 'text', text: item.product.name };
    case 'color': return { kind: 'text', text: item.variation.colorName || '---' };
    case 'size': return { kind: 'text', text: item.sizeGrid };
    case 'customer': return { kind: 'text', text: item.customerName || '' };
    case 'recipient': return { kind: 'text', text: item.recipientName || '' };
    case 'packaging': return { kind: 'text', text: item.packagingName || '' };
    case 'qr': return { kind: 'qr', qrText: buildLabelQrPayload(item, item.sizeGrid) };
    case 'photo': return item.product.labelThumbnailUrl ? { kind: 'image', imageUrl: item.product.labelThumbnailUrl } : { kind: 'empty' };
    case 'grade': return { kind: 'grade', gridEntries: parseSizeGridEntries(item.sizeGrid) };
    case 'osdata':
      return ctx.os ? { kind: 'text', text: `${ctx.os.osNumber} | ${ctx.os.providerName} | R$ ${ctx.os.totalValue.toFixed(2)}` } : { kind: 'empty' };
    case 'sectornotes':
      return { kind: 'text', text: getSectorNotesText(item.variation, ctx.sectors || [], sectorNoteFilter) };
    default: return { kind: 'empty' };
  }
}

// ─── Geometria da tabela de grade (tamanho×quantidade) ─────────────────────────────────────────
// Porta a lógica de layout (proporções, não o desenho em si) da tabela de "Grade" já usada em
// PrintLabelEditorModal.tsx (drawFrame, pílulas tamanho/quantidade) — em unidades mm, pra cada
// chamador converter pra px na sua própria resolução (DPI de exportação JPG vs. impressora
// térmica são diferentes).
export const GRADE_PAD_MM = 0.4;
const GRADE_TOTAL_WIDTH_FACTOR = 1.6;

export interface GradeCellLayout {
  sz: string;
  qty: number | null;
  isTotal: boolean;
  pillXmm: number; pillYmm: number; pillWmm: number; pillHmm: number;
  labelCxMm: number; labelCyMm: number;
  qtyCxMm: number; qtyCyMm: number;
}

export function computeGradeLayout(
  gridEntries: { sz: string; qty: number | null }[], boxXmm: number, boxYmm: number, boxWmm: number, boxHmm: number,
): GradeCellLayout[] {
  if (gridEntries.length === 0) return [];
  const hasQty = gridEntries.some(e => e.qty !== null);
  const totalQty = gridEntries.reduce((s, e) => s + (e.qty || 0), 0);
  const totalUnits = gridEntries.length + (hasQty ? GRADE_TOTAL_WIDTH_FACTOR : 0);
  const cellW = boxWmm / totalUnits;
  const totalCellW = cellW * GRADE_TOTAL_WIDTH_FACTOR;
  const szH = hasQty ? boxHmm * 0.48 : boxHmm * 0.70;
  const pad = GRADE_PAD_MM;

  const cells: GradeCellLayout[] = gridEntries.map((e, idx) => {
    const cellX = boxXmm + cellW * idx;
    const cx = cellX + cellW / 2;
    return {
      sz: e.sz, qty: e.qty, isTotal: false,
      pillXmm: cellX + pad, pillYmm: boxYmm + pad, pillWmm: cellW - pad * 2, pillHmm: szH,
      labelCxMm: cx, labelCyMm: boxYmm + szH * 0.52,
      qtyCxMm: cx, qtyCyMm: boxYmm + szH + (boxHmm - szH) * 0.6,
    };
  });

  if (hasQty) {
    const cellX = boxXmm + cellW * gridEntries.length;
    const cx = cellX + totalCellW / 2;
    cells.push({
      sz: 'TOTAL', qty: totalQty, isTotal: true,
      pillXmm: cellX + pad, pillYmm: boxYmm + pad, pillWmm: totalCellW - pad * 2, pillHmm: szH,
      labelCxMm: cx, labelCyMm: boxYmm + szH * 0.52,
      qtyCxMm: cx, qtyCyMm: boxYmm + szH + (boxHmm - szH) * 0.6,
    });
  }
  return cells;
}

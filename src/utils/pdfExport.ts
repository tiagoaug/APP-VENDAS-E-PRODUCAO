import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import jsPDF from 'jspdf';
import type { ProductionLot, Product, ProductionConfigItem, ServiceOrder } from '../types';
import { toast } from './toast';

// ─── Shared A4 Lot/Sector Sheet Printer ──────────────────────────────────────

export interface PrintLotSheetOptions {
  lot: ProductionLot;
  product?: Product;
  variationName?: string;
  sectorName?: string;
  os?: ServiceOrder | null;
  productionConfigs?: ProductionConfigItem[];
}

const PRINT_STYLES = `
  @media screen { #_lot_print_container { display: none !important; } }
  @page { size: A4 portrait; margin: 1.8cm 1.5cm; }
  @media print {
    body > *:not(#_lot_print_container) { display: none !important; }
    #_lot_print_container {
      display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important;
      font-family: 'Outfit','Inter',-apple-system,BlinkMacSystemFont,sans-serif !important;
      color: #000 !important; background: #fff !important;
    }
    .pp { page-break-after: always; page-break-inside: avoid; padding: 0 !important; margin: 0 !important; }
    .pp:last-child { page-break-after: avoid; }
    table { width: 100% !important; border-collapse: collapse !important; margin: 10px 0 !important; }
    th, td { border: 1px solid #000 !important; padding: 5px 6px !important; text-align: left !important; font-size: 10px !important; word-break: break-word; }
    th { background-color: #f3f4f6 !important; font-weight: 900 !important; text-transform: uppercase !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .gc { text-align: center !important; font-weight: 900 !important; background: #e5e7eb !important; }
    .gv { text-align: center !important; font-weight: 900 !important; font-size: 13px !important; }
    .badge { background: #e0f2fe !important; border: 1.5px solid #000 !important; color: #000 !important; padding: 4px 10px !important; border-radius: 4px !important; font-weight: 900 !important; font-size: 10px !important; display: inline-block !important; text-transform: uppercase !important; }
    .info-label { font-weight: 800 !important; text-transform: uppercase !important; font-size: 10px !important; color: #374151 !important; display: block !important; margin-bottom: 2px !important; }
    .info-val { font-weight: bold !important; font-size: 13px !important; }
  }
`;

export const printLotSheet = ({ lot, product, variationName, sectorName, os, productionConfigs = [] }: PrintLotSheetOptions) => {
  const container = document.getElementById('_lot_print_container');
  if (container) container.remove();

  const wrap = document.createElement('div');
  wrap.id = '_lot_print_container';

  const style = document.createElement('style');
  style.innerHTML = PRINT_STYLES;
  wrap.appendChild(style);

  const date = new Date().toLocaleDateString('pt-BR');
  const pairs = lot.pairs || {};
  const sizes = Object.keys(pairs);
  const variation = product?.variations.find(v => v.id === lot.variationId);
  const colorName = variationName || variation?.colorName || '—';

  // Materials summary from variation consumptions
  const materialsSummary: Record<string, { name: string; ref: string; consumption: number; unit: string }> = {};
  const consumptions = variation?.consumptions?.filter(c => c.category === 'CUTTING_PIECE') || [];
  consumptions.forEach(piece => {
    const mat = productionConfigs.find(c => c.id === piece.materialId && c.type === 'MATERIAL');
    if (!mat) return;
    const unitName = productionConfigs.find(u => u.id === mat.metadata?.unitId)?.name || 'UN';
    const totalCons = lot.quantity * (Number(piece.quantity) || 0);
    if (!materialsSummary[mat.id]) {
      materialsSummary[mat.id] = { name: mat.name, ref: mat.metadata?.reference || 'S/Ref', consumption: 0, unit: unitName };
    }
    materialsSummary[mat.id].consumption += totalCons;
  });

  const materialsRows = Object.values(materialsSummary).length > 0
    ? Object.values(materialsSummary).map(m => `
        <tr>
          <td style="font-weight:bold;">${m.name}</td>
          <td>${m.ref}</td>
          <td style="text-align:right;font-weight:900;">${m.consumption.toFixed(3)} ${m.unit}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" style="text-align:center;color:#6b7280;font-style:italic;">Sem materiais cadastrados na ficha técnica desta variação</td></tr>`;

  const osBlock = os
    ? `<div style="margin-bottom:18px;padding:10px 14px;border:1.5px solid #000;border-radius:6px;background:#f9fafb;">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#374151;margin-bottom:4px;">Ordem de Serviço</div>
        <div style="display:flex;gap:32px;flex-wrap:wrap;">
          <div><span style="font-size:9px;color:#6b7280;display:block;">Número</span><strong>${os.osNumber}</strong></div>
          <div><span style="font-size:9px;color:#6b7280;display:block;">Prestador</span><strong>${os.providerName || '—'}</strong></div>
          <div><span style="font-size:9px;color:#6b7280;display:block;">Total</span><strong>R$ ${os.totalValue.toFixed(2)}</strong></div>
        </div>
      </div>`
    : '';

  wrap.innerHTML += `
    <div class="pp">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #000;padding-bottom:12px;margin-bottom:22px;">
        <div>
          <h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;">GESTÃO PRO</h1>
          <p style="margin:3px 0 0 0;font-size:10px;font-weight:800;color:#4b5563;text-transform:uppercase;letter-spacing:2px;">Sistema de Produção &amp; PCP</p>
        </div>
        <div style="text-align:right;">
          <span class="badge">Ficha Técnica – Materiais e Grade</span>
          <p style="margin:6px 0 0 0;font-size:12px;font-weight:900;text-transform:uppercase;color:#374151;">
            Lote: #${lot.orderNumber} • Emissão: ${date}
          </p>
        </div>
      </div>

      <!-- Info row -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px;">
        <div>
          <span class="info-label">Referência / Modelo</span>
          <span class="info-val">${product?.name || '—'} <span style="font-weight:normal;color:#4b5563;">(${product?.reference || 'S/Ref'})</span></span>
        </div>
        <div>
          <span class="info-label">Cor / Variação</span>
          <span class="info-val">${colorName}</span>
        </div>
        <div>
          <span class="info-label">Total de Pares</span>
          <span class="info-val">${lot.quantity} Pares</span>
        </div>
        ${sectorName ? `<div><span class="info-label">Setor</span><span class="info-val">${sectorName}</span></div>` : ''}
      </div>

      ${osBlock}

      <!-- Materials -->
      <h3 style="font-size:13px;font-weight:900;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:6px;margin-top:20px;">Requisição Consolidada de Materiais</h3>
      <table style="margin-top:10px;">
        <thead><tr>
          <th>Código / Nome do Material</th>
          <th>Referência</th>
          <th style="text-align:right;width:180px;">Consumo Total Estimado</th>
        </tr></thead>
        <tbody>${materialsRows}</tbody>
      </table>

      <!-- Grade -->
      <h3 style="font-size:13px;font-weight:900;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:6px;margin-top:28px;">Grade Detalhada do Mapa</h3>
      <table style="margin-top:10px;">
        <thead><tr>
          <th style="width:120px;">Tamanho</th>
          ${sizes.map(sz => `<th class="gc">${sz}</th>`).join('')}
          <th class="gc" style="width:80px;">TOTAL</th>
        </tr></thead>
        <tbody><tr>
          <td style="font-weight:bold;">Pares</td>
          ${sizes.map(sz => `<td class="gv">${pairs[sz]}</td>`).join('')}
          <td class="gv" style="background:#f3f4f6 !important;">${lot.quantity}</td>
        </tr></tbody>
      </table>

      <!-- Signature -->
      <div style="margin-top:60px;display:flex;justify-content:space-between;gap:60px;">
        <div style="flex:1;text-align:center;border-top:2px solid #000;padding-top:6px;margin-top:30px;">
          <p style="margin:0;font-size:11px;font-weight:900;">${os?.providerName || 'Responsável'}</p>
          <p style="margin:3px 0 0 0;color:#374151;font-size:9px;text-transform:uppercase;font-weight:bold;">Assinatura do Responsável</p>
        </div>
        <div style="flex:1;text-align:center;border-top:2px solid #000;padding-top:6px;margin-top:30px;">
          <p style="margin:0;font-size:11px;font-weight:900;">Supervisão de Produção</p>
          <p style="margin:3px 0 0 0;color:#374151;font-size:9px;text-transform:uppercase;font-weight:bold;">Assinatura de Controle</p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);
  window.print();
  wrap.remove();
};

// ─── Shared A4 Pedido (Order Item) Sheet Printer ─────────────────────────────

export interface PrintOrderItemSheetOptions {
  lot: ProductionLot;
  product?: Product;
  variationName?: string;
  orderNumber?: string;
  customerName?: string;
  deliveryDate?: number;
  totalQty: number;
  sizeEntries: [string, number][];
  orderNotes?: string;
  sectorNotes?: { sectorName: string; sectorColor?: string; notes: { name?: string; text: string }[] }[];
}

export const printOrderItemSheet = ({
  lot, product, variationName, orderNumber, customerName, deliveryDate, totalQty, sizeEntries, orderNotes, sectorNotes = [],
}: PrintOrderItemSheetOptions) => {
  const container = document.getElementById('_lot_print_container');
  if (container) container.remove();

  const wrap = document.createElement('div');
  wrap.id = '_lot_print_container';

  const style = document.createElement('style');
  style.innerHTML = PRINT_STYLES;
  wrap.appendChild(style);

  const date = new Date().toLocaleDateString('pt-BR');

  const notesBlock = orderNotes
    ? `<div style="margin-bottom:18px;padding:10px 14px;border:1.5px solid #f59e0b;border-radius:6px;background:#fffbeb;">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#b45309;margin-bottom:4px;">Observação do Pedido</div>
        <div style="font-size:12px;font-weight:700;color:#78350f;">${orderNotes}</div>
      </div>`
    : '';

  const sectorNotesBlock = sectorNotes.length > 0
    ? `<div style="margin-bottom:18px;padding:10px 14px;border:1.5px solid #4f46e5;border-radius:6px;background:#eef2ff;">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#4f46e5;margin-bottom:8px;">Instruções por Setor</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${sectorNotes.map(sec => `
            <div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${sec.sectorColor || '#6366f1'};flex-shrink:0;"></span>
                <span style="font-size:9px;font-weight:900;text-transform:uppercase;color:${sec.sectorColor || '#6366f1'};">${sec.sectorName}</span>
              </div>
              <div style="margin-left:16px;border-left:2px solid ${sec.sectorColor || '#6366f1'};padding-left:8px;display:flex;flex-direction:column;gap:3px;">
                ${sec.notes.map(n => `<div>${n.name ? `<div style="font-size:8px;font-weight:900;color:#4f46e5;text-transform:uppercase;">${n.name}</div>` : ''}<div style="font-size:11px;font-weight:700;color:#1e1b4b;">${n.text}</div></div>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>`
    : '';

  wrap.innerHTML += `
    <div class="pp">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #000;padding-bottom:12px;margin-bottom:22px;">
        <div>
          <h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;">GESTÃO PRO</h1>
          <p style="margin:3px 0 0 0;font-size:10px;font-weight:800;color:#4b5563;text-transform:uppercase;letter-spacing:2px;">Sistema de Produção &amp; PCP</p>
        </div>
        <div style="text-align:right;">
          <span class="badge">Ficha de Pedido</span>
          <p style="margin:6px 0 0 0;font-size:12px;font-weight:900;text-transform:uppercase;color:#374151;">
            Mapa: #${lot.orderNumber}${orderNumber ? ` • Pedido: ${orderNumber}` : ''} • Emissão: ${date}
          </p>
        </div>
      </div>

      <!-- Info row -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px;">
        <div>
          <span class="info-label">Referência / Modelo</span>
          <span class="info-val">${product?.name || '—'} <span style="font-weight:normal;color:#4b5563;">(${product?.reference || 'S/Ref'})</span></span>
        </div>
        <div>
          <span class="info-label">Cor / Variação</span>
          <span class="info-val">${variationName || '—'}</span>
        </div>
        <div>
          <span class="info-label">Total de Pares</span>
          <span class="info-val">${totalQty} Pares</span>
        </div>
        ${customerName ? `<div><span class="info-label">Cliente</span><span class="info-val">${customerName}</span></div>` : ''}
        ${deliveryDate ? `<div><span class="info-label">Entrega</span><span class="info-val">${new Date(deliveryDate).toLocaleDateString('pt-BR')}</span></div>` : ''}
      </div>

      ${notesBlock}
      ${sectorNotesBlock}

      <!-- Grade -->
      <h3 style="font-size:13px;font-weight:900;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:6px;margin-top:20px;">Grade de Produção</h3>
      <table style="margin-top:10px;">
        <thead><tr>
          <th style="width:120px;">Tamanho</th>
          ${sizeEntries.map(([sz]) => `<th class="gc">${sz}</th>`).join('')}
          <th class="gc" style="width:80px;">TOTAL</th>
        </tr></thead>
        <tbody><tr>
          <td style="font-weight:bold;">Pares</td>
          ${sizeEntries.map(([, q]) => `<td class="gv">${q}</td>`).join('')}
          <td class="gv" style="background:#f3f4f6 !important;">${totalQty}</td>
        </tr></tbody>
      </table>
    </div>
  `;

  document.body.appendChild(wrap);
  window.print();
  wrap.remove();
};

// ─── Shared A4 Picking List (Lista de Separação) Printer ─────────────────────

export interface PrintPickingListRow {
  reference: string;
  productName: string;
  variationName: string;
  size?: string;
  photoUrl?: string;
  quantidade: number;
  pedidos: string;
}

export interface PrintPickingListOptions {
  rows: PrintPickingListRow[];
  mostrarMiniaturas: boolean;
  incluirCheckbox: boolean;
  pageSize?: 'a4' | '100x150';
  /** Sem cinza/azul-claro em lugar nenhum — só preto sólido e branco, contraste máximo pra
   * impressoras térmicas (que têm dificuldade em reproduzir tons de cinza de forma legível). */
  pretoBranco?: boolean;
  /** Nome do modelo (produto) junto da referência — desliga quando só a referência já basta. */
  mostrarModelo?: boolean;
  /** Coluna de pedidos vinculados — desliga quando a lista é só de conferência de estoque. */
  mostrarPedido?: boolean;
}

export const printPickingList = ({ rows, mostrarMiniaturas, incluirCheckbox, pageSize = 'a4', pretoBranco = false, mostrarModelo = true, mostrarPedido = true }: PrintPickingListOptions) => {
  const container = document.getElementById('_lot_print_container');
  if (container) container.remove();

  const wrap = document.createElement('div');
  wrap.id = '_lot_print_container';

  const style = document.createElement('style');
  style.innerHTML = PRINT_STYLES;
  wrap.appendChild(style);

  // Sobrescreve o @page padrão (A4) da PRINT_STYLES quando o papel é etiqueta 100x150 — mesma
  // cascata CSS (regra depois vence), fonte da tabela também reduzida pro formato estreito.
  if (pageSize === '100x150') {
    const override = document.createElement('style');
    override.innerHTML = `
      @page { size: 100mm 150mm; margin: 3mm; }
      @media print {
        th, td { font-size: 6px !important; padding: 1.5px 2px !important; }
        h1 { font-size: 13px !important; }
        p { font-size: 7px !important; }
        .badge { font-size: 6px !important; padding: 2px 5px !important; }
      }
    `;
    wrap.appendChild(override);
  }

  if (pretoBranco) {
    const bwOverride = document.createElement('style');
    bwOverride.innerHTML = `
      @media print {
        th, .badge, .gc { background: #000 !important; color: #fff !important; }
        p, h1 { color: #000 !important; }
      }
    `;
    wrap.appendChild(bwOverride);
  }

  const date = new Date().toLocaleString('pt-BR');

  const rowsHtml = rows
    .map(
      (r) => `
        <tr>
          ${incluirCheckbox ? '<td style="width:36px;text-align:center;"><span style="display:inline-block;width:16px;height:16px;border:2px solid #000;"></span></td>' : ''}
          ${mostrarMiniaturas ? `<td style="width:52px;">${r.photoUrl ? `<img src="${r.photoUrl}" style="width:40px;height:40px;object-fit:cover;border:1px solid #000;" />` : ''}</td>` : ''}
          <td><strong>${r.reference}</strong>${mostrarModelo ? ` — ${r.productName}` : ''}</td>
          <td>${r.variationName}</td>
          <td class="gc">${r.size || 'Atacado'}</td>
          <td class="gv">${r.quantidade}</td>
          ${mostrarPedido ? `<td>${r.pedidos}</td>` : ''}
        </tr>`
    )
    .join('');

  wrap.innerHTML += `
    <div class="pp">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #000;padding-bottom:12px;margin-bottom:22px;">
        <div>
          <h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;">GESTÃO PRO</h1>
          <p style="margin:3px 0 0 0;font-size:10px;font-weight:800;color:#4b5563;text-transform:uppercase;letter-spacing:2px;">Integração Bling</p>
        </div>
        <div style="text-align:right;">
          <span class="badge">Lista de Separação</span>
          <p style="margin:6px 0 0 0;font-size:12px;font-weight:900;text-transform:uppercase;color:#374151;">Emissão: ${date}</p>
        </div>
      </div>

      <table>
        <thead><tr>
          ${incluirCheckbox ? '<th></th>' : ''}
          ${mostrarMiniaturas ? '<th></th>' : ''}
          <th>${mostrarModelo ? 'Referência / Produto' : 'Referência'}</th>
          <th>Cor</th>
          <th style="width:100px;">Tamanho</th>
          <th style="width:80px;">Qtd</th>
          ${mostrarPedido ? '<th>Pedidos</th>' : ''}
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;

  document.body.appendChild(wrap);
  window.print();
  wrap.remove();
};

// ─── Shared Shipping Label (Etiqueta de Transporte) Printer ─────────────────
// A API v3 do Bling não expõe um endpoint pra gerar o PDF combinado "DANFE Simplificado +
// Etiqueta de Transporte" que aparece no menu de impressão do site deles (recurso só da
// interface web). O que a API realmente devolve, junto da nota fiscal, é o endereço do
// destinatário (`transporte.etiqueta`) — com isso dá pra montar nossa própria etiqueta
// impressa aqui, no mesmo padrão de impressão via window.print() já usado acima.

export interface PrintShippingLabelOptions {
  pedidoNumero: string;
  notaNumero?: string;
  etiqueta: {
    nome?: string;
    endereco?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
  };
}

const shippingLabelHtml = ({ pedidoNumero, notaNumero, etiqueta }: PrintShippingLabelOptions): string => `
  <div class="pp" style="height:100%;">
    <div style="border:3px solid #000;border-radius:14px;padding:16px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;">
      <div style="border-bottom:2px solid #000;padding-bottom:10px;">
        <h1 style="font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;">Etiqueta de Transporte</h1>
        <p style="margin-top:3px;font-size:9px;font-weight:800;color:#4b5563;text-transform:uppercase;">Pedido ${pedidoNumero}${notaNumero ? ` &middot; NF-e ${notaNumero}` : ''}</p>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:6px;">
        <p style="font-size:17px;font-weight:900;text-transform:uppercase;">${etiqueta.nome || '—'}</p>
        <p style="font-size:12px;font-weight:700;">${etiqueta.endereco || ''}${etiqueta.numero ? `, ${etiqueta.numero}` : ''}${etiqueta.complemento ? ` — ${etiqueta.complemento}` : ''}</p>
        <p style="font-size:12px;font-weight:700;">${etiqueta.bairro || ''}</p>
        <p style="font-size:15px;font-weight:900;">${etiqueta.municipio || ''}${etiqueta.uf ? ` / ${etiqueta.uf}` : ''}</p>
        <p style="font-size:15px;font-weight:900;letter-spacing:1px;">CEP ${etiqueta.cep || '—'}</p>
      </div>
    </div>
  </div>
`;

/** Imprime uma ou várias etiquetas de transporte, uma por página (100x150mm cada). */
export const printShippingLabels = (labels: PrintShippingLabelOptions[]) => {
  if (labels.length === 0) return;
  const container = document.getElementById('_lot_print_container');
  if (container) container.remove();

  const wrap = document.createElement('div');
  wrap.id = '_lot_print_container';

  const style = document.createElement('style');
  style.innerHTML = PRINT_STYLES;
  wrap.appendChild(style);

  const override = document.createElement('style');
  override.innerHTML = `
    @page { size: 100mm 150mm; margin: 5mm; }
    @media print { h1, p { margin: 0; } }
  `;
  wrap.appendChild(override);

  wrap.innerHTML += labels.map(shippingLabelHtml).join('');

  document.body.appendChild(wrap);
  window.print();
  wrap.remove();
};

export const printShippingLabel = (options: PrintShippingLabelOptions) => printShippingLabels([options]);

/** Monta um PDF (uma página 100x150mm por etiqueta) pra compartilhar — mesmo conteúdo da
 * impressão acima, desenhado direto no jsPDF (sem canvas intermediário). */
export const buildShippingLabelsPdf = (labels: PrintShippingLabelOptions[]): jsPDF => {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [100, 150] });

  labels.forEach(({ pedidoNumero, notaNumero, etiqueta }, idx) => {
    if (idx > 0) doc.addPage([100, 150], 'p');

    doc.setDrawColor(0);
    doc.setLineWidth(0.8);
    doc.roundedRect(5, 5, 90, 140, 3, 3);

    doc.setLineWidth(0.4);
    doc.line(8, 22, 92, 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('ETIQUETA DE TRANSPORTE', 8, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Pedido ${pedidoNumero}${notaNumero ? ` · NF-e ${notaNumero}` : ''}`, 8, 18);

    let y = 40;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(etiqueta.nome || '—', 8, y, { maxWidth: 84 });

    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const linha1 = `${etiqueta.endereco || ''}${etiqueta.numero ? `, ${etiqueta.numero}` : ''}${etiqueta.complemento ? ` — ${etiqueta.complemento}` : ''}`;
    doc.text(linha1, 8, y, { maxWidth: 84 });

    y += 8;
    doc.text(etiqueta.bairro || '', 8, y, { maxWidth: 84 });

    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`${etiqueta.municipio || ''}${etiqueta.uf ? ` / ${etiqueta.uf}` : ''}`, 8, y, { maxWidth: 84 });

    y += 8;
    doc.text(`CEP ${etiqueta.cep || '—'}`, 8, y);
  });

  return doc;
};

/**
 * Shares a jsPDF document using native share on mobile or downloads it on web.
 */
export const sharePDF = async (doc: jsPDF, filename: string) => {
  // Ensure filename has .pdf extension
  if (!filename.toLowerCase().endsWith('.pdf')) {
    filename += '.pdf';
  }

  if (Capacitor.getPlatform() === 'web') {
    doc.save(filename);
  } else {
    try {
      // Use native datauristring and strip prefix for better compatibility
      const dataUri = doc.output('datauristring');
      const base64 = dataUri.split('base64,')[1];

      // Save to cache directory
      const result = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });

      // Share the file
      await Share.share({
        title: filename,
        url: result.uri,
      });
    } catch (error) {
      console.error('Error sharing PDF:', error);
      // Fallback for some mobile browsers
      try {
        doc.save(filename);
      } catch (e) {
        toast.show('Erro ao compartilhar PDF. Tente novamente.');
      }
    }
  }
};

/**
 * Shares a base64 image using native share on mobile or downloads it on web.
 */
export const shareImage = async (base64: string, filename: string) => {
  if (!filename.toLowerCase().endsWith('.jpg') && !filename.toLowerCase().endsWith('.jpeg')) {
    filename += '.jpg';
  }

  if (Capacitor.getPlatform() === 'web') {
    // Convert data URL to Blob to avoid Chrome's long data-URL download block
    const dataStr = base64.includes('base64,') ? base64 : `data:image/jpeg;base64,${base64}`;
    const arr = dataStr.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    const blob = new Blob([u8arr], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    try {
      // Data is usually "data:image/jpeg;base64,..."
      const base64Data = base64.includes('base64,') ? base64.split('base64,')[1] : base64;

      const result = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: filename,
        url: result.uri,
      });
    } catch (error) {
      console.error('Error sharing image:', error);
      try {
        // Fallback to web download in webview/mobile browser
        const dataStr = base64.includes('base64,') ? base64 : `data:image/jpeg;base64,${base64}`;
        const arr = dataStr.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(arr[1]);
        const u8arr = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
        const blob = new Blob([u8arr], { type: mime });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (fallbackError) {
        toast.show('Erro ao compartilhar imagem. Tente novamente.');
      }
    }
  }
};

/**
 * Compartilha VÁRIAS imagens numa única ação de compartilhamento nativo (um só share
 * sheet, com todas as folhas/etiquetas já anexadas) — em vez de chamar shareImage em loop,
 * que abre o share sheet uma vez por item e obriga o usuário a escolher o app e enviar de
 * novo a cada um. Usa `files` do plugin @capacitor/share (Android: ACTION_SEND_MULTIPLE),
 * suportado desde a v4.1.0 do plugin.
 *
 * `filenames`, se informado, dá o nome de arquivo exato de cada imagem (ex.: um por pedido
 * na exportação de etiquetas em lote) — sem isso, gera `${filenamePrefix}_paginaNdeM.jpg`
 * pra cada uma (caso comum de fichas/rotas paginadas).
 */
export const shareImages = async (bases64: string[], filenamePrefix: string, filenames?: string[]) => {
  if (bases64.length === 0) return;
  if (bases64.length === 1) {
    await shareImage(bases64[0], filenames?.[0] || filenamePrefix);
    return;
  }

  const nameFor = (i: number) => {
    const name = filenames?.[i] || `${filenamePrefix}_pagina${i + 1}de${bases64.length}`;
    return name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg') ? name : `${name}.jpg`;
  };

  if (Capacitor.getPlatform() === 'web') {
    // Sem compartilhamento nativo múltiplo no navegador — o melhor possível é baixar
    // cada arquivo individualmente (o navegador não abre um "share sheet" de qualquer jeito).
    for (let i = 0; i < bases64.length; i++) {
      await shareImage(bases64[i], nameFor(i));
    }
    return;
  }

  try {
    const uris: string[] = [];
    for (let i = 0; i < bases64.length; i++) {
      const base64Data = bases64[i].includes('base64,') ? bases64[i].split('base64,')[1] : bases64[i];
      const result = await Filesystem.writeFile({ path: nameFor(i), data: base64Data, directory: Directory.Cache });
      uris.push(result.uri);
    }
    await Share.share({ title: filenamePrefix, files: uris });
  } catch (error) {
    console.error('Error sharing images:', error);
    toast.show('Erro ao compartilhar imagens. Tente novamente.');
  }
};


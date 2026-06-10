import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { jsPDF } from 'jspdf';
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


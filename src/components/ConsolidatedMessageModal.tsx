import React, { useState, useMemo } from 'react';
import { X, Copy, MessageCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { Person, Product } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sharePDF, shareImage } from '../utils/pdfExport';
import { toJpeg } from 'html-to-image';
import ExportNoteModal from './ExportNoteModal';
import { toast } from '../utils/toast';

interface ConsolidatedMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Person | undefined;
  sales: any[];
  isDarkMode: boolean;
  formatType: 'SUMMARY' | 'COMPLETE';
  products?: Product[];
}

export default function ConsolidatedMessageModal({
  isOpen,
  onClose,
  customer,
  sales,
  isDarkMode,
  formatType,
  products = [],
}: ConsolidatedMessageModalProps) {
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>(sales.map(s => s.id));
  const [exportModal, setExportModal] = useState<{ isOpen: boolean; format: 'pdf' | 'jpg' }>({ isOpen: false, format: 'pdf' });

  const toggleSaleSelection = (id: string) => {
    setSelectedSaleIds(prev =>
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  const selectedSales = useMemo(() =>
    sales.filter(s => selectedSaleIds.includes(s.id)),
  [sales, selectedSaleIds]);

  const messagePreview = useMemo(() => {
    if (!customer) return '';
    let msg = `Olá ${customer.name}, segue o extrato consolidado:\n\n`;

    selectedSales.forEach(s => {
      const typeLabel = s.orderNumber ? `Pedido #(${s.orderNumber})` : `Lançamento: ${customer.name} (${s.id.substring(0, 4)})`;
      msg += `- ${typeLabel} (${format(s.date, 'dd/MM/yyyy')})\n`;
      msg += `  Total: R$ ${s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Pendente: R$ ${s.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;

      if (formatType === 'COMPLETE' && s.items && s.items.length > 0) {
        s.items.forEach((item: any) => {
          const prod = products.find((p: Product) => p.id === item.productId);
          const variation = prod?.variations?.find((v: any) => v.id === item.variationId);
          const label = prod ? `${prod.name}${variation ? ` - ${variation.colorName}` : ''}` : (item.description || 'Produto');
          msg += `    * ${item.quantity}x ${label} (R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n`;
        });
      }
      msg += `\n`;
    });

    const totalGeneral = selectedSales.reduce((acc, s) => acc + s.total, 0);
    const totalBalance = selectedSales.reduce((acc, s) => acc + s.balance, 0);

    msg += `Total Geral: R$ ${totalGeneral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    msg += `Saldo Total em Aberto: R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;
    msg += `Qualquer dúvida, estamos à disposição!`;

    return msg;
  }, [customer, selectedSales, formatType, products]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(messagePreview);
    toast.show('Texto copiado!');
  };

  const handleWhatsApp = () => {
    const cleanPhone = (customer?.phone || '').replace(/\D/g, '');
    if (!cleanPhone) {
      toast.show('Não é possível abrir o WhatsApp: Cliente não possui telefone cadastrado.');
      return;
    }
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messagePreview)}`;
    window.open(url, '_blank');
  };

  const buildSaleBlocksHtml = () =>
    selectedSales.map(s => {
      const saleLabel = s.orderNumber ? `Pedido #(${s.orderNumber})` : `Lançamento (${s.id.substring(0, 4)})`;
      if (formatType === 'COMPLETE') {
        const itemsHtml = (s.items || []).map((item: any) => {
          const prod = products.find((p: Product) => p.id === item.productId);
          const variation = prod?.variations?.find((v: any) => v.id === item.variationId);
          const label = prod ? `${prod.name}${variation ? ` - ${variation.colorName}` : ''}` : 'Produto';
          return `<tr style="border-bottom:1px solid #f8fafc;">
            <td style="padding:6px 10px;color:#475569;">${item.quantity}x ${label}</td>
            <td style="padding:6px 10px;text-align:right;color:#64748b;">R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td style="padding:6px 10px;text-align:right;font-weight:600;">R$ ${(item.quantity * item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          </tr>`;
        }).join('');
        return `
          <div style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <div style="background:#f8fafc;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:700;font-size:13px;">${saleLabel}</span>
              <span style="color:#64748b;font-size:12px;">${format(s.date, 'dd/MM/yyyy')}</span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead><tr style="background:#f1f5f9;">
                <th style="padding:6px 10px;text-align:left;color:#64748b;font-size:10px;">Produto</th>
                <th style="padding:6px 10px;text-align:right;color:#64748b;font-size:10px;">Unit.</th>
                <th style="padding:6px 10px;text-align:right;color:#64748b;font-size:10px;">Subtotal</th>
              </tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            <div style="padding:8px 14px;display:flex;justify-content:space-between;font-size:12px;border-top:1px solid #e2e8f0;">
              <span>Total: <strong>R$ ${s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
              <span style="color:#10b981;">Pago: R$ ${s.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              <span style="color:${s.balance > 0 ? '#ef4444' : '#10b981'};font-weight:700;">Pendente: R$ ${s.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>`;
      }
      return `<tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px;font-weight:600;">${saleLabel}</td>
        <td style="padding:10px;color:#64748b;">${format(s.date, 'dd/MM/yyyy')}</td>
        <td style="padding:10px;text-align:right;font-weight:600;">R$ ${s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td style="padding:10px;text-align:right;color:#10b981;font-weight:600;">R$ ${s.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td style="padding:10px;text-align:right;font-weight:700;color:${s.balance > 0 ? '#ef4444' : '#10b981'};">R$ ${s.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      </tr>`;
    }).join('');

  const handleConfirmExport = async (note: string, fmt: 'pdf' | 'jpg') => {
    setExportModal({ isOpen: false, format: 'pdf' });
    const customerName = customer?.name || 'Cliente';
    const totalBalance = selectedSales.reduce((acc, s) => acc + s.balance, 0);
    const filename = `extrato_${customerName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}`;

    try {
      if (fmt === 'pdf') {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 35, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('Extrato Consolidado', 105, 14, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Cliente: ${customerName}`, 105, 22, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, 29, { align: 'center' });

        let currentY = 42;

        if (formatType === 'COMPLETE') {
          for (const s of selectedSales) {
            const saleLabel = s.orderNumber ? `Pedido #(${s.orderNumber})` : `Lançamento (${s.id.substring(0, 4)})`;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59);
            doc.text(`${saleLabel}  —  ${format(s.date, 'dd/MM/yyyy')}`, 14, currentY);
            currentY += 4;

            const itemRows = (s.items || []).map((item: any) => {
              const prod = products.find((p: Product) => p.id === item.productId);
              const variation = prod?.variations?.find((v: any) => v.id === item.variationId);
              const label = prod ? `${prod.name}${variation ? ` - ${variation.colorName}` : ''}` : 'Produto';
              return [
                `${item.quantity}x ${label}`,
                `R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                `R$ ${(item.quantity * item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              ];
            });
            itemRows.push([
              `Total: R$ ${s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}  |  Pago: R$ ${s.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              '',
              `Pendente: R$ ${s.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            ]);
            autoTable(doc, {
              startY: currentY,
              head: [['Produto', 'Preço Unit.', 'Subtotal']],
              body: itemRows,
              theme: 'plain',
              headStyles: { fillColor: [248, 250, 252], textColor: [100, 116, 139], fontSize: 7, fontStyle: 'bold' },
              bodyStyles: { fontSize: 7, cellPadding: 2 },
              columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold' } },
              margin: { left: 14, right: 14 },
            });
            currentY = (doc as any).lastAutoTable.finalY + 5;
            if (currentY > 260) {
              doc.addPage();
              currentY = 14;
            }
          }
        } else {
          const body = selectedSales.map(s => [
            s.orderNumber ? `#(${s.orderNumber})` : s.id.substring(0, 4),
            format(s.date, 'dd/MM/yyyy'),
            `R$ ${s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `R$ ${s.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `R$ ${s.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          ]);
          autoTable(doc, {
            startY: currentY,
            head: [['Pedido', 'Data', 'Total', 'Pago', 'Pendente']],
            body,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] },
            columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
          });
          currentY = (doc as any).lastAutoTable.finalY + 6;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.text(`Saldo Total Pendente: R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, currentY + 4);

        if (note) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Observações:', 14, currentY + 16);
          doc.setFont('helvetica', 'normal');
          const splitNote = doc.splitTextToSize(note, 180);
          doc.text(splitNote, 14, currentY + 22);
        }

        doc.setFontSize(8);
        doc.setTextColor(180);
        doc.text('App Vendas e Produção', 105, 285, { align: 'center' });
        await sharePDF(doc, filename);
      } else {
        const salesBodyHtml = formatType === 'COMPLETE'
          ? buildSaleBlocksHtml()
          : `<table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead><tr style="background:#f8fafc;">
                <th style="padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;color:#64748b;">Pedido</th>
                <th style="padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;color:#64748b;">Data</th>
                <th style="padding:10px;text-align:right;border-bottom:2px solid #e2e8f0;color:#64748b;">Total</th>
                <th style="padding:10px;text-align:right;border-bottom:2px solid #e2e8f0;color:#64748b;">Pago</th>
                <th style="padding:10px;text-align:right;border-bottom:2px solid #e2e8f0;color:#64748b;">Pendente</th>
              </tr></thead>
              <tbody>${buildSaleBlocksHtml()}</tbody>
            </table>`;

        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '600px';
        container.style.zIndex = '999999';
        container.style.backgroundColor = '#ffffff';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.pointerEvents = 'none';
        container.innerHTML = `
          <div style="font-family:Arial,sans-serif;color:#1e293b;background:#ffffff;">
            <div style="background-color:#0f172a;padding:28px 30px;color:white;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:800;">Extrato Consolidado</h1>
              <p style="margin:6px 0 0;font-size:15px;color:#94a3b8;font-weight:600;">${customerName}</p>
              <p style="margin:4px 0 0;font-size:11px;color:#64748b;">${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
            </div>
            <div style="padding:24px 28px 0;background-color:#ffffff;">
              ${salesBodyHtml}
              <div style="text-align:right;padding:14px 10px;font-size:18px;font-weight:800;color:${totalBalance > 0 ? '#ef4444' : '#10b981'};border-top:2px solid #e2e8f0;margin-top:4px;">
                Saldo Total: R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              ${note ? `<div style="margin:0 0 20px;padding:15px;background-color:#f8fafc;border-left:4px solid #0f172a;">
                <strong style="font-size:10px;color:#64748b;text-transform:uppercase;">Observações</strong>
                <p style="margin:6px 0 0;font-size:13px;color:#334155;white-space:pre-wrap;">${note}</p>
              </div>` : ''}
            </div>
            <div style="text-align:center;padding:16px;color:#94a3b8;font-size:10px;background-color:#ffffff;">App Vendas e Produção</div>
          </div>
        `;
        document.body.appendChild(container);
        try {
          await new Promise(resolve => setTimeout(resolve, 600));
          const dataUrl = await toJpeg(container, {
            quality: 0.95,
            backgroundColor: '#ffffff',
          });
          await shareImage(dataUrl, filename);
        } finally {
          document.body.removeChild(container);
        }
      }
    } catch (e) {
      console.error('Export error:', e);
      toast.show(`Erro ao gerar arquivo: ${(e as Error).message || e}`);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[70000] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <div className={`relative w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
          {/* Header */}
          <div className="p-8 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white">Mensagem Consolidada</h2>
                <p className="text-sm font-medium text-slate-400 mt-1">Selecione os itens para enviar ao cliente</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                title="Fechar"
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
            {/* Items List */}
            <div className="mt-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Itens do Cliente</h3>
              <div className="flex flex-col gap-3">
                {sales.map(s => (
                  <div
                    key={s.id}
                    onClick={() => toggleSaleSelection(s.id)}
                    className={`p-4 rounded-3xl border-2 transition-all cursor-pointer flex items-center gap-4 ${
                      selectedSaleIds.includes(s.id)
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10'
                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-200'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                      selectedSaleIds.includes(s.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-transparent'
                    }`}>
                      <CheckCircle2 size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                        {s.orderNumber ? `Pedido #(${s.orderNumber})` : `Lançamento Manual - ${customer?.name} (${s.id.substring(0, 4)})`}
                      </p>
                      <p className="text-[10px] font-medium text-slate-400">{format(s.date, 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-700 dark:text-slate-200">R$ {s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      <p className="text-[10px] font-black text-rose-500">Pendente: R$ {s.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="mt-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Prévia da Mensagem</h3>
              <div className={`p-6 rounded-[2rem] border whitespace-pre-wrap text-sm font-medium leading-relaxed ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'
              }`}>
                {messagePreview}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-8 pt-4 flex flex-col gap-3">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setExportModal({ isOpen: true, format: 'pdf' })}
                disabled={selectedSales.length === 0}
                className="flex-1 py-4 px-4 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-100 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => setExportModal({ isOpen: true, format: 'jpg' })}
                disabled={selectedSales.length === 0}
                className="flex-1 py-4 px-4 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-100 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                JPG
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className={`flex-1 py-4 px-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  isDarkMode ? 'border-slate-800 text-white hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Copy size={14} />
                Copiar
              </button>
            </div>

            <button
              type="button"
              onClick={handleWhatsApp}
              disabled={!customer?.phone}
              className={`w-full py-5 rounded-[1.5rem] bg-emerald-500 text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-all active:scale-[0.98] ${
                !customer?.phone ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <MessageCircle size={20} />
              Enviar WhatsApp
            </button>
          </div>
        </div>
      </div>

      <ExportNoteModal
        isOpen={exportModal.isOpen}
        onClose={() => setExportModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmExport}
        isDarkMode={isDarkMode}
        initialFormat={exportModal.format}
        title="Exportar Extrato Consolidado"
      />
    </>
  );
}

import React, { useState, useMemo } from 'react';
import { X, Copy, MessageCircle, Share2, FileText, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { Person, Sale } from '../types';
import { jsPDF } from 'jspdf';
import { sharePDF } from '../utils/pdfExport';

interface ConsolidatedMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Person | undefined;
  sales: any[]; // Sales with totalPaid and balance
  isDarkMode: boolean;
  formatType: 'SUMMARY' | 'COMPLETE';
}

export default function ConsolidatedMessageModal({
  isOpen,
  onClose,
  customer,
  sales,
  isDarkMode,
  formatType
}: ConsolidatedMessageModalProps) {
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>(sales.map(s => s.id));

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
          msg += `    * ${item.quantity}x ${item.description} (R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n`;
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
  }, [customer, selectedSales]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(messagePreview);
    alert("Texto copiado!");
  };

  const handleWhatsApp = () => {
    const cleanPhone = (customer?.phone || '').replace(/\D/g, '');
    if (!cleanPhone) {
      alert('Não é possível abrir o WhatsApp: Cliente não possui telefone cadastrado.');
      return;
    }
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messagePreview)}`;
    window.open(url, '_blank');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Extrato Consolidado", 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Cliente: ${customer?.name || 'N/A'}`, 14, 32);
    doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy')}`, 14, 38);

    const body = selectedSales.map(s => [
        s.orderNumber || s.id.substring(0, 4),
        format(s.date, 'dd/MM/yyyy'),
        `R$ ${s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${s.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);

    (doc as any).autoTable({
        startY: 45,
        head: [['Pedido', 'Data', 'Total', 'Pendente']],
        body: body,
        theme: 'grid',
        headStyles: { fillStyle: [79, 70, 229] }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 60;
    const totalBalance = selectedSales.reduce((acc, s) => acc + s.balance, 0);
    doc.setFontSize(14);
    doc.text(`Saldo Total Pendente: R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, finalY + 15);

    sharePDF(doc, `extrato_${customer?.name || 'cliente'}.pdf`);
  };

  return (
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
        <div className="p-8 pt-4 flex flex-col gap-4">
          <div className="flex gap-3">
             <button
              onClick={handleExportPDF}
              className="flex-1 py-4 px-6 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-100 transition-all active:scale-95"
            >
              <Share2 size={16} />
              Compartilhar PDF
            </button>
            <button
              onClick={handleCopy}
              className={`flex-1 py-4 px-6 rounded-2xl border-2 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${
                isDarkMode ? 'border-slate-800 text-white hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Copy size={16} />
              Copiar Texto
            </button>
          </div>
          
          <button
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
  );
}

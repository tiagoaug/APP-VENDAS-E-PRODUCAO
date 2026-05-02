import React from 'react';
import { Purchase, Person, CompanyCheck } from '../types';
import { X, Clipboard, Copy, Landmark, Calendar, DollarSign, Hash, User, AlertCircle, FileDown, CheckCircle2, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ChecksModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: Purchase;
  supplier?: Person;
  isDarkMode: boolean;
  onUpdateCheque?: (chequeId: string, status: 'PENDING' | 'CLEARED' | 'OVERDUE') => void;
}

export default function ChecksModal({
  isOpen,
  onClose,
  purchase,
  supplier,
  isDarkMode,
  onUpdateCheque
}: ChecksModalProps) {
  if (!isOpen) return null;

  const checks = purchase.checks || [];

  const statusMap: Record<string, { label: string, color: string }> = {
    'PENDING': { label: 'PENDENTE', color: 'text-amber-500' },
    'CLEARED': { label: 'LIQUIDADO', color: 'text-emerald-500' },
    'OVERDUE': { label: 'VENCIDO', color: 'text-rose-500' }
  };

  const handleCopy = () => {
    if (checks.length === 0) return;

    const checkList = checks.map((c, idx) => 
      `Cheque ${idx + 1}:\n` +
      `- Número: ${c.number}\n` +
      `- Vencimento: ${format(c.dueDate, 'dd/MM/yyyy')}\n` +
      `- Valor: R$ ${c.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      `- Status: ${statusMap[c.status]?.label || c.status}`
    ).join('\n\n');

    const summary = `HISTÓRICO DE CHEQUES - Compra #${purchase.id.slice(-6).toUpperCase()}\nFornecedor: ${supplier?.name || '---'}\nTotal em Cheques: R$ ${checks.reduce((acc, c) => acc + c.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n${checkList}`;

    navigator.clipboard.writeText(summary);
    alert('Registros de cheques copiados!');
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(63, 81, 181); // indigo-600
    doc.text('Relatório de Cheques', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Compra #${purchase.id.slice(-6).toUpperCase()} - ${format(purchase.date, 'dd/MM/yyyy')}`, 14, 30);
    doc.text(`Fornecedor: ${supplier?.name || '---'}`, 14, 35);
    
    // Summary
    const totalValue = checks.reduce((acc, c) => acc + c.value, 0);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Total em Cheques: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, 45);
    
    // Table
    const tableData = checks.map(c => [
      c.number,
      format(c.dueDate, 'dd/MM/yyyy'),
      statusMap[c.status]?.label || c.status,
      `R$ ${c.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Nº Cheque', 'Bom Para', 'Situação', 'Valor']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }, // indigo-600
      styles: { fontSize: 10, cellPadding: 5 }
    });

    doc.save(`cheques_compra_${purchase.id.slice(-6)}.pdf`);
  };

  const handleClearCheque = (chequeId: string) => {
    if (onUpdateCheque) {
      onUpdateCheque(chequeId, 'CLEARED');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={`w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
        
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
          <div>
            <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Relatório de Cheques</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Compra de {supplier?.name || "---"}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400"
            title="Fechar"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {/* Action Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clipboard size={16} className="text-indigo-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total: {checks.length} cheques</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[8px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all border border-slate-100 dark:border-slate-700"
                title="Copiar Texto"
              >
                <Copy size={12} />
                Copiar
              </button>
              <button 
                onClick={downloadPDF}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 text-[8px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100 dark:border-indigo-900/50"
              >
                <FileDown size={14} />
                PDF
              </button>
            </div>
          </div>

          {/* List */}
          <div className="space-y-4">
            {checks.map((check, index) => (
              <div key={index} className={`p-5 rounded-3xl border-2 border-dashed ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-white dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shadow-sm">
                      <Hash size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Nº do Cheque</p>
                      <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{check.number}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-1">Valor</p>
                    <p className="text-sm font-black tracking-tight text-indigo-600 dark:text-indigo-400">R$ {check.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar size={14} className="text-slate-300" />
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Bom Para</p>
                      <p className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{format(check.dueDate, 'dd/MM/yyyy')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <AlertCircle size={14} className="text-slate-300" />
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</p>
                      <p className={`text-[10px] font-bold uppercase ${statusMap[check.status]?.color || 'text-slate-600'}`}>
                        {statusMap[check.status]?.label || check.status}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  {check.status !== 'CLEARED' ? (
                    <>
                      <button 
                        onClick={() => handleClearCheque(check.id)}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={14} strokeWidth={3} />
                        Liquidar
                      </button>
                      <button 
                        onClick={() => onUpdateCheque?.(check.id, 'OVERDUE')}
                        className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${check.status === 'OVERDUE' ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-500/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400'}`}
                      >
                        <AlertCircle size={14} />
                        Vencido
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => onUpdateCheque?.(check.id, 'PENDING')}
                      className="w-full py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-900/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCcw size={14} strokeWidth={3} />
                      Estornar (Pendência)
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

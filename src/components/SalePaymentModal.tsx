import React, { useState, useMemo } from 'react';
import { Sale, Account, PaymentMethod, SalePayment, TransactionType, PaymentStatus, Person } from '../types';
import { X, DollarSign, Calendar, Wallet, History, Clipboard, CheckCircle2, ChevronRight, AlertCircle, Copy, CreditCard, Trash2, RotateCcw, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SalePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  accounts: Account[];
  paymentMethods: PaymentMethod[];
  customer?: Person;
  onPay: (amount: number, accountId: string, paymentMethodId: string, note: string) => Promise<void>;
  onUpdatePayment?: (paymentId: string, amount: number, accountId: string, paymentMethodId: string, note: string) => Promise<void>;
  onDeletePayment?: (paymentId: string) => Promise<void>;
  isDarkMode: boolean;
  initialMode?: 'PAYMENT' | 'HISTORY';
}

export default function SalePaymentModal({
  isOpen,
  onClose,
  sale,
  accounts,
  paymentMethods,
  customer,
  onPay,
  onUpdatePayment,
  onDeletePayment,
  isDarkMode,
  initialMode = 'PAYMENT'
}: SalePaymentModalProps) {
  const [viewMode, setViewMode] = useState<'PAYMENT' | 'HISTORY'>(initialMode);
  const [amount, setAmount] = useState<string>('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id || '');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  const totalPaid = useMemo(() => {
    return (sale.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
  }, [sale.paymentHistory]);

  const remaining = Math.max(0, sale.total - totalPaid);

  if (!isOpen) return null;

  const handleDelete = async (paymentId: string) => {
    if (confirmDeleteId !== paymentId) {
      setConfirmDeleteId(paymentId);
      return;
    }

    console.log("Modal: handleDelete executing for paymentId:", paymentId);
    if (!onDeletePayment) {
      console.error("Modal: onDeletePayment prop is missing!");
      return;
    }
    
    setDeletingId(paymentId);
    try {
      await onDeletePayment(paymentId);
      setConfirmDeleteId(null);
    } catch (error: any) {
      console.error("Modal: Error during deletion call:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyHistory = () => {
    if (!sale.paymentHistory || sale.paymentHistory.length === 0) return;

    const text = sale.paymentHistory
      .map(p => `${format(p.date, 'dd/MM/yyyy')} - R$ ${p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
      .join('\n');
    
    const summary = `Histórico de Recebimentos - Venda #${sale.orderNumber}\nCliente: ${customer?.name || sale.customerName || '---'}\nTotal: R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n${text}\n\nTotal Recebido: R$ ${totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\nRestante: R$ ${remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    navigator.clipboard.writeText(summary);
    console.log('Histórico copiado para o clipboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      alert('Informe um valor válido');
      return;
    }

    if (!accountId) {
      alert('Selecione uma conta');
      return;
    }

    if (!paymentMethodId) {
      alert('Selecione um método de pagamento');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingPaymentId && onUpdatePayment) {
        await onUpdatePayment(editingPaymentId, val, accountId, paymentMethodId, note);
      } else {
        await onPay(val, accountId, paymentMethodId, note);
      }
      setAmount('');
      setNote('');
      setEditingPaymentId(null);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (payment: SalePayment) => {
    setEditingPaymentId(payment.id);
    setAmount(payment.amount.toString());
    setAccountId(payment.accountId);
    setPaymentMethodId(payment.paymentMethodId);
    setNote(payment.note || '');
    setViewMode('PAYMENT');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={`w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
        
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
          <div>
            <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              {viewMode === 'PAYMENT' ? 'Registrar Recebimento' : 'Histórico de Recebimentos'}
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Cliente: {customer?.name || sale.customerName || "---"}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {/* View Toggle */}
          <div className="flex p-1 bg-slate-50 dark:bg-slate-950 rounded-2xl">
            <button 
              onClick={() => setViewMode('HISTORY')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${viewMode === 'HISTORY' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-400'}`}
            >
              <History size={14} /> Histórico
            </button>
            <button 
              onClick={() => setViewMode('PAYMENT')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${viewMode === 'PAYMENT' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-400'}`}
            >
              <DollarSign size={14} /> Receber Agora
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-3xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dívida Total</p>
              <p className={`text-lg font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`p-4 rounded-3xl ${isDarkMode ? 'bg-indigo-900/20' : 'bg-indigo-50'}`}>
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Total Recebido</p>
              <p className={`text-lg font-black tracking-tighter ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {viewMode === 'PAYMENT' ? (
            /* Form Mode */
            <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
              <div className={`p-5 rounded-3xl flex items-center justify-between ${isDarkMode ? 'bg-rose-900/20' : 'bg-rose-50'}`}>
                <div>
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Restante a Receber</p>
                  <p className={`text-2xl font-black tracking-tighter ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <AlertCircle size={32} className="text-rose-500/30" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between ml-1 mb-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Valor do Recebimento</label>
                    <button 
                      type="button"
                      onClick={() => setAmount(remaining.toFixed(2))}
                      className="text-[9px] font-black uppercase text-indigo-500 tracking-widest hover:text-indigo-600 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 size={10} />
                      Quitar Total
                    </button>
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="number"
                      step="0.01"
                      required
                      autoFocus
                      placeholder="0,00"
                      className={`w-full border-none rounded-2xl py-4 pl-12 pr-4 text-xl font-black font-mono tracking-tight focus:ring-4 focus:ring-indigo-500/10 ${isDarkMode ? 'bg-slate-800 text-white placeholder:text-slate-700' : 'bg-slate-50 text-slate-900 placeholder:text-slate-200'}`}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-2 block">Conta de Destino</label>
                    <div className="relative">
                      <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <select
                        className={`w-full border-none rounded-2xl py-3.5 pl-12 pr-4 text-xs font-black uppercase tracking-widest focus:ring-4 focus:ring-indigo-500/10 appearance-none ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`}
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                      >
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name} - R$ {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-2 block">Método</label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <select
                        className={`w-full border-none rounded-2xl py-3.5 pl-12 pr-4 text-xs font-black uppercase tracking-widest focus:ring-4 focus:ring-indigo-500/10 appearance-none ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`}
                        value={paymentMethodId}
                        onChange={(e) => setPaymentMethodId(e.target.value)}
                      >
                        {paymentMethods.map(pm => (
                          <option key={pm.id} value={pm.id}>{pm.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-2 block">Observação (Opcional)</label>
                    <input 
                      type="text"
                      placeholder="EX: RECEBIMENTO PARCIAL EM DINHEIRO"
                      className={`w-full border-none rounded-2xl py-3.5 px-4 text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-indigo-500/10 ${isDarkMode ? 'bg-slate-800 text-white placeholder:text-slate-700' : 'bg-slate-50 text-slate-900 placeholder:text-slate-200'}`}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-4 rounded-2xl text-[12px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] mt-2 shadow-xl flex items-center justify-center gap-2 ${isSubmitting ? 'bg-slate-200 text-slate-500' : 'bg-indigo-600 text-white shadow-indigo-200'}`}
                >
                  {isSubmitting ? 'Processando...' : <><CheckCircle2 size={18} strokeWidth={3} /> {editingPaymentId ? 'Atualizar Recebimento' : 'Registrar Recebimento'}</>}
                </button>
              </form>
            </div>
          ) : (
            /* History Mode */
            <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
              <div className={`p-5 rounded-3xl flex items-center justify-between ${isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50'}`}>
                <div>
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Status da Venda</p>
                  <p className={`text-2xl font-black tracking-tighter ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {remaining <= 0 ? 'QUITADO' : `FALTAM R$ ${remaining.toLocaleString('pt-BR')}`}
                  </p>
                </div>
                <History size={32} className="text-emerald-500/30" />
              </div>

              <div className={`rounded-3xl p-5 border ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-slate-400" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Extrato de Recebimentos</h3>
                  </div>
                  {sale.paymentHistory && sale.paymentHistory.length > 0 && (
                    <button 
                      onClick={handleCopyHistory}
                      className="p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-all border border-slate-100 dark:border-slate-700 flex items-center gap-1.5"
                    >
                      <Copy size={12} />
                      <span className="text-[8px] font-black uppercase tracking-widest">Copiar Tudo</span>
                    </button>
                  )}
                </div>

                {sale.paymentHistory && sale.paymentHistory.length > 0 ? (
                  <div className="space-y-4">
                    {sale.paymentHistory.slice().reverse().map((p) => {
                      const acc = accounts.find(a => a.id === p.accountId);
                      const pm = paymentMethods.find(m => m.id === p.paymentMethodId);
                      return (
                        <div key={p.id} className="flex items-center justify-between border-b last:border-0 border-slate-50 dark:border-slate-900 pb-3 last:pb-0 group">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 flex items-center justify-center">
                              <CheckCircle2 size={18} strokeWidth={3} />
                            </div>
                            <div>
                              <p className={`text-[13px] font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>R$ {p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{format(p.date, "dd 'de' MMMM, HH:mm", { locale: ptBR })}</p>
                            </div>
                          </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{acc?.name} - {pm?.name}</p>
                     {p.note && <p className="text-[8px] font-bold text-slate-300 italic mt-0.5">{p.note}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {onUpdatePayment && (
                      <button 
                        onClick={() => startEdit(p)}
                        className="p-2 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                        title="Editar Recebimento"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {onDeletePayment && (
                      <button 
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                          confirmDeleteId === p.id 
                            ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-200' 
                            : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                        } ${deletingId === p.id ? 'opacity-50' : ''}`}
                        title={confirmDeleteId === p.id ? "Clique novamente para confirmar" : "Remover Recebimento"}
                      >
                        {confirmDeleteId === p.id ? (
                          <>Confirmar?</>
                        ) : (
                          <Trash2 size={14} />
                        )}
                        {deletingId === p.id && <RotateCcw size={12} className="animate-spin" />}
                      </button>
                    )}
                    {confirmDeleteId === p.id && (
                       <button 
                         onClick={() => setConfirmDeleteId(null)}
                         className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-black text-[9px] uppercase tracking-widest"
                       >
                         Cancelar
                       </button>
                    )}
                  </div>
                </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-700 tracking-widest italic">Nenhum recebimento realizado</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { Sale, Account, PaymentMethod, SalePayment, TransactionType, PaymentStatus, Person } from '../types';
import { X, DollarSign, Calendar, Wallet, History, Clipboard, CheckCircle2, ChevronRight, AlertCircle, Copy, CreditCard, Trash2, RotateCcw, Pencil, Calculator } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '../utils/toast';
import CalculatorPopover from './CalculatorPopover';

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
  const [showCalc, setShowCalc] = useState(false);
  const setQuitarTudo = () => setAmount(remaining.toFixed(2));
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
      toast.show('Informe um valor válido');
      return;
    }

    if (!accountId) {
      toast.show('Selecione uma conta');
      return;
    }

    if (!paymentMethodId) {
      toast.show('Selecione um método de pagamento');
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
    setAmount(payment.amount.toFixed(2));
    setAccountId(payment.accountId);
    setPaymentMethodId(payment.paymentMethodId);
    setNote(payment.note || '');
    setViewMode('PAYMENT');
  };

  return (
    <>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className={`w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
        
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
          <div>
            <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              {viewMode === 'PAYMENT' ? 'Registrar Recebimento' : 'Histórico de Recebimentos'}
            </h2>
            <span className="inline-flex items-center mt-1 px-3 py-1 rounded-full bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
              {customer?.name || sale.customerName || "---"}
            </span>
          </div>
          <button type="button" onClick={onClose} title="Fechar" aria-label="Fechar" className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {/* View Toggle */}
          <div className="flex p-1 bg-slate-50 dark:bg-slate-950 rounded-2xl">
            <button
              onClick={() => setViewMode('HISTORY')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${viewMode === 'HISTORY' ? 'bg-gradient-to-br from-white to-slate-100 dark:from-slate-800 dark:to-slate-900 shadow-sm text-indigo-600' : 'text-slate-400'}`}
            >
              <History size={14} /> Histórico
            </button>
            <button
              onClick={() => setViewMode('PAYMENT')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${viewMode === 'PAYMENT' ? 'bg-gradient-to-br from-white to-slate-100 dark:from-slate-800 dark:to-slate-900 shadow-sm text-indigo-600' : 'text-slate-400'}`}
            >
              <DollarSign size={14} /> Receber Agora
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3.5 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700/60' : 'bg-gradient-to-br from-white to-slate-50 border-slate-100'}`}>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dívida Total</p>
              <p className={`text-base font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`p-3.5 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-gradient-to-br from-indigo-900/40 to-indigo-950/30 border-indigo-800/40' : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-100'}`}>
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Total Recebido</p>
              <p className={`text-base font-black tracking-tighter ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {viewMode === 'PAYMENT' ? (
            /* Form Mode */
            <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
              <div className={`rounded-3xl border shadow-md overflow-hidden ${isDarkMode ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700/60 shadow-black/20' : 'bg-gradient-to-br from-white to-slate-50 border-slate-200/60 shadow-slate-200/50'}`}>
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Restante a Receber</p>
                    <p className={`text-xl font-black tracking-tighter ${isDarkMode ? 'text-rose-300' : 'text-rose-500'}`}>R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-rose-500/15' : 'bg-rose-50'}`}>
                    <AlertCircle size={20} className="text-rose-400" strokeWidth={2.5} />
                  </div>
                </div>

                {remaining > 0 && (
                  <button
                    type="button"
                    onClick={setQuitarTudo}
                    className={`relative overflow-hidden w-full p-4 flex items-center justify-between transition-all active:scale-[0.98] border-t ${isDarkMode ? 'border-slate-700/60' : 'border-slate-100'}`}
                  >
                    {/* Só a metade direita do card fica verde — destaca o lado do ícone sem pintar a linha inteira */}
                    <div className={`absolute inset-y-0 right-0 w-1/2 ${isDarkMode ? 'bg-emerald-900/25' : 'bg-emerald-50'}`} />
                    <p className="relative z-10 text-[10px] font-black text-emerald-500 uppercase tracking-widest">Clique aqui para quitar tudo</p>
                    <div className="relative z-10 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500 shadow-lg shadow-emerald-500/40 animate-pulse">
                      <DollarSign size={18} className="text-white" strokeWidth={3} />
                    </div>
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-2 block">
                    Valor do Recebimento
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="number"
                      step="0.01"
                      required
                      autoFocus
                      placeholder="0,00"
                      className={`w-full border rounded-2xl py-4 pl-12 pr-14 text-xl font-black font-mono tracking-tight focus:ring-4 focus:ring-indigo-500/10 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-moz-appearance]:textfield ${isDarkMode ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700/60 text-white placeholder:text-slate-700' : 'bg-gradient-to-br from-white to-slate-100 border-slate-100 text-slate-900 placeholder:text-slate-300'}`}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <button
                      type="button"
                      title="Abrir calculadora"
                      aria-label="Abrir calculadora"
                      onClick={() => setShowCalc(true)}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${isDarkMode ? 'bg-slate-700 text-indigo-400 hover:bg-slate-600' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'}`}
                    >
                      <Calculator size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-2 block">Conta de Destino</label>
                    <div className="relative">
                      <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <select
                        title="Conta de Destino"
                        className={`w-full border rounded-2xl py-3.5 pl-12 pr-4 text-xs font-black uppercase tracking-widest focus:ring-4 focus:ring-indigo-500/10 appearance-none ${isDarkMode ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700/60 text-white' : 'bg-gradient-to-br from-white to-slate-100 border-slate-100 text-slate-900'}`}
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
                        title="Método de Pagamento"
                        className={`w-full border rounded-2xl py-3.5 pl-12 pr-4 text-xs font-black uppercase tracking-widest focus:ring-4 focus:ring-indigo-500/10 appearance-none ${isDarkMode ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700/60 text-white' : 'bg-gradient-to-br from-white to-slate-100 border-slate-100 text-slate-900'}`}
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
                      placeholder="Ex: Recebimento em dinheiro"
                      className={`w-full border rounded-2xl py-3.5 px-4 text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-indigo-500/10 placeholder:text-[12px] placeholder:font-medium placeholder:normal-case placeholder:tracking-normal ${isDarkMode ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700/60 text-white placeholder:text-slate-500' : 'bg-gradient-to-br from-white to-slate-100 border-slate-100 text-slate-900 placeholder:text-slate-400'}`}
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
              <div className={`p-5 rounded-3xl border shadow-lg flex items-center justify-between ${isDarkMode ? 'bg-gradient-to-br from-emerald-900/50 to-emerald-950/40 border-emerald-800/50 shadow-black/30' : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200/70 shadow-emerald-200/60'}`}>
                <div>
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Status da Venda</p>
                  <p className={`text-2xl font-black tracking-tighter ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {remaining <= 0 ? 'QUITADO' : `FALTAM R$ ${remaining.toLocaleString('pt-BR')}`}
                  </p>
                </div>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-emerald-500/15' : 'bg-emerald-500/10'}`}>
                  <History size={26} className="text-emerald-500" strokeWidth={2.5} />
                </div>
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

    {showCalc && (
      <CalculatorPopover
        onApply={(val) => { setAmount(val.toFixed(2)); setShowCalc(false); }}
        onClose={() => setShowCalc(false)}
      />
    )}
    </>
  );
}

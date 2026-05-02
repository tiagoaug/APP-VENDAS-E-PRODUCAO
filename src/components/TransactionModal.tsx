import { useState, useEffect, useRef } from 'react';
import { Transaction, TransactionType, Category, CategoryType, Account, Person, FamilyMember } from '../types';
import { X, Calendar, DollarSign, Tag, Wallet, User, CheckCircle2, Clock, Users, Calculator as CalculatorIcon } from 'lucide-react';
import { format } from 'date-fns';
import CalculatorPopover from './CalculatorPopover';
import ComboBox from './ComboBox';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'>) => void;
  categories: Category[];
  accounts: Account[];
  people: Person[];
  familyMembers?: FamilyMember[];
  initialType?: TransactionType;
  transaction?: Transaction;
  initialValue?: number;
}

export default function TransactionModal({ 
  isOpen, 
  onClose, 
  onSave, 
  categories, 
  accounts, 
  people,
  familyMembers = [],
  initialType = TransactionType.INCOME,
  transaction,
  initialValue
}: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState<number | string>(0);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [contactId, setContactId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [status, setStatus] = useState<'PENDING' | 'COMPLETED'>('COMPLETED');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const calculatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(transaction.amount);
      setDescription(transaction.description);
      setCategoryId(transaction.categoryId);
      setAccountId(transaction.accountId);
      setContactId(transaction.contactId || '');
      setMemberId(transaction.memberId || '');
      setDate(format(transaction.date, 'yyyy-MM-dd'));
      setStatus(transaction.status);
    } else {
      setType(initialType);
      setAmount(initialValue !== undefined ? initialValue : 0);
      setDescription('');
      setAccountId(accounts[0]?.id || '');
      setContactId('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setStatus('COMPLETED');
      
      const filteredCats = categories.filter(c => 
        initialType === TransactionType.INCOME ? c.type === CategoryType.REVENUE : c.type === CategoryType.EXPENSE
      );
      setCategoryId(filteredCats[0]?.id || '');
    }
  }, [transaction, initialType, isOpen, categories, accounts, initialValue]);

  // Update category when type changes if not editing
  useEffect(() => {
    if (!transaction) {
      const filteredCats = categories.filter(c => 
        type === TransactionType.INCOME ? c.type === CategoryType.REVENUE : c.type === CategoryType.EXPENSE
      );
      if (!filteredCats.find(c => c.id === categoryId)) {
        setCategoryId(filteredCats[0]?.id || '');
      }
    }
  }, [type]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!description || !amount || !categoryId || !accountId) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    const contact = people.find(p => p.id === contactId);

    onSave({
      type,
      amount: Number(amount),
      description,
      categoryId,
      accountId,
      contactId: contactId || undefined,
      contactName: contact?.name,
      date: new Date(date).getTime() + (new Date().getTime() % (24 * 60 * 60 * 1000)), // Preserve current time of day roughly if possible, but simple date is fine
      status,
      memberId: memberId || undefined,
    });
    onClose();
  };

  const handleAmountChange = (val: string) => {
    // If current value is exactly 0 and user types a digit, replace it
    if (amount === 0 || amount === '0') {
      setAmount(val.replace(/^0+/, ''));
    } else {
      setAmount(val);
    }
  };

  const filteredCategories = categories.filter(c => 
    type === TransactionType.INCOME ? c.type === CategoryType.REVENUE : c.type === CategoryType.EXPENSE
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overscroll-contain">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
              {transaction ? 'Editar Lançamento' : 'Novo Lançamento'}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão Financeira</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors text-slate-400"
            title="Fechar"
            aria-label="Fechar"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Type Selector */}
          <div className="flex bg-slate-50 dark:bg-slate-800 p-1.5 rounded-3xl border border-slate-100 dark:border-slate-700">
            <button
              onClick={() => setType(TransactionType.INCOME)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${type === TransactionType.INCOME ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-100' : 'text-slate-400'}`}
            >
              <CheckCircle2 size={16} /> Entradas
            </button>
            <button
              onClick={() => setType(TransactionType.EXPENSE)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${type === TransactionType.EXPENSE ? 'bg-rose-500 text-white shadow-xl shadow-rose-100' : 'text-slate-400'}`}
            >
              <Clock size={16} /> Saídas
            </button>
          </div>

          <div className="space-y-4 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Valor (R$)</label>
                <div className="relative" ref={calculatorRef}>
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    type="number"
                    step="0.01"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-12 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white"
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${isCalculatorOpen ? 'text-indigo-500' : 'text-slate-300 hover:text-indigo-400'}`}
                    title="Abrir calculadora"
                    aria-label="Abrir calculadora"
                  >
                    <CalculatorIcon size={18} />
                  </button>
                  
                  {isCalculatorOpen && (
                    <CalculatorPopover 
                      onApply={(val) => setAmount(val)} 
                      onClose={() => setIsCalculatorOpen(false)} 
                    />
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    type="date"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    title="Data do lançamento"
                    aria-label="Data do lançamento"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Descrição</label>
              <input
                type="text"
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 px-5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white"
                placeholder="Ex: Recebimento de venda, Pagamento de luz..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Categoria</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white appearance-none"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    title="Selecione a categoria"
                    aria-label="Selecione a categoria"
                  >
                    <option value="">Selecione...</option>
                    {filteredCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Conta</label>
                <div className="relative">
                  <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white appearance-none"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    title="Selecione a conta bancária"
                    aria-label="Selecione a conta bancária"
                  >
                    <option value="">Selecione...</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cliente / Fornecedor (Opcional)</label>
              <ComboBox
                options={people.map(p => ({ 
                  id: p.id, 
                  name: `${p.name} ${p.isCustomer && p.isSupplier ? '(CLI/FOR)' : p.isCustomer ? '(CLI)' : '(FOR)'}`
                }))}
                value={contactId}
                onChange={setContactId}
                placeholder="Sem vínculo"
              />
            </div>

            {familyMembers.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Membro da Família (Opcional)</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white appearance-none"
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    title="Selecione o membro da família"
                    aria-label="Selecione o membro da família"
                  >
                    <option value="">Todos / Não atribuído</option>
                    {familyMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status</label>
               <div className="flex gap-2">
                  <button 
                    onClick={() => setStatus('COMPLETED')}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${status === 'COMPLETED' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400'}`}
                  >
                    Concluído
                  </button>
                  <button 
                    onClick={() => setStatus('PENDING')}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${status === 'PENDING' ? 'bg-amber-500 border-amber-500 text-white shadow-lg' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400'}`}
                  >
                    Pendente / Agendado
                  </button>
               </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            onClick={handleSave}
            className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-4 rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none active:scale-[0.98] transition-all"
          >
            Confirmar Lançamento
          </button>
        </div>
      </div>
    </div>
  );
}

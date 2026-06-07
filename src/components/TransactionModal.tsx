import { useState, useEffect, useRef } from 'react';
import { Transaction, TransactionType, TransactionItem, Category, CategoryType, Account, Person, FamilyMember } from '../types';
import { X, Calendar, DollarSign, Tag, Wallet, User, CheckCircle2, Clock, Users, Calculator as CalculatorIcon, Plus, ChevronDown, Trash2 } from 'lucide-react';
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
  const [activeCalculatorId, setActiveCalculatorId] = useState<string | 'main' | null>(null);
  const [status, setStatus] = useState<'PENDING' | 'COMPLETED'>('COMPLETED');
  const [items, setItems] = useState<TransactionItem[]>([]);
  const [isManual, setIsManual] = useState(true);
  const [referenceNumber, setReferenceNumber] = useState('');
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
      setItems(transaction.items || []);
      setIsManual(transaction.isManual !== false);
      setReferenceNumber(transaction.referenceNumber || '');
    } else {
      setIsManual(true);
      setReferenceNumber('');
      setType(initialType);
      setAmount(initialValue !== undefined ? initialValue : 0);
      setDescription('');
      const defaultAccount = accounts.find(a => a.isDefault);
      setAccountId(defaultAccount?.id || accounts[0]?.id || '');
      setContactId('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setStatus('COMPLETED');
      setItems([]);
      
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

  const addItem = () => {
    const newItem: TransactionItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      amount: 0
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof TransactionItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const itemsTotal = items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

  useEffect(() => {
    if (items.length > 0) {
      setAmount(itemsTotal);
    }
  }, [itemsTotal, items.length]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!description || !(Number(amount) > 0) || !categoryId || !accountId) {
      alert('Preencha todos os campos obrigatórios (valor deve ser maior que zero)');
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
      isManual,
      referenceNumber: referenceNumber.trim() || undefined,
      memberId: memberId || undefined,
      items: items.length > 0 ? items : undefined,
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
    (type === TransactionType.INCOME ? c.type === CategoryType.REVENUE : c.type === CategoryType.EXPENSE) &&
    !c.isPersonal
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-sm overscroll-contain">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto max-h-screen sm:max-h-[90vh]">
        {/* Header */}
        <div className="p-8 pb-4 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
            {transaction ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          <button 
            onClick={onClose} 
            className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-colors text-slate-300"
          >
            <X size={28} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-8 custom-scrollbar">
          {/* Type Selector (Tabs) */}
          <div className="flex gap-4">
            <button
              onClick={() => setType(TransactionType.INCOME)}
              className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-[1.8rem] text-xs font-black uppercase tracking-widest transition-all ${type === TransactionType.INCOME ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}
            >
              {type === TransactionType.INCOME && <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center"><CheckCircle2 size={12} strokeWidth={4} /></div>} 
              Entradas
            </button>
            <button
              onClick={() => setType(TransactionType.EXPENSE)}
              className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-[1.8rem] text-xs font-black uppercase tracking-widest transition-all ${type === TransactionType.EXPENSE ? 'bg-rose-500 text-white shadow-xl shadow-rose-500/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}
            >
               {type === TransactionType.EXPENSE && <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center"><Clock size={12} strokeWidth={4} /></div>}
               Saídas
            </button>
          </div>

          {/* Nº de Indicação + toggle Manual/Automático */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nº de Indicação</label>
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-[1.8rem] pr-4">
              <input
                type="text"
                className={`flex-1 bg-transparent border-none rounded-[1.8rem] py-5 px-7 text-sm font-bold focus:ring-0 outline-none dark:text-white placeholder:text-slate-300 ${!isManual ? 'opacity-40 cursor-not-allowed' : ''}`}
                placeholder={isManual ? 'Ex: NF-001, REF-2024, #123...' : 'Gerado automaticamente'}
                value={referenceNumber}
                readOnly={!isManual}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
              <button
                type="button"
                aria-label={isManual ? 'Lançamento manual — clique para automático' : 'Lançamento automático — clique para manual'}
                onClick={() => setIsManual(v => !v)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl shrink-0 transition-all ${isManual ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-slate-200 dark:bg-slate-700'}`}
              >
                <div className={`w-7 h-4 rounded-full relative transition-all ${isManual ? 'bg-indigo-500' : 'bg-slate-400'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isManual ? 'left-3.5' : 'left-0.5'}`} />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${isManual ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                  {isManual ? 'Manual' : 'Auto'}
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Vínculo */}
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                <User size={12} /> Vínculo (Cliente/Fornecedor)
              </label>
              <div className="relative">
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
            </div>

            {/* Detalhamento linking placeholder */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Detalhamento de Itens</label>
                <button 
                  onClick={addItem}
                  className="flex items-center gap-1.5 text-indigo-500 text-[10px] font-black uppercase tracking-widest hover:text-indigo-600 transition-colors"
                >
                  <Plus size={14} strokeWidth={3} /> Adicionar Item
                </button>
              </div>

              {items.length > 0 && (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id}>
                      <div className="flex gap-3 items-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-[1.5rem] border border-slate-100 dark:border-slate-700/50">
                        <div className="flex-1 space-y-3">
                          <input
                            type="text"
                            placeholder="Descrição do item..."
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-tight dark:text-white placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                          />
                          <div className="flex items-center gap-2 px-1">
                            <span className="text-[10px] font-black text-indigo-500/50 uppercase tracking-[0.2em]">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.amount || ''}
                              onChange={(e) => updateItem(item.id, 'amount', Number(e.target.value))}
                              placeholder="0,00"
                              className="w-full bg-transparent border-none outline-none p-0 text-sm font-black dark:text-white placeholder:text-slate-300 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2 pl-3 border-l border-slate-100 dark:border-slate-800">
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                            title="Remover item"
                          >
                            <Trash2 size={18} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setActiveCalculatorId(item.id)}
                            className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                            title="Calcular valor do item"
                          >
                            <CalculatorIcon size={18} />
                          </button>
                        </div>
                      </div>
                      {activeCalculatorId === item.id && (
                        <CalculatorPopover 
                          onApply={(val) => updateItem(item.id, 'amount', val)} 
                          onClose={() => setActiveCalculatorId(null)} 
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Valor and Data */}
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Valor (R$)</label>
                <div className="relative" ref={calculatorRef}>
                  <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-200" size={20} />
                  <input
                    type="number"
                    step="0.01"
                    className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] py-5 pl-14 pr-12 text-base font-black focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white placeholder:text-slate-200 ${items.length > 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
                    placeholder="0"
                    value={amount}
                    readOnly={items.length > 0}
                    onChange={(e) => handleAmountChange(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => setActiveCalculatorId('main')}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-200 hover:text-indigo-400 transition-colors"
                  >
                    <CalculatorIcon size={20} />
                  </button>
                  
                  {activeCalculatorId === 'main' && (
                    <CalculatorPopover 
                      onApply={(val) => setAmount(val)} 
                      onClose={() => setActiveCalculatorId(null)} 
                    />
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Data</label>
                <div className="relative">
                  <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-200" size={20} />
                  <input
                    type="date"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] py-5 pl-14 pr-6 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Categoria and Conta */}
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                  <Tag size={12} /> Categoria
                </label>
                <div className="relative">
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] py-5 pl-6 pr-10 text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white appearance-none"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {filteredCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                  <Wallet size={12} /> Conta
                </label>
                <div className="relative">
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] py-5 pl-6 pr-10 text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white appearance-none"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-3">
               <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Status</label>
               <div className="flex bg-slate-50 dark:bg-slate-800 p-1.5 rounded-[1.8rem]">
                  <button 
                    onClick={() => setStatus('COMPLETED')}
                    className={`flex-1 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${status === 'COMPLETED' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-400'}`}
                  >
                    Concluído
                  </button>
                  <button 
                    onClick={() => setStatus('PENDING')}
                    className={`flex-1 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${status === 'PENDING' ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/20' : 'text-slate-400'}`}
                  >
                    Pendente
                  </button>
               </div>
            </div>
          </div>
        </div>

        <div className="p-8 pt-0 shrink-0 mt-4">
          <button
            type="button"
            onClick={handleSave}
            className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] hover:bg-indigo-700"
          >
            Confirmar Lançamento
          </button>
        </div>
      </div>
    </div>
  );
}

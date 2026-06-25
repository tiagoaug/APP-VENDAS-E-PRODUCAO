import { useState, useEffect, useRef } from 'react';
import { Transaction, TransactionType, TransactionItem, Category, CategoryType, Account, Person, FamilyMember } from '../types';
import { X, Calendar, DollarSign, Tag, Wallet, User, CheckCircle2, Clock, Users, Calculator as CalculatorIcon, Plus, ChevronDown, Trash2, Hash, ClipboardList, Repeat } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import CalculatorPopover from './CalculatorPopover';
import ComboBox from './ComboBox';
import { toast } from '../utils/toast';
import { generateId } from '../utils/id';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'>) => void | Promise<void>;
  categories: Category[];
  accounts: Account[];
  people: Person[];
  familyMembers?: FamilyMember[];
  initialType?: TransactionType;
  transaction?: Transaction;
  initialValue?: number;
  isDarkMode?: boolean;
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
  initialValue,
  isDarkMode = false
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
  const [isRecurring, setIsRecurring] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState(2);
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
      setIsRecurring(false);
      setTotalInstallments(2);
    } else {
      setIsManual(true);
      setReferenceNumber('');
      setIsRecurring(false);
      setTotalInstallments(2);
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
      id: generateId(),
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

  const handleSave = async () => {
    if (!description || !(Number(amount) > 0) || !categoryId || !accountId) {
      toast.show('Preencha todos os campos obrigatórios (valor deve ser maior que zero)');
      return;
    }
    if (!transaction && isRecurring && (!totalInstallments || totalInstallments < 2)) {
      toast.show('Informe quantas parcelas (mínimo 2)');
      return;
    }

    const contact = people.find(p => p.id === contactId);
    const baseDate = new Date(date).getTime() + (new Date().getTime() % (24 * 60 * 60 * 1000)); // Preserve current time of day roughly if possible, but simple date is fine

    const buildTx = (txDate: number, installmentNumber?: number, recurrenceGroupId?: string): Omit<Transaction, 'id'> => ({
      type,
      amount: Number(amount),
      description,
      categoryId,
      accountId,
      contactId: contactId || undefined,
      contactName: contact?.name,
      date: txDate,
      status,
      isManual,
      referenceNumber: referenceNumber.trim() || undefined,
      memberId: memberId || undefined,
      items: items.length > 0 ? items : undefined,
      isRecurring: recurrenceGroupId ? true : undefined,
      recurrenceGroupId,
      installmentNumber,
      totalInstallments: recurrenceGroupId ? totalInstallments : undefined,
    });

    if (!transaction && isRecurring && totalInstallments >= 2) {
      const groupId = generateId();
      for (let i = 0; i < totalInstallments; i++) {
        await onSave(buildTx(addMonths(baseDate, i).getTime(), i + 1, groupId));
      }
      onClose();
      return;
    }

    await onSave(buildTx(baseDate));
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
      <div className="bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 w-full max-w-lg rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto max-h-screen sm:max-h-[90vh] border border-slate-200/50 dark:border-slate-800/80">
        {/* Header */}
        <div className="p-8 pb-4 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">
            {transaction ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          <button 
            onClick={onClose} 
            className="p-3 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-2xl transition-colors text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400"
          >
            <X size={28} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-5 custom-scrollbar">
          {/* Type Selector (Segmented Control Card) */}
          <div className={`p-1.5 rounded-[2rem] border transition-all duration-300 flex gap-1 shadow-inner ${
            isDarkMode 
              ? 'bg-slate-950/60 border-slate-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]' 
              : 'bg-slate-100 border-slate-200/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)]'
          }`}>
            <button
              onClick={() => setType(TransactionType.INCOME)}
              className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-[1.6rem] text-xs font-black uppercase tracking-widest transition-all ${
                type === TransactionType.INCOME 
                  ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_6px_16px_rgba(16,185,129,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)]' 
                  : isDarkMode 
                    ? 'text-slate-500 hover:text-slate-350' 
                    : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {type === TransactionType.INCOME && <CheckCircle2 size={14} strokeWidth={3} />} 
              Entradas
            </button>
            <button
              onClick={() => setType(TransactionType.EXPENSE)}
              className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-[1.6rem] text-xs font-black uppercase tracking-widest transition-all ${
                type === TransactionType.EXPENSE 
                  ? 'bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-[0_6px_16px_rgba(244,63,94,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)]' 
                  : isDarkMode 
                    ? 'text-slate-500 hover:text-slate-355' 
                    : 'text-slate-400 hover:text-slate-600'
              }`}
            >
               {type === TransactionType.EXPENSE && <Clock size={14} strokeWidth={3} />}
               Saídas
            </button>
          </div>

          {/* Nº de Indicação Card */}
          <div className={`p-5 rounded-[2rem] border transition-all duration-300 flex flex-col gap-4 ${
            isDarkMode 
              ? 'bg-gradient-to-b from-slate-900 to-slate-950/80 border-slate-800/80 shadow-[0_10px_25px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]' 
              : 'bg-gradient-to-b from-white to-slate-50/50 border-slate-200/60 shadow-[0_10px_25px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.9)]'
          } hover:scale-[1.01] hover:shadow-lg`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                isDarkMode ? 'bg-indigo-500/10 text-indigo-400 shadow-[0_4px_12px_rgba(99,102,241,0.15)]' : 'bg-indigo-50 text-indigo-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]'
              }`}>
                <Hash size={16} strokeWidth={2.5} />
              </div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Nº de Indicação</label>
            </div>
            <div className={`flex items-center gap-3 rounded-[1.3rem] border transition-all ${
              isDarkMode 
                ? 'bg-slate-950/60 border-slate-800 pr-3 focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]' 
                : 'bg-slate-100/70 border-slate-200/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] pr-3 focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10'
            }`}>
              <input
                type="text"
                className={`flex-1 bg-transparent border-none rounded-[1.3rem] py-4 px-5 text-sm font-bold focus:ring-0 outline-none dark:text-white placeholder:text-slate-400 ${!isManual ? 'opacity-40 cursor-not-allowed' : ''}`}
                placeholder={isManual ? 'Ex: NF-001, REF-2024, #123...' : 'Gerado automaticamente'}
                value={referenceNumber}
                readOnly={!isManual}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
              <button
                type="button"
                aria-label={isManual ? 'Lançamento manual — clique para automático' : 'Lançamento automático — clique para manual'}
                onClick={() => setIsManual(v => !v)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl shrink-0 transition-all shadow-sm ${
                  isManual 
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' 
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                <div className={`w-7 h-4 rounded-full relative transition-all ${isManual ? 'bg-indigo-500' : 'bg-slate-400'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isManual ? 'left-3.5' : 'left-0.5'}`} />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                  {isManual ? 'Manual' : 'Auto'}
                </span>
              </button>
            </div>
          </div>

          {/* Vínculo Card */}
          <div className={`p-5 rounded-[2rem] border transition-all duration-300 flex flex-col gap-4 ${
            isDarkMode 
              ? 'bg-gradient-to-b from-slate-900 to-slate-950/80 border-slate-800/80 shadow-[0_10px_25px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]' 
              : 'bg-gradient-to-b from-white to-slate-50/50 border-slate-200/60 shadow-[0_10px_25px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.9)]'
          } hover:scale-[1.01] hover:shadow-lg`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                isDarkMode ? 'bg-blue-500/10 text-blue-400 shadow-[0_4px_12px_rgba(59,130,246,0.15)]' : 'bg-blue-50 text-blue-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]'
              }`}>
                <User size={16} strokeWidth={2.5} />
              </div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Vínculo (Cliente/Fornecedor)</label>
            </div>
            <div className="relative">
              <ComboBox
                options={people.map(p => ({ 
                  id: p.id, 
                  name: `${p.name} ${p.isCustomer && p.isSupplier ? '(CLI/FOR)' : p.isCustomer ? '(CLI)' : '(FOR)'}`
                }))}
                value={contactId}
                onChange={setContactId}
                placeholder="Sem vínculo"
                isDarkMode={isDarkMode}
              />
            </div>
          </div>

          {/* Detalhamento Card */}
          <div className={`p-5 rounded-[2rem] border transition-all duration-300 flex flex-col gap-4 ${
            isDarkMode 
              ? 'bg-gradient-to-b from-slate-900 to-slate-950/80 border-slate-800/80 shadow-[0_10px_25px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]' 
              : 'bg-gradient-to-b from-white to-slate-50/50 border-slate-200/60 shadow-[0_10px_25px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.9)]'
          } hover:scale-[1.01] hover:shadow-lg`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                  isDarkMode ? 'bg-violet-500/10 text-violet-400 shadow-[0_4px_12px_rgba(139,92,246,0.15)]' : 'bg-violet-50 text-violet-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]'
                }`}>
                  <ClipboardList size={16} strokeWidth={2.5} />
                </div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Detalhamento de Itens</label>
              </div>
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
                    <div className={`flex gap-3 items-center p-4 rounded-[1.5rem] border ${
                      isDarkMode 
                        ? 'bg-slate-950/60 border-slate-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]' 
                        : 'bg-slate-100/70 border-slate-200/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]'
                    }`}>
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          placeholder="Descrição do item..."
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          className="w-full bg-white dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-tight dark:text-white placeholder:text-slate-350 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
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
                      <div className="flex flex-col items-center gap-2 pl-3 border-l border-slate-200/60 dark:border-slate-800">
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                          title="Remover item"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => setActiveCalculatorId(item.id)}
                          className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
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

          {/* Valor Card */}
          <div className={`p-5 rounded-[2rem] border transition-all duration-300 flex flex-col gap-4 ${
            isDarkMode 
              ? 'bg-gradient-to-b from-slate-900 to-slate-950/80 border-slate-800/80 shadow-[0_10px_25px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]' 
              : 'bg-gradient-to-b from-white to-slate-50/50 border-slate-200/60 shadow-[0_10px_25px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.9)]'
          } hover:scale-[1.01] hover:shadow-lg`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                isDarkMode ? 'bg-emerald-500/10 text-emerald-400 shadow-[0_4px_12px_rgba(16,185,129,0.15)]' : 'bg-emerald-50 text-emerald-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]'
              }`}>
                <DollarSign size={16} strokeWidth={2.5} />
              </div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Valor (R$)</label>
            </div>
            <div className="relative" ref={calculatorRef}>
              <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-650" size={20} />
              <input
                type="number"
                step="0.01"
                className={`w-full bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-[1.3rem] py-4.5 pl-14 pr-12 text-base font-black focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white placeholder:text-slate-300 outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] focus:border-indigo-500/50 ${
                  items.length > 0 ? 'opacity-65 cursor-not-allowed' : ''
                }`}
                placeholder="0"
                value={amount}
                readOnly={items.length > 0}
                onChange={(e) => handleAmountChange(e.target.value)}
              />
              <button 
                type="button"
                onClick={() => setActiveCalculatorId('main')}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors"
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

          {/* Data Card */}
          <div className={`p-5 rounded-[2rem] border transition-all duration-300 flex flex-col gap-4 ${
            isDarkMode 
              ? 'bg-gradient-to-b from-slate-900 to-slate-950/80 border-slate-800/80 shadow-[0_10px_25px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]' 
              : 'bg-gradient-to-b from-white to-slate-50/50 border-slate-200/60 shadow-[0_10px_25px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.9)]'
          } hover:scale-[1.01] hover:shadow-lg`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                isDarkMode ? 'bg-sky-500/10 text-sky-400 shadow-[0_4px_12px_rgba(56,189,248,0.15)]' : 'bg-sky-50 text-sky-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]'
              }`}>
                <Calendar size={16} strokeWidth={2.5} />
              </div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Data</label>
            </div>
            <div className="relative">
              <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-655" size={20} />
              <input
                type="date"
                className="w-full bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-[1.3rem] py-4.5 pl-14 pr-6 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] focus:border-indigo-500/50"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Categoria Card */}
          <div className={`p-5 rounded-[2rem] border transition-all duration-300 flex flex-col gap-4 ${
            isDarkMode 
              ? 'bg-gradient-to-b from-slate-900 to-slate-950/80 border-slate-800/80 shadow-[0_10px_25px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]' 
              : 'bg-gradient-to-b from-white to-slate-50/50 border-slate-200/60 shadow-[0_10px_25px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.9)]'
          } hover:scale-[1.01] hover:shadow-lg`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                isDarkMode ? 'bg-amber-500/10 text-amber-400 shadow-[0_4px_12px_rgba(245,158,11,0.15)]' : 'bg-amber-50 text-amber-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]'
              }`}>
                <Tag size={16} strokeWidth={2.5} />
              </div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Categoria</label>
            </div>
            <div className="relative">
              <select
                className="w-full bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-[1.3rem] py-4.5 pl-6 pr-10 text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white appearance-none outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] focus:border-indigo-500/50"
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

          {/* Conta Card */}
          <div className={`p-5 rounded-[2rem] border transition-all duration-300 flex flex-col gap-4 ${
            isDarkMode 
              ? 'bg-gradient-to-b from-slate-900 to-slate-950/80 border-slate-800/80 shadow-[0_10px_25px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]' 
              : 'bg-gradient-to-b from-white to-slate-50/50 border-slate-200/60 shadow-[0_10px_25px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.9)]'
          } hover:scale-[1.01] hover:shadow-lg`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                isDarkMode ? 'bg-purple-500/10 text-purple-400 shadow-[0_4px_12px_rgba(168,85,247,0.15)]' : 'bg-purple-50 text-purple-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]'
              }`}>
                <Wallet size={16} strokeWidth={2.5} />
              </div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Conta</label>
            </div>
            <div className="relative">
              <select
                className="w-full bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 rounded-[1.3rem] py-4.5 pl-6 pr-10 text-[10px] font-black uppercase tracking-widest focus:ring-4 focus:ring-indigo-500/10 transition-all dark:text-white appearance-none outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] focus:border-indigo-500/50"
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

          {/* Status Card */}
          <div className={`p-5 rounded-[2rem] border transition-all duration-300 flex flex-col gap-4 ${
            isDarkMode 
              ? 'bg-gradient-to-b from-slate-900 to-slate-950/80 border-slate-800/80 shadow-[0_10px_25px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]' 
              : 'bg-gradient-to-b from-white to-slate-50/50 border-slate-200/60 shadow-[0_10px_25px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.9)]'
          } hover:scale-[1.01] hover:shadow-lg`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                isDarkMode ? 'bg-indigo-500/10 text-indigo-400 shadow-[0_4px_12px_rgba(99,102,241,0.15)]' : 'bg-indigo-50 text-indigo-655 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]'
              }`}>
                <CheckCircle2 size={16} strokeWidth={2.5} />
              </div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</label>
            </div>
            <div className={`flex p-1.5 rounded-[1.5rem] border gap-1 shadow-inner ${
              isDarkMode ? 'bg-slate-950/60 border-slate-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]' : 'bg-slate-150 border-slate-200/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)]'
            }`}>
              <button 
                onClick={() => setStatus('COMPLETED')}
                className={`flex-1 py-4 rounded-[1.1rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                  status === 'COMPLETED' 
                    ? 'bg-gradient-to-b from-indigo-400 to-indigo-600 text-white shadow-[0_6px_16px_rgba(99,102,241,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)]' 
                    : isDarkMode 
                      ? 'text-slate-500 hover:text-slate-350' 
                      : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Concluído
              </button>
              <button 
                onClick={() => setStatus('PENDING')}
                className={`flex-1 py-4 rounded-[1.1rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                  status === 'PENDING' 
                    ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-white shadow-[0_6px_16px_rgba(245,158,11,0.35),inset_0_1px_1px_rgba(255,255,255,0.2)]' 
                    : isDarkMode 
                      ? 'text-slate-500 hover:text-slate-355' 
                      : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Pendente
              </button>
            </div>
          </div>

          {/* Recorrência Card — só faz sentido pra despesas; ao editar uma parcela já
              existente, mostra só a informação (não dá pra "re-parcelar" um lançamento
              que já é uma parcela individual). */}
          {type === TransactionType.EXPENSE && (
            <div className={`p-5 rounded-[2rem] border transition-all duration-300 flex flex-col gap-4 ${
              isDarkMode
                ? 'bg-gradient-to-b from-slate-900 to-slate-950/80 border-slate-800/80 shadow-[0_10px_25px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]'
                : 'bg-gradient-to-b from-white to-slate-50/50 border-slate-200/60 shadow-[0_10px_25px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(255,255,255,0.9)]'
            } hover:scale-[1.01] hover:shadow-lg`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${
                  isDarkMode ? 'bg-cyan-500/10 text-cyan-400 shadow-[0_4px_12px_rgba(6,182,212,0.15)]' : 'bg-cyan-50 text-cyan-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]'
                }`}>
                  <Repeat size={16} strokeWidth={2.5} />
                </div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Recorrência</label>
              </div>

              {transaction?.isRecurring ? (
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Parcela {transaction.installmentNumber} de {transaction.totalInstallments} — editar/excluir afeta só esta parcela.
                </p>
              ) : transaction ? (
                <p className="text-[11px] font-bold text-slate-400 italic">Lançamento único (não recorrente).</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsRecurring(v => !v)}
                    className={`flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.99] ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}
                  >
                    <span className="text-[11px] font-black uppercase tracking-tight text-left dark:text-white">
                      Despesa recorrente / parcelada
                    </span>
                    <div className={`w-10 h-6 rounded-full p-1 flex items-center transition-all shrink-0 ${isRecurring ? 'bg-cyan-500 justify-end' : (isDarkMode ? 'bg-slate-700 justify-start' : 'bg-slate-300 justify-start')}`}>
                      <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                    </div>
                  </button>
                  {isRecurring && (
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-2 block">Quantas parcelas</label>
                      <input
                        type="number"
                        min={2}
                        value={totalInstallments}
                        onChange={(e) => setTotalInstallments(Math.max(2, Number(e.target.value) || 2))}
                        className="w-full bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-[1.3rem] py-3.5 px-5 text-sm font-black focus:ring-4 focus:ring-cyan-500/10 transition-all dark:text-white outline-none"
                      />
                      <p className="text-[9px] font-bold text-slate-400 mt-2 ml-1">
                        Gera {totalInstallments} lançamentos, um por mês a partir da data informada.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-8 pt-2 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            className="w-full bg-gradient-to-r from-indigo-500 via-indigo-650 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/30 transition-all active:scale-[0.98] outline-none border-none"
          >
            Confirmar Lançamento
          </button>
        </div>
      </div>
    </div>
  );
}

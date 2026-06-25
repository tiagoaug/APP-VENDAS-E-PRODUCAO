import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Save, ShoppingCart, Users, CreditCard, 
  Calendar as CalendarIcon, Hash, Package, Palette, 
  Trash2, Plus, DollarSign, Calculator, CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { 
  Person, Category, Account, ProductionConfigItem, 
  ColorValue, Purchase, PurchaseType, PaymentTerm, 
  PaymentStatus, SolePurchaseItem, TransactionType
} from '../types';
import { format } from 'date-fns';
import { toast } from '../utils/toast';
import DatePicker from './DatePicker';
import { parseLocaleNumber } from '../utils/numbers';

interface SolePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (purchase: Purchase, soleItems: SolePurchaseItem[]) => Promise<void>;
  suppliers: Person[];
  people: Person[]; // For representative (buyers)
  categories: Category[];
  accounts: Account[];
  productionConfigs: ProductionConfigItem[];
  colors: ColorValue[];
  isDarkMode: boolean;
  initialParams?: {
    moldId?: string;
    colorId?: string;
    initialGrid?: Record<string, number>;
    items?: { moldId: string; colorId?: string; initialGrid?: Record<string, number> }[];
    description?: string;
    requestId?: string;
  };
}

export default function SolePurchaseModal({
  isOpen,
  onClose,
  onSave,
  suppliers,
  people,
  categories,
  accounts,
  productionConfigs,
  colors,
  isDarkMode,
  initialParams
}: SolePurchaseModalProps) {
  // Financial State
  const [supplierId, setSupplierId] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [isAccounting, setIsAccounting] = useState(true);
  const [batchNumber, setBatchNumber] = useState(`LOT-${Math.floor(10000 + Math.random() * 90000)}`);
  const [isAutoBatch, setIsAutoBatch] = useState(true);
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm>(PaymentTerm.CASH);
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');

  // Sole Items State
  const [items, setItems] = useState<SolePurchaseItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [registerAsReceived, setRegisterAsReceived] = useState(false);

  const molds = useMemo(() => productionConfigs.filter(c => c.type === 'MOLD'), [productionConfigs]);
  const buyers = useMemo(() => people.filter(p => p.isBuyer || p.isPersonal), [people]);
  const purchaseCategories = useMemo(() => categories.filter(c => c.type === 'EXPENSE'), [categories]);

  const DEFAULT_COLORS: ColorValue[] = [
    { id: 'BRANCO', name: 'BRANCO', hex: '#FFFFFF' } as ColorValue,
    { id: 'PRETO', name: 'PRETO', hex: '#000000' } as ColorValue,
    { id: 'CARAMELO', name: 'CARAMELO', hex: '#C68642' } as ColorValue,
    { id: 'MARROM', name: 'MARROM', hex: '#8B4513' } as ColorValue,
    { id: 'VERMELHO', name: 'VERMELHO', hex: '#FF0000' } as ColorValue,
    { id: 'AZUL', name: 'AZUL', hex: '#0000FF' } as ColorValue,
    { id: 'CINZA', name: 'CINZA', hex: '#808080' } as ColorValue,
    { id: 'NUDE', name: 'NUDE', hex: '#D4A987' } as ColorValue,
    { id: 'OFF WHITE', name: 'OFF WHITE', hex: '#F5F0E8' } as ColorValue,
    { id: 'BEGE', name: 'BEGE', hex: '#F5F5DC' } as ColorValue,
  ];
  const colorOptions: ColorValue[] = colors.length > 0 ? colors : DEFAULT_COLORS;


  // Set initial category (Solados)
  useEffect(() => {
    const soleCat = categories.find(c => c.name.toLowerCase().includes('solado'));
    if (soleCat) setCategoryId(soleCat.id);
    
    if (accounts.length > 0) {
      const defAcc = accounts.find(a => a.isDefault) || accounts[0];
      setAccountId(defAcc.id);
    }
  }, [categories, accounts]);

  // Pre-fill from initialParams
  useEffect(() => {
    if (isOpen && initialParams?.items && initialParams.items.length > 0) {
      // Múltiplos solados agrupados em uma única compra (ex: seleção em lote no PCP)
      const newItems: SolePurchaseItem[] = [];
      let firstSupplierId = '';
      initialParams.items.forEach(p => {
        const mold = molds.find(m =>
          m.id === p.moldId ||
          m.name.toLowerCase() === String(p.moldId).toLowerCase()
        );
        if (!mold) return;
        if (!firstSupplierId && mold.metadata?.supplierId) firstSupplierId = mold.metadata.supplierId;
        const initialQuantities = p.initialGrid || {};
        const unitCost = mold.metadata?.unitCost || 0;
        newItems.push({
          moldId: mold.id,
          moldName: mold.name,
          colorId: p.colorId || '',
          colorName: p.colorId ? (colorOptions.find(c => c.id === p.colorId)?.name || '') : '',
          quantities: initialQuantities,
          unitCost,
          totalCost: Object.values(initialQuantities).reduce((a: number, b: any) => a + (Number(b) || 0), 0) * unitCost
        });
      });
      setItems(newItems);
      setSupplierId(firstSupplierId);
      setNotes(initialParams.description || '');
    } else if (isOpen && initialParams?.moldId) {
      const mold = molds.find(m => 
        m.id === initialParams.moldId || 
        m.name.toLowerCase() === String(initialParams.moldId).toLowerCase()
      );
      if (mold) {
        // Auto-select supplier if mold has one
        if (mold.metadata?.supplierId) {
          setSupplierId(mold.metadata.supplierId);
        } else {
          setSupplierId('');
        }
        
        const initialQuantities = initialParams.initialGrid || {};
        const unitCost = mold.metadata?.unitCost || 0;

        const newItem: SolePurchaseItem = {
          moldId: mold.id,
          moldName: mold.name,
          colorId: initialParams.colorId || '',
          colorName: '',
          quantities: initialQuantities,
          unitCost: unitCost,
          totalCost: Object.values(initialQuantities).reduce((a: number, b: any) => a + (Number(b) || 0), 0) * unitCost
        };

        setItems([newItem]);
        setNotes(initialParams.description || '');
      }
    } else if (isOpen && !initialParams) {
      // Manual open - reset form if it was closed
      setItems([]);
      setSupplierId('');
      setNotes('');
    }
  }, [isOpen, initialParams, molds, colors]);

  const addItem = (moldId: string, colorId?: string, quantities?: Record<string, number>) => {
    const mold = molds.find(m => m.id === moldId);
    if (!mold) return;

    const initialQuantities = quantities || {};
    const unitCost = mold.metadata?.unitCost || 0;

    const newItem: SolePurchaseItem = {
      moldId: mold.id,
      moldName: mold.name,
      colorId: colorId || '',
      colorName: colorId ? (colors.find((c: ColorValue) => c.id === colorId)?.name || '') : '',
      quantities: initialQuantities,
      unitCost: Number(unitCost) || 0,
      totalCost: Object.values(initialQuantities).reduce((a: number, b: any) => a + (Number(b) || 0), 0) * (Number(unitCost) || 0)
    };

    setItems(prev => [...prev, newItem]);
  };


  const updateItem = (index: number, updates: Partial<SolePurchaseItem>) => {
    setItems(prev => {
      const newItems = [...prev];
      const newItem = { ...newItems[index], ...updates };
      
      const totalPairs = Object.values(newItem.quantities || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
      newItem.totalPairs = totalPairs;
      newItem.totalCost = totalPairs * parseLocaleNumber(newItem.unitCost);
      
      newItems[index] = newItem;
      return newItems;
    });
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalGeral = useMemo(() => items.reduce((sum, item) => sum + (parseLocaleNumber(item.totalCost) || 0), 0), [items]);

  const handleSave = async () => {
    if (!supplierId) {
      toast.show('Selecione um fornecedor');
      return;
    }
    if (items.length === 0) {
      toast.show('Adicione pelo menos um item');
      return;
    }

    setIsSaving(true);
    try {
      const supplier = suppliers.find(s => s.id === supplierId);
      const buyer = buyers.find(b => b.id === buyerId);
      
      const purchase: Purchase = {
        id: '', 
        batchNumber: batchNumber,
        supplierId: supplierId,
        sellerId: buyerId || undefined,
        sellerName: buyer?.name,
        date: Date.now(),
        dueDate: dueDate ? new Date(dueDate).getTime() : Date.now(),
        type: PurchaseType.REPLENISHMENT,
        items: [],
        total: totalGeral,
        paymentTerm: paymentTerm,
        paymentStatus: paymentTerm === PaymentTerm.CASH ? PaymentStatus.PAID : PaymentStatus.PENDING,
        accountId: accountId,
        categoryId: categoryId,
        notes: notes,
        generateTransaction: isAccounting,
        registerAsReceived: registerAsReceived
      };

      await onSave(purchase, items);
      onClose();
    } catch (err) {
      console.error(err);
      toast.show('Erro ao salvar: ' + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300 ${
        isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
      } force-scrollbar`}>
        
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-inherit rounded-t-[2.5rem]">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">Lançamento de Compra</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Entrada de Solados e Financeiro</p>
          </div>
          <button 
            onClick={onClose}
            title="Fechar Modal"
            aria-label="Fechar Modal"
            className={`p-3 rounded-2xl transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Section: Financial Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fornecedor */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ShoppingCart size={12} /> Fornecedor Selecionado
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                title="Selecionar Fornecedor"
                className={`w-full px-5 py-4 rounded-2xl text-xs font-black border-2 outline-none transition-all ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 focus:border-indigo-600'
                }`}
              >
                <option value="">Selecione o Fornecedor</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Comprador */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Users size={12} /> Comprador / Responsável
              </label>
              <select
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                title="Selecionar Comprador"
                className={`w-full px-5 py-4 rounded-2xl text-xs font-black border-2 outline-none transition-all ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 focus:border-indigo-600'
                }`}
              >
                <option value="">Selecione o Responsável</option>
                {buyers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {/* Lançamento Financeiro Toggle */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CreditCard size={12} /> Lançamento Financeiro
              </label>
              <div className={`flex p-1 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <button
                  onClick={() => setIsAccounting(true)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    isAccounting ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'
                  }`}
                >
                  Contábil
                </button>
                <button
                  onClick={() => setIsAccounting(false)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    !isAccounting ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'
                  }`}
                >
                  Não Contábil
                </button>
              </div>
            </div>

            {/* Identificação / Lote */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Hash size={12} /> Identificação da Compra
                </label>
                <button 
                  onClick={() => setIsAutoBatch(!isAutoBatch)}
                  className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${isAutoBatch ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}
                >
                  Auto: {isAutoBatch ? 'On' : 'Off'}
                </button>
              </div>
              <input
                type="text"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                disabled={isAutoBatch}
                title="Número do Lote"
                placeholder="Ex: LOT-12345"
                className={`w-full px-5 py-4 rounded-2xl text-xs font-black border-2 outline-none transition-all ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 focus:border-indigo-600'
                } ${isAutoBatch ? 'opacity-50' : ''}`}
              />
            </div>

            {/* Vencimento */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CalendarIcon size={12} /> Data de Vencimento
              </label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                className={`w-full px-5 py-4 rounded-2xl text-xs font-black border-2 outline-none transition-all ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 focus:border-indigo-600'
                }`}
              />
            </div>

            {/* Pagamento Switch */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <DollarSign size={12} /> Pagamento
              </label>
              <div className={`flex p-1 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <button
                  onClick={() => setPaymentTerm(PaymentTerm.CASH)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    paymentTerm === PaymentTerm.CASH ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400'
                  }`}
                >
                  À Vista
                </button>
                <button
                  onClick={() => setPaymentTerm(PaymentTerm.INSTALLMENTS)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    paymentTerm === PaymentTerm.INSTALLMENTS ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'
                  }`}
                >
                  A Prazo
                </button>
              </div>
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria Financeira</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                title="Selecionar Categoria Financeira"
                className={`w-full px-5 py-4 rounded-2xl text-xs font-black border-2 outline-none transition-all ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 focus:border-indigo-600'
                }`}
              >
                <option value="">SELECIONAR CATEGORIA...</option>
                {purchaseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Conta */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conta para Pagamento</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                title="Selecionar Conta"
                className={`w-full px-5 py-4 rounded-2xl text-xs font-black border-2 outline-none transition-all ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 focus:border-indigo-600'
                }`}
              >
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {/* Section: Sole Breakdown */}
          <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Package size={14} /> Itens / Grade de Solados
              </h3>
              <button
                onClick={() => {
                  const firstMold = molds[0];
                  if (firstMold) addItem(firstMold.id);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2"
              >
                <Plus size={14} /> Adicionar Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => {
                const mold = molds.find(m => m.id === item.moldId);
                const sizes = mold?.metadata?.sizes || [];
                const totalPairs = Object.values(item.quantities || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
                const moldVariations: any[] = Array.isArray(mold?.metadata?.colorVariations)
                  ? mold!.metadata!.colorVariations
                  : [];
                // Build color options: prefer mold's colorVariations, fall back to global colors
                const moldColorOptions: { id: string; label: string }[] = moldVariations.length > 0
                  ? moldVariations.map((cv: any) => ({
                      id: String(cv?.colorId || cv?.id || ''),
                      label: String(cv?.colorName || cv?.name || cv?.subRef || cv?.colorId || cv?.id || '')
                    })).filter(c => c.id)
                  : colorOptions.map((c: ColorValue) => ({ id: c.id, label: c.name }));

                return (
                  <div key={index} className={`p-6 rounded-[2rem] border-2 transition-all ${
                    isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <div className="flex flex-col gap-3 mb-4">
                      {/* Linha 1: Nome do Solado + botão remover */}
                      <div className="flex items-end gap-3">
                        <div className="flex-1 space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Solado</label>
                          <select
                            value={item.moldId}
                            onChange={(e) => {
                              const m = molds.find(mod => mod.id === e.target.value);
                              updateItem(index, { moldId: e.target.value, moldName: m?.name || '' });
                            }}
                            title="Selecionar Matriz"
                            className={`w-full px-4 py-3 rounded-xl text-xs font-black border-2 outline-none ${
                              isDarkMode ? 'bg-slate-900 border-slate-800 focus:border-cyan-500' : 'bg-white border-slate-200 focus:border-cyan-600'
                            }`}
                          >
                            {molds.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </div>
                        <button
                          onClick={() => removeItem(index)}
                          title="Remover Item"
                          aria-label="Remover Item"
                          className="mb-0.5 p-3 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      {/* Linha 2: Cor */}
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor</label>
                        <div className="flex items-center gap-2">
                          <Palette size={14} className="text-violet-500 shrink-0" />
                          <select
                            value={item.colorId}
                            onChange={(e) => {
                              const found = moldColorOptions.find(c => c.id === e.target.value);
                              updateItem(index, { colorId: e.target.value, colorName: found?.label || e.target.value });
                            }}
                            title="Selecionar Cor"
                            className={`flex-1 px-4 py-3 rounded-xl text-xs font-black border-2 outline-none ${
                              isDarkMode ? 'bg-slate-900 border-slate-800 focus:border-cyan-500' : 'bg-white border-slate-200 focus:border-cyan-600'
                            }`}
                          >
                            <option value="">SELECIONAR COR...</option>
                            {moldColorOptions.map((c, i) => (
                              <option key={`${c.id}-${i}`} value={c.id}>{c.label || c.id}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4">
                      {sizes.map(size => (
                        <div key={size} className="flex flex-col gap-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase text-center">{size}</label>
                          <input
                            type="number"
                            value={item.quantities[size] || ''}
                            onChange={(e) => updateItem(index, { 
                              quantities: { ...item.quantities, [size]: parseInt(e.target.value) || 0 } 
                            })}
                            className={`w-full px-1 py-2 rounded-lg text-[11px] font-black text-center border-2 outline-none ${
                              isDarkMode ? 'bg-slate-900 border-slate-800 focus:border-indigo-500' : 'bg-white border-slate-200 focus:border-indigo-600'
                            }`}
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-4">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Custo Un. (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.unitCost}
                            onChange={(e) => updateItem(index, { unitCost: parseFloat(e.target.value) || 0 })}
                            title="Custo Unitário"
                            placeholder="0,00"
                            className={`w-24 px-3 py-2 rounded-xl text-xs font-black border-2 outline-none ${
                              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                            }`}
                          />
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total do Item</p>
                          <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">R$ {item.totalCost.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="bg-slate-200 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{totalPairs} pares</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Summary and Notes */}
          <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-6 rounded-3xl border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Geral da Compra</p>
                <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">R$ {totalGeral.toFixed(2)}</p>
              </div>
              <div className={`p-6 rounded-3xl border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Observações Internas</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas adicionais..."
                  className={`w-full h-12 bg-transparent text-xs font-black outline-none resize-none`}
                />
              </div>
            </div>

            {/* Toggle: Registrar como Recebido na Solicitação */}
            {initialParams?.requestId && (
              <div className={`flex items-center justify-between p-5 rounded-[2rem] border-2 transition-all ${
                registerAsReceived
                  ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${registerAsReceived ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                    <Package size={16} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Registrar como Recebido</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Atualizar solicitação de compra</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={registerAsReceived}
                    onChange={(e) => setRegisterAsReceived(e.target.checked)}
                    aria-label="Registrar como recebido na solicitação"
                  />
                  <div className="w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500 border-2 border-transparent"></div>
                </label>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={isSaving || items.length === 0}
              className={`w-full py-5 rounded-[2rem] text-sm font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 ${
                isSaving || items.length === 0
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white shadow-indigo-500/20 hover:bg-indigo-700 active:scale-[0.99]'
              }`}
            >
              {isSaving ? (
                <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  Confirmar e Movimentar Estoque
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

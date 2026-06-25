import React, { useState, useMemo, useEffect } from 'react';
import {
  X, Save, ShoppingCart, Users, CreditCard,
  Calendar as CalendarIcon, Hash, Package, Palette,
  Trash2, Plus, DollarSign, CheckCircle2
} from 'lucide-react';
import {
  Person, Category, Account, ProductionConfigItem,
  ColorValue, Purchase, PurchaseType, PaymentTerm,
  PaymentStatus, PalmilhaPurchaseItem, TransactionType
} from '../types';
import { format } from 'date-fns';
import { toast } from '../utils/toast';
import DatePicker from './DatePicker';
import { parseLocaleNumber } from '../utils/numbers';

interface PalmilhaPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (purchase: Purchase, palmilhaItems: PalmilhaPurchaseItem[]) => Promise<void>;
  suppliers: Person[];
  people: Person[]; // For representative (buyers)
  categories: Category[];
  accounts: Account[];
  productionConfigs: ProductionConfigItem[];
  colors: ColorValue[];
  isDarkMode: boolean;
  initialParams?: {
    toolId?: string;
    colorId?: string;
    initialGrid?: Record<string, number>;
    items?: { toolId: string; toolName?: string; subtype?: 'MONTAGEM' | 'ACABAMENTO'; colorId?: string; colorName?: string; initialGrid?: Record<string, number> }[];
    description?: string;
    requestId?: string;
  };
}

export default function PalmilhaPurchaseModal({
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
}: PalmilhaPurchaseModalProps) {
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

  // Palmilha Items State
  const [items, setItems] = useState<PalmilhaPurchaseItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [registerAsReceived, setRegisterAsReceived] = useState(false);

  const palmilhaTools = useMemo(() => productionConfigs.filter(c => c.type === 'TOOL' && !!c.metadata?.palmilha), [productionConfigs]);
  const buyers = useMemo(() => people.filter(p => p.isBuyer || p.isPersonal), [people]);
  const purchaseCategories = useMemo(() => categories.filter(c => c.type === 'EXPENSE'), [categories]);

  // Set initial category (Palmilhas)
  useEffect(() => {
    const palmilhaCat = categories.find(c => c.name.toLowerCase().includes('palmilha'));
    if (palmilhaCat) setCategoryId(palmilhaCat.id);

    if (accounts.length > 0) {
      const defAcc = accounts.find(a => a.isDefault) || accounts[0];
      setAccountId(defAcc.id);
    }
  }, [categories, accounts]);

  // Pre-fill from initialParams
  useEffect(() => {
    if (isOpen && initialParams?.items && initialParams.items.length > 0) {
      const newItems: PalmilhaPurchaseItem[] = [];
      let firstSupplierId = '';
      initialParams.items.forEach(p => {
        const tool = palmilhaTools.find(t =>
          t.id === p.toolId ||
          t.name.toLowerCase() === String(p.toolId).toLowerCase()
        );
        if (!tool) return;
        if (!firstSupplierId && tool.metadata?.supplierId) firstSupplierId = tool.metadata.supplierId;
        const initialQuantities = p.initialGrid || {};
        const unitCost = tool.metadata?.unitCost || 0;
        const colorVariation = (tool.metadata?.palmilha?.colorVariations || []).find(cv => cv.colorId === p.colorId);
        newItems.push({
          toolId: tool.id,
          toolName: tool.name,
          subtype: tool.metadata?.palmilha?.subtype || 'MONTAGEM',
          colorId: p.colorId || '',
          colorName: colorVariation?.colorName || (p.colorId ? (colors.find(c => c.id === p.colorId)?.name || '') : ''),
          quantities: initialQuantities,
          unitCost,
          totalCost: Object.values(initialQuantities).reduce((a: number, b: any) => a + (Number(b) || 0), 0) * unitCost
        });
      });
      setItems(newItems);
      setSupplierId(firstSupplierId);
      setNotes(initialParams.description || '');
    } else if (isOpen && initialParams?.toolId) {
      const tool = palmilhaTools.find(t =>
        t.id === initialParams.toolId ||
        t.name.toLowerCase() === String(initialParams.toolId).toLowerCase()
      );
      if (tool) {
        if (tool.metadata?.supplierId) {
          setSupplierId(tool.metadata.supplierId);
        } else {
          setSupplierId('');
        }

        const initialQuantities = initialParams.initialGrid || {};
        const unitCost = tool.metadata?.unitCost || 0;
        const colorVariation = (tool.metadata?.palmilha?.colorVariations || []).find(cv => cv.colorId === initialParams.colorId);

        const newItem: PalmilhaPurchaseItem = {
          toolId: tool.id,
          toolName: tool.name,
          subtype: tool.metadata?.palmilha?.subtype || 'MONTAGEM',
          colorId: initialParams.colorId || '',
          colorName: colorVariation?.colorName || '',
          quantities: initialQuantities,
          unitCost,
          totalCost: Object.values(initialQuantities).reduce((a: number, b: any) => a + (Number(b) || 0), 0) * unitCost
        };

        setItems([newItem]);
        setNotes(initialParams.description || '');
      }
    } else if (isOpen && !initialParams) {
      setItems([]);
      setSupplierId('');
      setNotes('');
    }
  }, [isOpen, initialParams, palmilhaTools, colors]);

  const addItem = () => {
    const firstTool = palmilhaTools[0];
    if (!firstTool) return;
    const unitCost = firstTool.metadata?.unitCost || 0;

    const newItem: PalmilhaPurchaseItem = {
      toolId: firstTool.id,
      toolName: firstTool.name,
      subtype: firstTool.metadata?.palmilha?.subtype || 'MONTAGEM',
      colorId: '',
      colorName: '',
      quantities: {},
      unitCost: Number(unitCost) || 0,
      totalCost: 0
    };

    setItems(prev => [...prev, newItem]);
  };

  const updateItem = (index: number, updates: Partial<PalmilhaPurchaseItem>) => {
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
      const buyer = buyers.find(b => b.id === buyerId);

      const purchase: Purchase = {
        id: '',
        batchNumber: batchNumber,
        supplierId: supplierId,
        sellerId: buyerId || undefined,
        sellerName: buyer?.name,
        date: Date.now(),
        dueDate: dueDate ? new Date(dueDate).getTime() : Date.now(),
        type: PurchaseType.PALMILHA,
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
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Entrada de Palmilhas e Financeiro</p>
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
                  isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-rose-500' : 'bg-slate-50 border-slate-100 focus:border-rose-600'
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
                  isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-rose-500' : 'bg-slate-50 border-slate-100 focus:border-rose-600'
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
                    isAccounting ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400'
                  }`}
                >
                  Contábil
                </button>
                <button
                  onClick={() => setIsAccounting(false)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    !isAccounting ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400'
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
                  className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${isAutoBatch ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}
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
                  isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-rose-500' : 'bg-slate-50 border-slate-100 focus:border-rose-600'
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
                  isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-rose-500' : 'bg-slate-50 border-slate-100 focus:border-rose-600'
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
                    paymentTerm === PaymentTerm.INSTALLMENTS ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400'
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
                  isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-rose-500' : 'bg-slate-50 border-slate-100 focus:border-rose-600'
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
                  isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-rose-500' : 'bg-slate-50 border-slate-100 focus:border-rose-600'
                }`}
              >
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {/* Section: Palmilha Breakdown */}
          <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Package size={14} /> Itens / Grade de Palmilhas
              </h3>
              <button
                onClick={addItem}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center gap-2"
              >
                <Plus size={14} /> Adicionar Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => {
                const tool = palmilhaTools.find(t => t.id === item.toolId);
                const sizes = tool?.metadata?.sizes || [];
                const totalPairs = Object.values(item.quantities || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
                const toolColorOptions = tool?.metadata?.palmilha?.colorVariations || [];

                return (
                  <div key={index} className={`p-6 rounded-[2rem] border-2 transition-all ${
                    isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <div className="flex flex-col gap-3 mb-4">
                      {/* Linha 1: Nome da Palmilha + botão remover */}
                      <div className="flex items-end gap-3">
                        <div className="flex-1 space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Palmilha (Faca)</label>
                          <select
                            value={item.toolId}
                            onChange={(e) => {
                              const t = palmilhaTools.find(tl => tl.id === e.target.value);
                              updateItem(index, {
                                toolId: e.target.value,
                                toolName: t?.name || '',
                                subtype: t?.metadata?.palmilha?.subtype || 'MONTAGEM',
                                colorId: '',
                                colorName: ''
                              });
                            }}
                            title="Selecionar Palmilha"
                            className={`w-full px-4 py-3 rounded-xl text-xs font-black border-2 outline-none ${
                              isDarkMode ? 'bg-slate-900 border-slate-800 focus:border-rose-500' : 'bg-white border-slate-200 focus:border-rose-600'
                            }`}
                          >
                            {palmilhaTools.map(t => (
                              <option key={t.id} value={t.id}>{t.name} ({t.metadata?.palmilha?.subtype === 'MONTAGEM' ? 'Montagem' : 'Acabamento'})</option>
                            ))}
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
                              const found = toolColorOptions.find(c => c.colorId === e.target.value);
                              updateItem(index, { colorId: e.target.value, colorName: found?.colorName || e.target.value });
                            }}
                            title="Selecionar Cor"
                            className={`flex-1 px-4 py-3 rounded-xl text-xs font-black border-2 outline-none ${
                              isDarkMode ? 'bg-slate-900 border-slate-800 focus:border-rose-500' : 'bg-white border-slate-200 focus:border-rose-600'
                            }`}
                          >
                            <option value="">SELECIONAR COR...</option>
                            {toolColorOptions.map((c, i) => (
                              <option key={`${c.colorId}-${i}`} value={c.colorId}>{c.colorName || c.colorId}</option>
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
                              isDarkMode ? 'bg-slate-900 border-slate-800 focus:border-rose-500' : 'bg-white border-slate-200 focus:border-rose-600'
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
                          <p className="text-sm font-black text-rose-600 dark:text-rose-400">R$ {item.totalCost.toFixed(2)}</p>
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
                <p className="text-3xl font-black text-rose-600 dark:text-rose-400">R$ {totalGeral.toFixed(2)}</p>
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
                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${registerAsReceived ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
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
                  <div className="w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600 dark:peer-checked:bg-rose-500 border-2 border-transparent"></div>
                </label>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={isSaving || items.length === 0}
              className={`w-full py-5 rounded-[2rem] text-sm font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 ${
                isSaving || items.length === 0
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-rose-600 text-white shadow-rose-500/20 hover:bg-rose-700 active:scale-[0.99]'
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

import { useState, useMemo } from "react";
import {
  Purchase,
  Product,
  Person,
  PurchaseType,
  PurchaseItem,
  CompanyCheck,
  PaymentTerm,
  Category,
  Account,
  GeneralPurchaseItem,
  ProductStatus,
  SaleType,
  Grid,
  PaymentStatus,
} from "../types";
import {
  Save,
  Plus,
  Trash2,
  Package,
  ShoppingCart,
  Info,
  Calendar as CalendarIcon,
  CreditCard,
  Calculator,
  ChevronDown,
  ChevronUp,
  Minus,
  Search,
  X,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import CalculatorModal from '../components/CalculatorModal';
import ComboBox from "../components/ComboBox";

interface PurchaseFormViewProps {
  purchaseId: string | null;
  purchases: Purchase[];
  products: Product[];
  suppliers: Person[];
  categories: Category[];
  accounts: Account[];
  grids: Grid[];
  onSave: (purchase: Purchase) => void;
  onCancel: () => void;
  isDarkMode: boolean;
}

export default function PurchaseFormView({
  purchaseId,
  purchases,
  products,
  suppliers,
  categories,
  accounts,
  grids,
  onSave,
  onCancel,
  isDarkMode,
}: PurchaseFormViewProps) {
  const existing = purchaseId
    ? purchases.find((p) => p.id === purchaseId)
    : null;

  const [type, setType] = useState<PurchaseType>(
    existing?.type || PurchaseType.GENERAL,
  );
  const [supplierId, setSupplierId] = useState(
    existing?.supplierId || suppliers[0]?.id || "",
  );
  interface PurchaseBlock {
    id: string;
    productId: string;
    isBox: boolean;
    cost: number;
    note?: string;
    variations: Record<string, { quantity: number; size?: string }>;
  }

  const [blocks, setBlocks] = useState<PurchaseBlock[]>(() => {
    if (!existing?.items || existing.items.length === 0) return [];
    const b: Record<string, PurchaseBlock> = {};
    existing.items.forEach((item) => {
      const key = `${item.productId}-${item.isBox}-${item.cost}`;
      if (!b[key]) {
        b[key] = {
          id: Math.random().toString(36).substr(2, 9),
          productId: item.productId,
          isBox: item.isBox,
          cost: item.cost,
          variations: {},
        };
      }
      if (!b[key].variations[item.variationId]) {
        b[key].variations[item.variationId] = { quantity: 0, size: "" };
      }
      b[key].variations[item.variationId].quantity += item.quantity;
      b[key].variations[item.variationId].size =
        item.size || b[key].variations[item.variationId].size;
    });
    return Object.values(b);
  });
  
  const [expandedBlocks, setExpandedBlocks] = useState<string[]>([]);
  
  const [generalItems, setGeneralItems] = useState<GeneralPurchaseItem[]>(
    existing?.generalItems || [],
  );
  const [notes, setNotes] = useState(existing?.notes || "");
  const [batchNumber, setBatchNumber] = useState(
    existing?.batchNumber ||
      `LOT-${Date.now().toString().slice(-5).toUpperCase()}`,
  );
  const [isAutoBatchNumber, setIsAutoBatchNumber] = useState(!existing?.batchNumber);
  const [dueDate, setDueDate] = useState<number>(
    existing?.dueDate || Date.now(),
  );
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm>(
    existing?.paymentTerm || PaymentTerm.CASH,
  );
  const [checks, setChecks] = useState<CompanyCheck[]>(existing?.checks || []);
  const [categoryId, setCategoryId] = useState(
    existing?.categoryId || categories[0]?.id || "",
  );
  const [accountId, setAccountId] = useState(
    existing?.accountId || accounts[0]?.id || "",
  );
  const [generateTransaction, setGenerateTransaction] = useState(
    existing?.generateTransaction !== undefined ? existing?.generateTransaction : true
  );

  const activeProducts = useMemo(
    () =>
      products.filter((p) => {
        const isActive = !p.status || p.status === ProductStatus.ACTIVE;
        const matchesSupplier = !p.supplierId || p.supplierId === supplierId;
        return isActive && matchesSupplier;
      }),
    [products, supplierId],
  );

  // Calculator Modal State
  const [calcModal, setCalcModal] = useState<{ isOpen: boolean; field: 'blocks' | 'generalItems'; index: number; value: number } | null>(null);

  const [showChecks, setShowChecks] = useState<boolean>(
    existing?.checks && existing.checks.length > 0 ? true : false,
  );
  const [showNotes, setShowNotes] = useState<boolean>(
    existing?.notes ? true : false,
  );

  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");

  const supplierName = useMemo(() => {
    return suppliers.find((s) => s.id === supplierId)?.name || "";
  }, [suppliers, supplierId]);

  const total = useMemo(() => {
    if (type === PurchaseType.GENERAL) {
      return generalItems.reduce((acc, item) => acc + item.value, 0);
    }
    return blocks.reduce((acc, block) => {
      const qtySum = Object.values(block.variations).reduce((sum: number, v: any) => sum + Number(v.quantity || 0), 0) as number;
      return acc + block.cost * qtySum;
    }, 0);
  }, [blocks, type, generalItems]);

  const addBlock = (pId: string) => {
    const p = products.find(prod => prod.id === pId);
    if (!p) return;
    
    const newId = Math.random().toString(36).substr(2, 9);
    setBlocks([
      ...blocks,
      {
        id: newId,
        productId: p.id,
        isBox: type === PurchaseType.REPLENISHMENT,
        cost: p.costPrice || 0,
        variations: {},
      },
    ]);
    setExpandedBlocks([...expandedBlocks, newId]);
    setShowProductModal(false);
    setProductSearchQuery("");
  };

  const updateBlock = (index: number, updates: Partial<PurchaseBlock>) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates };
    setBlocks(newBlocks);
  };

  const toggleBlockExpanded = (blockId: string) => {
    if (expandedBlocks.includes(blockId)) {
      setExpandedBlocks(expandedBlocks.filter(id => id !== blockId));
    } else {
      setExpandedBlocks([...expandedBlocks, blockId]);
    }
  };

  const updateVariation = (blockIndex: number, variationId: string, quantity: number, size: string = "") => {
    const newBlocks = [...blocks];
    const block = newBlocks[blockIndex];
    const current = block.variations[variationId] || { quantity: 0, size: "" };
    block.variations = {
      ...block.variations,
      [variationId]: { ...current, quantity: Math.max(0, quantity), size },
    };
    setBlocks(newBlocks);
  };

  const removeBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  const addCheck = () => {
    setChecks([
      ...checks,
      {
        id: Math.random().toString(36).substr(2, 9),
        number: "",
        value: 0,
        dueDate: Date.now(),
        status: "PENDING",
      },
    ]);
  };

  const updateCheck = (index: number, updates: Partial<CompanyCheck>) => {
    const newChecks = [...checks];
    newChecks[index] = { ...newChecks[index], ...updates };
    setChecks(newChecks);
  };

  const addGeneralItem = () => {
    setGeneralItems([
      ...generalItems,
      {
        id: Math.random().toString(36).substr(2, 9),
        description: "",
        value: 0,
      },
    ]);
  };

  const removeGeneralItem = (index: number) => {
    setGeneralItems(generalItems.filter((_, i) => i !== index));
  };

  const updateGeneralItem = (
    index: number,
    updates: Partial<GeneralPurchaseItem>,
  ) => {
    const newItems = [...generalItems];
    newItems[index] = { ...newItems[index], ...updates };
    setGeneralItems(newItems);
  };

  const handleSave = () => {
    const finalItems: PurchaseItem[] = [];
    if (type === PurchaseType.REPLENISHMENT) {
      blocks.forEach((b) => {
        Object.entries(b.variations).forEach(([varId, data]) => {
          const typedData = data as { quantity: number; size?: string };
          if (typedData.quantity > 0) {
            finalItems.push({
              productId: b.productId,
              variationId: varId,
              quantity: typedData.quantity,
              size: typedData.size,
              isBox: b.isBox,
              cost: b.cost,
            });
          }
        });
      });
      if (finalItems.length === 0) {
        alert("Adicione pelo menos um item para compra de estoque.");
        return;
      }
    } else {
      if (generalItems.length === 0) {
        alert("Adicione pelo menos um item para a compra geral.");
        return;
      }
    }

    onSave({
      id: purchaseId || Math.random().toString(36).substr(2, 9),
      supplierId,
      date: existing?.date || Date.now(),
      dueDate,
      paymentTerm,
      type,
      items: finalItems,
      generalItems: type === PurchaseType.GENERAL ? generalItems : [],
      categoryId,
      accountId,
      total,
      notes,
      batchNumber,
      checks,
      generateTransaction,
      paymentStatus: paymentTerm === PaymentTerm.INSTALLMENTS ? PaymentStatus.PENDING : PaymentStatus.PAID,
    });
  };

  const openCalculator = (index: number, type: 'blocks' | 'generalItems') => {
    let value = 0;
    if(type === 'generalItems') {
      value = generalItems[index].value || 0;
    } else {
      value = blocks[index].cost || 0;
    }
    setCalcModal({ isOpen: true, field: type, index, value });
  };

  return (
    <div className="flex flex-col gap-6 pb-32 px-1 relative">
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl ${isDarkMode ? "bg-amber-500 shadow-none text-white" : "bg-amber-100 shadow-amber-50 text-amber-600"}`}
        >
          <ShoppingCart size={22} strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">
            Registrar Entrada
          </h2>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
            Gestão de Estoque
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <div
        className={`p-6 rounded-[2rem] border flex flex-col gap-5 shadow-sm relative overflow-hidden ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
      >
        <div className="flex bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700">
          <button
            onClick={() => setType(PurchaseType.REPLENISHMENT)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === PurchaseType.REPLENISHMENT ? "bg-white dark:bg-slate-700 shadow-lg text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`}
            aria-label="Tipo de compra estoque"
            title="Estoque"
          >
            <Package size={14} strokeWidth={2.5} className={type === PurchaseType.REPLENISHMENT ? "text-indigo-500" : ""} /> Estoque
          </button>
          <button
            onClick={() => setType(PurchaseType.GENERAL)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === PurchaseType.GENERAL ? "bg-white dark:bg-slate-700 shadow-lg text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"}`}
            aria-label="Tipo de compra geral"
            title="Geral"
          >
            <ShoppingCart size={14} strokeWidth={2.5} className={type === PurchaseType.GENERAL ? "text-amber-500" : ""} /> Geral
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="relative col-span-2">
            <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest leading-none">
              Fornecedor Selecionado
            </label>
            <ComboBox 
              options={suppliers.map(s => ({ id: s.id, name: s.name }))}
              value={supplierId}
              onChange={setSupplierId}
              placeholder="SELECIONE O FORNECEDOR"
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="relative col-span-2">
            <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest leading-none">
              Lançamento Financeiro
            </label>
            <div className={`p-1.5 rounded-2xl border flex items-center gap-2 transition-all ${generateTransaction ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900/50' : 'bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
              <button
                type="button"
                onClick={() => setGenerateTransaction(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${generateTransaction ? "bg-white dark:bg-slate-700 shadow-lg text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`}
                aria-label="Gerar transação contábil"
                title="Contábil"
              >
                <div className={`w-2 h-2 rounded-full ${generateTransaction ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`} />
                Contábil
              </button>
              <button
                type="button"
                onClick={() => setGenerateTransaction(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!generateTransaction ? "bg-white dark:bg-slate-700 shadow-lg text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}
                aria-label="Não gerar transação contábil"
                title="Não Contábil"
              >
                <div className={`w-2 h-2 rounded-full ${!generateTransaction ? 'bg-rose-500' : 'bg-slate-300'}`} />
                Não Contábil
              </button>
            </div>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-2 px-3">
              {generateTransaction ? "*GERARÁ UM TÍTULO NO FINANCEIRO PARA PAGAMENTO" : "*NÃO SERÁ TRACKEADO NO FLUXO DE CONTAS A PAGAR"}
            </p>
          </div>

          <div className="relative col-span-2">
            <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest leading-none">
              Identificação da Compra/Lote
            </label>
            <div className="flex items-center gap-3 mb-2 px-3">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input 
                    type="checkbox"
                    className="sr-only"
                    checked={isAutoBatchNumber}
                    aria-label="Gerar lote automático"
                    onChange={() => {
                      const newAuto = !isAutoBatchNumber;
                      setIsAutoBatchNumber(newAuto);
                      if (newAuto) {
                        setBatchNumber(`LOT-${Date.now().toString().slice(-5).toUpperCase()}`);
                      } else {
                        setBatchNumber('');
                      }
                    }}
                  />
                  <div className={`w-8 h-4 rounded-full transition-colors ${isAutoBatchNumber ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow-sm ${isAutoBatchNumber ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${isAutoBatchNumber ? 'text-indigo-500' : 'text-slate-400'}`}>
                  Auto
                </span>
              </label>
            </div>
            <div className="relative">
              <input
                type="text"
                className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4 text-[12px] font-black uppercase tracking-widest focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-indigo-500/10 transition-all ${isAutoBatchNumber ? 'text-slate-400' : 'text-indigo-500 dark:text-indigo-400'}`}
                value={batchNumber}
                onChange={(e) => {
                  setBatchNumber(e.target.value);
                  setIsAutoBatchNumber(false);
                }}
                placeholder="Ex: Nota Fiscal 1234"
                disabled={isAutoBatchNumber}
                aria-label="Número do lote"
                title="Número do Lote"
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                <Info size={14} className="text-cyan-400" />
              </div>
            </div>
          </div>

          <div className="relative col-span-2">
            <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest leading-none">
              Data de Vencimento
            </label>
            <div className="relative">
              <input
                type="date"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4 text-[12px] font-black uppercase tracking-widest focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-indigo-500/10 transition-all text-slate-900 dark:text-slate-100"
                value={format(dueDate, "yyyy-MM-dd")}
                onChange={(e) =>
                  setDueDate(new Date(e.target.value).getTime() || Date.now())
                }
                aria-label="Data de vencimento"
                title="Vencimento"
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                <CalendarIcon size={14} className="text-amber-400" />
              </div>
            </div>
          </div>

          <div className="relative col-span-2">
            <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest leading-none">
              Pagamento
            </label>
            <div className="flex bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setPaymentTerm(PaymentTerm.CASH)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentTerm === PaymentTerm.CASH ? "bg-white dark:bg-slate-700 shadow-lg text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}
                aria-label="Pagamento à vista"
                title="À Vista"
              >
                À Vista
              </button>
              <button
                onClick={() => setPaymentTerm(PaymentTerm.INSTALLMENTS)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentTerm === PaymentTerm.INSTALLMENTS ? "bg-white dark:bg-slate-700 shadow-lg text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}
                aria-label="Pagamento a prazo"
                title="A Prazo"
              >
                A Prazo
              </button>
            </div>
          </div>
          <div className="relative col-span-2">
            <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest leading-none">
              Categoria Financeira
            </label>
            <ComboBox
              options={categories}
              value={categoryId}
              onChange={setCategoryId}
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="relative col-span-2">
            <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest leading-none">
              Conta para Pagamento
            </label>
            <div className="relative">
              <select
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4 text-[12px] font-black uppercase tracking-widest appearance-none focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-indigo-500/10 transition-all text-slate-900 dark:text-slate-100"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                aria-label="Conta para pagamento"
                title="Conta"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown size={14} className="text-indigo-400" strokeWidth={3} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {type === PurchaseType.GENERAL && (
        <section>
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 leading-none">
                Itens da Compra Geral
              </h3>
              <p className="text-[8px] text-slate-300 font-bold uppercase tracking-widest mt-1">
                Despesas Diversas
              </p>
            </div>
            <button
              onClick={addGeneralItem}
              className={`flex items-center gap-2 font-black text-[10px] uppercase tracking-widest bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl active:scale-95 transition-all ${isDarkMode ? "shadow-none" : "shadow-slate-200"}`}
              aria-label="Adicionar item geral"
              title="Adicionar Item"
            >
              <Plus size={14} strokeWidth={3} /> Adicionar
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {generalItems.map((item, index) => (
              <div
                key={item.id}
                className={`p-4 rounded-[2rem] border shadow-sm flex flex-col gap-3 relative group overflow-hidden ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
              >
                <div className="flex justify-between items-center gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Descrição do item"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3 text-[12px] font-black tracking-tight text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-indigo-500/10 placeholder:text-slate-300 dark:placeholder:text-slate-700"
                      value={item.description}
                      onChange={(e) =>
                        updateGeneralItem(index, {
                          description: e.target.value,
                        })
                      }
                      aria-label="Descrição do item"
                      title="Descrição"
                    />
                  </div>
                  <button
                    onClick={() => removeGeneralItem(index)}
                    className="p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors"
                    aria-label="Remover item"
                    title="Remover"
                  >
                    <Trash2 size={16} strokeWidth={2.5} />
                  </button>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-xs">
                      R$
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl pl-[2.4rem] pr-4 py-3 text-[14px] font-black text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-indigo-500/10 transition-all font-mono"
                      value={item.value || ""}
                      onChange={(e) =>
                        updateGeneralItem(index, {
                          value: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                      aria-label="Valor do item"
                      title="Valor"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      openCalculator(index, 'generalItems');
                    }}
                    className="w-[50px] shrink-0 flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl hover:bg-indigo-100 transition-colors"
                    aria-label="Abrir calculadora de valor"
                    title="Calculadora"
                  >
                    <Calculator size={18} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ))}

            {generalItems.length === 0 && (
              <div className="text-center py-12 bg-slate-50/30 dark:bg-slate-900/40 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem]">
                <p className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-700 tracking-[0.2em] italic">
                  Nenhum item adicionado
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Items List (only for Replenishment) */}
      {type === PurchaseType.REPLENISHMENT && (
        <section>
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 leading-none">
                Itens
              </h3>
              <p className="text-[8px] text-slate-300 font-bold uppercase tracking-widest mt-1">
                Adicione referências
              </p>
            </div>
            <button
              onClick={() => setShowProductModal(true)}
              className={`flex items-center gap-2 font-black text-[10px] uppercase tracking-widest bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl active:scale-95 transition-all ${isDarkMode ? "shadow-none" : "shadow-slate-200"}`}
              aria-label="Adicionar modelo"
              title="Adicionar Modelo"
            >
              <Plus size={14} strokeWidth={3} /> Modelo
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {blocks.map((block, index) => {
              const product = products.find((p) => p.id === block.productId);
              if (!product) return null;
              const isExpanded = expandedBlocks.includes(block.id);

              return (
                <div
                  key={block.id}
                  className={`rounded-[2.5rem] border shadow-sm flex flex-col relative overflow-hidden ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
                >
                  <div className="p-5 flex justify-between items-start gap-4">
                    <div className="flex gap-4 flex-1">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/30 shrink-0">
                        <Package size={24} className="text-indigo-500" />
                      </div>
                      <div className="flex flex-col justify-center flex-1 relative">
                        <select
                          className="bg-transparent border-none p-0 text-[13px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 focus:ring-0 w-full truncate cursor-pointer appearance-none pr-6"
                          value={block.productId}
                          onChange={(e) => {
                            const pId = e.target.value;
                            const p = activeProducts.find((prod) => prod.id === pId);
                            updateBlock(index, {
                              productId: pId,
                              cost: p?.costPrice || 0,
                              variations: {}
                            });
                          }}
                          aria-label="Selecionar produto"
                          title="Produto"
                        >
                          {activeProducts
                            .filter(p => p.id === block.productId || !blocks.some((b, i) => i !== index && b.productId === p.id))
                            .map((p) => (
                              <option
                                key={p.id}
                                value={p.id}
                                className="dark:bg-slate-900"
                              >
                                {p.name}
                              </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 mr-2">
                           <ChevronDown size={14} className="text-indigo-400" strokeWidth={3} />
                        </div>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-1">
                          REF: {product?.reference || "---"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleBlockExpanded(block.id)}
                        className="p-2 text-slate-300 dark:text-slate-600 hover:text-indigo-500 transition-colors transform active:scale-90"
                        aria-label="Expandir/Recolher item"
                        title="Ver detalhes"
                      >
                        {isExpanded ? <ChevronUp size={20} strokeWidth={2.5} /> : <ChevronDown size={20} strokeWidth={2.5} />}
                      </button>
                      <button
                        onClick={() => removeBlock(index)}
                        className="p-2 text-slate-200 dark:text-slate-700 hover:text-rose-500 transition-colors transform active:scale-90"
                        aria-label="Remover item da lista"
                        title="Remover"
                      >
                        <Trash2 size={18} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-5 pt-0 border-t border-slate-50 dark:border-slate-800 mt-2">
                       <div className="grid grid-cols-2 gap-3 mt-4 mb-5">
                          <div className="flex flex-col gap-2">
                            <label className="text-[8px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest px-1">
                              Unidade
                            </label>
                            <button
                              onClick={() => updateBlock(index, { isBox: !block.isBox })}
                              className={`text-[9px] font-black py-3 rounded-2xl border-2 uppercase tracking-widest transition-all ${block.isBox ? "bg-slate-900 dark:bg-amber-600 text-white border-slate-900 dark:border-amber-600 shadow-lg" : "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700"}`}
                              aria-label="Alternar unidade"
                              title="Unidade"
                            >
                              {product.type === SaleType.WHOLESALE ? (block.isBox ? "Grade Fechada" : "Avulso") : (block.isBox ? "Caixa (12 Prs)" : "Par Individual")}
                            </button>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            <label className="text-[8px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest px-1 text-right">
                              Custo
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                step="0.01"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl py-3 text-right pr-4 text-[13px] font-black text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-amber-500/10 transition-all"
                                value={block.cost}
                                onChange={(e) => updateBlock(index, { cost: parseFloat(e.target.value) || 0 })}
                                aria-label="Custo do item"
                                title="Custo"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  openCalculator(index, 'blocks');
                                }}
                                className="w-[45px] shrink-0 flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl hover:bg-indigo-100 transition-colors"
                                aria-label="Abrir calculadora de custo"
                                title="Calculadora"
                              >
                                <Calculator size={18} strokeWidth={2.5} />
                              </button>
                            </div>
                          </div>
                       </div>

                       <div className="flex flex-col gap-3">
                         <h4 className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-1 flex justify-between items-end">
                            <span>Variações</span>
                         </h4>
                         
                         {product.variations.map((v) => {
                            const variationState = block.variations[v.id] || { quantity: 0, size: "" };
                            const quantity = variationState.quantity;
                            const size = variationState.size;
                            
                            const variationKey = product.type === SaleType.RETAIL && size && !block.isBox ? size : 'WHOLESALE';
                            const stock = v.stock?.[variationKey] || 0;
                            const minStock = v.minStock || 0;
                            
                            let stockColor = "text-emerald-500"; // OK
                            if (stock <= 0) stockColor = "text-rose-500"; // Vazio
                            else if (stock <= minStock) stockColor = "text-amber-500"; // Perto do mínimo

                            return (
                              <div key={v.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                   <div className="flex flex-col">
                                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                        {v.colorName}
                                      </span>
                                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-0.5">
                                        Estoque: <span className={stockColor}>{stock}</span>
                                      </span>
                                   </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-2">
                                  {!block.isBox && product.type === SaleType.RETAIL && (
                                    <select
                                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-1 px-4 text-center text-[9px] font-black text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500/20 transition-all appearance-none outline-none"
                                      value={size}
                                      onChange={(e) => updateVariation(index, v.id, quantity, e.target.value)}
                                      aria-label={`Selecionar tamanho para ${v.colorName}`}
                                      title="Tamanho"
                                    >
                                      <option value="">TAM.</option>
                                      {grids.find(g => g.id === product.defaultGridId)?.sizes.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                    </select>
                                  )}
                                  
                                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm">
                                    <button
                                      type="button"
                                      onClick={() => updateVariation(index, v.id, Math.max(0, quantity - 1), size)}
                                      className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                                      aria-label="Diminuir quantidade"
                                      title="Diminuir"
                                    >
                                      <Minus size={14} strokeWidth={2.5} />
                                    </button>
                                    <span className="w-6 text-center font-black text-[11px] text-slate-800 dark:text-slate-100">
                                      {quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => updateVariation(index, v.id, quantity + 1, size)}
                                      className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 transition-colors"
                                      aria-label="Aumentar quantidade"
                                      title="Aumentar"
                                    >
                                      <Plus size={14} strokeWidth={2.5} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                         })}
                       </div>

                       <div className="mt-4">
                         <input
                           type="text"
                           placeholder="Observações do item..."
                           className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl py-3 px-4 text-[10px] font-bold text-slate-600 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/10 transition-all uppercase tracking-widest"
                           value={block.note || ''}
                           onChange={(e) => updateBlock(index, { note: e.target.value })}
                           aria-label="Observações do item"
                           title="Notas do Item"
                         />
                       </div>
                    </div>
                  )}
                </div>
              );
            })}

            {blocks.length === 0 && (
              <div className="text-center py-20 bg-slate-50/30 dark:bg-slate-900/40 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem] flex flex-col items-center">
                <Package
                  size={40}
                  className="text-slate-200 dark:text-slate-800 mb-2"
                  strokeWidth={1}
                />
                <p className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-700 tracking-[0.2em] italic px-10 text-center leading-relaxed">
                  Adicione itens para compor a entrada de hoje
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Checks Control */}
      {paymentTerm === PaymentTerm.INSTALLMENTS && (
        <section>
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 leading-none">
                  Controle de Cheques
                </h3>
                <p className="text-[8px] text-slate-300 font-bold uppercase tracking-widest mt-1">
                  Parcelas / Pré-datados
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={showChecks}
                  onChange={(e) => setShowChecks(e.target.checked)}
                  aria-label="Ativar controle de cheques"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-slate-900 border-2 border-transparent"></div>
              </label>
            </div>
          </div>

          {showChecks && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-4">
              <div className="flex justify-end mb-2 px-2">
                <button
                  onClick={addCheck}
                  className={`flex items-center gap-2 font-black text-[10px] uppercase tracking-widest bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl active:scale-95 transition-all ${isDarkMode ? "shadow-none" : "shadow-slate-200"}`}
                  aria-label="Adicionar cheque"
                  title="Adicionar Cheque"
                >
                  <Plus size={14} strokeWidth={3} /> Adicionar
                </button>
              </div>
              {checks.map((check, index) => (
                <div
                  key={index}
                  className={`p-5 rounded-[2rem] border shadow-sm flex flex-col gap-5 relative group overflow-hidden ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-indigo-500`}
                      >
                        <CreditCard size={20} strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-rose-500 uppercase tracking-[0.2em] mb-1">
                          FORNECEDOR: {supplierName || "---"}
                        </p>
                        <input
                          type="text"
                          placeholder="NUMERO DO CHEQUE"
                          className="bg-transparent border-none p-0 text-[12px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 focus:ring-0 placeholder:text-slate-300 dark:placeholder:text-slate-700"
                          value={check.number}
                          onChange={(e) =>
                            updateCheck(index, { number: e.target.value })
                          }
                          aria-label="Número do cheque"
                          title="Número do Cheque"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setChecks(checks.filter((_, i) => i !== index));
                      }}
                      className="p-2 text-slate-200 dark:text-slate-700 hover:text-rose-500 transition-colors transform active:scale-90"
                      aria-label="Remover cheque"
                      title="Remover"
                    >
                      <Trash2 size={18} strokeWidth={2.5} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <label className="text-[8px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest px-1">
                        Valor
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl py-3 px-4 text-[13px] font-black text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-indigo-500/10 transition-all font-mono"
                        value={check.value === 0 ? "" : check.value}
                        onChange={(e) =>
                          updateCheck(index, {
                            value: parseFloat(e.target.value) || 0,
                          })
                        }
                        aria-label="Valor do cheque"
                        title="Valor"
                      />
                    </div>
                    <div className="relative">
                      <label className="text-[8px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest px-1">
                        Vencimento
                      </label>
                      <input
                        type="date"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl py-3 px-4 text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-indigo-500/10 transition-all"
                        value={format(check.dueDate, "yyyy-MM-dd")}
                        onChange={(e) =>
                          updateCheck(index, {
                            dueDate:
                              new Date(e.target.value).getTime() || Date.now(),
                          })
                        }
                        aria-label="Data de vencimento do cheque"
                        title="Vencimento"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {checks.length === 0 && (
                <div className="text-center py-12 bg-slate-50/30 dark:bg-slate-900/40 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem]">
                  <p className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-700 tracking-[0.2em] italic">
                    Nenhum cheque cadastrado
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div
        className={`p-6 rounded-[2.5rem] border shadow-sm flex flex-col gap-4 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
      >
        <div className="flex items-center justify-between px-2">
          <label className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest">
            Observações do Pedido
          </label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={showNotes}
              onChange={(e) => setShowNotes(e.target.checked)}
              aria-label="Ativar observações"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-slate-900 border-2 border-transparent"></div>
          </label>
        </div>
        {showNotes && (
          <textarea
            className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 font-bold rounded-3xl p-5 text-sm h-32 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-amber-500/10 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700 text-slate-900 dark:text-slate-100 animate-in fade-in slide-in-from-top-4"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="NOTAS GERAIS SOBRE A COMPRA..."
            aria-label="Notas da compra"
            title="Observações"
          />
        )}
      </div>

      <div
        className={`p-6 rounded-[2.5rem] border shadow-sm flex items-center justify-between mt-2 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
      >
        <div className="flex items-center gap-3">
           <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500`}>
              <CreditCard size={18} strokeWidth={2.5} />
           </div>
           <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-800 dark:text-white">Contabilizar Financeiro</p>
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-tight mt-0.5 max-w-[200px]">Descontar da conta</p>
           </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
           <input
             type="checkbox"
             className="sr-only peer"
             checked={generateTransaction}
             onChange={(e) => setGenerateTransaction(e.target.checked)}
             aria-label="Contabilizar no financeiro"
           />
           <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500 dark:peer-checked:bg-emerald-400 border-2 border-transparent"></div>
        </label>
      </div>

      <div className="mt-6 mx-2 flex items-center justify-between bg-slate-900 dark:bg-slate-800 p-4 rounded-[2rem] shadow-xl z-40 animate-in slide-in-from-bottom-5">
        <div className="pl-3">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest leading-none mb-1">
            Total
          </p>
          <p className="text-2xl font-black text-white leading-none">
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-rose-500 transition-colors"
            aria-label="Cancelar"
            title="Cancelar"
          >
            <Trash2 size={20} strokeWidth={2.5} />
          </button>
          <button
            onClick={handleSave}
            className="h-12 px-6 rounded-full bg-white text-slate-900 font-black uppercase tracking-widest text-[11px] flex items-center gap-2 hover:bg-emerald-400 hover:text-white transition-all"
            aria-label="Finalizar compra"
            title="Finalizar"
          >
            <Save size={16} strokeWidth={3} /> Finalizar
          </button>
        </div>
      </div>

      <CalculatorModal
        isOpen={!!calcModal}
        onClose={() => setCalcModal(null)}
        isDarkMode={isDarkMode}
        initialValue={calcModal?.value || 0}
        onResult={(res) => {
            if (!calcModal) return;
            if (calcModal.field === 'generalItems') updateGeneralItem(calcModal.index, { value: res });
            if (calcModal.field === 'blocks') updateBlock(calcModal.index, { cost: res });
        }}
      />

      {showProductModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowProductModal(false)} />
          <div className={`relative w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] ${isDarkMode ? "bg-slate-900 border border-slate-800" : "bg-white"}`}>
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Selecionar Modelo</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Busque pelo nome ou referência</p>
              </div>
              <button 
                onClick={() => setShowProductModal(false)} 
                className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"
                aria-label="Fechar"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
               <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" size={18} strokeWidth={3} />
                 <input 
                   type="text" 
                   autoFocus
                   placeholder="Buscar modelo..."
                   className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-4 text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500/10 transition-all text-slate-800 dark:text-white"
                   value={productSearchQuery}
                   onChange={(e) => setProductSearchQuery(e.target.value)}
                   aria-label="Pesquisar produto"
                   title="Pesquisar"
                 />
               </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="flex flex-col gap-2">
                {activeProducts
                  .filter(p => !productSearchQuery || p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || p.reference?.toLowerCase().includes(productSearchQuery.toLowerCase()))
                  .map(p => {
                    const isAdded = blocks.some(b => b.productId === p.id);
                    return (
                      <button
                        key={p.id}
                        disabled={isAdded}
                        onClick={() => addBlock(p.id)}
                        className={`flex items-center justify-between p-4 rounded-3xl transition-all border text-left ${
                          isAdded 
                          ? "bg-slate-50/50 dark:bg-slate-800/30 border-transparent opacity-50 cursor-not-allowed" 
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700 bg-transparent active:scale-[0.98]"
                        }`}
                        aria-label={`Selecionar produto ${p.name}`}
                        title={p.name}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isAdded ? 'bg-slate-100 dark:bg-slate-800' : 'bg-indigo-50 dark:bg-indigo-900/20'}`}>
                            <Package size={20} className={isAdded ? 'text-slate-400' : 'text-indigo-500'} />
                          </div>
                          <div>
                            <h4 className="text-[13px] font-black uppercase tracking-tight text-slate-800 dark:text-white line-clamp-1">{p.name}</h4>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">REF: {p.reference || '---'}</p>
                          </div>
                        </div>
                        {isAdded && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 text-[8px] font-black uppercase tracking-widest">
                            <CheckCircle2 size={12} />
                            Adicionado
                          </div>
                        )}
                      </button>
                    )
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

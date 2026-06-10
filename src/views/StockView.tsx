import React, { useState } from "react";
import { Product, SaleType, ProductionConfigItem, StockPkgAllocation } from "../types";
import {
  Search,
  Package,
  TrendingDown,
  TrendingUp,
  Tag,
  Layers,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  ClipboardList,
} from "lucide-react";
import PrintLabelEditorModal from "../components/PrintLabelEditorModal";
import { toast } from '../utils/toast';

interface StockViewProps {
  products: Product[];
  productionConfigs: ProductionConfigItem[];
  onUpdateProduct: (product: Product) => Promise<void>;
  isDarkMode: boolean;
}

export default function StockView({
  products,
  productionConfigs,
  onUpdateProduct,
  isDarkMode,
}: StockViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedStocks, setEditedStocks] = useState<Record<string, Product>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [productForLabels, setProductForLabels] = useState<Product | null>(null);

  const packagingItems = productionConfigs.filter(c => c.type === 'PACKAGING');

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.reference.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleStartEditing = () => {
    const initialStocks: Record<string, Product> = {};
    products.forEach(p => {
      initialStocks[p.id] = JSON.parse(JSON.stringify(p));
    });
    setEditedStocks(initialStocks);
    setIsEditing(true);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      for (const productId of Object.keys(editedStocks)) {
        const original = products.find(p => p.id === productId);
        const edited = editedStocks[productId];
        if (JSON.stringify(original) !== JSON.stringify(edited)) {
          await onUpdateProduct(edited);
        }
      }
      setIsEditing(false);
      setEditedStocks({});
    } catch (error) {
      console.error("Erro ao salvar balanço:", error);
      toast.show("Erro ao salvar balanço de estoque.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateProductStock = (productId: string, variationId: string, key: string, value: number) => {
    setEditedStocks(prev => {
      const newStocks = { ...prev };
      const product = newStocks[productId];
      const variation = product.variations.find(v => v.id === variationId);
      if (variation) {
        variation.stock[key] = value;
      }
      return newStocks;
    });
  };

  const handleUpdatePkgAllocations = async (product: Product, variationId: string, allocations: StockPkgAllocation[]) => {
    const updated: Product = {
      ...product,
      variations: product.variations.map(v =>
        v.id === variationId ? { ...v, stockPkgAllocations: allocations } : v
      )
    };
    await onUpdateProduct(updated);
  };

  return (
    <div className="flex flex-col gap-4 pb-32 px-4 bg-[#fafafa] dark:bg-slate-950 min-h-screen">
      <div className="flex flex-col gap-3 pt-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className={`text-xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Estoque</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Balanço e Inventário</p>
          </div>

          {!isEditing ? (
            <button
              onClick={handleStartEditing}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 active:scale-95"
              title="Iniciar Balanço de Estoque"
              aria-label="Entrar no modo de edição de estoque para fazer balanço"
            >
              <TrendingUp size={14} strokeWidth={3} /> Fazer Balanço
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-3 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                title="Cancelar Balanço"
                aria-label="Sair do modo de edição sem salvar"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAll}
                disabled={isSaving}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 active:scale-95"
                title="Salvar Balanço"
                aria-label="Salvar todas as alterações de estoque"
              >
                {isSaving ? 'Salvando...' : 'Salvar Balanço'}
              </button>
            </div>
          )}
        </div>

        <div className={`p-6 rounded-[2rem] border shadow-xl relative overflow-hidden mb-2 ${
          isDarkMode
            ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border-slate-800'
            : 'bg-gradient-to-br from-indigo-600 via-indigo-600 to-indigo-800 border-indigo-500 text-white'
        }`}>
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${isDarkMode ? 'text-slate-500' : 'text-indigo-100/70'}`}>Valor Estimado em Estoque</p>
          <p className={`text-3xl font-black italic tracking-tighter ${isDarkMode ? 'text-white' : 'text-white'}`}>
            <span className="text-sm not-italic opacity-50 mr-2">R$</span>
            {products.reduce((acc, p) => acc + (p.variations.reduce((vAcc, v) => vAcc + (Object.values(v.stock) as number[]).reduce((sum, s) => sum + s, 0), 0) * (p.costPrice || 0)), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Procurar no estoque..."
            className={`w-full border rounded-[1.2rem] py-4 pl-12 pr-4 text-[11px] font-black uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-indigo-500/5 dark:focus:ring-indigo-500/10 placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-800 dark:text-slate-100 transition-all ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"}`}
            value={searchTerm}
            title="Pesquisar no Estoque"
            aria-label="Campo de pesquisa de produtos no estoque"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filteredProducts.map((product) => (
          <StockCard
            key={product.id}
            product={isEditing ? editedStocks[product.id] || product : product}
            packagingItems={packagingItems}
            isDarkMode={isDarkMode}
            isEditing={isEditing}
            onUpdateStock={(variationId, key, value) => updateProductStock(product.id, variationId, key, value)}
            onUpdatePkgAllocations={(variationId, allocations) => handleUpdatePkgAllocations(product, variationId, allocations)}
            onPrint={() => setProductForLabels(product)}
          />
        ))}

        {productForLabels && (
          <PrintLabelEditorModal
            isOpen={!!productForLabels}
            onClose={() => setProductForLabels(null)}
            product={productForLabels}
            isDarkMode={isDarkMode}
          />
        )}

        {filteredProducts.length === 0 && (
          <div className={`p-10 text-center border-2 border-dashed rounded-3xl ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
            <Package size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">Nenhum produto em estoque</p>
          </div>
        )}
      </div>
    </div>
  );
}

const StockCard: React.FC<{
  product: Product;
  packagingItems: ProductionConfigItem[];
  isDarkMode: boolean;
  isEditing: boolean;
  onUpdateStock: (variationId: string, key: string, value: number) => void;
  onUpdatePkgAllocations: (variationId: string, allocations: StockPkgAllocation[]) => void;
  onPrint: () => void;
}> = ({ product, packagingItems, isDarkMode, isEditing, onUpdateStock, onUpdatePkgAllocations, onPrint }) => {
  const [expandedVars, setExpandedVars] = useState<string[]>([]);
  const [expandedPackaging, setExpandedPackaging] = useState<string[]>([]);
  const [expandedCompositions, setExpandedCompositions] = useState<string[]>([]);
  const [gradePopup, setGradePopup] = useState<{
    varId: string;
    colorName: string;
    looseQty: number;
    pkgBreakdown?: Record<string, number>;
    pkgSizes?: string[];
    sizeInput: Record<string, number>;
  } | null>(null);
  const [allocPopup, setAllocPopup] = useState<{
    varId: string;
    allocIdx: number;
    pkgId: string;
    pkgName: string;
    qty: number;
    pkgCapacity: number;
    sizeInput: Record<string, number>;
  } | null>(null);

  const totalStock = product.variations.reduce((acc, v) => {
    return acc + (Object.values(v.stock) as number[]).reduce((sum, s) => sum + s, 0);
  }, 0);

  const isLowStock = totalStock <= product.minStockInBoxes * 12;

  const toggleVar = (id: string) => {
    setExpandedVars(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const togglePackaging = (id: string) => {
    setExpandedPackaging(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleComposition = (id: string) => {
    setExpandedCompositions(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className={`p-5 rounded-[2.5rem] border shadow-sm flex flex-col gap-5 transition-all ${isEditing ? 'ring-2 ring-indigo-500/20' : ''} ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>

      {/* Cabeçalho do produto */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700 overflow-hidden shrink-0">
            {product.photoUrl
              ? <img src={product.photoUrl} alt={product.name} className="w-full h-full object-cover" />
              : <Package size={26} className="text-indigo-500" />}
          </div>
          <div>
            <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none mb-1">{product.reference}</p>
            <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">{product.name}</h3>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0 ${isLowStock ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20'}`}>
          {isLowStock ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
          {isLowStock ? 'Baixo' : 'OK'}
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 gap-4 py-5 border-y border-slate-100 dark:border-slate-800">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Estoque Total</p>
            <p className={`text-3xl font-black italic tracking-tighter ${isLowStock ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
              {totalStock}
            </p>
            <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">{product.type === SaleType.WHOLESALE ? 'GRADES' : 'UNIDADES'}</p>
          </div>
          <button
            type="button"
            onClick={onPrint}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all border border-indigo-100/50 dark:border-indigo-500/20 shadow-sm w-fit"
            title="Imprimir Etiquetas"
          >
            <Tag size={14} strokeWidth={3} />
            <span className="text-xs font-black uppercase tracking-widest">Imprimir</span>
          </button>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Mínimo</p>
          <p className="text-3xl font-black italic tracking-tighter text-indigo-500">
            {product.minStockInBoxes}
          </p>
          <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">CAIXAS</p>
        </div>
      </div>

      {/* Variações */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Variações em Estoque</p>
        <div className="space-y-2">
          {product.variations.map(v => {
            const varStock = (Object.values(v.stock) as number[]).reduce((sum, s) => sum + s, 0);
            const allocations: StockPkgAllocation[] = v.stockPkgAllocations || [];
            const totalAllocated = allocations.reduce((s, a) => s + a.qty, 0);
            const isExpanded = expandedVars.includes(v.id);
            const isPkgExpanded = expandedPackaging.includes(v.id);
            const boxQty = v.stock['WHOLESALE'] || 0;

            return (
              <div key={v.id} className={`rounded-2xl border-2 transition-all ${
                isExpanded
                  ? isDarkMode ? 'bg-slate-800 border-indigo-700/60' : 'bg-white border-indigo-200'
                  : isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>

                {/* Linha colapsada — sempre visível */}
                <button
                  type="button"
                  onClick={() => toggleVar(v.id)}
                  className="w-full flex items-center justify-between px-4 py-4 active:opacity-70 transition-opacity"
                  aria-label={`${isExpanded ? 'Recolher' : 'Expandir'} variação ${v.colorName}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-600 shadow-sm shrink-0" style={{ backgroundColor: v.color }} />
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none mb-0.5">{product.reference}</p>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase">{v.colorName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-base font-black text-indigo-600 dark:text-indigo-400 leading-none">{varStock}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{product.type === SaleType.WHOLESALE ? 'GR' : 'UN'}</p>
                    </div>
                    {isExpanded
                      ? <ChevronDown size={16} className="text-indigo-400 shrink-0" />
                      : <ChevronRight size={16} className="text-slate-400 shrink-0" />
                    }
                  </div>
                </button>

                {/* Conteúdo expandido — dentro da mesma cápsula */}
                {isExpanded && (
                  <div className={`mx-3 mb-3 rounded-xl flex flex-col border ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>

                    {/* RETAIL: grid por tamanho */}
                    {product.type === SaleType.RETAIL && (
                      <div className="p-3 flex flex-col gap-2">
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {Object.entries(v.stock).map(([size, qty]) => (
                            <div key={size} className={`flex flex-col items-center rounded-xl py-3 px-2 ${isDarkMode ? 'bg-slate-700/60' : 'bg-slate-50'}`}>
                              <span className="text-[10px] font-black text-slate-500 uppercase leading-none mb-2">{size}</span>
                              {isEditing ? (
                                <div className="flex flex-col items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => onUpdateStock(v.id, size, Math.max(0, (qty as number) + 1))}
                                    className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-black hover:bg-indigo-200 transition-all active:scale-95"
                                    aria-label={`Aumentar tamanho ${size}`}
                                  >+</button>
                                  <span className="text-base font-black text-slate-900 dark:text-white">{qty as number}</span>
                                  <button
                                    type="button"
                                    onClick={() => onUpdateStock(v.id, size, Math.max(0, (qty as number) - 1))}
                                    className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 flex items-center justify-center text-sm font-black hover:bg-rose-200 transition-all active:scale-95"
                                    aria-label={`Diminuir tamanho ${size}`}
                                  >−</button>
                                </div>
                              ) : (
                                <span className="text-base font-bold text-slate-900 dark:text-slate-100">{qty as number}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ATACADO: estoque global + embalagens */}
                    {product.type === SaleType.WHOLESALE && (
                      <>
                        {/* Estoque Global com +/- */}
                        <div className={`flex items-center justify-between px-4 py-4 ${isDarkMode ? 'bg-slate-900/40' : 'bg-slate-50/80'}`}>
                          <div className="flex items-center gap-2">
                            <Package size={14} className="text-slate-400" />
                            <span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Estoque Global</span>
                          </div>
                          {isEditing ? (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => onUpdateStock(v.id, 'WHOLESALE', Math.max(0, boxQty - 1))}
                                className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center text-lg font-black hover:bg-rose-200 transition-all active:scale-95"
                                aria-label="Diminuir grade"
                              >−</button>
                              <span className="w-12 text-center text-xl font-black text-slate-900 dark:text-white">{boxQty}</span>
                              <button
                                type="button"
                                onClick={() => onUpdateStock(v.id, 'WHOLESALE', boxQty + 1)}
                                className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center text-lg font-black hover:bg-indigo-200 transition-all active:scale-95"
                                aria-label="Aumentar grade"
                              >+</button>
                            </div>
                          ) : (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xl font-black text-slate-900 dark:text-white">{boxQty}</span>
                              <span className="text-xs font-bold text-slate-400 uppercase">grades</span>
                            </div>
                          )}
                        </div>

                        {/* Embalagens — acordeão multi-alocação */}
                        <div className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                          <button
                            type="button"
                            onClick={() => togglePackaging(v.id)}
                            className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${isDarkMode ? 'hover:bg-slate-700/40' : 'hover:bg-slate-50'}`}
                            aria-label="Expandir embalagens"
                          >
                            <div className="flex items-center gap-2">
                              <Layers size={14} className={allocations.length > 0 ? 'text-violet-500' : 'text-slate-400'} />
                              <span className={`text-xs font-black uppercase tracking-widest ${allocations.length > 0 ? 'text-violet-700 dark:text-violet-400' : 'text-slate-500'}`}>
                                Embalagens
                              </span>
                              {allocations.length > 0 && (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  totalAllocated === boxQty
                                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                }`}>
                                  {totalAllocated}/{boxQty} GR
                                </span>
                              )}
                              {allocations.length === 0 && (
                                <span className="text-[10px] font-bold text-slate-400">Nenhuma configurada</span>
                              )}
                            </div>
                            {isPkgExpanded
                              ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
                              : <ChevronRight size={14} className="text-slate-400 shrink-0" />
                            }
                          </button>

                          {/* Conteúdo do acordeão de embalagens */}
                          {isPkgExpanded && (
                            <div className={`flex flex-col gap-3 px-4 pb-4 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>

                              {packagingItems.length === 0 && (
                                <p className="text-xs text-slate-500 font-bold pt-3">
                                  Nenhum padrão cadastrado. Acesse Produção → Config → Embalagens.
                                </p>
                              )}

                              {/* Lista de alocações */}
                              {allocations.map((alloc, idx) => {
                                const pkg = packagingItems.find(p => p.id === alloc.pkgId);
                                const pkgBreakdown = pkg?.metadata?.sizeQuantities as Record<string, number> | undefined;
                                const pkgSizes: string[] = pkg?.metadata?.sizes?.length ? pkg.metadata.sizes as string[] : [];
                                const compKey = `${v.id}-${idx}`;
                                const isCompExpanded = expandedCompositions.includes(compKey);

                                return (
                                  <div key={idx} className={`flex flex-col gap-2 pt-3 ${idx > 0 ? `border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}` : ''}`}>

                                    {/* Linha 1: select da embalagem */}
                                    <select
                                      value={alloc.pkgId}
                                      onChange={e => {
                                        const updated = [...allocations];
                                        updated[idx] = { ...alloc, pkgId: e.target.value };
                                        onUpdatePkgAllocations(v.id, updated);
                                      }}
                                      title="Padrão de embalagem"
                                      aria-label="Selecionar padrão de embalagem"
                                      className={`w-full min-w-0 text-sm font-bold rounded-xl px-3 py-2.5 outline-none cursor-pointer border ${
                                        pkg
                                          ? isDarkMode ? 'bg-violet-900/30 text-violet-300 border-violet-700/50' : 'bg-violet-50 text-violet-700 border-violet-200'
                                          : isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-200'
                                      }`}
                                    >
                                      <option value="">Selecione…</option>
                                      {packagingItems.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                      ))}
                                    </select>

                                    {/* Linha 2: quantidade + remover */}
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = [...allocations];
                                            updated[idx] = { ...alloc, qty: Math.max(0, alloc.qty - 1) };
                                            onUpdatePkgAllocations(v.id, updated);
                                          }}
                                          className="w-8 h-8 shrink-0 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center text-base font-black hover:bg-rose-200 transition-all active:scale-95"
                                          aria-label="Diminuir quantidade"
                                        >−</button>
                                        <span className="w-7 text-center text-base font-black text-slate-900 dark:text-white shrink-0">{alloc.qty}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (totalAllocated < boxQty) {
                                              const updated = [...allocations];
                                              updated[idx] = { ...alloc, qty: alloc.qty + 1 };
                                              onUpdatePkgAllocations(v.id, updated);
                                            }
                                          }}
                                          disabled={totalAllocated >= boxQty}
                                          className="w-8 h-8 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center text-base font-black hover:bg-indigo-200 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                                          aria-label="Aumentar quantidade"
                                        >+</button>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => onUpdatePkgAllocations(v.id, allocations.filter((_, i) => i !== idx))}
                                        className="w-8 h-8 shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center transition-all active:scale-95"
                                        aria-label="Remover embalagem"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>

                                    {/* Composição da embalagem com breakdown cadastrado */}
                                    {pkg && pkgBreakdown && pkgSizes.length > 0 && alloc.qty > 0 && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => toggleComposition(compKey)}
                                          className="flex items-center gap-1.5 text-xs font-black text-slate-500 dark:text-slate-400 hover:text-slate-700 transition-colors w-fit"
                                        >
                                          {isCompExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                          Ver composição por tamanho
                                        </button>
                                        {isCompExpanded && (
                                          <div className={`rounded-xl overflow-hidden border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                            <div className={`grid grid-cols-3 px-4 py-2 text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                                              <span>Tam</span>
                                              <span className="text-center">Por Grade</span>
                                              <span className="text-right text-emerald-600">Total Pares</span>
                                            </div>
                                            {pkgSizes.map(size => {
                                              const perBox = pkgBreakdown[size] || 0;
                                              return (
                                                <div key={size} className={`grid grid-cols-3 px-4 py-2.5 text-sm border-t ${isDarkMode ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-100 bg-white text-slate-900'}`}>
                                                  <span className="font-black">{size}</span>
                                                  <span className="text-center font-bold text-slate-500">{perBox}</span>
                                                  <span className="text-right font-black text-emerald-600 dark:text-emerald-400">{perBox * alloc.qty}</span>
                                                </div>
                                              );
                                            })}
                                            <div className={`grid grid-cols-3 px-4 py-2.5 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                                              <span className={`text-xs font-black uppercase col-span-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Total Pares</span>
                                              <span className="text-right text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                {pkgSizes.reduce((s, sz) => s + (pkgBreakdown[sz] || 0) * alloc.qty, 0)}
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    )}

                                    {/* Composição manual para embalagens sem breakdown (avulso) */}
                                    {alloc.qty > 0 && (!pkgBreakdown || pkgSizes.length === 0) && (
                                      <div className="flex flex-col gap-2">
                                        {alloc.customBreakdown && Object.keys(alloc.customBreakdown).length > 0 ? (
                                          <>
                                            <div className={`rounded-xl overflow-hidden border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                              <div className={`grid grid-cols-3 px-4 py-2 text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                                                <span>Tam</span>
                                                <span className="text-center">Por Grade</span>
                                                <span className="text-right text-indigo-500">Total</span>
                                              </div>
                                              {Object.entries(alloc.customBreakdown).map(([size, perGrade]) => (
                                                <div key={size} className={`grid grid-cols-3 px-4 py-2.5 text-sm border-t ${isDarkMode ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-100 bg-white text-slate-900'}`}>
                                                  <span className="font-black">{size}</span>
                                                  <span className="text-center font-bold text-slate-500">{perGrade}</span>
                                                  <span className="text-right font-black text-indigo-500">{perGrade * alloc.qty}</span>
                                                </div>
                                              ))}
                                              <div className={`grid grid-cols-3 px-4 py-2.5 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                                                <span className={`text-xs font-black uppercase col-span-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Total Pares</span>
                                                <span className="text-right text-sm font-black text-indigo-500">
                                                  {Object.values(alloc.customBreakdown).reduce((s, q) => s + q, 0) * alloc.qty}
                                                </span>
                                              </div>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setAllocPopup({ varId: v.id, allocIdx: idx, pkgId: alloc.pkgId, pkgName: pkg?.name || 'Avulso', qty: alloc.qty, pkgCapacity: (pkg?.metadata?.capacity as number) || 0, sizeInput: { ...alloc.customBreakdown! } });
                                              }}
                                              className="flex items-center gap-1.5 text-xs font-black text-slate-400 hover:text-indigo-500 transition-colors w-fit"
                                            >
                                              <ClipboardList size={12} /> Editar composição
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const refPkg = packagingItems.find(p => (p.metadata?.sizes as string[] | undefined)?.length);
                                              const refSizes = refPkg?.metadata?.sizes as string[] | undefined;
                                              setAllocPopup({
                                                varId: v.id,
                                                allocIdx: idx,
                                                pkgId: alloc.pkgId,
                                                pkgName: pkg?.name || 'Avulso',
                                                qty: alloc.qty,
                                                pkgCapacity: (pkg?.metadata?.capacity as number) || 0,
                                                sizeInput: refSizes ? Object.fromEntries(refSizes.map(s => [s, 0])) : {},
                                              });
                                            }}
                                            className={`flex items-center gap-2 text-xs font-black px-3 py-2 rounded-xl border transition-colors w-fit ${isDarkMode ? 'border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-indigo-400' : 'border-slate-300 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}
                                          >
                                            <ClipboardList size={13} />
                                            Informar composição por tamanho
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Espaço + botão adicionar */}
                              {packagingItems.length > 0 && (
                                <div className={`pt-3 mt-1 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                  <button
                                    type="button"
                                    onClick={() => onUpdatePkgAllocations(v.id, [...allocations, { pkgId: '', qty: 0 }])}
                                    className="flex items-center gap-2 text-sm font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors w-fit"
                                  >
                                    <Plus size={15} strokeWidth={3} />
                                    Adicionar embalagem
                                  </button>
                                </div>
                              )}

                              {/* Resumo de alocação */}
                              {boxQty > 0 && (
                                <div className={`flex flex-col gap-2 pt-2 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                  <div className={`flex items-center justify-between text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    <span>Total alocado</span>
                                    <span className={`font-black ${totalAllocated === boxQty ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                                      {totalAllocated} / {boxQty} grades
                                    </span>
                                  </div>

                                  {/* Grades avulsas */}
                                  {boxQty - totalAllocated > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const firstPkgWithBreakdown = allocations
                                          .map(a => packagingItems.find(p => p.id === a.pkgId))
                                          .find(p => p?.metadata?.sizeQuantities);
                                        const refSizes = firstPkgWithBreakdown?.metadata?.sizes as string[] | undefined;
                                        setGradePopup({
                                          varId: v.id,
                                          colorName: v.colorName,
                                          looseQty: boxQty - totalAllocated,
                                          pkgBreakdown: firstPkgWithBreakdown?.metadata?.sizeQuantities as Record<string, number> | undefined,
                                          pkgSizes: refSizes,
                                          sizeInput: refSizes ? Object.fromEntries(refSizes.map(s => [s, 0])) : {},
                                        });
                                      }}
                                      className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Package size={13} className="text-amber-500" />
                                        <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                                          Grades Avulsas
                                        </span>
                                        <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                                          {boxQty - totalAllocated} GR
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-amber-500">
                                        <ClipboardList size={15} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Registrar</span>
                                      </div>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Popup — registro de grades avulsas */}
      {gradePopup && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0"
          onClick={() => setGradePopup(null)}
        >
          <div
            className={`w-full max-w-sm rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho fixo */}
            <div className="flex items-start justify-between p-6 pb-4">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{product.reference}</p>
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">{gradePopup.colorName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <ClipboardList size={13} className="text-amber-500" />
                  <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">
                    {gradePopup.looseQty} Grade{gradePopup.looseQty > 1 ? 's' : ''} Avulsa{gradePopup.looseQty > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGradePopup(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-all text-lg font-black"
                aria-label="Fechar"
              >×</button>
            </div>

            {/* Corpo com scroll */}
            <div className="flex flex-col gap-4 px-6 pb-2 overflow-y-auto">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                Registre a composição por tamanho de{gradePopup.looseQty > 1 ? ' cada' : ' a'} grade avulsa para controle interno.
              </p>

              {/* Formulário de tamanhos */}
              {Object.keys(gradePopup.sizeInput).length > 0 ? (
                <div className={`rounded-xl overflow-hidden border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className={`grid grid-cols-3 px-4 py-2 text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                    <span>Tamanho</span>
                    <span className="text-center">Pares/grade</span>
                    <span className="text-right text-amber-500">Total</span>
                  </div>
                  {Object.entries(gradePopup.sizeInput).map(([size, qty]) => (
                    <div key={size} className={`grid grid-cols-3 items-center px-4 py-2 border-t ${isDarkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-white'}`}>
                      <span className="text-sm font-black text-slate-900 dark:text-white">{size}</span>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setGradePopup(prev => prev ? { ...prev, sizeInput: { ...prev.sizeInput, [size]: Math.max(0, qty - 1) } } : null)}
                          className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center text-xs font-black hover:bg-rose-200 transition-all"
                        >−</button>
                        <span className="w-6 text-center text-sm font-black text-slate-900 dark:text-white">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setGradePopup(prev => prev ? { ...prev, sizeInput: { ...prev.sizeInput, [size]: qty + 1 } } : null)}
                          className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center text-xs font-black hover:bg-indigo-200 transition-all"
                        >+</button>
                      </div>
                      <span className="text-right text-sm font-black text-amber-500">{qty * gradePopup.looseQty}</span>
                    </div>
                  ))}
                  <div className={`grid grid-cols-3 px-4 py-2.5 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                    <span className={`text-xs font-black uppercase col-span-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Total Pares</span>
                    <span className="text-right text-sm font-black text-amber-500">
                      {Object.values(gradePopup.sizeInput).reduce((s, q) => s + q, 0) * gradePopup.looseQty}
                    </span>
                  </div>
                </div>
              ) : (
                <div className={`p-4 rounded-xl text-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <p className="text-xs text-slate-500 font-bold mb-3">Nenhum tamanho de referência disponível.</p>
                  <p className="text-[10px] text-slate-400">Configure uma embalagem padrão para este produto para ter tamanhos disponíveis.</p>
                </div>
              )}
            </div>

            {/* Botões fixos no rodapé */}
            <div className="flex gap-3 p-6 pt-4">
              <button
                type="button"
                onClick={() => setGradePopup(null)}
                className={`flex-1 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                Cancelar
              </button>
              {Object.keys(gradePopup.sizeInput).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const variation = product.variations.find(v => v.id === gradePopup.varId);
                    if (!variation) return;
                    const existing = variation.stockPkgAllocations || [];
                    const newAlloc: StockPkgAllocation = {
                      pkgId: 'AVULSA',
                      qty: gradePopup.looseQty,
                      customBreakdown: gradePopup.sizeInput,
                    };
                    onUpdatePkgAllocations(gradePopup.varId, [...existing, newAlloc]);
                    setGradePopup(null);
                  }}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <ClipboardList size={15} />
                  Registrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Popup — composição manual por alocação (avulso) */}
      {allocPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setAllocPopup(null)}
        >
          <div
            className={`w-full max-w-sm rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-start justify-between p-6 pb-4">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Composição manual</p>
                <p className="text-xs font-bold text-indigo-500 mt-0.5">{allocPopup.qty} grade{allocPopup.qty > 1 ? 's' : ''}</p>
              </div>
              <button
                type="button"
                onClick={() => setAllocPopup(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-all text-lg font-black"
                aria-label="Fechar"
              >×</button>
            </div>

            {/* Linha de seleção de embalagem */}
            <div className={`mx-6 mb-4 flex flex-col gap-1.5`}>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Embalagem</label>
              <select
                value={allocPopup.pkgId}
                title="Selecionar padrão de embalagem"
                aria-label="Selecionar padrão de embalagem"
                onChange={e => {
                  const selectedPkg = packagingItems.find(p => p.id === e.target.value);
                  const newCapacity = (selectedPkg?.metadata?.capacity as number) || 0;
                  const newSizes = selectedPkg?.metadata?.sizes as string[] | undefined;
                  setAllocPopup(prev => prev ? {
                    ...prev,
                    pkgId: e.target.value,
                    pkgName: selectedPkg?.name || 'Avulso',
                    pkgCapacity: newCapacity,
                    sizeInput: newSizes?.length
                      ? Object.fromEntries(newSizes.map(s => [s, prev.sizeInput[s] ?? 0]))
                      : prev.sizeInput,
                  } : null);
                }}
                className={`w-full text-sm font-bold rounded-xl px-4 py-3 outline-none cursor-pointer border-2 transition-all ${
                  allocPopup.pkgId
                    ? isDarkMode ? 'bg-violet-900/30 text-violet-300 border-violet-700/50' : 'bg-violet-50 text-violet-700 border-violet-200'
                    : isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <option value="">Selecione a embalagem…</option>
                {packagingItems.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Formulário de tamanhos */}
            <div className="flex flex-col gap-4 px-6 pb-2 overflow-y-auto">
              {(() => {
                const totalPairsInput = Object.values(allocPopup.sizeInput).reduce((s, q) => s + q, 0);
                const capacity = allocPopup.pkgCapacity;
                const atCapacity = capacity > 0 && totalPairsInput >= capacity;
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                        Informe quantos pares de cada tamanho há em {allocPopup.qty > 1 ? 'cada' : 'a'} grade.
                      </p>
                      {capacity > 0 && (
                        <span className={`text-xs font-black px-2.5 py-1 rounded-full shrink-0 ml-3 ${
                          atCapacity
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {totalPairsInput}/{capacity} pares
                        </span>
                      )}
                    </div>

                    {Object.keys(allocPopup.sizeInput).length > 0 ? (
                      <div className={`rounded-xl overflow-hidden border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        <div className={`grid grid-cols-3 px-4 py-2 text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                          <span>Tamanho</span>
                          <span className="text-center">Pares/grade</span>
                          <span className="text-right text-indigo-500">Total</span>
                        </div>
                        {Object.entries(allocPopup.sizeInput).map(([size, qty]) => (
                          <div key={size} className={`grid grid-cols-3 items-center px-4 py-2 border-t ${isDarkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-white'}`}>
                            <span className="text-sm font-black text-slate-900 dark:text-white">{size}</span>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setAllocPopup(prev => prev ? { ...prev, sizeInput: { ...prev.sizeInput, [size]: Math.max(0, qty - 1) } } : null)}
                                className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center text-xs font-black hover:bg-rose-200 transition-all"
                              >−</button>
                              <span className="w-6 text-center text-sm font-black text-slate-900 dark:text-white">{qty}</span>
                              <button
                                type="button"
                                disabled={atCapacity}
                                onClick={() => setAllocPopup(prev => prev ? { ...prev, sizeInput: { ...prev.sizeInput, [size]: qty + 1 } } : null)}
                                className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center text-xs font-black hover:bg-indigo-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                              >+</button>
                            </div>
                            <span className="text-right text-sm font-black text-indigo-500">{qty * allocPopup.qty}</span>
                          </div>
                        ))}
                        <div className={`grid grid-cols-3 px-4 py-2.5 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                          <span className={`text-xs font-black uppercase col-span-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Total Pares</span>
                          <span className={`text-right text-sm font-black ${atCapacity ? 'text-emerald-500' : 'text-indigo-500'}`}>
                            {totalPairsInput * allocPopup.qty}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 font-bold">
                        Nenhum tamanho de referência. Configure um padrão de embalagem com tamanhos cadastrados.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Botões rodapé */}
            <div className="flex gap-3 p-6 pt-4">
              <button
                type="button"
                onClick={() => setAllocPopup(null)}
                className={`flex-1 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                Cancelar
              </button>
              {Object.keys(allocPopup.sizeInput).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const variation = product.variations.find(v => v.id === allocPopup.varId);
                    if (!variation) return;
                    const updated = [...(variation.stockPkgAllocations || [])];
                    updated[allocPopup.allocIdx] = {
                      ...updated[allocPopup.allocIdx],
                      pkgId: allocPopup.pkgId,
                      customBreakdown: allocPopup.sizeInput,
                    };
                    onUpdatePkgAllocations(allocPopup.varId, updated);
                    setAllocPopup(null);
                  }}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <ClipboardList size={15} />
                  Salvar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

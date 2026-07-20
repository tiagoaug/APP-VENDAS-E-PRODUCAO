import React, { useState, useMemo } from "react";
import { Product, SaleType, ProductionConfigItem, StockPkgAllocation, StockLot, StockLotRevertPreview, Sale, SaleStatus, ProductionOrder, ProductionLot, AppModulesConfig } from "../types";
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
  Boxes,
  User,
  History,
  RotateCcw,
  CheckCircle2,
  Clock,
  Truck,
  Factory,
  Users,
  Wrench,
  Settings,
} from "lucide-react";
import PrintLabelEditorModal from "../components/PrintLabelEditorModal";
import Modal from "../components/Modal";
import { toast } from '../utils/toast';
import { isHybridProduct, getWholesaleBoxes, getRetailPairs, getStockValue, getWholesaleValue, getRetailValue, productHasSaleType } from '../utils/stockPools';
import { useStockLotDuplicates } from '../hooks/useStockLotDuplicates';
import StockDuplicateBanner from '../components/StockDuplicateBanner';
import StockDuplicateDiagnosticModal from '../components/StockDuplicateDiagnosticModal';
import StockRepairBanner from '../components/StockRepairBanner';
import { summarizeStockRepairIssues } from '../utils/stockRepair';

// Capacidade (pares) de uma embalagem avulsa: usa `metadata.capacity` quando
// configurado; senão recai para o número embutido no nome (ex.: "12 pares
// avulso a escolha do cliente" => 12), padrão comum em embalagens criadas sem
// preencher o campo "Capacidade Total".
function resolvePkgCapacity(pkg?: ProductionConfigItem): number {
  const explicit = (pkg?.metadata?.capacity as number) || 0;
  if (explicit > 0) return explicit;
  const match = pkg?.name?.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

interface StockViewProps {
  products: Product[];
  productionConfigs: ProductionConfigItem[];
  onUpdateProduct: (product: Product) => Promise<void>;
  isDarkMode: boolean;
  stockLots: StockLot[];
  onPreviewRevertStockLot?: (stockLot: StockLot) => StockLotRevertPreview;
  onRevertStockLot?: (stockLot: StockLot) => Promise<StockLotRevertPreview>;
  sales?: Sale[];
  productionOrders?: ProductionOrder[];
  lots?: ProductionLot[];
  onFixPkgAllocations?: () => Promise<{ fixed: number; total: number }>;
  onNavigatePCP?: () => void;
  /** "Lotes" (registro de produção) e "Configurar" (histórico de entradas + correção de
   * alocações) só existem por causa de StockLots criados na finalização de produção — sem o
   * módulo Produção ativo essa coleção fica sempre vazia, então as duas abas somem. */
  modulesConfig?: AppModulesConfig;
}

export default function StockView({
  products,
  productionConfigs,
  onUpdateProduct,
  isDarkMode,
  stockLots,
  onPreviewRevertStockLot,
  onRevertStockLot,
  sales = [],
  productionOrders = [],
  lots = [],
  onFixPkgAllocations,
  onNavigatePCP,
  modulesConfig,
}: StockViewProps) {
  const showProductionTabs = !modulesConfig || modulesConfig.production;
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedStocks, setEditedStocks] = useState<Record<string, Product>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [productForLabels, setProductForLabels] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<'estoque' | 'clientes' | 'lotes'>('estoque');
  const [showEntryHistory, setShowEntryHistory] = useState(false);
  const [stockTypeFilter, setStockTypeFilter] = useState<'ALL' | SaleType.WHOLESALE | SaleType.RETAIL>('ALL');
  const [fixingAlloc, setFixingAlloc] = useState(false);
  const [fixAllocResult, setFixAllocResult] = useState<{ fixed: number; total: number } | null>(null);
  const [showFixAllocModal, setShowFixAllocModal] = useState(false);
  const [showStockDiagnosticModal, setShowStockDiagnosticModal] = useState(false);
  const [showConfigMenu, setShowConfigMenu] = useState(false);

  const { duplicateStockLotGroups, duplicateStockByRefColor, markResolved: markStockDuplicatesResolved } = useStockLotDuplicates(stockLots);

  // Mesma varredura do "Reparar Caixas" (PCP) — alimenta o aviso e a bolinha vermelha no
  // botão "Configurar" aqui em Estoque, pra não depender do usuário lembrar de checar o PCP.
  const stockRepairSummary = useMemo(
    () => summarizeStockRepairIssues(lots, stockLots, productionOrders, products),
    [lots, stockLots, productionOrders, products]
  );
  const hasAnyStockIssue = stockRepairSummary.missingBoxQty > 0
    || stockRepairSummary.missingStockLot > 0
    || stockRepairSummary.unresolved > 0
    || duplicateStockLotGroups.length > 0;

  const packagingItems = productionConfigs.filter(c => c.type === 'PACKAGING');

  // Checagem somente leitura — mesma regra de handleFixPkgAllocations (App.tsx), só
  // pra saber QUANTOS produtos têm alocação de embalagem maior que o estoque real,
  // sem alterar nada. A correção de fato só acontece ao clicar no botão.
  const pkgAllocIssuesCount = useMemo(() => {
    return products.reduce((count, product) => {
      const hasIssue = product.variations.some((v) => {
        const boxQty = v.stock?.['WHOLESALE'] ?? 0;
        const totalAlloc = (v.stockPkgAllocations || []).reduce((s, a) => s + a.qty, 0);
        return totalAlloc > boxQty;
      });
      return hasIssue ? count + 1 : count;
    }, 0);
  }, [products]);

  const filteredProducts = products.filter(
    (p) =>
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.reference.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (stockTypeFilter === 'ALL' || productHasSaleType(p, stockTypeFilter)),
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

        // When WHOLESALE stock decreases, trim pkg allocations so totalAllocated never exceeds boxQty
        if (key === 'WHOLESALE') {
          const allocs = variation.stockPkgAllocations || [];
          const totalAlloc = allocs.reduce((s, a) => s + a.qty, 0);
          if (value < totalAlloc) {
            let excess = totalAlloc - value;
            const trimmed = allocs.map(a => ({ ...a }));
            for (let i = trimmed.length - 1; i >= 0 && excess > 0; i--) {
              const cut = Math.min(trimmed[i].qty, excess);
              trimmed[i].qty -= cut;
              excess -= cut;
            }
            variation.stockPkgAllocations = trimmed.filter(a => a.qty > 0);
          }
        }
      }
      return newStocks;
    });
  };

  const handleUpdatePkgAllocations = async (product: Product, variationId: string, allocations: StockPkgAllocation[]) => {
    // Cap allocations so totalAllocated never exceeds boxQty
    const variation = product.variations.find(v => v.id === variationId);
    const boxQty = variation?.stock['WHOLESALE'] ?? 0;
    const totalAlloc = allocations.reduce((s, a) => s + a.qty, 0);
    let safeAllocations = allocations;
    if (totalAlloc > boxQty) {
      let excess = totalAlloc - boxQty;
      safeAllocations = allocations.map(a => ({ ...a }));
      for (let i = safeAllocations.length - 1; i >= 0 && excess > 0; i--) {
        const cut = Math.min(safeAllocations[i].qty, excess);
        safeAllocations[i].qty -= cut;
        excess -= cut;
      }
      safeAllocations = safeAllocations.filter(a => a.qty > 0);
    }

    const updated: Product = {
      ...product,
      variations: product.variations.map(v =>
        v.id === variationId ? { ...v, stockPkgAllocations: safeAllocations } : v
      )
    };
    // Durante o balanço, sincroniza editedStocks para que o salvar não sobrescreva
    // as mudanças de embalagem feitas no mesmo período.
    if (isEditing) {
      setEditedStocks(prev => ({ ...prev, [updated.id]: updated }));
    }
    await onUpdateProduct(updated);
  };

  return (
    <div className="flex flex-col gap-4 pb-32 px-4 bg-[#fafafa] dark:bg-slate-950 min-h-screen">
      <div className="flex flex-col gap-3 pt-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className={`text-xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Expedição e Estoque</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pedidos de Clientes · Inventário</p>
          </div>

          {!isEditing ? (
            <div className="flex gap-2">
              <button
                onClick={handleStartEditing}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 active:scale-95"
                title="Iniciar Balanço de Estoque"
                aria-label="Entrar no modo de edição de estoque para fazer balanço"
              >
                <TrendingUp size={14} strokeWidth={3} /> Fazer Balanço
              </button>
            </div>
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

        {!isEditing && (
          <StockDuplicateBanner
            count={duplicateStockLotGroups.length}
            onOpen={() => setShowStockDiagnosticModal(true)}
            isDarkMode={isDarkMode}
          />
        )}

        {!isEditing && onNavigatePCP && (
          <StockRepairBanner
            fixable={stockRepairSummary.missingBoxQty + stockRepairSummary.missingStockLot}
            unresolved={stockRepairSummary.unresolved}
            onOpen={onNavigatePCP}
            isDarkMode={isDarkMode}
          />
        )}

        {/* Card único 2x2: Expedição / Estoque / Lotes / Configurar (histórico de entradas +
            correção de alocações de embalagem, antes 2 botões cheios ocupando a tela toda). */}
        {!isEditing && (
          <div className={`grid grid-cols-2 gap-2 p-2 rounded-[1.75rem] ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-slate-100'}`}>
            <button
              type="button"
              onClick={() => setActiveTab('clientes')}
              className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'clientes'
                  ? (isDarkMode ? 'bg-slate-800 text-indigo-400 shadow-sm' : 'bg-white text-indigo-600 shadow-sm')
                  : 'text-slate-400'
              }`}
            >
              <Truck size={18} strokeWidth={2.5} className="text-sky-500" />
              Expedição
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('estoque')}
              className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'estoque'
                  ? (isDarkMode ? 'bg-slate-800 text-indigo-400 shadow-sm' : 'bg-white text-indigo-600 shadow-sm')
                  : 'text-slate-400'
              }`}
            >
              <Package size={18} strokeWidth={2.5} className="text-violet-500" />
              Estoque
            </button>
            {showProductionTabs && (
              <button
                type="button"
                onClick={() => setActiveTab('lotes')}
                className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'lotes'
                    ? (isDarkMode ? 'bg-slate-800 text-indigo-400 shadow-sm' : 'bg-white text-indigo-600 shadow-sm')
                    : 'text-slate-400'
                }`}
              >
                <Boxes size={18} strokeWidth={2.5} className="text-emerald-500" />
                Lotes
              </button>
            )}
            {showProductionTabs && (
              <button
                type="button"
                onClick={() => setShowConfigMenu(true)}
                className={`relative flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-slate-400 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-white'}`}
                title="Histórico de entradas e correção de alocações de embalagem"
                aria-label="Abrir configurações de estoque"
              >
                <Settings size={18} strokeWidth={2.5} className="text-amber-500" />
                Configurar
                {pkgAllocIssuesCount > 0 ? (
                  <span className="absolute top-2 right-2 flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500 text-white text-[8px] font-black">
                    {pkgAllocIssuesCount}
                  </span>
                ) : hasAnyStockIssue ? (
                  // Problema detectado (Mapa finalizado sem StockLot, StockLot duplicado, etc.)
                  // que não se resolve dentro deste menu — sinaliza pra o usuário ir investigar
                  // no PCP/Reparar Caixas, sem depender de lembrar de checar por conta própria.
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500" title="Problema detectado no estoque — veja o aviso acima ou o Reparar Caixas no PCP" />
                ) : null}
              </button>
            )}
          </div>
        )}

        {activeTab === 'estoque' && (
          <div className={`p-6 rounded-[2rem] border shadow-xl relative overflow-hidden mb-2 ${
            isDarkMode
              ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border-slate-800'
              : 'bg-gradient-to-br from-indigo-600 via-indigo-600 to-indigo-800 border-indigo-500 text-white'
          }`}>
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${isDarkMode ? 'text-slate-500' : 'text-indigo-100/70'}`}>
              Valor Estimado em Estoque{stockTypeFilter !== 'ALL' && (stockTypeFilter === SaleType.WHOLESALE ? ' · Atacado' : ' · Varejo')}
            </p>
            <p className={`text-3xl font-black italic tracking-tighter ${isDarkMode ? 'text-white' : 'text-white'}`}>
              <span className="text-sm not-italic opacity-50 mr-2">R$</span>
              {products.reduce((acc, p) => acc + p.variations.reduce((vAcc, v) => {
                if (stockTypeFilter === SaleType.WHOLESALE) return vAcc + getWholesaleValue(p, v).cost;
                if (stockTypeFilter === SaleType.RETAIL) return vAcc + getRetailValue(p, v).cost;
                return vAcc + getStockValue(p, v).costValue;
              }, 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        )}

        {activeTab === 'estoque' && (
          <div className={`flex gap-1 p-1 rounded-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-slate-100'}`}>
            <button
              type="button"
              onClick={() => setStockTypeFilter('ALL')}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                stockTypeFilter === 'ALL'
                  ? (isDarkMode ? 'bg-slate-800 text-indigo-400 shadow-sm' : 'bg-white text-indigo-600 shadow-sm')
                  : 'text-slate-400'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setStockTypeFilter(SaleType.WHOLESALE)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                stockTypeFilter === SaleType.WHOLESALE
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                  : 'text-slate-400'
              }`}
            >
              Atacado
            </button>
            <button
              type="button"
              onClick={() => setStockTypeFilter(SaleType.RETAIL)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                stockTypeFilter === SaleType.RETAIL
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-400'
              }`}
            >
              Varejo
            </button>
          </div>
        )}

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

      {activeTab === 'clientes' && (
        <PedidosClientesPanel
          sales={sales}
          stockLots={stockLots}
          productionOrders={productionOrders}
          products={products}
          isDarkMode={isDarkMode}
          searchTerm={searchTerm}
        />
      )}

      {activeTab === 'estoque' && (
        <div className="grid grid-cols-1 gap-3">
          {filteredProducts.map((product) => (
            <StockCard
              key={product.id}
              product={isEditing ? editedStocks[product.id] || product : product}
              packagingItems={packagingItems}
              isDarkMode={isDarkMode}
              isEditing={isEditing}
              onUpdateStock={(variationId, key, value) => updateProductStock(product.id, variationId, key, value)}
              onUpdatePkgAllocations={(variationId, allocations) => handleUpdatePkgAllocations(isEditing ? (editedStocks[product.id] || product) : product, variationId, allocations)}
              onPrint={() => setProductForLabels(product)}
              poolFilter={stockTypeFilter}
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
      )}

      {activeTab === 'lotes' && (
        <StockLotsPanel stockLots={stockLots} isDarkMode={isDarkMode} searchTerm={searchTerm} />
      )}

      <StockEntryHistoryModal
        isOpen={showEntryHistory}
        onClose={() => setShowEntryHistory(false)}
        stockLots={stockLots}
        isDarkMode={isDarkMode}
        onPreviewRevertStockLot={onPreviewRevertStockLot}
        onRevertStockLot={onRevertStockLot}
      />

      <Modal
        isOpen={showFixAllocModal}
        onClose={() => setShowFixAllocModal(false)}
        title="Correção de Embalagens"
        icon={<Wrench size={20} />}
        maxWidth="max-w-sm"
      >
        {fixAllocResult && (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${fixAllocResult.fixed > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
              <CheckCircle2 size={32} strokeWidth={2.5} />
            </div>
            <div>
              <p className={`text-2xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {fixAllocResult.fixed} de {fixAllocResult.total}
              </p>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {fixAllocResult.fixed > 0
                  ? `${fixAllocResult.fixed} produto(s) tinham embalagem alocada além do estoque e foram corrigidos.`
                  : 'Nenhuma inconsistência encontrada — estoque e embalagens já estão consistentes.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFixAllocModal(false)}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
            >
              Fechar
            </button>
          </div>
        )}
      </Modal>

      <StockDuplicateDiagnosticModal
        isOpen={showStockDiagnosticModal}
        onClose={() => setShowStockDiagnosticModal(false)}
        isDarkMode={isDarkMode}
        groups={duplicateStockByRefColor}
        onMarkResolved={markStockDuplicatesResolved}
      />

      <Modal
        isOpen={showConfigMenu}
        onClose={() => setShowConfigMenu(false)}
        title="Configurar Estoque"
        icon={<Settings size={20} />}
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => { setShowConfigMenu(false); setShowEntryHistory(true); }}
            className={`w-full flex items-center gap-2 px-4 py-3 rounded-[1.2rem] transition-all active:scale-[0.99] ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-300' : 'bg-slate-50 border border-slate-100 text-slate-500'}`}
            title="Histórico de Entradas em Estoque"
            aria-label="Abrir histórico de entradas em estoque"
          >
            <History size={16} strokeWidth={2.5} className="text-yellow-500" />
            <span className="text-[10px] font-black uppercase tracking-widest">Histórico de Entradas em Estoque</span>
          </button>

          {onFixPkgAllocations && (
            <button
              type="button"
              disabled={fixingAlloc}
              onClick={async () => {
                setFixingAlloc(true);
                try {
                  const result = await onFixPkgAllocations();
                  setFixAllocResult(result);
                  setShowConfigMenu(false);
                  setShowFixAllocModal(true);
                } finally {
                  setFixingAlloc(false);
                }
              }}
              className={`w-full flex items-center justify-between gap-2 px-4 py-3 rounded-[1.2rem] transition-all active:scale-[0.99] disabled:opacity-60 ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-300' : 'bg-slate-50 border border-slate-100 text-slate-500'}`}
              title="Corrigir alocações de embalagem inconsistentes"
              aria-label="Corrigir inconsistências nas alocações de embalagem"
            >
              <div className="flex items-center gap-2">
                <Wrench size={16} strokeWidth={2.5} className={pkgAllocIssuesCount > 0 ? 'text-orange-500' : 'text-emerald-500'} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {fixingAlloc ? 'Corrigindo...' : 'Corrigir Alocações de Embalagem'}
                </span>
              </div>
              {!fixingAlloc && (
                pkgAllocIssuesCount > 0 ? (
                  <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-black shrink-0">
                    {pkgAllocIssuesCount}
                  </span>
                ) : (
                  <CheckCircle2 size={16} strokeWidth={2.5} className="text-emerald-500 shrink-0" />
                )
              )}
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ─── Pedidos de Clientes ────────────────────────────────────────────────────

// Precisa ficar em escopo de módulo (fora de PedidosClientesPanel) — definida dentro, era
// recriada como um componente NOVO a cada render do painel (qualquer state mudando: busca,
// balanço, etc.), e o React desmontava/remontava a Section inteira, resetando `open` pro
// `defaultOpen` sempre. Por isso os acordeões nunca ficavam abertos/fechados de propósito.
const Section: React.FC<{
  title: string; icon: React.ReactNode; color: string; items: Sale[]; defaultOpen?: boolean;
  isDarkMode: boolean; renderItem: (item: Sale) => React.ReactNode;
}> = ({ title, icon, color, items, defaultOpen = true, isDarkMode, renderItem }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center justify-between gap-3 p-3 rounded-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100 shadow-sm'}`}
      >
        <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          <span className={color}>{icon}</span> {title}
        </h3>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
            {items.length}
          </span>
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        items.length === 0 ? (
          <div className={`p-8 text-center border-2 border-dashed rounded-3xl ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
            <p className="text-xs font-bold uppercase tracking-widest">Nenhum pedido</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(renderItem)}
          </div>
        )
      )}
    </div>
  );
};

const PedidosClientesPanel: React.FC<{
  sales: Sale[];
  stockLots: StockLot[];
  productionOrders: ProductionOrder[];
  products: Product[];
  isDarkMode: boolean;
  searchTerm: string;
}> = ({ sales, stockLots, productionOrders, products, isDarkMode, searchTerm }) => {
  const term = searchTerm.toLowerCase();

  // RESERVADO lots grouped by saleId
  const reservedBySale = useMemo(() => {
    const map = new Map<string, StockLot[]>();
    stockLots.filter(l => l.status === 'RESERVADO' && l.saleId).forEach(l => {
      const arr = map.get(l.saleId!) || [];
      arr.push(l);
      map.set(l.saleId!, arr);
    });
    return map;
  }, [stockLots]);

  // Quantidade já disponível no estoque comum para os itens ainda não separados de
  // uma venda SEM ordem de produção — vendas com produção só podem separar a partir do
  // lote reservado (nunca caem no estoque agregado), por isso retornam sempre 0 aqui.
  const getStockReadyQty = (sale: Sale) => {
    if (sale.productionOrderId) return 0;
    return sale.items.reduce((sum, item) => {
      if (item.fulfilled === true) return sum;
      const needed = item.quantity - (item.boxesSeparated || 0);
      if (needed <= 0) return sum;
      const product = products.find(p => p.id === item.productId);
      const variation = product?.variations.find(v => v.id === item.variationId);
      const key = item.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (item.size || '');
      const available = variation?.stock[key] || 0;
      return sum + Math.min(available, needed);
    }, 0);
  };

  // Customer orders: all non-cancelled SALE status orders, excluding explicit STOCK destination
  const customerSales = useMemo(() => {
    return sales
      .filter(s =>
        s.status === SaleStatus.SALE &&
        s.saleDestination !== 'STOCK' &&
        (
          !term ||
          (s.customerName || '').toLowerCase().includes(term) ||
          (s.orderNumber || '').toLowerCase().includes(term)
        )
      )
      .sort((a, b) => b.date - a.date);
  }, [sales, term]);

  // Pronta para expedir: tem lote reservado da produção OU (sem ordem de produção)
  // já tem estoque comum suficiente para separar pelo menos um item. Sem nenhum dos
  // dois, é uma venda genuinamente aguardando — produção, no caso de pedidos com OP, ou
  // reposição de estoque, no caso de vendas de estoque comum.
  const isReadyToShip = (s: Sale) =>
    (reservedBySale.get(s.id) || []).length > 0 || getStockReadyQty(s) > 0;

  const prontos = customerSales.filter(s => s.deliveryStatus !== 'DELIVERED' && isReadyToShip(s));
  const aguardando = customerSales.filter(s => s.deliveryStatus !== 'DELIVERED' && !isReadyToShip(s));
  const entregues = customerSales.filter(s => s.deliveryStatus === 'DELIVERED');

  const SaleRow: React.FC<{ sale: Sale }> = ({ sale }) => {
    const lots = reservedBySale.get(sale.id) || [];
    const po = productionOrders.find(o => o.id === sale.productionOrderId);
    const stockReadyQty = getStockReadyQty(sale);
    const fromGeneralStock = lots.length === 0 && stockReadyQty > 0;
    const totalBoxes = lots.reduce((s, l) => s + (l.boxQty ?? 1), 0);
    const totalPairs = lots.reduce((s, l) => s + l.totalPairs, 0);
    const isDelivered = sale.deliveryStatus === 'DELIVERED';
    const isReady = !isDelivered && (lots.length > 0 || stockReadyQty > 0);
    const isWaiting = !isDelivered && !isReady;

    return (
      <div className={`p-3 rounded-2xl border ${
        isDelivered
          ? (isDarkMode ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-100')
          : isReady
            ? (isDarkMode ? 'bg-emerald-900/15 border-emerald-800/40' : 'bg-emerald-50 border-emerald-100')
            : (isDarkMode ? 'bg-orange-900/15 border-orange-800/30' : 'bg-orange-50 border-orange-100')
      }`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                isDelivered
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  : isReady
                    ? 'bg-emerald-500 text-white'
                    : 'bg-orange-400 text-white'
              }`}>
                {isDelivered ? 'Entregue' : isReady ? 'Pronto para Expedir' : 'Aguardando'}
              </span>
              <span className="text-[9px] font-bold text-slate-400">#{sale.orderNumber}</span>
            </div>
            <p className={`text-[12px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              {sale.customerName || 'Cliente não informado'}
            </p>
          </div>
          <div className="text-right shrink-0">
            {isReady && lots.length > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">{totalBoxes} cx</span>
                <span className="text-[9px] font-bold text-slate-400">{totalPairs} pares</span>
              </div>
            )}
            {isReady && fromGeneralStock && (
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                  {stockReadyQty} {sale.items.some(it => it.saleType === SaleType.WHOLESALE) ? 'cx' : 'pares'}
                </span>
                <span className="text-[9px] font-bold text-slate-400">estoque comum</span>
              </div>
            )}
            {isWaiting && po && (
              <span className="text-[9px] font-black uppercase tracking-widest text-orange-500">
                {po.status === 'IN_PRODUCTION' ? 'Em Produção' : 'Ag. Produção'}
              </span>
            )}
          </div>
        </div>

        {/* Lot details (when ready) */}
        {isReady && lots.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {lots.map(lot => {
              const prod = products.find(p => p.id === lot.productId);
              return (
                <div key={lot.id} className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl ${isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-100/60'}`}>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-black uppercase truncate ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>
                      {prod?.reference ? `${prod.reference} · ` : ''}{lot.productName}
                    </p>
                    <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-500 mt-0.5">
                      {lot.variationName} · {lot.gradeLabel}
                    </p>
                  </div>
                  <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 shrink-0">
                    {lot.boxQty ?? 1} cx
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Production order link */}
        {po && !isDelivered && (
          <div className={`mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg ${isDarkMode ? 'bg-slate-800/60' : 'bg-white/70'}`}>
            <Factory size={10} className="text-indigo-500 shrink-0" />
            <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500">
              OP #{po.orderNumber} · {po.status === 'COMPLETED' ? 'Concluída' : po.status === 'IN_PRODUCTION' ? 'Em Produção' : 'Pendente'}
            </span>
          </div>
        )}
      </div>
    );
  };

  if (customerSales.length === 0 && !term) {
    return (
      <div className={`p-12 text-center border-2 border-dashed rounded-3xl ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
        <Users size={40} className="mx-auto mb-3 opacity-20" />
        <p className="text-xs font-bold uppercase tracking-widest">Nenhum pedido de cliente</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Prontos para Expedir"
        icon={<Truck size={16} />}
        color="text-emerald-500"
        items={prontos}
        defaultOpen={false}
        isDarkMode={isDarkMode}
        renderItem={(s) => <SaleRow key={s.id} sale={s} />}
      />
      <Section
        title="Aguardando Expedição"
        icon={<Clock size={16} />}
        color="text-orange-500"
        items={aguardando}
        defaultOpen={false}
        isDarkMode={isDarkMode}
        renderItem={(s) => <SaleRow key={s.id} sale={s} />}
      />
      {entregues.length > 0 && (
        <Section
          title="Entregues"
          icon={<CheckCircle2 size={16} />}
          color="text-slate-400"
          items={entregues}
          defaultOpen={false}
          isDarkMode={isDarkMode}
          renderItem={(s) => <SaleRow key={s.id} sale={s} />}
        />
      )}
    </div>
  );
};

// ─── Lotes em Estoque ────────────────────────────────────────────────────────

const StockLotsPanel: React.FC<{
  stockLots: StockLot[];
  isDarkMode: boolean;
  searchTerm: string;
}> = ({ stockLots, isDarkMode, searchTerm }) => {
  const term = searchTerm.toLowerCase();

  const filtered = useMemo(() => stockLots.filter(l =>
    l.productName.toLowerCase().includes(term) ||
    l.variationName.toLowerCase().includes(term) ||
    (l.customerName || '').toLowerCase().includes(term)
  ), [stockLots, term]);

  const emEstoque = filtered.filter(l => l.status === 'EM_ESTOQUE');
  const reservado = filtered.filter(l => l.status === 'RESERVADO');

  const totalPairs = (lots: StockLot[]) => lots.reduce((s, l) => s + l.totalPairs, 0);
  // boxQty representa quantas caixas aquela entrada cobre (ex.: 8 caixas de 12 pares).
  // Entradas sem boxQty (produtos sem embalagem padrão) contam como 1 caixa cada.
  const totalBoxes = (lots: StockLot[]) => lots.reduce((s, l) => s + (l.boxQty ?? 1), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-violet-100 dark:bg-violet-950/30">
          <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            <Boxes size={16} className="text-indigo-500" /> Registro de Produção
          </h3>
          <div className="px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-violet-700 text-white text-center leading-tight">
            <p>{totalBoxes(emEstoque)} caixa(s)</p>
            <p>{totalPairs(emEstoque)} pares</p>
          </div>
        </div>

        {emEstoque.length === 0 ? (
          <div className={`p-8 text-center border-2 border-dashed rounded-3xl ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
            <Boxes size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">Nenhuma caixa em estoque livre</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {emEstoque.map(lot => (
              <StockLotCard key={lot.id} lot={lot} isDarkMode={isDarkMode} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-violet-100 dark:bg-violet-950/30">
          <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            <User size={16} className="text-sky-500" /> Reservado p/ Pedidos
          </h3>
          <div className="px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-violet-700 text-white text-center leading-tight">
            <p>{totalBoxes(reservado)} caixa(s)</p>
            <p>{totalPairs(reservado)} pares</p>
          </div>
        </div>

        {reservado.length === 0 ? (
          <div className={`p-8 text-center border-2 border-dashed rounded-3xl ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
            <User size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">Nenhuma caixa reservada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {reservado.map(lot => (
              <StockLotCard key={lot.id} lot={lot} isDarkMode={isDarkMode} showCustomer />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StockEntryHistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  stockLots: StockLot[];
  isDarkMode: boolean;
  onPreviewRevertStockLot?: (stockLot: StockLot) => StockLotRevertPreview;
  onRevertStockLot?: (stockLot: StockLot) => Promise<StockLotRevertPreview>;
}> = ({ isOpen, onClose, stockLots, isDarkMode, onPreviewRevertStockLot, onRevertStockLot }) => {
  const [term, setTerm] = useState('');
  const [revertTarget, setRevertTarget] = useState<{ lot: StockLot; preview: StockLotRevertPreview } | null>(null);
  const [revertStatus, setRevertStatus] = useState<'confirm' | 'loading' | 'done'>('confirm');

  const filtered = useMemo(() => {
    const t = term.toLowerCase();
    return stockLots
      .filter(l =>
        l.productName.toLowerCase().includes(t) ||
        (l.productReference || '').toLowerCase().includes(t) ||
        l.variationName.toLowerCase().includes(t) ||
        (l.customerName || '').toLowerCase().includes(t) ||
        (l.saleOrderNumber || '').toLowerCase().includes(t) ||
        (l.productionOrderNumber || '').toLowerCase().includes(t) ||
        (l.lotOrderNumber || '').toLowerCase().includes(t)
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [stockLots, term]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Histórico de Entradas em Estoque" icon={<History size={20} />} maxWidth="max-w-2xl">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por produto, mapa, pedido ou cliente..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="Buscar no histórico de entradas em estoque"
            className={`w-full border rounded-xl py-3 pl-11 pr-4 text-[11px] font-bold uppercase tracking-widest outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
          />
        </div>

        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
          {filtered.length === 0 && (
            <div className={`p-8 text-center border-2 border-dashed rounded-3xl ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
              <History size={32} className="mx-auto mb-2 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">Nenhuma entrada encontrada</p>
            </div>
          )}
          {filtered.map(lot => {
            const isStockDestination = !lot.customerName || lot.customerName === 'Estoque';
            const orderNumber = lot.productionOrderNumber || lot.saleOrderNumber;
            const sizeEntries = Object.entries(lot.sizeBreakdown || {})
              .sort(([a], [b]) => parseFloat(a) - parseFloat(b));
            return (
              <div key={lot.id} className={`p-4 rounded-2xl border flex flex-col gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">
                    {lot.productReference && <span className="text-indigo-500 mr-1">{lot.productReference}</span>}
                    {lot.productName} · {lot.variationName}
                  </p>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">{new Date(lot.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  {lot.boxQty !== undefined ? (
                    <>
                      <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{lot.boxQty}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">caixas · {lot.totalPairs} pares</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{lot.totalPairs}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">pares</span>
                    </>
                  )}
                </div>

                {sizeEntries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sizeEntries.map(([sz, qty]) => (
                      <div key={sz} className={`px-2.5 py-1.5 rounded-xl border-2 text-center min-w-[36px] ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <p className="text-[7px] font-bold text-slate-400 leading-none">{sz}</p>
                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 leading-none mt-0.5">{qty}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {lot.lotOrderNumber && (
                    <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      Mapa #{lot.lotOrderNumber}
                    </span>
                  )}
                  {orderNumber && (
                    <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      Pedido #{orderNumber}
                    </span>
                  )}
                  <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide ${isStockDestination ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400'}`}>
                    {isStockDestination ? 'Estoque' : lot.customerName}
                  </span>
                  {lot.boxQty !== undefined && (
                    <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                      {lot.pkgName || 'Avulso'}
                    </span>
                  )}
                </div>

                {onPreviewRevertStockLot && onRevertStockLot && (
                  <button
                    type="button"
                    onClick={() => {
                      setRevertTarget({ lot, preview: onPreviewRevertStockLot(lot) });
                      setRevertStatus('confirm');
                    }}
                    className="self-end px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <RotateCcw size={12} strokeWidth={3} />
                    Reverter
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <StockLotRevertModal
        target={revertTarget}
        status={revertStatus}
        isDarkMode={isDarkMode}
        onCancel={() => { if (revertStatus !== 'loading') setRevertTarget(null); }}
        onConfirm={async () => {
          if (!revertTarget || !onRevertStockLot) return;
          setRevertStatus('loading');
          await onRevertStockLot(revertTarget.lot);
          setRevertStatus('done');
        }}
        onClose={() => setRevertTarget(null)}
      />
    </Modal>
  );
};

const StockLotRevertModal: React.FC<{
  target: { lot: StockLot; preview: StockLotRevertPreview } | null;
  status: 'confirm' | 'loading' | 'done';
  isDarkMode: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ target, status, isDarkMode, onCancel, onConfirm, onClose }) => {
  if (!target) return null;
  const { preview } = target;

  return (
    <Modal
      isOpen={!!target}
      onClose={status === 'done' ? onClose : onCancel}
      title={status === 'done' ? 'Reversão Concluída' : 'Reverter Entrada de Estoque'}
      icon={<RotateCcw size={20} />}
      maxWidth="max-w-lg"
      closeLabel={status === 'done' ? 'Entendido' : 'Voltar'}
    >
      <div className="flex flex-col gap-4">
        <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
          <p className={`text-xs font-bold uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {preview.productReference && <span className="text-indigo-500 mr-1">{preview.productReference}</span>}
            {preview.productName} · {preview.variationName}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {preview.gradeLabel}
          </p>
        </div>

        {status !== 'done' && (
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
            Isso vai remover esta entrada do estoque do produto, repor os solados que foram consumidos e devolver o pedido para Expedição. Confira as quantidades abaixo:
          </p>
        )}

        {preview.stockReverted && preview.productStockRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <TrendingDown size={12} strokeWidth={3} /> Estoque do Produto (vai diminuir)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {preview.productStockRows.map(row => (
                <div key={row.label} className={`px-2.5 py-1.5 rounded-xl border-2 text-center min-w-[52px] ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <p className="text-[10px] font-bold text-black dark:text-white leading-none">{row.label}</p>
                  <p className="text-[10px] font-black leading-none mt-1 flex items-center justify-center gap-1">
                    <span className="text-slate-400">{row.before}</span>
                    <ChevronRight size={10} strokeWidth={3} className="text-slate-300" />
                    <span className="text-rose-600 dark:text-rose-400">{row.after}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {preview.sole && preview.sole.rows.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <TrendingUp size={12} strokeWidth={3} /> Estoque de Solados (vai repor) — {preview.sole.moldName} · {preview.sole.colorName}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {preview.sole.rows.map(row => (
                <div key={row.size} className={`px-2.5 py-1.5 rounded-xl border-2 text-center min-w-[52px] ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <p className="text-[7px] font-bold text-slate-400 leading-none">{row.size}</p>
                  <p className="text-[10px] font-black leading-none mt-1 flex items-center justify-center gap-1">
                    <span className="text-slate-400">{row.before}</span>
                    <ChevronRight size={10} strokeWidth={3} className="text-slate-300" />
                    <span className="text-emerald-600 dark:text-emerald-400">{row.after}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {preview.orderReturnedToExpedicao && (
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Boxes size={12} strokeWidth={3} />
            </span>
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
              Pedido {preview.orderNumber ? <>#{preview.orderNumber} </> : ''}{status === 'done' ? 'devolvido' : 'será devolvido'} para <span className="font-black">Expedição</span>{preview.lotOrderNumber ? <> no Mapa #{preview.lotOrderNumber}</> : ''}.
              {preview.lotReopened && (status === 'done' ? ' O mapa foi reaberto.' : ' O mapa será reaberto.')}
            </p>
          </div>
        )}

        {status === 'done' && (
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <RotateCcw size={12} strokeWidth={3} />
            </span>
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
              Reversão concluída com sucesso.
            </p>
          </div>
        )}

        {status !== 'done' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={status === 'loading'}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={status === 'loading'}
              className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 active:scale-95"
            >
              {status === 'loading' ? 'Revertendo...' : 'Confirmar Reversão'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

const StockLotCard: React.FC<{
  lot: StockLot;
  isDarkMode: boolean;
  showCustomer?: boolean;
}> = ({ lot, isDarkMode, showCustomer }) => {
  const orderNumber = lot.productionOrderNumber || lot.saleOrderNumber;
  const sizeEntries = Object.entries(lot.sizeBreakdown || {})
    .sort(([a], [b]) => parseFloat(a) - parseFloat(b));

  return (
    <div className={`p-4 rounded-2xl border flex flex-col gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
      <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">
        {lot.productReference && <span className="text-indigo-500 mr-1">{lot.productReference}</span>}
        {lot.productName} · {lot.variationName}
      </p>

      <div className="flex items-baseline gap-1.5">
        {lot.boxQty !== undefined ? (
          <>
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{lot.boxQty}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">caixas · {lot.totalPairs} pares</span>
          </>
        ) : (
          <>
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{lot.totalPairs}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">pares</span>
          </>
        )}
      </div>

      {sizeEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sizeEntries.map(([sz, qty]) => (
            <div key={sz} className={`px-2.5 py-1.5 rounded-xl border-2 text-center min-w-[36px] ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}>
              <p className="text-[7px] font-bold text-slate-400 leading-none">{sz}</p>
              <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 leading-none mt-0.5">{qty}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {lot.lotOrderNumber && (
          <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            Mapa #{lot.lotOrderNumber}
          </span>
        )}
        {orderNumber && (
          <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            Pedido #{orderNumber}
          </span>
        )}
        {showCustomer && lot.customerName && (
          <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
            {lot.customerName}
          </span>
        )}
        {lot.boxQty !== undefined && (
          <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            {lot.pkgName || 'Avulso'}
          </span>
        )}
      </div>
    </div>
  );
};

const StockCard: React.FC<{
  product: Product;
  packagingItems: ProductionConfigItem[];
  isDarkMode: boolean;
  isEditing: boolean;
  onUpdateStock: (variationId: string, key: string, value: number) => void;
  onUpdatePkgAllocations: (variationId: string, allocations: StockPkgAllocation[]) => void;
  onPrint: () => void;
  poolFilter?: 'ALL' | SaleType.WHOLESALE | SaleType.RETAIL;
}> = ({ product, packagingItems, isDarkMode, isEditing, onUpdateStock, onUpdatePkgAllocations, onPrint, poolFilter = 'ALL' }) => {
  // Padrão "avulso a escolha do cliente" (sem tamanhos fixos) — referência de
  // capacidade para alocações avulsas que não correspondem a nenhuma embalagem cadastrada.
  const avulsoPkg = packagingItems.find(p => p.metadata?.mode === 'FREE');
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [expandedVars, setExpandedVars] = useState<string[]>([]);
  const [expandedPackaging, setExpandedPackaging] = useState<string[]>([]);
  const [expandedCompositions, setExpandedCompositions] = useState<string[]>([]);
  const [gradePopup, setGradePopup] = useState<{
    varId: string;
    colorName: string;
    looseQty: number;
    pkgBreakdown?: Record<string, number>;
    pkgSizes?: string[];
    pkgCapacity: number;
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

  const hybrid = isHybridProduct(product);
  const hasWholesale = productHasSaleType(product, SaleType.WHOLESALE);
  const hasRetail = productHasSaleType(product, SaleType.RETAIL);
  // Filtro Atacado/Varejo (toggle no topo da aba Estoque): em produto híbrido,
  // restringe quais das duas seções aparecem nesta capsula sem afetar os dados.
  const showWholesale = hasWholesale && poolFilter !== SaleType.RETAIL;
  const showRetail = hasRetail && poolFilter !== SaleType.WHOLESALE;
  const wholesaleBoxesTotal = product.variations.reduce((acc, v) => acc + getWholesaleBoxes(product, v), 0);
  const retailPairsTotal = product.variations.reduce((acc, v) => acc + getRetailPairs(product, v), 0);
  const isWholesaleLow = wholesaleBoxesTotal <= product.minStockInBoxes;
  const isRetailLow = retailPairsTotal <= (product.minStockRetailPairs ?? 0);

  const totalStock = hybrid
    ? wholesaleBoxesTotal + retailPairsTotal
    : product.variations.reduce((acc, v) => {
        return acc + (product.type === SaleType.WHOLESALE ? (v.stock['WHOLESALE'] || 0) : (Object.values(v.stock) as number[]).reduce((sum, s) => sum + s, 0));
      }, 0);

  const isLowStock = hybrid ? (isWholesaleLow || isRetailLow) : totalStock <= product.minStockInBoxes * 12;

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
      <button
        type="button"
        onClick={() => setIsCollapsed(v => !v)}
        className="flex items-start justify-between gap-3 text-left"
        aria-label={isCollapsed ? `Expandir ${product.reference}` : `Recolher ${product.reference}`}
      >
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
        <div className="flex items-center gap-2 shrink-0">
          <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isLowStock ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20'}`}>
            {isLowStock ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
            {isLowStock ? 'Baixo' : 'OK'}
          </div>
          {isCollapsed
            ? <ChevronRight size={18} className="text-orange-500" />
            : <ChevronDown size={18} className="text-orange-500" />
          }
        </div>
      </button>

      {!isCollapsed && (
      <>
      {/* Totais */}
      {hybrid ? (
        <div className="flex flex-col gap-4 py-5 border-y border-slate-100 dark:border-slate-800">
          {showWholesale && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Estoque Atacado</p>
                <p className={`text-2xl font-black italic tracking-tighter ${isWholesaleLow ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                  {wholesaleBoxesTotal}
                </p>
                <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">CAIXAS</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Mínimo</p>
                <p className="text-2xl font-black italic tracking-tighter text-indigo-500">{product.minStockInBoxes}</p>
                <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">CAIXAS</p>
              </div>
            </div>
          )}
          {showRetail && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Estoque Varejo</p>
                <p className={`text-2xl font-black italic tracking-tighter ${isRetailLow ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                  {retailPairsTotal}
                </p>
                <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">PARES</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Mínimo</p>
                <p className="text-2xl font-black italic tracking-tighter text-indigo-500">{product.minStockRetailPairs ?? 0}</p>
                <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">PARES</p>
              </div>
            </div>
          )}
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
      ) : (
        <div className="grid grid-cols-2 gap-4 py-5 border-y border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Estoque Total</p>
              <p className={`text-3xl font-black italic tracking-tighter ${isLowStock ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                {totalStock}
              </p>
              <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">{product.type === SaleType.WHOLESALE ? 'CAIXAS' : 'UNIDADES'}</p>
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
      )}

      {/* Variações */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Variações em Estoque</p>
        <div className="space-y-2">
          {product.variations.map(v => {
            const varStock = hybrid ? getRetailPairs(product, v) : (Object.values(v.stock) as number[]).reduce((sum, s) => sum + s, 0);
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
                  className="w-full flex items-start justify-between px-4 py-4 active:opacity-70 transition-opacity"
                  aria-label={`${isExpanded ? 'Recolher' : 'Expandir'} variação ${v.colorName}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-600 shadow-sm shrink-0" style={{ backgroundColor: v.color }} />
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none mb-0.5">{product.reference}</p>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase">{v.colorName}</span>
                      {showWholesale && (allocations.some(a => a.qty > 0) || boxQty - totalAllocated > 0) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {allocations.filter(a => a.qty > 0).map((a, i) => {
                            const pkg = packagingItems.find(p => p.id === a.pkgId);
                            return (
                              <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 max-w-full overflow-hidden">
                                <span className="text-[9px] font-black uppercase tracking-wide truncate min-w-0">{pkg?.name || 'Avulso'}</span>
                                <span className="text-[9px] font-black uppercase tracking-wide shrink-0">{a.qty} CX</span>
                              </div>
                            );
                          })}
                          {boxQty - totalAllocated > 0 && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 max-w-full overflow-hidden">
                              <span className="text-[9px] font-black uppercase tracking-wide truncate min-w-0">Avulso</span>
                              <span className="text-[9px] font-black uppercase tracking-wide shrink-0">{boxQty - totalAllocated} CX</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {hybrid ? (
                      <div className="flex items-center gap-2">
                        {showWholesale && (
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-black text-amber-600 dark:text-amber-400 leading-none">{boxQty}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">CX</span>
                          </div>
                        )}
                        {showRetail && (
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 leading-none">{varStock}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">UN</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-base font-black text-indigo-600 dark:text-indigo-400 leading-none">
                          {product.type === SaleType.WHOLESALE ? boxQty : varStock}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{product.type === SaleType.WHOLESALE ? 'CX' : 'UN'}</span>
                      </div>
                    )}
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
                    {showRetail && (
                      <div className="p-3 flex flex-col gap-2">
                        {hybrid && (
                          <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest px-1">Varejo</p>
                        )}
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {Object.entries(v.stock).filter(([size]) => size !== 'WHOLESALE').map(([size, qty]) => (
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
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    value={qty as number}
                                    onChange={(e) => onUpdateStock(v.id, size, Math.max(0, Number(e.target.value) || 0))}
                                    onFocus={(e) => e.target.select()}
                                    title={`Editar tamanho ${size}`}
                                    aria-label={`Editar tamanho ${size}`}
                                    className="w-10 text-center text-base font-black text-slate-900 dark:text-white bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-500/30 rounded-lg [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                  />
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
                    {showWholesale && (
                      <>
                        {hybrid && (
                          <p className={`text-[9px] font-black text-amber-500 uppercase tracking-widest px-3 pt-3 ${showRetail ? `border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}` : ''}`}>Atacado</p>
                        )}
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
                              <input
                                type="number"
                                inputMode="numeric"
                                value={boxQty}
                                onChange={(e) => onUpdateStock(v.id, 'WHOLESALE', Math.max(0, Number(e.target.value) || 0))}
                                onFocus={(e) => e.target.select()}
                                title="Editar quantidade de caixas"
                                aria-label="Editar quantidade de caixas"
                                className="w-14 text-center text-xl font-black text-slate-900 dark:text-white bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-500/30 rounded-lg [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              />
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
                              <span className="text-xs font-bold text-slate-400 uppercase">caixas</span>
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
                              {isEditing && (
                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                  Editável
                                </span>
                              )}
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
                                        <input
                                          type="number"
                                          inputMode="numeric"
                                          value={alloc.qty}
                                          onChange={(e) => {
                                            const maxAllowed = boxQty - (totalAllocated - alloc.qty);
                                            const next = Math.max(0, Math.min(maxAllowed, Number(e.target.value) || 0));
                                            const updated = [...allocations];
                                            updated[idx] = { ...alloc, qty: next };
                                            onUpdatePkgAllocations(v.id, updated);
                                          }}
                                          onFocus={(e) => e.target.select()}
                                          title="Editar quantidade"
                                          aria-label="Editar quantidade"
                                          className="w-10 text-center text-base font-black text-slate-900 dark:text-white bg-transparent border-none outline-none focus:ring-2 focus:ring-indigo-500/30 rounded-lg shrink-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                        />
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

                                    {/* Composição manual para embalagens sem breakdown (avulso) — grade sempre visível */}
                                    {alloc.qty > 0 && (!pkgBreakdown || pkgSizes.length === 0) && (() => {
                                      const hasCustom = !!alloc.customBreakdown && Object.keys(alloc.customBreakdown).length > 0;
                                      const refPkg = packagingItems.find(p => (p.metadata?.sizes as string[] | undefined)?.length);
                                      const refSizes = refPkg?.metadata?.sizes as string[] | undefined;
                                      const breakdownEntries: [string, number][] = hasCustom
                                        ? Object.entries(alloc.customBreakdown!)
                                        : (refSizes || []).map(s => [s, 0] as [string, number]);
                                      const visibleEntries = breakdownEntries.filter(([, qty]) => qty > 0);

                                      return (
                                        <div className="flex flex-col gap-2">
                                          {visibleEntries.length > 0 && (
                                            <div className={`rounded-xl overflow-hidden border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                              <div className={`grid grid-cols-3 px-4 py-2 text-xs font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                                                <span>Tam</span>
                                                <span className="text-center">Por Grade</span>
                                                <span className="text-right text-indigo-500">Total</span>
                                              </div>
                                              {visibleEntries.map(([size, perGrade]) => (
                                                <div key={size} className={`grid grid-cols-3 px-4 py-2.5 text-sm border-t ${isDarkMode ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-100 bg-white text-slate-900'}`}>
                                                  <span className="font-black">{size}</span>
                                                  <span className="text-center font-bold text-slate-500">{perGrade}</span>
                                                  <span className="text-right font-black text-indigo-500">{perGrade * alloc.qty}</span>
                                                </div>
                                              ))}
                                              <div className={`grid grid-cols-3 px-4 py-2.5 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                                                <span className={`text-xs font-black uppercase col-span-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Total Pares</span>
                                                <span className="text-right text-sm font-black text-indigo-500">
                                                  {visibleEntries.reduce((s, [, q]) => s + q, 0) * alloc.qty}
                                                </span>
                                              </div>
                                            </div>
                                          )}
                                          {hasCustom ? (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setAllocPopup({ varId: v.id, allocIdx: idx, pkgId: alloc.pkgId, pkgName: pkg?.name || 'Avulso', qty: alloc.qty, pkgCapacity: resolvePkgCapacity(pkg || avulsoPkg), sizeInput: { ...alloc.customBreakdown! } });
                                              }}
                                              className="flex items-center gap-1.5 text-xs font-black text-slate-400 hover:text-indigo-500 transition-colors w-fit"
                                            >
                                              <ClipboardList size={12} /> Editar composição
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setAllocPopup({
                                                  varId: v.id,
                                                  allocIdx: idx,
                                                  pkgId: alloc.pkgId,
                                                  pkgName: pkg?.name || 'Avulso',
                                                  qty: alloc.qty,
                                                  pkgCapacity: resolvePkgCapacity(pkg || avulsoPkg || refPkg),
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
                                      );
                                    })()}
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
                                      {totalAllocated} / {boxQty} caixas
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
                                          pkgCapacity: resolvePkgCapacity(avulsoPkg || firstPkgWithBreakdown),
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
      </>
      )}

      {/* Popup — registro de grades avulsas */}
      {gradePopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
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
              {(() => {
                const totalPairsInput = Object.values(gradePopup.sizeInput).reduce((s, q) => s + q, 0);
                const capacity = gradePopup.pkgCapacity;
                const atCapacity = capacity > 0 && totalPairsInput >= capacity;
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                        Registre a composição por tamanho de{gradePopup.looseQty > 1 ? ' cada' : ' a'} grade avulsa para controle interno.
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
                          disabled={atCapacity}
                          onClick={() => setGradePopup(prev => {
                            if (!prev) return null;
                            const cap = prev.pkgCapacity;
                            const total = Object.values(prev.sizeInput).reduce((s, q) => s + q, 0);
                            if (cap > 0 && total >= cap) return prev;
                            return { ...prev, sizeInput: { ...prev.sizeInput, [size]: (prev.sizeInput[size] || 0) + 1 } };
                          })}
                          className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center text-xs font-black hover:bg-indigo-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >+</button>
                      </div>
                      <span className="text-right text-sm font-black text-amber-500">{qty * gradePopup.looseQty}</span>
                    </div>
                  ))}
                  <div className={`grid grid-cols-3 px-4 py-2.5 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                    <span className={`text-xs font-black uppercase col-span-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Total Pares</span>
                    <span className={`text-right text-sm font-black ${atCapacity ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {totalPairsInput * gradePopup.looseQty}
                    </span>
                  </div>
                </div>
                    ) : (
                <div className={`p-4 rounded-xl text-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <p className="text-xs text-slate-500 font-bold mb-3">Nenhum tamanho de referência disponível.</p>
                  <p className="text-[10px] text-slate-400">Configure uma embalagem padrão para este produto para ter tamanhos disponíveis.</p>
                </div>
                    )}
                  </>
                );
              })()}
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
                  const newCapacity = resolvePkgCapacity(selectedPkg);
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
                                onClick={() => setAllocPopup(prev => {
                                  if (!prev) return null;
                                  const cap = prev.pkgCapacity;
                                  const total = Object.values(prev.sizeInput).reduce((s, q) => s + q, 0);
                                  if (cap > 0 && total >= cap) return prev;
                                  return { ...prev, sizeInput: { ...prev.sizeInput, [size]: (prev.sizeInput[size] || 0) + 1 } };
                                })}
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

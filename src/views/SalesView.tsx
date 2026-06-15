import { useState, useMemo } from 'react';
import { Sale, SaleType, PaymentStatus, Product, Grid, SaleStatus, Person, PaymentMethod, Account, PaymentTerm, ProductionOrder, ProductionLot, Sector, AppModulesConfig, StockLot, ProductionConfigItem } from '../types';
import { ShoppingBag, TrendingUp, User, Calendar, Tag, Filter, Plus, Hash, Clock, CheckCircle2, AlertCircle, MoreVertical, Edit2, Trash2, X, Info, Box, Ban, RotateCcw, Search, MessageSquare, Copy, Share, Share2, DollarSign, History, FileText, Lightbulb, Eye, EyeOff, Maximize2, Minimize2, Check, ChevronDown, ChevronUp, Factory, Truck, PackageCheck, Boxes } from 'lucide-react';
import ProductionOrderModal from '../components/ProductionOrderModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { exportSale } from '../utils/saleExport';
import ExportNoteModal from '../components/ExportNoteModal';
import SalePaymentModal from '../components/SalePaymentModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { toast } from '../utils/toast';
import { saleProductionHasProgressed } from '../utils/productionRoute';

// Preferências de "Visualização" (Cards Compactos/Expandidos, Mostrar Produtos,
// Mostrar Grade e Quantidades, Mostrar Padrão de Embalagem) persistem entre
// navegações/recarregamentos — sem isso, voltar para a tela de Vendas sempre
// resetava essas escolhas para o padrão.
function usePersistedToggle(key: string, defaultValue: boolean): [boolean, (v: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState<boolean>(() => {
    const saved = localStorage.getItem(key);
    return saved !== null ? saved === 'true' : defaultValue;
  });
  const setPersisted = (v: boolean | ((prev: boolean) => boolean)) => {
    setValue(prev => {
      const next = typeof v === 'function' ? (v as (p: boolean) => boolean)(prev) : v;
      localStorage.setItem(key, String(next));
      return next;
    });
  };
  return [value, setPersisted];
}

interface SalesViewProps {
  sales: Sale[];
  products: Product[];
  grids: Grid[];
  people: Person[];
  paymentMethods: PaymentMethod[];
  accounts: Account[];
  productionOrders: ProductionOrder[];
  lots: ProductionLot[];
  sectors: Sector[];
  onAdd: () => void;
  onEdit: (sale: Sale) => void;
  onDelete: (id: string) => void;
  onCancelOnly: (id: string) => void;
  onCancelAndRevert: (id: string) => void;
  onConvert: (id: string) => void;
  onUpdatePaymentStatus: (id: string, status: PaymentStatus) => void;
  onPaySale: (saleId: string, amount: number, accountId: string, paymentMethodId: string, note: string) => Promise<void>;
  onUpdatePayment: (saleId: string, paymentId: string, amount: number, accountId: string, paymentMethodId: string, note: string) => Promise<void>;
  onDeletePayment: (saleId: string, paymentId: string) => Promise<void>;
  onCreateProductionOrder: (order: ProductionOrder, lots: ProductionLot[], deductions: { productId: string; variationId: string; size?: string; quantity: number }[]) => Promise<void>;
  modulesConfig: AppModulesConfig;
  isDarkMode: boolean;
  initialSearchQuery?: string;
  stockLots: StockLot[];
  onReleaseSale: (saleId: string) => Promise<void>;
  onNavigateStock: () => void;
  productionConfigs: ProductionConfigItem[];
}

export default function SalesView({
  sales,
  products,
  grids,
  people,
  paymentMethods,
  accounts,
  productionOrders,
  lots,
  sectors,
  onAdd,
  onEdit,
  onDelete,
  onCancelOnly,
  onCancelAndRevert,
  onConvert,
  onUpdatePaymentStatus,
  onPaySale,
  onUpdatePayment,
  onDeletePayment,
  onCreateProductionOrder,
  modulesConfig,
  isDarkMode,
  initialSearchQuery = '',
  stockLots,
  onReleaseSale,
  onNavigateStock,
  productionConfigs,
}: SalesViewProps) {
  const hasProduction = modulesConfig.production;
  const [filter, setFilter] = useState<'ALL' | 'RETAIL' | 'WHOLESALE'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedStatuses, setSelectedStatuses] = useState<SaleStatus[]>([SaleStatus.SALE, SaleStatus.CONFIRMED, SaleStatus.QUOTE]);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCards, setExpandedCards] = usePersistedToggle('salesView_expandedCards', false);
  const [showProducts, setShowProducts] = usePersistedToggle('salesView_showProducts', true);
  const [showGradeBreakdown, setShowGradeBreakdown] = usePersistedToggle('salesView_showGradeBreakdown', false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [paymentModalSale, setPaymentModalSale] = useState<Sale | null>(null);
  const [paymentModalMode, setPaymentModalMode] = useState<'PAYMENT' | 'HISTORY'>('PAYMENT');
  const [whatsappMode, setWhatsappMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [editingMessage, setEditingMessage] = useState<{ sale: Sale, text: string } | null>(null);
  const [noteModal, setNoteModal] = useState<{ isOpen: boolean, note: string } | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [exportModal, setExportModal] = useState<{isOpen: boolean, sale?: Sale, format: 'pdf' | 'jpg'}>({ isOpen: false, format: 'pdf' });
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [productionOrderSale, setProductionOrderSale] = useState<Sale | null>(null);
  const [itemsPopupSale, setItemsPopupSale] = useState<Sale | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleOpenExport = (e: React.MouseEvent, sale: Sale, format: 'pdf' | 'jpg') => {
    e.stopPropagation();
    setExportModal({ isOpen: true, sale, format });
  };

  const handleConfirmExport = async (note: string, format: 'pdf' | 'jpg') => {
    if (!exportModal.sale) return;
    
    try {
      await exportSale({
        sale: exportModal.sale,
        products,
        people,
        paymentMethods,
        additionalNote: note,
        isDarkMode
      }, format);
      setExportModal(prev => ({ ...prev, isOpen: false }));
    } catch (error) {
      console.error('Export error:', error);
      toast.show('Erro ao exportar venda.');
    }
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filter !== 'ALL') count++;
    if (paymentFilter !== 'ALL') count++;
    const defaultStatuses = [SaleStatus.SALE, SaleStatus.CONFIRMED, SaleStatus.QUOTE];
    const isDefaultStatuses = selectedStatuses.length === defaultStatuses.length &&
                              defaultStatuses.every(s => selectedStatuses.includes(s));
    if (!isDefaultStatuses) count++;
    return count;
  }, [filter, paymentFilter, selectedStatuses]);

  // Métricas de entrega — fechadas pelo PCP ao concluir a expedição (ver SaleStatus.SALE não cancelados)
  const deliveryStats = useMemo(() => {
    const trackedSales = sales.filter(s => s.status === SaleStatus.SALE);
    const delivered = trackedSales.filter(s => s.deliveryStatus === 'DELIVERED').length;
    const pending = trackedSales.length - delivered;
    return { delivered, pending };
  }, [sales]);

  // Lotes RESERVADO (caixas já produzidas, com a grade exata, aguardando "Liberar
  // Pedido" para o cliente), agrupados por venda.
  const reservedLotsBySale = useMemo(() => {
    const map = new Map<string, StockLot[]>();
    stockLots.filter(l => l.status === 'RESERVADO' && l.saleId).forEach(l => {
      const arr = map.get(l.saleId!) || [];
      arr.push(l);
      map.set(l.saleId!, arr);
    });
    return map;
  }, [stockLots]);

  const handleReleaseClick = (sale: Sale) => {
    const lots = reservedLotsBySale.get(sale.id) || [];
    if (lots.length === 0) return;
    const totalPairs = lots.reduce((s, l) => s + l.totalPairs, 0);
    const breakdown = lots.map(l => `${l.productName} (${l.variationName}) — ${l.gradeLabel}`).join('\n');
    const msg = `Confirmar liberação de ${lots.length} caixa(s) (${totalPairs} pares) para o pedido #${sale.orderNumber}?\n\n${breakdown}\n\nIsso marcará o pedido como ENTREGUE.`;
    if (!confirm(msg)) return;
    onReleaseSale(sale.id);
  };

  // Mapas para busca rápida O(1)
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      // Filter by Type (Retail/Wholesale)
      if (filter !== 'ALL') {
        const hasType = (s.items || []).some(item => item.saleType === filter);
        if (!hasType) return false;
      }

      // Filter by Payment Status
      if (paymentFilter !== 'ALL') {
        if (paymentFilter === 'PAID' && s.paymentStatus !== PaymentStatus.PAID) return false;
        if (paymentFilter === 'PENDING' && s.paymentStatus !== PaymentStatus.PENDING) return false;
      }

      // Filter by Status
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(s.status)) {
        return false;
      }

      // Filter by Search Query (Name or ID)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const cleanQuery = query.replace(/[()\-\s]/g, '');
        const cleanOrderNumber = s.orderNumber?.toLowerCase().replace(/[()\-\s]/g, '');
        
        const matchesName = s.customerName?.toLowerCase().includes(query);
        const matchesId = cleanOrderNumber && cleanQuery ? cleanOrderNumber.includes(cleanQuery) : false;
        
        if (!matchesName && !matchesId) return false;
      }

      return true;
    }).sort((a, b) => b.date - a.date); // Mais recentes primeiro
  }, [sales, filter, paymentFilter, selectedStatuses, searchQuery]);

  const getProductInfo = (productId: string) => productMap.get(productId);

  const getVariationInfo = (productId: string, variationId: string) => {
    const product = getProductInfo(productId);
    return product?.variations.find(v => v.id === variationId);
  };

  // Para itens ainda não abatidos do estoque (fulfilled !== true), verifica se já
  // existe estoque na grade/tamanho vendido suficiente para completar e expedir.
  const getUnfulfilledStockStatus = (sale: Sale) => {
    const unfulfilled = sale.items.filter(it => it.fulfilled !== true);
    if (unfulfilled.length === 0) return null;
    let ready = 0;
    unfulfilled.forEach(item => {
      const variation = getVariationInfo(item.productId, item.variationId);
      const available = item.saleType === SaleType.WHOLESALE
        ? (variation?.stock['WHOLESALE'] || 0)
        : (variation?.stock[item.size || ''] || 0);
      if (available >= item.quantity) ready++;
    });
    return { total: unfulfilled.length, ready, allReady: ready === unfulfilled.length };
  };

  // Disponibilidade de estoque para um item específico (já abatido, disponível p/ separar, ou indisponível).
  const getItemStockStatus = (item: Sale['items'][number]): 'fulfilled' | 'available' | 'unavailable' => {
    if (item.fulfilled === true) return 'fulfilled';
    const variation = getVariationInfo(item.productId, item.variationId);
    const available = item.saleType === SaleType.WHOLESALE
      ? (variation?.stock['WHOLESALE'] || 0)
      : (variation?.stock[item.size || ''] || 0);
    return available >= item.quantity ? 'available' : 'unavailable';
  };

  // Grade do pedido (tamanhos x quantidade) e total de pares para o item vendido.
  // Prioriza a grade real registrada no Pedido de Produção vinculado à venda (que pode
  // ser diferente da grade padrão de produção do produto, caso o vendedor tenha montado
  // uma grade personalizada na hora da venda). Se não houver pedido de produção vinculado
  // (ou o item não constar nele), cai para a grade padrão de produção do produto cadastrado.
  const getItemGradeInfo = (sale: Sale, item: Sale['items'][number], product?: Product) => {
    if (item.saleType !== SaleType.WHOLESALE) return null;

    if (sale.productionOrderId) {
      const po = productionOrders.find(p => p.id === sale.productionOrderId);
      const poItem = po?.items.find(oi => oi.productId === item.productId && oi.variationId === item.variationId);
      if (poItem) {
        const sizeTotals = Object.entries(poItem.sizes).map(([sz, s]) => [sz, s.total] as [string, number]);
        return { gridName: 'Grade do Pedido', sizeTotals, totalPairs: poItem.totalQuantity };
      }
    }

    const gridId = product?.productionGridId || product?.defaultGridId;
    const grid = grids.find(g => g.id === gridId);
    if (!grid?.configuration) return null;
    const sizeTotals = Object.entries(grid.configuration).map(([sz, q]) => [sz, q * item.quantity] as [string, number]);
    const totalPairs = sizeTotals.reduce((sum, [, q]) => sum + q, 0);
    return { gridName: grid.name, sizeTotals, totalPairs };
  };

  const generateMessage = (sale: Sale) => {
    const customer = people.find(p => p.id === sale.customerId);
    
    const itemsText = sale.items.map(item => {
      const p = products.find(prod => prod.id === item.productId);
      const v = p?.variations.find(varItem => varItem.id === item.variationId);
      const variantDesc = v?.colorName ? ` (${v.colorName})` : '';
      const sizeDesc = item.size ? ` (TAM ${item.size})` : '';
      const typeDesc = item.saleType === SaleType.RETAIL ? 'pares' : 'grades';
      
      return `📦 *${p?.name}${variantDesc}*${sizeDesc}\n   Qtd: ${item.quantity} ${typeDesc}\n   Un: R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n   Sub: R$ ${(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }).join('\n\n');

    const paymentMethod = paymentMethods.find(pm => pm.id === sale.paymentMethodId);
    const paymentInfo = paymentMethod?.value ? `\n\n💳 *Pagamento: ${paymentMethod.name}*\nchave pix: ${paymentMethod.value}` : `\n\n💳 *Pagamento: ${paymentMethod?.name || 'A definir'}*`;

    const statusText = sale.status === SaleStatus.QUOTE ? 'Orçamento' : sale.status === SaleStatus.CONFIRMED ? 'Pedido' : 'Venda';
    const discountText = sale.discount > 0 ? `\n📉 *Desconto:* R$ ${sale.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';

    return `Olá ${customer?.name || sale.customerName || 'Cliente'}!\n\nSeu ${statusText} #${sale.orderNumber}.\n\n*ITENS:*\n${itemsText}\n\n------------------\n💰 *Subtotal:* R$ ${sale.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${discountText}\n💎 *TOTAL: R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*\n------------------\nStatus: ${statusText}${paymentInfo}\n\nAguardamos sua confirmação!`;
  };

  const handleCopyMessage = (sale: Sale) => {
    const message = generateMessage(sale);
    navigator.clipboard.writeText(message);
    toast.show('Mensagem copiada!');
  };

  const handleShareWhatsApp = (sale: Sale, customMessage?: string) => {
    const customer = people.find(p => p.id === sale.customerId);
    if (!customer?.phone && !customMessage) {
      toast.show('Cliente sem telefone cadastrado.');
    }
    
    if (whatsappMode === 'MANUAL' && !customMessage) {
      setEditingMessage({ sale, text: generateMessage(sale) });
      return;
    }

    const message = customMessage || generateMessage(sale);
    const encodedMessage = encodeURIComponent(message);
    const phone = customer?.phone?.replace(/\D/g, '') || '';
    
    if (!phone) {
      toast.show('Não é possível abrir o WhatsApp: Cliente não possui telefone cadastrado.');
      return;
    }

    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
    if (customMessage) setEditingMessage(null);
  };

  return (
    <div className="flex flex-col gap-6 h-full pb-44 px-1 overflow-y-auto overflow-x-hidden force-scrollbar">
      {(() => {
        const saleBeingDeleted = saleToDelete ? sales.find(s => s.id === saleToDelete) : null;
        const mustCancelAndRevert = saleBeingDeleted ? saleProductionHasProgressed(saleBeingDeleted, productionOrders, lots) : false;
        return (
          <ConfirmDialog
            isOpen={!!saleToDelete}
            title={mustCancelAndRevert ? "Cancelar e Estornar Pedido?" : "Excluir Registro?"}
            message={mustCancelAndRevert
              ? "Este pedido já está em produção (houve baixa em algum setor) e não pode mais ser excluído. Ele será cancelado e os lançamentos financeiros/estoque serão estornados — a produção em andamento seguirá normalmente e as caixas produzidas entrarão no estoque geral."
              : "Deseja realmente excluir esta venda e reverter os lançamentos financeiros/estoque? Esta ação não pode ser desfeita."}
            confirmLabel={mustCancelAndRevert ? "Sim, Cancelar e Estornar" : "Sim, Excluir"}
            cancelLabel="Agora não"
            onConfirm={() => {
              if (saleToDelete) {
                if (mustCancelAndRevert) onCancelAndRevert(saleToDelete);
                else onDelete(saleToDelete);
                setSaleToDelete(null);
              }
            }}
            onCancel={() => setSaleToDelete(null)}
            isDanger={true}
          />
        );
      })()}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-[13px] font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Vendas</h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold tracking-widest leading-none">Relatórios</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateStock}
              className={`h-11 px-5 rounded-2xl flex items-center gap-3 transition-all duration-300 ${isDarkMode ? 'bg-slate-900 text-slate-400 hover:text-amber-400' : 'bg-white text-slate-400 border border-slate-100 shadow-sm hover:text-amber-600'}`}
              title="Estoque de Produtos"
            >
              <Boxes size={18} strokeWidth={2.5} className="text-amber-500" />
              <span className="text-[10px] font-black tracking-[0.2em]">Estoque</span>
            </button>
            <button
              onClick={() => setShowFilters(true)}
              className={`h-11 px-5 rounded-2xl flex items-center gap-3 transition-all duration-300 relative ${showFilters ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40' : isDarkMode ? 'bg-slate-900 text-slate-400 hover:text-indigo-400' : 'bg-white text-slate-400 border border-slate-100 shadow-sm hover:text-indigo-500'}`}
              title="Configurações e Filtros"
            >
              <div className="relative">
                <Filter size={18} strokeWidth={2.5} className={showFilters ? '' : 'text-indigo-500'} />
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-3 -right-3 w-5 h-5 bg-orange-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-in zoom-in">
                    {activeFiltersCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-black tracking-[0.2em]">Configurar</span>
            </button>
          </div>
        </div>

        {/* Search - Always Visible */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} strokeWidth={2.5} />
          <input 
            type="text"
            placeholder="Pesquisar cliente ou pedido..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full h-14 pl-12 pr-4 rounded-2xl border text-[12px] font-bold tracking-widest transition-all outline-none focus:ring-2 focus:ring-indigo-600/20 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-100 text-slate-800 placeholder:text-slate-300'}`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Métricas de Entrega — fechadas automaticamente quando o PCP conclui a expedição do pedido */}
        {(deliveryStats.delivered > 0 || deliveryStats.pending > 0) && (
          <div className="flex items-center gap-3">
            <div className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Truck size={16} strokeWidth={2.5} />
              </div>
              <div className="leading-none">
                <p className={`text-[14px] font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{deliveryStats.delivered}</p>
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">Entregues</p>
              </div>
            </div>
            <div className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Clock size={16} strokeWidth={2.5} />
              </div>
              <div className="leading-none">
                <p className={`text-[14px] font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{deliveryStats.pending}</p>
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">Aguardando Entrega</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Popup */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowFilters(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div
            className={`relative w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className={`text-[13px] font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Filtros e Configurações</h3>
              <button onClick={() => setShowFilters(false)} className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Tipo de Venda */}
            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tipo de Venda</p>
              <div className={`flex p-1 rounded-2xl border gap-1 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                {(['ALL', 'RETAIL', 'WHOLESALE'] as const).map((v) => (
                  <button key={v} onClick={() => setFilter(v)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black tracking-wider transition-all ${filter === v ? 'bg-indigo-600 text-white shadow-sm' : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                    {v === 'ALL' ? 'Todos' : v === 'RETAIL' ? 'Varejo' : 'Atacado'}
                  </button>
                ))}
              </div>
            </div>

            {/* Status de Pagamento */}
            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pagamento</p>
              <div className={`flex p-1 rounded-2xl border gap-1 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                {(['ALL', 'PENDING', 'PAID'] as const).map((v) => (
                  <button key={v} onClick={() => setPaymentFilter(v)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black tracking-wider transition-all ${paymentFilter === v ? 'bg-indigo-600 text-white shadow-sm' : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                    {v === 'ALL' ? 'Todos' : v === 'PENDING' ? 'Pendente' : 'Pago'}
                  </button>
                ))}
              </div>
            </div>

            {/* Status do Pedido */}
            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status do Pedido</p>
              <div className="flex gap-2 flex-wrap">
                {([SaleStatus.SALE, SaleStatus.CONFIRMED, SaleStatus.QUOTE, SaleStatus.CANCELLED] as const).map((s) => {
                  const active = selectedStatuses.includes(s);
                  const label = s === SaleStatus.SALE ? 'Venda' : s === SaleStatus.CONFIRMED ? 'Pedido' : s === SaleStatus.QUOTE ? 'Orçamento' : 'Cancelado';
                  const color = s === SaleStatus.SALE ? (active ? 'bg-indigo-600 text-white' : '') : s === SaleStatus.CONFIRMED ? (active ? 'bg-sky-500 text-white' : '') : s === SaleStatus.QUOTE ? (active ? 'bg-amber-500 text-white' : '') : (active ? 'bg-rose-500 text-white' : '');
                  return (
                    <button key={s}
                      onClick={() => setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-wider border transition-all ${active ? `${color} border-transparent shadow-sm` : isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visualização */}
            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Visualização</p>
              <div className="flex gap-2">
                <button onClick={() => setExpandedCards(v => !v)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all ${expandedCards ? 'bg-indigo-600 text-white border-transparent shadow-sm' : isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  {expandedCards ? 'Cards Expandidos' : 'Cards Compactos'}
                </button>
                <button onClick={() => setShowProducts(v => !v)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all ${showProducts ? 'bg-indigo-600 text-white border-transparent shadow-sm' : isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  {showProducts ? 'Mostrar Produtos' : 'Ocultar Produtos'}
                </button>
              </div>
              <button onClick={() => setShowGradeBreakdown(v => !v)}
                className={`w-full py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all ${showGradeBreakdown ? 'bg-indigo-600 text-white border-transparent shadow-sm' : isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                {showGradeBreakdown ? 'Ocultar Padrão de Embalagem' : 'Mostrar Padrão de Embalagem'}
              </button>
            </div>

            <button
              onClick={() => { setFilter('ALL'); setPaymentFilter('ALL'); setSelectedStatuses([SaleStatus.SALE, SaleStatus.CONFIRMED, SaleStatus.QUOTE]); setExpandedCards(false); setShowProducts(true); setShowGradeBreakdown(false); }}
              className="mt-1 w-full py-3 rounded-2xl text-[10px] font-black tracking-widest text-rose-500 border border-rose-100 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredSales.map((sale) => {
          const totalPaid = (sale.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
          const remaining = Math.max(0, sale.total - totalPaid);
          const isExpanded = expandedCards || expandedIds.includes(sale.id);

          return (
            <div key={sale.id} className={`p-6 rounded-[2.5rem] border shadow-xl dark:shadow-none flex flex-col gap-6 relative overflow-hidden group transition-all duration-300 hover:shadow-2xl ${
              sale.status === SaleStatus.CANCELLED
                ? 'bg-slate-900 border-slate-800 opacity-60 grayscale-[0.5]'
                : isDarkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-100'
            }`}>
              {/* Row 1: Customer & Basic Info */}
              <div className="flex justify-between items-start z-10 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-black text-base tracking-tight leading-none truncate ${sale.status === SaleStatus.CANCELLED ? 'text-slate-500' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {sale.saleDestination === 'STOCK' ? 'Estoque' : (sale.customerName || 'Cliente')}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setSelectedSale(sale)}
                        title="Ver Detalhes do Pedido"
                        aria-label={`Ver detalhes do pedido de ${sale.customerName || 'Cliente'}`}
                        className={`shrink-0 transition-all hover:scale-110 ${
                          sale.status === SaleStatus.QUOTE
                            ? 'text-amber-500'
                            : sale.status === SaleStatus.CONFIRMED
                              ? 'text-sky-500'
                              : 'text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        <ShoppingBag size={16} strokeWidth={2.5} />
                      </button>
                      {sale.saleDestination === 'STOCK' && (
                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white uppercase tracking-widest shrink-0">
                          Estoque
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {isExpanded && (
                        <div className="flex items-center gap-2">
                          {sale.sellerName && (
                            <span className="text-[11px] font-black px-2 py-0.5 rounded-md leading-none tracking-widest bg-indigo-600 text-white shadow-sm">
                              {sale.sellerName}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-black tracking-widest">
                            <Calendar size={12} strokeWidth={3} />
                            {format(sale.date, "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] text-indigo-500 dark:text-indigo-400 font-black tracking-widest">
                        <Hash size={12} strokeWidth={3} />
                        #{sale.orderNumber}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {/* Badge Não Contábil */}
                  {sale.isAccounting === false && (
                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 border border-rose-200 dark:border-rose-800 uppercase tracking-widest">
                      Não Contábil
                    </span>
                  )}
                  {/* Status Badge */}
                  {sale.status === SaleStatus.CANCELLED ? (
                    <span className="text-[10px] font-black px-2 py-1 rounded-lg leading-none tracking-widest bg-slate-900 text-rose-500 border border-rose-500/20 shadow-sm">
                      Cancelada
                    </span>
                  ) : sale.status === SaleStatus.QUOTE ? (
                    <span className="text-[10px] font-black px-2 py-1 rounded-lg leading-none tracking-widest shadow-sm bg-orange-500 text-white">
                      Orçamento
                    </span>
                  ) : sale.status === SaleStatus.CONFIRMED ? (
                    <span className="text-[10px] font-black px-2 py-1 rounded-lg leading-none tracking-widest shadow-sm bg-sky-500 text-white">
                      Pedido
                    </span>
                  ) : (
                    <span className="text-[10px] font-black px-2 py-1 rounded-lg leading-none tracking-widest shadow-sm bg-[#7c3aed] text-white">
                      Venda
                    </span>
                  )}

                  {/* Badge Pedido Entregue — fechado ao concluir a expedição no PCP */}
                  {sale.deliveryStatus === 'DELIVERED' && sale.status !== SaleStatus.CANCELLED && (
                    <span className="text-[8px] font-black px-2 py-1 rounded-lg leading-none tracking-widest shadow-sm bg-emerald-500 text-white uppercase flex items-center gap-1">
                      <Truck size={10} /> Pedido Entregue
                    </span>
                  )}

                  {/* Badge Itens aguardando estoque — indica se já há estoque na grade vendida */}
                  {sale.status === SaleStatus.SALE && (() => {
                    const stockStatus = getUnfulfilledStockStatus(sale);
                    if (!stockStatus) return null;
                    if (stockStatus.allReady) {
                      return (
                        <span className="text-[8px] font-black px-2 py-1 rounded-lg leading-none tracking-widest bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={9} /> Estoque pronto p/ expedir
                        </span>
                      );
                    }
                    return (
                      <span className="text-[8px] font-black px-2 py-1 rounded-lg leading-none tracking-widest bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
                        <Clock size={9} /> Aguard. estoque ({stockStatus.ready}/{stockStatus.total})
                      </span>
                    );
                  })()}

                  {/* Badge Caixas prontas — produção concluída, aguardando "Liberar Pedido" */}
                  {sale.status === SaleStatus.SALE && sale.deliveryStatus !== 'DELIVERED' && (reservedLotsBySale.get(sale.id) || []).length > 0 && (
                    <span className="text-[8px] font-black px-2 py-1 rounded-lg leading-none tracking-widest bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400 flex items-center gap-1">
                      <PackageCheck size={9} /> {(reservedLotsBySale.get(sale.id) || []).length} pronta(s)
                    </span>
                  )}

                  <button
                    onClick={() => toggleExpand(sale.id)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}
                    title={isExpanded ? "Recolher" : "Expandir"}
                  >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
            </div>

              {/* Balão Pedido em Produção atrelado à venda — mostra quantos lotes faltam concluir */}
              {sale.status !== SaleStatus.CANCELLED && sale.productionOrderId && (() => {
                const po = productionOrders.find(p => p.id === sale.productionOrderId);
                if (!po || po.status === 'COMPLETED') return null;
                const label = po.status === 'IN_PRODUCTION' ? 'Pedido em Produção' : 'Aguardando Produção';
                const poLots = lots.filter(l => po.lotIds.includes(l.id));
                const pendingLots = poLots.filter(l => !l.finishedAt);
                return (
                  <div className="w-full flex items-center gap-2 px-3 py-2 rounded-2xl bg-orange-50 dark:bg-orange-900/20 z-10">
                    <Factory size={14} className="text-orange-500 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 truncate">
                      {label} · #{po.orderNumber}
                      {poLots.length > 0 && ` · Faltam ${pendingLots.length} de ${poLots.length} lote(s)`}
                    </span>
                  </div>
                );
              })()}

              {/* Content Row: Items Preview & Large Price */}
              {isExpanded && (
                <div className="flex flex-col gap-3 z-10">
                  {/* Banner: produtos disponíveis para separação do pedido */}
                  {sale.status === SaleStatus.SALE && (() => {
                    const stockStatus = getUnfulfilledStockStatus(sale);
                    if (!stockStatus || stockStatus.ready === 0) return null;
                    return (
                      <div className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl ${isDarkMode ? 'bg-emerald-900/20 border border-emerald-800/40' : 'bg-emerald-50 border border-emerald-100'}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest truncate">
                            Há produtos disponíveis para separação do pedido
                          </span>
                        </div>
                        <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shrink-0 ${stockStatus.allReady ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white'}`}>
                          {stockStatus.allReady ? 'Completo' : 'Parcial'}
                        </span>
                      </div>
                    );
                  })()}

                <div className={`flex ${sale.status === SaleStatus.QUOTE ? 'flex-col' : 'justify-between items-start'} gap-4`}>
                  {/* Items List (Left/Top) */}
                  {showProducts ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setItemsPopupSale(sale); }}
                      title="Ver todos os itens"
                      aria-label="Ver todos os itens da venda"
                      className="flex-1 flex flex-col gap-3 cursor-pointer min-w-0 text-left"
                    >
                      {sale.items.slice(0, 3).map((item, idx) => {
                        const product = getProductInfo(item.productId);
                        const variation = getVariationInfo(item.productId, item.variationId);
                        const stockStatus = sale.status === SaleStatus.SALE ? getItemStockStatus(item) : null;
                        const gradeInfo = showGradeBreakdown ? getItemGradeInfo(sale, item, product) : null;
                        // Além do estoque geral, considera "pronto" também quando já existe um
                        // StockLot RESERVADO para esta venda+item — produção concluída e
                        // separada especificamente para este pedido (badge "N pronta(s)"),
                        // ainda que não conte no estoque geral da variação.
                        const hasReservedLot = (reservedLotsBySale.get(sale.id) || []).some(l =>
                          l.productId === item.productId && l.variationId === item.variationId && (l.itemIdx === undefined || l.itemIdx === idx)
                        );
                        const isAvailable = stockStatus === 'available' || hasReservedLot;
                        return (
                          <div key={idx} className={`flex items-center gap-3 ${isAvailable ? '-m-1 p-1 rounded-xl bg-emerald-50 dark:bg-emerald-900/15' : ''}`}>
                            <div className={`p-2 rounded-xl shrink-0 ${isAvailable ? 'bg-emerald-100 dark:bg-emerald-900/30' : isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                               {isAvailable
                                 ? <CheckCircle2 size={12} className="text-emerald-500" strokeWidth={3} />
                                 : <Tag size={12} className={sale.status === SaleStatus.CANCELLED ? 'text-slate-600' : 'text-indigo-500'} strokeWidth={3} />}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[11px] font-black leading-none tracking-tight truncate ${isAvailable ? 'text-emerald-600 dark:text-emerald-400' : sale.status === SaleStatus.CANCELLED ? 'text-slate-500' : isDarkMode ? 'text-slate-300' : 'text-slate-400'}`}>
                                {product?.reference || '---'} {product?.name}
                              </p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold mt-1.5 tracking-widest">
                                {variation?.colorName} • <span className="text-indigo-500 dark:text-indigo-400">{item.quantity} {item.saleType === SaleType.WHOLESALE ? 'Grades' : 'Pares'}</span>
                              </p>
                              {gradeInfo && (
                                <div className="mt-1.5">
                                  <p className={`text-[8px] font-black uppercase tracking-widest mb-1 truncate ${isAvailable ? 'text-emerald-500' : 'text-sky-400'}`}>
                                    {gradeInfo.gridName} · Total ({gradeInfo.totalPairs} pares){isAvailable ? ' · Pronto' : ''}
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {gradeInfo.sizeTotals.map(([size, qty]) => (
                                      <div key={size} className={`flex flex-col items-center min-w-[32px] py-1 px-1.5 rounded-lg border ${isAvailable ? (isDarkMode ? 'bg-emerald-950/30 border-emerald-900' : 'bg-emerald-50 border-emerald-100') : isDarkMode ? 'bg-sky-950/30 border-sky-900' : 'bg-sky-50 border-sky-100'}`}>
                                        <p className={`text-[9px] font-black leading-none ${isAvailable ? 'text-emerald-500' : 'text-sky-400'}`}>{size}</p>
                                        <p className={`text-[12px] font-black leading-none mt-0.5 ${isAvailable ? 'text-emerald-700 dark:text-emerald-300' : 'text-sky-700 dark:text-sky-300'}`}>{qty}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {sale.items.length > 3 && (
                        <span className="text-[11px] text-slate-400 dark:text-slate-600 font-black tracking-[0.2em] italic ml-11">+{sale.items.length - 3} outros</span>
                      )}
                    </button>
                  ) : (
                    <div className="flex-1 min-w-0" />
                  )}

                  {/* Price Display */}
                  <div className={`flex flex-col ${sale.status === SaleStatus.QUOTE ? 'w-full pt-4 border-t border-slate-50 dark:border-slate-800/40 mt-2' : 'items-end shrink-0 justify-end min-w-[90px]'}`}>
                    <div className={`flex ${sale.status === SaleStatus.QUOTE ? 'justify-between items-center w-full' : 'flex-col items-end'}`}>
                      {sale.status === SaleStatus.QUOTE && (
                        <span className="text-[11px] font-black text-slate-400 tracking-[0.2em]">Total do Orçamento</span>
                      )}
                      <div>
                        {remaining > 0 && sale.status === SaleStatus.SALE && (
                          <p className="text-[11px] font-black text-rose-500 mb-1 whitespace-nowrap tracking-tight">Saldo R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        )}
                        <p className={`${sale.status === SaleStatus.QUOTE ? 'text-[19px]' : 'text-[15px]'} font-black leading-tight whitespace-nowrap tracking-tight ${sale.status === SaleStatus.CANCELLED ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                          R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              )}

              {/* Action Bar (Footer) */}
              <div className="flex flex-col gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/50 z-10">
                <div className="flex justify-between items-center w-full">
                  <div className="flex items-center gap-2">
                    {/* Note Indicator if exists */}
                    {sale.notes && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setNoteModal({ isOpen: true, note: sale.notes || "" });
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 relative bg-[#fffbeb] text-rose-500 shadow-xl shadow-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:shadow-none"
                      >
                        <Lightbulb size={18} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>

                  {/* Actions Group (Floating Island) - MATCHING IMAGE */}
                  <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                    {/* PDF Button */}
                    <button 
                      onClick={(e) => handleOpenExport(e, sale, 'pdf')}
                      className="w-10 h-10 flex items-center justify-center bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-full font-black text-[10px] tracking-tighter active:scale-90 transition-all"
                      title="Exportar PDF"
                    >
                      PDF
                    </button>

                    {/* JPG Button */}
                    <button 
                      onClick={(e) => handleOpenExport(e, sale, 'jpg')}
                      className="w-10 h-10 flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-full font-black text-[10px] tracking-tighter active:scale-90 transition-all"
                      title="Exportar JPG"
                    >
                      JPG
                    </button>

                    {/* WhatsApp Button */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleShareWhatsApp(sale); }}
                      className="w-10 h-10 flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-full active:scale-90 transition-all"
                      title="WhatsApp"
                    >
                      <MessageSquare size={18} />
                    </button>

                    {/* Payment/Dollar Button */}
                    {sale.status !== SaleStatus.QUOTE && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPaymentModalMode(totalPaid >= sale.total ? 'HISTORY' : 'PAYMENT');
                          setPaymentModalSale(sale);
                        }}
                        className="w-10 h-10 flex items-center justify-center bg-purple-50 dark:bg-purple-500/10 text-purple-500 rounded-full active:scale-90 transition-all"
                        title="Pagamento"
                      >
                        <DollarSign size={20} />
                      </button>
                    )}


                    {/* Edit Button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(sale); }}
                      className="w-10 h-10 flex items-center justify-center bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-full active:scale-90 transition-all"
                      title="Editar"
                    >
                      <Edit2 size={18} />
                    </button>

                    {/* More Options Menu */}
                    <div className="relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === sale.id ? null : sale.id);
                        }}
                        className={`w-10 h-10 flex items-center justify-center bg-slate-50 dark:bg-slate-700/50 text-slate-500 rounded-full active:scale-90 transition-all ${activeMenuId === sale.id ? 'bg-slate-200' : ''}`}
                        title="Mais Opções"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {activeMenuId === sale.id && (
                        <div 
                          className={`absolute bottom-full right-0 mb-2 w-36 rounded-2xl shadow-xl border overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-2 ${
                            isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'
                          }`}
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopyMessage(sale); setActiveMenuId(null); }}
                            className={`w-full px-4 py-3 text-[10px] font-bold tracking-widest flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
                          >
                            <Copy size={14} /> Copiar Texto
                          </button>
                          {sale.status === SaleStatus.SALE && sale.deliveryStatus !== 'DELIVERED' && (reservedLotsBySale.get(sale.id) || []).length > 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReleaseClick(sale); setActiveMenuId(null); }}
                              className="w-full px-4 py-3 text-[10px] font-bold tracking-widest flex items-center gap-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                            >
                              <PackageCheck size={14} /> Liberar Pedido
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setSaleToDelete(sale.id); setActiveMenuId(null); }}
                            className="w-full px-4 py-3 text-[10px] font-bold tracking-widest flex items-center gap-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          >
                            {saleProductionHasProgressed(sale, productionOrders, lots)
                              ? <><Ban size={14} /> Cancelar e Estornar</>
                              : <><Trash2 size={14} /> Excluir</>}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {sale.status === SaleStatus.QUOTE && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); if(confirm('Confirmar orçamento como venda?')) onConvert(sale.id); }}
                    className="w-full py-4 flex items-center justify-center bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20 font-black text-[11px] tracking-widest gap-3"
                  >
                    <CheckCircle2 size={18} strokeWidth={3} /> Confirmar como Venda
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredSales.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-200 dark:text-slate-800">
             <TrendingUp size={64} strokeWidth={1} className="mb-4" />
             <p className="text-[10px] font-black tracking-widest italic">Sem registro de vendas</p>
          </div>
        )}
      </div>

      <button
        onClick={onAdd}
        className="fixed bottom-24 right-6 w-16 h-16 bg-slate-900 dark:bg-indigo-600 text-white rounded-[2rem] shadow-2xl flex items-center justify-center active:scale-95 transition-all z-50 border-4 border-white dark:border-slate-800"
      >
         <Plus size={36} strokeWidth={2.5} />
      </button>

      {/* Modals */}
      <ExportNoteModal
        isOpen={exportModal.isOpen}
        onClose={() => setExportModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmExport}
        isDarkMode={isDarkMode}
        initialFormat={exportModal.format}
        title={exportModal.sale?.status === SaleStatus.QUOTE ? "Exportar Orçamento" : exportModal.sale?.status === SaleStatus.CONFIRMED ? "Exportar Pedido" : "Exportar Venda"}
      />

      {/* Popup — Itens da Venda */}
      {itemsPopupSale && (() => {
        const s = itemsPopupSale;
        const totalItems = s.items.reduce((acc, i) => acc + i.quantity, 0);
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setItemsPopupSale(null)}>
            <div
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-md rounded-[2rem] shadow-2xl flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Itens da Venda</p>
                  <p className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pedido #{s.orderNumber}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black px-3 py-1.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
                  <button onClick={() => setItemsPopupSale(null)} title="Fechar" aria-label="Fechar popup de itens" className={`p-2 rounded-xl transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                    <X size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Items list */}
              <div className="overflow-y-auto max-h-[60vh] flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {s.items.map((item, idx) => {
                  const product = getProductInfo(item.productId);
                  const variation = getVariationInfo(item.productId, item.variationId);
                  const lineTotal = item.price * item.quantity;
                  return (
                    <div key={idx} className={`flex items-center gap-3 px-6 py-3.5 ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-50'}`}>
                        <Tag size={13} className="text-indigo-500" strokeWidth={3} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[12px] font-black uppercase leading-tight truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          {product?.reference} {product?.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {variation?.colorName && (
                            <span className="text-[10px] font-bold text-slate-400">{variation.colorName}</span>
                          )}
                          {item.size && (
                            <span className="text-[10px] font-bold text-slate-400">• Nº {item.size}</span>
                          )}
                          <span className="text-[10px] font-black text-indigo-500">• {item.quantity} {item.saleType === SaleType.WHOLESALE ? 'grade(s)' : 'par(es)'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[13px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          R$ {lineTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400">
                          R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / {item.saleType === SaleType.WHOLESALE ? 'grade' : 'par'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer — total */}
              <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
                  <span className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    R$ {s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {s.discount > 0 && (
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Desconto aplicado</span>
                    <span className="text-[11px] font-black text-rose-500">- R$ {s.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {productionOrderSale && (
        <ProductionOrderModal
          isOpen={!!productionOrderSale}
          onClose={() => setProductionOrderSale(null)}
          sale={productionOrderSale}
          products={products}
          grids={grids}
          sectors={sectors}
          existingOrdersCount={productionOrders.length}
          existingLotsCount={lots.length}
          isDarkMode={isDarkMode}
          onConfirm={async (order, newLots, deductions) => {
            await onCreateProductionOrder(order, newLots, deductions);
            setProductionOrderSale(null);
          }}
        />
      )}
    </div>
  );
}

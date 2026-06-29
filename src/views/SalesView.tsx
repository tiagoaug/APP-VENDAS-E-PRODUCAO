import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sale, SaleType, PaymentStatus, Product, Grid, SaleStatus, Person, PaymentMethod, Account, PaymentTerm, ProductionOrder, ProductionLot, Sector, AppModulesConfig, StockLot, ProductionConfigItem } from '../types';
import { ShoppingBag, TrendingUp, User, Calendar, Tag, Filter, Plus, Minus, Hash, Clock, CheckCircle2, AlertCircle, MoreVertical, Edit2, Trash2, X, Info, Box, Ban, RotateCcw, Search, MessageSquare, Copy, Share, Share2, DollarSign, History, FileText, Lightbulb, Eye, EyeOff, Maximize2, Minimize2, Check, ChevronDown, ChevronUp, Factory, Truck, PackageCheck, Boxes, PackagePlus } from 'lucide-react';
import ProductionOrderModal from '../components/ProductionOrderModal';
import SeparacaoCaixasModal from '../components/SeparacaoCaixasModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { exportSale } from '../utils/saleExport';
import ExportNoteModal from '../components/ExportNoteModal';
import SalePaymentModal from '../components/SalePaymentModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { toast } from '../utils/toast';
import { saleProductionHasProgressed, getLotPendingSectorGroups } from '../utils/productionRoute';
import { firebaseService } from '../services/firebaseService';
import { getWholesaleBoxes, getRetailPairs } from '../utils/stockPools';

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

function usePersistedState<T>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    const saved = localStorage.getItem(key);
    if (saved === null) return defaultValue;
    try {
      return JSON.parse(saved) as T;
    } catch {
      return defaultValue;
    }
  });
  const setPersisted = (v: T | ((prev: T) => T)) => {
    setValue(prev => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      localStorage.setItem(key, JSON.stringify(next));
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
  onAddStockBalance: (adjustments: { productId: string; variationId: string; key: string; amount: number }[]) => Promise<void> | void;
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
  onExpediteSale: (saleId: string) => Promise<void>;
  onRevertExpedition: (saleId: string) => Promise<void>;
  onSepararCaixas: (saleId: string, separations: { itemIdx: number; quantity: number }[]) => Promise<void>;
  onTransferToStock: (saleId: string) => Promise<void>;
  onNavigateStock: () => void;
  onNavigateStockGlance: () => void;
  productionConfigs: ProductionConfigItem[];
  appTheme?: 'light' | 'dark' | 'industrial' | 'ocean' | 'forest' | 'sunset' | 'midnight' | 'graphite' | 'hcWhite' | 'hcBlack' | 'hcIndustrial';
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
  onAddStockBalance,
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
  onExpediteSale,
  onRevertExpedition,
  onSepararCaixas,
  onTransferToStock,
  onNavigateStock,
  onNavigateStockGlance,
  productionConfigs,
  appTheme = 'light',
}: SalesViewProps) {
  const isIndustrial = appTheme === 'industrial';
  const hasProduction = modulesConfig.production;
  const [filter, setFilter] = usePersistedState<'ALL' | 'RETAIL' | 'WHOLESALE'>('salesView_filter', 'ALL');
  const [paymentFilter, setPaymentFilter] = usePersistedState<'ALL' | 'PENDING' | 'PAID'>('salesView_paymentFilter', 'ALL');
  const [deliveryFilter, setDeliveryFilter] = usePersistedState<'ALL' | 'PENDING' | 'DELIVERED'>('salesView_deliveryFilter', 'ALL');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  // Vendas antigas e já pagas não ficam carregadas por padrão (ver App.tsx); busca de
  // uma só vez para a sessão atual quando a pesquisa não encontra nada no que já está em memória.
  const [olderSales, setOlderSales] = useState<Sale[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const handleLoadFullHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const all = await firebaseService.getCollection<Sale>('sales');
      setOlderSales(all);
    } finally {
      setIsLoadingHistory(false);
    }
  };
  const effectiveSales = useMemo(() => {
    if (!olderSales) return sales;
    const merged = new Map(olderSales.map(s => [s.id, s]));
    sales.forEach(s => merged.set(s.id, s));
    return Array.from(merged.values());
  }, [sales, olderSales]);
  const [selectedStatuses, setSelectedStatuses] = usePersistedState<SaleStatus[]>('salesView_selectedStatuses', [SaleStatus.SALE, SaleStatus.CONFIRMED, SaleStatus.QUOTE]);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCards, setExpandedCards] = usePersistedToggle('salesView_expandedCards', false);
  const [showProducts, setShowProducts] = usePersistedToggle('salesView_showProducts', true);
  const [showGradeBreakdown, setShowGradeBreakdown] = usePersistedToggle('salesView_showGradeBreakdown', false);
  const [showSeparationInfo, setShowSeparationInfo] = usePersistedToggle('salesView_showSeparationInfo', true);
  const [showSummaryBar, setShowSummaryBar] = usePersistedToggle('salesView_showSummaryBar', true);
  const [showStockGlanceCard, setShowStockGlanceCard] = usePersistedToggle('salesView_showStockGlanceCard', true);
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
  const [showCrossCheckCard, setShowCrossCheckCard] = usePersistedToggle('salesView_showCrossCheckCard', false);

  const crossCheckData = useMemo(() => {
    const map = new Map<string, {
      key: string; productId: string; variationId: string; stockKey: string;
      productName: string; reference: string; colorName: string;
      isWholesale: boolean; demand: number; stock: number; productionPairs: number;
      productionBySector: Record<string, number>;
      sources: { saleId: string; orderNumber: string; status: SaleStatus; demand: number; }[];
    }>();

    const excludedOPs = new Set<string>();

    // 1. Somar Demanda Pendente (desconsiderando cancelados e os que já possuem OP)
    sales.forEach((sale) => {
      if (sale.status === SaleStatus.CANCELLED) return;
      if (sale.productionOrderId) {
        excludedOPs.add(sale.productionOrderId);
        return;
      }

      sale.items.forEach((item) => {
        if (item.fulfilled) return;
        const pendingDemand = item.quantity - (item.boxesSeparated || 0);
        if (pendingDemand <= 0) return;

        const product = products.find((p) => p.id === item.productId);
        if (!product) return;
        const variation = product.variations.find((v) => v.id === item.variationId);
        const isWholesale = item.saleType === SaleType.WHOLESALE;
        const stockKey = isWholesale ? 'WHOLESALE' : (item.size || '');
        if (!stockKey) return;
        
        const mapKey = `${item.productId}::${item.variationId}::${stockKey}`;
        const sourceInfo = { saleId: sale.id, orderNumber: sale.orderNumber, status: sale.status, demand: pendingDemand };
        
        const existing = map.get(mapKey);
        if (existing) {
          existing.demand += pendingDemand;
          const existingSource = existing.sources.find(s => s.saleId === sale.id);
          if (existingSource) {
            existingSource.demand += pendingDemand;
          } else {
            existing.sources.push(sourceInfo);
          }
        } else {
          map.set(mapKey, {
            key: mapKey,
            productId: item.productId,
            variationId: item.variationId,
            stockKey,
            productName: product.name,
            reference: product.reference || '',
            colorName: variation?.colorName || '',
            isWholesale,
            demand: pendingDemand,
            stock: variation?.stock?.[stockKey] || 0,
            productionPairs: 0,
            productionBySector: {},
            sources: [sourceInfo],
          });
        }
      });
    });

    // 2. Somar pares em produção por setor — só informativo (atacado), não entra mais no
    // saldo. Usa os sourceItems reais do lote (cada um com seu productId/variationId/qty
    // próprios) em vez de lot.quantity, que é o total do mapa somando todos os produtos
    // dele — não só esta referência/cor.
    lots.forEach((lot) => {
      if (lot.status === 'COMPLETED' || lot.status === 'CANCELLED' || lot.finishedAt) return;

      // Se o lote pertence a uma OP de uma venda que não debita estoque (já tem OP própria), não somar como produção livre
      const lotOpId = lot.productionOrderId;
      if (lotOpId && excludedOPs.has(lotOpId)) return;

      const sectorGroups = getLotPendingSectorGroups(lot);
      sectorGroups.forEach((items, sectorId) => {
        items.forEach((si: any) => {
          const pid = si.productId || lot.productId;
          const vid = si.variationId || lot.variationId;
          const qty = si.qty || 0;
          if (qty <= 0) return;
          const mapKeyWholesale = `${pid}::${vid}::WHOLESALE`;
          const existing = map.get(mapKeyWholesale);
          if (!existing) return;
          existing.productionPairs += qty;
          existing.productionBySector[sectorId] = (existing.productionBySector[sectorId] || 0) + qty;
        });
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      (a.reference || a.productName).localeCompare(b.reference || b.productName) ||
      a.colorName.localeCompare(b.colorName) ||
      a.stockKey.localeCompare(b.stockKey)
    );
  }, [sales, products, lots]);

  // Resumo geral de estoque real (Atacado/Varejo) — alimenta o card-resumo e o botão
  // "Disponível" da barra (ver StockGlanceView, que mostra o detalhe por referência).
  const stockGlanceSummary = useMemo(() => {
    let wholesaleReady = 0;
    let retailReady = 0;
    products.forEach(product => {
      product.variations.forEach(variation => {
        wholesaleReady += getWholesaleBoxes(product, variation);
        retailReady += getRetailPairs(product, variation);
      });
    });
    return { wholesaleReady, retailReady };
  }, [products]);

  const [productionOrderSale, setProductionOrderSale] = useState<Sale | null>(null);
  const [itemsPopupSale, setItemsPopupSale] = useState<Sale | null>(null);
  // Popup de expedição: pré-visualiza as baixas no estoque antes de confirmar.
  const [expediteSale, setExpediteSale] = useState<Sale | null>(null);
  // Popup de reversão de expedição: pré-visualiza a devolução ao estoque.
  const [revertSale, setRevertSale] = useState<Sale | null>(null);
  const [processingExpedite, setProcessingExpedite] = useState(false);
  const [separacaoSale, setSeparacaoSale] = useState<Sale | null>(null);
  const [simplePreviewSale, setSimplePreviewSale] = useState<Sale | null>(null);
  const [transferSale, setTransferSale] = useState<Sale | null>(null);
  const [processingTransfer, setProcessingTransfer] = useState(false);
  // Quantidades de separação por índice de item dentro do popup de itens
  const [popupSepQtys, setPopupSepQtys] = useState<Record<number, number>>({});
  const [processingPopupSep, setProcessingPopupSep] = useState(false);

  // Inicializa as quantidades de separação quando o popup de itens abre
  useEffect(() => {
    if (!itemsPopupSale) { setPopupSepQtys({}); return; }
    const reservedLots = stockLots.filter(l => l.saleId === itemsPopupSale.id && l.status === 'RESERVADO');
    const init: Record<number, number> = {};
    itemsPopupSale.items.forEach((item, idx) => {
      const separated = item.boxesSeparated || 0;
      const remaining = Math.max(0, item.quantity - separated);
      const itemLots = reservedLots.filter(l => l.productId === item.productId && l.variationId === item.variationId);
      const hasReserved = itemLots.length > 0;
      const product = products.find(p => p.id === item.productId);
      const variation = product?.variations.find(v => v.id === item.variationId);
      const stockKey = item.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (item.size || '');
      const stockAvailable = (variation?.stock?.[stockKey] as number) || 0;
      const maxFromLots = itemLots.reduce((s, l) => s + (l.boxQty || 1), 0);
      const maxSeparable = itemsPopupSale.productionOrderId
        ? (hasReserved ? Math.min(remaining, maxFromLots) : 0)
        : Math.min(remaining, stockAvailable);
      init[idx] = maxSeparable;
    });
    setPopupSepQtys(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsPopupSale?.id]);

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
    if (deliveryFilter !== 'ALL') count++;
    const defaultStatuses = [SaleStatus.SALE, SaleStatus.CONFIRMED, SaleStatus.QUOTE];
    const isDefaultStatuses = selectedStatuses.length === defaultStatuses.length &&
                              defaultStatuses.every(s => selectedStatuses.includes(s));
    if (!isDefaultStatuses) count++;
    return count;
  }, [filter, paymentFilter, deliveryFilter, selectedStatuses]);

  // Métricas de entrega — fechadas pelo PCP ao concluir a expedição (ver SaleStatus.SALE não cancelados)
  const deliveryStats = useMemo(() => {
    const trackedSales = sales.filter(s => s.status === SaleStatus.SALE);
    const delivered = trackedSales.filter(s => s.deliveryStatus === 'DELIVERED').length;
    const pending = trackedSales.length - delivered;
    
    const totalPendingAmount = sales
      .filter(s => s.status !== SaleStatus.QUOTE && s.status !== SaleStatus.CANCELLED)
      .reduce((sum, s) => {
        const totalPaid = (s.paymentHistory || []).reduce((acc, p) => acc + (p.amount || 0), 0);
        const remaining = s.total - totalPaid;
        return sum + (remaining > 0 ? remaining : 0);
      }, 0);
      
    return { delivered, pending, totalPendingAmount };
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
    return effectiveSales.filter(s => {
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

      // Filter by Delivery Status
      if (deliveryFilter !== 'ALL') {
        const isDelivered = s.deliveryStatus === 'DELIVERED';
        if (deliveryFilter === 'DELIVERED' && !isDelivered) return false;
        if (deliveryFilter === 'PENDING' && isDelivered) return false;
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
  }, [effectiveSales, filter, paymentFilter, deliveryFilter, selectedStatuses, searchQuery]);

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
    
    const saleLots = sale.productionOrderId
      ? stockLots.filter(l => l.saleId === sale.id && l.status === 'RESERVADO')
      : [];
      
    let ready = 0;
    let allReady = true;

    unfulfilled.forEach(item => {
      const needed = item.quantity - (item.boxesSeparated || 0);
      if (needed <= 0) return;

      if (sale.productionOrderId) {
        const availableFromLots = saleLots
          .filter(l => l.productId === item.productId && l.variationId === item.variationId)
          .reduce((s, l) => s + (l.boxQty || 1), 0);
          
        if (availableFromLots > 0) ready++;
        if (availableFromLots < needed) allReady = false;
        return;
      }
      
      const variation = getVariationInfo(item.productId, item.variationId);
      const available = item.saleType === SaleType.WHOLESALE
        ? (variation?.stock['WHOLESALE'] || 0)
        : (variation?.stock[item.size || ''] || 0);
        
      if (available > 0) ready++;
      if (available < needed) allReady = false;
    });

    return { total: unfulfilled.length, ready, allReady };
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

  // Quantidade ainda pendente de estoque para um item (grades/pares que faltam).
  const getItemPendingQty = (item: Sale['items'][number]): number => {
    if (item.fulfilled === true) return 0;
    const variation = getVariationInfo(item.productId, item.variationId);
    const available = item.saleType === SaleType.WHOLESALE
      ? (variation?.stock['WHOLESALE'] || 0)
      : (variation?.stock[item.size || ''] || 0);
    return Math.max(0, item.quantity - available);
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
        {/* Card único dividido em 4 partes (2 por linha) — antes era uma barra de 4
            botões numa linha só, que espremia "Configurar" até cortar o texto. */}
        <div className={`p-2 rounded-[2rem] border shadow-sm ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100/80 border-slate-100'}`}>
          <div className="grid grid-cols-2 gap-2">
            {/* Linha de cima: Cruzamento + Configurar */}
            {showCrossCheckCard !== undefined && (
              <button
                onClick={() => setShowCrossCheckCard(v => !v)}
                className={`py-3 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm ${showCrossCheckCard ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-emerald-400' : 'bg-white text-slate-600 hover:text-emerald-600'}`}
                title="Cruzamento de Demanda x Estoque e Produção"
              >
                <PackagePlus size={18} strokeWidth={2.5} className={isIndustrial ? 'text-emerald-600' : (showCrossCheckCard ? 'text-emerald-600 dark:text-emerald-400' : 'text-emerald-500')} />
                <span className="text-[10px] font-black tracking-[0.15em]">Cruzamento</span>
              </button>
            )}
            <button
              onClick={() => setShowFilters(true)}
              className={`py-3 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 relative shadow-sm ${showFilters ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-indigo-400' : 'bg-white text-slate-600 hover:text-indigo-500'}`}
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
              <span className="text-[10px] font-black tracking-[0.15em]">Configurar</span>
            </button>

            {/* Linha de baixo: Estoque + Disponível */}
            <button
              onClick={onNavigateStock}
              className={`py-3 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-amber-400' : 'bg-white text-slate-600 hover:text-amber-600'}`}
              title="Estoque de Produtos"
            >
              <Boxes size={18} strokeWidth={2.5} className={isIndustrial ? 'text-amber-600' : 'text-amber-500'} />
              <span className="text-[10px] font-black tracking-[0.15em]">Configurações Est.</span>
            </button>
            <button
              onClick={onNavigateStockGlance}
              className={`py-3 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-sky-400' : 'bg-white text-slate-600 hover:text-sky-600'}`}
              title="Disponível em Estoque (somente leitura)"
            >
              <Eye size={18} strokeWidth={2.5} className={isIndustrial ? 'text-sky-600' : 'text-sky-500'} />
              <span className="text-[10px] font-black tracking-[0.15em]">Disponível</span>
            </button>
          </div>
        </div>

        {/* Card de Cruzamento de Demanda x Estoque/Produção */}
        {showCrossCheckCard && (
          <div className={`p-4 rounded-[2rem] border shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  <PackagePlus size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className={`text-[14px] font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Cruzamento de Estoque</h3>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Vendas vs Físico vs Produção</p>
                </div>
              </div>
              <button onClick={() => setShowCrossCheckCard(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
              {crossCheckData.length === 0 && (
                <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-6">Nenhuma demanda nas vendas visíveis.</p>
              )}
              {crossCheckData.map((d) => {
                const balance = d.stock - d.demand;
                const isDeficit = balance < 0;
                const unit = d.isWholesale ? 'cx' : 'pr';
                
                return (
                  <div key={d.key} className={`p-3 rounded-2xl border flex flex-col gap-2 ${isDarkMode ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'}`}>
                    <div className="flex items-center justify-between min-w-0">
                      <div className="min-w-0 pr-2">
                        <p className={`text-[12px] font-black uppercase tracking-tight truncate flex items-center gap-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          <span>{d.reference ? `${d.reference} , ` : ''}{d.productName} , </span>
                          <span className={`font-black text-black dark:text-white`}>{d.colorName || 'Sem cor'}</span>
                          {!d.isWholesale && (
                            <span className="text-[10px] font-bold tracking-widest text-slate-400 ml-1">
                              (Tam {d.stockKey})
                            </span>
                          )}
                        </p>
                      </div>
                      <div className={`shrink-0 flex items-center justify-center h-8 px-2.5 rounded-xl border whitespace-nowrap ${isDeficit ? 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-900/20 dark:border-rose-800/50 dark:text-rose-400' : balance === 0 ? 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400'}`}>
                        <span className="text-[11px] font-black">
                          {isDeficit ? `Faltou ${Math.abs(balance)} ${unit}` : balance === 0 ? 'Em dia' : `Sobrou ${balance} ${unit}`}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                      <div className="flex-1 flex flex-col items-center justify-center py-1 rounded-lg bg-white dark:bg-slate-800">
                        <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Demanda</span>
                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">{d.demand}</span>
                      </div>
                      <div className="text-slate-300 dark:text-slate-600 text-[10px] font-black">vs</div>
                      <div className="flex-1 flex flex-col items-center justify-center py-1 rounded-lg bg-white dark:bg-slate-800">
                        <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Estoque</span>
                        <span className="text-[11px] font-black text-amber-600 dark:text-amber-500">{d.stock}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-700/50">
                      {d.sources.map(s => (
                        <button
                          key={s.saleId}
                          onClick={() => {
                            const el = document.getElementById(`sale-card-${s.saleId}`);
                            if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                el.classList.add('ring-4', 'ring-indigo-500', 'transition-all', 'duration-300');
                                setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-500'), 2000);
                                if (!expandedIds.includes(s.saleId)) {
                                  setExpandedIds(prev => [...prev, s.saleId]);
                                }
                            }
                          }}
                          className={`text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded-md flex items-center gap-1 transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                            s.status === SaleStatus.QUOTE ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800/50 dark:text-indigo-400' :
                            s.status === SaleStatus.CONFIRMED ? 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-400' :
                            'bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400'
                          }`}
                          title={`Ir para ${s.status === SaleStatus.QUOTE ? 'Orçamento' : s.status === SaleStatus.CONFIRMED ? 'Pedido' : 'Venda'} ${s.orderNumber}`}
                        >
                          <span>#{s.orderNumber}</span>
                          <span className="opacity-70">({s.demand}{unit})</span>
                        </button>
                      ))}
                    </div>

                    {d.isWholesale && d.productionPairs > 0 && (
                      <div className="flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400">
                        <div className="flex items-center gap-1.5">
                          <Factory size={12} strokeWidth={2.5} />
                          <span className="text-[10px] font-bold">{d.productionPairs} pares deste produto em produção</span>
                        </div>
                        {Object.keys(d.productionBySector).length > 0 && (
                          <span className="text-[9px] font-semibold opacity-80 pl-[18px]">
                            {Object.entries(d.productionBySector)
                              .map(([sectorId, qty]) => `${sectors.find(s => s.id === sectorId)?.name || sectorId}: ${qty}`)
                              .join(' · ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

        {/* Vendas antigas e já pagas não ficam carregadas por padrão — busca de uma vez sob demanda */}
        {searchQuery.trim() && filteredSales.length === 0 && !olderSales && (
          <button
            type="button"
            onClick={handleLoadFullHistory}
            disabled={isLoadingHistory}
            className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60 ${isDarkMode ? 'bg-indigo-950/30 text-indigo-400 border border-indigo-900/50' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}
          >
            {isLoadingHistory ? 'Carregando...' : 'Carregar histórico completo de vendas'}
          </button>
        )}

        {/* Métricas de Entrega e Valores */}
        {showSummaryBar && (deliveryStats.delivered > 0 || deliveryStats.pending > 0 || deliveryStats.totalPendingAmount > 0) && (
          <div className={`flex items-stretch justify-between px-2 py-3 rounded-[2rem] border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            
            <div className="flex-1 flex flex-col items-center justify-center gap-1.5 border-r border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Truck size={14} strokeWidth={2.5} />
              </div>
              <p className={`text-[13px] font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{deliveryStats.delivered}</p>
              <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 text-center">Entregues</p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-1.5 border-r border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Clock size={14} strokeWidth={2.5} />
              </div>
              <p className={`text-[13px] font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{deliveryStats.pending}</p>
              <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 text-center px-1">Aguardando<br/>Entrega</p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <DollarSign size={14} strokeWidth={2.5} />
              </div>
              <p className={`text-[13px] font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                R$ {deliveryStats.totalPendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 text-center">A Receber</p>
            </div>

          </div>
        )}

        {/* Card-resumo: Disponível em Estoque (estoque real, Atacado/Varejo) — toque
            navega pra StockGlanceView, a visão detalhada só-leitura. Visibilidade
            controlada em Filtros e Configurações > Visualização. */}
        {showStockGlanceCard && (
          <button
            type="button"
            onClick={onNavigateStockGlance}
            className={`w-full text-left p-4 rounded-[2rem] border shadow-sm transition-all active:scale-[0.99] ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/60' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
            title="Disponível em Estoque"
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Disponível em Estoque</span>
              <Eye size={14} className="text-slate-400" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className={`flex items-center gap-2 p-2.5 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <PackageCheck size={16} className={isDarkMode ? 'text-slate-300 shrink-0' : 'text-slate-700 shrink-0'} />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Atacado Pronto</span>
                  <span className={`text-[15px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stockGlanceSummary.wholesaleReady} cx</span>
                </div>
              </div>
              <div className={`flex items-center gap-2 p-2.5 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <PackageCheck size={16} className={isDarkMode ? 'text-slate-300 shrink-0' : 'text-slate-700 shrink-0'} />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Varejo Pronto</span>
                  <span className={`text-[15px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stockGlanceSummary.retailReady} pr</span>
                </div>
              </div>
            </div>
          </button>
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
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 ml-1">Tipo de Venda</p>
              <div className={`flex p-1 rounded-2xl border gap-1 shadow-inner ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                {(['ALL', 'RETAIL', 'WHOLESALE'] as const).map((v) => {
                  const active = filter === v;
                  const activeClass = v === 'RETAIL'
                    ? 'bg-gradient-to-b from-indigo-500 to-indigo-600 shadow-[0_2px_8px_-2px_rgba(99,102,241,0.5)]'
                    : v === 'WHOLESALE'
                      ? 'bg-gradient-to-b from-amber-400 to-amber-500 shadow-[0_2px_8px_-2px_rgba(245,158,11,0.5)]'
                      : 'bg-gradient-to-b from-slate-500 to-slate-600 shadow-[0_2px_8px_-2px_rgba(71,85,105,0.5)]';
                  return (
                    <button key={v} onClick={() => setFilter(v)}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider transition-all ${active ? `${activeClass} text-white ring-1 ring-inset ring-white/20` : isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-slate-500 hover:text-slate-800 hover:bg-white shadow-sm'}`}>
                      {v === 'ALL' ? 'Todos' : v === 'RETAIL' ? 'Varejo' : 'Atacado'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status de Pagamento */}
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 ml-1">Pagamento</p>
              <div className={`flex p-1 rounded-2xl border gap-1 shadow-inner ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                {(['ALL', 'PENDING', 'PAID'] as const).map((v) => {
                  const active = paymentFilter === v;
                  const activeClass = v === 'PENDING'
                    ? 'bg-gradient-to-b from-amber-400 to-amber-500 shadow-[0_2px_8px_-2px_rgba(245,158,11,0.5)]'
                    : v === 'PAID'
                      ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.5)]'
                      : 'bg-gradient-to-b from-slate-500 to-slate-600 shadow-[0_2px_8px_-2px_rgba(71,85,105,0.5)]';
                  return (
                    <button key={v} onClick={() => setPaymentFilter(v)}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider transition-all ${active ? `${activeClass} text-white ring-1 ring-inset ring-white/20` : isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-slate-500 hover:text-slate-800 hover:bg-white shadow-sm'}`}>
                      {v === 'ALL' ? 'Todos' : v === 'PENDING' ? 'Pendente' : 'Pago'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status de Entrega */}
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 ml-1">Entrega</p>
              <div className={`flex p-1 rounded-2xl border gap-1 shadow-inner ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                {(['ALL', 'PENDING', 'DELIVERED'] as const).map((v) => {
                  const active = deliveryFilter === v;
                  const activeClass = v === 'PENDING'
                    ? 'bg-gradient-to-b from-amber-400 to-amber-500 shadow-[0_2px_8px_-2px_rgba(245,158,11,0.5)]'
                    : v === 'DELIVERED'
                      ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.5)]'
                      : 'bg-gradient-to-b from-slate-500 to-slate-600 shadow-[0_2px_8px_-2px_rgba(71,85,105,0.5)]';
                  return (
                    <button key={v} onClick={() => setDeliveryFilter(v)}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider transition-all ${active ? `${activeClass} text-white ring-1 ring-inset ring-white/20` : isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-slate-500 hover:text-slate-800 hover:bg-white shadow-sm'}`}>
                      {v === 'ALL' ? 'Todos' : v === 'PENDING' ? 'Pendente' : 'Entregue'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status do Pedido */}
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 ml-1">Status do Pedido</p>
              <div className={`flex p-1 rounded-2xl border gap-1 shadow-inner ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                {([SaleStatus.SALE, SaleStatus.CONFIRMED, SaleStatus.QUOTE, SaleStatus.CANCELLED] as const).map((s) => {
                  const active = selectedStatuses.includes(s);
                  const label = s === SaleStatus.SALE ? 'Venda' : s === SaleStatus.CONFIRMED ? 'Pedido' : s === SaleStatus.QUOTE ? 'Orçamento' : 'Cancelado';
                  
                  let activeClass = '';
                  if (s === SaleStatus.SALE) activeClass = 'bg-gradient-to-b from-violet-500 to-violet-600 shadow-[0_2px_8px_-2px_rgba(139,92,246,0.5)]';
                  else if (s === SaleStatus.CONFIRMED) activeClass = 'bg-gradient-to-b from-sky-500 to-sky-600 shadow-[0_2px_8px_-2px_rgba(14,165,233,0.5)]';
                  else if (s === SaleStatus.QUOTE) activeClass = 'bg-gradient-to-b from-amber-400 to-amber-500 shadow-[0_2px_8px_-2px_rgba(245,158,11,0.5)]';
                  else activeClass = 'bg-gradient-to-b from-rose-500 to-rose-600 shadow-[0_2px_8px_-2px_rgba(244,63,94,0.5)]';

                  return (
                    <button key={s}
                      onClick={() => setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider transition-all ${
                        active 
                          ? `${activeClass} text-white ring-1 ring-inset ring-white/20` 
                          : isDarkMode 
                            ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' 
                            : 'text-slate-500 hover:text-slate-800 hover:bg-white shadow-sm'
                      }`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visualização */}
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 ml-1">Visualização</p>
              <div className="flex gap-2">
                <button onClick={() => setExpandedCards(v => !v)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all ${expandedCards ? 'bg-gradient-to-b from-slate-500 to-slate-600 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(71,85,105,0.5)] ring-1 ring-inset ring-white/20' : isDarkMode ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-800/80' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
                  {expandedCards ? 'Cards Expandidos' : 'Cards Compactos'}
                </button>
                <button onClick={() => setShowProducts(v => !v)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all ${showProducts ? 'bg-gradient-to-b from-slate-500 to-slate-600 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(71,85,105,0.5)] ring-1 ring-inset ring-white/20' : isDarkMode ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-800/80' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
                  {showProducts ? 'Mostrar Produtos' : 'Ocultar Produtos'}
                </button>
              </div>
              <button onClick={() => setShowGradeBreakdown(v => !v)}
                className={`w-full py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all ${showGradeBreakdown ? 'bg-gradient-to-b from-violet-500 to-violet-600 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(139,92,246,0.5)] ring-1 ring-inset ring-white/20' : isDarkMode ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-800/80' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
                {showGradeBreakdown ? 'Ocultar Padrão de Embalagem' : 'Mostrar Padrão de Embalagem'}
              </button>
              <button onClick={() => setShowSeparationInfo(v => !v)}
                className={`w-full py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all flex items-center justify-center gap-2 ${showSeparationInfo ? 'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(99,102,241,0.5)] ring-1 ring-inset ring-white/20' : isDarkMode ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-800/80' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
                <Boxes size={14} strokeWidth={2.5} />
                {showSeparationInfo ? 'Avisos de Separação Visíveis' : 'Avisos de Separação Ocultos'}
              </button>
              <button onClick={() => setShowSummaryBar(v => !v)}
                className={`w-full py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all flex items-center justify-center gap-2 ${showSummaryBar ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(16,185,129,0.5)] ring-1 ring-inset ring-white/20' : isDarkMode ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-800/80' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
                <DollarSign size={14} strokeWidth={2.5} />
                {showSummaryBar ? 'Barra de Valores Visível' : 'Barra de Valores Oculta'}
              </button>
              <button onClick={() => setShowStockGlanceCard(v => !v)}
                className={`w-full py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all flex items-center justify-center gap-2 ${showStockGlanceCard ? 'bg-gradient-to-b from-sky-500 to-sky-600 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(14,165,233,0.5)] ring-1 ring-inset ring-white/20' : isDarkMode ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-800/80' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
                <Eye size={14} strokeWidth={2.5} />
                {showStockGlanceCard ? 'Card Disponível em Estoque Visível' : 'Card Disponível em Estoque Oculto'}
              </button>
            </div>

            <button
              onClick={() => { setFilter('ALL'); setPaymentFilter('ALL'); setDeliveryFilter('ALL'); setSelectedStatuses([SaleStatus.SALE, SaleStatus.CONFIRMED, SaleStatus.QUOTE]); setExpandedCards(false); setShowProducts(true); setShowGradeBreakdown(false); setShowSeparationInfo(true); setShowSummaryBar(true); setShowStockGlanceCard(true); }}
              className="mt-1 w-full py-3 rounded-2xl text-[10px] font-black tracking-widest text-rose-500 border border-rose-100 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all shadow-sm bg-white dark:bg-slate-900"
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
            <div id={`sale-card-${sale.id}`} key={sale.id} className={`p-6 rounded-[2.5rem] border shadow-xl dark:shadow-none flex flex-col gap-6 relative overflow-hidden group transition-all duration-300 hover:shadow-2xl ${
              sale.status === SaleStatus.CANCELLED
                ? 'bg-slate-900 border-slate-800 opacity-60 grayscale-[0.5]'
                : isDarkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-100'
            }`}>
              {/* Row 1: Customer & Basic Info */}
              <div className="flex flex-col gap-3 z-10">
                {/* Client name mini-card — cabeçalho colado nas laterais do card pai */}
                <div className={`flex items-center justify-between px-6 py-4 -mx-6 -mt-6 rounded-t-[2.5rem] ${
                  sale.status === SaleStatus.CANCELLED
                    ? 'bg-slate-800/60'
                    : isDarkMode ? 'bg-slate-800' : 'bg-slate-50'
                }`}>
                  <div className="min-w-0">
                    <h3 className={`font-black text-base tracking-tight leading-none truncate ${sale.status === SaleStatus.CANCELLED ? 'text-slate-500' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {sale.saleDestination === 'STOCK' ? 'Estoque' : (sale.customerName || 'Cliente')}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-black tracking-widest">
                        <Calendar size={10} strokeWidth={3} />
                        {format(sale.date, "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-indigo-500 dark:text-indigo-400 font-black tracking-widest">
                        <Hash size={10} strokeWidth={3} />
                        {sale.orderNumber}
                      </div>
                      {sale.saleDestination === 'STOCK' && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-white uppercase tracking-widest">
                          Estoque
                        </span>
                      )}
                      {isExpanded && sale.sellerName && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md leading-none tracking-widest bg-indigo-600 text-white shadow-sm">
                          {sale.sellerName}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSale(sale)}
                    title="Ver Detalhes do Pedido"
                    aria-label={`Ver detalhes do pedido de ${sale.customerName || 'Cliente'}`}
                    className={`shrink-0 ml-3 transition-all hover:scale-110 ${
                      sale.status === SaleStatus.QUOTE
                        ? 'text-amber-500'
                        : sale.status === SaleStatus.CONFIRMED
                          ? 'text-sky-500'
                          : 'text-indigo-600 dark:text-indigo-400'
                    }`}
                  >
                    <ShoppingBag size={18} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Badges abaixo do mini-card: status + entrega */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {sale.isAccounting === false && (
                      <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 border border-rose-200 dark:border-rose-800 uppercase tracking-widest">
                        NC
                      </span>
                    )}
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
                    {sale.deliveryStatus === 'DELIVERED' && sale.status !== SaleStatus.CANCELLED && (
                      <span className="text-[8px] font-black px-2 py-1 rounded-lg leading-none tracking-widest shadow-sm bg-emerald-500 text-white uppercase flex items-center gap-1">
                        <Truck size={10} /> Pedido Entregue
                      </span>
                    )}
                  </div>

                  {/* Badges de estoque + expand */}
                  <div className="flex flex-row flex-wrap items-center justify-end gap-1.5 shrink-0">

                  {/* Badge Caixas prontas — produção concluída, aguardando "Liberar Pedido" */}
                  {sale.status === SaleStatus.SALE && sale.deliveryStatus !== 'DELIVERED' && (reservedLotsBySale.get(sale.id) || []).length > 0 && (
                    <span className="text-[8px] font-black px-2 py-1 rounded-lg leading-none tracking-widest bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400 flex items-center gap-1">
                      <PackageCheck size={9} /> {(reservedLotsBySale.get(sale.id) || []).length} pronta(s)
                    </span>
                  )}

                  <button
                    onClick={() => toggleExpand(sale.id)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                    title={isExpanded ? "Recolher" : "Expandir"}
                  >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
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
                  {/* Banner: separação de caixas */}
                  {sale.status === SaleStatus.SALE && sale.deliveryStatus !== 'DELIVERED' && (() => {
                    const totalOrdered = sale.items.reduce((s, it) => s + it.quantity, 0);
                    const totalSeparated = sale.items.reduce((s, it) => s + (it.boxesSeparated || 0), 0);
                    const allSeparated = totalSeparated >= totalOrdered;

                    // Se já estiver tudo separado, não mostra o banner interno (pois já mostramos no aviso geral externo)
                    if (allSeparated) return null;

                    const stockStatus = getUnfulfilledStockStatus(sale);
                    const hasReservedLots = (reservedLotsBySale.get(sale.id) || []).length > 0;
                    const canSeparate = hasReservedLots || (stockStatus && stockStatus.ready > 0);
                    if (!canSeparate) return null;

                    const unit = sale.items.some(it => it.saleType === SaleType.WHOLESALE) ? 'cx' : 'pares';

                    return (
                      <div className={`flex flex-col gap-2 px-4 py-2.5 rounded-2xl ${isDarkMode ? 'bg-indigo-900/20 border border-indigo-800/40' : 'bg-indigo-50 border border-indigo-100'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Boxes size={14} className="text-indigo-500 shrink-0" />
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest truncate">
                              Separação de caixas pendente
                            </span>
                          </div>
                          {totalSeparated > 0 && (
                            <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shrink-0 bg-indigo-500 text-white`}>
                              {totalSeparated}/{totalOrdered} {unit}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSeparacaoSale(sale); }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-sm shadow-indigo-600/20"
                        >
                          <Boxes size={14} strokeWidth={2.5} /> Separar Caixas
                        </button>
                      </div>
                    );
                  })()}

                <div className={`flex ${sale.status === SaleStatus.QUOTE ? 'flex-col' : 'justify-between items-start'} gap-4`}>
                  {/* Items List (Left/Top) */}
                  {showProducts ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setItemsPopupSale(sale); }}
                      title="Abrir separação de itens"
                      aria-label="Abrir separação de itens da venda"
                      className="flex-1 flex flex-col gap-3 cursor-pointer min-w-0 text-left"
                    >
                      {(() => {
                        // Pedido marcado como entregue: todos os itens são considerados separados
                        const isDelivered = sale.deliveryStatus === 'DELIVERED';
                        const separatedItems = isDelivered
                          ? sale.items
                          : sale.items.filter(it => (it.boxesSeparated || 0) > 0 || it.fulfilled === true);
                        if (separatedItems.length === 0) {
                          return (
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                                <Boxes size={12} className="text-slate-400" strokeWidth={3} />
                              </div>
                              <p className={`text-[11px] font-bold tracking-wide ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                Aguardando separação
                              </p>
                            </div>
                          );
                        }
                        return (
                          <>
                            {separatedItems.slice(0, 3).map((item, idx) => {
                              const product = getProductInfo(item.productId);
                              const variation = getVariationInfo(item.productId, item.variationId);
                              // Para entregues ou items expedidos pelo fluxo antigo sem boxesSeparated, considera tudo separado
                              const separated = (item.boxesSeparated || 0) > 0 ? item.boxesSeparated! : item.quantity;
                              const unit = item.saleType === SaleType.WHOLESALE ? 'cx' : 'pares';
                              const done = separated >= item.quantity;
                              return (
                                <div key={idx} className="flex items-center gap-3">
                                  <div className={`p-2 rounded-xl shrink-0 ${done ? (isDarkMode ? 'bg-emerald-900/30' : 'bg-emerald-50') : (isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50')}`}>
                                    {done
                                      ? <CheckCircle2 size={12} className="text-emerald-500" strokeWidth={3} />
                                      : <Boxes size={12} className="text-indigo-500" strokeWidth={3} />}
                                  </div>
                                  <div className="min-w-0">
                                    <p className={`text-[11px] font-black leading-none tracking-tight truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                      {product?.reference || '---'} {product?.name}
                                    </p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold mt-1.5 tracking-widest">
                                      {variation?.colorName} • <span className={done ? 'text-emerald-500' : 'text-indigo-500 dark:text-indigo-400'}>{separated}/{item.quantity} {unit}</span>
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                            {separatedItems.length > 3 && (
                              <span className="text-[11px] text-slate-400 dark:text-slate-600 font-black tracking-[0.2em] italic ml-11">+{separatedItems.length - 3} outros</span>
                            )}
                          </>
                        );
                      })()}
                    </button>
                  ) : (
                    <div className="flex-1 min-w-0" />
                  )}

                </div>
                </div>
              )}

              {showSeparationInfo && sale.status === SaleStatus.SALE && (() => {
                const totalOrdered = sale.items.reduce((s, it) => s + it.quantity, 0);
                const totalSeparated = sale.items.reduce((s, it) => s + (it.boxesSeparated || 0), 0);
                const allSeparated = totalSeparated >= totalOrdered;

                // Se o pedido estiver totalmente separado, exibe o aviso de sucesso (visível mesmo colapsado)
                if (allSeparated && sale.deliveryStatus !== 'DELIVERED') {
                  const unit = sale.items.some(it => it.saleType === SaleType.WHOLESALE) ? 'cx' : 'pares';
                  return (
                    <div className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between gap-3 z-10">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 leading-snug">
                          <span className="font-black uppercase tracking-widest text-[8px] block mb-1">Status de Separação</span>
                          pedido totalmente separado, ja pode fazer a entrega/expedicao
                        </p>
                      </div>
                      <span className="text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest bg-emerald-500 text-white shrink-0">
                        {totalSeparated}/{totalOrdered} {unit}
                      </span>
                    </div>
                  );
                }

                if (allSeparated) return null;

                const stockStatus = getUnfulfilledStockStatus(sale);
                if (!stockStatus) return null;
                
                if (stockStatus.allReady) {
                  return (
                    <div className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-2.5 z-10">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 leading-snug">
                        <span className="font-black uppercase tracking-widest text-[8px] block mb-1">Status de Separação</span>
                        No estoque tem caixas disponíveis que se encaixam nesse pedido e você consegue fechá-lo completo.
                      </p>
                    </div>
                  );
                }
                
                if (stockStatus.ready > 0) {
                  return (
                    <div className="mb-4 flex flex-col gap-2 z-10">
                      <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 flex items-start gap-2.5">
                        <Clock size={16} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 leading-snug">
                          <span className="font-black uppercase tracking-widest text-[8px] block mb-1">Aviso de Estoque</span>
                          Aguardando estoque para este pedido. ({stockStatus.ready}/{stockStatus.total})
                        </p>
                      </div>
                      
                      <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-2.5">
                        <Boxes size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 leading-snug">
                          <span className="font-black uppercase tracking-widest text-[8px] block mb-1">Produtos Disponíveis</span>
                          Tem caixas em estoque disponíveis para separação. Gostaria de separá-las?
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="mb-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5 z-10">
                    <Clock size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-snug">
                      <span className="font-black uppercase tracking-widest text-[8px] block mb-1">Aviso de Estoque</span>
                      Aguardando estoque para este pedido. ({stockStatus.ready}/{stockStatus.total})
                    </p>
                  </div>
                );
              })()}

              {/* Financial Summary Card */}
              <div className={`flex items-center justify-between px-4 py-2.5 rounded-2xl z-10 ${
                sale.status === SaleStatus.CANCELLED
                  ? 'bg-slate-800/30'
                  : isDarkMode ? 'bg-slate-800' : 'bg-slate-50'
              }`}>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                    {remaining > 0 ? 'Restante' : (sale.status === SaleStatus.QUOTE ? 'Orçamento' : 'Pago')}
                  </p>
                  <p className={`text-[14px] font-black leading-none ${
                    sale.status === SaleStatus.CANCELLED
                      ? 'text-slate-500'
                      : remaining > 0
                        ? 'text-rose-500'
                        : 'text-emerald-500'
                  }`}>
                    R$ {(remaining > 0 ? remaining : sale.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Total</p>
                  <p className={`text-[14px] font-black leading-none ${sale.status === SaleStatus.CANCELLED ? 'text-slate-500' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Action Bar (Footer) */}
              <div className="flex flex-col gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/50 z-10">
                <div className="flex justify-between items-center w-full gap-2">
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Note Indicator if exists */}
                    {sale.notes && (
                      <button
                        type="button"
                        title="Ver observação"
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

                  {/* Actions Group (Floating Island) — ícones um pouco menores pra caber
                      numa linha só em telas estreitas, sem cortar/quebrar linha. */}
                  <div className="flex flex-nowrap items-center gap-1 p-1 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                    {/* View Order Button */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setItemsPopupSale(sale); }}
                      className="w-8 h-8 flex items-center justify-center bg-sky-50 dark:bg-sky-500/10 text-sky-500 rounded-full active:scale-90 transition-all"
                      title="Visualizar pedido"
                    >
                      <Eye size={14} />
                    </button>

                    {/* Quick Expedite Button (Truck Icon) — quando já entregue, vira atalho
                        direto pra "Reverter Expedição" (caso a expedição/entrega tenha sido
                        feita por engano), sem precisar abrir o menu "Mais Opções". */}
                    {(() => {
                      const isCompleted = sale.items.length > 0 && sale.items.every(it => it.fulfilled === true || (it.boxesSeparated || 0) >= it.quantity);
                      const isDelivered = sale.deliveryStatus === 'DELIVERED';
                      const isQuote = sale.status === SaleStatus.QUOTE;
                      const canExpedite = isCompleted && !isDelivered && !isQuote;
                      // Inclui isDelivered no OR: mesmo que nenhum item esteja marcado
                      // fulfilled/separado (pedido entregue de forma inconsistente, ex.:
                      // editado depois da entrega), ainda precisa dar pra reverter a
                      // marcação de "Entregue" — senão o pedido fica travado sem saída.
                      const canRevert = sale.status === SaleStatus.SALE && (isDelivered || sale.items.some(it => it.fulfilled === true) || sale.items.some(it => (it.boxesSeparated || 0) > 0));

                      if (isDelivered && canRevert) {
                        return (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setRevertSale(sale); }}
                            className="w-8 h-8 flex items-center justify-center bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-full active:scale-90 transition-all"
                            title="Pedido entregue — reverter expedição"
                          >
                            <RotateCcw size={14} />
                          </button>
                        );
                      }

                      return (
                        <button
                          type="button"
                          disabled={!canExpedite}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpediteSale(sale);
                          }}
                          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                            canExpedite
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 active:scale-90 animate-pulse-dispatch'
                              : 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-400 cursor-not-allowed'
                          }`}
                          title={
                            isDelivered
                              ? "Pedido já entregue"
                              : isQuote
                              ? "Confirmar orçamento antes de expedir"
                              : canExpedite
                              ? "Expedir pedido"
                              : "Aguardando separação completa"
                          }
                        >
                          <Truck size={14} />
                        </button>
                      );
                    })()}

                    {/* Simple Preview Button (substituiu PDF) */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSimplePreviewSale(sale); }}
                      className="w-8 h-8 flex items-center justify-center bg-amber-50 dark:bg-amber-500/10 text-amber-500 rounded-full active:scale-90 transition-all"
                      title="Visualizar resumo do pedido"
                    >
                      <FileText size={14} />
                    </button>

                    {/* JPG/PDF Export Button */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenExport(e, sale, 'jpg')}
                      className="w-8 h-8 flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-full font-black text-[7px] tracking-tighter active:scale-90 transition-all"
                      title="Exportar (JPG/PDF)"
                    >
                      JPG
                    </button>

                    {/* Payment/Dollar Button */}
                    {sale.status !== SaleStatus.QUOTE && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPaymentModalMode(totalPaid >= sale.total ? 'HISTORY' : 'PAYMENT');
                          setPaymentModalSale(sale);
                        }}
                        className="w-8 h-8 flex items-center justify-center bg-purple-50 dark:bg-purple-500/10 text-purple-500 rounded-full active:scale-90 transition-all"
                        title="Pagamento"
                      >
                        <DollarSign size={15} />
                      </button>
                    )}


                    {/* Edit Button — bloqueado depois de entregue, pra não dessincronizar o
                        pedido do que já foi abatido do estoque na expedição. Reverter a
                        expedição (botão/menu acima) libera a edição de novo. */}
                    {(() => {
                      const isDelivered = sale.deliveryStatus === 'DELIVERED';
                      return (
                        <button
                          type="button"
                          disabled={isDelivered}
                          onClick={(e) => { e.stopPropagation(); if (isDelivered) return; onEdit(sale); }}
                          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                            isDelivered
                              ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-400 cursor-not-allowed'
                              : 'bg-blue-50 dark:bg-blue-500/10 text-blue-500 active:scale-90'
                          }`}
                          title={isDelivered ? "Pedido entregue — reverta a expedição para editar" : "Editar"}
                        >
                          <Edit2 size={14} />
                        </button>
                      );
                    })()}

                    {/* More Options Menu */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === sale.id ? null : sale.id);
                        }}
                        className={`w-8 h-8 flex items-center justify-center bg-rose-50 dark:bg-slate-700/50 text-slate-500 rounded-full active:scale-90 transition-all ${activeMenuId === sale.id ? 'bg-rose-100' : ''}`}
                        title="Mais Opções"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {activeMenuId === sale.id && createPortal(
                        <div
                          className="fixed inset-0 z-[300000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
                          onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }}
                        >
                          <div
                            onClick={e => e.stopPropagation()}
                            className={`w-full max-w-xs rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
                          >
                            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Opções</p>
                                <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pedido #{sale.orderNumber}</p>
                              </div>
                              <button onClick={() => setActiveMenuId(null)} title="Fechar" aria-label="Fechar" className={`p-2 rounded-xl ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}>
                                <X size={20} strokeWidth={2.5} />
                              </button>
                            </div>
                            <div className="p-3 flex flex-col gap-1.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCopyMessage(sale); setActiveMenuId(null); }}
                                className={`w-full px-4 py-3.5 rounded-2xl text-[11px] font-black tracking-widest flex items-center gap-3 transition-all active:scale-[0.98] ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'}`}
                              >
                                <Copy size={16} /> Copiar Texto
                              </button>
                              {sale.status === SaleStatus.SALE && sale.deliveryStatus !== 'DELIVERED' && (
                                (() => {
                                  const hasReservedLots = (reservedLotsBySale.get(sale.id) || []).length > 0;
                                  const hasStock = !!(getUnfulfilledStockStatus(sale)?.ready);
                                  if (!hasReservedLots && !hasStock) return null;
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setSeparacaoSale(sale); setActiveMenuId(null); }}
                                      className="w-full px-4 py-3.5 rounded-2xl text-[11px] font-black tracking-widest flex items-center gap-3 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all active:scale-[0.98]"
                                    >
                                      <Boxes size={16} /> Separar Caixas
                                    </button>
                                  );
                                })()
                              )}
                              {sale.status === SaleStatus.SALE && sale.deliveryStatus !== 'DELIVERED' && (reservedLotsBySale.get(sale.id) || []).length > 0 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleReleaseClick(sale); setActiveMenuId(null); }}
                                  className="w-full px-4 py-3.5 rounded-2xl text-[11px] font-black tracking-widest flex items-center gap-3 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all active:scale-[0.98]"
                                >
                                  <PackageCheck size={16} /> Liberar Pedido
                                </button>
                              )}
                              {sale.status === SaleStatus.SALE && getUnfulfilledStockStatus(sale)?.ready ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setExpediteSale(sale); setActiveMenuId(null); }}
                                  className="w-full px-4 py-3.5 rounded-2xl text-[11px] font-black tracking-widest flex items-center gap-3 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all active:scale-[0.98]"
                                >
                                  <Truck size={16} /> Expedir / Baixar
                                </button>
                              ) : null}
                              {sale.status === SaleStatus.SALE && (sale.deliveryStatus === 'DELIVERED' || sale.items.some(it => it.fulfilled === true) || sale.items.some(it => (it.boxesSeparated || 0) > 0)) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setRevertSale(sale); setActiveMenuId(null); }}
                                  className="w-full px-4 py-3.5 rounded-2xl text-[11px] font-black tracking-widest flex items-center gap-3 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all active:scale-[0.98]"
                                >
                                  <RotateCcw size={16} /> Reverter Expedição
                                </button>
                              )}
                              {sale.status === SaleStatus.SALE && (reservedLotsBySale.get(sale.id) || []).length > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setTransferSale(sale); setActiveMenuId(null); }}
                                  className="w-full px-4 py-3.5 rounded-2xl text-[11px] font-black tracking-widest flex items-center gap-3 text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all active:scale-[0.98]"
                                >
                                  <Boxes size={16} /> Transferir para Estoque
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); setSaleToDelete(sale.id); setActiveMenuId(null); }}
                                className="w-full px-4 py-3.5 rounded-2xl text-[11px] font-black tracking-widest flex items-center gap-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all active:scale-[0.98]"
                              >
                                {saleProductionHasProgressed(sale, productionOrders, lots)
                                  ? <><Ban size={16} /> Cancelar e Estornar</>
                                  : <><Trash2 size={16} /> Excluir</>}
                              </button>
                            </div>
                          </div>
                        </div>,
                        document.body
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
        type="button"
        title="Nova venda"
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



      {/* Popup — Resumo Simples do Pedido */}
      {simplePreviewSale && (() => {
        const s = simplePreviewSale;
        const totalPaidPrev = (s.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
        const remainingPrev = Math.max(0, s.total - totalPaidPrev);
        return (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setSimplePreviewSale(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-sm max-h-[88vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Resumo do Pedido</p>
                  <p className={`text-[15px] font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {s.customerName || 'Cliente'}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">#{s.orderNumber}</p>
                </div>
                <button
                  type="button"
                  title="Fechar"
                  onClick={() => setSimplePreviewSale(null)}
                  className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>

              {/* Items */}
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                {s.items.map((item, idx) => {
                  const product = getProductInfo(item.productId);
                  const variation = getVariationInfo(item.productId, item.variationId);
                  const unit = item.saleType === SaleType.WHOLESALE ? 'cx' : 'pares';
                  const lineTotal = item.price * item.quantity;
                  const isLast = idx === s.items.length - 1;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between px-5 py-3.5 gap-3 ${!isLast ? (isDarkMode ? 'border-b border-slate-800' : 'border-b border-slate-50') : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-900 dark:bg-slate-700 text-white text-[9px] font-black uppercase tracking-widest">
                            {product?.reference && `${product.reference} · `}{product?.name}
                            {variation?.colorName && ` · ${variation.colorName}`}
                          </span>
                        </div>
                        {item.size && (
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Nº {item.size}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[12px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          R$ {lineTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                          <span className={`text-[11px] font-black ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{item.quantity} {unit}</span> · R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className={`px-5 py-4 border-t shrink-0 ${isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50'}`}>
                {remainingPrev > 0 && (
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Restante</span>
                    <span className="text-[12px] font-black text-rose-500">R$ {remainingPrev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
                  <span className={`text-[17px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    R$ {s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(s)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all hover:bg-emerald-700"
                >
                  <MessageSquare size={16} /> Compartilhar via WhatsApp
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Popup — Itens da Venda + Separação Inline */}
      {itemsPopupSale && (() => {
        const s = itemsPopupSale;
        const reservedLots = stockLots.filter(l => l.saleId === s.id && l.status === 'RESERVADO');

        const rows = s.items.map((item, idx) => {
          const product = getProductInfo(item.productId);
          const variation = getVariationInfo(item.productId, item.variationId);
          const unit = item.saleType === SaleType.WHOLESALE ? 'cx' : 'pares';
          const separated = item.boxesSeparated || 0;
          const remaining = Math.max(0, item.quantity - separated);
          const lineTotal = item.price * item.quantity;

          const itemLots = reservedLots.filter(l => l.productId === item.productId && l.variationId === item.variationId);
          const hasReserved = itemLots.length > 0;
          const fullProduct = products.find(p => p.id === item.productId);
          const fullVariation = fullProduct?.variations.find(v => v.id === item.variationId);
          const stockKey = item.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (item.size || '');
          const stockAvailable = (fullVariation?.stock?.[stockKey] as number) || 0;
          // Venda com produção atrelada = grade avulsa feita sob medida para o cliente.
          // Nunca cai no estoque agregado — só pode vir do lote reservado para esta venda.
          const maxFromLots = itemLots.reduce((sum, l) => sum + (l.boxQty || 1), 0);
          const maxSeparable = s.productionOrderId
            ? (hasReserved ? Math.min(remaining, maxFromLots) : 0)
            : Math.min(remaining, stockAvailable);

          return { idx, item, product, variation, unit, separated, remaining, lineTotal, hasReserved, itemLots, stockAvailable, maxSeparable };
        });

        const isDelivered = s.deliveryStatus === 'DELIVERED';
        const pendingRows = rows.filter(r => r.remaining > 0);
        const doneRows = rows.filter(r => r.remaining === 0);

        const setQty = (idx: number, max: number, val: number) => {
          if (isDelivered) return;
          setPopupSepQtys(prev => ({ ...prev, [idx]: Math.min(max, Math.max(0, val)) }));
        };

        const toApply = rows
          .map(r => ({ itemIdx: r.idx, quantity: popupSepQtys[r.idx] || 0 }))
          .filter(x => x.quantity > 0);
        const totalToSeparate = toApply.reduce((s, x) => s + x.quantity, 0);

        const handleConfirmSep = async () => {
          if (toApply.length === 0) return;
          setProcessingPopupSep(true);
          try {
            await onSepararCaixas(s.id, toApply);
            setItemsPopupSale(null);
          } finally {
            setProcessingPopupSep(false);
          }
        };

        return (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setItemsPopupSale(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-md max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                    <Boxes size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pedido &amp; Separação</p>
                    <p className={`text-base font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>#{s.orderNumber} · {s.customerName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setItemsPopupSale(null)}
                  title="Fechar"
                  aria-label="Fechar"
                  className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>

              {/* Identificação: venda com produção atrelada (separação de cliente) */}
              {s.productionOrderId && (
                <div className={`flex items-center gap-2 px-6 py-2.5 shrink-0 border-b ${isDarkMode ? 'bg-orange-900/20 border-slate-800' : 'bg-orange-50 border-orange-100'}`}>
                  <Factory size={14} className="text-orange-500 shrink-0" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 leading-tight">
                    Venda com Produção · Separação de Cliente
                  </span>
                </div>
              )}

              {/* Items + separation controls */}
              <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3 custom-scrollbar">
                {/* Banner de bloqueio quando entregue */}
                {isDelivered && (
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl ${isDarkMode ? 'bg-emerald-900/20 border border-emerald-800/30' : 'bg-emerald-50 border border-emerald-100'}`}>
                    <Truck size={14} className="text-emerald-500 shrink-0" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                      Pedido entregue · Separação bloqueada
                    </p>
                  </div>
                )}

                {/* Items pending separation */}
                {pendingRows.map(row => {
                  const qty = popupSepQtys[row.idx] ?? 0;
                  return (
                    <div
                      key={row.idx}
                      className={`p-3 rounded-2xl border ${isDelivered ? 'opacity-60' : ''} ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}
                    >
                      {/* Product header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-black uppercase tracking-wider">
                              {row.product?.reference && `${row.product.reference} · `}{row.product?.name}
                              {row.variation?.colorName && ` · ${row.variation.colorName}`}
                            </span>
                          </div>
                          {row.item.size && (
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Nº {row.item.size}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-[11px] font-black uppercase tracking-widest ${row.separated > 0 ? 'text-indigo-500' : 'text-slate-400'}`}>
                            {row.separated}/{row.item.quantity} {row.unit}
                          </p>
                          <p className={`text-[12px] font-black mt-0.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            R$ {row.lineTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {/* Source badge */}
                      {row.hasReserved ? (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg mb-2.5 ${isDarkMode ? 'bg-violet-900/20' : 'bg-violet-50'}`}>
                          <Boxes size={10} className="text-violet-500 shrink-0" />
                          <span className="text-[8px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">
                            {row.itemLots.length} lote(s) reservado(s)
                          </span>
                          <span className="ml-auto text-[8px] font-black text-violet-500">
                            {row.itemLots.map(l => l.gradeLabel).join(', ')}
                          </span>
                        </div>
                      ) : s.productionOrderId ? (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg mb-2.5 ${isDarkMode ? 'bg-orange-900/20' : 'bg-orange-50'}`}>
                          <Factory size={10} className="text-orange-500 shrink-0" />
                          <span className="text-[8px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">
                            Aguardando lotes da produção
                          </span>
                        </div>
                      ) : (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg mb-2.5 ${
                          row.stockAvailable >= row.remaining
                            ? (isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50')
                            : (isDarkMode ? 'bg-amber-900/20' : 'bg-amber-50')
                        }`}>
                          <PackageCheck size={10} className={row.stockAvailable >= row.remaining ? 'text-emerald-500 shrink-0' : 'text-amber-500 shrink-0'} />
                          <span className={`text-[8px] font-black uppercase tracking-widest ${
                            row.stockAvailable >= row.remaining
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}>
                            Estoque: {row.stockAvailable} {row.unit} disponíveis
                          </span>
                        </div>
                      )}

                      {/* Quantity stepper */}
                      <div className={`flex items-center gap-2 ${isDelivered ? 'pointer-events-none' : ''}`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">Separar</span>
                        <div className={`flex items-center flex-1 rounded-xl p-1 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}>
                          <button
                            type="button"
                            disabled={isDelivered}
                            onClick={() => setQty(row.idx, row.maxSeparable, qty - 1)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isDelivered ? 'cursor-not-allowed' : 'active:scale-90'} ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}
                            aria-label="Diminuir"
                          >
                            <Minus size={13} strokeWidth={3} />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={row.maxSeparable}
                            disabled={isDelivered}
                            value={qty === 0 ? '' : qty}
                            onFocus={e => e.currentTarget.select()}
                            onChange={e => setQty(row.idx, row.maxSeparable, parseInt(e.target.value) || 0)}
                            className={`flex-1 text-center border-none p-0 text-sm font-black focus:ring-0 bg-transparent ${isDelivered ? 'cursor-not-allowed' : ''} ${isDarkMode ? 'text-white' : 'text-slate-800'}`}
                            aria-label="Quantidade"
                          />
                          <button
                            type="button"
                            disabled={isDelivered}
                            onClick={() => setQty(row.idx, row.maxSeparable, qty + 1)}
                            className={`w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center transition-all ${isDelivered ? 'cursor-not-allowed opacity-50' : 'active:scale-90'}`}
                            aria-label="Aumentar"
                          >
                            <Plus size={13} strokeWidth={3} />
                          </button>
                        </div>
                        <span className="text-[9px] font-black uppercase text-slate-400 w-8 text-center shrink-0">{row.unit}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Already fully separated items */}
                {doneRows.length > 0 && pendingRows.length > 0 && (
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center pt-1">Já separados</p>
                )}
                {doneRows.map(row => (
                  <div
                    key={row.idx}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${isDarkMode ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-emerald-50 border-emerald-100'}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-[9px] font-black uppercase tracking-wider">
                          {row.product?.reference && `${row.product.reference} · `}{row.product?.name}
                          {row.variation?.colorName && ` · ${row.variation.colorName}`}
                        </span>
                      </div>
                      {row.item.size && (
                        <p className="text-[9px] font-bold text-emerald-500 mt-0.5 uppercase tracking-widest">
                          Nº {row.item.size}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <CheckCircle2 size={14} className="text-emerald-500" strokeWidth={2.5} />
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                        {row.separated}/{row.item.quantity} {row.unit}
                      </span>
                    </div>
                  </div>
                ))}

                {/* All done */}
                {pendingRows.length === 0 && doneRows.length > 0 && (
                  <div className="py-6 text-center px-4">
                    <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      pedido totalmente separado, ja pode fazer a entrega/expedicao
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className={`p-4 border-t shrink-0 ${isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total do Pedido</span>
                  <div className="text-right">
                    <span className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      R$ {s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    {s.discount > 0 && (
                      <p className="text-[9px] font-black text-rose-500">- R$ {s.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} desconto</p>
                    )}
                  </div>
                </div>
                {(() => {
                  const hasSeparated = s.deliveryStatus === 'DELIVERED' || s.items.some(it => it.fulfilled === true || (it.boxesSeparated || 0) > 0);
                  return (
                    <div className={`flex items-stretch rounded-2xl overflow-hidden shadow-sm ${isDarkMode ? 'bg-slate-800' : 'bg-white border border-slate-200'}`}>
                      <button
                        type="button"
                        onClick={() => setItemsPopupSale(null)}
                        disabled={processingPopupSep}
                        className={`flex-[0.8] py-4 text-[10px] font-black uppercase tracking-widest transition-all border-r ${isDarkMode ? 'text-slate-300 hover:bg-slate-700 border-slate-700' : 'text-slate-600 hover:bg-slate-50 border-slate-100'}`}
                      >
                        Fechar
                      </button>
                      
                      <button
                        type="button"
                        disabled={processingPopupSep || !hasSeparated}
                        onClick={() => {
                          setItemsPopupSale(null);
                          setRevertSale(s);
                        }}
                        className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all border-r ${
                          !hasSeparated
                            ? (isDarkMode ? 'text-slate-600 border-slate-700 bg-slate-800/50 cursor-not-allowed' : 'text-slate-300 border-slate-100 bg-slate-50 cursor-not-allowed')
                            : (isDarkMode ? 'text-amber-500 hover:bg-amber-500/10 border-slate-700' : 'text-amber-600 hover:bg-amber-50 border-slate-100')
                        }`}
                      >
                        <RotateCcw size={14} strokeWidth={2.5} />
                        Reverter
                      </button>

                      <button
                        type="button"
                        disabled={processingPopupSep || toApply.length === 0 || isDelivered}
                        onClick={handleConfirmSep}
                        className={`flex-[1.2] py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                          toApply.length === 0 || isDelivered
                            ? (isDarkMode ? 'text-slate-600 bg-slate-800/50 cursor-not-allowed' : 'text-slate-300 bg-slate-50 cursor-not-allowed')
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        <Boxes size={14} strokeWidth={2.5} />
                        {processingPopupSep ? '...' : `Separar (${totalToSeparate})`}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Popup — Expedição (pré-visualiza as baixas no estoque) */}
      {expediteSale && (() => {
        const s = expediteSale;
        const allAlreadyFulfilled = s.items.every(it => it.fulfilled === true);
        const rows = s.items
          .map((it, idx) => {
            const product = getProductInfo(it.productId);
            const variation = getVariationInfo(it.productId, it.variationId);
            const unit = it.saleType === SaleType.WHOLESALE ? 'grade(s)' : 'par(es)';
            const key = it.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (it.size || 'WHOLESALE');
            const current = (variation?.stock[key] || 0);
            
            // Se já está fulfilled (separado), não precisa abater novamente
            const willDeduct = it.fulfilled !== true && current >= it.quantity;
            const alreadySeparated = it.fulfilled === true || (it.boxesSeparated || 0) >= it.quantity;
            
            return { idx, product, variation, it, unit, current, after: willDeduct ? current - it.quantity : current, willDeduct, alreadySeparated };
          });
        
        const toDeduct = rows.filter(r => r.willDeduct);
        const canConfirm = allAlreadyFulfilled || toDeduct.length > 0;

        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setExpediteSale(null)}>
            <div onClick={e => e.stopPropagation()} className={`w-full max-w-md max-h-[85vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
              <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Expedir Pedido</p>
                  <p className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>#{s.orderNumber} — baixa no estoque</p>
                </div>
                <button onClick={() => setExpediteSale(null)} title="Fechar" aria-label="Fechar" className={`p-2 rounded-xl ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}><X size={20} strokeWidth={2.5} /></button>
              </div>
              <div className="overflow-y-auto max-h-[55vh] p-4 flex flex-col gap-2 custom-scrollbar">
                {rows.map(r => (
                  <div key={r.idx} className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${r.alreadySeparated ? (isDarkMode ? 'bg-emerald-900/15 border-emerald-800/40' : 'bg-emerald-50 border-emerald-100') : r.willDeduct ? (isDarkMode ? 'bg-indigo-900/15 border-indigo-800/40' : 'bg-indigo-50 border-indigo-100') : (isDarkMode ? 'bg-amber-900/15 border-amber-800/40' : 'bg-amber-50 border-amber-100')}`}>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{r.product?.reference} {r.product?.name}</p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{r.variation?.colorName}{r.it.size ? ` · Nº ${r.it.size}` : ''} · {r.it.quantity} {r.unit}</p>
                    </div>
                    {r.alreadySeparated ? (
                      <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">Separado</span>
                    ) : r.willDeduct ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-black text-slate-400">{r.current}</span>
                        <span className="text-slate-300 dark:text-slate-600">→</span>
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{r.after}</span>
                      </div>
                    ) : (
                      <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">Sem estoque ({r.current})</span>
                    )}
                  </div>
                ))}
              </div>
              <div className={`p-5 border-t flex gap-3 ${isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50'}`}>
                <button type="button" onClick={() => setExpediteSale(null)} disabled={processingExpedite} className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-slate-100'}`}>Cancelar</button>
                <button
                  type="button"
                  disabled={processingExpedite || !canConfirm}
                  onClick={async () => { setProcessingExpedite(true); try { await onExpediteSale(s.id); setExpediteSale(null); } finally { setProcessingExpedite(false); } }}
                  className={`flex-[1.5] py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${!canConfirm ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'}`}
                >
                  <Truck size={16} strokeWidth={3} /> {processingExpedite ? 'Expedindo...' : allAlreadyFulfilled ? 'Confirmar Expedição' : `Confirmar (${toDeduct.length})`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Popup — Reverter Expedição (devolve ao estoque) */}
      {revertSale && (() => {
        const s = revertSale;
        const rows = s.items
          .filter(it => it.fulfilled === true || (it.boxesSeparated || 0) > 0)
          .map((it, idx) => {
            const product = getProductInfo(it.productId);
            const variation = getVariationInfo(it.productId, it.variationId);
            const unit = it.saleType === SaleType.WHOLESALE ? 'grade(s)' : 'par(es)';
            const key = it.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (it.size || 'WHOLESALE');
            const current = (variation?.stock[key] || 0);
            const qtyToRestore = (it.boxesSeparated || 0) > 0 ? it.boxesSeparated! : it.quantity;
            return { idx, product, variation, it, unit, current, after: current + qtyToRestore, qtyToRestore };
          });
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setRevertSale(null)}>
            <div onClick={e => e.stopPropagation()} className={`w-full max-w-md max-h-[85vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
              <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Reverter Expedição</p>
                  <p className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>#{s.orderNumber} — devolver ao estoque</p>
                </div>
                <button onClick={() => setRevertSale(null)} title="Fechar" aria-label="Fechar" className={`p-2 rounded-xl ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}><X size={20} strokeWidth={2.5} /></button>
              </div>
              <div className="overflow-y-auto max-h-[55vh] p-4 flex flex-col gap-2 custom-scrollbar">
                {rows.length === 0 && (
                  <div className={`p-3 rounded-2xl border flex items-start gap-2.5 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-snug">
                      Nenhum item deste pedido está marcado como abatido do estoque — não há nada pra devolver. A reversão vai apenas remover a marcação de "Pedido Entregue".
                    </p>
                  </div>
                )}
                {rows.map(r => (
                  <div key={r.idx} className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${isDarkMode ? 'bg-amber-900/15 border-amber-800/40' : 'bg-amber-50 border-amber-100'}`}>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{r.product?.reference} {r.product?.name}</p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{r.variation?.colorName}{r.it.size ? ` · Nº ${r.it.size}` : ''} · {r.qtyToRestore} {r.unit} (devolvidos)</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-black text-slate-400">{r.current}</span>
                      <span className="text-slate-300 dark:text-slate-600">→</span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{r.after}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className={`p-5 border-t flex gap-3 ${isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50'}`}>
                <button type="button" onClick={() => setRevertSale(null)} disabled={processingExpedite} className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-slate-100'}`}>Cancelar</button>
                <button
                  type="button"
                  disabled={processingExpedite || (rows.length === 0 && s.deliveryStatus !== 'DELIVERED')}
                  onClick={async () => { setProcessingExpedite(true); try { await onRevertExpedition(s.id); setRevertSale(null); } finally { setProcessingExpedite(false); } }}
                  className="flex-[1.5] py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                >
                  <RotateCcw size={16} strokeWidth={3} /> {processingExpedite ? 'Revertendo...' : 'Confirmar Reversão'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Popup — Pagamentos / Recebimentos do pedido (ícone $) */}
      {paymentModalSale && (
        <SalePaymentModal
          isOpen={!!paymentModalSale}
          onClose={() => setPaymentModalSale(null)}
          sale={paymentModalSale}
          accounts={accounts}
          paymentMethods={paymentMethods}
          customer={people.find(p => p.id === paymentModalSale.customerId)}
          initialMode={paymentModalMode}
          isDarkMode={isDarkMode}
          onPay={(amount, accountId, paymentMethodId, note) => onPaySale(paymentModalSale.id, amount, accountId, paymentMethodId, note)}
          onUpdatePayment={(paymentId, amount, accountId, paymentMethodId, note) => onUpdatePayment(paymentModalSale.id, paymentId, amount, accountId, paymentMethodId, note)}
          onDeletePayment={(paymentId) => onDeletePayment(paymentModalSale.id, paymentId)}
        />
      )}

      {/* Modal — Transferir Pedido Cancelado para Estoque */}
      {transferSale && (() => {
        const lots = reservedLotsBySale.get(transferSale.id) || [];
        const totalBoxes = lots.reduce((s, l) => s + (l.boxQty ?? 1), 0);
        const totalPairs = lots.reduce((s, l) => s + l.totalPairs, 0);
        return (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => !processingTransfer && setTransferSale(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-md max-h-[85vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
            >
              {/* Header */}
              <div className={`flex items-center gap-3 px-6 py-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
                  <Boxes size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cancelar Pedido</p>
                  <p className={`text-base font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Transferir para Estoque
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 custom-scrollbar">
                <p className={`text-[11px] font-bold leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  O pedido <span className="font-black text-violet-500">#{transferSale.orderNumber}</span> de{' '}
                  <span className="font-black">{transferSale.customerName}</span> será cancelado e os produtos produzidos
                  serão transferidos para o <span className="font-black">estoque geral</span>.
                </p>

                {/* Lots summary */}
                <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-violet-900/15 border-violet-800/40' : 'bg-violet-50 border-violet-100'}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-violet-500 mb-2">
                    {lots.length} lote(s) · {totalBoxes} cx · {totalPairs} pares
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {lots.map(lot => (
                      <div key={lot.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-[11px] font-black uppercase truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                            {lot.productReference ? `${lot.productReference} · ` : ''}{lot.productName}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400">{lot.variationName} · {lot.gradeLabel}</p>
                        </div>
                        <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 shrink-0">
                          {lot.boxQty ?? 1} cx
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  As transações financeiras deste pedido não serão estornadas. Use "Cancelar e Estornar" para reverter também o financeiro.
                </p>
              </div>

              {/* Footer */}
              <div className={`p-5 border-t shrink-0 flex gap-3 ${isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50'}`}>
                <button
                  type="button"
                  onClick={() => setTransferSale(null)}
                  disabled={processingTransfer}
                  className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-slate-100'}`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={processingTransfer}
                  onClick={async () => {
                    setProcessingTransfer(true);
                    try {
                      await onTransferToStock(transferSale.id);
                      setTransferSale(null);
                    } finally {
                      setProcessingTransfer(false);
                    }
                  }}
                  className="flex-[1.5] py-4 rounded-2xl bg-violet-600 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 active:scale-95 transition-all"
                >
                  <Boxes size={16} strokeWidth={2.5} />
                  {processingTransfer ? 'Transferindo...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal — Separação de Caixas */}
      {separacaoSale && (
        <SeparacaoCaixasModal
          sale={separacaoSale}
          products={products}
          stockLots={stockLots}
          isDarkMode={isDarkMode}
          onConfirm={(separations) => onSepararCaixas(separacaoSale.id, separations)}
          onClose={() => setSeparacaoSale(null)}
        />
      )}

      {productionOrderSale && (
        <ProductionOrderModal
          isOpen={!!productionOrderSale}
          onClose={() => setProductionOrderSale(null)}
          sale={productionOrderSale}
          products={products}
          grids={grids}
          sectors={sectors}
          lots={lots}
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

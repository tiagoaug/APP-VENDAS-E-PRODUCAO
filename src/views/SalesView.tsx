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
  const [showBalanceButton, setShowBalanceButton] = usePersistedToggle('salesView_showBalanceButton', true);
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
  // Balanço de estoque a partir da demanda dos orçamentos
  const [showStockBalance, setShowStockBalance] = useState(false);
  const [balanceAdjust, setBalanceAdjust] = useState<Record<string, number>>({});
  const [showBalanceConfirm, setShowBalanceConfirm] = useState(false);
  const [savingBalance, setSavingBalance] = useState(false);

  // Demanda agregada dos ORÇAMENTOS (QUOTE), por produto + variação + chave de estoque
  // (atacado = 'WHOLESALE'/caixas; varejo = tamanho). Soma as quantidades pedidas.
  const stockDemand = useMemo(() => {
    const map = new Map<string, {
      key: string; productId: string; variationId: string; stockKey: string;
      productName: string; reference: string; colorName: string;
      isWholesale: boolean; demand: number; current: number;
    }>();
    sales.forEach((sale) => {
      if (sale.status !== SaleStatus.QUOTE) return;
      sale.items.forEach((item) => {
        if (!item.quantity || item.quantity <= 0) return;
        const product = products.find((p) => p.id === item.productId);
        if (!product) return;
        const variation = product.variations.find((v) => v.id === item.variationId);
        const isWholesale = item.saleType === SaleType.WHOLESALE;
        const stockKey = isWholesale ? 'WHOLESALE' : (item.size || '');
        if (!stockKey) return;
        const mapKey = `${item.productId}::${item.variationId}::${stockKey}`;
        const existing = map.get(mapKey);
        if (existing) {
          existing.demand += item.quantity;
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
            demand: item.quantity,
            current: variation?.stock?.[stockKey] || 0,
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) =>
      (a.reference || a.productName).localeCompare(b.reference || b.productName) ||
      a.colorName.localeCompare(b.colorName) ||
      a.stockKey.localeCompare(b.stockKey)
    );
  }, [sales, products]);

  // Ao abrir o modal, semeia os ajustes com a quantidade demandada de cada item.
  useEffect(() => {
    if (showStockBalance) {
      const init: Record<string, number> = {};
      stockDemand.forEach((d) => { init[d.key] = d.demand; });
      setBalanceAdjust(init);
      setShowBalanceConfirm(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStockBalance]);

  const balancePreview = useMemo(
    () => stockDemand
      .map((d) => ({ ...d, amount: Math.max(0, Math.floor(balanceAdjust[d.key] ?? 0)) }))
      .filter((d) => d.amount > 0),
    [stockDemand, balanceAdjust]
  );

  const handleConfirmBalance = async () => {
    if (balancePreview.length === 0) { setShowBalanceConfirm(false); return; }
    setSavingBalance(true);
    try {
      await onAddStockBalance(
        balancePreview.map((d) => ({ productId: d.productId, variationId: d.variationId, key: d.stockKey, amount: d.amount }))
      );
      setShowBalanceConfirm(false);
      setShowStockBalance(false);
    } finally {
      setSavingBalance(false);
    }
  };
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
    // Venda com produção atrelada = grade avulsa feita sob medida para o cliente.
    // Só conta como "pronto" se já houver lote reservado (saleId) com a grade exata —
    // nunca pelo estoque agregado, que pode não ter essa composição específica.
    const saleLots = sale.productionOrderId
      ? stockLots.filter(l => l.saleId === sale.id && l.status === 'RESERVADO')
      : [];
    let ready = 0;
    unfulfilled.forEach(item => {
      if (sale.productionOrderId) {
        const availableFromLots = saleLots
          .filter(l => l.productId === item.productId && l.variationId === item.variationId)
          .reduce((s, l) => s + (l.boxQty || 1), 0);
        if (availableFromLots >= item.quantity) ready++;
        return;
      }
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
        <div className={`flex w-full rounded-2xl overflow-hidden border divide-x ${isDarkMode ? 'bg-slate-900 border-slate-800 divide-slate-800' : 'bg-white border-slate-100 shadow-sm divide-slate-100'}`}>
          {showBalanceButton && (
            <button
              onClick={() => setShowStockBalance(true)}
              className={`flex-1 h-12 px-3 flex items-center justify-center gap-2 transition-all duration-300 ${isDarkMode ? 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800/50' : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-50'}`}
              title="Repor estoque com a demanda dos orçamentos"
            >
              <PackagePlus size={18} strokeWidth={2.5} className="text-emerald-500" />
              <span className="text-[10px] font-black tracking-[0.15em]">Balanço</span>
            </button>
          )}
          <button
            onClick={onNavigateStock}
            className={`flex-1 h-12 px-3 flex items-center justify-center gap-2 transition-all duration-300 ${isDarkMode ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-800/50' : 'text-slate-400 hover:text-amber-600 hover:bg-slate-50'}`}
            title="Estoque de Produtos"
          >
            <Boxes size={18} strokeWidth={2.5} className="text-amber-500" />
            <span className="text-[10px] font-black tracking-[0.15em]">Estoque</span>
          </button>
          <button
            onClick={() => setShowFilters(true)}
            className={`flex-1 h-12 px-3 flex items-center justify-center gap-2 transition-all duration-300 relative ${showFilters ? 'bg-indigo-600 text-white' : isDarkMode ? 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50' : 'text-slate-400 hover:text-indigo-500 hover:bg-slate-50'}`}
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
              <button onClick={() => setShowBalanceButton(v => !v)}
                className={`w-full py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all flex items-center justify-center gap-2 ${showBalanceButton ? 'bg-emerald-600 text-white border-transparent shadow-sm' : isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                <PackagePlus size={14} strokeWidth={2.5} />
                {showBalanceButton ? 'Botão Balanço Visível' : 'Botão Balanço Oculto'}
              </button>
            </div>

            <button
              onClick={() => { setFilter('ALL'); setPaymentFilter('ALL'); setSelectedStatuses([SaleStatus.SALE, SaleStatus.CONFIRMED, SaleStatus.QUOTE]); setExpandedCards(false); setShowProducts(true); setShowGradeBreakdown(false); setShowBalanceButton(true); }}
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
                    const stockStatus = getUnfulfilledStockStatus(sale);
                    const hasReservedLots = (reservedLotsBySale.get(sale.id) || []).length > 0;
                    const canSeparate = hasReservedLots || (stockStatus && stockStatus.ready > 0);
                    if (!canSeparate) return null;

                    // Progresso de separação: soma boxesSeparated / soma quantity
                    const totalOrdered = sale.items.reduce((s, it) => s + it.quantity, 0);
                    const totalSeparated = sale.items.reduce((s, it) => s + (it.boxesSeparated || 0), 0);
                    const allSeparated = totalSeparated >= totalOrdered;

                    const unit = sale.items.some(it => it.saleType === SaleType.WHOLESALE) ? 'cx' : 'pares';

                    return (
                      <div className={`flex flex-col gap-2 px-4 py-2.5 rounded-2xl ${isDarkMode ? 'bg-indigo-900/20 border border-indigo-800/40' : 'bg-indigo-50 border border-indigo-100'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Boxes size={14} className="text-indigo-500 shrink-0" />
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest truncate">
                              {allSeparated ? 'Todos os itens separados' : 'Separação de caixas pendente'}
                            </span>
                          </div>
                          {totalSeparated > 0 && (
                            <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shrink-0 ${allSeparated ? 'bg-emerald-500 text-white' : 'bg-indigo-500 text-white'}`}>
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
                                {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'} · Aguardando separação
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
                <div className="flex justify-between items-center w-full">
                  <div className="flex items-center gap-2">
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

                  {/* Actions Group (Floating Island) - MATCHING IMAGE */}
                  <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                    {/* View Order Button */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setItemsPopupSale(sale); }}
                      className="w-10 h-10 flex items-center justify-center bg-sky-50 dark:bg-sky-500/10 text-sky-500 rounded-full active:scale-90 transition-all"
                      title="Visualizar pedido"
                    >
                      <Eye size={18} />
                    </button>

                    {/* Simple Preview Button (substituiu PDF) */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSimplePreviewSale(sale); }}
                      className="w-10 h-10 flex items-center justify-center bg-amber-50 dark:bg-amber-500/10 text-amber-500 rounded-full active:scale-90 transition-all"
                      title="Visualizar resumo do pedido"
                    >
                      <FileText size={18} />
                    </button>

                    {/* JPG/PDF Export Button */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenExport(e, sale, 'jpg')}
                      className="w-10 h-10 flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-full font-black text-[10px] tracking-tighter active:scale-90 transition-all"
                      title="Exportar (JPG/PDF)"
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
                              {sale.status === SaleStatus.SALE && sale.items.some(it => it.fulfilled === true) && (
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

      {/* Modal — Balanço de Estoque (demanda dos orçamentos) */}
      {showStockBalance && (
        <div className="fixed inset-0 z-[300000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-lg max-h-[90vh] flex flex-col rounded-[2.5rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            {/* Header */}
            <div className="p-6 flex items-start justify-between shrink-0 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  <PackagePlus size={22} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className={`text-lg font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Balanço de Estoque</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Demanda agrupada dos orçamentos</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStockBalance(false)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
                aria-label="Fechar"
                title="Fechar"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            {/* Lista rolável */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {stockDemand.length === 0 && (
                <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-10">Nenhum item em orçamentos.</p>
              )}
              {stockDemand.map((d) => {
                const amount = balanceAdjust[d.key] ?? d.demand;
                const unit = d.isWholesale ? 'cx' : 'pares';
                return (
                  <div key={d.key} className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className={`text-[12px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          {d.reference ? `${d.reference} · ` : ''}{d.productName}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                          {d.colorName || 'Sem cor'}{d.isWholesale ? '' : ` · Tam ${d.stockKey}`} · Estoque atual: {d.current} {unit}
                        </p>
                      </div>
                      <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                        Orçamento: {d.demand} {unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Somar</span>
                      <div className="flex items-center flex-1 justify-end bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => setBalanceAdjust((prev) => ({ ...prev, [d.key]: Math.max(0, (prev[d.key] ?? d.demand) - 1) }))}
                          className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 active:scale-90 transition-all"
                          aria-label="Diminuir" title="Diminuir"
                        >
                          <Minus size={14} strokeWidth={3} />
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={amount === 0 ? '' : amount}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setBalanceAdjust((prev) => ({ ...prev, [d.key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                          className="w-14 text-center border-none p-0 text-sm font-black text-slate-800 dark:text-white focus:ring-0 bg-transparent"
                          aria-label="Quantidade a somar" title="Quantidade a somar"
                        />
                        <button
                          type="button"
                          onClick={() => setBalanceAdjust((prev) => ({ ...prev, [d.key]: (prev[d.key] ?? d.demand) + 1 }))}
                          className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center active:scale-90 transition-all"
                          aria-label="Aumentar" title="Aumentar"
                        >
                          <Plus size={14} strokeWidth={3} />
                        </button>
                      </div>
                      <span className="text-[9px] font-black uppercase text-slate-400 w-8 text-center shrink-0">{unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className={`p-5 shrink-0 border-t border-slate-100 dark:border-slate-800 ${isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50/50'}`}>
              <button
                type="button"
                disabled={balancePreview.length === 0}
                onClick={() => setShowBalanceConfirm(true)}
                className={`w-full py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  balancePreview.length === 0 ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                }`}
              >
                <PackagePlus size={18} /> Somar ao Estoque ({balancePreview.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup de confirmação — estoque atual → após adição */}
      {showBalanceConfirm && (
        <div className="fixed inset-0 z-[300001] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md max-h-[85vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="p-5 shrink-0 border-b border-slate-100 dark:border-slate-800 text-center">
              <h3 className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Confirmar Adição ao Estoque</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Estoque atual → após a adição</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {balancePreview.map((d) => {
                const unit = d.isWholesale ? 'cx' : 'pares';
                return (
                  <div key={d.key} className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {d.reference ? `${d.reference} · ` : ''}{d.colorName || d.productName}{d.isWholesale ? '' : ` · Tam ${d.stockKey}`}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 mt-0.5">+ {d.amount} {unit}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-black text-slate-400">{d.current}</span>
                      <span className="text-slate-300 dark:text-slate-600">→</span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{d.current + d.amount}</span>
                      <span className="text-[9px] font-black uppercase text-slate-400">{unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={`p-5 shrink-0 border-t border-slate-100 dark:border-slate-800 flex gap-3 ${isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50/50'}`}>
              <button
                type="button"
                onClick={() => setShowBalanceConfirm(false)}
                disabled={savingBalance}
                className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-slate-100'}`}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmBalance}
                disabled={savingBalance}
                className="flex-[1.5] py-4 rounded-2xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Check size={16} strokeWidth={3} /> {savingBalance ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                        <p className={`text-[12px] font-black uppercase leading-tight truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          {product?.reference && <span className="text-slate-400">{product.reference} · </span>}{product?.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-900 dark:bg-slate-700 text-white text-[9px] font-black uppercase tracking-widest">
                            {variation?.colorName}
                          </span>
                          {item.size && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Nº {item.size}</span>
                          )}
                        </div>
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
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
                  <span className={`text-[17px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    R$ {s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
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
                          <p className={`text-[12px] font-black uppercase tracking-tight leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                            {row.product?.reference && `${row.product.reference} · `}{row.product?.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-900 dark:bg-slate-700 text-white text-[9px] font-black uppercase tracking-widest">
                              {row.variation?.colorName}
                            </span>
                            {row.item.size && (
                              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Nº {row.item.size}</span>
                            )}
                          </div>
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
                      <p className={`text-[11px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>
                        {row.product?.reference && `${row.product.reference} · `}{row.product?.name}
                      </p>
                      <p className="text-[9px] font-bold text-emerald-500 mt-0.5 uppercase tracking-widest">
                        {row.variation?.colorName}{row.item.size ? ` · Nº ${row.item.size}` : ''}
                      </p>
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
                  <div className="py-6 text-center">
                    <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Todos os itens já separados</p>
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
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setItemsPopupSale(null)}
                    disabled={processingPopupSep}
                    className={`flex-1 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-slate-100'}`}
                  >
                    Fechar
                  </button>
                  {pendingRows.length > 0 && !isDelivered && (
                    <button
                      type="button"
                      disabled={processingPopupSep || toApply.length === 0}
                      onClick={handleConfirmSep}
                      className={`flex-[1.5] py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        toApply.length === 0
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                      }`}
                    >
                      <Boxes size={16} strokeWidth={2.5} />
                      {processingPopupSep ? 'Separando...' : `Separar (${totalToSeparate} ${totalToSeparate === 1 ? 'cx' : 'cx'})`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Popup — Expedição (pré-visualiza as baixas no estoque) */}
      {expediteSale && (() => {
        const s = expediteSale;
        const rows = s.items
          .filter(it => it.fulfilled !== true)
          .map((it, idx) => {
            const product = getProductInfo(it.productId);
            const variation = getVariationInfo(it.productId, it.variationId);
            const unit = it.saleType === SaleType.WHOLESALE ? 'grade(s)' : 'par(es)';
            const key = it.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (it.size || 'WHOLESALE');
            const current = (variation?.stock[key] || 0);
            const willDeduct = current >= it.quantity;
            return { idx, product, variation, it, unit, current, after: willDeduct ? current - it.quantity : current, willDeduct };
          });
        const toDeduct = rows.filter(r => r.willDeduct);
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
                  <div key={r.idx} className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${r.willDeduct ? (isDarkMode ? 'bg-emerald-900/15 border-emerald-800/40' : 'bg-emerald-50 border-emerald-100') : (isDarkMode ? 'bg-amber-900/15 border-amber-800/40' : 'bg-amber-50 border-amber-100')}`}>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{r.product?.reference} {r.product?.name}</p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{r.variation?.colorName}{r.it.size ? ` · Nº ${r.it.size}` : ''} · {r.it.quantity} {r.unit}</p>
                    </div>
                    {r.willDeduct ? (
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
                  disabled={processingExpedite || toDeduct.length === 0}
                  onClick={async () => { setProcessingExpedite(true); try { await onExpediteSale(s.id); setExpediteSale(null); } finally { setProcessingExpedite(false); } }}
                  className={`flex-[1.5] py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${toDeduct.length === 0 ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'}`}
                >
                  <Truck size={16} strokeWidth={3} /> {processingExpedite ? 'Expedindo...' : `Confirmar (${toDeduct.length})`}
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
          .filter(it => it.fulfilled === true)
          .map((it, idx) => {
            const product = getProductInfo(it.productId);
            const variation = getVariationInfo(it.productId, it.variationId);
            const unit = it.saleType === SaleType.WHOLESALE ? 'grade(s)' : 'par(es)';
            const key = it.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (it.size || 'WHOLESALE');
            const current = (variation?.stock[key] || 0);
            return { idx, product, variation, it, unit, current, after: current + it.quantity };
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
                {rows.map(r => (
                  <div key={r.idx} className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${isDarkMode ? 'bg-amber-900/15 border-amber-800/40' : 'bg-amber-50 border-amber-100'}`}>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{r.product?.reference} {r.product?.name}</p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{r.variation?.colorName}{r.it.size ? ` · Nº ${r.it.size}` : ''} · {r.it.quantity} {r.unit}</p>
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
                  disabled={processingExpedite || rows.length === 0}
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

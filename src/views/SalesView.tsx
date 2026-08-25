import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Share as CapacitorShare } from '@capacitor/share';
import { Sale, SaleType, PaymentStatus, Product, Grid, SaleStatus, Person, PaymentMethod, Account, PaymentTerm, ProductionOrder, ProductionLot, Sector, AppModulesConfig, StockLot, StockLotRevertPreview, ProductionConfigItem, Carrier, CompanyProfile, Variation, BatchLabelItem, LabelFile, OrderTextAlias } from '../types';
import LabelProfilePickerModal from '../components/LabelProfilePickerModal';
import { ShoppingBag, TrendingUp, User, Calendar, Tag, Filter, Plus, Minus, Hash, Clock, CheckCircle2, AlertCircle, MoreVertical, Edit2, Trash2, X, Info, Box, Ban, RotateCcw, Search, MessageSquare, Copy, Share, Share2, DollarSign, History, FileText, Lightbulb, Eye, EyeOff, Maximize2, Minimize2, Check, ChevronDown, ChevronUp, Factory, Truck, PackageCheck, Boxes, PackagePlus, Package, Wrench, ChevronRight, MapPin, ListChecks, Pencil, ArrowLeft, Printer, ClipboardPaste, Image as ImageIcon2 } from 'lucide-react';
import PasteOrderModal from '../components/PasteOrderModal';
import { DraftSaleBlockInput } from '../utils/orderTextParser';
import ConfigMenuItem from '../components/ConfigMenuItem';
import ProductionOrderModal from '../components/ProductionOrderModal';
import SeparacaoCaixasModal from '../components/SeparacaoCaixasModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { exportSale } from '../utils/saleExport';
import { usePrivacyMode, PRIVACY_BLUR_CLASS } from '../contexts/PrivacyContext';
import { exportStockShortageReport, StockShortageItem } from '../utils/stockShortageExport';
import ExportNoteModal from '../components/ExportNoteModal';
import PedidosClientesPanel from '../components/PedidosClientesPanel';
import StockLotsPanel from '../components/StockLotsPanel';
import StockEntryHistoryModal from '../components/StockEntryHistoryModal';
import StockDiagnosticsModal from '../components/StockDiagnosticsModal';
import SalePaymentModal from '../components/SalePaymentModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { toast } from '../utils/toast';
import { saleProductionHasProgressed, getLotPendingSectorGroups } from '../utils/productionRoute';
import { firebaseService } from '../services/firebaseService';
import { getWholesaleBoxes, getRetailPairs } from '../utils/stockPools';
import { summarizeStockRepairIssues } from '../utils/stockRepair';
import { buildSeparationRows, getEffectiveSeparated } from '../utils/separationRows';
import { buildSeparationReconcileGroups, SeparationReconcileGroup } from '../utils/separationReconcile';
import { useStockLotDuplicates } from '../hooks/useStockLotDuplicates';
import { StockDuplicateFixPlan } from '../utils/stockDuplicateFix';
import { buildOrphanedFinalizedKeyFixes } from '../utils/finalizedKeyRepair';
import { UndercreditGroup } from '../utils/stockUndercreditFix';
import { buildOrphanedReservedLots, readResolvedOrphanedLotKeys, OrphanedReservedLot } from '../utils/stockOrphanedReservations';
import StockRepairBanner from '../components/StockRepairBanner';
import DeliveryAddressForm from '../components/DeliveryAddressForm';
import DeliveryItemsPicker, { deliveryItemKey } from '../components/DeliveryItemsPicker';
import { formatDeliveryItemsList } from '../utils/deliveryItemsFormat';
import Modal from '../components/Modal';

// Mudança de item no popup "Alterar Produtos" (Pedido & Separação) — ver
// onAlterarProdutosVenda. `remove` referencia a posição no array `sale.items` (mesmo
// `itemIdx` já usado por onSepararCaixas/onPartialRevertSeparacao); `add` carrega os
// dados completos de um item novo, ainda não separado.
export type SaleItemChange =
  | { type: 'remove'; itemIdx: number; quantity: number }
  | { type: 'add'; productId: string; variationId: string; saleType: SaleType; size?: string; quantity: number; price: number; unitPrice?: number };

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
  orderTextAliases: OrderTextAlias[];
  paymentMethods: PaymentMethod[];
  accounts: Account[];
  productionOrders: ProductionOrder[];
  lots: ProductionLot[];
  sectors: Sector[];
  onAdd: () => void;
  // "Colar Pedido Digitado" — texto livre já revisado/confirmado no PasteOrderModal, pronto
  // pra virar SaleBlock[] pré-preenchido no SaleFormView (ver App.tsx, navigateTo com params).
  onOpenPastedOrder: (draft: { draftBlocks: DraftSaleBlockInput[]; draftCustomerId?: string }) => void;
  // "Exportar para Vendas" do Extrator de Texto (OCR, tela em Configurações > Extras) — chega
  // via navigateTo(ViewType.SALES, { prefillPasteText }), abre o PasteOrderModal direto com
  // esse texto pronto pra revisar (ver App.tsx).
  initialPasteText?: string;
  onEdit: (sale: Sale) => void;
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
  onPartialRevertSeparacao: (saleId: string, reverts: { itemIdx: number; quantity: number }[]) => Promise<void>;
  // "Alterar Produtos" (popup Pedido & Separação) — remover devolve o que já estava
  // separado pro estoque antes de encolher/apagar a linha; adicionar entra como item
  // comum "não separado", pro próprio usuário separar depois pelo stepper de sempre.
  onAlterarProdutosVenda: (saleId: string, changes: SaleItemChange[]) => Promise<void>;
  onNavigateStock: () => void;
  onNavigateStockGlance: () => void;
  onNavigatePCP: () => void;
  onNavigateStockReconcile: () => void;
  onNavigateStockDiagnostic: () => void;
  onNavigateStockBalance: () => void;
  onNavigateStockOrphaned?: () => void;
  onPreviewRevertStockLot?: (stockLot: StockLot) => StockLotRevertPreview;
  onRevertStockLot?: (stockLot: StockLot) => Promise<StockLotRevertPreview>;
  onFixPkgAllocations?: () => Promise<{ fixed: number; total: number }>;
  onReconcileSeparationGroup?: (group: SeparationReconcileGroup) => Promise<void>;
  onApplyStockDuplicateFix?: (plan: StockDuplicateFixPlan) => Promise<void>;
  onRepairOrphanedFinalizedKeys?: () => Promise<{ fixed: number; lotsTouched: number }>;
  onApplyUndercreditFix?: (group: UndercreditGroup) => Promise<void>;
  onReleaseOrphanedLot?: (entry: OrphanedReservedLot) => Promise<void>;
  onNavigateProducts?: () => void;
  onAddProduct?: () => void;
  // Abre o editor de etiquetas livre (locks/camadas/campos vinculados) — padrão de impressão de
  // etiqueta de Vendas, ver "Etiquetas" no popup de impressão da venda e handleOpenSaleLabels
  // abaixo. Vai direto pro LABEL_EDITOR (não passa pela tela genérica LabelPrintStudioView) —
  // LabelProfilePickerModal já filtra/escolhe o perfil aqui dentro de SalesView antes de chamar isso.
  onOpenLabelEditor?: (params: { widthMm: number; heightMm: number; paperSizeId?: string; existingFile?: LabelFile; batchContext: { items: BatchLabelItem[] } }) => void;
  // Modelos de etiqueta salvos (Print Studio Ablemark) — usado pro seletor de perfis do fluxo acima.
  labelFiles?: LabelFile[];
  productionConfigs: ProductionConfigItem[];
  appTheme?: 'light' | 'dark' | 'industrial' | 'ocean' | 'forest' | 'sunset' | 'midnight' | 'graphite' | 'hcWhite' | 'hcBlack' | 'hcIndustrial';
  onUpdateDeliveryInfo?: (saleId: string, data: { deliveryAddress?: Sale['deliveryAddress']; additionalDeliveryAddresses?: Sale['additionalDeliveryAddresses']; deliveryPriority?: Sale['deliveryPriority']; carrierId?: string | null; deliveryItems?: Sale['deliveryItems']; deliveryItemsNote?: Sale['deliveryItemsNote'] }) => Promise<void>;
  carriers?: Carrier[];
  onSendToRouteBuilder?: (saleId: string) => void;
  /** Preferência global "Miniaturas dos Modelos" (Acessibilidade) — desligada, esconde foto em
   * TODO canto que mostraria uma (Resumo do Pedido, Exportar Venda em JPG etc), não só listas
   * de produto. */
  showThumbnails?: boolean;
  /** Identidade da empresa (Mais > Personalizar Empresa) — vai junto do PDF/JPG exportado em
   * "Exportar Venda" quando configurada com cabeçalho/rodapé (ver exportSale/saleExport.ts). */
  companyProfile?: CompanyProfile | null;
}

export default function SalesView({
  sales,
  products,
  grids,
  people,
  orderTextAliases,
  paymentMethods,
  accounts,
  productionOrders,
  lots,
  sectors,
  onAdd,
  onOpenPastedOrder,
  initialPasteText,
  onEdit,
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
  onPartialRevertSeparacao,
  onAlterarProdutosVenda,
  onNavigateStock,
  onNavigateStockGlance,
  onNavigatePCP,
  onNavigateStockReconcile,
  onNavigateStockDiagnostic,
  onNavigateStockBalance,
  onNavigateStockOrphaned,
  onPreviewRevertStockLot,
  onRevertStockLot,
  onFixPkgAllocations,
  onReconcileSeparationGroup,
  onApplyStockDuplicateFix,
  onRepairOrphanedFinalizedKeys,
  onApplyUndercreditFix,
  onReleaseOrphanedLot,
  onNavigateProducts,
  onAddProduct,
  onOpenLabelEditor,
  labelFiles = [],
  productionConfigs,
  appTheme = 'light',
  onUpdateDeliveryInfo,
  carriers = [],
  onSendToRouteBuilder,
  showThumbnails = true,
  companyProfile = null,
}: SalesViewProps) {
  const hidePrivacy = usePrivacyMode();
  const isIndustrial = appTheme === 'industrial';
  const hasProduction = modulesConfig.production;
  const [filter, setFilter] = usePersistedState<'ALL' | 'RETAIL' | 'WHOLESALE'>('salesView_filter', 'ALL');
  const [paymentFilter, setPaymentFilter] = usePersistedState<'ALL' | 'PENDING' | 'PAID'>('salesView_paymentFilter', 'ALL');
  const [deliveryFilter, setDeliveryFilter] = usePersistedState<'ALL' | 'PENDING' | 'DELIVERED'>('salesView_deliveryFilter', 'ALL');
  // Período — atalhos comuns + intervalo customizado (Data Inicial/Final, formato yyyy-mm-dd
  // do <input type="date">). CUSTOM usa periodStart/periodEnd; os outros ignoram os dois.
  const [periodPreset, setPeriodPreset] = usePersistedState<'ALL' | 'TODAY' | '7D' | '30D' | 'MONTH' | 'YEAR' | 'CUSTOM'>('salesView_periodPreset', 'ALL');
  const [periodStart, setPeriodStart] = usePersistedState<string>('salesView_periodStart', '');
  const [periodEnd, setPeriodEnd] = usePersistedState<string>('salesView_periodEnd', '');
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
  // Miniatura do produto no popup "Pedido & Separação" — opcional pois nem toda base tem
  // foto cadastrada, e alguém pode preferir a lista mais compacta sem imagens.
  const [showSeparationThumbnails, setShowSeparationThumbnails] = usePersistedToggle('salesView_showSeparationThumbnails', true);
  // Toque na miniatura amplia a foto em tela cheia; outro toque (em qualquer lugar) fecha.
  const [zoomedThumbnail, setZoomedThumbnail] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [paymentModalSale, setPaymentModalSale] = useState<Sale | null>(null);
  const [paymentModalMode, setPaymentModalMode] = useState<'PAYMENT' | 'HISTORY'>('PAYMENT');
  const [whatsappMode, setWhatsappMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [editingMessage, setEditingMessage] = useState<{ sale: Sale, text: string } | null>(null);
  const [noteModal, setNoteModal] = useState<{ isOpen: boolean, note: string } | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [exportModal, setExportModal] = useState<{isOpen: boolean, sale?: Sale, format: 'pdf' | 'jpg'}>({ isOpen: false, format: 'pdf' });
  // Popup de escolha ao tocar no ícone de impressora do card: "Exportar Venda" (abre o
  // ExportNoteModal de sempre) ou "Imprimir Venda" (sub-escolha entre Etiquetas e Impressão
  // Padrão) — `step` controla qual dos dois níveis do popup está visível.
  const [printChoice, setPrintChoice] = useState<{ sale: Sale; step: 'main' | 'print-sub' } | null>(null);
  // Popup de escolha do botão "+": "Cadastrar Pedido" (fluxo de sempre, chama onAdd) ou "Colar
  // Pedido Digitado" (abre o PasteOrderModal) — ver "Colar Pedido Digitado" (orderTextParser.ts).
  const [addChoiceOpen, setAddChoiceOpen] = useState(false);
  const [pasteOrderOpen, setPasteOrderOpen] = useState(false);
  // "Colar Print" (atalho do "+") abre o mesmo PasteOrderModal já disparando a leitura da
  // área de transferência, em vez de esperar o usuário tocar num botão lá dentro.
  const [pasteOrderAutoOcr, setPasteOrderAutoOcr] = useState(false);
  // "Exportar para Vendas" do Extrator de Texto (OCR) — ver initialPasteText acima.
  const [pasteOrderInitialText, setPasteOrderInitialText] = useState('');
  useEffect(() => {
    if (initialPasteText) {
      setPasteOrderInitialText(initialPasteText);
      setPasteOrderAutoOcr(false);
      setPasteOrderOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPasteText]);
  // Etiquetas da Venda — abre o Editor de Etiquetas livre (LabelEditorView), em modo lote
  // (batchItems): uma etiqueta por CAIXA no Atacado (item.quantity caixas => item.quantity
  // etiquetas iguais, grade de UMA caixa cada), uma etiqueta por linha (tamanho) no Varejo.
  // Tela 1 (LabelProfilePickerModal) abre com o lote já montado; a tela 2 (o editor de verdade)
  // só abre depois de escolher um perfil ou "Criar Novo Perfil" (ver
  // handlePickLabelProfile/handleCreateNewLabelProfile).
  const [labelProfilePicker, setLabelProfilePicker] = useState<{ open: boolean; items: BatchLabelItem[] }>({ open: false, items: [] });
  const [isQuickPrinting, setIsQuickPrinting] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  // Alvo do único popup de "Cancelar Pedido" — estorna estoque/financeiro e apaga o
  // registro num passo só (ver handleCancelSaleWithRevert em App.tsx). Substituiu os
  // antigos 3 passos manuais (Transferir para Estoque → Cancelar → Excluir).
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  // Detalhes de Entrega abrem num popup dedicado (por venda) em vez de expandir o card
  // inline — carrega Transportadora/Endereço/Itens junto, sem precisar caçar um botão de
  // "expandir" genérico no card.
  const [deliveryDetailsSaleId, setDeliveryDetailsSaleId] = useState<string | null>(null);
  // Sub-acordeões dentro do popup de Detalhes de Entrega — Transportadora e Endereço de
  // Entrega, cada um recolhido por padrão (o de Endereço embute um formulário + mapa).
  const [expandedCarrierCardIds, setExpandedCarrierCardIds] = useState<string[]>([]);
  const [expandedAddressCardIds, setExpandedAddressCardIds] = useState<string[]>([]);
  const [sentToDeliveryIds, setSentToDeliveryIds] = useState<string[]>([]);
  const [showManagementCard, setShowManagementCard] = usePersistedToggle('salesView_showManagementCard', false);
  // Dentro de "Gerenciamento": escolhe entre Cruzamento, Expedição, Lotes — sempre volta pro
  // seletor quando o card é reaberto, não fica "preso" na última escolha.
  const [managementView, setManagementView] = useState<'chooser' | 'cruzamento' | 'expedicao' | 'lotes'>('chooser');
  const [managementSearchTerm, setManagementSearchTerm] = useState('');
  // Histórico de Movimentações abre como modal aqui mesmo (sem navegar pra Estoque) — antes
  // navegava pra StockView e abria o modal via useEffect pós-mount, o que mostrava um frame
  // da tela de Estoque "pelada" antes do modal aparecer (parecia abrir a tela errada).
  const [showEntryHistoryModal, setShowEntryHistoryModal] = useState(false);
  // Diagnósticos e Correções abre como modal aqui mesmo (sem navegar pra Estoque) — mesmo
  // motivo do Histórico acima. Usado tanto pelo card em Gerenciamento quanto pelo aviso de
  // "Reparar Finalizados" que aparece no topo de Vendas quando há pendência.
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [isExportingShortage, setIsExportingShortage] = useState(false);

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

  // "Produtos em Falta" pro exportador de JPG do Cruzamento — só os itens com déficit
  // (estoque menor que a demanda das vendas visíveis), o que de fato precisa de ação.
  const handleExportStockShortage = async () => {
    const shortageItems: StockShortageItem[] = crossCheckData
      .filter(d => d.stock - d.demand < 0)
      .map(d => ({
        reference: d.reference,
        productName: d.productName,
        colorName: d.colorName || 'Sem cor',
        size: d.isWholesale ? undefined : d.stockKey,
        unit: d.isWholesale ? 'cx' : 'pr',
        missing: Math.abs(d.stock - d.demand),
      }));
    if (shortageItems.length === 0) {
      toast.show('Nenhum produto em falta no momento.');
      return;
    }
    setIsExportingShortage(true);
    try {
      await exportStockShortageReport(shortageItems, `Produtos_em_Falta_${format(new Date(), 'yyyy-MM-dd')}`);
    } finally {
      setIsExportingShortage(false);
    }
  };

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
  // addressIndex ausente = transportadora do endereço principal (Sale.carrierId); presente =
  // transportadora de um endereço adicional específico (AdditionalDeliveryAddress.carrierId).
  const [carrierPickerTarget, setCarrierPickerTarget] = useState<{ saleId: string; addressIndex?: number } | null>(null);
  const [carrierSearch, setCarrierSearch] = useState('');
  // Mesmo padrão do carrierPickerTarget acima — addressIndex ausente = checklist do
  // endereço principal (Sale.deliveryItems), presente = de um endereço adicional.
  const [itemsPickerTarget, setItemsPickerTarget] = useState<{ saleId: string; addressIndex?: number } | null>(null);
  const [simplePreviewSale, setSimplePreviewSale] = useState<Sale | null>(null);
  // Popup de configuração do "Exportar para Google Keep" — abre a partir do Resumo do Pedido,
  // deixa escolher quais campos entram na nota antes de mandar pro share sheet nativo.
  const [keepExportSale, setKeepExportSale] = useState<Sale | null>(null);
  const [keepFields, setKeepFields] = useState({
    reference: true,
    nameColor: true,
    boxQty: true,
    unitValue: true,
    totalValue: true,
  });
  // Quantidades de separação por índice de item dentro do popup de itens
  const [popupSepQtys, setPopupSepQtys] = useState<Record<number, number>>({});
  // Quantidades de reversão parcial (itens já separados que o usuário quer "des-separar")
  const [popupRevertQtys, setPopupRevertQtys] = useState<Record<number, number>>({});
  // null = normal | 'choose' = mostrando opções | 'partial' = modo parcial com steppers
  const [revertChoiceMode, setRevertChoiceMode] = useState<null | 'choose' | 'partial'>(null);
  const [processingPopupSep, setProcessingPopupSep] = useState(false);

  // "Alterar Produtos" — modo de edição de itens do pedido, dentro do mesmo popup de
  // separação (ver onAlterarProdutosVenda). editProdutosMode substitui o corpo/rodapé do
  // popup pelo painel de remover/adicionar, mesmo padrão de troca de conteúdo já usado por
  // revertChoiceMode acima.
  const [editProdutosMode, setEditProdutosMode] = useState(false);
  // Quantidade a remover por índice de item (posição em sale.items)
  const [alterarRemoveQtys, setAlterarRemoveQtys] = useState<Record<number, number>>({});
  // Itens novos ainda não salvos, aguardando o toque em "Salvar Alterações"
  const [alterarAddDrafts, setAlterarAddDrafts] = useState<{
    id: string; productId: string; variationId: string; saleType: SaleType; size?: string;
    quantity: number; price: number; unitPrice?: number;
  }[]>([]);
  const [addProductId, setAddProductId] = useState('');
  const [addVariationId, setAddVariationId] = useState('');
  const [addSaleType, setAddSaleType] = useState<SaleType>(SaleType.RETAIL);
  const [addSize, setAddSize] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [addPrice, setAddPrice] = useState(0);
  const [processingAlterar, setProcessingAlterar] = useState(false);

  // Inicializa as quantidades de separação quando o popup de itens abre
  useEffect(() => {
    if (!itemsPopupSale) {
      setPopupSepQtys({}); setPopupRevertQtys({}); setRevertChoiceMode(null);
      setEditProdutosMode(false); setAlterarRemoveQtys({}); setAlterarAddDrafts([]);
      setAddProductId(''); setAddVariationId(''); setAddSaleType(SaleType.RETAIL); setAddSize(''); setAddQty(1); setAddPrice(0);
      return;
    }
    const rows = buildSeparationRows(itemsPopupSale, products, stockLots);
    const init: Record<number, number> = {};
    rows.forEach(row => { init[row.idx] = row.maxSeparable; });
    setPopupSepQtys(init);
    setPopupRevertQtys({});
    setEditProdutosMode(false); setAlterarRemoveQtys({}); setAlterarAddDrafts([]);
    setAddProductId(''); setAddVariationId(''); setAddSaleType(SaleType.RETAIL); setAddSize(''); setAddQty(1); setAddPrice(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsPopupSale?.id]);

  // Pré-preenche o preço do item "a adicionar" com o preço de tabela sempre que
  // produto/variação/tipo/tamanho mudam — mesma resolução usada em ProductFormView
  // (variation.sizePrices[size].sale, com product.salePrice como fallback pro Varejo;
  // product.salePrice também é o preço "por grade" do Atacado).
  useEffect(() => {
    const product = products.find(p => p.id === addProductId);
    if (!product) return;
    if (addSaleType === SaleType.WHOLESALE) {
      setAddPrice(product.salePrice || 0);
    } else {
      const variation = product.variations.find(v => v.id === addVariationId);
      const sizePrice = addSize ? variation?.sizePrices?.[addSize]?.sale : undefined;
      setAddPrice(sizePrice ?? product.salePrice ?? 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addProductId, addVariationId, addSaleType, addSize]);

  const handleOpenExport = (e: React.MouseEvent, sale: Sale, format: 'pdf' | 'jpg') => {
    e.stopPropagation();
    setExportModal({ isOpen: true, sale, format });
  };

  const handleOpenPrintChoice = (e: React.MouseEvent, sale: Sale) => {
    e.stopPropagation();
    setPrintChoice({ sale, step: 'main' });
  };

  // "Impressão Padrão" — gera o PDF da venda direto (sem passar pelo popup de observação/
  // miniaturas do Exportar Venda) e entrega pro compartilhamento nativo, de onde o Android
  // já oferece "Imprimir" junto dos outros apps — é assim que impressão "normal" funciona em
  // todo o resto do programa (ver sharePDF em utils/pdfExport.ts), não existe uma API separada
  // de "mandar pra impressora do sistema".
  const handleStandardPrint = async (sale: Sale) => {
    setIsQuickPrinting(true);
    try {
      await exportSale({
        sale,
        products,
        people,
        paymentMethods,
        additionalNote: '',
        isDarkMode,
        showThumbnails: showThumbnails,
        companyProfile,
      }, 'pdf');
      setPrintChoice(null);
    } catch (error) {
      console.error('Standard print error:', error);
      toast.show('Erro ao gerar PDF para impressão.');
    } finally {
      setIsQuickPrinting(false);
    }
  };

  // Monta o lote de etiquetas de uma venda (uma etiqueta por caixa física no atacado, uma por
  // linha de tamanho no varejo) — usado por handleOpenSaleLabels, sem duplicar essa resolução de
  // estoque/grade/embalagem.
  const buildSaleLabelBatch = (sale: Sale): BatchLabelItem[] => {
    const batch: { product: Product; variation: Variation; sizeGrid: string; packagingName?: string; recipientName?: string }[] = [];
    sale.items.forEach((item) => {
      const product = products.find(p => p.id === item.productId);
      const variation = product?.variations.find(v => v.id === item.variationId);
      if (!product || !variation) return;
      if (item.saleType === SaleType.WHOLESALE && !item.size) {
        // Fila de destinatários por caixa, montada a partir da divisão feita no cadastro do
        // pedido (SaleItem.boxRecipients — ver "Dividir Caixas entre Clientes" no
        // SaleFormView). Cada caixa empurrada abaixo consome o próximo nome da fila, na ordem
        // em que as caixas são resolvidas; caixas sem nome na fila (divisão parcial ou
        // ausente) caem no fallback do prompt "Destinatário Final" mais abaixo.
        const recipientQueue: string[] = [];
        (item.boxRecipients || []).forEach(r => {
          const name = r.name.trim();
          if (!name || r.quantity <= 0) return;
          for (let i = 0; i < r.quantity; i++) recipientQueue.push(name);
        });
        let boxCounter = 0;
        const pushBox = (sizeGrid: string, packagingName?: string) => {
          const recipientName = recipientQueue[boxCounter];
          batch.push({ product, variation, sizeGrid, packagingName, recipientName });
          boxCounter++;
        };
        // Atacado (caixas) — uma etiqueta por caixa física do pedido, com a composição REAL
        // de cada caixa (StockLot.gradeLabel — é onde a composição de verdade de cada lote
        // fica, não na Grade padrão do produto nem na embalagem cadastrada da variante),
        // em ordem de prioridade:
        // 1) StockLot já resolvido pra ESTA venda (Separar Caixas/Expedir Venda já rodou) —
        //    o mais preciso, é literalmente o que já saiu do estoque pra este pedido.
        // 2) StockLot ainda EM_ESTOQUE do mesmo produto/variação — a venda ainda não foi
        //    separada, mas a(s) caixa(s) que vão sair pra ela já existem no estoque com a
        //    composição real; usa essas até cobrir a quantidade do item.
        // 3) Embalagem cadastrada da variante (Variation.stockPkgAllocations) — só resta
        //    quando não há nenhum StockLot disponível ainda.
        // 4) Grade padrão do produto (Grid.configuration) — último recurso.
        let remaining = item.quantity;
        const separatedLots = (item.separatedStockLotIds || [])
          .map(id => stockLots.find(l => l.id === id))
          .filter((l): l is StockLot => !!l);
        separatedLots.forEach(lot => {
          if (remaining <= 0) return;
          const copies = Math.min(lot.boxIds?.length || 1, remaining);
          for (let i = 0; i < copies; i++) {
            pushBox(lot.gradeLabel);
          }
          remaining -= copies;
        });

        if (remaining > 0) {
          const stockLotsAvailable = stockLots.filter(l =>
            l.productId === item.productId && l.variationId === item.variationId && l.status === 'EM_ESTOQUE'
          );
          for (const lot of stockLotsAvailable) {
            if (remaining <= 0) break;
            const copies = Math.min(lot.boxIds?.length || 1, remaining);
            for (let i = 0; i < copies; i++) {
              pushBox(lot.gradeLabel);
            }
            remaining -= copies;
          }
        }

        if (remaining > 0) {
          const allocations = (variation.stockPkgAllocations || []).filter(a => (a.qty || 0) > 0);
          for (const alloc of allocations) {
            if (remaining <= 0) break;
            const pkg = productionConfigs.find(p => p.id === alloc.pkgId);
            const breakdown = alloc.customBreakdown || (pkg?.metadata?.sizeQuantities as Record<string, number> | undefined) || {};
            const sizeGrid = Object.entries(breakdown)
              .filter(([, qty]) => qty > 0)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([sz, qty]) => `${sz}x${qty}`)
              .join('-');
            const packagingName = pkg?.name || 'Embalagem avulsa';
            const copies = Math.min(alloc.qty, remaining);
            for (let i = 0; i < copies; i++) {
              pushBox(sizeGrid, packagingName);
            }
            remaining -= copies;
          }
        }

        if (remaining > 0) {
          const grid = grids.find(g => g.id === product.defaultGridId);
          const sizeGrid = grid
            ? Object.entries(grid.configuration)
                .filter(([, qty]) => qty > 0)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([sz, qty]) => `${sz}x${qty}`)
                .join('-')
            : '';
          for (let i = 0; i < remaining; i++) {
            pushBox(sizeGrid);
          }
        }
      } else {
        // Varejo — cada tamanho já é uma linha própria na venda, vira uma etiqueta.
        batch.push({ product, variation, sizeGrid: item.size ? `${item.size}x${item.quantity}` : '' });
      }
    });
    if (batch.length === 0) return [];
    // Cliente (revendedor) — mesmo valor repetido em toda caixa do pedido. Destinatário final
    // (cliente do cliente): vem só do que foi dividido no cadastro do pedido (SaleItem.boxRecipients,
    // via "Dividir Caixas entre Clientes" em SaleFormView — ver pushBox acima); caixa sem divisão
    // sai sem destinatário, sem prompt na hora de imprimir.
    const customerName = sale.customerName || people.find(p => p.id === sale.customerId)?.name;
    // saleId embutido no QR de cada etiqueta (ver ElemKey/BatchLabelItem em
    // PrintLabelEditorModal.tsx) — como uma etiqueta de venda não tem Mapa/pedido de
    // produção pra rotear (lotId/orderId), o Scanner Rápido usa esse id pra abrir a venda
    // direto em vez de cair no erro "não vinculada a um Mapa".
    return batch.map(b => ({ ...b, customerName, saleId: sale.id }));
  };

  // Abre o editor livre (locks/camadas/campos vinculados) — padrão de impressão de etiqueta de
  // Vendas. Primeiro mostra o seletor de perfis (LabelProfilePickerModal); só depois de escolher
  // um modelo (ou "Criar Novo Perfil") é que navega pro editor de verdade, via onOpenLabelEditor.
  const handleOpenSaleLabels = (sale: Sale) => {
    const items = buildSaleLabelBatch(sale);
    if (items.length === 0) {
      toast.show('Nenhum item nessa venda pra gerar etiqueta.');
      return;
    }
    setLabelProfilePicker({ open: true, items });
  };

  const handlePickLabelProfile = (file: LabelFile) => {
    const items = labelProfilePicker.items;
    setLabelProfilePicker({ open: false, items: [] });
    onOpenLabelEditor?.({ widthMm: file.widthMm, heightMm: file.heightMm, paperSizeId: file.paperSizeId, existingFile: file, batchContext: { items } });
  };

  // Tamanho escolhido na etapa "Tamanho da Etiqueta" do próprio LabelProfilePickerModal (ver
  // onCreateNew) — nada mais fica implícito/hardcoded aqui.
  const handleCreateNewLabelProfile = (widthMm: number, heightMm: number) => {
    const items = labelProfilePicker.items;
    setLabelProfilePicker({ open: false, items: [] });
    onOpenLabelEditor?.({ widthMm, heightMm, batchContext: { items } });
  };

  const handleConfirmExport = async (
    note: string, format: 'pdf' | 'jpg',
    _showFinancialValues?: boolean, _groupMode?: 'none' | 'ref_color' | 'ref', _pcpTotalGrid?: boolean,
    _showMaterials?: boolean, _showItemGrid?: boolean, _showSectorNotes?: boolean, _showOrderList?: boolean,
    _splitPages?: boolean, _showProvider?: boolean, _showOSData?: boolean, _showSoleGrid?: boolean,
    _selectedSectorIds?: string[], _pageSize?: 'a4' | 'marketplace', _itemsPerPage?: number,
    exportShowThumbnails?: boolean,
  ) => {
    if (!exportModal.sale) return;

    try {
      await exportSale({
        sale: exportModal.sale,
        products,
        people,
        paymentMethods,
        additionalNote: note,
        isDarkMode,
        // Só mostra foto se a preferência global "Miniaturas dos Modelos" (Acessibilidade)
        // também estiver ligada — desligada, ela vence mesmo com o toggle local marcado.
        showThumbnails: showThumbnails && exportShowThumbnails,
        companyProfile,
      }, format);
      setExportModal(prev => ({ ...prev, isOpen: false }));
    } catch (error) {
      console.error('Export error:', error);
      toast.show('Erro ao exportar venda.');
    }
  };

  const handlePreviewExport = async (
    note: string, format: 'pdf' | 'jpg',
    _showFinancialValues?: boolean, _groupMode?: 'none' | 'ref_color' | 'ref', _pcpTotalGrid?: boolean,
    _showMaterials?: boolean, _showItemGrid?: boolean, _showSectorNotes?: boolean, _showOrderList?: boolean,
    _splitPages?: boolean, _showProvider?: boolean, _showOSData?: boolean, _showSoleGrid?: boolean,
    _selectedSectorIds?: string[], _pageSize?: 'a4' | 'marketplace', _itemsPerPage?: number,
    exportShowThumbnails?: boolean,
  ): Promise<string[]> => {
    if (!exportModal.sale) return [];
    const dataUrl = await exportSale({
      sale: exportModal.sale,
      products,
      people,
      paymentMethods,
      additionalNote: note,
      isDarkMode,
      showThumbnails: showThumbnails && exportShowThumbnails,
      companyProfile,
    }, format, true);
    return dataUrl ? [dataUrl] : [];
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

  // `sale.customerName` é um snapshot gravado na criação da venda — editar o nome do
  // cliente no cadastro de Pessoas depois não atualizava esse snapshot, então a lista de
  // Vendas continuava mostrando o nome antigo pra sempre. Busca o nome ATUAL via
  // customerId quando o cliente ainda existe no cadastro; cai pro snapshot só quando o
  // vínculo não existe (venda avulsa, sem cliente cadastrado, ou cliente excluído).
  const peopleById = useMemo(() => {
    const map = new Map<string, Person>();
    people.forEach(p => map.set(p.id, p));
    return map;
  }, [people]);
  const getCustomerName = (sale: Sale) => (sale.customerId && peopleById.get(sale.customerId)?.name) || sale.customerName;

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

  // Mesma varredura do "Reparar Caixas" (PCP) — aviso aqui em Vendas pra não depender do
  // usuário lembrar de checar o PCP quando uma produção não somou ao estoque.
  const stockRepairSummary = useMemo(
    () => summarizeStockRepairIssues(lots, stockLots, productionOrders, products),
    [lots, stockLots, productionOrders, products]
  );

  // Separações feitas antes da correção do desconto de estoque (StockLot reservado via
  // pool sem descontar o contador do produto) — mesmo aviso disponível em Estoque >
  // Configurar > Reconciliar Separações, replicado aqui pra não depender do usuário
  // lembrar de checar Estoque depois de separar caixas.
  const separationReconcileCount = useMemo(() => buildSeparationReconcileGroups(stockLots).length, [stockLots]);

  // Mesmas varreduras de "Diagnóstico de Estoque" e "Reparar Finalizados" (Estoque >
  // Configurar) — replicadas aqui só pra alimentar os avisos, a correção em si acontece
  // sempre em Estoque.
  const { duplicateStockLotGroups } = useStockLotDuplicates(stockLots, lots);
  const orphanedFinalizedKeyCount = useMemo(() => buildOrphanedFinalizedKeyFixes(lots).length, [lots]);

  // Caixas reservadas presas em pedidos que não as referenciam mais — sobra do bug de
  // concorrência da separação de caixas (já corrigido, ver src/utils/
  // stockOrphanedReservations.ts). Correção fica em Estoque > Configurar > Reservas Órfãs.
  const orphanedReservedLotsCount = useMemo(() => {
    const resolved = readResolvedOrphanedLotKeys();
    return buildOrphanedReservedLots(stockLots, sales, products).filter(e => !resolved[e.key]).length;
  }, [stockLots, sales, products]);

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

  // Fonte única de "quanto ainda falta pagar" — a mesma conta usada no Resumo Financeiro
  // do card (RESTANTE/PAGO) e na barra de métricas (A Receber). O campo `paymentStatus`
  // gravado no pedido pode ficar desatualizado (ex.: total editado depois de marcado como
  // pago, registros antigos sem o campo) — filtrar por ele em vez de recalcular deixava
  // pedidos com saldo em aberto de fora do filtro "Pagamentos Pendentes" mesmo aparecendo
  // na soma do "A Receber" (que já usa este cálculo).
  const getSaleRemaining = (s: Sale) => {
    const totalPaid = (s.paymentHistory || []).reduce((acc, p) => acc + (p.amount || 0), 0);
    return s.total - totalPaid;
  };

  // Período selecionável — atalhos comuns (Hoje/7 dias/30 dias/Este Mês/Este Ano) +
  // intervalo customizado. `null` = sem recorte (ALL).
  const periodRange = useMemo((): { start: number | null; end: number | null } | null => {
    if (periodPreset === 'ALL') return null;
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
    switch (periodPreset) {
      case 'TODAY':
        return { start: startOfDay(now), end: endOfDay(now) };
      case '7D': {
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        return { start: startOfDay(start), end: endOfDay(now) };
      }
      case '30D': {
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        return { start: startOfDay(start), end: endOfDay(now) };
      }
      case 'MONTH':
        return { start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), end: endOfDay(now) };
      case 'YEAR':
        return { start: startOfDay(new Date(now.getFullYear(), 0, 1)), end: endOfDay(now) };
      case 'CUSTOM':
        return {
          start: periodStart ? new Date(`${periodStart}T00:00:00`).getTime() : null,
          end: periodEnd ? new Date(`${periodEnd}T23:59:59`).getTime() : null,
        };
      default:
        return null;
    }
  }, [periodPreset, periodStart, periodEnd]);

  const filteredSales = useMemo(() => {
    return effectiveSales.filter(s => {
      // Filter by Type (Retail/Wholesale)
      if (filter !== 'ALL') {
        const hasType = (s.items || []).some(item => item.saleType === filter);
        if (!hasType) return false;
      }

      // Filter by Payment Status — via saldo calculado (ver getSaleRemaining acima), não
      // pelo campo `paymentStatus` gravado (pode estar desatualizado). Orçamento não conta
      // como "pendente" aqui (ainda não é uma venda confirmada) — mesmo critério do total
      // "A Receber" da barra de métricas acima.
      if (paymentFilter !== 'ALL') {
        const remaining = getSaleRemaining(s);
        if (paymentFilter === 'PENDING' && (s.status === SaleStatus.QUOTE || remaining <= 0)) return false;
        if (paymentFilter === 'PAID' && s.status !== SaleStatus.QUOTE && remaining > 0) return false;
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

      // Filter by Period
      if (periodRange) {
        if (periodRange.start !== null && s.date < periodRange.start) return false;
        if (periodRange.end !== null && s.date > periodRange.end) return false;
      }

      // Filter by Search Query (Name or ID)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const cleanQuery = query.replace(/[()\-\s]/g, '');
        const cleanOrderNumber = s.orderNumber?.toLowerCase().replace(/[()\-\s]/g, '');

        const matchesName = getCustomerName(s)?.toLowerCase().includes(query);
        const matchesId = cleanOrderNumber && cleanQuery ? cleanOrderNumber.includes(cleanQuery) : false;

        if (!matchesName && !matchesId) return false;
      }

      return true;
    }).sort((a, b) => b.date - a.date); // Mais recentes primeiro
  }, [effectiveSales, filter, paymentFilter, deliveryFilter, selectedStatuses, periodRange, searchQuery]);

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

  // Texto da nota do Google Keep — cada referência em sua própria linha (com espaçamento entre
  // elas), campos ligados/desligados conforme `keepFields`; cabeçalho sempre com pedido/cliente/
  // id/data pra identificar a nota mesmo fora do app.
  const generateKeepMessage = (sale: Sale, fields: typeof keepFields) => {
    const customer = people.find(p => p.id === sale.customerId);
    const shortId = sale.id.slice(-6).toUpperCase();
    const dateStr = format(new Date(sale.date), 'dd/MM/yyyy', { locale: ptBR });
    const header = `PEDIDO #${sale.orderNumber} · ID ${shortId}\nCliente: ${customer?.name || sale.customerName || 'Cliente'}\nData: ${dateStr}`;

    const itemsText = sale.items.map(item => {
      const p = getProductInfo(item.productId);
      const v = getVariationInfo(item.productId, item.variationId);
      const unit = item.saleType === SaleType.RETAIL ? 'pares' : 'cx';

      const titleParts: string[] = [];
      if (fields.reference && p?.reference) titleParts.push(p.reference);
      if (fields.nameColor) titleParts.push(`${p?.name || ''}${v?.colorName ? ` ${v.colorName}` : ''}`.trim());
      const title = titleParts.join(' · ') || p?.name || 'Item';

      const detailParts: string[] = [];
      if (fields.boxQty) detailParts.push(`${item.quantity} ${unit}`);
      if (fields.unitValue) detailParts.push(`Un: R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      if (fields.totalValue) detailParts.push(`Total: R$ ${(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

      return detailParts.length > 0 ? `${title}\n   ${detailParts.join(' · ')}` : title;
    }).join('\n\n');

    return `${header}\n\n${itemsText}\n\n------------------\nTOTAL: R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleExportKeep = async () => {
    if (!keepExportSale) return;
    const text = generateKeepMessage(keepExportSale, keepFields);
    try {
      await CapacitorShare.share({ title: `Pedido #${keepExportSale.orderNumber}`, text, dialogTitle: 'Enviar para o Google Keep' });
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (!/cancel/i.test(msg)) toast.show('Erro ao compartilhar: ' + msg);
    }
    setKeepExportSale(null);
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
        const saleBeingCancelled = saleToDelete ? sales.find(s => s.id === saleToDelete) : null;
        return (
          <ConfirmDialog
            isOpen={!!saleToDelete}
            title="Cancelar Pedido?"
            message={`O pedido${saleBeingCancelled ? ` #${saleBeingCancelled.orderNumber}` : ''} será cancelado num passo só: os produtos reservados/separados voltam ao estoque geral, os lançamentos financeiros (contas a receber/receitas) e o crédito de cliente são estornados, e o registro é apagado definitivamente. A produção em andamento (se houver) segue normalmente. Esta ação não pode ser desfeita.`}
            confirmLabel="Sim, Cancelar Pedido"
            cancelLabel="Agora não"
            onConfirm={() => {
              if (saleToDelete) {
                onCancelAndRevert(saleToDelete);
                setSaleToDelete(null);
              }
            }}
            onCancel={() => setSaleToDelete(null)}
            isDanger={true}
          />
        );
      })()}
      <StockRepairBanner
        fixable={stockRepairSummary.missingBoxQty + stockRepairSummary.missingStockLot}
        unresolved={stockRepairSummary.unresolved}
        onOpen={onNavigatePCP}
        isDarkMode={isDarkMode}
      />
      {separationReconcileCount > 0 && (
        <button
          type="button"
          onClick={onNavigateStockReconcile}
          data-guide-anchor="sales.bannerReconciliar"
          className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all active:scale-[0.99] text-left ${isDarkMode ? 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/15' : 'bg-rose-50 border-rose-200 hover:bg-rose-100'}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-600'}`}>
            <Wrench size={18} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-rose-300' : 'text-rose-700'}`}>
              {separationReconcileCount} produto{separationReconcileCount === 1 ? '' : 's'} com estoque a corrigir
            </p>
            <p className="text-[9px] font-bold text-rose-500/80 uppercase tracking-widest mt-0.5">
              Separações de caixas ainda não descontadas do estoque — toque para corrigir
            </p>
          </div>
          <ChevronRight size={16} className="text-rose-500 shrink-0" />
        </button>
      )}
      {orphanedReservedLotsCount > 0 && onNavigateStockOrphaned && (
        <button
          type="button"
          onClick={onNavigateStockOrphaned}
          data-guide-anchor="sales.bannerCaixasPresas"
          className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all active:scale-[0.99] text-left ${isDarkMode ? 'bg-violet-500/10 border-violet-500/30 hover:bg-violet-500/15' : 'bg-violet-50 border-violet-200 hover:bg-violet-100'}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-100 text-violet-600'}`}>
            <Boxes size={18} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-violet-300' : 'text-violet-700'}`}>
              {orphanedReservedLotsCount} caixa{orphanedReservedLotsCount === 1 ? '' : 's'} reservada{orphanedReservedLotsCount === 1 ? '' : 's'} presa{orphanedReservedLotsCount === 1 ? '' : 's'} em pedido antigo
            </p>
            <p className="text-[9px] font-bold text-violet-500/80 uppercase tracking-widest mt-0.5">
              Pedido não referencia mais essa caixa — toque para liberar em Estoque
            </p>
          </div>
          <ChevronRight size={16} className="text-violet-500 shrink-0" />
        </button>
      )}
      {duplicateStockLotGroups.length > 0 && (
        <button
          type="button"
          onClick={onNavigateStockDiagnostic}
          data-guide-anchor="sales.bannerDuplicidade"
          className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all active:scale-[0.99] text-left ${isDarkMode ? 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/15' : 'bg-rose-50 border-rose-200 hover:bg-rose-100'}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-600'}`}>
            <AlertCircle size={18} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-rose-300' : 'text-rose-700'}`}>
              {duplicateStockLotGroups.length} duplicidade{duplicateStockLotGroups.length === 1 ? '' : 's'} de estoque
            </p>
            <p className="text-[9px] font-bold text-rose-500/80 uppercase tracking-widest mt-0.5">
              Mesma produção creditada mais de uma vez — toque para corrigir
            </p>
          </div>
          <ChevronRight size={16} className="text-rose-500 shrink-0" />
        </button>
      )}
      {orphanedFinalizedKeyCount > 0 && (
        <button
          type="button"
          onClick={() => setShowDiagnosticsModal(true)}
          data-guide-anchor="sales.bannerOpIncorreta"
          className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all active:scale-[0.99] text-left ${isDarkMode ? 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/15' : 'bg-orange-50 border-orange-200 hover:bg-orange-100'}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>
            <Wrench size={18} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-orange-300' : 'text-orange-700'}`}>
              {orphanedFinalizedKeyCount} pedido{orphanedFinalizedKeyCount === 1 ? '' : 's'} de produção com status incorreto
            </p>
            <p className="text-[9px] font-bold text-orange-500/80 uppercase tracking-widest mt-0.5">
              Mapa já finalizado aparecendo como pendente — toque para corrigir
            </p>
          </div>
          <ChevronRight size={16} className="text-orange-500 shrink-0" />
        </button>
      )}

      <div className="flex flex-col gap-4">
        {/* Card único com 3 botões numa linha — "Conf. Estoque" foi dissolvido: a tela
            Expedição e Estoque (StockView) não tem mais entrada direta própria, só é
            alcançada de dentro de Gerenciamento (Cruzamento, Diagnósticos e Correções,
            Expedição, Estoque, Lotes, Fazer Balanço). */}
        <div className={`p-2 rounded-[2rem] border shadow-sm ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100/80 border-slate-100'}`}>
          <div className="grid grid-cols-3 gap-2">
            {showManagementCard !== undefined && (
              <button
                onClick={() => {
                  setShowManagementCard(v => !v);
                  setManagementView('chooser');
                  setManagementSearchTerm('');
                }}
                data-guide-anchor="sales.gerenciamento"
                className={`py-3 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm ${showManagementCard ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-emerald-400' : 'bg-white text-slate-600 hover:text-emerald-600'}`}
                title="Gerenciamento — Cruzamento, Diagnósticos, Expedição, Estoque, Lotes, Balanço"
              >
                <PackagePlus size={18} strokeWidth={2.5} className={isIndustrial ? 'text-emerald-600' : (showManagementCard ? 'text-emerald-600 dark:text-emerald-400' : 'text-emerald-500')} />
                <span className="text-[10px] font-black tracking-[0.15em]">Gerenciamento</span>
              </button>
            )}
            <button
              onClick={() => setShowFilters(true)}
              data-guide-anchor="sales.filtros"
              className={`py-3 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 relative shadow-sm ${showFilters ? 'bg-rose-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-rose-400' : 'bg-white text-slate-600 hover:text-rose-500'}`}
              title="Configurações e Filtros"
            >
              <div className="relative">
                <Filter size={18} strokeWidth={2.5} className={showFilters ? '' : 'text-rose-500'} />
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-3 -right-3 w-5 h-5 bg-orange-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-in zoom-in">
                    {activeFiltersCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-black tracking-[0.15em]">Filtros</span>
            </button>

            <button
              onClick={onNavigateStockGlance}
              data-guide-anchor="sales.disponivel"
              className={`py-3 px-3 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 shadow-sm ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:text-sky-400' : 'bg-white text-slate-600 hover:text-sky-600'}`}
              title="Disponível em Estoque (somente leitura)"
            >
              <Eye size={18} strokeWidth={2.5} className={isIndustrial ? 'text-sky-600' : 'text-sky-500'} />
              <span className="text-[10px] font-black tracking-[0.15em]">Disponível</span>
            </button>
          </div>
        </div>

        {/* Painel de Gerenciamento — escolhe entre Cruzamento e Diagnósticos e Correções */}
        {showManagementCard && managementView === 'chooser' && (
          <div className={`p-4 rounded-[2rem] border shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  <PackagePlus size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className={`text-[14px] font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Gerenciamento</h3>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Escolha uma ferramenta</p>
                </div>
              </div>
              <button onClick={() => setShowManagementCard(false)} data-guide-anchor="sales.mgmtFechar" className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setManagementView('cruzamento')}
                data-guide-anchor="sales.mgmtCruzamento"
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15' : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                  <PackagePlus size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Cruzamento de Estoque</p>
                  <p className="text-[9px] font-bold text-slate-400 normal-case tracking-normal mt-0.5">Compara demanda das vendas com estoque e produção — mostra o que falta, está em dia ou sobrando</p>
                </div>
                <ChevronRight size={16} className="text-emerald-500 shrink-0 ml-auto" />
              </button>

              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(true)}
                data-guide-anchor="sales.mgmtDiagnosticos"
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${isDarkMode ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15' : 'bg-amber-50 border-amber-200 hover:bg-amber-100'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                  <Wrench size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Diagnósticos e Correções</p>
                  <p className="text-[9px] font-bold text-slate-400 normal-case tracking-normal mt-0.5">Alocações de embalagem, separações, estoque não creditado, reservas órfãs e mais</p>
                </div>
                <ChevronRight size={16} className="text-amber-500 shrink-0 ml-auto" />
              </button>

              <button
                type="button"
                onClick={() => setShowEntryHistoryModal(true)}
                data-guide-anchor="sales.mgmtHistorico"
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${isDarkMode ? 'bg-slate-500/10 border-slate-500/30 hover:bg-slate-500/15' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-500/20 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                  <History size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Histórico de Movimentações</p>
                  <p className="text-[9px] font-bold text-slate-400 normal-case tracking-normal mt-0.5">Entradas e saídas de estoque, com opção de reverter</p>
                </div>
                <ChevronRight size={16} className="text-slate-400 shrink-0 ml-auto" />
              </button>

              <button
                type="button"
                onClick={() => setManagementView('expedicao')}
                data-guide-anchor="sales.mgmtExpedicao"
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${isDarkMode ? 'bg-sky-500/10 border-sky-500/30 hover:bg-sky-500/15' : 'bg-sky-50 border-sky-200 hover:bg-sky-100'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-600'}`}>
                  <Truck size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Expedição</p>
                  <p className="text-[9px] font-bold text-slate-400 normal-case tracking-normal mt-0.5">Separação e entrega dos pedidos de clientes</p>
                </div>
                <ChevronRight size={16} className="text-sky-500 shrink-0 ml-auto" />
              </button>

              <button
                type="button"
                onClick={onNavigateStock}
                data-guide-anchor="sales.mgmtEstoque"
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${isDarkMode ? 'bg-violet-500/10 border-violet-500/30 hover:bg-violet-500/15' : 'bg-violet-50 border-violet-200 hover:bg-violet-100'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-100 text-violet-600'}`}>
                  <Package size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Estoque</p>
                  <p className="text-[9px] font-bold text-slate-400 normal-case tracking-normal mt-0.5">Inventário de produtos prontos, por referência e cor</p>
                </div>
                <ChevronRight size={16} className="text-violet-500 shrink-0 ml-auto" />
              </button>

              {modulesConfig.production && (
                <button
                  type="button"
                  onClick={() => setManagementView('lotes')}
                  data-guide-anchor="sales.mgmtLotes"
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15' : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                    <Boxes size={18} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Lotes</p>
                    <p className="text-[9px] font-bold text-slate-400 normal-case tracking-normal mt-0.5">Registro de produção (StockLots) gerado na finalização</p>
                  </div>
                  <ChevronRight size={16} className="text-emerald-500 shrink-0 ml-auto" />
                </button>
              )}

              <button
                type="button"
                onClick={onNavigateStockBalance}
                data-guide-anchor="sales.mgmtBalanco"
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all active:scale-[0.99] ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/15' : 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                  <TrendingUp size={18} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Fazer Balanço</p>
                  <p className="text-[9px] font-bold text-slate-400 normal-case tracking-normal mt-0.5">Editar manualmente o estoque de todos os produtos</p>
                </div>
                <ChevronRight size={16} className="text-indigo-500 shrink-0 ml-auto" />
              </button>
            </div>
          </div>
        )}

        {/* Card de Cruzamento de Demanda x Estoque/Produção */}
        {showManagementCard && managementView === 'cruzamento' && (
          <div className={`p-4 rounded-[2rem] border shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setManagementView('chooser')}
                  title="Voltar pro Gerenciamento"
                  aria-label="Voltar pro Gerenciamento"
                  data-guide-anchor="sales.mgmtVoltar"
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all shrink-0"
                >
                  <ArrowLeft size={16} strokeWidth={2.5} />
                </button>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  <PackagePlus size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className={`text-[14px] font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Cruzamento de Estoque</h3>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Vendas vs Físico vs Produção</p>
                </div>
              </div>
              <button onClick={() => setShowManagementCard(false)} data-guide-anchor="sales.mgmtFechar" className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all shrink-0">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className={`flex items-start gap-2.5 p-3.5 rounded-2xl mb-3 ${isDarkMode ? 'bg-indigo-900/20 border border-indigo-800/40' : 'bg-indigo-50 border border-indigo-100'}`}>
              <Info size={15} className={`shrink-0 mt-0.5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
              <p className={`text-[10px] font-bold leading-relaxed normal-case tracking-normal ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                O Cruzamento compara a demanda das vendas em aberto (que ainda não foram totalmente separadas) com o estoque físico disponível e o que está em produção — assim dá pra ver, por referência e cor, o que já está garantido, o que falta comprar/produzir, e o que já sobrou.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportStockShortage}
              disabled={isExportingShortage}
              data-guide-anchor="sales.mgmtExportarFalta"
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-60 mb-3 ${isDarkMode ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
            >
              <Share2 size={14} strokeWidth={2.5} />
              {isExportingShortage ? 'Gerando...' : 'Exportar JPG — Produtos em Falta'}
            </button>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1 pb-20">
              {crossCheckData.length === 0 && (
                <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-6">Nenhuma demanda nas vendas visíveis.</p>
              )}
              {crossCheckData.map((d) => {
                const balance = d.stock - d.demand;
                const isDeficit = balance < 0;
                const unit = d.isWholesale ? 'cx' : 'pr';
                const dProduct = products.find(p => p.id === d.productId);
                const dVariation = dProduct?.variations.find(v => v.id === d.variationId);
                const dPhoto = dVariation?.photoUrl || dProduct?.photoUrl;

                return (
                  <div key={d.key} className={`p-3 rounded-2xl border flex flex-col gap-2 ${isDarkMode ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'}`}>
                    <div className="flex items-center justify-between min-w-0">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <div className={`w-9 h-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                          {dPhoto
                            ? <img src={dPhoto} alt={d.productName} className="w-full h-full object-cover" />
                            : <Package size={14} className="text-slate-300" />}
                        </div>
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
                            }
                          }}
                          data-guide-anchor="sales.crossCheckPill"
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

                    {modulesConfig.production && d.isWholesale && d.productionPairs > 0 && (
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

                    {/* Sem o módulo Produção, não existe "está em produção" pra cobrir o déficit —
                        só resta comprar mais estoque. Avisa isso explicitamente em vez de deixar
                        o "Faltou X" sozinho sem indicar o que fazer a respeito. */}
                    {!modulesConfig.production && isDeficit && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400">
                        <AlertCircle size={12} strokeWidth={2.5} className="shrink-0" />
                        <span className="text-[10px] font-bold">
                          Estoque não cobre o pedido — compre mais {Math.abs(balance)} {unit} pra completar
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expedição — Pedidos de Clientes, trazido de dentro do antigo StockView */}
        {showManagementCard && managementView === 'expedicao' && (
          <div className={`p-4 rounded-[2rem] border shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setManagementView('chooser')}
                  title="Voltar pro Gerenciamento"
                  aria-label="Voltar pro Gerenciamento"
                  data-guide-anchor="sales.mgmtVoltar"
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all shrink-0"
                >
                  <ArrowLeft size={16} strokeWidth={2.5} />
                </button>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-50 text-sky-600'}`}>
                  <Truck size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className={`text-[14px] font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Expedição</h3>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Pedidos de Clientes</p>
                </div>
              </div>
              <button onClick={() => setShowManagementCard(false)} data-guide-anchor="sales.mgmtFechar" className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all shrink-0">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar cliente ou pedido..."
                value={managementSearchTerm}
                onChange={(e) => setManagementSearchTerm(e.target.value)}
                data-guide-anchor="sales.mgmtBusca"
                className={`w-full border rounded-xl py-3 pl-11 pr-4 text-[11px] font-bold uppercase tracking-widest outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
              />
            </div>

            <div className="max-h-[65vh] overflow-y-auto custom-scrollbar pr-1 pb-2">
              <PedidosClientesPanel
                sales={sales}
                stockLots={stockLots}
                productionOrders={productionOrders}
                products={products}
                isDarkMode={isDarkMode}
                searchTerm={managementSearchTerm}
              />
            </div>
          </div>
        )}

        {/* Lotes — Registro de Produção, trazido de dentro do antigo StockView */}
        {showManagementCard && managementView === 'lotes' && (
          <div className={`p-4 rounded-[2rem] border shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setManagementView('chooser')}
                  title="Voltar pro Gerenciamento"
                  aria-label="Voltar pro Gerenciamento"
                  data-guide-anchor="sales.mgmtVoltar"
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all shrink-0"
                >
                  <ArrowLeft size={16} strokeWidth={2.5} />
                </button>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  <Boxes size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className={`text-[14px] font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Lotes</h3>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Registro de Produção</p>
                </div>
              </div>
              <button onClick={() => setShowManagementCard(false)} data-guide-anchor="sales.mgmtFechar" className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all shrink-0">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar produto ou cliente..."
                value={managementSearchTerm}
                onChange={(e) => setManagementSearchTerm(e.target.value)}
                data-guide-anchor="sales.mgmtBusca"
                className={`w-full border rounded-xl py-3 pl-11 pr-4 text-[11px] font-bold uppercase tracking-widest outline-none ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
              />
            </div>

            <div className="max-h-[65vh] overflow-y-auto custom-scrollbar pr-1 pb-2">
              <StockLotsPanel stockLots={stockLots} isDarkMode={isDarkMode} searchTerm={managementSearchTerm} />
            </div>
          </div>
        )}

        {/* Search - Always Visible */}
        <div data-guide-anchor="sales.busca" className="relative">
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

        {/* Vendas antigas e já pagas não ficam carregadas por padrão — busca de uma vez sob demanda.
            Mesmo gatilho quando um período customizado pode cair fora do que já está em
            memória (a busca por texto já cobria isso; o período precisa da mesma saída). */}
        {(searchQuery.trim() || periodPreset !== 'ALL') && filteredSales.length === 0 && !olderSales && (
          <button
            type="button"
            onClick={handleLoadFullHistory}
            disabled={isLoadingHistory}
            data-guide-anchor="sales.carregarHistorico"
            className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60 ${isDarkMode ? 'bg-indigo-950/30 text-indigo-400 border border-indigo-900/50' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}
          >
            {isLoadingHistory ? 'Carregando...' : 'Carregar histórico completo de vendas'}
          </button>
        )}

        {/* Métricas de Entrega e Valores */}
        {showSummaryBar && (deliveryStats.delivered > 0 || deliveryStats.pending > 0 || deliveryStats.totalPendingAmount > 0) && (
          <div className={`flex items-stretch justify-between px-2 py-3 rounded-[2rem] border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            
            <div data-guide-anchor="sales.statEntregues" className="flex-1 flex flex-col items-center justify-center gap-1.5 border-r border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Truck size={14} strokeWidth={2.5} />
              </div>
              <p className={`text-[13px] font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{deliveryStats.delivered}</p>
              <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 text-center">Entregues</p>
            </div>

            <div data-guide-anchor="sales.statAguardando" className="flex-1 flex flex-col items-center justify-center gap-1.5 border-r border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Clock size={14} strokeWidth={2.5} />
              </div>
              <p className={`text-[13px] font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{deliveryStats.pending}</p>
              <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 text-center px-1">Aguardando<br/>Entrega</p>
            </div>

            <div data-guide-anchor="sales.statAReceber" className="flex-1 flex flex-col items-center justify-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <DollarSign size={14} strokeWidth={2.5} />
              </div>
              <p className={`text-[13px] font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
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
            data-guide-anchor="sales.cardDisponivelEstoque"
            className={`w-full text-left p-4 rounded-[2rem] border shadow-sm transition-all active:scale-[0.99] ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/60' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
            title="Disponível em Estoque"
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Disponível em Estoque</span>
              {/* "Mostrar" + seta com círculo pulsante — deixa mais óbvio que o card inteiro é
                  clicável e leva pra visão detalhada (o ícone de olho sozinho passava batido). */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Mostrar</span>
                <span className="relative flex items-center justify-center w-5 h-5">
                  <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-75" />
                  <span className="relative flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500">
                    <ChevronRight size={12} className="text-white" />
                  </span>
                </span>
              </div>
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
            className={`relative w-full max-w-sm max-h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho fixo — nunca rola junto com os filtros abaixo, senão o X de fechar
                fica inalcançável quando a lista de filtros cresce além da altura da tela
                (ver Período abaixo, o motivo do popup ter passado a precisar rolar). */}
            <div className="flex items-center justify-between px-6 pt-6 pb-1 shrink-0">
              <h3 className={`text-[13px] font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Filtros e Configurações</h3>
              <button onClick={() => setShowFilters(false)} data-guide-anchor="sales.filtrosFechar" className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex flex-col gap-5 px-6 pb-6 pt-4 overflow-y-auto force-scrollbar">

            {/* Tipo de Venda */}
            <div data-guide-anchor="sales.filtroTipoVenda" className="flex flex-col gap-2">
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
            <div data-guide-anchor="sales.filtroPagamento" className="flex flex-col gap-2 mt-2">
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
            <div data-guide-anchor="sales.filtroEntrega" className="flex flex-col gap-2 mt-2">
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
            <div data-guide-anchor="sales.filtroStatusPedido" className="flex flex-col gap-2 mt-2">
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

            {/* Período */}
            <div data-guide-anchor="sales.filtroPeriodo" className="flex flex-col gap-2 mt-2">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 ml-1">Período</p>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: 'ALL', label: 'Todos' },
                  { v: 'TODAY', label: 'Hoje' },
                  { v: '7D', label: '7 dias' },
                  { v: '30D', label: '30 dias' },
                  { v: 'MONTH', label: 'Este Mês' },
                  { v: 'YEAR', label: 'Este Ano' },
                  { v: 'CUSTOM', label: 'Personalizado' },
                ] as const).map(({ v, label }) => {
                  const active = periodPreset === v;
                  return (
                    <button key={v} type="button" onClick={() => setPeriodPreset(v)}
                      className={`py-2.5 rounded-xl text-[10px] font-black tracking-wider transition-all border ${
                        active
                          ? 'bg-gradient-to-b from-teal-500 to-teal-600 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(20,184,166,0.5)] ring-1 ring-inset ring-white/20'
                          : isDarkMode
                            ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-800/80'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm'
                      }`}>
                      {label}
                    </button>
                  );
                })}
              </div>
              {periodPreset === 'CUSTOM' && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">De</label>
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      className={`w-full h-10 rounded-xl px-3 text-xs font-bold border-2 border-transparent outline-none focus:border-teal-500 ${isDarkMode ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-slate-900'}`}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Até</label>
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      className={`w-full h-10 rounded-xl px-3 text-xs font-bold border-2 border-transparent outline-none focus:border-teal-500 ${isDarkMode ? 'bg-slate-800/50 text-white' : 'bg-slate-50 text-slate-900'}`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Visualização */}
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 ml-1">Visualização</p>
              <div className="flex gap-2">
                <button onClick={() => setExpandedCards(v => !v)}
                  data-guide-anchor="sales.vizCardsExpandidos"
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all ${expandedCards ? 'bg-gradient-to-b from-slate-500 to-slate-600 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(71,85,105,0.5)] ring-1 ring-inset ring-white/20' : isDarkMode ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-800/80' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
                  {expandedCards ? 'Cards Expandidos' : 'Cards Compactos'}
                </button>
                <button onClick={() => setShowProducts(v => !v)}
                  data-guide-anchor="sales.vizMostrarProdutos"
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all ${showProducts ? 'bg-gradient-to-b from-slate-500 to-slate-600 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(71,85,105,0.5)] ring-1 ring-inset ring-white/20' : isDarkMode ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-800/80' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
                  {showProducts ? 'Mostrar Produtos' : 'Ocultar Produtos'}
                </button>
              </div>
              <button onClick={() => setShowGradeBreakdown(v => !v)}
                data-guide-anchor="sales.vizPadraoEmbalagem"
                className={`w-full py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all ${showGradeBreakdown ? 'bg-gradient-to-b from-violet-500 to-violet-600 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(139,92,246,0.5)] ring-1 ring-inset ring-white/20' : isDarkMode ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-800/80' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
                {showGradeBreakdown ? 'Ocultar Padrão de Embalagem' : 'Mostrar Padrão de Embalagem'}
              </button>
              <button onClick={() => setShowSeparationInfo(v => !v)}
                data-guide-anchor="sales.vizAvisosSeparacao"
                className={`w-full py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all flex items-center justify-center gap-2 ${showSeparationInfo ? 'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(99,102,241,0.5)] ring-1 ring-inset ring-white/20' : isDarkMode ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-800/80' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
                <Boxes size={14} strokeWidth={2.5} />
                {showSeparationInfo ? 'Avisos de Separação Visíveis' : 'Avisos de Separação Ocultos'}
              </button>
              <button onClick={() => setShowSeparationThumbnails(v => !v)}
                data-guide-anchor="sales.vizMiniaturasSeparacao"
                className={`w-full py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all flex items-center justify-center gap-2 ${showSeparationThumbnails ? 'bg-gradient-to-b from-sky-500 to-sky-600 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(14,165,233,0.5)] ring-1 ring-inset ring-white/20' : isDarkMode ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-800/80' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
                <Package size={14} strokeWidth={2.5} />
                {showSeparationThumbnails ? 'Miniaturas na Separação Visíveis' : 'Miniaturas na Separação Ocultas'}
              </button>
              <button onClick={() => setShowSummaryBar(v => !v)}
                data-guide-anchor="sales.vizBarraValores"
                className={`w-full py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all flex items-center justify-center gap-2 ${showSummaryBar ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(16,185,129,0.5)] ring-1 ring-inset ring-white/20' : isDarkMode ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-800/80' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
                <DollarSign size={14} strokeWidth={2.5} />
                {showSummaryBar ? 'Barra de Valores Visível' : 'Barra de Valores Oculta'}
              </button>
              <button onClick={() => setShowStockGlanceCard(v => !v)}
                data-guide-anchor="sales.vizCardDisponivel"
                className={`w-full py-2.5 rounded-xl text-[10px] font-black tracking-wider border transition-all flex items-center justify-center gap-2 ${showStockGlanceCard ? 'bg-gradient-to-b from-sky-500 to-sky-600 text-white border-transparent shadow-[0_2px_8px_-2px_rgba(14,165,233,0.5)] ring-1 ring-inset ring-white/20' : isDarkMode ? 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:bg-slate-800/80' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-sm'}`}>
                <Eye size={14} strokeWidth={2.5} />
                {showStockGlanceCard ? 'Card Disponível em Estoque Visível' : 'Card Disponível em Estoque Oculto'}
              </button>
            </div>

            <button
              onClick={() => { setFilter('ALL'); setPaymentFilter('ALL'); setDeliveryFilter('ALL'); setSelectedStatuses([SaleStatus.SALE, SaleStatus.CONFIRMED, SaleStatus.QUOTE]); setExpandedCards(false); setShowProducts(true); setShowGradeBreakdown(false); setShowSeparationInfo(true); setShowSummaryBar(true); setShowStockGlanceCard(true); }}
              data-guide-anchor="sales.limparFiltros"
              className="mt-1 w-full py-3 rounded-2xl text-[10px] font-black tracking-widest text-rose-500 border border-rose-100 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all shadow-sm bg-white dark:bg-slate-900"
            >
              Limpar Filtros
            </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredSales.map((sale) => {
          const totalPaid = (sale.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
          const remaining = Math.max(0, sale.total - totalPaid);

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
                      {sale.saleDestination === 'STOCK' ? 'Estoque' : (getCustomerName(sale) || 'Cliente')}
                    </h3>
                    <div className="flex flex-col gap-1 mt-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div data-guide-anchor="sales.cardDataPedido" className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-black tracking-widest">
                          <Calendar size={10} strokeWidth={3} />
                          {format(sale.date, "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        <div data-guide-anchor="sales.cardNumeroPedido" className="flex items-center gap-1 text-[10px] text-indigo-500 dark:text-indigo-400 font-black tracking-widest">
                          <Hash size={10} strokeWidth={3} />
                          {sale.orderNumber}
                        </div>
                        {sale.saleDestination === 'STOCK' && (
                          <span data-guide-anchor="sales.cardBadgeEstoque" className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-white uppercase tracking-widest">
                            Estoque
                          </span>
                        )}
                        {sale.sellerName && (
                          <span data-guide-anchor="sales.cardBadgeVendedor" className="text-[10px] font-black px-2 py-0.5 rounded-md leading-none tracking-widest bg-indigo-600 text-white shadow-sm">
                            {sale.sellerName}
                          </span>
                        )}
                      </div>
                      {sale.deliveryStatus === 'DELIVERED' && sale.deliveredAt && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-black tracking-widest" data-guide-anchor="sales.dataEntrega">
                          <Truck size={10} strokeWidth={3} />
                          Entregue em {format(sale.deliveredAt, "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSale(sale)}
                    title="Ver Detalhes do Pedido"
                    aria-label={`Ver detalhes do pedido de ${getCustomerName(sale) || 'Cliente'}`}
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
                      <span data-guide-anchor="sales.cardBadgeNC" className="text-[8px] font-black px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 border border-rose-200 dark:border-rose-800 uppercase tracking-widest">
                        NC
                      </span>
                    )}
                    {sale.status === SaleStatus.CANCELLED ? (
                      <span data-guide-anchor="sales.cardBadgeStatus" className="text-[10px] font-black px-2 py-1 rounded-lg leading-none tracking-widest bg-slate-900 text-rose-500 border border-rose-500/20 shadow-sm">
                        Cancelada
                      </span>
                    ) : sale.status === SaleStatus.QUOTE ? (
                      <span data-guide-anchor="sales.cardBadgeStatus" className="text-[10px] font-black px-2 py-1 rounded-lg leading-none tracking-widest shadow-sm bg-orange-500 text-white">
                        Orçamento
                      </span>
                    ) : sale.status === SaleStatus.CONFIRMED ? (
                      <span data-guide-anchor="sales.cardBadgeStatus" className="text-[10px] font-black px-2 py-1 rounded-lg leading-none tracking-widest shadow-sm bg-sky-500 text-white">
                        Pedido
                      </span>
                    ) : (
                      <span data-guide-anchor="sales.cardBadgeStatus" className="text-[10px] font-black px-2 py-1 rounded-lg leading-none tracking-widest shadow-sm bg-[#7c3aed] text-white">
                        Venda
                      </span>
                    )}
                    {sale.deliveryStatus === 'DELIVERED' && sale.status !== SaleStatus.CANCELLED && (
                      <span data-guide-anchor="sales.cardBadgeEntregue" className="text-[8px] font-black px-2 py-1 rounded-lg leading-none tracking-widest shadow-sm bg-emerald-500 text-white uppercase flex items-center gap-1">
                        <Truck size={10} /> Pedido Entregue
                      </span>
                    )}
                  </div>

                  {/* Badges de estoque + expand */}
                  <div className="flex flex-row flex-wrap items-center justify-end gap-1.5 shrink-0">

                  {/* Badge Caixas prontas — quantidade já separada pro pedido. Antes contava o
                      número de documentos StockLot reservados (`reservedLotsBySale`), que não
                      bate com a quantidade real: um lote nativo de produção não muda de status
                      quando é consumido pela separação manual (fica RESERVADO pra sempre), então
                      esse número ficava contando caixas já separadas + sobras órfãs de outros
                      lotes — daí números tipo "8 pronta(s)" num pedido com só 6 caixas ao todo.
                      Agora usa a mesma soma de `boxesSeparated` que já alimenta "Status de
                      Separação" logo abaixo, garantindo que os dois nunca divirjam. */}
                  {sale.status === SaleStatus.SALE && sale.deliveryStatus !== 'DELIVERED' && (() => {
                    const readyQty = sale.items.reduce((s, it) => s + getEffectiveSeparated(it), 0);
                    if (readyQty === 0) return null;
                    return (
                      <span data-guide-anchor="sales.cardBadgePronta" className="text-[8px] font-black px-2 py-1 rounded-lg leading-none tracking-widest bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400 flex items-center gap-1">
                        <PackageCheck size={9} /> {readyQty} pronta(s)
                      </span>
                    );
                  })()}
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
                  <div data-guide-anchor="sales.cardBannerProducao" className="w-full flex items-start gap-2 px-3 py-2 rounded-2xl bg-orange-50 dark:bg-orange-900/20 z-10">
                    <Factory size={14} className="text-orange-500 shrink-0 mt-0.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 leading-relaxed">
                      {label} · #{po.orderNumber}
                      {poLots.length > 0 && ` · Faltam ${pendingLots.length} de ${poLots.length} lote(s)`}
                    </span>
                  </div>
                );
              })()}

              {/* Popup: Detalhes de Entrega — aberto pelo botão dedicado no rodapé do card */}
              {modulesConfig.entregas && onUpdateDeliveryInfo && sale.status === SaleStatus.SALE && (
                <Modal
                  isOpen={deliveryDetailsSaleId === sale.id}
                  onClose={() => setDeliveryDetailsSaleId(null)}
                  title="Detalhes de Entrega"
                  icon={<Truck size={20} />}
                  maxWidth="max-w-lg"
                >
                  {(() => {
                    const selectedCarrier = carriers.find(c => c.id === sale.carrierId);
                    return (
                      <div className="flex flex-col gap-3">
                        {onSendToRouteBuilder && sale.deliveryStatus !== 'DELIVERED' && (
                          selectedCarrier
                            ? (selectedCarrier.address?.lat !== undefined && selectedCarrier.address?.lng !== undefined)
                            : (sale.deliveryAddress?.lat !== undefined && sale.deliveryAddress?.lng !== undefined)
                        ) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSentToDeliveryIds(prev => prev.includes(sale.id) ? prev : [...prev, sale.id]);
                              toast.warning('Enviado para a entrega');
                              setTimeout(() => {
                                setSentToDeliveryIds(prev => prev.filter(id => id !== sale.id));
                              }, 2500);
                            }}
                            data-guide-anchor="sales.entregaEnviar"
                            className={`flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                              sentToDeliveryIds.includes(sale.id)
                                ? 'bg-amber-500 text-white'
                                : 'bg-orange-500 text-white hover:bg-orange-600'
                            }`}
                          >
                            {sentToDeliveryIds.includes(sale.id) ? <Check size={14} /> : <Truck size={14} />}
                            {sentToDeliveryIds.includes(sale.id) ? 'Enviado' : 'Enviar para Entrega'}
                          </button>
                        )}

                        {carriers.length > 0 && (() => {
                          const isCarrierCardOpen = expandedCarrierCardIds.includes(sale.id);
                          return (
                            <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                              <button
                                type="button"
                                onClick={() => setExpandedCarrierCardIds(prev => prev.includes(sale.id) ? prev.filter(id => id !== sale.id) : [...prev, sale.id])}
                                data-guide-anchor="sales.entregaTransportadoraAccordion"
                                className="flex items-center justify-between gap-2 w-full px-4 py-3"
                              >
                                <span className="flex items-center gap-2">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-600'}`}>
                                    <Truck size={14} />
                                  </div>
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Transportadora</span>
                                </span>
                                {isCarrierCardOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                              </button>
                              {isCarrierCardOpen && (
                                <div className="flex flex-col gap-2 px-4 pb-4">
                                  <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-snug">
                                    Esse pedido vai ser entregue em alguma transportadora cadastrada?
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => { setCarrierSearch(''); setCarrierPickerTarget({ saleId: sale.id }); }}
                                    data-guide-anchor="sales.entregaEscolherTransportadora"
                                    className={`w-full h-11 flex items-center justify-between gap-2 ${isDarkMode ? 'bg-slate-800/50' : 'bg-white'} border-2 border-transparent hover:border-sky-500 rounded-xl px-4 text-sm font-bold transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                                  >
                                    <span className="truncate">{selectedCarrier ? selectedCarrier.name : 'Nenhuma — entregar pela rota do app'}</span>
                                    <ChevronDown size={16} className="text-slate-400 shrink-0" />
                                  </button>
                                  {selectedCarrier && (
                                    <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 px-1">
                                      Mostrando o endereço cadastrado da transportadora — edite o cadastro dela em Configurações de Entrega pra corrigir.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {(() => {
                          const isAddressCardOpen = expandedAddressCardIds.includes(sale.id);
                          return (
                            <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                              <button
                                type="button"
                                onClick={() => setExpandedAddressCardIds(prev => prev.includes(sale.id) ? prev.filter(id => id !== sale.id) : [...prev, sale.id])}
                                data-guide-anchor="sales.entregaEnderecoAccordion"
                                className="flex items-center justify-between gap-2 w-full px-4 py-3"
                              >
                                <span className="flex items-center gap-2">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-600'}`}>
                                    <MapPin size={14} />
                                  </div>
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Endereço de Entrega</span>
                                </span>
                                {isAddressCardOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                              </button>
                              {isAddressCardOpen && (
                                <div className="flex flex-col gap-2 px-4 pb-4">
                                  <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-snug">
                                    Esse pedido vai ser entregue em qual endereço? Caso não seja escolhida transportadora, escolha entre as três opções abaixo ou use o endereço cadastrado do cliente.
                                  </p>
                                  {!selectedCarrier && (() => {
                                    const customer = people.find(p => p.id === sale.customerId);
                                    if (!customer?.defaultDeliveryAddress) return null;
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => onUpdateDeliveryInfo(sale.id, { deliveryAddress: customer.defaultDeliveryAddress })}
                                        data-guide-anchor="sales.entregaUsarCadastrado"
                                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all bg-orange-500 text-white hover:bg-orange-600"
                                      >
                                        <MapPin size={12} />
                                        Usar Endereço Cadastrado do Cliente
                                      </button>
                                    );
                                  })()}
                                  <DeliveryAddressForm
                                    isDarkMode={isDarkMode}
                                    address={selectedCarrier ? selectedCarrier.address : sale.deliveryAddress}
                                    priority={sale.deliveryPriority}
                                    locked={!!selectedCarrier}
                                    onChange={(address) => selectedCarrier ? undefined : onUpdateDeliveryInfo(sale.id, { deliveryAddress: address })}
                                    onPriorityChange={(priority) => onUpdateDeliveryInfo(sale.id, { deliveryPriority: priority })}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {(() => {
                          const items = sale.deliveryItems || [];
                          const preview = items.length > 0 ? formatDeliveryItemsList(items, products) : '';
                          return (
                            <button
                              type="button"
                              onClick={() => setItemsPickerTarget({ saleId: sale.id })}
                              data-guide-anchor="sales.entregaItensPicker"
                              className={`flex items-center gap-2 px-4 py-3 rounded-2xl transition-all active:scale-[0.98] ${items.length > 0 ? `text-left border ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-100'}` : `justify-center border-2 border-dashed ${isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800/50' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}`}
                            >
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                                {items.length > 0 ? <Pencil size={14} /> : <ListChecks size={14} />}
                              </div>
                              <span className={items.length > 0 ? 'min-w-0 flex-1' : ''}>
                                {items.length > 0 ? (
                                  <>
                                    <span className={`block text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Itens na Entrega ({items.length})</span>
                                    <span className={`block text-[10px] font-bold truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{preview}</span>
                                  </>
                                ) : (
                                  <span className="text-[10px] font-black uppercase tracking-widest">Itens na Entrega (opcional)</span>
                                )}
                              </span>
                            </button>
                          );
                        })()}

                        {/* Endereços de entrega adicionais — mesmo pedido, produtos a entregar em
                            mais de um lugar (Sale.additionalDeliveryAddresses). Cada um pode ir
                            direto ou por uma transportadora própria, independente do principal
                            (inclusive quando o PRÓPRIO principal também vai por transportadora). */}
                        {(sale.additionalDeliveryAddresses || []).map((entry, idx) => {
                          const entryCarrier = entry.carrierId ? carriers.find(c => c.id === entry.carrierId) : undefined;
                          return (
                            <div key={idx} className={`flex flex-col gap-2 p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                  <MapPin size={13} className="text-rose-500 shrink-0" />
                                  Endereço {idx + 2}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = (sale.additionalDeliveryAddresses || []).filter((_, i) => i !== idx);
                                    onUpdateDeliveryInfo(sale.id, { additionalDeliveryAddresses: next });
                                  }}
                                  title="Remover este endereço"
                                  data-guide-anchor="sales.entregaRemoverAdicional"
                                  className={`p-1.5 rounded-lg transition-all ${isDarkMode ? 'text-slate-500 hover:text-rose-400 hover:bg-rose-900/20' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'}`}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                              {carriers.length > 0 && (
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Transportadora deste endereço</label>
                                  <button
                                    type="button"
                                    onClick={() => { setCarrierSearch(''); setCarrierPickerTarget({ saleId: sale.id, addressIndex: idx }); }}
                                    data-guide-anchor="sales.entregaEscolherTransportadora"
                                    className={`w-full h-11 flex items-center justify-between gap-2 ${isDarkMode ? 'bg-slate-800/50' : 'bg-white'} border-2 border-transparent hover:border-sky-500 rounded-xl px-4 text-sm font-bold transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                                  >
                                    <span className="truncate">{entryCarrier ? entryCarrier.name : 'Nenhuma — entregar pela rota do app'}</span>
                                    <ChevronDown size={16} className="text-slate-400 shrink-0" />
                                  </button>
                                </div>
                              )}
                              {entryCarrier && (
                                <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 px-1">
                                  Mostrando o endereço cadastrado da transportadora — edite o cadastro dela em Configurações de Entrega pra corrigir.
                                </p>
                              )}
                              <DeliveryAddressForm
                                isDarkMode={isDarkMode}
                                address={entryCarrier ? entryCarrier.address : entry.address}
                                fieldsExpanded
                                locked={!!entryCarrier}
                                onChange={(address) => {
                                  if (entryCarrier) return;
                                  const next = [...(sale.additionalDeliveryAddresses || [])];
                                  next[idx] = { ...entry, address };
                                  onUpdateDeliveryInfo(sale.id, { additionalDeliveryAddresses: next });
                                }}
                              />
                              {(() => {
                                const items = entry.deliveryItems || [];
                                const preview = items.length > 0 ? formatDeliveryItemsList(items, products) : '';
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setItemsPickerTarget({ saleId: sale.id, addressIndex: idx })}
                                    data-guide-anchor="sales.entregaItensPicker"
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98] ${items.length > 0 ? `text-left ${isDarkMode ? 'bg-amber-900/20 border border-amber-700' : 'bg-amber-50 border border-amber-200'}` : `justify-center border-2 border-dashed ${isDarkMode ? 'border-amber-800 text-amber-400 hover:bg-amber-900/20' : 'border-amber-200 text-amber-700 hover:bg-amber-50'}`}`}
                                  >
                                    {items.length > 0 ? <Pencil size={13} className="shrink-0 text-amber-600" /> : <ListChecks size={13} className="shrink-0" />}
                                    <span className={items.length > 0 ? 'min-w-0 flex-1' : ''}>
                                      {items.length > 0 ? (
                                        <>
                                          <span className="block text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Itens na Entrega ({items.length})</span>
                                          <span className={`block text-[10px] font-bold truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{preview}</span>
                                        </>
                                      ) : (
                                        <span className="text-[10px] font-black uppercase tracking-widest">Itens na Entrega (opcional)</span>
                                      )}
                                    </span>
                                  </button>
                                );
                              })()}
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => onUpdateDeliveryInfo(sale.id, { additionalDeliveryAddresses: [...(sale.additionalDeliveryAddresses || []), { address: {} }] })}
                          data-guide-anchor="sales.entregaAdicionarPonto"
                          className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-[0.98]"
                        >
                          <Plus size={13} />
                          Adicionar Outro Ponto de Entrega no Pedido
                        </button>
                      </div>
                    );
                  })()}
                </Modal>
              )}

              {showSeparationInfo && sale.status === SaleStatus.SALE && (() => {
                const totalOrdered = sale.items.reduce((s, it) => s + it.quantity, 0);
                const totalSeparated = sale.items.reduce((s, it) => s + getEffectiveSeparated(it), 0);
                const allSeparated = totalSeparated >= totalOrdered;

                // Se o pedido estiver totalmente separado, exibe o aviso de sucesso (visível mesmo colapsado)
                if (allSeparated && sale.deliveryStatus !== 'DELIVERED') {
                  const unit = sale.items.some(it => it.saleType === SaleType.WHOLESALE) ? 'cx' : 'pares';
                  return (
                    <div data-guide-anchor="sales.cardSeparacaoOk" className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between gap-3 z-10">
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
                    <div data-guide-anchor="sales.cardSeparacaoOk" className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-2.5 z-10">
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
                      <div data-guide-anchor="sales.cardAvisoEstoque" className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 flex items-start gap-2.5">
                        <span className="relative shrink-0 mt-0.5">
                          <Clock size={16} className="text-amber-500" />
                          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
                          </span>
                        </span>
                        <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 leading-snug">
                          <span className="font-black uppercase tracking-widest text-[8px] block mb-1">Aviso de Estoque</span>
                          Aguardando estoque para este pedido. ({stockStatus.ready}/{stockStatus.total})
                        </p>
                      </div>

                      <div data-guide-anchor="sales.cardProdutosDisponiveis" className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-2.5">
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
                  <div data-guide-anchor="sales.cardAvisoEstoque" className="mb-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5 z-10">
                    <span className="relative shrink-0 mt-0.5">
                      <Clock size={16} className="text-slate-400" />
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
                      </span>
                    </span>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-snug">
                      <span className="font-black uppercase tracking-widest text-[8px] block mb-1">Aviso de Estoque</span>
                      Aguardando estoque para este pedido. ({stockStatus.ready}/{stockStatus.total})
                    </p>
                  </div>
                );
              })()}

              {/* Financial Summary Card */}
              <div data-guide-anchor="sales.cardResumoFinanceiro" className={`flex items-center justify-between px-4 py-2.5 rounded-2xl z-10 ${
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
                {modulesConfig.entregas && onUpdateDeliveryInfo && sale.status === SaleStatus.SALE && (
                  <button
                    type="button"
                    onClick={() => setDeliveryDetailsSaleId(sale.id)}
                    data-guide-anchor="sales.cardDetalhesEntrega"
                    className={`flex items-center justify-between gap-2 w-full px-4 py-3 rounded-2xl transition-all active:scale-[0.99] ${isDarkMode ? 'bg-sky-900/10 border border-sky-800/30 hover:bg-sky-900/20' : 'bg-sky-50/60 border border-sky-100 hover:bg-sky-100/60'}`}
                  >
                    <span className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-600'}`}>
                        <Truck size={14} />
                      </div>
                      <span className="text-[10px] font-black text-sky-700 dark:text-sky-400 uppercase tracking-widest">
                        Detalhes de Entrega
                      </span>
                    </span>
                    <ChevronRight size={16} className="text-sky-500 shrink-0" />
                  </button>
                )}
                <div className="flex items-center w-full gap-2">
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

                  {/* Actions Group (Floating Island) — agora ocupa a largura toda do card
                      (flex-1 + justify-between), em vez de ficar compacta numa pontinha. */}
                  <div className="flex flex-1 flex-nowrap items-center justify-between gap-1 p-1 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                    {/* View Order Button */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setItemsPopupSale(sale); }}
                      data-guide-anchor="sales.acaoVerItens"
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
                            data-guide-anchor="sales.acaoExpedirReverter"
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
                          data-guide-anchor="sales.acaoExpedirReverter"
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
                      data-guide-anchor="sales.acaoVerResumo"
                      className="w-8 h-8 flex items-center justify-center bg-amber-50 dark:bg-amber-500/10 text-amber-500 rounded-full active:scale-90 transition-all"
                      title="Visualizar resumo do pedido"
                    >
                      <FileText size={14} />
                    </button>

                    {/* Export/Print Button — abre popup de escolha: Exportar Venda ou
                        Imprimir Venda (Etiquetas / Impressão Padrão) */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenPrintChoice(e, sale)}
                      data-guide-anchor="sales.acaoExportarImprimir"
                      className="w-8 h-8 flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-full active:scale-90 transition-all"
                      title="Exportar ou Imprimir"
                    >
                      <Printer size={14} />
                    </button>

                    {/* Payment/Dollar Button */}
                    {sale.status !== SaleStatus.QUOTE && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPaymentModalMode(totalPaid >= sale.total ? 'HISTORY' : 'PAYMENT');
                          setPaymentModalSale(sale);
                        }}
                        data-guide-anchor="sales.acaoPagamento"
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
                          data-guide-anchor="sales.acaoEditar"
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
                        data-guide-anchor="sales.acaoMaisOpcoes"
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
                              <button onClick={() => setActiveMenuId(null)} title="Fechar" aria-label="Fechar" data-guide-anchor="sales.maisOpcoesFechar" className={`p-2 rounded-xl ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}>
                                <X size={20} strokeWidth={2.5} />
                              </button>
                            </div>
                            <div className="p-3 flex flex-col gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCopyMessage(sale); setActiveMenuId(null); }}
                                data-guide-anchor="sales.optCopiarTexto"
                                className={`w-full px-4 py-3.5 rounded-2xl text-[11px] font-black tracking-widest flex items-center gap-3 transition-all active:scale-[0.98] border active:translate-y-[2px] ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white shadow-[0_3px_0_0_rgba(0,0,0,0.5)] active:shadow-[0_1px_0_0_rgba(0,0,0,0.5)]' : 'bg-slate-50 border-slate-200 text-slate-900 shadow-[0_3px_0_0_rgba(148,163,184,0.55)] active:shadow-[0_1px_0_0_rgba(148,163,184,0.55)]'}`}
                              >
                                <Copy size={16} className="text-sky-500" /> Copiar Texto
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
                                      data-guide-anchor="sales.optSepararCaixas"
                                      className={`w-full px-4 py-3.5 rounded-2xl text-[11px] font-black tracking-widest flex items-center gap-3 transition-all active:scale-[0.98] border active:translate-y-[2px] ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white shadow-[0_3px_0_0_rgba(0,0,0,0.5)] active:shadow-[0_1px_0_0_rgba(0,0,0,0.5)]' : 'bg-slate-50 border-slate-200 text-slate-900 shadow-[0_3px_0_0_rgba(148,163,184,0.55)] active:shadow-[0_1px_0_0_rgba(148,163,184,0.55)]'}`}
                                    >
                                      <Boxes size={16} className="text-indigo-500" /> Separar Caixas
                                    </button>
                                  );
                                })()
                              )}
                              {sale.status === SaleStatus.SALE && sale.deliveryStatus !== 'DELIVERED' && (reservedLotsBySale.get(sale.id) || []).length > 0 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleReleaseClick(sale); setActiveMenuId(null); }}
                                  data-guide-anchor="sales.optExpedirReservado"
                                  className={`w-full px-4 py-3.5 rounded-2xl text-[11px] font-black tracking-widest flex items-center gap-3 transition-all active:scale-[0.98] border active:translate-y-[2px] ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white shadow-[0_3px_0_0_rgba(0,0,0,0.5)] active:shadow-[0_1px_0_0_rgba(0,0,0,0.5)]' : 'bg-slate-50 border-slate-200 text-slate-900 shadow-[0_3px_0_0_rgba(148,163,184,0.55)] active:shadow-[0_1px_0_0_rgba(148,163,184,0.55)]'}`}
                                >
                                  <Truck size={16} className="text-emerald-600" /> Expedir / Baixar
                                </button>
                              )}
                              {sale.status === SaleStatus.SALE && getUnfulfilledStockStatus(sale)?.ready ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setExpediteSale(sale); setActiveMenuId(null); }}
                                  data-guide-anchor="sales.optExpedirEstoque"
                                  className={`w-full px-4 py-3.5 rounded-2xl text-[11px] font-black tracking-widest flex items-center gap-3 transition-all active:scale-[0.98] border active:translate-y-[2px] ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white shadow-[0_3px_0_0_rgba(0,0,0,0.5)] active:shadow-[0_1px_0_0_rgba(0,0,0,0.5)]' : 'bg-slate-50 border-slate-200 text-slate-900 shadow-[0_3px_0_0_rgba(148,163,184,0.55)] active:shadow-[0_1px_0_0_rgba(148,163,184,0.55)]'}`}
                                >
                                  <Truck size={16} className="text-emerald-600" /> Expedir / Baixar
                                </button>
                              ) : null}
                              {sale.status === SaleStatus.SALE && (sale.deliveryStatus === 'DELIVERED' || sale.items.some(it => it.fulfilled === true) || sale.items.some(it => (it.boxesSeparated || 0) > 0)) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setRevertSale(sale); setActiveMenuId(null); }}
                                  data-guide-anchor="sales.optReverterExpedicao"
                                  className={`w-full px-4 py-3.5 rounded-2xl text-[11px] font-black tracking-widest flex items-center gap-3 transition-all active:scale-[0.98] border active:translate-y-[2px] ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white shadow-[0_3px_0_0_rgba(0,0,0,0.5)] active:shadow-[0_1px_0_0_rgba(0,0,0,0.5)]' : 'bg-slate-50 border-slate-200 text-slate-900 shadow-[0_3px_0_0_rgba(148,163,184,0.55)] active:shadow-[0_1px_0_0_rgba(148,163,184,0.55)]'}`}
                                >
                                  <RotateCcw size={16} className="text-amber-500" /> Reverter Expedição
                                </button>
                              )}
                              {/* Ação única: cancela, devolve os produtos ao estoque, estorna o
                                  financeiro e apaga o pedido — tudo num passo, com uma confirmação
                                  só (ver handleCancelSaleWithRevert em App.tsx). */}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSaleToDelete(sale.id); setActiveMenuId(null); }}
                                data-guide-anchor="sales.optCancelarPedido"
                                className={`w-full px-4 py-3.5 rounded-2xl text-[11px] font-black tracking-widest flex items-center gap-3 transition-all active:scale-[0.98] border active:translate-y-[2px] ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white shadow-[0_3px_0_0_rgba(0,0,0,0.5)] active:shadow-[0_1px_0_0_rgba(0,0,0,0.5)]' : 'bg-slate-50 border-slate-200 text-slate-900 shadow-[0_3px_0_0_rgba(148,163,184,0.55)] active:shadow-[0_1px_0_0_rgba(148,163,184,0.55)]'}`}
                              >
                                <Ban size={16} className="text-orange-500" /> Cancelar Pedido
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
                    data-guide-anchor="sales.confirmarVenda"
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
        onClick={() => setAddChoiceOpen(true)}
        data-guide-anchor="sales.novoPedido"
        className="fixed bottom-24 right-6 w-16 h-16 bg-slate-900 dark:bg-indigo-600 text-white rounded-[2rem] shadow-2xl flex items-center justify-center active:scale-95 transition-all z-50 border-4 border-white dark:border-slate-800"
      >
         <Plus size={36} strokeWidth={2.5} />
      </button>

      {/* Popup — escolha ao tocar no "+": Cadastrar do zero × Colar texto digitado */}
      {addChoiceOpen && (
        <div
          className="fixed inset-0 z-[65000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setAddChoiceOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-xs rounded-[2rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className={`flex items-center justify-between px-6 py-5 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`} data-guide-anchor="sales.novoPedidoEscolha">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Plus size={18} />
                </div>
                <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Nova Venda</h3>
              </div>
              <button type="button" onClick={() => setAddChoiceOpen(false)} className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`} aria-label="Fechar">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex flex-col gap-2 p-6">
              <button
                type="button"
                onClick={() => { setAddChoiceOpen(false); onAdd(); }}
                data-guide-anchor="sales.optCadastrarPedido"
                className={`flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.98] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Plus size={18} />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Cadastrar Pedido</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-0.5">Preencher o pedido do zero</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setAddChoiceOpen(false); setPasteOrderAutoOcr(false); setPasteOrderOpen(true); }}
                data-guide-anchor="sales.optColarPedido"
                className={`flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.98] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ClipboardPaste size={18} />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Colar Pedido Digitado</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-0.5">Cole um texto com os itens e revise antes de criar</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setAddChoiceOpen(false); setPasteOrderAutoOcr(true); setPasteOrderOpen(true); }}
                data-guide-anchor="sales.optColarPrint"
                className={`flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.98] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <ImageIcon2 size={18} />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Colar Print</p>
                  <p className="text-[9px] font-bold text-slate-400 mt-0.5">Cole um print copiado — reconhece o texto e revise antes de criar</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <PasteOrderModal
        isOpen={pasteOrderOpen}
        onClose={() => { setPasteOrderOpen(false); setPasteOrderInitialText(''); }}
        products={products}
        grids={grids}
        people={people}
        orderTextAliases={orderTextAliases}
        isDarkMode={isDarkMode}
        autoOcr={pasteOrderAutoOcr}
        initialText={pasteOrderInitialText}
        onConfirm={(draft) => { setPasteOrderOpen(false); setPasteOrderInitialText(''); onOpenPastedOrder(draft); }}
      />

      {/* Modals */}
      <StockEntryHistoryModal
        isOpen={showEntryHistoryModal}
        onClose={() => setShowEntryHistoryModal(false)}
        stockLots={stockLots}
        isDarkMode={isDarkMode}
        onPreviewRevertStockLot={onPreviewRevertStockLot}
        onRevertStockLot={onRevertStockLot}
      />

      <StockDiagnosticsModal
        isOpen={showDiagnosticsModal}
        onClose={() => setShowDiagnosticsModal(false)}
        isDarkMode={isDarkMode}
        products={products}
        stockLots={stockLots}
        lots={lots}
        sales={sales}
        onFixPkgAllocations={onFixPkgAllocations}
        onReconcileSeparationGroup={onReconcileSeparationGroup}
        onApplyStockDuplicateFix={onApplyStockDuplicateFix}
        onRepairOrphanedFinalizedKeys={onRepairOrphanedFinalizedKeys}
        onApplyUndercreditFix={onApplyUndercreditFix}
        onReleaseOrphanedLot={onReleaseOrphanedLot}
      />

      <ExportNoteModal
        isOpen={exportModal.isOpen}
        onClose={() => setExportModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmExport}
        onPreview={handlePreviewExport}
        isDarkMode={isDarkMode}
        showThumbnailsToggle={showThumbnails}
        initialFormat={exportModal.format}
        title={exportModal.sale?.status === SaleStatus.QUOTE ? "Exportar Orçamento" : exportModal.sale?.status === SaleStatus.CONFIRMED ? "Exportar Pedido" : "Exportar Venda"}
      />

      {/* Popup — Exportar Venda × Imprimir Venda (Etiquetas / Impressão Padrão) */}
      {printChoice && (
        <div
          className="fixed inset-0 z-[65000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setPrintChoice(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-xs rounded-[2rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className={`flex items-center justify-between px-6 py-5 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Printer size={18} />
                </div>
                <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {printChoice.step === 'main' ? 'Exportar ou Imprimir' : 'Imprimir Venda'}
                </h3>
              </div>
              <button type="button" onClick={() => setPrintChoice(null)} data-guide-anchor="sales.printChoiceFechar" className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`} aria-label="Fechar">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex flex-col gap-2 p-6">
              {printChoice.step === 'main' ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => { const s = printChoice.sale; setPrintChoice(null); handleOpenExport(e, s, 'jpg'); }}
                    data-guide-anchor="sales.printChoiceExportar"
                    className={`flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.98] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Share2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Exportar Venda</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">Gerar PDF/JPG com observação e miniaturas</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintChoice(prev => prev ? { ...prev, step: 'print-sub' } : prev)}
                    data-guide-anchor="sales.printChoiceImprimir"
                    className={`flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.98] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Printer size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Imprimir Venda</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">Etiquetas ou impressão padrão do pedido</p>
                    </div>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { const s = printChoice.sale; setPrintChoice(null); handleOpenSaleLabels(s); }}
                    data-guide-anchor="sales.printChoiceEtiquetas"
                    className={`flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.98] ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                      <Tag size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Etiquetas</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">Uma etiqueta por caixa (Atacado) ou tamanho (Varejo)</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={isQuickPrinting}
                    onClick={() => handleStandardPrint(printChoice.sale)}
                    data-guide-anchor="sales.printChoiceImpressaoPadrao"
                    className={`flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.98] disabled:opacity-60 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{isQuickPrinting ? 'Gerando…' : 'Impressão Padrão'}</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">PDF do pedido pronto pra imprimir</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintChoice(prev => prev ? { ...prev, step: 'main' } : prev)}
                    data-guide-anchor="sales.printChoiceVoltar"
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center py-2"
                  >
                    ← Voltar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <LabelProfilePickerModal
        isOpen={labelProfilePicker.open}
        onClose={() => setLabelProfilePicker({ open: false, items: [] })}
        isDarkMode={isDarkMode}
        labelFiles={labelFiles}
        sectors={sectors}
        onSelectProfile={handlePickLabelProfile}
        onCreateNew={handleCreateNewLabelProfile}
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
                    {getCustomerName(s) || 'Cliente'}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">#{s.orderNumber}</p>
                </div>
                <button
                  type="button"
                  title="Fechar"
                  onClick={() => setSimplePreviewSale(null)}
                  data-guide-anchor="sales.resumoFechar"
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
                  const photoUrl = variation?.photoUrl || product?.photoUrl;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between px-5 py-3.5 gap-3 ${!isLast ? (isDarkMode ? 'border-b border-slate-800' : 'border-b border-slate-50') : ''}`}
                    >
                      {showThumbnails && (
                        photoUrl ? (
                          <img src={photoUrl} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0 border border-black/5" />
                        ) : (
                          <div className={`w-10 h-10 rounded-xl shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                        )
                      )}
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
                  data-guide-anchor="sales.resumoWhatsapp"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all hover:bg-emerald-700 mb-2"
                >
                  <MessageSquare size={16} /> Compartilhar via WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setKeepExportSale(s)}
                  data-guide-anchor="sales.exportarKeep"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-amber-400 text-amber-950 shadow-lg shadow-amber-400/30 active:scale-[0.98] transition-all hover:bg-amber-300"
                >
                  <Lightbulb size={16} /> Exportar para Google Keep
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Popup — Configuração do "Exportar para Google Keep" — escolhe quais campos entram na
          nota antes de abrir o share sheet nativo (Keep aparece lá se estiver instalado). */}
      {keepExportSale && (() => {
        const fieldOptions: { key: keyof typeof keepFields; label: string }[] = [
          { key: 'reference', label: 'Referência' },
          { key: 'nameColor', label: 'Nome e Cor' },
          { key: 'boxQty', label: 'Quantidade de Caixas' },
          { key: 'unitValue', label: 'Valor Unitário' },
          { key: 'totalValue', label: 'Valor Total' },
        ];
        return (
          <div
            className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setKeepExportSale(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-sm max-h-[85vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
            >
              <div className="px-5 py-4 flex items-center justify-between bg-amber-400">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-amber-950/10 text-amber-950 flex items-center justify-center shrink-0">
                    <Lightbulb size={18} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-950/70">Exportar para</p>
                    <p className="text-[15px] font-black leading-tight text-amber-950">Google Keep</p>
                  </div>
                </div>
                <button
                  type="button"
                  title="Fechar"
                  onClick={() => setKeepExportSale(null)}
                  data-guide-anchor="sales.keepFechar"
                  className="p-2 rounded-xl text-amber-950/70 hover:bg-amber-950/10 transition-all"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>

              <div data-guide-anchor="sales.keepChecklist" className="overflow-y-auto flex-1 p-5 flex flex-col gap-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">O que incluir na nota</p>
                {fieldOptions.map(opt => {
                  const isChecked = keepFields[opt.key];
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setKeepFields(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
                        isChecked
                          ? isDarkMode ? 'bg-amber-400/10 border-amber-400/40' : 'bg-amber-50 border-amber-200'
                          : isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-2 ${
                        isChecked ? 'bg-amber-400 border-amber-400 text-amber-950' : isDarkMode ? 'border-slate-600 text-transparent' : 'border-slate-300 text-transparent'
                      }`}>
                        <Check size={13} strokeWidth={3.5} />
                      </span>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className={`px-5 py-4 border-t shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <button
                  type="button"
                  onClick={handleExportKeep}
                  data-guide-anchor="sales.keepExportar"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-amber-400 text-amber-950 shadow-lg shadow-amber-400/30 active:scale-[0.98] transition-all hover:bg-amber-300"
                >
                  <Lightbulb size={16} /> Exportar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Popup — Itens da Venda + Separação Inline */}
      {itemsPopupSale && (() => {
        const s = itemsPopupSale;
        const separationRows = buildSeparationRows(s, products, stockLots);

        const rows = s.items.map((item, idx) => {
          const product = getProductInfo(item.productId);
          const variation = getVariationInfo(item.productId, item.variationId);
          const unit = item.saleType === SaleType.WHOLESALE ? 'cx' : 'pares';
          const lineTotal = item.price * item.quantity;
          const sepRow = separationRows[idx];

          return {
            idx, item, product, variation, unit, lineTotal,
            separated: sepRow.separated, remaining: sepRow.remaining, hasReserved: sepRow.hasReserved,
            itemLots: sepRow.itemLots, stockAvailable: sepRow.stockAvailable, maxSeparable: sepRow.maxSeparable,
          };
        });

        const isDelivered = s.deliveryStatus === 'DELIVERED';
        const pendingRows = rows.filter(r => r.remaining > 0);
        const doneRows = rows.filter(r => r.remaining === 0);

        const setQty = (idx: number, max: number, val: number) => {
          if (isDelivered) return;
          setPopupSepQtys(prev => ({ ...prev, [idx]: Math.min(max, Math.max(0, val)) }));
        };

        const setRevertQty = (idx: number, max: number, val: number) => {
          if (isDelivered) return;
          setPopupRevertQtys(prev => ({ ...prev, [idx]: Math.min(max, Math.max(0, val)) }));
        };

        const toApply = rows
          .map(r => ({ itemIdx: r.idx, quantity: popupSepQtys[r.idx] || 0 }))
          .filter(x => x.quantity > 0);
        const totalToSeparate = toApply.reduce((s, x) => s + x.quantity, 0);

        const toRevert = rows
          .map(r => ({ itemIdx: r.idx, quantity: popupRevertQtys[r.idx] || 0 }))
          .filter(x => x.quantity > 0);
        const totalToRevert = toRevert.reduce((s, x) => s + x.quantity, 0);

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

        const handleConfirmPartialRevert = async () => {
          if (toRevert.length === 0) return;
          setProcessingPopupSep(true);
          try {
            await onPartialRevertSeparacao(s.id, toRevert);
            setItemsPopupSale(null);
          } finally {
            setProcessingPopupSep(false);
          }
        };

        // "Alterar Produtos" — dados derivados do formulário de adicionar produto e handlers
        // de remover/adicionar/salvar. Ver onAlterarProdutosVenda (App.tsx) e SaleItemChange.
        const alterarProduct = products.find(p => p.id === addProductId);
        const alterarVariation = alterarProduct?.variations.find(v => v.id === addVariationId);
        const alterarSaleTypes = alterarProduct
          ? ((alterarProduct.saleTypes && alterarProduct.saleTypes.length > 0) ? alterarProduct.saleTypes : [alterarProduct.type])
          : [];
        const alterarGrid = alterarProduct ? grids.find(g => g.id === alterarProduct.defaultGridId) : undefined;
        const canAddDraft = !!alterarProduct && !!alterarVariation && (addSaleType === SaleType.WHOLESALE || !!addSize) && addQty > 0;

        const handleAddDraft = () => {
          if (!canAddDraft || !alterarProduct || !alterarVariation) return;
          setAlterarAddDrafts(prev => [...prev, {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            productId: alterarProduct.id,
            variationId: alterarVariation.id,
            saleType: addSaleType,
            size: addSaleType === SaleType.RETAIL ? addSize : undefined,
            quantity: addQty,
            price: addPrice,
            unitPrice: addSaleType === SaleType.WHOLESALE ? (alterarProduct.unitSalePrice || undefined) : undefined,
          }]);
          setAddProductId(''); setAddVariationId(''); setAddSaleType(SaleType.RETAIL); setAddSize(''); setAddQty(1); setAddPrice(0);
        };

        const handleRemoveDraft = (id: string) => {
          setAlterarAddDrafts(prev => prev.filter(d => d.id !== id));
        };

        const alterarRemoveList = rows
          .map(r => ({ itemIdx: r.idx, quantity: alterarRemoveQtys[r.idx] || 0 }))
          .filter(x => x.quantity > 0);
        const totalAlterarRemove = alterarRemoveList.reduce((sum, x) => sum + x.quantity, 0);
        const totalAlterarAdd = alterarAddDrafts.reduce((sum, d) => sum + d.quantity, 0);
        const canSaveAlterar = alterarRemoveList.length > 0 || alterarAddDrafts.length > 0;
        const alterarDeltaParts = [
          totalAlterarRemove > 0 ? `-${totalAlterarRemove}` : null,
          totalAlterarAdd > 0 ? `+${totalAlterarAdd}` : null,
        ].filter(Boolean);
        const alterarSaveLabel = alterarDeltaParts.length > 0 ? `Salvar Alterações (${alterarDeltaParts.join(' / ')})` : 'Salvar Alterações';

        const handleConfirmAlterar = async () => {
          if (!canSaveAlterar) return;
          setProcessingAlterar(true);
          try {
            const changes: SaleItemChange[] = [
              ...alterarRemoveList.map(r => ({ type: 'remove' as const, itemIdx: r.itemIdx, quantity: r.quantity })),
              ...alterarAddDrafts.map(d => ({
                type: 'add' as const, productId: d.productId, variationId: d.variationId, saleType: d.saleType,
                size: d.size, quantity: d.quantity, price: d.price, unitPrice: d.unitPrice,
              })),
            ];
            await onAlterarProdutosVenda(s.id, changes);
            setEditProdutosMode(false);
            setAlterarRemoveQtys({});
            setAlterarAddDrafts([]);
          } finally {
            setProcessingAlterar(false);
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
                    <p className={`text-base font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>#{s.orderNumber} · {getCustomerName(s)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setItemsPopupSale(null)}
                  title="Fechar"
                  aria-label="Fechar"
                  data-guide-anchor="sales.popupFechar"
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
              {editProdutosMode ? (
                <>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Remover itens do pedido</p>
                  {rows.map(row => {
                    const removeQty = alterarRemoveQtys[row.idx] ?? 0;
                    const willRelease = Math.min(removeQty, row.separated);
                    return (
                      <div key={row.idx} className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-start gap-2 min-w-0">
                            {showSeparationThumbnails && (() => {
                              const photo = row.variation?.photoUrl || row.product?.photoUrl;
                              return (
                                <div
                                  onClick={photo ? (e) => { e.stopPropagation(); setZoomedThumbnail(photo); } : undefined}
                                  className={`w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border ${photo ? 'cursor-zoom-in' : ''} ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
                                >
                                  {photo
                                    ? <img src={photo} alt={row.product?.name} className="w-full h-full object-cover" />
                                    : <Package size={16} className="text-slate-300" />}
                                </div>
                              );
                            })()}
                            <div className="min-w-0">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-black uppercase tracking-wider">
                                {row.product?.reference && `${row.product.reference} · `}{row.product?.name}
                                {row.variation?.colorName && ` · ${row.variation.colorName}`}
                              </span>
                              {row.item.size && <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Nº {row.item.size}</p>}
                            </div>
                          </div>
                          <span className="text-[11px] font-black text-slate-400 shrink-0">{row.item.quantity} {row.unit}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 shrink-0">Remover</span>
                          <div data-guide-anchor="sales.alterarRemoverStepper" className={`flex items-center flex-1 rounded-xl p-1 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}>
                            <button
                              type="button"
                              onClick={() => setAlterarRemoveQtys(prev => ({ ...prev, [row.idx]: Math.max(0, removeQty - 1) }))}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}
                              aria-label="Diminuir"
                            >
                              <Minus size={13} strokeWidth={3} />
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={row.item.quantity}
                              value={removeQty === 0 ? '' : removeQty}
                              onFocus={e => e.currentTarget.select()}
                              onChange={e => setAlterarRemoveQtys(prev => ({ ...prev, [row.idx]: Math.min(row.item.quantity, Math.max(0, parseInt(e.target.value) || 0)) }))}
                              className={`w-full text-center border-none p-0 text-sm font-black focus:ring-0 bg-transparent ${removeQty > 0 ? 'text-rose-500' : (isDarkMode ? 'text-slate-500' : 'text-slate-300')}`}
                              aria-label="Quantidade a remover"
                            />
                            <button
                              type="button"
                              onClick={() => setAlterarRemoveQtys(prev => ({ ...prev, [row.idx]: Math.min(row.item.quantity, removeQty + 1) }))}
                              className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center active:scale-90 transition-all"
                              aria-label="Aumentar"
                            >
                              <Plus size={13} strokeWidth={3} />
                            </button>
                          </div>
                          <span className="text-[9px] font-black uppercase text-slate-400 w-8 text-center shrink-0">{row.unit}</span>
                        </div>
                        {willRelease > 0 && (
                          <p className="text-[9px] font-bold text-emerald-500 mt-2">Libera {willRelease} {row.unit} de volta pro estoque disponível</p>
                        )}
                      </div>
                    );
                  })}

                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1 pt-2">Adicionar produto</p>
                  <div className={`p-3 rounded-2xl border flex flex-col gap-2.5 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <select
                      value={addProductId}
                      onChange={e => {
                        const pid = e.target.value;
                        setAddProductId(pid);
                        setAddVariationId('');
                        setAddSize('');
                        const p = products.find(pp => pp.id === pid);
                        const types = p ? ((p.saleTypes && p.saleTypes.length > 0) ? p.saleTypes : [p.type]) : [SaleType.RETAIL];
                        setAddSaleType(types[0]);
                      }}
                      data-guide-anchor="sales.alterarSelectProduto"
                      className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold outline-none border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    >
                      <option value="">Selecione um produto...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.reference} · {p.name}</option>)}
                    </select>

                    {alterarProduct && (
                      <select
                        value={addVariationId}
                        onChange={e => setAddVariationId(e.target.value)}
                        data-guide-anchor="sales.alterarSelectCor"
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold outline-none border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                      >
                        <option value="">Selecione a cor...</option>
                        {alterarProduct.variations.map(v => <option key={v.id} value={v.id}>{v.colorName}</option>)}
                      </select>
                    )}

                    {alterarProduct && alterarSaleTypes.length > 1 && (
                      <div data-guide-anchor="sales.alterarTipoVenda" className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => { setAddSaleType(SaleType.RETAIL); setAddSize(''); }}
                          className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${addSaleType === SaleType.RETAIL ? 'bg-indigo-600 text-white border-indigo-600' : (isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600')}`}
                        >
                          Varejo
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddSaleType(SaleType.WHOLESALE); setAddSize(''); }}
                          className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${addSaleType === SaleType.WHOLESALE ? 'bg-indigo-600 text-white border-indigo-600' : (isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600')}`}
                        >
                          Atacado
                        </button>
                      </div>
                    )}

                    {alterarProduct && addSaleType === SaleType.RETAIL && alterarVariation && (
                      <select
                        value={addSize}
                        onChange={e => setAddSize(e.target.value)}
                        data-guide-anchor="sales.alterarSelectTamanho"
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold outline-none border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                      >
                        <option value="">Selecione o tamanho...</option>
                        {(alterarGrid?.sizes || []).map(sz => <option key={sz} value={sz}>{sz}</option>)}
                      </select>
                    )}

                    {alterarProduct && alterarVariation && (addSaleType === SaleType.WHOLESALE || addSize) && (
                      <div className="flex items-center gap-2">
                        <div data-guide-anchor="sales.alterarAdicionarQtd" className="flex flex-col shrink-0">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Qtd.</span>
                          <div className={`flex items-center rounded-xl p-1 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}>
                            <button type="button" onClick={() => setAddQty(q => Math.max(1, q - 1))} className={`w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`} aria-label="Diminuir quantidade">
                              <Minus size={12} strokeWidth={3} />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={addQty}
                              onFocus={e => e.currentTarget.select()}
                              onChange={e => setAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                              className={`w-10 text-center border-none p-0 text-sm font-black focus:ring-0 bg-transparent ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                            />
                            <button type="button" onClick={() => setAddQty(q => q + 1)} className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center active:scale-90" aria-label="Aumentar quantidade">
                              <Plus size={12} strokeWidth={3} />
                            </button>
                          </div>
                        </div>
                        <div data-guide-anchor="sales.alterarAdicionarPreco" className="flex-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Preço {addSaleType === SaleType.WHOLESALE ? '(grade)' : '(par)'}</span>
                          <div className={`flex items-center rounded-xl px-3 py-1.5 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}>
                            <span className="text-xs font-bold text-slate-400 mr-1">R$</span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={addPrice}
                              onFocus={e => e.currentTarget.select()}
                              onChange={e => setAddPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                              className={`w-full border-none p-0 text-sm font-black focus:ring-0 bg-transparent ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={!canAddDraft}
                      onClick={handleAddDraft}
                      data-guide-anchor="sales.alterarAdicionarLista"
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${!canAddDraft ? (isDarkMode ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-300 cursor-not-allowed') : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                    >
                      <Plus size={13} strokeWidth={3} /> Adicionar à lista
                    </button>
                  </div>

                  {alterarAddDrafts.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">A adicionar</p>
                      {alterarAddDrafts.map(d => {
                        const p = products.find(pp => pp.id === d.productId);
                        const v = p?.variations.find(vv => vv.id === d.variationId);
                        const unit = d.saleType === SaleType.WHOLESALE ? 'cx' : 'pares';
                        return (
                          <div key={d.id} className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${isDarkMode ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-emerald-50 border-emerald-100'}`}>
                            <div className="min-w-0">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-[9px] font-black uppercase tracking-wider">
                                {p?.reference && `${p.reference} · `}{p?.name}{v?.colorName && ` · ${v.colorName}`}
                              </span>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                                {d.size ? `Nº ${d.size} · ` : ''}{d.quantity} {unit} · R$ {d.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <button type="button" onClick={() => handleRemoveDraft(d.id)} data-guide-anchor="sales.alterarRemoverRascunho" className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 shrink-0" aria-label="Remover da lista">
                              <X size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
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
                        <div className="flex items-start gap-2 min-w-0">
                          {showSeparationThumbnails && (() => {
                            const photo = row.variation?.photoUrl || row.product?.photoUrl;
                            return (
                              <div
                                onClick={photo ? (e) => { e.stopPropagation(); setZoomedThumbnail(photo); } : undefined}
                                className={`w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border ${photo ? 'cursor-zoom-in' : ''} ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
                              >
                                {photo
                                  ? <img src={photo} alt={row.product?.name} className="w-full h-full object-cover" />
                                  : <Package size={16} className="text-slate-300" />}
                              </div>
                            );
                          })()}
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
                      <div data-guide-anchor="sales.popupSepararStepper" className={`flex items-center gap-2 ${isDelivered ? 'pointer-events-none' : ''}`}>
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
                {doneRows.map(row => {
                  const revertQty = popupRevertQtys[row.idx] ?? 0;
                  const isReverting = revertChoiceMode === 'partial' && revertQty > 0;
                  return (
                    <div
                      key={row.idx}
                      className={`p-3 rounded-2xl border transition-colors ${
                        isReverting
                          ? (isDarkMode ? 'bg-amber-900/10 border-amber-800/30' : 'bg-amber-50 border-amber-200')
                          : (isDarkMode ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-emerald-50 border-emerald-100')
                      }`}
                    >
                      {/* Header row */}
                      <div className={`flex items-center justify-between gap-2 ${revertChoiceMode === 'partial' ? 'mb-2' : ''}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {showSeparationThumbnails && (() => {
                            const photo = row.variation?.photoUrl || row.product?.photoUrl;
                            return (
                              <div
                                onClick={photo ? (e) => { e.stopPropagation(); setZoomedThumbnail(photo); } : undefined}
                                className={`w-9 h-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border ${photo ? 'cursor-zoom-in' : ''} ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
                              >
                                {photo
                                  ? <img src={photo} alt={row.product?.name} className="w-full h-full object-cover" />
                                  : <Package size={14} className="text-slate-300" />}
                              </div>
                            );
                          })()}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-[9px] font-black uppercase tracking-wider">
                                {row.product?.reference && `${row.product.reference} · `}{row.product?.name}
                                {row.variation?.colorName && ` · ${row.variation.colorName}`}
                              </span>
                            </div>
                            {row.item.size && (
                              <p className={`text-[9px] font-bold mt-0.5 uppercase tracking-widest ${isReverting ? 'text-amber-500' : 'text-emerald-500'}`}>
                                Nº {row.item.size}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isReverting
                            ? <RotateCcw size={13} className="text-amber-500" strokeWidth={2.5} />
                            : <CheckCircle2 size={13} className="text-emerald-500" strokeWidth={2.5} />
                          }
                          <span className={`text-[10px] font-black ${isReverting ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {isReverting ? `${row.separated - revertQty}/${row.item.quantity}` : `${row.separated}/${row.item.quantity}`} {row.unit}
                          </span>
                        </div>
                      </div>

                      {/* Partial revert stepper — only in partial mode */}
                      {revertChoiceMode === 'partial' && !isDelivered && (
                        <div className="flex items-center gap-2.5 mt-0.5">
                          <div className="flex flex-col shrink-0 min-w-[60px]">
                            <span className="text-[11px] font-black uppercase tracking-wide text-rose-500 leading-tight">Remover</span>
                            <span className="text-[10px] font-bold text-slate-400 leading-tight">{row.separated} separados</span>
                          </div>
                          <div className={`flex-1 flex items-center rounded-xl px-1 py-0.5 gap-0.5 ${isDarkMode ? 'bg-slate-900 border border-amber-800/30' : 'bg-white border border-amber-200'}`}>
                            <button
                              type="button"
                              onClick={() => setRevertQty(row.idx, row.separated, revertQty - 1)}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center active:scale-90 transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'}`}
                              aria-label="Diminuir reversão"
                            >
                              <Minus size={10} strokeWidth={3} />
                            </button>
                            <div className="flex-1 flex items-center justify-center gap-0.5">
                              <input
                                type="number"
                                min={0}
                                max={row.separated}
                                value={revertQty === 0 ? '' : revertQty}
                                onFocus={e => e.currentTarget.select()}
                                onChange={e => setRevertQty(row.idx, row.separated, parseInt(e.target.value) || 0)}
                                className={`w-7 text-center border-none p-0 text-sm font-black focus:ring-0 bg-transparent ${revertQty > 0 ? 'text-amber-500' : (isDarkMode ? 'text-slate-500' : 'text-slate-300')}`}
                                aria-label="Quantidade a reverter"
                              />
                              <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">{row.unit}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setRevertQty(row.idx, row.separated, revertQty + 1)}
                              className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center active:scale-90 transition-all"
                              aria-label="Aumentar reversão"
                            >
                              <Plus size={10} strokeWidth={3} />
                            </button>
                          </div>
                          {revertQty > 0 && (
                            <div className="shrink-0 text-right">
                              <span className="text-[11px] font-black text-amber-500 block leading-tight">{row.separated - revertQty}</span>
                              <span className="text-[9px] font-bold text-slate-400 block leading-tight">ficará</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Choice panel — appears when user clicked REVERTER */}
                {revertChoiceMode === 'choose' && doneRows.length > 0 && (
                  <div className={`mt-1 p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2.5 text-center">Escolha o tipo de reversão</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPopupRevertQtys({});
                          setRevertChoiceMode('partial');
                        }}
                        data-guide-anchor="sales.reverterParcial"
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all active:scale-95 ${isDarkMode ? 'bg-amber-900/20 border-amber-700/40 text-amber-400 hover:bg-amber-900/30' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}
                      >
                        <RotateCcw size={18} strokeWidth={2.5} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Parcial</span>
                        <span className="text-[8px] font-bold text-center leading-tight opacity-70">Escolho quanto remover por item</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRevertChoiceMode(null);
                          setItemsPopupSale(null);
                          setRevertSale(s);
                        }}
                        data-guide-anchor="sales.reverterTotal"
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all active:scale-95 ${isDarkMode ? 'bg-rose-900/20 border-rose-700/40 text-rose-400 hover:bg-rose-900/30' : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'}`}
                      >
                        <RotateCcw size={18} strokeWidth={2.5} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Total</span>
                        <span className="text-[8px] font-bold text-center leading-tight opacity-70">Reverter tudo que está separado</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* All done */}
                {pendingRows.length === 0 && doneRows.length > 0 && (
                  <div className="py-6 text-center px-4">
                    <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                      pedido totalmente separado, ja pode fazer a entrega/expedicao
                    </p>
                  </div>
                )}
                </>
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
                {editProdutosMode ? (
                  <div className={`flex items-stretch rounded-2xl overflow-hidden shadow-sm ${isDarkMode ? 'bg-slate-800' : 'bg-white border border-slate-200'}`}>
                    <button
                      type="button"
                      disabled={processingAlterar}
                      onClick={() => { setEditProdutosMode(false); setAlterarRemoveQtys({}); setAlterarAddDrafts([]); }}
                      data-guide-anchor="sales.alterarCancelar"
                      className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-r ${isDarkMode ? 'text-slate-300 hover:bg-slate-700 border-slate-700' : 'text-slate-600 hover:bg-slate-50 border-slate-100'}`}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={processingAlterar || !canSaveAlterar}
                      onClick={handleConfirmAlterar}
                      data-guide-anchor="sales.alterarSalvar"
                      className={`flex-[1.5] py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        !canSaveAlterar
                          ? (isDarkMode ? 'text-slate-600 bg-slate-800/50 cursor-not-allowed' : 'text-slate-300 bg-slate-50 cursor-not-allowed')
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      <Check size={14} strokeWidth={2.5} />
                      {processingAlterar ? '...' : alterarSaveLabel}
                    </button>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const hasSeparated = s.deliveryStatus === 'DELIVERED' || s.items.some(it => it.fulfilled === true || (it.boxesSeparated || 0) > 0);
                      if (revertChoiceMode === 'partial') {
                        // Modo parcial: [CANCELAR] [CONFIRMAR REVERSÃO (X)]
                        return (
                          <div className={`flex items-stretch rounded-2xl overflow-hidden shadow-sm ${isDarkMode ? 'bg-slate-800' : 'bg-white border border-slate-200'}`}>
                            <button
                              type="button"
                              disabled={processingPopupSep}
                              onClick={() => { setRevertChoiceMode(null); setPopupRevertQtys({}); }}
                              data-guide-anchor="sales.reverterParcialCancelar"
                              className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-r ${isDarkMode ? 'text-slate-300 hover:bg-slate-700 border-slate-700' : 'text-slate-600 hover:bg-slate-50 border-slate-100'}`}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={processingPopupSep || totalToRevert === 0}
                              onClick={handleConfirmPartialRevert}
                              data-guide-anchor="sales.reverterParcialConfirmar"
                              className={`flex-[1.5] py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                                totalToRevert === 0
                                  ? (isDarkMode ? 'text-slate-600 bg-slate-800/50 cursor-not-allowed' : 'text-slate-300 bg-slate-50 cursor-not-allowed')
                                  : 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                              }`}
                            >
                              <RotateCcw size={14} strokeWidth={2.5} />
                              {processingPopupSep ? '...' : `Reverter (${totalToRevert})`}
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className={`flex items-stretch rounded-2xl overflow-hidden shadow-sm ${isDarkMode ? 'bg-slate-800' : 'bg-white border border-slate-200'}`}>
                          <button
                            type="button"
                            onClick={() => { setItemsPopupSale(null); setRevertChoiceMode(null); }}
                            disabled={processingPopupSep}
                            data-guide-anchor="sales.popupFechar"
                            className={`flex-[0.8] py-4 text-[10px] font-black uppercase tracking-widest transition-all border-r ${isDarkMode ? 'text-slate-300 hover:bg-slate-700 border-slate-700' : 'text-slate-600 hover:bg-slate-50 border-slate-100'}`}
                          >
                            Fechar
                          </button>

                          <button
                            type="button"
                            disabled={processingPopupSep || !hasSeparated || isDelivered}
                            onClick={() => setRevertChoiceMode('choose')}
                            data-guide-anchor="sales.popupReverter"
                            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all border-r ${
                              !hasSeparated || isDelivered
                                ? (isDarkMode ? 'text-slate-600 border-slate-700 bg-slate-800/50 cursor-not-allowed' : 'text-slate-300 border-slate-100 bg-slate-50 cursor-not-allowed')
                                : revertChoiceMode === 'choose'
                                  ? (isDarkMode ? 'text-amber-400 bg-amber-500/10 border-amber-700/40' : 'text-amber-700 bg-amber-100 border-amber-200')
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
                            data-guide-anchor="sales.popupSeparar"
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

                    {revertChoiceMode === null && (
                      <button
                        type="button"
                        disabled={isDelivered || !!s.productionOrderId}
                        onClick={() => setEditProdutosMode(true)}
                        data-guide-anchor="sales.popupAlterarProdutos"
                        title={s.productionOrderId ? 'Pedido vinculado à produção — altere pela Ordem de Produção.' : (isDelivered ? 'Pedido entregue — não é possível alterar os produtos.' : 'Adicionar ou remover produtos deste pedido')}
                        className={`w-full mt-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 border-2 border-dashed ${
                          isDelivered || s.productionOrderId
                            ? (isDarkMode ? 'text-slate-600 border-slate-700 cursor-not-allowed' : 'text-slate-300 border-slate-200 cursor-not-allowed')
                            : (isDarkMode ? 'text-indigo-400 border-indigo-800/40 hover:bg-indigo-500/10' : 'text-indigo-600 border-indigo-200 hover:bg-indigo-50')
                        }`}
                      >
                        <Pencil size={13} strokeWidth={2.5} /> Alterar Produtos
                      </button>
                    )}
                  </>
                )}
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
                <button onClick={() => setExpediteSale(null)} title="Fechar" aria-label="Fechar" data-guide-anchor="sales.confirmFechar" className={`p-2 rounded-xl ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}><X size={20} strokeWidth={2.5} /></button>
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
                <button type="button" onClick={() => setExpediteSale(null)} disabled={processingExpedite} data-guide-anchor="sales.confirmCancelar" className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-slate-100'}`}>Cancelar</button>
                <button
                  type="button"
                  disabled={processingExpedite || !canConfirm}
                  onClick={async () => { setProcessingExpedite(true); try { await onExpediteSale(s.id); setExpediteSale(null); } finally { setProcessingExpedite(false); } }}
                  data-guide-anchor="sales.confirmarExpedicao"
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
                <button onClick={() => setRevertSale(null)} title="Fechar" aria-label="Fechar" data-guide-anchor="sales.confirmFechar" className={`p-2 rounded-xl ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}><X size={20} strokeWidth={2.5} /></button>
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
                <button type="button" onClick={() => setRevertSale(null)} disabled={processingExpedite} data-guide-anchor="sales.confirmCancelar" className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700 border border-slate-100'}`}>Cancelar</button>
                <button
                  type="button"
                  disabled={processingExpedite || (rows.length === 0 && s.deliveryStatus !== 'DELIVERED')}
                  onClick={async () => { setProcessingExpedite(true); try { await onRevertExpedition(s.id); setRevertSale(null); } finally { setProcessingExpedite(false); } }}
                  data-guide-anchor="sales.confirmarReversao"
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


      {/* Modal — Separação de Caixas */}
      <Modal
        isOpen={!!carrierPickerTarget}
        onClose={() => setCarrierPickerTarget(null)}
        title={carrierPickerTarget?.addressIndex !== undefined ? `Transportadora — Endereço ${carrierPickerTarget.addressIndex + 2}` : 'Escolher Transportadora'}
        icon={<Truck size={20} />}
        maxWidth="max-w-md"
        closeLabel="Fechar"
      >
        <div className="flex flex-col gap-3">
          <input
            type="text"
            autoFocus
            placeholder="Buscar transportadora..."
            value={carrierSearch}
            onChange={(e) => setCarrierSearch(e.target.value)}
            data-guide-anchor="sales.transportadoraBusca"
            className={`w-full h-12 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'} border-2 border-transparent focus:border-violet-500 rounded-2xl px-4 text-sm font-bold transition-all outline-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
          />
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto force-scrollbar">
            {(() => {
              const applyCarrier = (carrierId: string | null) => {
                if (!carrierPickerTarget) return;
                const { saleId, addressIndex } = carrierPickerTarget;
                if (addressIndex === undefined) {
                  onUpdateDeliveryInfo?.(saleId, { carrierId });
                } else {
                  const sale = sales.find(s => s.id === saleId);
                  const next = [...(sale?.additionalDeliveryAddresses || [])];
                  if (next[addressIndex]) {
                    next[addressIndex] = { ...next[addressIndex], carrierId: carrierId || undefined };
                  }
                  onUpdateDeliveryInfo?.(saleId, { additionalDeliveryAddresses: next });
                }
                setCarrierPickerTarget(null);
              };
              return (
                <>
                  <button
                    type="button"
                    onClick={() => applyCarrier(null)}
                    data-guide-anchor="sales.transportadoraOpcao"
                    className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-violet-700' : 'bg-white border-slate-100 hover:border-violet-200'}`}
                  >
                    <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Nenhuma — entregar pela rota do app</p>
                  </button>
                  {carriers.filter(c => c.name.toLowerCase().includes(carrierSearch.toLowerCase())).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => applyCarrier(c.id)}
                      data-guide-anchor="sales.transportadoraOpcao"
                      className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-violet-700' : 'bg-white border-slate-100 hover:border-violet-200'}`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${isDarkMode ? 'bg-violet-900/30 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
                        <Truck size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{c.name}</p>
                        {c.phone && <p className="text-[10px] font-bold text-slate-400">{c.phone}</p>}
                      </div>
                    </button>
                  ))}
                </>
              );
            })()}
            {carriers.filter(c => c.name.toLowerCase().includes(carrierSearch.toLowerCase())).length === 0 && (
              <p className="text-[10px] font-bold text-slate-400 text-center py-4">Nenhuma transportadora encontrada.</p>
            )}
          </div>
        </div>
      </Modal>

      {itemsPickerTarget && (() => {
        const sale = sales.find(s => s.id === itemsPickerTarget.saleId);
        if (!sale) return null;
        const { addressIndex } = itemsPickerTarget;
        const value = addressIndex === undefined
          ? sale.deliveryItems
          : sale.additionalDeliveryAddresses?.[addressIndex]?.deliveryItems;
        const noteValue = addressIndex === undefined
          ? sale.deliveryItemsNote
          : sale.additionalDeliveryAddresses?.[addressIndex]?.deliveryItemsNote;

        // Quanto de cada item já foi marcado em OUTROS endereços deste pedido (principal +
        // demais adicionais, exceto o que está sendo editado agora) — abate do disponível
        // aqui, pra não deixar escolher de novo o que já foi separado pra outra parada.
        const allocatedElsewhere: Record<string, number> = {};
        const addAllocations = (items: Sale['deliveryItems']) => {
          (items || []).forEach(it => {
            const k = deliveryItemKey(it);
            allocatedElsewhere[k] = (allocatedElsewhere[k] || 0) + it.quantity;
          });
        };
        if (addressIndex !== undefined) addAllocations(sale.deliveryItems);
        (sale.additionalDeliveryAddresses || []).forEach((entry, idx) => {
          if (idx === addressIndex) return;
          addAllocations(entry.deliveryItems);
        });

        return (
          <DeliveryItemsPicker
            isDarkMode={isDarkMode}
            isOpen
            onClose={() => setItemsPickerTarget(null)}
            title={addressIndex === undefined ? 'Itens na Entrega — Endereço Principal' : `Itens na Entrega — Endereço ${addressIndex + 2}`}
            saleItems={sale.items}
            products={products}
            value={value}
            noteValue={noteValue}
            allocatedElsewhere={allocatedElsewhere}
            onSave={(items, note) => {
              if (addressIndex === undefined) {
                onUpdateDeliveryInfo?.(sale.id, { deliveryItems: items, deliveryItemsNote: note || undefined });
              } else {
                const next = [...(sale.additionalDeliveryAddresses || [])];
                if (next[addressIndex]) {
                  next[addressIndex] = { ...next[addressIndex], deliveryItems: items, deliveryItemsNote: note || undefined };
                  onUpdateDeliveryInfo?.(sale.id, { additionalDeliveryAddresses: next });
                }
              }
            }}
          />
        );
      })()}

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

      {/* Miniatura ampliada — toque em qualquer lugar fecha (mesmo gesto que abriu). */}
      {zoomedThumbnail && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setZoomedThumbnail(null)}
        >
          <img
            src={zoomedThumbnail}
            alt=""
            className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}

    </div>
  );
}

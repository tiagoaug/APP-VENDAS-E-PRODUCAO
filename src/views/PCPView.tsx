import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Search, ChevronRight, Filter,
  Factory, LayoutDashboard, ListTodo,
  History, MoreVertical, ArrowRight,
  CheckCircle2, AlertCircle, AlertTriangle, Clock,
  ArrowUpRight, ArrowDownRight, Loader2,
  Settings2, Trash2, Edit3, Edit2, ClipboardList,
  Save, X, Info, Layers, Tag, Package, MinusCircle, CalendarClock, ShoppingCart,
  DollarSign, Hammer, FileText, CheckSquare, Scissors, Printer, Share2, Truck,
  QrCode, ScanLine, Hash, Lock, ChevronDown, List, ArrowLeftRight, MessageSquare, Eye, EyeOff,
  Footprints, Scale, Database, TrendingDown, Zap, Palette, Bell, Wrench, LayoutGrid
} from 'lucide-react';
import {
  ProductionLot, Product, Sector,
  FlowTag, Variation, ColorValue, ProductionOrder,
  ProductionConfigItem, SoleStockEntry, PalmilhaStockEntry, ViewType, PurchaseRequest, Grid,
  ServiceOrder, Person, Account, Category, Transaction, Purchase, PurchaseType, SectorNote,
  ProductionScreenType, StockLot, SaleType, SaleStatus
} from '../types';
import { computePalmilhaMapaReservations, computePalmilhaPendingOrders } from '../utils/palmilhaNeeds';
import { resolveSoleConsumption } from '../utils/soleNeeds';
import Modal from '../components/Modal';
import ComboBox from '../components/ComboBox';
import DateTimePicker from '../components/DateTimePicker';
import ScannerModal from '../components/ScannerModal';
import PrintOSModal from '../components/PrintOSModal';
import PrintLabelEditorModal from '../components/PrintLabelEditorModal';
import CompletedServiceOrdersModal from '../components/CompletedServiceOrdersModal';
import { Camera } from 'lucide-react';
import { labelService } from '../services/labelService';
import { printLotSheet, printOrderItemSheet, shareImage, sharePDF } from '../utils/pdfExport';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { resolveCorrectSectorForProduct, computeOSAdvanceOutcome, ensureSectorInRoute, ORDER_FINALIZED, getOrderEffectiveSector, getLotPendingSectorGroups, getSourceItemKey } from '../utils/productionRoute';
import { scannerService, SCAN_ERRORS } from '../services/scannerService';
import { financeService } from '../services/financeService';
import WebCameraScanner from '../components/WebCameraScanner';
import { Capacitor } from '@capacitor/core';
import { firebaseService } from '../services/firebaseService';
import { notificationService } from '../services/notificationService';
import { seedProductionLotSequence } from '../utils/sequenceSeeds';
import CuttingAreaPanel from '../components/CuttingProjectionPanel';
import { toast } from '../utils/toast';
import { generateId } from '../utils/id';
import { getMaterialStockForColor } from '../utils/materialStock';
import ExportNoteModal from '../components/ExportNoteModal';
import { generatePCPShareExport, PCPShareItem, sendPCPItemsToPrintStudio } from '../utils/pcpShareExport';
import { useStockLotDuplicates } from '../hooks/useStockLotDuplicates';
import StockDuplicateBanner from '../components/StockDuplicateBanner';
import StockDuplicateDiagnosticModal from '../components/StockDuplicateDiagnosticModal';

const getContrastingColor = (hexcolor: string) => {
  if (!hexcolor || hexcolor.length < 6) return '#ffffff';
  const cleanHex = hexcolor.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
};

// Converte a cor do setor (hex) num rgba() com a opacidade pedida — usado pro card
// "Atrelado à OS" assumir um tom bem claro da cor do PRÓPRIO setor (em vez de sempre
// laranja), tanto no claro quanto no escuro.
const hexToRgba = (hexcolor: string | undefined, alpha: number): string => {
  if (!hexcolor || hexcolor.length < 6) return `rgba(245,158,11,${alpha})`; // fallback: laranja
  const cleanHex = hexcolor.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Um modelo (pedido/produto) que compõe um mapa, com o setor que SEU PRÓPRIO roteiro
// de produção indica como próximo passo (`suggestedSectorId`) e o setor finalmente
// escolhido para ele (`chosenSectorId`) — igual ao sugerido por padrão, mas ajustável
// manualmente na confirmação de avanço de setor.
type LotAdvanceItem = {
  key: string;
  orderId: string;
  itemIdx?: number;
  variationId?: string;
  productId: string;
  productName: string;
  productReference?: string;
  colorName: string;
  qty: number;
  suggestedSectorId: string;
  suggestedSectorName: string;
  skippedSectorNames: string[];
  chosenSectorId: string;
  lotId?: string;
  saleType?: SaleType;
  siIdx?: number;
  fractionLabel?: string;
};

interface PCPViewProps {
  lots: ProductionLot[];
  products: Product[];
  grids?: Grid[];
  sectors: Sector[];
  flowTags: FlowTag[];
  colors: ColorValue[];
  productionOrders: ProductionOrder[];
  productionConfigs: ProductionConfigItem[];
  soleStock: SoleStockEntry[];
  palmilhaStock?: PalmilhaStockEntry[];
  purchaseRequests?: PurchaseRequest[];
  isDarkMode: boolean;
  onSaveLot: (lot: ProductionLot) => Promise<void>;
  onDeleteLot: (id: string) => Promise<void>;
  onDeleteProductionOrder?: (orderId: string) => Promise<void>;
  onNavigate: (view: ViewType, idOrParams?: any, maybeParams?: any) => void;
  onNavigateProduction?: (subScreen: ProductionScreenType) => void;
  onRequestPurchase?: (req: Omit<PurchaseRequest, 'id'>) => Promise<void>;
  onBack: () => void;
  userName?: string;
  initialTab?: 'monitor' | 'lots' | 'orders' | 'needs' | 'solados';
  initialSectorId?: string;
  initialLotId?: string;
  initialOrderId?: string;
  initialItemIdx?: string | number;
  initialScanNonce?: number;
  initialOSId?: string;
  initialOSNonce?: number;
  initialOpenMode?: 'modal' | 'sector';
  people?: Person[];
  accounts?: Account[];
  categories?: Category[];
  serviceOrders?: ServiceOrder[];
  purchases?: Purchase[];
  sales?: import('../types').Sale[];
  stockLots?: StockLot[];
  transactions?: Transaction[];
  appTheme?: 'light' | 'dark' | 'industrial' | 'ocean' | 'forest' | 'sunset' | 'midnight' | 'graphite' | 'hcWhite' | 'hcBlack' | 'hcIndustrial';
}

export default function PCPView({
  lots = [],
  products = [],
  grids = [],
  sectors = [],
  flowTags = [],
  colors = [],
  productionOrders = [],
  productionConfigs = [],
  soleStock = [],
  palmilhaStock = [],
  purchaseRequests = [],
  isDarkMode,
  onSaveLot,
  onDeleteLot,
  onDeleteProductionOrder,
  onNavigate,
  onNavigateProduction,
  onRequestPurchase,
  onBack,
  userName,
  initialTab = 'monitor',
  initialSectorId,
  initialLotId,
  initialOrderId,
  initialItemIdx,
  initialScanNonce,
  initialOSId,
  initialOSNonce,
  initialOpenMode,
  people = [],
  accounts = [],
  categories = [],
  serviceOrders = [],
  purchases = [],
  sales = [],
  stockLots = [],
  transactions = [],
  appTheme = 'light',
}: PCPViewProps) {
  // Temas de chrome neutro: Industrial e os de Alto Contraste removem o
  // degradê/borda coloridos dos cards de setor, deixando só os ícones coloridos.
  const isIndustrial = appTheme === 'industrial' || appTheme === 'hcWhite' || appTheme === 'hcBlack' || appTheme === 'hcIndustrial';
  // Setores ocultos (ver ProductionConfigView > Setores) somem de toda navegação/seleção
  // no PCP — mas continuam resolvíveis via `sectors.find(...)` pra exibir nome/cor de
  // lotes antigos que já passaram por eles.
  const visibleSectors = useMemo(() => sectors.filter(s => !s.hidden), [sectors]);
  const [activeTab, setActiveTab] = useState<'monitor' | 'lots' | 'orders' | 'needs' | 'solados'>(initialTab);
  const [mapBadgeBg, setMapBadgeBg] = useState(() => localStorage.getItem('pcp_map_badge_bg') || '#7c3aed');
  const [mapBadgeText, setMapBadgeText] = useState(() => localStorage.getItem('pcp_map_badge_text') || '#ffffff');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [colorPickerLot, setColorPickerLot] = useState<ProductionLot | null>(null);
  const updateLotColor = async (lot: ProductionLot, bg: string, text: string) => {
    await firebaseService.updateDocument('productionLots', lot.id, {
      metadata: {
        ...(lot as any).metadata,
        badgeColor: bg,
        badgeTextColor: text
      }
    });
    setColorPickerLot(prev => prev && prev.id === lot.id ? {
      ...prev,
      metadata: {
        ...(prev as any).metadata,
        badgeColor: bg,
        badgeTextColor: text
      }
    } : prev);
  };
  const updateMapBadgeColors = (bg: string, text: string) => {
    setMapBadgeBg(bg);
    setMapBadgeText(text);
    localStorage.setItem('pcp_map_badge_bg', bg);
    localStorage.setItem('pcp_map_badge_text', text);
  };
  // Cor do badge "REF COR" (ex: 310 BRANCO) e do texto do setor/status (ex: PREPARAÇÃO E
  // CONFERÊNCIA) exibidos nas fichas de Pedidos Vinculados — preferência local, igual à Cor do Mapa.
  const [productBadgeBg, setProductBadgeBg] = useState(() => localStorage.getItem('pcp_product_badge_bg') || '#000000');
  const [productBadgeText, setProductBadgeText] = useState(() => localStorage.getItem('pcp_product_badge_text') || '#ffffff');
  const [productBadgeBold, setProductBadgeBold] = useState(() => localStorage.getItem('pcp_product_badge_bold') !== 'false');
  const [productBadgeItalic, setProductBadgeItalic] = useState(() => localStorage.getItem('pcp_product_badge_italic') === 'true');
  const [sectorBadgeColor, setSectorBadgeColor] = useState(() => localStorage.getItem('pcp_sector_badge_color') || '#e11d48');
  const [sectorBadgeBold, setSectorBadgeBold] = useState(() => localStorage.getItem('pcp_sector_badge_bold') !== 'false');
  const [sectorBadgeItalic, setSectorBadgeItalic] = useState(() => localStorage.getItem('pcp_sector_badge_italic') === 'true');
  // Oculta o nome do setor/status nas fichas de Pedidos Vinculados — pedidos lá ficam
  // só com o badge de produto/cor, sem o texto de setor.
  const [hideSectorBadge, setHideSectorBadge] = useState(() => localStorage.getItem('pcp_hide_sector_badge') === 'true');
  // Badge da OS (cápsula com o número da OS no card) — independente do badge de Mapa,
  // já que uma OS pode reunir pedidos de mapas diferentes e não tem um único "lote" de origem.
  const [osBadgeBg, setOsBadgeBg] = useState(() => localStorage.getItem('pcp_os_badge_bg') || '#4f46e5');
  const [osBadgeText, setOsBadgeText] = useState(() => localStorage.getItem('pcp_os_badge_text') || '#ffffff');
  const [osBadgeBold, setOsBadgeBold] = useState(() => localStorage.getItem('pcp_os_badge_bold') !== 'false');
  const [osBadgeItalic, setOsBadgeItalic] = useState(() => localStorage.getItem('pcp_os_badge_italic') === 'true');
  const [providerBadgeBg, setProviderBadgeBg] = useState(() => localStorage.getItem('pcp_provider_badge_bg') || '#eab308');
  const [providerBadgeText, setProviderBadgeText] = useState(() => localStorage.getItem('pcp_provider_badge_text') || '#000000');
  const [providerBadgeBold, setProviderBadgeBold] = useState(() => localStorage.getItem('pcp_provider_badge_bold') !== 'false');
  const [providerBadgeItalic, setProviderBadgeItalic] = useState(() => localStorage.getItem('pcp_provider_badge_italic') === 'true');
  const [isBadgeColorPickerOpen, setIsBadgeColorPickerOpen] = useState(false);

  const updateProviderBadgeColors = (bg: string, text: string) => {
    setProviderBadgeBg(bg);
    setProviderBadgeText(text);
    localStorage.setItem('pcp_provider_badge_bg', bg);
    localStorage.setItem('pcp_provider_badge_text', text);
  };
  const toggleProviderBadgeBold = () => {
    const next = !providerBadgeBold;
    setProviderBadgeBold(next);
    localStorage.setItem('pcp_provider_badge_bold', String(next));
  };
  const toggleProviderBadgeItalic = () => {
    const next = !providerBadgeItalic;
    setProviderBadgeItalic(next);
    localStorage.setItem('pcp_provider_badge_italic', String(next));
  };

  const updateProductBadgeColors = (bg: string, text: string) => {
    setProductBadgeBg(bg);
    setProductBadgeText(text);
    localStorage.setItem('pcp_product_badge_bg', bg);
    localStorage.setItem('pcp_product_badge_text', text);
  };
  const toggleProductBadgeBold = () => {
    const next = !productBadgeBold;
    setProductBadgeBold(next);
    localStorage.setItem('pcp_product_badge_bold', String(next));
  };
  const toggleProductBadgeItalic = () => {
    const next = !productBadgeItalic;
    setProductBadgeItalic(next);
    localStorage.setItem('pcp_product_badge_italic', String(next));
  };
  const updateSectorBadgeColor = (color: string) => {
    setSectorBadgeColor(color);
    localStorage.setItem('pcp_sector_badge_color', color);
  };
  const toggleSectorBadgeBold = () => {
    const next = !sectorBadgeBold;
    setSectorBadgeBold(next);
    localStorage.setItem('pcp_sector_badge_bold', String(next));
  };
  const toggleSectorBadgeItalic = () => {
    const next = !sectorBadgeItalic;
    setSectorBadgeItalic(next);
    localStorage.setItem('pcp_sector_badge_italic', String(next));
  };
  const updateOSBadgeColors = (bg: string, text: string) => {
    setOsBadgeBg(bg);
    setOsBadgeText(text);
    localStorage.setItem('pcp_os_badge_bg', bg);
    localStorage.setItem('pcp_os_badge_text', text);
  };
  const toggleOSBadgeBold = () => {
    const next = !osBadgeBold;
    setOsBadgeBold(next);
    localStorage.setItem('pcp_os_badge_bold', String(next));
  };
  const toggleOSBadgeItalic = () => {
    const next = !osBadgeItalic;
    setOsBadgeItalic(next);
    localStorage.setItem('pcp_os_badge_italic', String(next));
  };
  const toggleHideSectorBadge = () => {
    const next = !hideSectorBadge;
    setHideSectorBadge(next);
    localStorage.setItem('pcp_hide_sector_badge', String(next));
  };

  // Barra de estatísticas do Monitor (Produção Total / Em Produção / Mapas Ativos /
  // Atrasos) — visibilidade geral e por cartão, preferência local por dispositivo.
  type StatsBarTile = 'total' | 'inProgress' | 'active' | 'delayed';
  const [statsBarHidden, setStatsBarHidden] = useState(() => localStorage.getItem('pcp_stats_bar_hidden') === 'true');
  const [statsBarTiles, setStatsBarTiles] = useState<Record<StatsBarTile, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pcp_stats_bar_tiles') || 'null');
      if (saved) return { total: true, inProgress: true, active: true, delayed: true, ...saved };
    } catch { /* ignore */ }
    return { total: true, inProgress: true, active: true, delayed: true };
  });
  const toggleStatsBarHidden = () => {
    const next = !statsBarHidden;
    setStatsBarHidden(next);
    localStorage.setItem('pcp_stats_bar_hidden', String(next));
  };
  const toggleStatsBarTile = (tile: StatsBarTile) => {
    setStatsBarTiles(prev => {
      const next = { ...prev, [tile]: !prev[tile] };
      localStorage.setItem('pcp_stats_bar_tiles', JSON.stringify(next));
      return next;
    });
  };
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [isRequestingBatch, setIsRequestingBatch] = useState(false);
  const [inTransitPopupItem, setInTransitPopupItem] = useState<any | null>(null);
  const [expandedNeedIds, setExpandedNeedIds] = useState<Set<string>>(new Set());
  const toggleNeedExpand = (id: string) => setExpandedNeedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());
  const toggleGroupCollapse = (gk: string) => setCollapsedGroupKeys(prev => {
    const next = new Set(prev);
    next.has(gk) ? next.delete(gk) : next.add(gk);
    return next;
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'finished' | 'urgent'>('active');
  const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<ProductionLot | null>(null);
  // Mantém o snapshot do mapa aberto no modal de detalhe em sincronia com a
  // lista viva `lots` — sem isso, atualizações externas (ex.: reversão de
  // histórico de estoque que devolve um pedido para Expedição) não refletem
  // no modal já aberto (badge "✓ finalizados" ficaria com a contagem antiga).
  useEffect(() => {
    if (!selectedLot) return;
    const fresh = lots.find(l => l.id === selectedLot.id);
    if (fresh && fresh !== selectedLot) setSelectedLot(fresh);
  }, [lots, selectedLot]);
  const [selectedLots, setSelectedLots] = useState<ProductionLot[]>([]);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showCompletedOSModal, setShowCompletedOSModal] = useState(false);
  // Diagnóstico temporário — encontra StockLots duplicados (mesmo lote/pedido/item
  // repetido várias vezes), causados pelo bug da baixa de Expedição sem proteção
  // contra repetição. Só pra localizar o excesso exato a corrigir; pode ser removido
  // depois que os números de estoque forem corrigidos.
  const [showStockDiagnosticModal, setShowStockDiagnosticModal] = useState(false);
  type StockRepairItem =
    | {
        kind: 'fix_boxqty'; selected: boolean;
        stockLotId: string; lotOrderNumber: string;
        productId: string; productName: string;
        variationId: string; variationName: string;
        sizeBreakdown: Record<string, number>; totalPairs: number;
        correctBoxQty: number; pairsPerBox: number;
        currentWholesaleStock: number; pkgId?: string; pkgName?: string;
      }
    | {
        kind: 'create_stocklot'; selected: boolean;
        lotId: string; lotOrderNumber: string;
        orderId: string; itemIdx?: number; fractionLabel?: string;
        productName: string; variationName: string; qty: number;
      };
  const [stockRepairModal, setStockRepairModal] = useState<{
    phase: 'preview' | 'running' | 'done';
    items: StockRepairItem[];
    appliedCount: number;
    errorMsg?: string;
  } | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(initialSectorId ?? null);
  const [isSectorSwitcherOpen, setIsSectorSwitcherOpen] = useState(false);
  const [showOSPedidosInline, setShowOSPedidosInline] = useState(true);
  const [showOSGradeInline, setShowOSGradeInline] = useState(false);
  // Override manual de setor: escapatória para quando o cálculo automático erra
  // (ex.: pedidos adiantados / mapas com modelos de roteiros diferentes fazem o
  // mapa "pular" setores). Permite escolher diretamente o setor de destino do mapa.
  const [manualSectorPicker, setManualSectorPicker] = useState<{ lot?: ProductionLot; fichas?: any[] } | null>(null);
  const [manualSectorMoveConfirm, setManualSectorMoveConfirm] = useState<{
    lot?: ProductionLot;
    fichas?: any[];
    targetSectorId: string;
    targetSectorName: string;
  } | null>(null);
  const [lotNotesPopup, setLotNotesPopup] = useState<{ lot: ProductionLot } | null>(null);
  // Confirmação de avanço de setor: mostra cada modelo do mapa, sua quantidade e o
  // setor para onde será movido (resolvido pelo roteiro de produção do PRÓPRIO modelo,
  // não o do mapa) — permitindo corrigir manualmente antes de confirmar. Existe porque
  // mapas que reúnem modelos com roteiros diferentes (ex.: 290 e 300) podem ter
  // destinos diferentes por modelo, e avançar o mapa inteiro "às cegas" pula setores
  // que alguns desses modelos deveriam passar (ex.: BORDADO).
  const [sectorChangeConfirm, setSectorChangeConfirm] = useState<{
    lot: ProductionLot;
    nextStatusId: string;
    notes: string;
    currentSectorId: string;
    items: LotAdvanceItem[];
    os?: ServiceOrder;
  } | null>(null);
  // Fila de confirmações pendentes quando uma única ação dispara o avanço de VÁRIOS
  // mapas de uma vez (ex.: "Concluir e baixar setor imediatamente" com múltiplos mapas
  // selecionados) — mostra o pop-up de confirmação um mapa por vez, em sequência.
  const [lotConfirmQueue, setLotConfirmQueue] = useState<{ lot: ProductionLot; nextStatusId: string; notes: string }[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSoleOrderModalOpen, setIsSoleOrderModalOpen] = useState(false);
  const [selectedSoleNeed, setSelectedSoleNeed] = useState<any>(null);
  const [extraSoleQty, setExtraSoleQty] = useState<Record<string, number>>({});
  // Necessidades de solado selecionadas para agrupar em uma única solicitação/compra
  const [selectedSoleNeedIds, setSelectedSoleNeedIds] = useState<Set<string>>(new Set());
  const toggleSoleNeedSelection = (id: string) => setSelectedSoleNeedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [isCuttingAreaOpen, setIsCuttingAreaOpen] = useState(false);

  // ── Centro de Compartilhamento PCP ──────────────────────────────────────────
  const [isPCPShareModalOpen, setIsPCPShareModalOpen] = useState(false);
  const [shareModal, setShareModal] = useState<{ isOpen: boolean; format: 'pdf' | 'jpg'; selectedItems: any[] }>({ isOpen: false, format: 'jpg', selectedItems: [] });
  const [shareReportType, setShareReportType] = useState<'sector' | 'lot' | 'customer'>('sector');
  const [shareFilterSectors, setShareFilterSectors] = useState<Set<string>>(new Set());
  const [shareFilterStatus, setShareFilterStatus] = useState<'active' | 'finished' | 'all'>('active');
  const [shareSearch, setShareSearch] = useState('');
  const [shareOpts, setShareOpts] = useState({ grades: true, totals: true, dates: true, refs: true, customer: true });
  const [shareGenerating, setShareGenerating] = useState<'pdf' | 'image' | null>(null);
  const [sharePreviewOpen, setSharePreviewOpen] = useState(false);

  // Service Order (OS) state declarations
  const [viewOSModal, setViewOSModal] = useState<{ isOpen: boolean; os: ServiceOrder | null; items: any[] }>({ isOpen: false, os: null, items: [] });
  // Mostra/oculta a grade de tamanhos de cada pedido no popup "Visualizar Pedidos da OS"
  const [showViewOSGrid, setShowViewOSGrid] = useState(true);
  const [osNumber, setOsNumber] = useState('');
  const [osType, setOsType] = useState<'INTERNAL' | 'OUTSOURCED'>('OUTSOURCED');
  const [osProviderId, setOsProviderId] = useState('');
  const [osProviderManualName, setOsProviderManualName] = useState('');
  const [osValuePerPair, setOsValuePerPair] = useState<number>(0);
  const [osNotes, setOsNotes] = useState('');
  const [osAccountId, setOsAccountId] = useState('');
  const [osCategoryId, setOsCategoryId] = useState('');
  const [osDirectComplete, setOsDirectComplete] = useState(false);
  const [osNaoContabil, setOsNaoContabil] = useState(false);
  const [isSavingOS, setIsSavingOS] = useState(false);
  const [isPrintOSModalOpen, setIsPrintOSModalOpen] = useState(false);
  const [printOSData, setPrintOSData] = useState<{ os: ServiceOrder; nextSectorName: string } | null>(null);
  const [labelModalProduct, setLabelModalProduct] = useState<import('../types').Product | null>(null);
  const [labelModalLot, setLabelModalLot] = useState<import('../types').ProductionLot | null>(null);
  const [labelModalSizeGrid, setLabelModalSizeGrid] = useState<string>('');
  const [labelModalBatchItems, setLabelModalBatchItems] = useState<{ product: import('../types').Product; variation: import('../types').Variation; sizeGrid: string; lotId?: string; orderId?: string; itemIdx?: number }[] | undefined>(undefined);
  const [selectedSourceItemKeys, setSelectedSourceItemKeys] = useState<Set<string>>(new Set());
  const [expandedSourceItems, setExpandedSourceItems] = useState<Set<string>>(new Set());
  const [scanFocusKey, setScanFocusKey] = useState<string | null>(null);
  const [highlightedOSId, setHighlightedOSId] = useState<string | null>(null);
  const [highlightedPedidoKey, setHighlightedPedidoKey] = useState<string | null>(null);
  const [sourceFilterModel, setSourceFilterModel] = useState<string>('');
  const [sourceFilterColor, setSourceFilterColor] = useState<string>('');
  const [osFeedback, setOsFeedback] = useState<{ osNumber: string; nextSector: string; action?: string; type?: 'pedido' | 'os'; details?: string[] } | null>(null);
  const [finalizeSelectedConfirm, setFinalizeSelectedConfirm] = useState<{
    lot: ProductionLot;
    items: LotAdvanceItem[];
    lines: string[];
    stockInfo?: Record<string, { destino: string; currentQty: number; addQty: number; projectedQty: number; unit: string }>;
    soleInfo?: {
      moldName: string;
      colorName: string;
      rows: { size: string; before: number; deducted: number; after: number }[];
      contributions?: { orderLabel: string; lotNumber: string; qty: number }[]
    }[];
    os?: ServiceOrder;
  } | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [mappingWarningModal, setMappingWarningModal] = useState<{ itemName: string; reason: string; diagnostic: string } | null>(null);
  const [mappingDiagnosticCopied, setMappingDiagnosticCopied] = useState(false);
  const [orderDeleteConfirm, setOrderDeleteConfirm] = useState<{ orderId: string; saleOrderNumber: string; hasSourcePurchase: boolean } | null>(null);
  const [repairLinkConfirm, setRepairLinkConfirm] = useState<{ order: ProductionOrder; sale: import('../types').Sale; orphanOrder?: ProductionOrder; orphanIsEmpty: boolean } | null>(null);
  const [moveSectorModal, setMoveSectorModal] = useState<{ lotId: string; items: { orderId: string; itemIdx?: number; productId?: string; variationId?: string }[]; qty: number; fromSectorId?: string; manual?: boolean } | null>(null);
  const [moveSectorTarget, setMoveSectorTarget] = useState<string>('');
  const [expandedOSIds, setExpandedOSIds] = useState<Set<string>>(new Set());
  const [expandedOSItemKeys, setExpandedOSItemKeys] = useState<Set<string>>(new Set());
  const [pendingOsSourceOrderIds, setPendingOsSourceOrderIds] = useState<string[]>([]);
  const [pendingOsSectorOverride, setPendingOsSectorOverride] = useState<string>('');
  const [pendingOsQuantityOverride, setPendingOsQuantityOverride] = useState<number | null>(null);
  // Painel de baixa de OS — substitui o antigo confirm() simples de "concluir OS".
  // Mostra todos os pedidos cobertos pela OS, cada um com checkbox (pronto p/ baixa,
  // marcado por padrão) e setor de destino pré-preenchido com a sugestão do roteiro
  // do próprio modelo — editável por pedido. Pedidos desmarcados permanecem na MESMA
  // OS (que segue PENDENTE só com eles); a OS só fecha/liquida quando o último
  // pedido for baixado.
  const [osBaixaPanel, setOsBaixaPanel] = useState<{
    os: ServiceOrder;
    items: (LotAdvanceItem & { included: boolean; lotId: string; currentSectorId: string })[];
  } | null>(null);
  // Painel de "Fracionar Pedido": divide uma ficha (sourceItem) em N sub-fichas
  // nomeadas A, B, C... cada uma virando uma ficha independente (própria OS, próprio
  // avanço de setor). A última fração da lista é sempre o "resto" — recalculada
  // automaticamente conforme as outras são editadas, então a soma nunca desbate.
  const [fractionModal, setFractionModal] = useState<{
    lot: ProductionLot;
    si: any;
    siIdx: number;
    product: Product;
    variation: Variation | undefined;
    baseSizes: Record<string, number>;
    gridConfig: Record<string, number> | null;
    gridMaxMultiplier: number;
    mode: 'grade' | 'free';
    rootKey: string;
    fractions: { label: string; multiplier: number; sizes: Record<string, number> }[];
  } | null>(null);
  // OS cujo popup de Observações/Lembrete está aberto — campos saíram do card pra
  // ocupar menos espaço, abrem num popup separado só quando precisa.
  const [osNotesPopup, setOsNotesPopup] = useState<ServiceOrder | null>(null);

  // QR Baixa modal state
  const [qrBaixaModal, setQrBaixaModal] = useState<{
    sectorId: string;
    preselectedOS: ServiceOrder | null;
  } | null>(null);
  const [qrBaixaManualCode, setQrBaixaManualCode] = useState('');
  const [qrBaixaScanning, setQrBaixaScanning] = useState(false);
  const [qrBaixaShowWebCamera, setQrBaixaShowWebCamera] = useState(false);
  const isWebPlatform = Capacitor.getPlatform() === 'web';
  const [qrBaixaConfirm, setQrBaixaConfirm] = useState<{
    os: ServiceOrder;
    lot: import('../types').ProductionLot | null;
    nextSectorName: string;
  } | null>(null);
  const [sharePopupLotId, setSharePopupLotId] = useState<string | null>(null);
  const [isShareExporting, setIsShareExporting] = useState(false);
  const [sharePedidoPopupKey, setSharePedidoPopupKey] = useState<string | null>(null);
  const [isPedidoShareExporting, setIsPedidoShareExporting] = useState(false);

  // Filtered and organized data
  const filteredLots = useMemo(() => {
    let list = lots;

    if (statusFilter === 'active') list = list.filter(l => !l.finishedAt);
    if (statusFilter === 'finished') list = list.filter(l => !!l.finishedAt);
    if (statusFilter === 'urgent') list = list.filter(l => (l.prioridade === 'URGENTE' || l.prioridade === 'ALTA') && !l.finishedAt);

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(l => {
        const product = products.find(p => p.id === l.productId);
        const groupsStr = ((l as any).metadata?.groups || []).map((g: any) => g.productName).join(' ');
        const searchStr = `${l.orderNumber} ${product?.name} ${product?.reference} ${groupsStr}`.toLowerCase();
        return searchStr.includes(q);
      });
    }
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }, [lots, products, searchTerm, statusFilter]);

  const activeLots = useMemo(() => lots.filter(l => !l.finishedAt), [lots]);

  const activeOrdersCount = useMemo(() => {
    const orderIds = new Set<string>();
    activeLots.forEach(lot => {
      if (lot.productionOrderId) {
        orderIds.add(lot.productionOrderId);
      }
      const sourceItems = lot.metadata?.sourceItems || [];
      sourceItems.forEach((si: any) => {
        if (si.orderId) {
          orderIds.add(si.orderId);
        }
      });
    });
    return orderIds.size;
  }, [activeLots]);

  const activePendingPairs = useMemo(() => {
    let total = 0;
    activeLots.forEach(lot => {
      const sourceItems: any[] = (lot as any).metadata?.sourceItems
        || [{ orderId: lot.productionOrderId || lot.id, itemIdx: 0, qty: lot.quantity }];
      sourceItems.forEach(si => {
        const sec = getOrderEffectiveSector(lot, si.orderId, si);
        if (sec !== ORDER_FINALIZED && sectors.some(s => s.id === sec)) {
          total += si.qty || 0;
        }
      });
    });
    return total;
  }, [activeLots, sectors]);

  const filteredActiveLots = useMemo(() => {
    return filteredLots.filter(l => !l.finishedAt);
  }, [filteredLots]);

  const knives = useMemo(() => productionConfigs.filter(c => c.type === 'TOOL'), [productionConfigs]);

  const cuttingFlowTagId = useMemo(() => flowTags.find(t => t.isCuttingFlowTag)?.id, [flowTags]);
  const cuttingAreaLotsCount = useMemo(() => {
    if (!cuttingFlowTagId) return 0;
    return lots.filter(l => !l.finishedAt && l.currentStatusId === cuttingFlowTagId).length;
  }, [lots, cuttingFlowTagId]);

  // Sector Metrics for Dashboard
  const sectorMetrics = useMemo(() => {
    const metrics: Record<string, {
      totalPares: number;     // pares pendentes no setor (soma dos pedidos com setor efetivo aqui)
      lotsCount: number;
      delayedCount: number;
      urgentCount: number;
    }> = {};

    sectors.forEach(s => {
      metrics[s.id] = { totalPares: 0, lotsCount: 0, delayedCount: 0, urgentCount: 0 };
    });

    filteredActiveLots.forEach(lot => {
      const pendingGroups = getLotPendingSectorGroups(lot);
      const lastMove = (lot.history && lot.history.length > 0)
        ? lot.history[lot.history.length - 1]?.timestamp || lot.createdAt
        : lot.createdAt;
      const isDelayed = Date.now() - lastMove > 24 * 60 * 60 * 1000;
      const isUrgent = lot.prioridade === 'URGENTE' || lot.prioridade === 'ALTA';

      pendingGroups.forEach((items, sectorId) => {
        if (!metrics[sectorId]) return;
        metrics[sectorId].totalPares += items.reduce((s: number, si: any) => s + (si.qty || 0), 0);
        metrics[sectorId].lotsCount += 1;
        if (isDelayed) metrics[sectorId].delayedCount += 1;
        if (isUrgent) metrics[sectorId].urgentCount += 1;
      });
    });

    return metrics;
  }, [filteredActiveLots, sectors]);

  // WIP calculation per sector
  const wipPerSector = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredActiveLots.forEach(lot => {
      const sectorId = (lot.route && lot.route[lot.currentSectorIndex]) || 'UNKNOWN';
      counts[sectorId] = (counts[sectorId] || 0) + lot.quantity;
    });
    return counts;
  }, [filteredActiveLots]);

  // Filtro de origem das necessidades de materiais/solados: Mapas (lotes ativos), Pedidos (pendentes),
  // ambos, ou um subconjunto específico de pedidos escolhido manualmente pelo usuário
  const [needsSourceFilter, setNeedsSourceFilter] = useState<'LOTS' | 'ORDERS' | 'BOTH' | 'SELECTED_ORDERS'>('LOTS');
  const [selectedNeedsOrderIds, setSelectedNeedsOrderIds] = useState<Set<string>>(new Set());

  // Formata as fontes que originaram uma necessidade (mapas e/ou pedidos pendentes) em um único texto
  const formatContributingSources = (lots: string[], orders: string[]) => {
    const parts: string[] = [];
    if (lots.length > 0) parts.push(`${lots.length} ${lots.length === 1 ? 'Mapa' : 'Mapas'}: ${lots.join(', ')}`);
    if (orders.length > 0) parts.push(`${orders.length} ${orders.length === 1 ? 'Pedido' : 'Pedidos'}: ${orders.join(', ')}`);
    return parts.join(' · ');
  };

  // Chaves "orderId::itemIdx" de itens já vinculados a mapas ativos (não finalizados).
  // Mapas criados via seleção granular (handleBatchCreateLots) guardam metadata.sourceItems com o itemIdx exato;
  // mapas legados vinculados só por productionOrderId (sem metadata) assumem o pedido inteiro, pois foram
  // criados quando uma OP só podia gerar um mapa por vez.
  const linkedItemKeys = useMemo(() => {
    const keys = new Set<string>();
    lots.forEach(lot => {
      if (lot.finishedAt) return;
      const sourceItems: any[] = (lot as any).metadata?.sourceItems || [];
      if (sourceItems.length > 0) {
        sourceItems.forEach((si: any) => keys.add(`${si.orderId}::${si.itemIdx}`));
      } else if (lot.productionOrderId) {
        const order = productionOrders.find(o => o.id === lot.productionOrderId);
        (order?.items || []).forEach((_, idx) => keys.add(`${lot.productionOrderId}::${idx}`));
      }
    });
    return keys;
  }, [lots, productionOrders]);

  // State para seleção de itens de pedidos para formar um mapa (carrinho)
  const [selectedOrderItems, setSelectedOrderItems] = useState<{ orderId: string, itemIdx: number }[]>([]);

  // Seleção de fichas individuais para emissão de OS (key = `${lotId}::${orderId}::${idx}`)
  const [fichaSelection, setFichaSelection] = useState<Set<string>>(new Set());
  const [fichaListOpen, setFichaListOpen] = useState<Set<string>>(new Set()); // expanded lot keys
  const [fichaItemExpanded, setFichaItemExpanded] = useState<Set<string>>(new Set()); // expanded grade keys
  const [fichaFilters, setFichaFilters] = useState<Record<string, { model: string; color: string; search?: string; customerName?: string; providerName?: string }>>({});

  // Itens de pedidos pendentes decupados — granularidade por item, não por pedido.
  // Importante: um pedido com vários modelos pode ter alguns já incluídos em um mapa e outros não;
  // aqui mantemos visíveis apenas os itens que ainda não foram vinculados a nenhum mapa ativo,
  // mesmo que o pedido como um todo já esteja com status IN_PRODUCTION.
  const pendingItems = useMemo(() => {
    const items: any[] = [];
    productionOrders.forEach(order => {
      if (order.status === 'COMPLETED') return;
      order.items.forEach((item, idx) => {
        if (item.toProductionQty > 0 && !linkedItemKeys.has(`${order.id}::${idx}`)) {
          items.push({
            ...item,
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            deliveryDate: order.deliveryDate,
            saleOrderNumber: order.saleOrderNumber,
            saleId: order.saleId,
            orderCreatedAt: order.createdAt,
            itemIdx: idx,
            uniqueKey: `${order.id}-${idx}`
          });
        }
      });
    });
    return items;
  }, [productionOrders, linkedItemKeys]);

  // Pedidos que ainda têm pelo menos um item sem mapa — derivado de pendingItems para refletir a granularidade por item
  const pendingOrders = useMemo(() => {
    const orderIds = new Set(pendingItems.map(i => i.orderId));
    return productionOrders.filter(order => orderIds.has(order.id));
  }, [productionOrders, pendingItems]);

  // Núcleo do cálculo de necessidades — extraído em função para poder ser reaproveitado tanto
  // para a lista filtrada exibida (conforme needsSourceFilter) quanto para a checagem "existe
  // alguma necessidade em qualquer origem" usada no indicador da aba (independe do filtro ativo).
  const buildPurchaseNeeds = (sourceFilter: 'LOTS' | 'ORDERS' | 'BOTH' | 'SELECTED_ORDERS', selectedOrderIds?: Set<string>) => {
    const materialReqs: Record<string, {
      id: string;
      name: string;
      required: number;
      stock: number;
      minStock: number;
      unit: string;
      type: 'MATERIAL' | 'SOLE';
      materialId?: string;
      moldId?: string;
      colorId?: string;
      size?: string;
      sizeShortages?: Record<string, { required: number, stock: number }>;
      contributingLots: string[];
      contributingOrders: string[];
      mappingWarning?: string;
      mappingDiagnostic?: string;
      // Detalhamento por mapa/pedido: pares contribuídos e subtotal gerado para este material —
      // permite auditar visualmente a soma sem precisar abrir cada mapa manualmente.
      sourceBreakdown?: Record<string, { label: string; sourceType: 'LOT' | 'ORDER'; pairs: number; increment: number }>;
    }> = {};

    const sizeToGradeCache: Record<string, Record<string, string>> = {};
    const moldHasStockEntries: Record<string, boolean> = {};
    const getGradeForSize = (moldId: string, size: string): string | null => {
      const mId = String(moldId).trim();
      if (!sizeToGradeCache[mId]) {
        sizeToGradeCache[mId] = {};
        const entries = soleStock.filter(s => String(s.moldId).trim() === mId);
        moldHasStockEntries[mId] = entries.length > 0;
        entries.forEach(entry => {
          Object.keys(entry.stock).forEach(k => {
            const key = String(k).trim();
            if (key === 'pesagem' || key === 'total') return;
            const parts = key.split('-').map(p => Math.round(parseFloat(p.trim())));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
              for (let i = parts[0]; i <= parts[1]; i++) {
                sizeToGradeCache[mId][String(i)] = key;
              }
              // A própria faixa também é uma numeração válida: algumas matrizes são cadastradas com
              // "numerações" já em formato de grade (ex: metadata.sizes = ["38-39","40-41"]) — nesse
              // caso o Cruzamento de Numerações guarda a faixa como valor (ex: "38" -> "38-39"), e essa
              // faixa É a grade real cadastrada no estoque, não apenas um tamanho dentro dela.
              sizeToGradeCache[mId][key] = key;
            } else {
              sizeToGradeCache[mId][key] = key;
            }
          });
        });
      }
      if (sizeToGradeCache[mId][size]) return sizeToGradeCache[mId][size];
      // Se há estoque cadastrado para este molde mas o tamanho não pertence a nenhuma grade → ignora
      if (moldHasStockEntries[mId]) return null;
      // Sem estoque cadastrado ainda → fallback para não bloquear o fluxo
      return size;
    };

    // Unidades de consumo a processar — Mapas (lotes ativos) e/ou Pedidos pendentes (ainda sem mapa),
    // conforme o filtro de origem escolhido em "Necessidades".
    type ConsumptionUnit = {
      productId: string;
      variationId: string;
      pairs: Record<string, number>;
      quantity: number;
      gradesQty?: number;
      sourceType: 'LOT' | 'ORDER';
      sourceLabel: string;
    };
    const units: ConsumptionUnit[] = [];

    const includeLots = sourceFilter === 'LOTS' || sourceFilter === 'BOTH';
    const includeOrders = sourceFilter === 'ORDERS' || sourceFilter === 'BOTH' || sourceFilter === 'SELECTED_ORDERS';

    if (includeLots) {
      activeLots.forEach(lot => {
        // Para mapas multi-variação (variationId vazio), expande os grupos via metadata
        if (!lot.variationId && (lot as any).metadata?.groups?.length > 0) {
          const groupsMeta: any[] = (lot as any).metadata.groups;
          const totalGroupQty = groupsMeta.reduce((s: number, g: any) => s + (g.quantity || 0), 0);
          groupsMeta.forEach((g: any) => {
            const ratio = totalGroupQty > 0 ? (g.quantity || 0) / totalGroupQty : 0;
            let gPairs: Record<string, number>;
            if (g.pairs && Object.keys(g.pairs).length > 0) {
              // Novo: pares por grupo salvos corretamente
              gPairs = g.pairs;
            } else {
              // Legado: distribui lot.pairs proporcionalmente pelo peso do grupo
              gPairs = {};
              Object.entries(lot.pairs || {}).forEach(([size, qty]) => {
                const v = Math.round(Number(qty) * ratio);
                if (v > 0) gPairs[size] = v;
              });
            }
            // Cada grupo representa apenas a SUA fatia do mapa — usar o total do mapa (lot.quantity)
            // aqui faria cada grupo consumir materiais como se fosse o mapa inteiro (ex: 1 par de
            // etiqueta por par viraria N vezes o necessário, uma vez por grupo).
            const gQuantity = g.quantity || 0;
            const gGradesQty = lot.gradesQty ? Math.round(lot.gradesQty * ratio) : undefined;
            units.push({ productId: g.productId, variationId: g.variationId, pairs: gPairs, quantity: gQuantity, gradesQty: gGradesQty, sourceType: 'LOT', sourceLabel: lot.orderNumber });
          });
        } else {
          units.push({ productId: lot.productId, variationId: lot.variationId, pairs: lot.pairs || {}, quantity: lot.quantity, gradesQty: lot.gradesQty, sourceType: 'LOT', sourceLabel: lot.orderNumber });
        }
      });
    }

    if (includeOrders) {
      const itemsToProcess = sourceFilter === 'SELECTED_ORDERS' && selectedOrderIds?.size
        ? pendingItems.filter(item => selectedOrderIds.has(item.orderId))
        : pendingItems;
      itemsToProcess.forEach(item => {
        const pairs: Record<string, number> = {};
        Object.entries(item.sizes || {}).forEach(([size, s]: any) => {
          if (s?.toProduction > 0) pairs[size] = s.toProduction;
        });
        units.push({
          productId: item.productId,
          variationId: item.variationId,
          pairs,
          quantity: item.toProductionQty,
          gradesQty: undefined,
          sourceType: 'ORDER',
          sourceLabel: `#${item.saleOrderNumber || item.orderNumber}`
        });
      });
    }

    units.forEach(({ productId, variationId, pairs: groupPairs, quantity: unitQty, gradesQty: unitGradesQty, sourceType, sourceLabel: unitSourceLabel }) => {
      const groupProduct = products.find(p => p.id === productId);
      const variation = groupProduct?.variations.find(v => v.id === variationId);

      if (!variation) return;

      const registerContribution = (req: { contributingLots: string[]; contributingOrders: string[] }) => {
        if (sourceType === 'LOT') {
          if (!req.contributingLots.includes(unitSourceLabel)) req.contributingLots.push(unitSourceLabel);
        } else {
          if (!req.contributingOrders.includes(unitSourceLabel)) req.contributingOrders.push(unitSourceLabel);
        }
      };

      // 1. Regular Materials from ComponentConsumption
      variation.consumptions?.forEach(cons => {
        if (!cons.materialId) return;
        if (cons.ignoreColor && cons.colorId) {
          // ignoreColor means the piece is color-agnostic — keep single entry per material
        }
        const config = productionConfigs.find(c => c.id === cons.materialId);
        const colorKey = cons.ignoreColor ? '' : (String(cons.colorId || '').trim());
        const key = colorKey ? `${String(cons.materialId).trim()}_${colorKey}` : String(cons.materialId || '').trim();
        if (!key) return;
        if (!materialReqs[key]) {
          const colorName = colorKey ? (colors.find(c => c.id === cons.colorId)?.name || '') : '';
          // Materiais com cores cadastradas (metadata.colorIds) controlam o estoque por cor em
          // stockByColor — o campo metadata.stock genérico não reflete o estoque desta cor
          // específica e, se usado para todas as cores, mascara faltas reais (uma cor com saldo
          // alto "empresta" seu estoque para as outras na comparação required > stock).
          const stockForKey = getMaterialStockForColor(config, colorKey || undefined);
          materialReqs[key] = {
            id: key,
            materialId: cons.materialId,
            name: colorName ? `${config?.name || cons.name} — ${colorName}` : (config?.name || cons.name),
            required: 0,
            stock: stockForKey,
            minStock: config?.metadata?.minStock || 0,
            unit: productionConfigs.find(c => c.id === config?.metadata?.unitId)?.name || 'UN',
            type: 'MATERIAL',
            colorId: colorKey || undefined,
            contributingLots: [],
            contributingOrders: [],
            sourceBreakdown: {}
          };
        }
        // 'grade' basis: 1 caixa coletiva por grade, não por par
        // Retrocompat: se quantity < 1 (valor legado ex. 0.0833 = 1/12), infere pares/grade e converte
        let lotMultiplier: number;
        if (cons.consumptionBasis === 'grade') {
          if (unitGradesQty) {
            lotMultiplier = unitGradesQty;
          } else if (cons.quantity > 0 && cons.quantity < 1) {
            // legado: 0.0833 → pairsPerGrade ≈ round(1/0.0833) = 12
            const pairsPerGrade = Math.round(1 / cons.quantity);
            lotMultiplier = Math.round(unitQty / Math.max(1, pairsPerGrade));
          } else {
            // Tenta obter pairsPerGrade pelo grid do produto para maior precisão
            const gridId = groupProduct?.productionGridId || groupProduct?.defaultGridId;
            const grid = grids.find(gr => gr.id === gridId);
            const pairsPerGrade = grid ? Object.values(grid.configuration).reduce((a: number, b: number) => a + b, 0) : 12;
            lotMultiplier = Math.round(unitQty / Math.max(1, pairsPerGrade));
          }
        } else {
          lotMultiplier = unitQty;
        }
        // Para /grade sempre arredonda para inteiro (caixas são unidades inteiras)
        const reqIncrement = cons.consumptionBasis === 'grade'
          ? Math.round(lotMultiplier * (cons.quantity < 1 ? 1 : cons.quantity))
          : lotMultiplier * cons.quantity;
        materialReqs[key].required += reqIncrement;
        registerContribution(materialReqs[key]);

        // Acumula o detalhamento por mapa/pedido para permitir auditoria visual da conta.
        const sbKey = `${sourceType}_${unitSourceLabel}`;
        if (!materialReqs[key].sourceBreakdown) materialReqs[key].sourceBreakdown = {};
        if (!materialReqs[key].sourceBreakdown![sbKey]) {
          materialReqs[key].sourceBreakdown![sbKey] = { label: unitSourceLabel, sourceType, pairs: 0, increment: 0 };
        }
        materialReqs[key].sourceBreakdown![sbKey].pairs += unitQty;
        materialReqs[key].sourceBreakdown![sbKey].increment += reqIncrement;
      });

      // 2. Soles — a Matriz de Solado (moldId) cadastrada no produto é a fonte canônica de QUAL molde
      // este modelo usa. soleMapping (variação > produto) serve apenas para TRADUZIR a numeração do
      // cabedal para a numeração da sola DENTRO dessa mesma matriz — nunca para decidir o molde
      // (evita que um produto "herde" o molde de outro produto agrupado no mesmo mapa).
      const resolvedMoldId = String(groupProduct?.moldId || '').trim();
      if (resolvedMoldId) {
        const variationMapping: Record<string, string> | null =
          (variation.soleMapping && Object.keys(variation.soleMapping).length > 0) ? variation.soleMapping : null;
        const productMapping: Record<string, string> | null =
          (groupProduct?.soleMapping && Object.keys(groupProduct.soleMapping).length > 0) ? groupProduct.soleMapping : null;

        // O cruzamento de numerações (cabedal -> sola) é específico de CADA matriz. Se a Matriz de
        // Solado do produto foi trocada no cadastro, um cruzamento salvo para a matriz ANTERIOR fica
        // órfão: nenhum dos valores corresponde a uma grade real da matriz atualmente cadastrada. Usar
        // esse cruzamento desatualizado faria toda tradução de tamanho falhar (numeração inexistente na
        // matriz atual) e a necessidade inteira sumiria silenciosamente — o oposto do que o cadastro pede.
        // Por isso validamos cada cruzamento contra a matriz canônica antes de confiar nele (usável =
        // ao menos um tamanho traduzido bate com uma grade real desta matriz).
        //
        // Prioridade é variação > produto — mas o cadastro só expõe edição do cruzamento a nível de
        // PRODUTO (o cruzamento por variação só existe via "copiar engenharia" de outra cor, sem tela
        // própria para corrigi-lo). Se o cruzamento da variação ficou órfão após a troca de matriz, o
        // usuário não tem como corrigi-lo diretamente — então recuamos para o cruzamento do produto
        // (que ele PODE editar e acabou de atualizar); só caímos para "sem cruzamento" se nem esse
        // servir, e nesse caso avisamos para o usuário refazer o cadastro.
        const isMappingUsable = (m: Record<string, string> | null) =>
          !!m && Object.values(m).some(v => getGradeForSize(resolvedMoldId, String(v).trim()));

        // Diagnóstico técnico — identifica EXATAMENTE qual cadastro (produto/cor/matriz) está sendo
        // avaliado, para o usuário conferir se a edição feita foi realmente neste produto/variação
        // (em mapas com vários produtos agrupados, "Off White" e "Preto" podem pertencer a cadastros
        // de produto DIFERENTES, mesmo aparecendo juntos sob a mesma matriz na tela de necessidades).
        const mappingDiagnostic =
          `Produto: ${groupProduct?.name || '?'} (ref. ${groupProduct?.reference || groupProduct?.id || '?'})\n` +
          `Cor/variação: ${variation.colorName || '?'} (id ${variation.id})\n` +
          `Matriz cadastrada no produto (moldId): ${resolvedMoldId}\n` +
          `Cruzamento salvo na cor (soleMapping da variação): ${variationMapping ? JSON.stringify(variationMapping) : 'não possui'}\n` +
          `Cruzamento salvo no produto (soleMapping do produto): ${productMapping ? JSON.stringify(productMapping) : 'não possui'}`;

        let sizeMapping: Record<string, string> | null = null;
        let mappingWarning: string | undefined;
        if (isMappingUsable(variationMapping)) {
          sizeMapping = variationMapping;
        } else if (isMappingUsable(productMapping)) {
          sizeMapping = productMapping;
          if (variationMapping) {
            mappingWarning = 'Cruzamento de numerações desta cor está desatualizado para a matriz atual cadastrada no produto — o sistema está usando o cruzamento do produto como alternativa. Recomendado: copiar a engenharia novamente para esta cor (ou refazer o cruzamento dela) para que aponte para a matriz correta.';
          }
        } else if (variationMapping || productMapping) {
          mappingWarning = 'Nenhum cruzamento de numerações salvo (nem da cor, nem do produto) corresponde a uma numeração real registrada na matriz atualmente cadastrada — provavelmente foram salvos enquanto outra Matriz de Solado estava selecionada. Refaça o "Mapeamento de Solados por Numeração" no cadastro do produto apontando para a matriz correta.';
        }

        // Monta pares efetivos por tamanho de cabedal
        const effectivePairs: Record<string, number> = { ...(groupPairs || {}) };
        if (Object.keys(effectivePairs).length === 0 && unitQty > 0) {
          let sizesToMap: string[];
          if (sizeMapping) {
            sizesToMap = Object.keys(sizeMapping);
          } else {
            // Sem mapeamento — expande as faixas do estoque desta matriz para tamanhos individuais
            // válidos, evitando que tamanhos do lote fora de qualquer faixa registrada (ex: 42 quando
            // só existem "38-39", "40-41", "43-44") virem necessidade de compra.
            const stockEntries = soleStock.filter(s => String(s.moldId).trim() === resolvedMoldId);
            const validSizes = new Set<string>();
            stockEntries.forEach(e => {
              Object.keys(e.stock).forEach(k => {
                const key = String(k).trim();
                if (key === 'pesagem' || key === 'total') return;
                const parts = key.split('-').map(p => Math.round(parseFloat(p.trim())));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                  for (let n = parts[0]; n <= parts[1]; n++) validSizes.add(String(n));
                } else if (parts.length === 1 && !isNaN(parts[0])) {
                  validSizes.add(key);
                }
              });
            });
            sizesToMap = Array.from(validSizes);
          }

          if (sizesToMap.length > 0) {
            const qtyPerSize = Math.floor(unitQty / sizesToMap.length);
            const remainder = unitQty % sizesToMap.length;
            sizesToMap.forEach((size, idx) => {
              effectivePairs[size] = qtyPerSize + (idx < remainder ? 1 : 0);
            });
          }
        }

        const colorId = String(variation.soleColorId || '').trim();
        const key = `SOLE_${resolvedMoldId}_${colorId || 'default'}`;
        const mold = productionConfigs.find(c => c.id === resolvedMoldId);
        // Cadastro da Matriz pode ter sido removido/recriado (moldId órfão no produto) — neste caso,
        // recupera o nome a partir do histórico de estoque de solados para o MESMO id canônico
        // (não troca o molde identificado, apenas exibe o nome conhecido para aquele id).
        const moldNameFromStock = !mold
          ? soleStock.find(s => String(s.moldId).trim() === resolvedMoldId)?.moldName
          : undefined;
        const moldDisplayName = mold?.name || moldNameFromStock || 'Matriz não cadastrada (verifique o produto)';
        const color = colors.find(c => c.id === colorId);

        Object.entries(effectivePairs).forEach(([cabedalSize, qty]) => {
          if (qty <= 0) return;

          // Traduz a numeração do cabedal para a numeração da sola desta matriz (se houver mapeamento)
          const soleSize = (sizeMapping?.[cabedalSize] ? String(sizeMapping[cabedalSize]).trim() : '') || cabedalSize;

          // Resolve a grade da sola (ex: 38 -> "38-39"); null = tamanho não existe nesta sola
          const gradeKey = getGradeForSize(resolvedMoldId, soleSize);
          if (!gradeKey) return;

          // Calcula estoque EXCLUSIVAMENTE para este molde + cor (sem fallback para outras cores)
          const currentGradeStock = soleStock
            .filter(s => String(s.moldId).trim() === resolvedMoldId && String(s.colorId || '').trim() === colorId)
            .reduce((sum, s) => sum + (Number(s.stock[gradeKey]) || 0), 0);

          if (!materialReqs[key]) {
            materialReqs[key] = {
              id: key,
              moldId: resolvedMoldId,
              colorId: colorId,
              name: `${moldDisplayName} - ${color?.name || 'Cor Padrão'}`,
              required: 0,
              stock: 0,
              minStock: 0,
              unit: 'PAR',
              type: 'SOLE',
              sizeShortages: {},
              contributingLots: [],
              contributingOrders: [],
              mappingWarning,
              mappingDiagnostic: mappingWarning ? mappingDiagnostic : undefined
            };
          }

          materialReqs[key].required += qty;
          registerContribution(materialReqs[key]);

          if (!materialReqs[key].sizeShortages![gradeKey]) {
            materialReqs[key].sizeShortages![gradeKey] = { required: 0, stock: currentGradeStock };
          }
          materialReqs[key].sizeShortages![gradeKey].required += qty;
        });
      }
    }); // end units.forEach

    // Finalize sole stock totals
    Object.values(materialReqs).forEach(item => {
      if (item.type === 'SOLE' && item.sizeShortages) {
        item.stock = Object.values(item.sizeShortages).reduce((acc, s) => acc + s.stock, 0);
      }
    });

    return Object.values(materialReqs).filter(item => {
      if (item.type === 'SOLE' && item.sizeShortages) {
        // Só aparece se houver falta real em pelo menos uma grade
        return Object.values(item.sizeShortages).some((s: any) => s.required > s.stock);
      }
      return (item.required > item.stock) || (item.stock < item.minStock);
    });
  };

  const purchaseNeeds = useMemo(
    () => buildPurchaseNeeds(needsSourceFilter, selectedNeedsOrderIds),
    [needsSourceFilter, selectedNeedsOrderIds, activeLots, productionConfigs, soleStock, products, colors, pendingItems]
  );

  // Indica se existe ALGUMA necessidade de compra (mapas e/ou pedidos), independente do filtro
  // selecionado — usado para o indicador (bolinha) na aba "Necessidades", que deve avisar mesmo
  // quando o usuário está vendo só "Mapas" mas há falta originada de "Pedidos" (ou vice-versa).
  const hasAnyPurchaseNeed = useMemo(() => {
    if (needsSourceFilter === 'BOTH') return purchaseNeeds.length > 0;
    return buildPurchaseNeeds('BOTH').length > 0;
  }, [needsSourceFilter, purchaseNeeds, activeLots, productionConfigs, soleStock, products, colors, pendingItems]);

  // Necessidades de Palmilhas (Montagem/Acabamento) — comparando reservas dos mapas ativos
  // contra o estoque de palmilhas e pedidos pendentes, mirror simplificado do fluxo de Solado.
  const palmilhaItems = useMemo(() => {
    const reservations = computePalmilhaMapaReservations(activeLots, products, productionConfigs, palmilhaStock);
    const pendingOrders = computePalmilhaPendingOrders(purchaseRequests, purchases);

    return Object.values(reservations).map(res => {
      const stockEntries = palmilhaStock.filter(s => s.toolId === res.toolId && String(s.colorId || '').trim() === res.colorId);
      const pending = pendingOrders[`${res.toolId}_${res.colorId || 'default'}`];

      const grades = Array.from(new Set([
        ...Object.keys(res.reservedByGrade),
        ...stockEntries.flatMap(s => Object.keys(s.stock || {})),
        ...Object.keys(pending?.pendingByGrade || {})
      ]));

      const sizeShortages: Record<string, { required: number; stock: number; pending: number }> = {};
      grades.forEach(grade => {
        const required = res.reservedByGrade[grade] || 0;
        const stock = stockEntries.reduce((sum, s) => sum + (Number(s.stock[grade]) || 0), 0);
        const pendingQty = pending?.pendingByGrade[grade] || 0;
        sizeShortages[grade] = { required, stock, pending: pendingQty };
      });

      const totalRequired = Object.values(res.reservedByGrade).reduce((a, b) => a + b, 0);
      const totalStock = stockEntries.reduce((sum, s) => sum + (s.totalPairs || 0), 0);
      const totalPending = Object.values(pending?.pendingByGrade || {}).reduce((a, b) => a + b, 0);
      const colorName = res.colorId ? (colors.find(c => c.id === res.colorId)?.name || res.colorId) : 'Sem Cor';
      const tool = productionConfigs.find(c => c.id === res.toolId);
      const silkSector = res.subtype === 'ACABAMENTO' && tool?.metadata?.palmilha?.silkServiceId
        ? sectors.find(s => s.id === tool.metadata!.palmilha!.silkServiceId)
        : undefined;
      const totalShortage = Object.values(sizeShortages).reduce((sum, s) => sum + Math.max(0, s.required - s.stock - s.pending), 0);
      const silkCostEstimate = (res.silkCostPerPair || 0) * totalRequired;

      return {
        toolId: res.toolId,
        toolName: res.toolName,
        subtype: res.subtype,
        colorId: res.colorId,
        colorName,
        sizeShortages,
        totalRequired,
        totalStock,
        totalPending,
        totalShortage,
        silkSector,
        silkCostPerPair: res.silkCostPerPair || 0,
        silkCostEstimate
      };
    }).filter(item => item.totalShortage > 0);
  }, [activeLots, products, productionConfigs, palmilhaStock, purchaseRequests, purchases, colors, sectors]);

  const palmilhaMontagemItems = useMemo(() => palmilhaItems.filter(i => i.subtype === 'MONTAGEM'), [palmilhaItems]);
  const palmilhaAcabamentoItems = useMemo(() => palmilhaItems.filter(i => i.subtype === 'ACABAMENTO'), [palmilhaItems]);

  // Busca por digitação e modo de agrupamento das "Sugestões de Mapas"
  const [mapSuggestionSearch, setMapSuggestionSearch] = useState('');
  const [groupingMode, setGroupingMode] = useState<'REF_COLOR' | 'REF_ONLY' | 'REF_COMBO' | 'TOTAL'>('REF_COLOR');
  const [isGroupingConfigOpen, setIsGroupingConfigOpen] = useState(false);
  const [suggestionFilterOrderIds, setSuggestionFilterOrderIds] = useState<Set<string>>(new Set());
  const [isOrderFilterOpen, setIsOrderFilterOpen] = useState(false);
  // Referências escolhidas para serem combinadas em um único grupo no modo "Combinações de referências"
  const [comboReferences, setComboReferences] = useState<string[]>([]);

  // Lista de referências cadastradas presentes nos pedidos pendentes (para o seletor de combinação)
  const availableReferences = useMemo(() => {
    const set = new Set<string>();
    pendingItems.forEach(item => {
      const ref = products.find(p => p.id === item.productId)?.reference;
      if (ref) set.add(ref);
    });
    return Array.from(set).sort();
  }, [pendingItems, products]);

  // Agrupamento de itens pendentes por Modelo e Cor para análise
  const groupedPendingItems = useMemo(() => {
    type GroupMember = { productId: string; variationId: string; productName: string; variationName: string };
    const groups: Record<string, {
      groupKey: string;
      productId: string;
      productName: string;
      variationId: string;
      variationName: string;
      totalQty: number;
      orders: any[];
      members: GroupMember[];
    }> = {};

    const referenceOf = (productId: string) => products.find(p => p.id === productId)?.reference || '';

    const itemsToGroup = suggestionFilterOrderIds.size > 0
      ? pendingItems.filter(item => suggestionFilterOrderIds.has(item.orderId))
      : pendingItems;

    itemsToGroup.forEach(item => {
      let key: string;
      switch (groupingMode) {
        case 'REF_ONLY':
          key = `ref-only::${item.productId}`;
          break;
        case 'REF_COMBO': {
          const ref = referenceOf(item.productId);
          // Itens cujas referências foram escolhidas para combinação caem no mesmo grupo;
          // os demais continuam agrupados individualmente pela própria referência.
          key = (ref && comboReferences.includes(ref))
            ? `ref-combo::${[...comboReferences].sort().join('+')}`
            : (ref ? `ref-combo::${ref}` : `ref-combo::${item.productId}`);
          break;
        }
        case 'TOTAL':
          key = 'total';
          break;
        case 'REF_COLOR':
        default:
          key = `${item.productId}-${item.variationId}`;
      }
      if (!groups[key]) {
        groups[key] = {
          groupKey: key,
          productId: item.productId,
          productName: item.productName,
          variationId: item.variationId,
          variationName: item.variationName,
          totalQty: 0,
          orders: [],
          members: []
        };
      }
      const g = groups[key];
      g.totalQty += item.toProductionQty;
      g.orders.push(item);
      if (!g.members.some(m => m.productId === item.productId && m.variationId === item.variationId)) {
        g.members.push({ productId: item.productId, variationId: item.variationId, productName: item.productName, variationName: item.variationName });
      }
    });

    let result = Object.values(groups);

    const term = mapSuggestionSearch.trim().toLowerCase();
    if (term) {
      result = result.filter(g => g.members.some(m => {
        const ref = referenceOf(m.productId).toLowerCase();
        return m.productName.toLowerCase().includes(term)
          || m.variationName.toLowerCase().includes(term)
          || ref.includes(term)
          || `${ref} ${m.productName}`.toLowerCase().includes(term);
      }));
    }

    return result.sort((a, b) => b.totalQty - a.totalQty);
  }, [pendingItems, groupingMode, mapSuggestionSearch, comboReferences, products, suggestionFilterOrderIds]);



  // Helper for deadline days based on productionConfigs (type === 'DEADLINE')
  const getDefaultDaysForDeadline = (deadlineName: string): number => {
    const cleanName = (deadlineName || '').toUpperCase().trim();
    const matchedConfig = (productionConfigs || []).find(c =>
      c.type === 'DEADLINE' &&
      (c.name.toUpperCase().trim() === cleanName ||
        (cleanName === 'ALTA' && c.name.toUpperCase().trim() === 'PADRÃO') ||
        (cleanName === 'URGENTE' && c.name.toUpperCase().trim() === 'URGENTE'))
    );
    if (matchedConfig && typeof matchedConfig.metadata?.days === 'number') {
      return matchedConfig.metadata.days;
    }
    // Fallback defaults
    if (cleanName === 'URGENTE') return 3;
    if (cleanName === 'ALTA') return 7;
    return 15; // default for NORMAL
  };

  const formatDateForInput = (timestamp?: number) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDateFromInput = (dateString: string) => {
    if (!dateString) return undefined;
    const parts = dateString.split('-');
    if (parts.length !== 3) return undefined;
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
  };



  // Após escanear um QR e abrir o Mapa direto em um pedido vinculado, rola até o card expandido
  useEffect(() => {
    if (!scanFocusKey || !isDetailModalOpen) return;
    const timer = setTimeout(() => {
      document.getElementById(`pedido-card-${scanFocusKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setScanFocusKey(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [scanFocusKey, isDetailModalOpen]);

  // Ao chegar via QR Code do scanner rápido (cabeçalho/Dashboard), abre direto o
  // Mapa correspondente em sua tela de detalhes expandida, em vez de deixar o
  // usuário apenas na tela de setores do PCP. Usa uma assinatura (lote+pedido+item)
  // em vez de um booleano simples, para que cada novo escaneamento — mesmo de um
  // pedido diferente dentro do mesmo Mapa — seja processado, ainda que o Mapa já
  // esteja aberto de um escaneamento anterior.
  const initialLotHandledKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // Lembretes de pedido (Dashboard) pedem para abrir no card dentro do Setor, não no
    // modal do Mapa — esse modo é tratado pelo efeito "initialFocusHandledKeyRef" abaixo.
    if (!initialLotId || initialOpenMode === 'sector') return;
    const signature = `${initialLotId}|${initialOrderId ?? ''}|${initialItemIdx ?? ''}|${initialScanNonce ?? ''}`;
    if (initialLotHandledKeyRef.current === signature) return;
    const lot = lots.find(l => l.id === initialLotId);
    if (!lot) return;
    initialLotHandledKeyRef.current = signature;

    setSelectedLot(lot);
    setIsDetailModalOpen(true);
    // Limpa filtros deixados por uma sessão anterior do modal, que poderiam
    // esconder o card do pedido recém-escaneado.
    setSourceFilterModel('');
    setSourceFilterColor('');

    const allSourceItems: any[] = (lot as any).metadata?.sourceItems || [
      { orderId: lot.productionOrderId, itemIdx: 0, qty: lot.quantity }
    ];
    const currentSectorId = lot.route && lot.route[lot.currentSectorIndex];
    const sourceItems = allSourceItems.filter((si: any) =>
      getOrderEffectiveSector(lot, si.orderId, si) === currentSectorId
    );

    const itemIdxNum = initialItemIdx !== undefined && initialItemIdx !== '' ? Number(initialItemIdx) : undefined;
    const matchesTarget = (s: any) => s.orderId === initialOrderId && (itemIdxNum === undefined || s.itemIdx === itemIdxNum);

    let targetItem = sourceItems[0];
    if (initialOrderId) {
      targetItem = sourceItems.find(matchesTarget)
        || sourceItems.find((s: any) => s.orderId === initialOrderId)
        || targetItem;
    }

    if (targetItem) {
      const idx = sourceItems.indexOf(targetItem);
      const focusKey = `${targetItem.orderId}-${idx}`;
      setExpandedSourceItems(prev => new Set(prev).add(focusKey));
      setScanFocusKey(focusKey);
    } else if (initialOrderId) {
      // O pedido escaneado não está no setor atual do Mapa — foi direcionado
      // individualmente para outro setor. Avisa o usuário onde ele está, já que
      // não há um card correspondente para destacar nesta tela.
      const movedItem = allSourceItems.find(matchesTarget) || allSourceItems.find((s: any) => s.orderId === initialOrderId);
      const movedSectorId = movedItem ? getOrderEffectiveSector(lot, movedItem.orderId, movedItem) : undefined;
      const movedSectorName = movedSectorId ? sectors.find(s => s.id === movedSectorId)?.name : undefined;
      toast.show(movedSectorName
        ? `Este pedido já foi direcionado para o setor "${movedSectorName}".`
        : 'Pedido não encontrado neste Mapa.');
    }
  }, [initialLotId, initialOrderId, initialItemIdx, initialScanNonce, lots]);

  // Chegando via lembrete do Dashboard ("Lembretes e Vencimentos") com uma OS específica,
  // troca para o setor certo e rola até o card dela na lista "Ordem de Serviço por Setor".
  const initialOSHandledKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialOSId) return;
    const signature = `${initialOSId}|${initialOSNonce ?? ''}`;
    if (initialOSHandledKeyRef.current === signature) return;
    const os = serviceOrders.find(o => o.id === initialOSId);
    if (!os) return;
    initialOSHandledKeyRef.current = signature;

    if (os.sectorId !== selectedSectorId) setSelectedSectorId(os.sectorId);

    const timer = setTimeout(() => {
      document.getElementById(`os-card-${initialOSId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedOSId(initialOSId);
      setTimeout(() => setHighlightedOSId(null), 2500);
    }, 350);
    return () => clearTimeout(timer);
  }, [initialOSId, initialOSNonce, serviceOrders, selectedSectorId]);

  // Chegando via lembrete do Dashboard ("Lembretes e Vencimentos") com um pedido/mapa em setor específico,
  // troca para o setor certo, expande a grade/detalhes e rola até o card dele na lista.
  const initialSectorHandledKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialLotId || initialOpenMode !== 'sector') return;
    const signature = `${initialLotId}|${initialOrderId ?? ''}|${initialItemIdx ?? ''}|${initialScanNonce ?? ''}`;
    if (initialSectorHandledKeyRef.current === signature) return;
    const lot = lots.find(l => l.id === initialLotId);
    if (!lot) return;
    initialSectorHandledKeyRef.current = signature;

    const allSourceItems: any[] = (lot as any).metadata?.sourceItems || [
      { orderId: lot.productionOrderId, itemIdx: 0, qty: lot.quantity }
    ];
    const itemIdxNum = initialItemIdx !== undefined && initialItemIdx !== '' ? Number(initialItemIdx) : undefined;
    const matchesTarget = (s: any) => s.orderId === initialOrderId && (itemIdxNum === undefined || s.itemIdx === itemIdxNum);

    const targetItem = allSourceItems.find(matchesTarget)
      || allSourceItems.find((s: any) => s.orderId === initialOrderId)
      || allSourceItems[0];

    if (targetItem) {
      const targetSectorId = getOrderEffectiveSector(lot, targetItem.orderId, targetItem);
      if (targetSectorId && targetSectorId !== ORDER_FINALIZED) {
        if (targetSectorId !== selectedSectorId) {
          setSelectedSectorId(targetSectorId);
        }

        const idx = allSourceItems.indexOf(targetItem);
        const itemKey = `${lot.id}::${targetItem.orderId}::${idx}`;
        const gradeKey = `grade-${itemKey}`;

        // Expande o item na lista do setor
        setFichaItemExpanded(prev => {
          const next = new Set(prev);
          next.add(gradeKey);
          return next;
        });

        const timer = setTimeout(() => {
          const el = document.getElementById(`pedido-card-${itemKey}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedPedidoKey(itemKey);
            setTimeout(() => setHighlightedPedidoKey(null), 2500);
          }
        }, 450);
        return () => clearTimeout(timer);
      }
    }
  }, [initialLotId, initialOrderId, initialItemIdx, initialScanNonce, lots, initialOpenMode, selectedSectorId]);

  const deadlineConfigs = useMemo(() => {
    return (productionConfigs || []).filter(c => c.type === 'DEADLINE');
  }, [productionConfigs]);

  // Diagnóstico de StockLots duplicados (ver showStockDiagnosticModal) — compartilhado
  // com a tela de Estoques via useStockLotDuplicates.
  const { duplicateStockLotGroups, duplicateStockByRefColor, markResolved: markStockDuplicatesResolved } = useStockLotDuplicates(stockLots);



  // Bloqueia avanço do mapa inteiro se houver OS pendente
  const hasPendingOS = (lot: ProductionLot): boolean => {
    const currentSectorId = lot.route?.[lot.currentSectorIndex];
    return serviceOrders.some(so =>
      (so.lotId === lot.id || so.lotIds?.includes(lot.id)) &&
      so.sectorId === currentSectorId &&
      so.status === 'PENDING'
    );
  };

  // Descreve um pedido/item para exibição em popups de confirmação/feedback,
  // ex.: "MULE BOSS PRETO · Ped. 69607 · 96P".
  const describeMoveItem = (lot: ProductionLot, it: { orderId: string; itemIdx?: number; productId?: string; variationId?: string; qty?: number }): string => {
    const order = productionOrders.find(o => o.id === it.orderId);
    const orderItem: any = it.itemIdx !== undefined
      ? order?.items[it.itemIdx]
      : order?.items.find((i: any) => i.productId === it.productId && i.variationId === it.variationId);
    const sourceItems: any[] = (lot as any).metadata?.sourceItems || [];
    const si = sourceItems.find((s: any) => getSourceItemKey(s) === getSourceItemKey(it));
    const resolvedProductId = it.productId || orderItem?.productId;
    const product = products.find(p => p.id === resolvedProductId);
    const variation = product?.variations.find(v => v.id === (it.variationId || orderItem?.variationId));
    const productName = product?.name || orderItem?.productName || si?.productName || '—';
    const productRef = product?.reference || '';
    const colorName = variation?.colorName || orderItem?.variationName || si?.colorName || '';
    const qty = it.qty ?? si?.qty;
    const orderNumber = order?.saleOrderNumber || order?.orderNumber || '';
    return [
      [productRef, productName, colorName].filter(Boolean).join(' '),
      orderNumber ? `Ped. ${orderNumber}` : '',
      qty ? `${qty} ${qty === 1 ? 'par' : 'pares'}` : '',
    ].filter(Boolean).join(' · ');
  };

  // Para um item que está saindo da Expedição (toFinalize), calcula o destino
  // ("Estoque" ou "Reserva: Cliente") e — quando o destino é Estoque — o estoque
  // ATUAL do produto/cor e para quanto ele FICARÁ após a entrada deste pedido.
  // Espelha a conversão pares→caixas usada em `applyExpedicaoStockUpdate`
  // (ATACADO: caixas via "Grade de Produção Padrão"; demais: pares).
  const computeStockProjection = (
    it: { productId?: string; variationId?: string; qty: number; saleType?: SaleType },
    destino: { isStock: boolean; customerName?: string },
  ): { destino: string; currentQty: number; addQty: number; projectedQty: number; unit: string } | null => {
    const product = products.find(p => p.id === it.productId);
    const variation = product?.variations.find(v => v.id === it.variationId);
    if (!product || !variation) return null;

    const destinoLabel = destino.isStock ? 'Estoque' : `Reserva: ${destino.customerName || 'Cliente'}`;

    if ((it.saleType ?? product.type) === SaleType.WHOLESALE) {
      const gridId = product.productionGridId || product.defaultGridId;
      const defaultPkg = productionConfigs.find(c => c.type === 'PACKAGING' && c.metadata?.productionGradeId === gridId);
      // Prioridade: sizeQuantities (composição real da caixa) → capacity (campo direto) → grid sum
      const pkgSizeQtys = (defaultPkg?.metadata as any)?.sizeQuantities as Record<string, number> | undefined;
      const sizeQtysSum = pkgSizeQtys ? Object.values(pkgSizeQtys).reduce((s, q) => s + (q || 0), 0) : 0;
      let pairsPerBox: number = sizeQtysSum > 0
        ? sizeQtysSum
        : ((defaultPkg?.metadata?.capacity as number | undefined) || 0);
      if (!pairsPerBox) {
        const grid = grids.find(gr => gr.id === gridId);
        pairsPerBox = grid ? Object.values(grid.configuration).reduce((a: number, b: number) => a + b, 0) : 12;
      }
      const addedBoxes = Math.round(it.qty / Math.max(1, pairsPerBox));
      const currentBoxes = (variation.stock as any)?.['WHOLESALE'] || 0;
      return {
        destino: destinoLabel,
        currentQty: currentBoxes,
        addQty: addedBoxes,
        projectedQty: destino.isStock ? currentBoxes + addedBoxes : currentBoxes,
        unit: 'caixas',
      };
    }

    const currentPairs = Object.entries(variation.stock || {}).reduce((s, [, v]) => s + (Number(v) || 0), 0);
    return {
      destino: destinoLabel,
      currentQty: currentPairs,
      addQty: it.qty,
      projectedQty: destino.isStock ? currentPairs + it.qty : currentPairs,
      unit: 'pares',
    };
  };

  // Move pedidos/itens individuais para um setor específico (apenas para OS já concluídas
  // ou via "Mudar Setor Manualmente"). Cada item é identificado pela sua própria chave
  // (`getSourceItemKey`) — pedidos que compartilham `orderId` (ex.: várias cores do mesmo
  // pedido de compra) são movidos independentemente, sem afetar os demais itens do pedido.
  const handleMoveOrdersToSector = async (
    lotId: string,
    items: { orderId: string; itemIdx?: number; productId?: string; variationId?: string }[],
    targetSectorId: string,
  ) => {
    const lot = lots.find(l => l.id === lotId);
    if (!lot) return;
    const currentOrderSectors: Record<string, string> = (lot as any).metadata?.orderSectors || {};
    const updatedOrderSectors = { ...currentOrderSectors };
    items.forEach(it => {
      const order = productionOrders.find(o => o.id === it.orderId);
      const orderItem: any = it.itemIdx !== undefined
        ? order?.items[it.itemIdx]
        : order?.items.find((i: any) => i.productId === it.productId && i.variationId === it.variationId);
      const resolvedProductId = it.productId || orderItem?.productId;
      const resolvedVariationId = it.variationId || orderItem?.variationId;

      const keyDirect = getSourceItemKey(it);
      const keyResolved = getSourceItemKey({
        orderId: it.orderId,
        itemIdx: it.itemIdx,
        productId: resolvedProductId,
        variationId: resolvedVariationId,
      });
      const keyUnresolved = getSourceItemKey({
        orderId: it.orderId,
        itemIdx: it.itemIdx,
        productId: '',
        variationId: '',
      });

      updatedOrderSectors[keyDirect] = targetSectorId;
      updatedOrderSectors[keyResolved] = targetSectorId;
      updatedOrderSectors[keyUnresolved] = targetSectorId;
      delete updatedOrderSectors[it.orderId];
    });
    await firebaseService.updateDocument('productionLots', lotId, {
      metadata: { ...(lot as any).metadata, orderSectors: updatedOrderSectors }
    });
    setMoveSectorModal(null);
    setMoveSectorTarget('');
    setSelectedSourceItemKeys(new Set());
    setOsFeedback({
      osNumber: `${items.length} pedido(s)`,
      nextSector: sectors.find(s => s.id === targetSectorId)?.name || targetSectorId,
      action: 'Movidos para o setor com sucesso.',
      type: 'pedido',
      details: items.map(it => describeMoveItem(lot, it)),
    });
  };

  // "Finalizar Produção" escopado a um subconjunto de pedidos do mapa: cada pedido
  // segue seu PRÓPRIO destino (resolvido via resolveCorrectSectorForProduct) — ou é
  // movido para o próximo setor do seu roteiro (orderSectors), ou, se o roteiro dele
  // já terminou, recebe a baixa de Expedição (estoque/entrega) e é marcado com
  // ORDER_FINALIZED. Os demais pedidos do mapa permanecem inalterados.
  const handleFinalizeSelectedSourceItems = async (lot: ProductionLot, items: LotAdvanceItem[], os?: ServiceOrder) => {
    // Agrupa os itens por lotId para atualizar cada lote individualmente
    const itemsByLotId: Record<string, LotAdvanceItem[]> = {};
    items.forEach(it => {
      const lid = it.lotId || lot.id;
      if (!itemsByLotId[lid]) itemsByLotId[lid] = [];
      itemsByLotId[lid].push(it);
    });

    let overallFinalized = true;

    for (const [lotId, lotItems] of Object.entries(itemsByLotId)) {
      const currentLot = lots.find(l => l.id === lotId) || lot;
      const currentSectorId = currentLot.route?.[currentLot.currentSectorIndex] || '';
      const currentOrderSectors: Record<string, string> = (currentLot as any).metadata?.orderSectors || {};
      const updatedOrderSectors = { ...currentOrderSectors };

      const toFinalize = lotItems.filter(it => it.chosenSectorId === '');
      const toMove = lotItems.filter(it => it.chosenSectorId !== '');

      if (toFinalize.length > 0) {
        const { customerItems, stockItems } = classifyExpedicaoOrders(toFinalize.map(it => ({ orderId: it.orderId, itemIdx: it.itemIdx, fractionLabel: it.fractionLabel })));
        await applyExpedicaoStockUpdate(currentLot, stockItems, customerItems);
        toFinalize.forEach(it => {
          const originalSi: any = it.siIdx !== undefined ? currentLot.metadata?.sourceItems?.[it.siIdx] : undefined;
          const order = productionOrders.find(o => o.id === it.orderId);
          const orderItem: any = it.itemIdx !== undefined
            ? order?.items[it.itemIdx]
            : order?.items.find((i: any) => i.productId === it.productId && i.variationId === it.variationId);
          const resolvedProductId = it.productId || originalSi?.productId || orderItem?.productId;
          const resolvedVariationId = it.variationId || originalSi?.variationId || orderItem?.variationId;

          const keyDirect = getSourceItemKey(it);
          const keyResolved = getSourceItemKey({
            orderId: it.orderId,
            itemIdx: it.itemIdx,
            productId: resolvedProductId,
            variationId: resolvedVariationId,
            fractionLabel: it.fractionLabel,
          });
          const keyUnresolved = getSourceItemKey({
            orderId: it.orderId,
            itemIdx: it.itemIdx,
            productId: '',
            variationId: '',
            fractionLabel: it.fractionLabel,
          });

          updatedOrderSectors[keyDirect] = ORDER_FINALIZED;
          updatedOrderSectors[keyResolved] = ORDER_FINALIZED;
          updatedOrderSectors[keyUnresolved] = ORDER_FINALIZED;
          delete updatedOrderSectors[it.orderId];
        });
      }
      toMove.forEach(it => {
        const originalSi: any = it.siIdx !== undefined ? currentLot.metadata?.sourceItems?.[it.siIdx] : undefined;
        const order = productionOrders.find(o => o.id === it.orderId);
        const orderItem: any = it.itemIdx !== undefined
          ? order?.items[it.itemIdx]
          : order?.items.find((i: any) => i.productId === it.productId && i.variationId === it.variationId);
        const resolvedProductId = it.productId || originalSi?.productId || orderItem?.productId;
        const resolvedVariationId = it.variationId || originalSi?.variationId || orderItem?.variationId;

        const keyDirect = getSourceItemKey(it);
        const keyResolved = getSourceItemKey({
          orderId: it.orderId,
          itemIdx: it.itemIdx,
          productId: resolvedProductId,
          variationId: resolvedVariationId,
          fractionLabel: it.fractionLabel,
        });
        const keyUnresolved = getSourceItemKey({
          orderId: it.orderId,
          itemIdx: it.itemIdx,
          productId: '',
          variationId: '',
          fractionLabel: it.fractionLabel,
        });

        updatedOrderSectors[keyDirect] = it.chosenSectorId;
        updatedOrderSectors[keyResolved] = it.chosenSectorId;
        updatedOrderSectors[keyUnresolved] = it.chosenSectorId;
        delete updatedOrderSectors[it.orderId];
      });

      const allSI: any[] = (currentLot as any).metadata?.sourceItems
        || [{ orderId: currentLot.productionOrderId, itemIdx: 0, qty: currentLot.quantity }];
      const lotWithUpdatedSectors = { ...currentLot, metadata: { ...(currentLot as any).metadata, orderSectors: updatedOrderSectors } };
      const allFinalized = allSI.every((si: any) =>
        getOrderEffectiveSector(lotWithUpdatedSectors, si.orderId, si) === ORDER_FINALIZED
      );

      if (!allFinalized) {
        overallFinalized = false;
      }

      if (allFinalized) {
        await onSaveLot({
          ...currentLot,
          finishedAt: Date.now(),
          metadata: { ...(currentLot as any).metadata, orderSectors: updatedOrderSectors },
          history: [...(currentLot.history || []), {
            sectorId: currentSectorId, statusId: '', timestamp: Date.now(),
            userName: userName || 'Usuário', notes: 'Mapa finalizado (pedidos concluídos individualmente).',
          }],
        });
      } else {
        await firebaseService.updateDocument('productionLots', currentLot.id, {
          metadata: { ...(currentLot as any).metadata, orderSectors: updatedOrderSectors },
        });
      }
    }

    setSelectedSourceItemKeys(new Set());
    setOsFeedback({
      osNumber: `${items.length} pedido(s)`,
      nextSector: overallFinalized ? 'FINALIZADO' : 'PROCESSADO',
      action: `${items.length} pedido(s) processado(s) com sucesso.`,
      type: 'pedido',
      details: items.map(it => {
        const itemLot = lots.find(l => l.id === it.lotId) || lot;
        return `[Mapa ${itemLot.orderNumber}] ${describeMoveItem(itemLot, it)}`;
      }),
    });

    if (os) {
      await firebaseService.updateDocument('serviceOrders', os.id, {
        status: 'COMPLETED',
        finishedAt: Date.now(),
      });
      if (os.transactionId) {
        try { await financeService.settleTransaction(os.transactionId); } catch { /* ignore */ }
      }
    }
  };

  // Direciona um único pedido (modelo) ao setor que corresponde ao SEU PRÓPRIO roteiro de produção,
  // mesmo que isso difira do setor para onde o restante do mapa está indo (mapas com modelos divergentes).
  const handleRouteOrderToCorrectSector = async (lot: ProductionLot, si: { orderId: string; itemIdx?: number; productId?: string; variationId?: string; fractionLabel?: string }, targetSectorId: string, targetSectorName: string, productName: string) => {
    if (!confirm(`Direcionar o pedido do modelo "${productName}" diretamente para o setor "${targetSectorName}", conforme o roteiro de produção cadastrado para este modelo?`)) return;
    const currentOrderSectors: Record<string, string> = (lot as any).metadata?.orderSectors || {};
    const order = productionOrders.find(o => o.id === si.orderId);
    const orderItem: any = si.itemIdx !== undefined
      ? order?.items[si.itemIdx]
      : order?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
    const resolvedProductId = si.productId || orderItem?.productId;
    const resolvedVariationId = si.variationId || orderItem?.variationId;

    const keyDirect = getSourceItemKey(si);
    const keyResolved = getSourceItemKey({
      orderId: si.orderId,
      itemIdx: si.itemIdx,
      productId: resolvedProductId,
      variationId: resolvedVariationId,
      fractionLabel: si.fractionLabel,
    });
    const keyUnresolved = getSourceItemKey({
      orderId: si.orderId,
      itemIdx: si.itemIdx,
      productId: '',
      variationId: '',
      fractionLabel: si.fractionLabel,
    });

    const updatedOrderSectors = {
      ...currentOrderSectors,
      [keyDirect]: targetSectorId,
      [keyResolved]: targetSectorId,
      [keyUnresolved]: targetSectorId,
    };
    delete updatedOrderSectors[si.orderId];
    await firebaseService.updateDocument('productionLots', lot.id, {
      metadata: { ...(lot as any).metadata, orderSectors: updatedOrderSectors },
    });
    setOsFeedback({
      osNumber: `Modelo ${productName}`,
      nextSector: targetSectorName,
      action: 'Direcionado para o setor correto conforme o roteiro do modelo.',
      type: 'pedido',
      details: [describeMoveItem(lot, si)],
    });
  };

  // Repara o caso em que uma venda perdeu a referência (sale.productionOrderId) para a
  // Ordem de Produção que efetivamente gerou os mapas em produção — geralmente porque uma
  // edição anterior da venda criou uma OP nova/órfã e sobrescreveu o vínculo correto.
  // Reaponta a venda para a OP que este mapa realmente referencia e, se a OP atualmente
  // vinculada à venda estiver órfã (sem mapas), remove-a.
  const handleRepairSaleLink = (order: ProductionOrder) => {
    if (!order.saleId) return;
    const sale = sales.find(s => s.id === order.saleId);
    if (!sale) {
      toast.show('Venda original não encontrada.');
      return;
    }
    if (sale.productionOrderId === order.id) {
      toast.show('Este pedido já está corretamente vinculado.');
      return;
    }
    const orphanOrder = sale.productionOrderId
      ? productionOrders.find(o => o.id === sale.productionOrderId)
      : undefined;
    const orphanIsEmpty = !!orphanOrder && (!orphanOrder.lotIds || orphanOrder.lotIds.length === 0);
    setRepairLinkConfirm({ order, sale, orphanOrder, orphanIsEmpty });
  };

  const executeRepairSaleLink = async () => {
    if (!repairLinkConfirm) return;
    const { order, sale, orphanOrder, orphanIsEmpty } = repairLinkConfirm;
    await firebaseService.saveDocument('sales', { ...sale, productionOrderId: order.id });
    if (orphanOrder && orphanIsEmpty && onDeleteProductionOrder) {
      await onDeleteProductionOrder(orphanOrder.id);
    }
    toast.show('Vínculo do pedido reparado com sucesso.');
    setRepairLinkConfirm(null);
  };

  // Monta, para cada modelo (pedido) que compõe o mapa, o setor que o ROTEIRO DE
  // PRODUÇÃO DESSE PRÓPRIO MODELO indica como próximo passo a partir do setor atual —
  // em vez de usar o roteiro do "modelo principal" do mapa (congelado em `lot.route`),
  // que pode não conter setores que outros modelos do bundle precisam (ex.: um mapa
  // criado a partir do modelo 300 — cujo roteiro pula BORDADO — não tem "BORDADO" no
  // `route`, então o modelo 290 nunca conseguiria parar lá se resolvêssemos pelo mapa).
  const buildLotAdvanceItems = (
    lot: ProductionLot,
    currentSectorId: string,
    restrictTo?: { sourceItemKeys?: string[]; sourceOrderIds?: string[] },
  ): LotAdvanceItem[] => {
    const buildItem = (
      key: string, orderId: string, productId: string, variationId: string | undefined,
      qty: number, fallbackProductName?: string, fallbackColorName?: string, itemIdx?: number,
      siIdx?: number, fractionLabel?: string,
    ): LotAdvanceItem => {
      const product = products.find(p => p.id === productId);
      const variation = product?.variations.find(v => v.id === variationId);
      const resolved = resolveCorrectSectorForProduct(currentSectorId, product, sectors);
      const suggestedSectorId = resolved.isFinished ? '' : resolved.sectorId;
      const suggestedSectorName = resolved.isFinished ? 'CONCLUÍDO' : (sectors.find(s => s.id === suggestedSectorId)?.name || suggestedSectorId);
      return {
        key, orderId, productId, itemIdx, variationId,
        productName: product?.name || fallbackProductName || '—',
        productReference: product?.reference || '',
        colorName: variation?.colorName || fallbackColorName || '',
        qty,
        suggestedSectorId, suggestedSectorName,
        skippedSectorNames: resolved.skippedSectorNames,
        // Setor de destino nunca vem pré-selecionado — força escolha manual de cada
        // modelo antes de poder confirmar (ver botão "Confirmar e Avançar" abaixo).
        chosenSectorId: '__PENDING_SELECTION__',
        siIdx,
        fractionLabel,
      };
    };

    const sourceItems: any[] = (lot as any).metadata?.sourceItems || [];
    if (sourceItems.length > 0) {
      // Quando restringido (ex.: "Dar Baixa" de uma OS específica), mostra só os
      // itens realmente cobertos por ela — não o Mapa inteiro.
      const filteredSourceItems = restrictTo
        ? sourceItems.filter((si: any, idx: number) => {
            const itemKey = `${lot.id}::${si.orderId}::${idx}`;
            if (restrictTo.sourceItemKeys && restrictTo.sourceItemKeys.length > 0) {
              return restrictTo.sourceItemKeys.includes(itemKey);
            }
            if (restrictTo.sourceOrderIds && restrictTo.sourceOrderIds.length > 0) {
              return restrictTo.sourceOrderIds.includes(si.orderId);
            }
            return true;
          })
        : sourceItems;
      const itemsToUse = filteredSourceItems.length > 0 ? filteredSourceItems : sourceItems;
      return itemsToUse.map((si: any) => {
        const idx = sourceItems.indexOf(si);
        const order = productionOrders.find(o => o.id === si.orderId);
        const orderItem: any = si.itemIdx !== undefined
          ? order?.items[si.itemIdx]
          : order?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
        const resolvedProductId = si.productId || orderItem?.productId;
        const resolvedVariationId = si.variationId || orderItem?.variationId;
        return buildItem(`${si.orderId}-${idx}`, si.orderId, resolvedProductId, resolvedVariationId, si.qty || 0, orderItem?.productName, orderItem?.variationName, si.itemIdx, idx, si.fractionLabel);
      });
    }
    return [buildItem(lot.id, lot.productionOrderId || lot.id, lot.productId, lot.variationId, lot.quantity || 0)];
  };

  // ── Fracionar Pedido ────────────────────────────────────────────────────────
  // Resolve a composição da CAIXA (embalagem) cadastrada pro produto — mesma fonte já
  // usada em computeStockProjection pra converter pares→caixas na baixa de Expedição
  // (ATACADO): primeiro o padrão de embalagem vinculado à grade de produção
  // (ProductionConfigItem tipo PACKAGING, metadata.sizeQuantities), com fallback pra
  // grid.configuration quando não há embalagem cadastrada. É essa composição — não uma
  // grade "livre" qualquer — que define os múltiplos válidos pra fracionar um pedido em
  // grade padrão, pra não quebrar a contagem de caixas no estoque.
  const resolveBoxBreakdown = (product: Product | undefined): Record<string, number> | null => {
    if (!product) return null;
    const gridId = product.productionGridId || product.defaultGridId;
    if (!gridId) return null;
    const pkg = productionConfigs.find(c => c.type === 'PACKAGING' && (c.metadata as any)?.productionGradeId === gridId);
    const pkgBreakdown = (pkg?.metadata as any)?.sizeQuantities as Record<string, number> | undefined;
    if (pkgBreakdown && Object.values(pkgBreakdown).some(q => (q || 0) > 0)) return pkgBreakdown;
    return grids.find(g => g.id === gridId)?.configuration || null;
  };

  // Maior multiplicador inteiro da grade que cabe inteiro na grade do pedido (uma
  // fração "1x grade" = grid.configuration; "2x" = o dobro de cada tamanho, etc.).
  // Retorna 0 quando a grade do pedido não bate em múltiplos exatos da grade cadastrada
  // (tamanho fora do padrão, ou quantidade não divisível) — força o modo Livre nesse caso.
  const computeGridMaxMultiplier = (gridConfig: Record<string, number>, baseSizes: Record<string, number>): number => {
    const baseKeys = Object.keys(baseSizes).filter(sz => baseSizes[sz] > 0);
    if (baseKeys.length === 0) return 0;
    let maxMult = Infinity;
    for (const sz of baseKeys) {
      const unit = gridConfig[sz];
      if (!unit || unit <= 0) return 0;
      if (baseSizes[sz] % unit !== 0) return 0;
      maxMult = Math.min(maxMult, baseSizes[sz] / unit);
    }
    return Number.isFinite(maxMult) ? Math.floor(maxMult) : 0;
  };

  // Recalcula a ÚLTIMA fração da lista como "o que sobrou" da grade total depois de
  // somar todas as outras — assim a soma das frações nunca desbate do pedido original,
  // sem o usuário precisar digitar o resto manualmente.
  const recomputeLastFraction = (
    fractions: { label: string; multiplier: number; sizes: Record<string, number> }[],
    baseSizes: Record<string, number>,
    gridConfig: Record<string, number> | null,
  ) => {
    if (fractions.length === 0) return fractions;
    const editable = fractions.slice(0, -1);
    const lastLabel = fractions[fractions.length - 1].label;
    const remainder: Record<string, number> = { ...baseSizes };
    editable.forEach(fr => {
      Object.entries(fr.sizes).forEach(([sz, qty]) => { remainder[sz] = (remainder[sz] || 0) - (qty || 0); });
    });
    let lastMultiplier = 0;
    if (gridConfig) {
      const sizesWithUnit = Object.keys(remainder).filter(sz => (gridConfig[sz] || 0) > 0);
      const allConsistent = sizesWithUnit.length > 0 && sizesWithUnit.every(sz => remainder[sz] % gridConfig[sz] === remainder[sizesWithUnit[0]] % gridConfig[sizesWithUnit[0]]);
      lastMultiplier = allConsistent ? Math.round(remainder[sizesWithUnit[0]] / gridConfig[sizesWithUnit[0]]) : 0;
    }
    return [...editable, { label: lastLabel, multiplier: lastMultiplier, sizes: remainder }];
  };

  const FRACTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Abre o painel de fracionamento pra uma ficha (sourceItem) específica — só permitido
  // pra fichas sem OS pendente vinculada (fracionar uma já comprometida com uma OS
  // exigiria também reescrever a OS existente, fora do escopo desta primeira versão).
  const handleOpenFractionModal = (f: { lot: ProductionLot; si: any; siIdx: number; product?: any; variation?: any; orderItem?: any }) => {
    const product = f.product || products.find(p => p.id === f.si.productId);
    const variation = f.variation || product?.variations.find((v: any) => v.id === f.si.variationId);
    if (!product) { toast.show('Produto não encontrado.'); return; }

    // Mesma prioridade usada na exibição da ficha: fração já existente sempre usa o
    // próprio snapshot (f.si.sizes); pedido normal prioriza a grade viva do pedido
    // (f.orderItem.sizes) e só cai pro snapshot do lote se o pedido não tiver a grade.
    const rawSizes: Record<string, { total: number; fromStock: number; toProduction: number }> | undefined =
      f.si.fractionLabel ? (f.si.sizes || f.orderItem?.sizes) : (f.orderItem?.sizes || f.si.sizes);
    const baseSizes: Record<string, number> = {};
    if (rawSizes) {
      Object.entries(rawSizes).forEach(([sz, s]) => { if ((s?.toProduction || 0) > 0) baseSizes[sz] = s.toProduction; });
    }
    const totalQty = Object.values(baseSizes).reduce((a, b) => a + b, 0);
    if (totalQty <= 1) { toast.show('Não há pares suficientes para fracionar este pedido.'); return; }

    // Pedido em GRADE PADRÃO (ATACADO) só pode ser fracionado em múltiplos inteiros da
    // embalagem cadastrada — fracionar livremente por tamanho quebraria a contagem de
    // caixas na baixa de estoque. Pedido VAREJO não segue grade nenhuma, então fraciona
    // livre por tamanho normalmente.
    const saleType = f.orderItem?.saleType ?? product.type;
    const gridConfig = resolveBoxBreakdown(product);
    const gridMaxMultiplier = gridConfig ? computeGridMaxMultiplier(gridConfig, baseSizes) : 0;

    if (saleType === SaleType.WHOLESALE && gridMaxMultiplier < 2) {
      toast.show('Este pedido (grade padrão) não está em múltiplos exatos da embalagem cadastrada, ou já é de apenas 1 caixa — não é possível fracionar em caixas.');
      return;
    }

    const mode: 'grade' | 'free' = saleType === SaleType.WHOLESALE ? 'grade' : 'free';
    const rootKey = f.si.fractionRootKey || `${f.si.orderId}::${f.si.itemIdx ?? ''}`;

    const usedLabels = new Set<string>(
      ((f.lot as any).metadata?.sourceItems || [])
        .filter((s: any) => s.fractionLabel && (s.fractionRootKey || `${s.orderId}::${s.itemIdx ?? ''}`) === rootKey)
        .map((s: any) => s.fractionLabel as string)
    );
    const nextLabel = () => {
      for (const ch of FRACTION_LETTERS) { if (!usedLabels.has(ch)) { usedLabels.add(ch); return ch; } }
      return `X${usedLabels.size}`;
    };

    const zeroSizes = Object.fromEntries(Object.keys(baseSizes).map(sz => [sz, 0]));
    const initialFractions = [
      { label: nextLabel(), multiplier: 0, sizes: zeroSizes },
      { label: nextLabel(), multiplier: gridMaxMultiplier, sizes: { ...baseSizes } },
    ];

    setFractionModal({
      lot: f.lot, si: f.si, siIdx: f.siIdx, product, variation,
      baseSizes, gridConfig: mode === 'grade' ? gridConfig : null, gridMaxMultiplier, mode, rootKey,
      fractions: initialFractions,
    });
  };

  const updateFractionMultiplier = (idx: number, multiplier: number) => {
    setFractionModal(prev => {
      if (!prev || !prev.gridConfig) return prev;
      const clamped = Math.max(0, Math.round(multiplier));
      const sizes: Record<string, number> = {};
      Object.keys(prev.baseSizes).forEach(sz => { sizes[sz] = (prev.gridConfig![sz] || 0) * clamped; });
      const next = prev.fractions.map((fr, i) => i === idx ? { ...fr, multiplier: clamped, sizes } : fr);
      return { ...prev, fractions: recomputeLastFraction(next, prev.baseSizes, prev.gridConfig) };
    });
  };

  const updateFractionSize = (idx: number, size: string, qty: number) => {
    setFractionModal(prev => {
      if (!prev) return prev;
      const clamped = Math.max(0, Math.round(qty) || 0);
      const next = prev.fractions.map((fr, i) => i === idx ? { ...fr, sizes: { ...fr.sizes, [size]: clamped } } : fr);
      return { ...prev, fractions: recomputeLastFraction(next, prev.baseSizes, prev.gridConfig) };
    });
  };

  const addFractionRow = () => {
    setFractionModal(prev => {
      if (!prev) return prev;
      const usedLabels = new Set(prev.fractions.map(f => f.label));
      let label = 'A';
      for (const ch of FRACTION_LETTERS) { if (!usedLabels.has(ch)) { label = ch; break; } }
      const zeroSizes = Object.fromEntries(Object.keys(prev.baseSizes).map(sz => [sz, 0]));
      const newRow = { label, multiplier: 0, sizes: zeroSizes };
      const next = [...prev.fractions.slice(0, -1), newRow, prev.fractions[prev.fractions.length - 1]];
      return { ...prev, fractions: recomputeLastFraction(next, prev.baseSizes, prev.gridConfig) };
    });
  };

  const removeFractionRow = (idx: number) => {
    setFractionModal(prev => {
      if (!prev || prev.fractions.length <= 2) return prev;
      const next = prev.fractions.filter((_, i) => i !== idx);
      return { ...prev, fractions: recomputeLastFraction(next, prev.baseSizes, prev.gridConfig) };
    });
  };

  const isFractionPlanValid = (fm: NonNullable<typeof fractionModal>): boolean => {
    if (fm.fractions.length < 2) return false;
    const lastSizes = fm.fractions[fm.fractions.length - 1].sizes;
    if (Object.values(lastSizes).some(q => q < 0)) return false;
    return fm.fractions.every(fr => Object.values(fr.sizes).reduce((a, b) => a + b, 0) > 0);
  };

  // Confirma o fracionamento: substitui a ficha original (mesmo índice no array, pra
  // não deslocar os índices de NENHUMA outra ficha do lote — outras OS já existentes
  // referenciam fichas por índice exato em `sourceItemKeys`) pela 1ª fração, e empilha
  // as demais no FINAL de `sourceItems`.
  const executeFractionFicha = async () => {
    if (!fractionModal) return;
    if (!isFractionPlanValid(fractionModal)) {
      toast.show('Confira as quantidades — alguma fração ficou negativa ou vazia.');
      return;
    }
    const { lot, si, siIdx, fractions, rootKey } = fractionModal;

    const buildFractionSourceItem = (fr: { label: string; sizes: Record<string, number> }) => {
      const sizes: Record<string, { total: number; fromStock: number; toProduction: number }> = {};
      let qty = 0;
      Object.entries(fr.sizes).forEach(([sz, q]) => {
        if (!q || q <= 0) return;
        sizes[sz] = { total: q, fromStock: 0, toProduction: q };
        qty += q;
      });
      return { ...si, qty, sizes, fractionLabel: fr.label, fractionRootKey: rootKey };
    };

    const newEntries = fractions.map(buildFractionSourceItem);
    const sourceItems: any[] = [...((lot as any).metadata?.sourceItems || [])];
    sourceItems[siIdx] = newEntries[0];
    for (let i = 1; i < newEntries.length; i++) sourceItems.push(newEntries[i]);

    try {
      await firebaseService.updateDocument('productionLots', lot.id, {
        metadata: { ...(lot as any).metadata, sourceItems },
      });
      toast.show(`Pedido fracionado em ${fractions.length} partes (${fractions.map(f => f.label).join(', ')}).`);
      setFractionModal(null);
    } catch (e) {
      console.error(e);
      toast.show('Erro ao fracionar pedido: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  // O mapa só tem UM ponteiro de posição (`currentSectorIndex`), mas modelos com
  // roteiros diferentes podem ter destinos diferentes — então o destino do mapa é o
  // setor para onde vai a maior parte das peças (em pares); os modelos que forem para
  // outro lugar são direcionados individualmente via `metadata.orderSectors`, do mesmo
  // jeito que o usuário já faz manualmente pelos botões "Direcionar p/".
  const resolveLotDestination = (items: LotAdvanceItem[]): string => {
    const totals = new Map<string, number>();
    items.forEach(it => totals.set(it.chosenSectorId, (totals.get(it.chosenSectorId) || 0) + it.qty));
    let destSectorId = items[0]?.chosenSectorId ?? '';
    let bestQty = -1;
    totals.forEach((qty, sectorId) => { if (qty > bestQty) { bestQty = qty; destSectorId = sectorId; } });
    return destSectorId;
  };

  // Detalhes de Setor > Separação de Solas por Ficha (Montagem) — pra um pedido da
  // Central de Compartilhamento, resolve qual molde/cor de solado ele consome e a
  // grade de numeração correspondente (mesma lógica de resolveSoleConsumption já
  // usada na baixa de estoque e nas reservas de solas).
  const buildSoleInfoForItem = (
    prod: Product | undefined, vari: Variation | undefined, ordItem: any, totalQty: number,
  ): PCPShareItem['soleInfo'] | undefined => {
    if (!prod || !vari) return undefined;
    const pairs: Record<string, number> = Object.entries(ordItem?.sizes || {}).reduce((acc: Record<string, number>, [sz, sData]: [string, any]) => {
      const q = Number(sData?.toProduction) || 0;
      if (q > 0) acc[sz] = q;
      return acc;
    }, {});
    const consumption = resolveSoleConsumption(prod, vari, pairs, totalQty, soleStock);
    if (!consumption) return undefined;

    const stockEntry = soleStock.find(s => String(s.moldId).trim() === consumption.moldId && String(s.colorId || '').trim() === consumption.colorId);
    const moldName = stockEntry?.moldName || productionConfigs.find(c => c.id === consumption.moldId)?.name || 'Solado';
    const colorName = stockEntry?.colorName || colors.find(c => c.id === consumption.colorId)?.name || '';

    const sizeGrid = Object.entries(consumption.gradeQuantities)
      .filter(([k]) => k !== 'pesagem' && k !== 'total')
      .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
      .map(([size, qty]) => ({ size, qty: Number(qty) || 0 }));
    const totalPairs = sizeGrid.reduce((acc, s) => acc + s.qty, 0);
    if (sizeGrid.length === 0 || totalPairs <= 0) return undefined;

    return [{ moldName, colorName, sizeGrid, totalPairs }];
  };

  // Funde as listas de soleInfo de dois itens ao agrupar fichas (ex.: "Agrupar
  // apenas por Referência" pode reunir cores diferentes que usam solados
  // diferentes entre si) — soma a grade quando o molde/cor já existe no destino,
  // ou inclui como uma entrada nova quando é um molde/cor ainda não visto.
  const mergeSoleInfo = (
    target: PCPShareItem['soleInfo'], source: PCPShareItem['soleInfo'],
  ): PCPShareItem['soleInfo'] => {
    if (!source || source.length === 0) return target;
    const result = (target || []).map(s => ({ ...s, sizeGrid: [...s.sizeGrid] }));
    for (const sole of source) {
      const match = result.find(s => s.moldName === sole.moldName && s.colorName === sole.colorName);
      if (match) {
        const soleSizeMap = new Map<string, number>();
        for (const s of match.sizeGrid) soleSizeMap.set(s.size, s.qty);
        for (const s of sole.sizeGrid) soleSizeMap.set(s.size, (soleSizeMap.get(s.size) || 0) + s.qty);
        match.sizeGrid = Array.from(soleSizeMap.entries()).map(([size, qty]) => ({ size, qty })).sort((a, b) => parseFloat(a.size) - parseFloat(b.size));
        match.totalPairs += sole.totalPairs;
      } else {
        result.push({ ...sole, sizeGrid: [...sole.sizeGrid] });
      }
    }
    return result;
  };

  // Constrói um PCPShareItem a partir de uma "ficha" (item selecionado na Central de
  // Compartilhamento, card de pedido por setor, linha de pedido do Mapa, etc.) — extraído
  // da Central de Compartilhamento pra ser reaproveitado também pelos botões "Print
  // Studio" do PCP (ficha, OS e Mapa), sem duplicar essa montagem de novo em cada um.
  const buildPCPShareItem = (f: any): PCPShareItem => {
    const order = f.order || productionOrders.find(o => o.id === (f.si?.orderId || f.productionOrderId || f.id));
    const ordItem = f.orderItem || (
      f.si && f.si.itemIdx !== undefined
        ? order?.items[f.si.itemIdx]
        : order?.items.find((i: any) => i.productId === (f.si?.productId || f.productId) && i.variationId === (f.si?.variationId || f.variationId))
    );

    const prod = f.product || products.find(p => p.id === (ordItem?.productId || f.si?.productId || f.productId));
    const vari = f.variation || prod?.variations.find((v: any) => v.id === (ordItem?.variationId || f.si?.variationId || f.variationId));

    // Fichas FRACIONADAS priorizam f.si.sizes (a fatia da fração) — ordItem.sizes é a
    // grade do pedido INTEIRO, compartilhada por todas as frações do mesmo pedido.
    const sizesSource = f.si?.fractionLabel ? (f.si?.sizes || ordItem?.sizes) : (ordItem?.sizes || f.si?.sizes);
    const sizes = Object.entries(sizesSource || {})
      .map(([sz, sData]: [string, any]) => ({ size: sz, qty: Number(sData.toProduction) || 0 }))
      .filter(s => s.qty > 0)
      .sort((a, b) => parseFloat(a.size) - parseFloat(b.size));

    const totalQty = sizes.reduce((acc, s) => acc + s.qty, 0);

    const os: ServiceOrder | undefined = f.coveringOS;
    const secEntries = Object.entries(vari?.sectorNotes || {})
      .filter(([sid]) => !os || sid === os.sectorId)
      .map(([sid, notes]) => ({ sid, notes: (notes as any[]).filter(n => n.text).map(n => n.text) }))
      .filter(({ notes }) => notes.length > 0)
      .map(({ sid, notes }) => {
        const sectorName = sectors.find(s => s.id === sid)?.name || 'Setor Desconhecido';
        return { sectorName, notes };
      });

    return {
      orderNumber: order?.saleOrderNumber || f.si?.orderId?.substring(0, 6) || '---',
      reference: prod?.reference || prod?.name || '---',
      color: vari?.colorName || '---',
      totalPairs: totalQty,
      sizeGrid: sizes,
      sectorNotes: secEntries,
      osNumber: os?.osNumber,
      providerName: os?.providerName,
      osValue: os?.totalValue,
      osDate: os?.createdAt,
      osSectorName: os ? (sectors.find(s => s.id === os.sectorId)?.name || os.sectorName) : undefined,
      soleInfo: buildSoleInfoForItem(prod, vari, { sizes: sizesSource }, totalQty),
    };
  };

  // Constrói os PCPShareItem (já agrupados, se groupMode !== 'none') a partir das fichas
  // selecionadas na Central de Compartilhamento — extraído de onConfirm/onPreview do
  // ExportNoteModal pra ser reaproveitado também por "Abrir no Print Studio", sem
  // triplicar essa montagem+agrupamento de novo.
  const buildGroupedShareItems = (
    selectedItems: any[], groupMode: 'none' | 'ref_color' | 'ref',
  ): { finalItems: PCPShareItem[]; lotNumbers: string } => {
    const uniqueLots = Array.from(new Set(selectedItems.map((f: any) => f.lot.id)))
      .map((id: any) => lots.find((l: any) => l.id === id))
      .filter(Boolean) as any[];

    const items: PCPShareItem[] = selectedItems.map(buildPCPShareItem);

    let finalItems = items;
    if (groupMode !== 'none') {
      const groupedMap = new Map<string, PCPShareItem>();
      for (const item of items) {
        const key = groupMode === 'ref' ? item.reference : `${item.reference}::${item.color}`;
        if (groupedMap.has(key)) {
          const existing = groupedMap.get(key)!;
          existing.totalPairs += item.totalPairs;
          if (groupMode === 'ref') {
            if (existing.color !== 'Várias' && existing.color !== item.color) {
              existing.color = 'Várias';
            }
          }
          existing.orderNumber = existing.orderNumber.includes(',') ? existing.orderNumber : `${existing.orderNumber}, ${item.orderNumber}`;

          const sizeMap = new Map<string, number>();
          for (const s of existing.sizeGrid) sizeMap.set(s.size, s.qty);
          for (const s of item.sizeGrid) sizeMap.set(s.size, (sizeMap.get(s.size) || 0) + s.qty);
          existing.sizeGrid = Array.from(sizeMap.entries()).map(([size, qty]) => ({ size, qty })).sort((a, b) => parseFloat(a.size) - parseFloat(b.size));

          existing.soleInfo = mergeSoleInfo(existing.soleInfo, item.soleInfo);
        } else {
          groupedMap.set(key, { ...item });
        }
      }
      finalItems = Array.from(groupedMap.values());
      for (const fi of finalItems) {
        if (fi.orderNumber.includes(',')) fi.orderNumber = 'Vários';
      }
    }

    const lotNumbers = uniqueLots.map(l => l.orderNumber).filter(Boolean).join(', ');
    return { finalItems, lotNumbers };
  };

  const applyLotAdvance = async (
    lot: ProductionLot, items: LotAdvanceItem[], currentSectorId: string, nextStatusId: string, notes: string,
  ): Promise<{ destSectorId: string; destSectorName: string; isFinished: boolean; skippedSectorNames: string[] }> => {
    const allSourceItems: any[] = (lot as any).metadata?.sourceItems || [];
    const reconstructedItems: { chosenSectorId: string; qty: number; skippedSectorNames: string[] }[] = [];

    if (allSourceItems.length > 0) {
      allSourceItems.forEach((si, idx) => {
        const movingItem = items.find(it => 
          it.siIdx === idx || getSourceItemKey(it) === getSourceItemKey({ orderId: si.orderId, ...si })
        );
        if (movingItem) {
          reconstructedItems.push({
            chosenSectorId: movingItem.chosenSectorId,
            qty: si.qty || 0,
            skippedSectorNames: movingItem.skippedSectorNames || [],
          });
        } else {
          const currentSector = getOrderEffectiveSector(lot, si.orderId, si);
          reconstructedItems.push({
            chosenSectorId: currentSector === ORDER_FINALIZED ? '' : currentSector,
            qty: si.qty || 0,
            skippedSectorNames: [],
          });
        }
      });
    } else {
      items.forEach(it => {
        reconstructedItems.push({
          chosenSectorId: it.chosenSectorId,
          qty: it.qty,
          skippedSectorNames: it.skippedSectorNames || [],
        });
      });
    }

    const isFinished = reconstructedItems.every(it => it.chosenSectorId === '');
    let destSectorId = '';
    if (!isFinished) {
      const activeReconstructed = reconstructedItems.filter(it => it.chosenSectorId !== '');
      const totals = new Map<string, number>();
      activeReconstructed.forEach(it => totals.set(it.chosenSectorId, (totals.get(it.chosenSectorId) || 0) + it.qty));
      let bestQty = -1;
      totals.forEach((qty, sectorId) => { if (qty > bestQty) { bestQty = qty; destSectorId = sectorId; } });
    }
    const destSectorName = isFinished ? 'CONCLUÍDO' : (sectors.find(s => s.id === destSectorId)?.name || destSectorId);

    const currentOrderSectors: Record<string, string> = (lot as any).metadata?.orderSectors || {};
    const updatedOrderSectors = { ...currentOrderSectors };

    if (allSourceItems.length > 0) {
      allSourceItems.forEach((si, idx) => {
        const movingItem = items.find(it => 
          it.siIdx === idx || getSourceItemKey(it) === getSourceItemKey({ orderId: si.orderId, ...si })
        );
        const targetSector = movingItem 
          ? movingItem.chosenSectorId 
          : getOrderEffectiveSector(lot, si.orderId, si);

        const order = productionOrders.find(o => o.id === si.orderId);
        const orderItem: any = si.itemIdx !== undefined
          ? order?.items[si.itemIdx]
          : order?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
        const resolvedProductId = si.productId || orderItem?.productId;
        const resolvedVariationId = si.variationId || orderItem?.variationId;

        const keyDirect = getSourceItemKey({ orderId: si.orderId, ...si });
        const keyResolved = getSourceItemKey({
          orderId: si.orderId,
          itemIdx: si.itemIdx,
          productId: resolvedProductId,
          variationId: resolvedVariationId,
          fractionLabel: si.fractionLabel,
        });
        const keyUnresolved = getSourceItemKey({
          orderId: si.orderId,
          itemIdx: si.itemIdx,
          productId: '',
          variationId: '',
          fractionLabel: si.fractionLabel,
        });

        if (movingItem && targetSector !== '' && targetSector !== ORDER_FINALIZED) {
          // Item que o usuário confirmou explicitamente no popup — grava o setor
          // escolhido sempre como override direto, mesmo quando ele bate com
          // destSectorId. destSectorId é só a maioria de pares do MAPA INTEIRO
          // (pode incluir outros itens não restritos por esta OS); depender dele
          // pra decidir "não precisa de override, o ponteiro do mapa já resolve"
          // é frágil — foi a causa de mapas com a escolha manual confirmada (ex.:
          // "Expedição") não saírem do setor atual, mesmo após "Confirmar e Avançar".
          updatedOrderSectors[keyDirect] = targetSector;
          updatedOrderSectors[keyResolved] = targetSector;
          updatedOrderSectors[keyUnresolved] = targetSector;
        } else if (targetSector === destSectorId) {
          delete updatedOrderSectors[keyDirect];
          delete updatedOrderSectors[keyResolved];
          delete updatedOrderSectors[keyUnresolved];
        } else if (targetSector === '' || targetSector === ORDER_FINALIZED) {
          updatedOrderSectors[keyDirect] = ORDER_FINALIZED;
          updatedOrderSectors[keyResolved] = ORDER_FINALIZED;
          updatedOrderSectors[keyUnresolved] = ORDER_FINALIZED;
        } else {
          updatedOrderSectors[keyDirect] = targetSector;
          updatedOrderSectors[keyResolved] = targetSector;
          updatedOrderSectors[keyUnresolved] = targetSector;
        }
        delete updatedOrderSectors[si.orderId];
      });
    } else {
      items.forEach(it => {
        const order = productionOrders.find(o => o.id === it.orderId);
        const orderItem: any = it.itemIdx !== undefined
          ? order?.items[it.itemIdx]
          : order?.items.find((i: any) => i.productId === it.productId && i.variationId === it.variationId);
        const resolvedProductId = it.productId || orderItem?.productId;
        const resolvedVariationId = it.variationId || orderItem?.variationId;

        const keyDirect = getSourceItemKey(it);
        const keyResolved = getSourceItemKey({
          orderId: it.orderId,
          itemIdx: it.itemIdx,
          productId: resolvedProductId,
          variationId: resolvedVariationId,
          fractionLabel: it.fractionLabel,
        });
        const keyUnresolved = getSourceItemKey({
          orderId: it.orderId,
          itemIdx: it.itemIdx,
          productId: '',
          variationId: '',
          fractionLabel: it.fractionLabel,
        });

        if (it.chosenSectorId === '') {
          updatedOrderSectors[keyDirect] = ORDER_FINALIZED;
          updatedOrderSectors[keyResolved] = ORDER_FINALIZED;
          updatedOrderSectors[keyUnresolved] = ORDER_FINALIZED;
        } else {
          // Sempre grava override direto pro setor escolhido, mesmo quando ele bate
          // com destSectorId — ver comentário equivalente no ramo allSourceItems acima.
          updatedOrderSectors[keyDirect] = it.chosenSectorId;
          updatedOrderSectors[keyResolved] = it.chosenSectorId;
          updatedOrderSectors[keyUnresolved] = it.chosenSectorId;
        }
        delete updatedOrderSectors[it.orderId];
      });
    }

    const route = lot.route || [];
    const advancedRoute = isFinished ? route : ensureSectorInRoute(route, destSectorId, sectors);
    const destItems = items.filter(it => it.chosenSectorId === destSectorId);
    const skippedSectorNames = Array.from(new Set(destItems.flatMap(it => it.skippedSectorNames)));

    const updatedLot = {
      ...lot,
      route: advancedRoute,
      currentSectorIndex: isFinished ? lot.currentSectorIndex : advancedRoute.indexOf(destSectorId),
      currentStatusId: isFinished ? lot.currentStatusId : nextStatusId,
      finishedAt: isFinished ? Date.now() : undefined,
      metadata: { ...(lot as any).metadata, orderSectors: updatedOrderSectors },
      history: [
        ...(lot.history || []),
        {
          sectorId: currentSectorId,
          statusId: nextStatusId,
          timestamp: Date.now(),
          userName: userName || 'Usuário',
          notes: notes || `Mapa avançado para "${destSectorName}".`,
        },
      ],
    };

    await onSaveLot(updatedLot);
    return { destSectorId, destSectorName, isFinished, skippedSectorNames };
  };

  // Abre a confirmação de avanço de setor: mostra cada modelo do mapa, sua quantidade
  // e o setor para onde será movido (já resolvido pelo roteiro do PRÓPRIO modelo),
  // permitindo ajustar manualmente antes de confirmar — em vez de avançar "às cegas"
  // e só descobrir depois que algum modelo pulou um setor que deveria passar.
  const openSectorChangeConfirm = (
    lot: ProductionLot,
    nextStatusId: string,
    notes: string,
    restrictTo?: { sourceItemKeys?: string[]; sourceOrderIds?: string[] },
    os?: ServiceOrder,
  ) => {
    const route = lot.route || [];
    const currentSectorId = route[lot.currentSectorIndex] || '';
    const items = buildLotAdvanceItems(lot, currentSectorId, restrictTo);
    setSectorChangeConfirm({ lot, nextStatusId, notes, currentSectorId, items, os });
  };

  // Quando uma única ação precisa avançar VÁRIOS mapas de uma vez (ex.: "Concluir e
  // baixar setor imediatamente" com vários mapas selecionados), abre a confirmação
  // um mapa por vez — em vez de mover todos silenciosamente — enfileirando o restante
  // para ser exibido assim que o usuário confirmar (ou cancelar) o mapa atual.
  const queueLotAdvanceConfirms = (entries: { lot: ProductionLot; nextStatusId: string; notes: string }[]) => {
    if (entries.length === 0) return;
    const [first, ...rest] = entries;
    setLotConfirmQueue(rest);
    openSectorChangeConfirm(first.lot, first.nextStatusId, first.notes);
  };

  const advanceLotConfirmQueue = () => {
    setLotConfirmQueue(prev => {
      if (prev.length === 0) {
        setIsDetailModalOpen(false);
        setSelectedLot(null);
        return prev;
      }
      const [next, ...rest] = prev;
      openSectorChangeConfirm(next.lot, next.nextStatusId, next.notes);
      return rest;
    });
  };

  const updateSectorChoiceItem = (key: string, sectorId: string) => {
    setSectorChangeConfirm(prev => prev ? {
      ...prev,
      items: prev.items.map(it => it.key === key ? { ...it, chosenSectorId: sectorId } : it),
    } : prev);
  };

  // Fecha o pop-up sem mover o mapa atual (cancelar/X/clique fora) — se houver mais
  // mapas enfileirados (ex.: baixa direta de vários mapas de uma vez), passa para o
  // próximo da fila em vez de simplesmente abandonar a confirmação dos demais.
  const closeSectorChangeConfirm = () => {
    setSectorChangeConfirm(null);
    advanceLotConfirmQueue();
  };

  const handleConfirmSectorChange = async () => {
    if (!sectorChangeConfirm) return;
    const { lot, nextStatusId, notes, currentSectorId, items, os } = sectorChangeConfirm;

    // Proteção de estoque: se o lote está saindo da Expedição sem ter passado por OS,
    // aciona a mesma baixa de estoque/entrega que aconteceria via handleCompleteOS.
    const currentSectorObj = sectors.find(s => s.id === currentSectorId);
    const isCycleEndSector = !!currentSectorObj?.isProductionCycleEnd ||
      !!currentSectorObj?.name?.toUpperCase().includes('EXPEDIÇÃO') ||
      !!currentSectorObj?.name?.toUpperCase().includes('EXPEDICAO') ||
      (lot.route && lot.route[lot.route.length - 1] === currentSectorId);
    if (isCycleEndSector) {
      const lotMeta = (lot as any).metadata;
      const sourceOrderIds: string[] = Array.from(new Set([
        ...(lot.productionOrderId ? [lot.productionOrderId] : []),
        ...(lotMeta?.sourceItems?.map((si: any) => si.orderId) || []),
      ]));
      if (sourceOrderIds.length > 0) {
        const { customerItems, stockItems } = classifyExpedicaoOrders(sourceOrderIds.map(orderId => ({ orderId })));
        if (stockItems.length > 0 || customerItems.length > 0) {
          const lines: string[] = ['Mapa saindo da Expedição'];
          if (customerItems.length > 0) lines.push(`📦 ${customerItems.length} pedido(s) → RESERVA PARA O CLIENTE (aguardando baixa manual na Venda)`);
          if (stockItems.length > 0) lines.push(`🏭 ${stockItems.length} pedido(s) → ENTRADA EM ESTOQUE`);
          lines.push('\nConfirmar baixa de expedição?');
          if (!confirm(lines.join('\n'))) { setSectorChangeConfirm(null); return; }
          await applyExpedicaoStockUpdate(lot, stockItems, customerItems);
        }
      }
    }

    const { destSectorName, isFinished } = await applyLotAdvance(lot, items, currentSectorId, nextStatusId, notes);

    if (os) {
      await firebaseService.updateDocument('serviceOrders', os.id, {
        status: 'COMPLETED',
        finishedAt: Date.now(),
      });
      if (os.transactionId) {
        try { await financeService.settleTransaction(os.transactionId); } catch { /* ignore */ }
      }
    }

    setSectorChangeConfirm(null);
    setOsFeedback({
      osNumber: `Mapa #${lot.orderNumber}`,
      nextSector: isFinished ? 'FINALIZADO' : destSectorName,
      action: isFinished ? 'Mapa de produção finalizado!' : `Mapa avançado para "${destSectorName}" conforme confirmado.`,
    });
    advanceLotConfirmQueue();
  };

  const handleRevertLot = async (lot: ProductionLot) => {
    if (!lot.history || lot.history.length === 0) return;
    if (!confirm(`Reverter o lote ${lot.orderNumber} para o setor anterior?`)) return;

    const newHistory = lot.history.slice(0, -1); // remove última movimentação
    const prevStatusId = newHistory.length > 0 ? newHistory[newHistory.length - 1].statusId : undefined;

    const revertedLot: ProductionLot = {
      ...lot,
      history: newHistory,
      currentStatusId: prevStatusId,
      finishedAt: undefined, // desfaz finalização se houver
      currentSectorIndex: lot.finishedAt
        ? (lot.route?.length ?? 1) - 1   // estava finalizado → volta ao último setor
        : Math.max(0, lot.currentSectorIndex - 1),
    };

    await onSaveLot(revertedLot);
    setSelectedLot(revertedLot);
  };

  const handleManualSectorOverride = async (lot: ProductionLot, targetSectorId: string) => {
    const targetSector = sectors.find(s => s.id === targetSectorId);
    if (!targetSector) return;

    const newRoute = ensureSectorInRoute(lot.route || [], targetSectorId, sectors);
    const updatedLot: ProductionLot = {
      ...lot,
      route: newRoute,
      currentSectorIndex: newRoute.indexOf(targetSectorId),
      currentStatusId: undefined,
      finishedAt: undefined,
      history: [
        ...(lot.history || []),
        {
          sectorId: lot.route?.[lot.currentSectorIndex] || '',
          statusId: '',
          timestamp: Date.now(),
          userName: userName || 'Usuário',
          notes: `Setor alterado manualmente para "${targetSector.name}" (correção do cálculo automático).`,
        },
      ],
    };
    await onSaveLot(updatedLot);
    setSelectedLot(updatedLot);
    setManualSectorPicker(null);
    setManualSectorMoveConfirm(null);
    setOsFeedback({ osNumber: `Mapa #${lot.orderNumber}`, nextSector: targetSector.name, action: 'Setor alterado manualmente com sucesso.' });
  };

  const handleManualFichasSectorOverride = async (fichas: any[], targetSectorId: string) => {
    const targetSector = sectors.find(s => s.id === targetSectorId);
    if (!targetSector) return;

    try {
      // Group selected fichas by lot, because they can belong to different lots
      const fichasByLot = new Map<string, any[]>();
      fichas.forEach(f => {
        if (!fichasByLot.has(f.lot.id)) fichasByLot.set(f.lot.id, []);
        fichasByLot.get(f.lot.id)!.push(f);
      });

      // Save each lot update
      for (const [lotId, lotFichas] of fichasByLot.entries()) {
        const lot = lotFichas[0].lot;

        // Ensure targetSectorId is in lot.route
        const newRoute = ensureSectorInRoute(lot.route || [], targetSectorId, sectors);

        const currentOrderSectors: Record<string, string> = (lot as any).metadata?.orderSectors || {};
        const updatedOrderSectors = { ...currentOrderSectors };

        lotFichas.forEach(f => {
          const order = productionOrders.find(o => o.id === f.si.orderId);
          const orderItem: any = f.si.itemIdx !== undefined
            ? order?.items[f.si.itemIdx]
            : order?.items.find((i: any) => i.productId === f.si.productId && i.variationId === f.si.variationId);
          const resolvedProductId = f.si.productId || orderItem?.productId;
          const resolvedVariationId = f.si.variationId || orderItem?.variationId;

          const keyDirect = getSourceItemKey(f.si);
          const keyResolved = getSourceItemKey({
            orderId: f.si.orderId,
            itemIdx: f.si.itemIdx,
            productId: resolvedProductId,
            variationId: resolvedVariationId,
          });
          const keyUnresolved = getSourceItemKey({
            orderId: f.si.orderId,
            itemIdx: f.si.itemIdx,
            productId: '',
            variationId: '',
          });

          updatedOrderSectors[keyDirect] = targetSectorId;
          updatedOrderSectors[keyResolved] = targetSectorId;
          updatedOrderSectors[keyUnresolved] = targetSectorId;
          delete updatedOrderSectors[f.si.orderId];
        });

        const updatedLot: ProductionLot = {
          ...lot,
          route: newRoute,
          metadata: {
            ...(lot as any).metadata,
            orderSectors: updatedOrderSectors
          },
          history: [
            ...(lot.history || []),
            {
              sectorId: lot.route?.[lot.currentSectorIndex] || '',
              statusId: '',
              timestamp: Date.now(),
              userName: userName || 'Usuário',
              notes: `${lotFichas.length} pedido(s) movidos manualmente para "${targetSector.name}".`,
            }
          ]
        };

        await onSaveLot(updatedLot);
      }

      setFichaSelection(new Set());
      setManualSectorPicker(null);
      setManualSectorMoveConfirm(null);
      setOsFeedback({
        osNumber: `${fichas.length} Pedido(s)`,
        nextSector: targetSector.name,
        action: 'Setor de pedidos alterado manualmente com sucesso.'
      });
    } catch (e) {
      console.error(e);
      toast.show("Erro ao mover pedidos: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleOpenOSModal = (lotsToProcess: ProductionLot | ProductionLot[], _sectorOverride?: string, _qtyOverride?: number, directOrderIds?: string[]) => {
    const list = Array.isArray(lotsToProcess) ? lotsToProcess : [lotsToProcess];

    // Guard: block duplicate whole-lot OS creation
    const firstLot = list[0];
    const effectiveCheckSectorId = _sectorOverride || pendingOsSectorOverride || (firstLot.route && firstLot.route[firstLot.currentSectorIndex]);
    if (effectiveCheckSectorId) {
      const blockingOS = serviceOrders.find(so =>
        list.some(l => so.lotId === l.id || (so.lotIds && so.lotIds.includes(l.id))) &&
        so.sectorId === effectiveCheckSectorId &&
        so.status === 'PENDING' &&
        (!so.sourceOrderIds || so.sourceOrderIds.length === 0)
      );
      if (blockingOS) {
        const sectorName = sectors.find(s => s.id === effectiveCheckSectorId)?.name || 'este setor';
        toast.show(`Já existe a OS ${blockingOS.osNumber} em aberto para este lote em "${sectorName}". Conclua ou exclua-a antes de emitir uma nova.`);
        return;
      }
    }

    onNavigate(ViewType.PRODUCTION_SERVICE_ORDER_FORM, null, {
      preselectedLots: list.map(l => l.id),
      sectorId: effectiveCheckSectorId,
      orderIds: directOrderIds || (pendingOsSourceOrderIds.length > 0 ? pendingOsSourceOrderIds : undefined)
    });

    setPendingOsSourceOrderIds([]);
    setPendingOsSectorOverride('');
    setPendingOsQuantityOverride(null);
  };

  const handleShareLotSheet = async (
    lot: ProductionLot,
    product: Product | undefined,
    variation: Variation | undefined,
    cardOS: ServiceOrder | null | undefined,
    format: 'pdf' | 'jpg',
    includeOS: boolean
  ) => {
    const colorName = variation?.colorName || '—';
    const os = includeOS ? cardOS || null : null;

    if (format === 'pdf') {
      printLotSheet({ lot, product, variationName: colorName, sectorName: sectors.find(s => s.id === selectedSectorId)?.name, os, productionConfigs });
      return;
    }

    setIsShareExporting(true);
    try {
      const pairs = lot.pairs || {};
      const sizes = Object.keys(pairs);
      const date = new Date().toLocaleDateString('pt-BR');

      const matSummary: Record<string, { name: string; ref: string; consumption: number; unit: string }> = {};
      (variation?.consumptions?.filter((c: any) => c.category === 'CUTTING_PIECE') || []).forEach((piece: any) => {
        const mat = productionConfigs.find(c => c.id === piece.materialId && c.type === 'MATERIAL');
        if (!mat) return;
        const unitName = productionConfigs.find(u => u.id === mat.metadata?.unitId)?.name || 'UN';
        const totalCons = lot.quantity * (Number(piece.quantity) || 0);
        if (!matSummary[mat.id]) matSummary[mat.id] = { name: mat.name, ref: mat.metadata?.reference || 'S/Ref', consumption: 0, unit: unitName };
        matSummary[mat.id].consumption += totalCons;
      });

      const materialsRows = Object.values(matSummary).length > 0
        ? Object.values(matSummary).map(m => `<tr><td style="font-weight:bold;border:1px solid #000;padding:5px 6px;">${m.name}</td><td style="border:1px solid #000;padding:5px 6px;">${m.ref}</td><td style="text-align:right;font-weight:900;border:1px solid #000;padding:5px 6px;">${m.consumption.toFixed(3)} ${m.unit}</td></tr>`).join('')
        : `<tr><td colspan="3" style="text-align:center;color:#6b7280;font-style:italic;border:1px solid #000;padding:5px 6px;">Sem materiais cadastrados</td></tr>`;

      const osBlock = os ? `<div style="margin-bottom:18px;padding:10px 14px;border:1.5px solid #000;border-radius:6px;background:#f9fafb;"><div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#374151;margin-bottom:4px;">Ordem de Serviço</div><div style="display:flex;gap:32px;flex-wrap:wrap;"><div><span style="font-size:9px;color:#6b7280;display:block;">Número</span><strong>${os.osNumber}</strong></div><div><span style="font-size:9px;color:#6b7280;display:block;">Prestador</span><strong>${os.providerName || '—'}</strong></div><div><span style="font-size:9px;color:#6b7280;display:block;">Total</span><strong>R$ ${os.totalValue.toFixed(2)}</strong></div></div></div>` : '';

      const sectorNotesHtmlEntries = Object.entries(variation?.sectorNotes || {})
        .map(([sid, notes]) => ({ sid, notes: (notes as SectorNote[]).filter(n => n.text) }))
        .filter(({ notes }) => notes.length > 0);
      const sectorNotesBlock = sectorNotesHtmlEntries.length > 0
        ? `<div style="margin-bottom:18px;padding:10px 14px;border:1.5px solid #4f46e5;border-radius:6px;background:#eef2ff;"><div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#4f46e5;margin-bottom:8px;">Instruções por Setor</div><div style="display:flex;flex-direction:column;gap:8px;">${sectorNotesHtmlEntries.map(({ sid, notes }) => { const sec = sectors.find(s => s.id === sid); if (!sec) return ''; return `<div><div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${sec.color || '#6366f1'};flex-shrink:0;"></span><span style="font-size:9px;font-weight:900;text-transform:uppercase;color:${sec.color || '#6366f1'};">${sec.name}</span></div><div style="margin-left:16px;border-left:2px solid ${sec.color || '#6366f1'};padding-left:8px;display:flex;flex-direction:column;gap:3px;">${notes.map(n => `<div>${n.name ? `<div style="font-size:8px;font-weight:900;color:#4f46e5;text-transform:uppercase;">${n.name}</div>` : ''}<div style="font-size:11px;font-weight:700;color:#1e1b4b;">${n.text}</div></div>`).join('')}</div></div>`; }).join('')}</div></div>`
        : '';

      const sizeHeaders = sizes.map(sz => `<th style="border:1px solid #000;padding:5px 6px;background:#e5e7eb;text-align:center;font-weight:900;font-size:10px;">${sz}</th>`).join('');
      const sizeCells = sizes.map(sz => `<td style="border:1px solid #000;padding:5px 6px;text-align:center;font-weight:900;font-size:13px;">${pairs[sz]}</td>`).join('');

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;';
      const el = document.createElement('div');
      el.style.cssText = 'width:794px;padding:48px;box-sizing:border-box;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:12px;line-height:1.4;';
      el.innerHTML = `
        <div style="display:table;width:100%;border-bottom:3px solid #000;padding-bottom:12px;margin-bottom:22px;">
          <div style="display:table-cell;vertical-align:middle;"><div style="font-size:26px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;margin:0;">GESTÃO PRO</div><div style="margin-top:3px;font-size:10px;font-weight:800;color:#4b5563;text-transform:uppercase;letter-spacing:2px;">Sistema de Produção &amp; PCP</div></div>
          <div style="display:table-cell;vertical-align:middle;text-align:right;"><span style="background:#e0f2fe;border:1.5px solid #000;color:#000;padding:4px 10px;border-radius:4px;font-weight:900;font-size:10px;display:inline-block;text-transform:uppercase;">Ficha Técnica – Materiais e Grade</span><div style="margin-top:6px;font-size:12px;font-weight:900;text-transform:uppercase;color:#374151;">Lote: #${lot.orderNumber} • Emissão: ${date}</div></div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:22px;" cellpadding="0" cellspacing="0"><tr>
          <td style="width:33%;padding-right:12px;vertical-align:top;"><div style="font-weight:800;text-transform:uppercase;font-size:10px;color:#374151;margin-bottom:2px;">Referência / Modelo</div><div style="font-weight:bold;font-size:13px;">${product?.name || '—'} <span style="font-weight:normal;color:#4b5563;">(${product?.reference || 'S/Ref'})</span></div></td>
          <td style="width:33%;padding-right:12px;vertical-align:top;"><div style="font-weight:800;text-transform:uppercase;font-size:10px;color:#374151;margin-bottom:2px;">Cor / Variação</div><div style="font-weight:bold;font-size:13px;">${colorName}</div></td>
          <td style="width:33%;vertical-align:top;"><div style="font-weight:800;text-transform:uppercase;font-size:10px;color:#374151;margin-bottom:2px;">Total de Pares</div><div style="font-weight:bold;font-size:13px;">${lot.quantity} Pares</div></td>
        </tr></table>
        ${osBlock}
        ${sectorNotesBlock}
        <div style="font-size:13px;font-weight:900;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:6px;margin-top:20px;">Requisição Consolidada de Materiais</div>
        <table style="width:100%;border-collapse:collapse;margin-top:10px;" cellpadding="0" cellspacing="0"><thead><tr><th style="border:1px solid #000;padding:5px 6px;background:#f3f4f6;font-weight:900;text-transform:uppercase;font-size:10px;text-align:left;">Código / Nome do Material</th><th style="border:1px solid #000;padding:5px 6px;background:#f3f4f6;font-weight:900;text-transform:uppercase;font-size:10px;text-align:left;">Referência</th><th style="border:1px solid #000;padding:5px 6px;background:#f3f4f6;font-weight:900;text-transform:uppercase;font-size:10px;text-align:right;width:180px;">Consumo Total Estimado</th></tr></thead><tbody>${materialsRows}</tbody></table>
        <div style="font-size:13px;font-weight:900;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:6px;margin-top:28px;">Grade Detalhada do Mapa</div>
        <table style="width:100%;border-collapse:collapse;margin-top:10px;" cellpadding="0" cellspacing="0"><thead><tr><th style="border:1px solid #000;padding:5px 6px;background:#f3f4f6;font-weight:900;text-transform:uppercase;font-size:10px;text-align:left;width:120px;">Tamanho</th>${sizeHeaders}<th style="border:1px solid #000;padding:5px 6px;background:#e5e7eb;text-align:center;font-weight:900;font-size:10px;width:80px;">TOTAL</th></tr></thead><tbody><tr><td style="border:1px solid #000;padding:5px 6px;font-weight:bold;">Pares</td>${sizeCells}<td style="border:1px solid #000;padding:5px 6px;text-align:center;font-weight:900;font-size:13px;background:#f3f4f6;">${lot.quantity}</td></tr></tbody></table>
      `;
      wrapper.appendChild(el);
      document.body.appendChild(wrapper);
      let dataUrl = '';
      try {
        void el.offsetHeight;
        const { toJpeg } = await import('html-to-image');
        dataUrl = await toJpeg(el, { quality: 0.93, pixelRatio: 2, backgroundColor: '#ffffff' });
      } finally {
        if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
      }
      const prefix = includeOS && os ? `Ficha_OS_${os.osNumber}` : `Ficha_Lote_${lot.orderNumber}`;
      await shareImage(dataUrl, `${prefix}.jpg`);
    } catch (err) {
      console.error('Erro ao gerar JPG:', err);
      toast.show('Erro ao gerar imagem. Tente novamente.');
    } finally {
      setIsShareExporting(false);
    }
  };

  const handleSharePedidoSheet = async (
    lot: ProductionLot,
    product: Product | undefined,
    variation: Variation | undefined,
    order: ProductionOrder | undefined,
    sizeEntries: [string, number][],
    totalQty: number,
    format: 'pdf' | 'jpg'
  ) => {
    const colorName = variation?.colorName || '—';
    const orderNumber = order?.saleOrderNumber || lot.saleOrderNumber;
    const customerName = order?.customerName || lot.customerName;
    const deliveryDate = order?.deliveryDate || lot.deliveryDate;
    const orderNotes = order?.notes;

    const sectorNotesEntries = Object.entries(variation?.sectorNotes || {})
      .map(([sid, notes]) => ({ sid, notes: (notes as SectorNote[]).filter(n => n.text) }))
      .filter(({ notes }) => notes.length > 0)
      .map(({ sid, notes }) => ({ sec: sectors.find(s => s.id === sid), notes }))
      .filter(({ sec }) => !!sec)
      .map(({ sec, notes }) => ({ sectorName: sec!.name, sectorColor: sec!.color, notes: notes.map(n => ({ name: n.name, text: n.text })) }));

    if (format === 'pdf') {
      printOrderItemSheet({ lot, product, variationName: colorName, orderNumber, customerName, deliveryDate, totalQty, sizeEntries, orderNotes, sectorNotes: sectorNotesEntries });
      return;
    }

    setIsPedidoShareExporting(true);
    try {
      const date = new Date().toLocaleDateString('pt-BR');

      const notesBlock = orderNotes
        ? `<div style="margin-bottom:18px;padding:10px 14px;border:1.5px solid #f59e0b;border-radius:6px;background:#fffbeb;"><div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#b45309;margin-bottom:4px;">Observação do Pedido</div><div style="font-size:12px;font-weight:700;color:#78350f;">${orderNotes}</div></div>`
        : '';

      const sectorNotesBlock = sectorNotesEntries.length > 0
        ? `<div style="margin-bottom:18px;padding:10px 14px;border:1.5px solid #4f46e5;border-radius:6px;background:#eef2ff;"><div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#4f46e5;margin-bottom:8px;">Instruções por Setor</div><div style="display:flex;flex-direction:column;gap:8px;">${sectorNotesEntries.map(sec => `<div><div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${sec.sectorColor || '#6366f1'};flex-shrink:0;"></span><span style="font-size:9px;font-weight:900;text-transform:uppercase;color:${sec.sectorColor || '#6366f1'};">${sec.sectorName}</span></div><div style="margin-left:16px;border-left:2px solid ${sec.sectorColor || '#6366f1'};padding-left:8px;display:flex;flex-direction:column;gap:3px;">${sec.notes.map(n => `<div>${n.name ? `<div style="font-size:8px;font-weight:900;color:#4f46e5;text-transform:uppercase;">${n.name}</div>` : ''}<div style="font-size:11px;font-weight:700;color:#1e1b4b;">${n.text}</div></div>`).join('')}</div></div>`).join('')}</div></div>`
        : '';

      const sizeHeaders = sizeEntries.map(([sz]) => `<th style="border:1px solid #000;padding:5px 6px;background:#e5e7eb;text-align:center;font-weight:900;font-size:10px;">${sz}</th>`).join('');
      const sizeCells = sizeEntries.map(([, q]) => `<td style="border:1px solid #000;padding:5px 6px;text-align:center;font-weight:900;font-size:13px;">${q}</td>`).join('');

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;';
      const el = document.createElement('div');
      el.style.cssText = 'width:794px;padding:48px;box-sizing:border-box;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:12px;line-height:1.4;';
      el.innerHTML = `
        <div style="display:table;width:100%;border-bottom:3px solid #000;padding-bottom:12px;margin-bottom:22px;">
          <div style="display:table-cell;vertical-align:middle;"><div style="font-size:26px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;margin:0;">GESTÃO PRO</div><div style="margin-top:3px;font-size:10px;font-weight:800;color:#4b5563;text-transform:uppercase;letter-spacing:2px;">Sistema de Produção &amp; PCP</div></div>
          <div style="display:table-cell;vertical-align:middle;text-align:right;"><span style="background:#e0f2fe;border:1.5px solid #000;color:#000;padding:4px 10px;border-radius:4px;font-weight:900;font-size:10px;display:inline-block;text-transform:uppercase;">Ficha de Pedido</span><div style="margin-top:6px;font-size:12px;font-weight:900;text-transform:uppercase;color:#374151;">Mapa: #${lot.orderNumber}${orderNumber ? ` • Pedido: ${orderNumber}` : ''} • Emissão: ${date}</div></div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:22px;" cellpadding="0" cellspacing="0"><tr>
          <td style="width:33%;padding-right:12px;vertical-align:top;"><div style="font-weight:800;text-transform:uppercase;font-size:10px;color:#374151;margin-bottom:2px;">Referência / Modelo</div><div style="font-weight:bold;font-size:13px;">${product?.name || '—'} <span style="font-weight:normal;color:#4b5563;">(${product?.reference || 'S/Ref'})</span></div></td>
          <td style="width:33%;padding-right:12px;vertical-align:top;"><div style="font-weight:800;text-transform:uppercase;font-size:10px;color:#374151;margin-bottom:2px;">Cor / Variação</div><div style="font-weight:bold;font-size:13px;">${colorName}</div></td>
          <td style="width:33%;vertical-align:top;"><div style="font-weight:800;text-transform:uppercase;font-size:10px;color:#374151;margin-bottom:2px;">Total de Pares</div><div style="font-weight:bold;font-size:13px;">${totalQty} Pares</div></td>
        </tr>
        ${(customerName || deliveryDate) ? `<tr>
          ${customerName ? `<td style="padding-top:10px;vertical-align:top;"><div style="font-weight:800;text-transform:uppercase;font-size:10px;color:#374151;margin-bottom:2px;">Cliente</div><div style="font-weight:bold;font-size:13px;">${customerName}</div></td>` : '<td></td>'}
          ${deliveryDate ? `<td style="padding-top:10px;vertical-align:top;"><div style="font-weight:800;text-transform:uppercase;font-size:10px;color:#374151;margin-bottom:2px;">Entrega</div><div style="font-weight:bold;font-size:13px;">${new Date(deliveryDate).toLocaleDateString('pt-BR')}</div></td>` : '<td></td>'}
          <td></td>
        </tr>` : ''}
        </table>
        ${notesBlock}
        ${sectorNotesBlock}
        <div style="font-size:13px;font-weight:900;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:6px;margin-top:20px;">Grade de Produção</div>
        <table style="width:100%;border-collapse:collapse;margin-top:10px;" cellpadding="0" cellspacing="0"><thead><tr><th style="border:1px solid #000;padding:5px 6px;background:#f3f4f6;font-weight:900;text-transform:uppercase;font-size:10px;text-align:left;width:120px;">Tamanho</th>${sizeHeaders}<th style="border:1px solid #000;padding:5px 6px;background:#e5e7eb;text-align:center;font-weight:900;font-size:10px;width:80px;">TOTAL</th></tr></thead><tbody><tr><td style="border:1px solid #000;padding:5px 6px;font-weight:bold;">Pares</td>${sizeCells}<td style="border:1px solid #000;padding:5px 6px;text-align:center;font-weight:900;font-size:13px;background:#f3f4f6;">${totalQty}</td></tr></tbody></table>
      `;
      wrapper.appendChild(el);
      document.body.appendChild(wrapper);
      let dataUrl = '';
      try {
        void el.offsetHeight;
        const { toJpeg } = await import('html-to-image');
        dataUrl = await toJpeg(el, { quality: 0.93, pixelRatio: 2, backgroundColor: '#ffffff' });
      } finally {
        if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
      }
      await shareImage(dataUrl, `Ficha_Pedido_${orderNumber || lot.orderNumber}.jpg`);
    } catch (err) {
      console.error('Erro ao gerar JPG:', err);
      toast.show('Erro ao gerar imagem. Tente novamente.');
    } finally {
      setIsPedidoShareExporting(false);
    }
  };

  // Classifica pedidos/itens em "destino cliente" vs "destino estoque". Cada entrada
  // identifica um pedido (orderId) ou, quando `itemIdx` é informado, um ÚNICO item
  // (modelo/cor) dentro de um pedido de compra que agrupa vários itens — preservado
  // até `applyExpedicaoStockUpdate` para que a baixa afete só o item finalizado.
  const classifyExpedicaoOrders = (items: { orderId: string; itemIdx?: number; fractionLabel?: string }[]) => {
    const customerItems: { orderId: string; itemIdx?: number; fractionLabel?: string }[] = [];
    const stockItems: { orderId: string; itemIdx?: number; fractionLabel?: string }[] = [];
    for (const item of items) {
      const prodOrder = productionOrders.find(o => o.id === item.orderId);
      if (!prodOrder) continue;
      const sale = sales?.find(s => s.id === prodOrder.saleId);
      // Venda cancelada (excluída/estornada após a produção já ter "baixa" em algum
      // setor): a produção segue normalmente, mas as caixas deixam de ser reservadas
      // para essa venda e entram no estoque geral.
      const isStockDestination = prodOrder.customerName?.toLowerCase() === 'estoque' || sale?.saleDestination === 'STOCK' || sale?.status === SaleStatus.CANCELLED;
      if (isStockDestination) stockItems.push(item);
      else customerItems.push(item);
    }
    return { customerItems, stockItems };
  };

  // Resolve um sourceItem (lot.metadata.sourceItems) na produção/produto/variação
  // correspondente e na grade exata produzida (size -> qty, a partir de
  // ordItem.sizes[size].toProduction) — usado tanto para a baixa de soladoStock
  // quanto para a criação dos StockLots (Estoque e Pedidos).
  const resolveSourceItem = (si: any) => {
    const prodOrder = productionOrders.find(o => o.id === si.orderId);
    if (!prodOrder) return null;
    const itemIdx = si.itemIdx;
    const ordItem: any = itemIdx !== undefined
      ? prodOrder.items[itemIdx]
      : prodOrder.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
    if (!ordItem) return null;
    const prod = products.find(p => p.id === (si.productId || ordItem.productId));
    if (!prod) return null;
    const vari = prod.variations.find(v => v.id === (si.variationId || ordItem.variationId));
    if (!vari) return null;

    const siQty: number = si.qty || 0;

    // Prioridade para montar a grade por tamanho que vai a resolveSoleConsumption:
    //   1. Snapshot da fração (si.sizes com fractionLabel) — já tem a fatia exata.
    //   2. Padrão de embalagem cadastrado × nº de caixas: é a fonte mais confiável para
    //      a DISTRIBUIÇÃO por faixa em pedidos ATACADO (grade padrão), pois define exatamente
    //      quantos pares por faixa cabem numa caixa (ex.: 38-39: 12, 40-41: 24, 42-43: 12).
    //      ordItem.sizes pode ter distribuição diferente (ex.: igual entre tamanhos) que não
    //      corresponde ao padrão físico de embalagem — isso causava desconto errado por faixa.
    //   3. Fallback: ordItem.sizes ou si.sizes (qualquer um disponível), escalado por si.qty
    //      quando o total diferir do qtd real do lote.
    let pairs: Record<string, number> = {};

    if (si.fractionLabel && si.sizes) {
      // Fração explícita: usa sempre o snapshot da fração
      Object.entries(si.sizes as Record<string, any>).forEach(([size, sData]) => {
        const qty = Number(sData?.toProduction) || 0;
        if (qty > 0) pairs[size] = qty;
      });
    } else if (siQty > 0) {
      // Tenta embalagem cadastrada para obter a distribuição correta por faixa
      const gridId = prod.productionGridId || prod.defaultGridId;
      if (gridId) {
        const pkg = productionConfigs.find(c => c.type === 'PACKAGING' && (c.metadata as any)?.productionGradeId === gridId);
        const pkgBreakdown = (pkg?.metadata as any)?.sizeQuantities as Record<string, number> | undefined;
        const boxConfig: Record<string, number> | null = (pkgBreakdown && Object.values(pkgBreakdown).some(q => (q || 0) > 0))
          ? pkgBreakdown
          : (grids.find(g => g.id === gridId)?.configuration || null);

        if (boxConfig) {
          const pairsPerBox = Object.values(boxConfig).reduce((s, q) => s + (q || 0), 0);
          if (pairsPerBox > 0) {
            const numBoxes = Math.round(siQty / pairsPerBox);
            if (numBoxes > 0) {
              Object.entries(boxConfig).forEach(([sz, qPerBox]) => {
                const p = Math.round((qPerBox || 0) * numBoxes);
                if (p > 0) pairs[sz] = p;
              });
            }
          }
        }
      }

      // Fallback: ordItem.sizes ou si.sizes escalado por si.qty
      if (Object.keys(pairs).length === 0) {
        const sizesSource = si.sizes || ordItem.sizes;
        const rawPairs: Record<string, number> = {};
        Object.entries(sizesSource || {}).forEach(([size, sData]: any) => {
          const qty = Number(sData?.toProduction) || 0;
          if (qty > 0) rawPairs[size] = qty;
        });
        const rawTotal = Object.values(rawPairs).reduce((s, q) => s + q, 0);
        if (rawTotal > 0 && siQty !== rawTotal) {
          const scale = siQty / rawTotal;
          const sizeKeys = Object.keys(rawPairs);
          let distributed = 0;
          sizeKeys.forEach((sz, i) => {
            if (i === sizeKeys.length - 1) {
              const rem = siQty - distributed;
              if (rem > 0) pairs[sz] = rem;
            } else {
              const s = Math.round(rawPairs[sz] * scale);
              if (s > 0) { pairs[sz] = s; distributed += s; }
            }
          });
        } else {
          pairs = rawPairs;
        }
      }
    }

    const totalQty = Object.values(pairs).reduce((s, q) => s + q, 0);
    const gradeLabel = Object.entries(pairs).map(([sz, q]) => `${sz}x${q}`).join('-');

    return { prodOrder, ordItem, prod, vari, pairs, totalQty, gradeLabel, itemIdx };
  };

  // Aplica a baixa de estoque para pedidos que saíram da Expedição. Para pedidos com
  // destino "Estoque", incrementa o estoque geral do produto e registra um StockLot
  // EM_ESTOQUE com a grade exata produzida. Para pedidos vinculados a um cliente,
  // registra um StockLot RESERVADO (vinculado à venda) — a venda só é marcada como
  // entregue manualmente, via "Liberar Pedido" (Vendas).
  // Chamado tanto pela conclusão de OS quanto pelo avanço direto de setor ("Próximo Setor").
  const applyExpedicaoStockUpdate = async (
    lot: ProductionLot,
    stockItems: { orderId: string; itemIdx?: number; fractionLabel?: string }[],
    customerItems: { orderId: string; itemIdx?: number; fractionLabel?: string }[],
  ) => {
    // Um pedido de compra pode agrupar vários itens (modelos/cores) sob o mesmo
    // orderId — quando `item.itemIdx` é informado, casa apenas o sourceItem daquele
    // item específico; quando não, casa TODOS os sourceItems daquele orderId (caso
    // de finalizações "pedido inteiro", ex.: conclusão de OS/avanço de mapa).
    // `fractionLabel` distingue FRAÇÕES do mesmo pedido (mesmo orderId+itemIdx) por
    // CONTEÚDO — não pela posição no array (frágil: some/reordena se outro item do
    // mesmo mapa for removido entre montar a confirmação e aplicá-la). Sem essa
    // distinção, baixar uma fração arrastaria junto a quantidade das frações irmãs
    // ainda não baixadas, duplicando consumo de solado e crédito de estoque.
    const matchesItem = (si: any, item: { orderId: string; itemIdx?: number; fractionLabel?: string }) => {
      if (si.orderId !== item.orderId) return false;
      if (item.itemIdx !== undefined && si.itemIdx !== item.itemIdx) return false;
      return (si.fractionLabel || undefined) === (item.fractionLabel || undefined);
    };

    // Proteção contra baixa duplicada: esta função NÃO tinha nenhuma guarda contra ser
    // chamada mais de uma vez pro mesmo item (ex.: o mesmo pedido passando por "Dar
    // Baixa" + "Confirmar e Avançar" repetidas vezes por um ciclo que não avançava de
    // verdade) — cada chamada creditava estoque de novo, inflando os números. Um item
    // já marcado ORDER_FINALIZED (por uma chamada anterior desta mesma função) nunca
    // deve ser processado de novo.
    const lotSIForGuard: any[] = (lot as any).metadata?.sourceItems || [];
    const isAlreadyFinalized = (item: { orderId: string; itemIdx?: number; fractionLabel?: string }) => {
      const si = lotSIForGuard.find((s: any) => matchesItem(s, item));
      if (!si) return false;
      return getOrderEffectiveSector(lot, item.orderId, si) === ORDER_FINALIZED;
    };
    stockItems = stockItems.filter(it => !isAlreadyFinalized(it));
    customerItems = customerItems.filter(it => !isAlreadyFinalized(it));

    // Dá baixa real no estoque de solados (soleStock) para todos os pedidos que saíram da
    // Expedição, independente do destino (estoque ou cliente), consumindo os pares por
    // molde/cor/grade usando a mesma lógica de mapeamento das reservas (resolveSoleConsumption).
    const allItems = [...stockItems, ...customerItems];
    const lotSI: any[] = (lot as any).metadata?.sourceItems || [];
    if (allItems.length > 0) {
      const consumedSI = lotSI.filter((si: any) => allItems.some(it => matchesItem(si, it)));
      const consumptionByKey = new Map<string, { moldId: string; colorId: string; gradeQuantities: Record<string, number> }>();

      for (const si of consumedSI) {
        const resolved = resolveSourceItem(si);
        if (!resolved || resolved.totalQty <= 0) continue;
        const { prod, vari, pairs, totalQty } = resolved;

        const consumption = resolveSoleConsumption(prod, vari, pairs, totalQty, soleStock);
        if (!consumption) continue;

        const key = `${consumption.moldId}_${consumption.colorId || 'default'}`;
        const existing = consumptionByKey.get(key);
        if (!existing) {
          consumptionByKey.set(key, { moldId: consumption.moldId, colorId: consumption.colorId, gradeQuantities: { ...consumption.gradeQuantities } });
        } else {
          Object.entries(consumption.gradeQuantities).forEach(([gradeKey, qty]) => {
            existing.gradeQuantities[gradeKey] = (existing.gradeQuantities[gradeKey] || 0) + qty;
          });
        }
      }

      for (const { moldId, colorId, gradeQuantities } of consumptionByKey.values()) {
        const entry = soleStock.find(s => String(s.moldId).trim() === moldId && String(s.colorId || '').trim() === colorId);

        const updatedStock = entry ? { ...entry.stock } : {};
        Object.entries(gradeQuantities).forEach(([gradeKey, qty]) => {
          updatedStock[gradeKey] = (updatedStock[gradeKey] || 0) - qty;
        });
        const totalPairs = Object.entries(updatedStock)
          .filter(([k]) => k !== 'pesagem' && k !== 'total')
          .reduce((s, [, v]) => s + (Number(v) || 0), 0);

        if (entry) {
          await firebaseService.updateDocument('soleStock', entry.id, { stock: updatedStock, totalPairs, updatedAt: Date.now() });
        } else {
          const mold = productionConfigs.find(c => c.id === moldId);
          const color = colors.find(c => c.id === colorId);
          await firebaseService.saveDocument('soleStock', {
            moldId,
            moldName: mold?.name || '',
            colorId,
            colorName: color?.name || '',
            supplierId: '',
            supplierName: 'Baixa de Produção',
            stock: updatedStock,
            totalPairs,
            unitCost: 0,
            totalCost: 0,
            purchaseDate: Date.now(),
            notes: 'Criado automaticamente na baixa com estoque negativo'
          });
        }
      }
    }

    // Pedidos destino "Estoque": mantém o incremento de variation.stock e registra
    // um StockLot EM_ESTOQUE com a composição exata da caixa produzida.
    if (stockItems.length > 0) {
      const stockSI = lotSI.filter((si: any) => stockItems.some(it => matchesItem(si, it)));
      // Vários sourceItems (cores diferentes) podem pertencer ao MESMO produto — acumula
      // os incrementos de `variations` aqui e grava uma única vez por produto ao final.
      // Gravar a cada iteração a partir do snapshot original de `prod.variations` faria
      // a última cor processada sobrescrever (perder) o incremento das cores anteriores.
      const productVariationsMap = new Map<string, Product['variations']>();
      for (const si of stockSI) {
        const resolved = resolveSourceItem(si);
        if (!resolved || resolved.totalQty <= 0) continue;
        const { prodOrder, ordItem, prod, vari, pairs, totalQty, gradeLabel, itemIdx } = resolved;

        let entryBoxQty: number | undefined;
        let entryPkg: ProductionConfigItem | undefined;

        const baseVariations = productVariationsMap.get(prod.id) || prod.variations;
        const variIdx = baseVariations.findIndex(v => v.id === vari.id);
        const updVars = baseVariations.map((v, idx) => {
          if (idx !== variIdx) return v;
          const newStock = { ...v.stock };
          if ((ordItem.saleType ?? prod.type) === SaleType.WHOLESALE) {
            // ATACADO: "Estoque Global" (CAIXAS) é incrementado convertendo os pares
            // produzidos pela embalagem cujo "Grade de Produção Padrão" corresponde à
            // grade de produção do produto (pares por caixa). Mesma prioridade de
            // resolveSourceItem: sizeQuantities → capacity → grid.configuration sum.
            const gridId = prod.productionGridId || prod.defaultGridId;
            const defaultPkg = productionConfigs.find(c => c.type === 'PACKAGING' && c.metadata?.productionGradeId === gridId);
            const pkgSizeQtys = (defaultPkg?.metadata as any)?.sizeQuantities as Record<string, number> | undefined;
            const sizeQtysSum = pkgSizeQtys ? Object.values(pkgSizeQtys).reduce((s, q) => s + (q || 0), 0) : 0;
            let pairsPerBox: number = sizeQtysSum > 0
              ? sizeQtysSum
              : ((defaultPkg?.metadata?.capacity as number | undefined) || 0);
            if (!pairsPerBox) {
              const grid = grids.find(gr => gr.id === gridId);
              pairsPerBox = grid ? Object.values(grid.configuration).reduce((a: number, b: number) => a + b, 0) : 12;
            }
            const boxesProduced = Math.round(totalQty / Math.max(1, pairsPerBox));
            newStock['WHOLESALE'] = (newStock['WHOLESALE'] || 0) + boxesProduced;
            entryBoxQty = boxesProduced;
            entryPkg = defaultPkg;

            if (defaultPkg && boxesProduced > 0) {
              const allocations = [...(v.stockPkgAllocations || [])];
              const allocIdx = allocations.findIndex(a => a.pkgId === defaultPkg.id);
              if (allocIdx >= 0) {
                allocations[allocIdx] = { ...allocations[allocIdx], qty: allocations[allocIdx].qty + boxesProduced };
              } else {
                allocations.push({ pkgId: defaultPkg.id, qty: boxesProduced });
              }
              return { ...v, stock: newStock, stockPkgAllocations: allocations };
            }
          } else {
            Object.entries(pairs).forEach(([size, qty]) => {
              newStock[size] = (newStock[size] || 0) + qty;
            });
          }
          return { ...v, stock: newStock };
        });
        productVariationsMap.set(prod.id, updVars);

        const stockLot: Omit<StockLot, 'id'> = {
          productId: prod.id,
          productName: prod.name,
          productReference: prod.reference,
          variationId: vari.id,
          variationName: vari.colorName,
          sizeBreakdown: pairs,
          totalPairs: totalQty,
          gradeLabel,
          status: 'EM_ESTOQUE',
          lotId: lot.id,
          lotOrderNumber: lot.orderNumber,
          productionOrderId: si.orderId,
          productionOrderNumber: prodOrder.orderNumber,
          itemIdx,
          boxQty: entryBoxQty,
          pkgId: entryPkg?.id,
          pkgName: entryPkg?.name,
          saleId: prodOrder.saleId,
          saleOrderNumber: prodOrder.saleOrderNumber,
          customerName: prodOrder.customerName,
          createdAt: Date.now(),
        };
        await firebaseService.saveDocument('stockLots', stockLot);
      }

      for (const [productId, variations] of productVariationsMap.entries()) {
        await firebaseService.updateDocument('products', productId, { variations });
      }
    }

    // Pedidos vinculados a cliente: NÃO marca a venda como entregue automaticamente
    // nem altera variation.stock — registra um StockLot RESERVADO com a composição
    // exata produzida, vinculado à venda. A liberação ao cliente é manual (Vendas).
    if (customerItems.length > 0) {
      const customerSI = lotSI.filter((si: any) => customerItems.some(it => matchesItem(si, it)));
      for (const si of customerSI) {
        const resolved = resolveSourceItem(si);
        if (!resolved || resolved.totalQty <= 0) continue;
        const { prodOrder, prod, vari, pairs, totalQty, gradeLabel, itemIdx } = resolved;

        const sale = sales?.find(s => s.id === prodOrder.saleId);

        const stockLot: Omit<StockLot, 'id'> = {
          productId: prod.id,
          productName: prod.name,
          productReference: prod.reference,
          variationId: vari.id,
          variationName: vari.colorName,
          sizeBreakdown: pairs,
          totalPairs: totalQty,
          gradeLabel,
          status: 'RESERVADO',
          lotId: lot.id,
          lotOrderNumber: lot.orderNumber,
          productionOrderId: si.orderId,
          productionOrderNumber: prodOrder.orderNumber,
          itemIdx,
          saleId: prodOrder.saleId,
          saleOrderNumber: sale?.orderNumber || prodOrder.saleOrderNumber,
          customerName: sale?.customerName || prodOrder.customerName,
          createdAt: Date.now(),
        };
        await firebaseService.saveDocument('stockLots', stockLot);
      }
    }
  };

  // Varre dois tipos de problema:
  // A) StockLots EM_ESTOQUE de produtos ATACADO sem boxQty — bug onde ordItem.saleType
  //    não tinha fallback para prod.type, creditando pares por tamanho em vez de caixas.
  // B) sourceItems de lotes marcados ORDER_FINALIZED mas sem StockLot correspondente —
  //    bug onde executeOsBaixaPanel não chamava applyExpedicaoStockUpdate fora de Expedição.
  const buildStockRepairItems = (): StockRepairItem[] => {
    const result: StockRepairItem[] = [];

    // --- Tipo A: StockLot existe mas sem boxQty ---
    for (const sl of stockLots) {
      if (sl.status !== 'EM_ESTOQUE') continue;
      if (sl.boxQty != null && sl.boxQty > 0) continue;
      const prod = products.find(p => p.id === sl.productId);
      if (!prod) continue;
      if ((prod.type ?? SaleType.WHOLESALE) !== SaleType.WHOLESALE) continue;
      const vari = prod.variations.find(v => v.id === sl.variationId);
      if (!vari) continue;
      const gridId = prod.productionGridId || prod.defaultGridId;
      const defaultPkg = productionConfigs.find(c => c.type === 'PACKAGING' && (c.metadata as any)?.productionGradeId === gridId);
      const pkgSizeQtys = (defaultPkg?.metadata as any)?.sizeQuantities as Record<string, number> | undefined;
      const sizeQtysSum = pkgSizeQtys ? Object.values(pkgSizeQtys).reduce((s, q) => s + (q || 0), 0) : 0;
      let pairsPerBox: number = sizeQtysSum > 0 ? sizeQtysSum : ((defaultPkg?.metadata?.capacity as number | undefined) || 0);
      if (!pairsPerBox) {
        const grid = grids.find(g => g.id === gridId);
        pairsPerBox = grid ? Object.values(grid.configuration).reduce((a: number, b: number) => a + b, 0) : 12;
      }
      const correctBoxQty = Math.round((sl.totalPairs || 0) / Math.max(1, pairsPerBox));
      if (correctBoxQty <= 0) continue;
      result.push({
        kind: 'fix_boxqty', selected: true,
        stockLotId: sl.id, lotOrderNumber: sl.lotOrderNumber || '',
        productId: prod.id, productName: prod.name,
        variationId: vari.id, variationName: vari.colorName,
        sizeBreakdown: (sl.sizeBreakdown as Record<string, number>) || {},
        totalPairs: sl.totalPairs || 0, correctBoxQty, pairsPerBox,
        currentWholesaleStock: (vari.stock as any)?.['WHOLESALE'] || 0,
        pkgId: defaultPkg?.id, pkgName: defaultPkg?.name,
      });
    }

    // --- Tipo B: Finalizado sem StockLot ---
    for (const lot of lots) {
      const sourceItems: any[] = (lot as any).metadata?.sourceItems || [];
      if (sourceItems.length === 0) continue;
      for (const si of sourceItems) {
        if (getOrderEffectiveSector(lot, si.orderId, si) !== ORDER_FINALIZED) continue;
        // Verifica se já existe StockLot para este item
        const hasStockLot = stockLots.some(sl =>
          sl.lotId === lot.id && sl.productionOrderId === si.orderId &&
          (si.itemIdx === undefined || sl.itemIdx === si.itemIdx)
        );
        if (hasStockLot) continue;
        // Verifica se é pedido de produção válido
        const prodOrder = productionOrders.find(o => o.id === si.orderId);
        if (!prodOrder) continue;
        const ordItem: any = si.itemIdx !== undefined
          ? prodOrder.items[si.itemIdx]
          : prodOrder.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
        if (!ordItem) continue;
        const prod = products.find(p => p.id === (si.productId || ordItem.productId));
        if (!prod) continue;
        const vari = prod.variations.find(v => v.id === (si.variationId || ordItem.variationId));
        if (!vari) continue;
        result.push({
          kind: 'create_stocklot', selected: true,
          lotId: lot.id, lotOrderNumber: lot.orderNumber || '',
          orderId: si.orderId, itemIdx: si.itemIdx, fractionLabel: si.fractionLabel,
          productName: prod.name, variationName: vari.colorName,
          qty: si.qty || 0,
        });
      }
    }

    return result;
  };

  const executeStockRepair = async () => {
    if (!stockRepairModal) return;
    const selected = stockRepairModal.items.filter(it => it.selected);
    if (selected.length === 0) return;
    setStockRepairModal(prev => prev ? { ...prev, phase: 'running' } : prev);
    try {
      // Tipo A: corrigir boxQty em StockLots que foram creditados como VAREJO
      const fixBoxQty = selected.filter((it): it is Extract<StockRepairItem, { kind: 'fix_boxqty' }> => it.kind === 'fix_boxqty');
      if (fixBoxQty.length > 0) {
        const productVariationsMap = new Map<string, Product['variations']>();
        for (const item of fixBoxQty) {
          const prod = products.find(p => p.id === item.productId)!;
          const baseVariations = productVariationsMap.get(prod.id) || prod.variations;
          const variIdx = baseVariations.findIndex(v => v.id === item.variationId);
          const updVars = baseVariations.map((v, idx) => {
            if (idx !== variIdx) return v;
            const newStock = { ...v.stock } as Record<string, number>;
            Object.entries(item.sizeBreakdown).forEach(([sz, qty]) => {
              newStock[sz] = Math.max(0, (newStock[sz] || 0) - qty);
              if (!newStock[sz]) delete newStock[sz];
            });
            newStock['WHOLESALE'] = (newStock['WHOLESALE'] || 0) + item.correctBoxQty;
            return { ...v, stock: newStock };
          });
          productVariationsMap.set(prod.id, updVars);
          await firebaseService.updateDocument('stockLots', item.stockLotId, {
            boxQty: item.correctBoxQty,
            ...(item.pkgId ? { pkgId: item.pkgId, pkgName: item.pkgName } : {}),
          });
        }
        for (const [productId, variations] of productVariationsMap.entries()) {
          await firebaseService.updateDocument('products', productId, { variations });
        }
      }

      // Tipo B: criar StockLot + atualizar estoque para finalizações sem registro
      const createLots = selected.filter((it): it is Extract<StockRepairItem, { kind: 'create_stocklot' }> => it.kind === 'create_stocklot');
      for (const item of createLots) {
        const lot = lots.find(l => l.id === item.lotId);
        if (!lot) continue;
        const { stockItems, customerItems } = classifyExpedicaoOrders([{
          orderId: item.orderId, itemIdx: item.itemIdx, fractionLabel: item.fractionLabel
        }]);
        await applyExpedicaoStockUpdate(lot, stockItems, customerItems);
      }

      setStockRepairModal(prev => prev ? { ...prev, phase: 'done', appliedCount: selected.length } : prev);
    } catch (e) {
      setStockRepairModal(prev => prev ? { ...prev, phase: 'preview', errorMsg: String(e) } : prev);
    }
  };

  // Abre o painel de baixa da OS: monta um item por pedido coberto por ela, já marcado
  // como incluído (pronto) e com o setor de destino pré-preenchido pela sugestão do
  // roteiro do próprio modelo — o usuário escolhe o destino (ou desmarca o pedido) ANTES
  // de confirmar, em vez do fluxo antigo que já marcava a OS como concluída antes mesmo
  // de perguntar pra onde os pedidos iam.
  //
  // Uma OS pode cobrir MAIS DE UM Mapa (os.lotIds, ex.: "OS em grupo" — ver criação em
  // ServiceOrderFormView). Varre todos eles, igual o "Visualizar" (getFichasForOS) já faz
  // — pegar só o primeiro lote fazia o painel mostrar menos pedidos do que a OS realmente
  // cobre.
  const handleCompleteOS = (os: ServiceOrder) => {
    const osLotIds = os.lotIds && os.lotIds.length > 0 ? os.lotIds : (os.lotId ? [os.lotId] : []);
    if (osLotIds.length === 0) { toast.show('OS sem lote vinculado.'); return; }

    const restrictTo = { sourceItemKeys: os.sourceItemKeys, sourceOrderIds: os.sourceOrderIds };
    const items: (LotAdvanceItem & { included: boolean; lotId: string; currentSectorId: string })[] = [];
    osLotIds.forEach(lId => {
      const lotObj = lots.find(l => l.id === lId);
      if (!lotObj) return;
      const route = lotObj.route || [];
      const currentSectorId = route[lotObj.currentSectorIndex] || os.sectorId;
      buildLotAdvanceItems(lotObj, currentSectorId, restrictTo).forEach(it => {
        items.push({
          ...it,
          key: `${lotObj.id}::${it.key}`,
          chosenSectorId: it.suggestedSectorId,
          included: true,
          lotId: lotObj.id,
          currentSectorId,
        });
      });
    });

    if (items.length === 0) { toast.show('Nenhum pedido encontrado para esta OS.'); return; }
    setOsBaixaPanel({ os, items });
  };

  const toggleOsBaixaItemIncluded = (key: string) => {
    setOsBaixaPanel(prev => prev ? { ...prev, items: prev.items.map(it => it.key === key ? { ...it, included: !it.included } : it) } : prev);
  };

  const toggleOsBaixaSelectAll = () => {
    setOsBaixaPanel(prev => {
      if (!prev) return prev;
      const allIncluded = prev.items.every(it => it.included);
      return { ...prev, items: prev.items.map(it => ({ ...it, included: !allIncluded })) };
    });
  };

  const updateOsBaixaItemSector = (key: string, sectorId: string) => {
    setOsBaixaPanel(prev => prev ? { ...prev, items: prev.items.map(it => it.key === key ? { ...it, chosenSectorId: sectorId } : it) } : prev);
  };

  // Confirma a baixa do painel: avança SÓ os pedidos incluídos (os desmarcados ficam
  // parados, sem nenhuma chamada de avanço/estoque sobre eles). Agrupa por Mapa, já que
  // applyLotAdvance opera um lote por vez e a OS pode cobrir vários. A OS só é marcada
  // COMPLETED e tem o financeiro liquidado quando TODOS os seus pedidos já tiverem sido
  // baixados — enquanto sobrar pedido, a mesma OS (mesmo número) continua PENDENTE, só
  // que com sourceItemKeys/sourceOrderIds encolhidos para o que ainda falta.
  const executeOsBaixaPanel = async () => {
    if (!osBaixaPanel) return;
    const { os, items } = osBaixaPanel;
    const includedItems = items.filter(it => it.included);
    const stayedItems = items.filter(it => !it.included);

    if (includedItems.length === 0) {
      toast.show('Selecione ao menos um pedido para dar baixa.');
      return;
    }

    try {
      const includedByLot = new Map<string, typeof includedItems>();
      includedItems.forEach(it => {
        if (!includedByLot.has(it.lotId)) includedByLot.set(it.lotId, []);
        includedByLot.get(it.lotId)!.push(it);
      });

      let lastDestSectorName = '';
      let allFinished = true;

      for (const [lotId, lotIncludedItems] of includedByLot.entries()) {
        const lotObj = lots.find(l => l.id === lotId);
        if (!lotObj) continue;
        const currentSectorId = lotIncludedItems[0].currentSectorId;

        // Atualiza estoque/reserva para TODOS os pedidos que o usuário escolheu
        // finalizar (chosenSectorId === ''), independente do setor atual. O guarda
        // anterior verificava isCycleEndSector, o que fazia pedidos finalizados
        // adiantadamente (ex.: via OS em Pesponto ou Acabamento) nunca creditarem
        // o estoque nem criarem StockLot — o usuário via "Finalizado" no lote mas
        // sem nenhum registro de entrada. handleFinalizeSelectedSourceItems (Finalizar
        // Selecionados) já se comportava corretamente (sem guarda de setor), alinhamos.
        const toFinalizeNow = lotIncludedItems.filter(it => it.chosenSectorId === '');
        if (toFinalizeNow.length > 0) {
          const { customerItems, stockItems } = classifyExpedicaoOrders(toFinalizeNow.map(it => ({ orderId: it.orderId, itemIdx: it.itemIdx, fractionLabel: it.fractionLabel })));
          if (stockItems.length > 0 || customerItems.length > 0) {
            const lines: string[] = [`Baixa de ${toFinalizeNow.length} pedido(s) do Mapa #${lotObj.orderNumber} (OS ${os.osNumber})`];
            if (customerItems.length > 0) lines.push(`📦 ${customerItems.length} pedido(s) → RESERVA PARA O CLIENTE (aguardando baixa manual na Venda)`);
            if (stockItems.length > 0) lines.push(`🏭 ${stockItems.length} pedido(s) → ENTRADA EM ESTOQUE`);
            lines.push('\nConfirmar baixa?');
            if (!confirm(lines.join('\n'))) return;
            await applyExpedicaoStockUpdate(lotObj, stockItems, customerItems);
          }
        }

        const notes = stayedItems.length === 0
          ? `Baixa via OS ${os.osNumber} concluída.`
          : `Baixa parcial via OS ${os.osNumber} (${includedItems.length}/${items.length} pedidos).`;
        const { destSectorName, isFinished } = await applyLotAdvance(lotObj, lotIncludedItems, currentSectorId, '', notes);
        lastDestSectorName = destSectorName;
        if (!isFinished) allFinished = false;
      }

      if (stayedItems.length === 0) {
        // Baixa completa: fecha a OS e liquida o financeiro, como no fluxo antigo.
        await firebaseService.updateDocument('serviceOrders', os.id, {
          status: 'COMPLETED',
          finishedAt: Date.now(),
        });
        if (os.transactionId) {
          try { await financeService.settleTransaction(os.transactionId); } catch { /* ignore */ }
        }
      } else {
        // Baixa parcial: a OS continua a MESMA, PENDENTE, agora só com os pedidos que
        // ficaram de fora — valor e liquidação financeira só acontecem na última baixa.
        const remainingKeys = os.sourceItemKeys && os.sourceItemKeys.length > 0
          ? stayedItems.map(it => `${it.lotId}::${it.orderId}::${it.siIdx}`)
          : undefined;
        const remainingOrderIds = !remainingKeys
          ? Array.from(new Set(stayedItems.map(it => it.orderId)))
          : undefined;
        await firebaseService.updateDocument('serviceOrders', os.id, {
          ...(remainingKeys ? { sourceItemKeys: remainingKeys } : {}),
          ...(remainingOrderIds ? { sourceOrderIds: remainingOrderIds } : {}),
        });
      }

      setOsBaixaPanel(null);
      setOsFeedback({
        osNumber: os.osNumber,
        nextSector: allFinished ? 'FINALIZADO' : lastDestSectorName,
        action: stayedItems.length === 0
          ? 'OS concluída e baixada com sucesso.'
          : `Baixa parcial: ${includedItems.length} de ${items.length} pedido(s) baixado(s). ${stayedItems.length} permanece(m) na OS.`,
        type: 'os',
      });
    } catch (e) {
      console.error(e);
      toast.show('Erro ao dar baixa: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  // Resolve an OS from a raw scan string or manual OS number and show confirmation
  const handleQrBaixaResolve = (raw: string) => {
    const parsed = scannerService.parseScanResult(raw);
    let os: ServiceOrder | undefined;

    if (parsed?.type === 'OS') {
      os = (serviceOrders || []).find(so => so.id === parsed.osId);
    } else if (parsed?.type === 'PRODUCT') {
      // Product label scanned — try to find the associated OS
      const preSelected = qrBaixaModal?.preselectedOS;
      if (preSelected && preSelected.productId === parsed.productId && preSelected.variationId === parsed.variationId) {
        os = preSelected;
      } else {
        const matches = (serviceOrders || []).filter(so =>
          so.status !== 'COMPLETED' &&
          so.productId === parsed.productId &&
          so.variationId === parsed.variationId
        );
        if (matches.length === 1) {
          os = matches[0];
        } else if (matches.length > 1) {
          toast.show(`Encontradas ${matches.length} OS abertas para este produto. Use a busca manual ou escaneie o QR da OS específica.`);
          return;
        }
      }
    } else {
      // Try matching by osNumber directly (e.g. "OS-0003" typed manually)
      const normalized = raw.trim().toUpperCase();
      os = (serviceOrders || []).find(so =>
        so.osNumber.toUpperCase() === normalized || so.id === raw.trim()
      );
    }

    if (!os) { toast.show('OS não encontrada. Verifique o código e tente novamente.'); return; }
    if (os.status === 'COMPLETED') { toast.show(`A OS ${os.osNumber} já foi concluída.`); return; }

    const lot = (lots || []).find(l =>
      l.id === os!.lotId || (os!.lotIds && os!.lotIds.includes(l.id))
    ) || null;
    // Usa posição da OS no roteiro para calcular próximo setor correto
    const osSectorPos = lot?.route?.indexOf(os!.sectorId ?? '') ?? -1;
    const effectivePos = osSectorPos >= 0 ? osSectorPos : (lot?.currentSectorIndex ?? 0);
    const nextSectorId = lot?.route?.[effectivePos + 1] || '';
    const nextSec = (sectors || []).find(s => s.id === nextSectorId);
    setQrBaixaConfirm({ os, lot, nextSectorName: nextSec?.name || 'CONCLUÍDO' });
  };

  const handleDeleteOS = async (os: ServiceOrder) => {
    if (confirm(`Tem certeza de que deseja excluir a Ordem de Serviço ${os.osNumber}? Isso removerá a movimentação financeira correspondente.`)) {
      try {
        if (os.transactionId) {
          await financeService.deleteTransaction(os.transactionId);
        }
        await firebaseService.deleteDocument("serviceOrders", os.id);
        toast.show("Ordem de Serviço excluída com sucesso!");
      } catch (e) {
        console.error(e);
        toast.show("Erro ao excluir Ordem de Serviço: " + (e instanceof Error ? e.message : String(e)));
      }
    }
  };


  // Open OS modal pre-configured for a specific order (per-ficha creation)
  const handleOpenOSModalForOrder = (lotsToProcess: ProductionLot | ProductionLot[], orderIds: string[], preNote?: string, sectorOverride?: string, qtyOverride?: number) => {
    setPendingOsSourceOrderIds(orderIds);
    if (preNote) setOsNotes(preNote);
    if (sectorOverride) setPendingOsSectorOverride(sectorOverride);
    if (qtyOverride !== undefined) setPendingOsQuantityOverride(qtyOverride);
    handleOpenOSModal(lotsToProcess, sectorOverride, qtyOverride, orderIds);
  };

  // Desfazer OS in PCPView — deletes OS + all sibling OS + the lot (frees orders)
  const handleUndoOSPCPView = async (os: ServiceOrder) => {
    if (!confirm(`Reverter a OS ${os.osNumber}? O mapa e todas as OS vinculadas serão excluídos e os pedidos ficarão disponíveis novamente.`)) return;
    try {
      const lotId = os.lotId || (os.lotIds?.[0] ?? '');
      const lotObj = lots.find(l => l.id === lotId || (os.lotIds && os.lotIds.includes(l.id)));

      // Delete all OS for this lot in this sector
      const relatedOS = serviceOrders.filter(o =>
        (o.lotId === lotId || (o.lotIds && o.lotIds.includes(lotId))) &&
        o.sectorId === os.sectorId
      );
      for (const relOS of relatedOS) {
        if (relOS.transactionId) {
          try { await financeService.deleteTransaction(relOS.transactionId); } catch { /* ignore */ }
        }
        await firebaseService.deleteDocument('serviceOrders', relOS.id);
      }

      // Delete the lot itself (frees production orders)
      if (lotObj) {
        await firebaseService.deleteDocument('productionLots', lotObj.id);
      }

      setSelectedLot(null);
      setIsDetailModalOpen(false);
      toast.show('Revertido com sucesso. Pedidos disponíveis novamente.');
    } catch (e) {
      toast.show('Erro ao reverter: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleEditOS = (os: ServiceOrder) => {
    onNavigate(ViewType.PRODUCTION_SERVICE_ORDER_FORM, os.id);
  };

  // Agenda/cancela a notificação local do lembrete de uma OS, refletindo o título/data mais recentes
  const syncOSReminderNotification = (os: ServiceOrder, updates: { reminderAt?: number | null; reminderTitle?: string | null }) => {
    const reminderAt = updates.reminderAt !== undefined ? updates.reminderAt : os.reminderAt;
    const reminderTitle = updates.reminderTitle !== undefined ? updates.reminderTitle : os.reminderTitle;
    if (reminderAt) {
      notificationService.scheduleReminder({
        id: `os-${os.id}`,
        title: reminderTitle || `OS ${os.osNumber}`,
        body: os.providerName ? `Fornecedor: ${os.providerName}` : 'Lembrete de Ordem de Serviço',
        at: reminderAt,
      });
    } else {
      notificationService.cancelReminder(`os-${os.id}`);
    }
  };

  // Resolve as "fichas" (pedidos/itens) cobertas por uma OS — usado tanto pelo
  // botão "Visualizar" quanto pelo "Compartilhar" desta OS específica.
  const getFichasForOS = (os: ServiceOrder): any[] => {
    const osLotIds = os.lotIds || [os.lotId];
    const osSourceOrderIds = os.sourceOrderIds || [];
    const osSourceItemKeys = (os as any).sourceItemKeys || [];

    const mappedFichas: any[] = [];
    osLotIds.forEach(lId => {
      const l = lots.find(lot => lot.id === lId);
      if (!l) return;
      const sourceItems: any[] = (l as any).metadata?.sourceItems || [];
      sourceItems.forEach((si, siIdx) => {
        const itemKey = `${l.id}::${si.orderId}::${siIdx}`;
        const isIncluded = osSourceItemKeys.includes(itemKey) ||
          (osSourceItemKeys.length === 0 && osSourceOrderIds.includes(si.orderId));

        if (isIncluded) {
          const prod = products.find(p => p.id === si.productId);
          const vari = prod?.variations.find((v: any) => v.id === si.variationId);
          const ord = productionOrders.find(o => o.id === si.orderId);
          const ordItem: any = si.itemIdx !== undefined ? ord?.items[si.itemIdx] : ord?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);

          mappedFichas.push({
            lot: l,
            si,
            siIdx,
            product: prod,
            variation: vari,
            orderItem: ordItem,
            order: ord,
            coveringOS: os
          });
        }
      });
    });
    return mappedFichas;
  };

  const handlePrintLotLabel = (lot: ProductionLot) => {
    const product = products.find(p => p.id === lot.productId);
    const variation = product?.variations.find(v => v.id === lot.variationId);
    labelService.printLotLabel(lot, product?.name || 'Produto', variation?.colorName || 'Cor');
  };
  const handleBatchCreateLots = async () => {
    if (selectedOrderItems.length === 0) return;

    const selectedData = selectedOrderItems
      .map(s => pendingItems.find(p => p.orderId === s.orderId && p.itemIdx === s.itemIdx))
      .filter((i): i is any => !!i);

    // Agrupa por produto/variação para metadados
    const groups: Record<string, { productId: string; variationId: string; productName: string; variationName: string; quantity: number; items: any[] }> = {};
    selectedData.forEach(item => {
      const key = `${item.productId}-${item.variationId}`;
      if (!groups[key]) {
        groups[key] = { productId: item.productId, variationId: item.variationId, productName: item.productName, variationName: item.variationName, quantity: 0, items: [] };
      }
      groups[key].quantity += item.toProductionQty;
      groups[key].items.push(item);
    });

    const groupEntries = Object.values(groups);
    // Usa o produto do grupo com maior quantidade como referência principal
    const mainGroup = groupEntries.sort((a, b) => b.quantity - a.quantity)[0];
    const mainProduct = products.find(p => p.id === mainGroup.productId);
    const route = mainProduct?.productionRoute || sectors.map(s => s.id);

    // Mescla todos os pares de todos os grupos em um único objeto
    const mergedPairs: Record<string, number> = {};
    selectedData.forEach(item => {
      Object.entries(item.sizes || {}).forEach(([size, s]: any) => {
        if (s.toProduction > 0) mergedPairs[size] = (mergedPairs[size] || 0) + s.toProduction;
      });
    });

    const totalQty = groupEntries.reduce((s, g) => s + g.quantity, 0);
    const nextLotNum = await firebaseService.getNextSequence('productionLots', seedProductionLotSequence);
    const lotNumber = `${String(nextLotNum).padStart(3, '0')}`;
    const isMultiGroup = groupEntries.length > 1;

    const singleLot: ProductionLot = {
      id: generateId(),
      orderNumber: lotNumber,
      productId: mainGroup.productId,
      variationId: isMultiGroup ? '' : mainGroup.variationId,
      quantity: totalQty,
      route,
      currentSectorIndex: 0,
      prioridade: 'NORMAL',
      history: [{
        sectorId: route[0] || '',
        statusId: '',
        timestamp: Date.now(),
        userName: userName || 'Usuário',
        notes: `Mapa criado com ${groupEntries.length} grupo(s) e ${selectedData.length} pedido(s). ${isMultiGroup ? 'Produto principal: ' + mainGroup.productName : ''}`
      }],
      createdAt: Date.now(),
      customerName: isMultiGroup
        ? `${groupEntries.length} Grupos · ${selectedData.length} Pedidos`
        : (selectedData.length > 1 ? `${selectedData.length} Pedidos Agrupados` : selectedData[0].customerName),
      saleId: selectedData[0].saleId,
      productionOrderId: selectedData[0].orderId,
      saleOrderNumber: selectedData[0].saleOrderNumber,
      metadata: {
        // sizes: snapshot da grade por tamanho no momento da criação do lote — sem isso,
        // a grade some no "Visualizar Pedidos da OS" se o Pedido de Produção original
        // for editado/excluído depois (o total em "qty" fica congelado, mas a grade era
        // buscada ao vivo no pedido).
        sourceItems: selectedData.map(i => ({ orderId: i.orderId, itemIdx: i.itemIdx, qty: i.toProductionQty, productId: i.productId, variationId: i.variationId, sizes: i.sizes })),
        groups: groupEntries.map(g => ({
          productId: g.productId,
          variationId: g.variationId,
          productName: g.productName,
          variationName: g.variationName,
          quantity: g.quantity,
          orderCount: g.items.length,
          pairs: g.items.reduce((acc: any, item: any) => {
            Object.entries(item.sizes || {}).forEach(([size, s]: any) => {
              if (s.toProduction > 0) acc[size] = (acc[size] || 0) + s.toProduction;
            });
            return acc;
          }, {} as Record<string, number>)
        }))
      },
      pairs: mergedPairs,
      notes: (() => {
        const itemNotes = selectedData
          .filter((item: any) => item.notes?.trim())
          .map((item: any) =>
            selectedData.length > 1
              ? `[${item.variationName || item.productName}] ${item.notes.trim()}`
              : item.notes.trim()
          );
        return itemNotes.length > 0 ? itemNotes.join('\n') : undefined;
      })(),
    } as any;

    try {
      await onSaveLot(singleLot);
      setSelectedOrderItems([]);
      toast.show(`Mapa ${lotNumber} criado com ${groupEntries.length} grupo(s) e ${totalQty} pares!`);
      setActiveTab('monitor');
    } catch (err) {
      console.error(err);
      toast.show('Erro ao criar mapa.');
    }
  };

  const handleRemoveItemFromLot = async (lot: ProductionLot, orderId: string) => {
    if (!confirm('Deseja retirar este pedido do mapa? Ele voltará para a lista de pendentes.')) return;

    const lotMetadata = (lot as any).metadata;
    const items = lotMetadata?.sourceItems || [];

    const isOnlyItem = (items.length <= 1 && (!lot.productionOrderId || lot.productionOrderId === orderId));

    if (isOnlyItem) {
      await onDeleteLot(lot.id);
      setIsDetailModalOpen(false);
      setSelectedLot(null);
      return;
    }

    const removedItem = items.find((i: any) => i.orderId === orderId);
    const removedQty = removedItem?.qty || (lot.productionOrderId === orderId ? lot.quantity : 0);
    const newItems = items.filter((i: any) => i.orderId !== orderId);

    let nextOrderId = lot.productionOrderId;
    if (lot.productionOrderId === orderId) {
      nextOrderId = newItems[0]?.orderId || '';
    }

    const updatedLot: ProductionLot = {
      ...lot,
      productionOrderId: nextOrderId,
      quantity: Math.max(0, lot.quantity - removedQty),
      metadata: {
        ...lotMetadata,
        sourceItems: newItems
      }
    } as any;

    await onSaveLot(updatedLot);
    setSelectedLot(updatedLot);
  };

  // O ScannerModal já entrega o resultado parseado (scannerService.parseScanResult),
  // não a string bruta — reparsear aqui quebraria (.split em um objeto).
  const handleScanLotResult = async (parsed: any) => {
    setIsScannerOpen(false);

    if (parsed?.type === 'OS') {
      const os = serviceOrders?.find(so => so.id === parsed.osId);
      if (!os) { toast.show('Ordem de Serviço não encontrada.'); return; }
      const lot = lots.find(l => l.id === os.lotId || (os.lotIds && os.lotIds.includes(l.id)));
      if (!lot) { toast.show(`Mapa da OS ${os.osNumber} não encontrado.`); return; }
      if (os.status === 'COMPLETED') toast.show(`A OS ${os.osNumber} já foi concluída.`);
      setExpandedOSIds(prev => new Set(prev).add(os.id));
      setSelectedLot(lot);
      setIsDetailModalOpen(true);
      return;
    }

    // Etiqueta de produto genérica (sem lotId/orderId) -> não há pedido/Mapa para abrir.
    // Sem este aviso explícito, o código cairia no fallback de LOT abaixo e mostraria
    // "Mapa não encontrado: PRD|..." (ou nada, se o toast passar despercebido).
    if (parsed?.type === 'PRODUCT' && (!parsed.lotId || !parsed.orderId)) {
      toast.show(SCAN_ERRORS.noRoute);
      return;
    }

    // Etiqueta de molde de solado -> não corresponde a um Mapa/pedido de produção.
    if (parsed?.type === 'SOLE') {
      toast.show(SCAN_ERRORS.sole);
      return;
    }

    // Etiqueta de pedido vinculado (PRD|...|lotId|orderId|itemIdx) -> abre o Mapa direto no pedido
    if (parsed?.type === 'PRODUCT' && parsed.lotId && parsed.orderId) {
      // Busca local primeiro e, se não encontrar (Mapa ainda não sincronizado
      // localmente), carrega direto do Firestore — "carrega diretamente" o Mapa
      // mesmo que a lista local `lots` ainda não tenha esse documento.
      const lot = await scannerService.findLotById(parsed.lotId, lots);
      if (!lot) { toast.show(SCAN_ERRORS.lotNotFound(parsed.lotId)); return; }

      const allSourceItems: any[] = (lot as any).metadata?.sourceItems || [
        { orderId: lot.productionOrderId, itemIdx: 0, qty: lot.quantity }
      ];
      const currentSectorId = lot.route && lot.route[lot.currentSectorIndex];
      const sourceItems = allSourceItems.filter((si: any) =>
        getOrderEffectiveSector(lot, si.orderId, si) === currentSectorId
      );

      const itemIdxNum = parsed.itemIdx !== undefined && parsed.itemIdx !== '' ? Number(parsed.itemIdx) : undefined;
      const matchesTarget = (s: any) => s.orderId === parsed.orderId && (itemIdxNum === undefined || s.itemIdx === itemIdxNum);
      const si = sourceItems.find(matchesTarget)
        || sourceItems.find((s: any) => s.orderId === parsed.orderId);

      setSelectedLot(lot);
      setIsDetailModalOpen(true);
      // Limpa filtros deixados por uma sessão anterior do modal, que poderiam
      // esconder o card do pedido recém-escaneado.
      setSourceFilterModel('');
      setSourceFilterColor('');
      if (si) {
        const idx = sourceItems.indexOf(si);
        const focusKey = `${parsed.orderId}-${idx}`;
        setExpandedSourceItems(prev => new Set(prev).add(focusKey));
        setScanFocusKey(focusKey);
      } else {
        // O pedido escaneado não está no setor atual do Mapa — foi direcionado
        // individualmente para outro setor. Avisa o usuário onde ele está.
        const movedItem = allSourceItems.find(matchesTarget) || allSourceItems.find((s: any) => s.orderId === parsed.orderId);
        const movedSectorId = movedItem ? getOrderEffectiveSector(lot, movedItem.orderId, movedItem) : undefined;
        const movedSectorName = movedSectorId ? sectors.find(s => s.id === movedSectorId)?.name : undefined;
        toast.show(movedSectorName
          ? `Este pedido já foi direcionado para o setor "${movedSectorName}".`
          : 'Pedido não encontrado neste Mapa.');
      }
      return;
    }

    // Formato LOT|id -> abre o Mapa direto no pedido vinculado
    const lotId = parsed?.type === 'LOT' ? parsed.lotId : '';
    if (!lotId) { toast.show('QR Code inválido'); return; }

    let lot = lots.find(l => l.id === lotId || l.orderNumber === lotId);
    if (!lot) {
      // Mapa ainda não sincronizado localmente -> tenta carregar direto do Firestore.
      lot = (await scannerService.findLotById(lotId, lots)) || undefined;
    }
    if (!lot) { toast.show(SCAN_ERRORS.lotNotFound(lotId)); return; }

    setSelectedLot(lot);
    setIsDetailModalOpen(true);

    const allSourceItems: any[] = (lot as any).metadata?.sourceItems || [
      { orderId: lot.productionOrderId, itemIdx: 0, qty: lot.quantity }
    ];
    const currentSectorId = lot.route && lot.route[lot.currentSectorIndex];
    const sourceItems = allSourceItems.filter((si: any) =>
      getOrderEffectiveSector(lot, si.orderId, si) === currentSectorId
    );
    const firstItem = sourceItems[0];
    if (firstItem) {
      const idx = sourceItems.indexOf(firstItem);
      const focusKey = `${firstItem.orderId}-${idx}`;
      setExpandedSourceItems(prev => new Set(prev).add(focusKey));
      setScanFocusKey(focusKey);
    }
  };

  // ── Dados filtrados para exportação PCP ─────────────────────────────────────
  const getShareData = () => {
    let filtered = [...lots];
    if (shareFilterStatus === 'active') filtered = filtered.filter(l => !l.finishedAt);
    if (shareFilterStatus === 'finished') filtered = filtered.filter(l => !!l.finishedAt);
    if (shareFilterSectors.size > 0) {
      filtered = filtered.filter(l => {
        const sid = l.route?.[l.currentSectorIndex];
        return sid && shareFilterSectors.has(sid);
      });
    }
    if (shareSearch.trim()) {
      const q = shareSearch.toLowerCase();
      filtered = filtered.filter(l => {
        const p = products.find(pr => pr.id === l.productId);
        const order = l.productionOrderId ? productionOrders.find(o => o.id === l.productionOrderId) : undefined;
        return (
          l.orderNumber?.toLowerCase().includes(q) ||
          p?.name?.toLowerCase().includes(q) ||
          p?.reference?.toLowerCase().includes(q) ||
          (l.customerName || '').toLowerCase().includes(q) ||
          (order?.customerName || '').toLowerCase().includes(q) ||
          ((l as any).groups || []).some((g: any) => {
            const gp = products.find(pr => pr.id === g.productId);
            const go = g.productionOrderId ? productionOrders.find((o: any) => o.id === g.productionOrderId) : undefined;
            return gp?.name?.toLowerCase().includes(q) || gp?.reference?.toLowerCase().includes(q) || (g.customerName || '').toLowerCase().includes(q) || (go?.customerName || '').toLowerCase().includes(q);
          })
        );
      });
    }
    return filtered;
  };

  /** Soma qty/grade/produtos de um subconjunto de `sourceItems` de um mapa (um grupo por setor de `getLotPendingSectorGroups`). */
  const computeSectionGroup = (lot: ProductionLot, sectionItems: any[]): { qty: number; grade: Record<string, number> | null; products: Product[] } => {
    const qty = sectionItems.reduce((acc: number, si: any) => acc + (si.qty || 0), 0);
    const grade: Record<string, number> = {};
    sectionItems.forEach((si: any) => {
      const ord = productionOrders.find(o => o.id === si.orderId);
      if (!ord) return;
      const ordItem: any = si.itemIdx !== undefined ? ord.items[si.itemIdx] : ord.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
      if (!ordItem?.sizes) return;
      Object.entries(ordItem.sizes).forEach(([sz, sd]: any) => {
        const q = Number(sd.toProduction) || 0;
        if (q > 0) grade[sz] = (grade[sz] || 0) + q;
      });
    });
    const sectionProducts = Array.from(new Map(
      sectionItems.map((si: any) => [si.productId, products.find(p => p.id === si.productId)])
    ).values()).filter(Boolean) as Product[];
    return { qty, grade: Object.keys(grade).length > 0 ? grade : null, products: sectionProducts };
  };

  const generatePCPPDF = async () => {
    setShareGenerating('pdf');
    try {
      const filtered = getShareData();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const M = 14;
      const dateStr = new Date().toLocaleDateString('pt-BR');
      const typeLabel = shareReportType === 'sector' ? 'Por Setor' : shareReportType === 'lot' ? 'Por Mapa' : 'Por Cliente';
      const statusLabel = shareFilterStatus === 'active' ? 'Em Produção' : shareFilterStatus === 'finished' ? 'Concluídos' : 'Todos';

      // Paleta moderna
      const C = {
        indigo: [79, 70, 229] as [number, number, number],
        indigoLight: [238, 242, 255] as [number, number, number],
        dark: [15, 23, 42] as [number, number, number],
        mid: [71, 85, 105] as [number, number, number],
        muted: [148, 163, 184] as [number, number, number],
        line: [226, 232, 240] as [number, number, number],
        rowAlt: [249, 250, 251] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
      };

      const addHeader = () => {
        // Linha acento topo
        doc.setFillColor(...C.indigo); doc.rect(0, 0, W, 2, 'F');
        // Logo + título
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.dark);
        doc.text('PCP CENTRAL', M, 12);
        // Subtítulo cinza
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.muted);
        doc.text('Planejamento e Controle de Produção', M, 18);
        // Tipo + data à direita
        doc.setFontSize(7.5);
        doc.text(`${typeLabel}  ·  ${statusLabel}  ·  ${dateStr}`, W - M, 12, { align: 'right' });
        doc.text(`${filtered.length} mapas  ·  ${filtered.reduce((s, l) => s + (l.quantity || 0), 0)} pares`, W - M, 18, { align: 'right' });
        // Linha separadora
        doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.line(M, 22, W - M, 22);
        return 30;
      };

      const R = 2.5; // raio dos cantos arredondados
      const BG = [248, 250, 252] as [number, number, number]; // fundo card

      // Desenha card com cantos arredondados e fundo levíssimo
      const drawCard = (y: number, h: number) => {
        doc.setFillColor(...BG);
        doc.setDrawColor(...C.line);
        doc.setLineWidth(0.25);
        (doc as any).roundedRect(M, y, W - M * 2, h, R, R, 'FD');
      };

      const addSectionLabel = (title: string, sub: string, y: number) => {
        drawCard(y, 14);
        // Barra lateral indigo arredondada
        doc.setFillColor(...C.indigo);
        (doc as any).roundedRect(M, y, 1.8, 14, 0.9, 0.9, 'F');
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.dark);
        doc.text(title, M + 6, y + 7);
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted);
        doc.text(sub, M + 6, y + 12);
        return y + 20;
      };

      const addGradeTable = (lot: any, startY: number, gradeOverride?: Record<string, number> | null) => {
        const pairs = gradeOverride || lot.pairs || {};
        const sizes = Object.keys(pairs).sort((a: string, b: string) => Number(a) - Number(b));
        if (!sizes.length) return startY;
        const product = products.find(p => p.id === lot.productId);
        const ref = shareOpts.refs && product?.reference ? `${product.reference} · ` : '';
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.mid);
        doc.text(`Grade  ·  MAPA ${lot.orderNumber}  ·  ${ref}${product?.name || '—'}`, M + 4, startY);
        startY += 3.5;
        autoTable(doc, {
          startY, head: [sizes.map(s => String(s))],
          body: [sizes.map((s: string) => String(pairs[s] || 0))],
          margin: { left: M + 4, right: M },
          styles: { fontSize: 7.5, cellPadding: 1.8, halign: 'center' as const, lineColor: C.line, lineWidth: 0.2 },
          headStyles: { fillColor: C.indigoLight, textColor: C.indigo, fontStyle: 'bold' as const },
          bodyStyles: { fillColor: C.white, textColor: C.dark, fontStyle: 'bold' as const },
          theme: 'grid',
        });
        return (doc as any).lastAutoTable.finalY + 7;
      };

      const tableStyles = {
        styles: { fontSize: 7.5, cellPadding: 2.2, textColor: C.mid, lineColor: C.line, lineWidth: 0.1, fillColor: C.white },
        headStyles: { fillColor: C.rowAlt, textColor: C.dark, fontStyle: 'bold' as const, lineColor: C.line, lineWidth: 0.15 },
        alternateRowStyles: { fillColor: C.white },
        theme: 'plain' as const,
        columnStyles: {} as Record<number, object>,
      };

      const searchQ2 = shareSearch.trim().toLowerCase();
      const customerMatchOrders = searchQ2
        ? productionOrders.filter(o => (o.customerName || '').toLowerCase().includes(searchQ2))
        : [];

      if (customerMatchOrders.length > 0) {
        const custMap2 = new Map<string, typeof customerMatchOrders>();
        customerMatchOrders.forEach(o => {
          const k = o.customerName || 'Sem Cliente';
          if (!custMap2.has(k)) custMap2.set(k, []);
          custMap2.get(k)!.push(o);
        });
        let first = true;
        for (const [custName, orders] of custMap2) {
          if (!first) doc.addPage();
          first = false;
          const custTotal = orders.reduce((s, o) => s + o.items.reduce((ss, it) => ss + (it.toProductionQty || 0), 0), 0);
          let y = addHeader();
          y = addSectionLabel(custName.toUpperCase(), `${orders.length} pedido(s)  ·  ${custTotal} pares`, y);
          for (const order of orders) {
            if (y > 250) { doc.addPage(); y = addHeader() + 4; }
            const orderTotal = order.items.reduce((s, it) => s + (it.toProductionQty || 0), 0);
            const orderLots2 = lots.filter(l => order.lotIds?.includes(l.id));
            const sectorLabel = [...new Set(orderLots2.map(l => {
              if (l.finishedAt) return 'Concluído';
              const sid = getOrderEffectiveSector(l, order.id);
              if (sid === ORDER_FINALIZED) return 'Concluído';
              return sectors.find(s => s.id === sid)?.name || 'Sem Setor';
            }))].join(', ');
            drawCard(y, 9);
            doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.indigo);
            doc.text(`PEDIDO ${order.saleOrderNumber}`, M + 4, y + 6);
            if (shareOpts.dates && order.deliveryDate) {
              doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted);
              doc.text(`Entrega: ${new Date(order.deliveryDate).toLocaleDateString('pt-BR')}`, M + 60, y + 6);
            }
            doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.mid);
            doc.text(`${orderTotal} par`, W - M - 4, y + 6, { align: 'right' });
            y += 13;
            const iHead = ['PRODUTO', 'COR', 'PARES'];
            const iBody = order.items.map(item => {
              const p2 = products.find(pr => pr.id === item.productId);
              const v2 = p2?.variations?.find(va => va.id === item.variationId);
              const ref2 = shareOpts.refs && p2?.reference ? `${p2.reference} · ` : '';
              return [`${ref2}${p2?.name || item.productName || '—'}`, v2?.colorName || item.variationName || '—', String(item.toProductionQty || 0)];
            });
            const tY0d = y;
            autoTable(doc, { startY: y, head: [iHead], body: iBody, margin: { left: M, right: M }, ...tableStyles });
            const tY1d = (doc as any).lastAutoTable.finalY;
            doc.setDrawColor(...C.line); doc.setLineWidth(0.35);
            (doc as any).roundedRect(M, tY0d - 0.5, W - M * 2, tY1d - tY0d + 1, R, R, 'D');
            y = tY1d + 3;
            if (sectorLabel) {
              doc.setFontSize(7); doc.setFont('helvetica', 'italic'); doc.setTextColor(...C.muted);
              doc.text(`Em produção: ${sectorLabel}`, M + 4, y + 3); y += 7;
            }
            if (shareOpts.grades) {
              for (const item of order.items) {
                const itemSzs = Object.entries(item.sizes || {}).filter(([, v]) => v.toProduction > 0).sort(([a], [b]) => Number(a) - Number(b));
                if (!itemSzs.length) continue;
                if (y > 255) { doc.addPage(); y = addHeader() + 4; }
                const p2 = products.find(pr => pr.id === item.productId);
                const v2 = p2?.variations?.find(va => va.id === item.variationId);
                doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.mid);
                doc.text(`Grade · ${p2?.name || '—'} · ${v2?.colorName || item.variationName || '—'}`, M + 4, y);
                y += 3.5;
                autoTable(doc, {
                  startY: y, head: [itemSzs.map(([sz]) => sz)], body: [itemSzs.map(([, v]) => String(v.toProduction))],
                  margin: { left: M + 4, right: M },
                  styles: { fontSize: 7.5, cellPadding: 1.8, halign: 'center' as const, lineColor: C.line, lineWidth: 0.2 },
                  headStyles: { fillColor: C.indigoLight, textColor: C.indigo, fontStyle: 'bold' as const },
                  bodyStyles: { fillColor: C.white, textColor: C.dark, fontStyle: 'bold' as const },
                  theme: 'grid',
                });
                y = (doc as any).lastAutoTable.finalY + 5;
              }
            }
            y += 4;
          }
        }
      } else if (shareReportType === 'sector') {
        type SectorEntry = { lot: typeof filtered[number]; items: any[] | null };
        const sectorMap = new Map<string, { name: string; entries: SectorEntry[] }>();
        filtered.forEach(lot => {
          const pendingGroups = getLotPendingSectorGroups(lot);
          const isSplit = pendingGroups.size > 1;
          pendingGroups.forEach((groupItems, sid) => {
            const sec = sectors.find(s => s.id === sid);
            if (!sectorMap.has(sid)) sectorMap.set(sid, { name: sec?.name || 'Sem Setor', entries: [] });
            sectorMap.get(sid)!.entries.push({ lot, items: isSplit ? groupItems : null });
          });
        });
        let first = true;
        for (const [, { name: secName, entries }] of sectorMap) {
          if (!first) doc.addPage();
          first = false;
          let y = addHeader();
          const secTotal = entries.reduce((s, { lot, items }) => s + (items ? computeSectionGroup(lot, items).qty : lot.quantity), 0);
          y = addSectionLabel(secName.toUpperCase(), `${entries.length} mapa(s)  ·  ${secTotal} pares`, y);
          const head = ['MAPA', 'PRODUTO / REF', 'COR', ...(shareOpts.customer ? ['CLIENTE'] : []), ...(shareOpts.dates ? ['ENTREGA'] : []), 'TOTAL'];
          const body = entries.map(({ lot, items }) => {
            const p = products.find(pr => pr.id === lot.productId);
            const v = p?.variations?.find(va => va.id === lot.variationId);
            const lotAny = lot as any;
            const isMulti = lotAny.groups && lotAny.groups.length > 1;
            const ref = shareOpts.refs && p?.reference ? `${p.reference} · ` : '';
            const section = items ? computeSectionGroup(lot, items) : null;
            let prodLabel: string, colorLabel: string;
            if (section && section.products.length > 1) {
              prodLabel = `${section.products.length} modelos`;
              colorLabel = '—';
            } else if (section && section.products.length === 1) {
              const sp = section.products[0];
              const spRef = shareOpts.refs && sp.reference ? `${sp.reference} · ` : '';
              prodLabel = `${spRef}${sp.name}`;
              colorLabel = '—';
            } else {
              prodLabel = isMulti ? `${lotAny.groups.length} modelos` : `${ref}${p?.name || '—'}`;
              colorLabel = isMulti ? '—' : (v?.colorName || '—');
            }
            return [
              `MAPA ${lot.orderNumber}`,
              prodLabel,
              colorLabel,
              ...(shareOpts.customer ? [lot.customerName || '—'] : []),
              ...(shareOpts.dates ? [lot.deliveryDate ? new Date(lot.deliveryDate).toLocaleDateString('pt-BR') : '—'] : []),
              `${section ? section.qty : lot.quantity} par`,
            ];
          });
          const tY0 = y;
          autoTable(doc, { startY: y, head: [head], body, margin: { left: M, right: M }, ...tableStyles });
          const tY1 = (doc as any).lastAutoTable.finalY;
          doc.setDrawColor(...C.line); doc.setLineWidth(0.35);
          (doc as any).roundedRect(M, tY0 - 0.5, W - M * 2, tY1 - tY0 + 1, R, R, 'D');
          y = tY1 + 8;
          if (shareOpts.grades) {
            for (const { lot, items } of entries) {
              if (y > 255) { doc.addPage(); y = addHeader() + 4; }
              y = addGradeTable(lot, y, items ? computeSectionGroup(lot, items).grade : null);
            }
          }
        }
      } else if (shareReportType === 'lot') {
        let y = addHeader();
        y = addSectionLabel(`MAPAS — ${statusLabel.toUpperCase()}`, `${filtered.length} mapa(s)  ·  ${filtered.reduce((s, l) => s + (l.quantity || 0), 0)} pares`, y);
        const head = ['MAPA', 'PRODUTO / REF', 'COR', ...(shareOpts.customer ? ['CLIENTE'] : []), ...(shareOpts.dates ? ['ENTREGA'] : []), 'SETOR', 'TOTAL'];
        const body = filtered.map(lot => {
          const p = products.find(pr => pr.id === lot.productId);
          const v = p?.variations?.find(va => va.id === lot.variationId);
          const sectorNames = Array.from(getLotPendingSectorGroups(lot).keys())
            .map(sid => sectors.find(s => s.id === sid)?.name || sid)
            .join(', ');
          const ref = shareOpts.refs && p?.reference ? `${p.reference} · ` : '';
          const lotAny2 = lot as any;
          const isMulti = lotAny2.groups && lotAny2.groups.length > 1;
          return [
            `MAPA ${lot.orderNumber}`,
            isMulti ? `${lotAny2.groups.length} modelos` : `${ref}${p?.name || '—'}`,
            isMulti ? '—' : (v?.colorName || '—'),
            ...(shareOpts.customer ? [lot.customerName || '—'] : []),
            ...(shareOpts.dates ? [lot.deliveryDate ? new Date(lot.deliveryDate).toLocaleDateString('pt-BR') : '—'] : []),
            sectorNames || '—', `${lot.quantity}`,
          ];
        });
        const tY0b = y;
        autoTable(doc, { startY: y, head: [head], body, margin: { left: M, right: M }, ...tableStyles });
        const tY1b = (doc as any).lastAutoTable.finalY;
        doc.setDrawColor(...C.line); doc.setLineWidth(0.35);
        (doc as any).roundedRect(M, tY0b - 0.5, W - M * 2, tY1b - tY0b + 1, R, R, 'D');
        y = tY1b + 8;
        if (shareOpts.grades) {
          for (const lot of filtered) {
            if (y > 255) { doc.addPage(); y = addHeader() + 4; }
            y = addGradeTable(lot, y);
          }
        }
      } else {
        const custMap = new Map<string, any[]>();
        productionOrders.forEach(order => {
          const key = order.customerName || 'Sem Cliente';
          if (!custMap.has(key)) custMap.set(key, []);
          custMap.get(key)!.push(order);
        });
        const filteredLotIds = new Set(filtered.map(l => l.id));
        let first = true;
        for (const [custName, orders] of custMap) {
          const custOrders = orders.filter(o => {
            const lot = lots.find(l => l.productionOrderId === o.id || ((l as any).groups || []).some((g: any) => g.orderId === o.id));
            return !lot || filteredLotIds.has(lot.id);
          });
          if (!custOrders.length) continue;
          if (!first) doc.addPage();
          first = false;
          let y = addHeader();
          y = addSectionLabel(custName.toUpperCase(), `${custOrders.length} pedido(s)  ·  ${custOrders.reduce((s, o) => s + (o.quantity || 0), 0)} pares`, y);
          const head = ['PEDIDO', 'PRODUTO', 'COR', ...(shareOpts.dates ? ['ENTREGA'] : []), 'MAPA', 'PARES'];
          const body = custOrders.map(o => {
            const p = products.find(pr => pr.id === o.productId);
            const v = p?.variations?.find(va => va.id === o.variationId);
            const lot = lots.find(l => l.productionOrderId === o.id || ((l as any).groups || []).some((g: any) => g.orderId === o.id));
            const ref = shareOpts.refs && p?.reference ? `${p.reference} · ` : '';
            return [
              `#${o.orderNumber || '—'}`, `${ref}${p?.name || o.productName || '—'}`,
              v?.colorName || o.colorName || '—',
              ...(shareOpts.dates ? [o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString('pt-BR') : '—'] : []),
              lot ? `MAPA ${lot.orderNumber}` : '—', String(o.quantity || 0),
            ];
          });
          const tY0c = y;
          autoTable(doc, { startY: y, head: [head], body, margin: { left: M, right: M }, ...tableStyles });
          const tY1c = (doc as any).lastAutoTable.finalY;
          doc.setDrawColor(...C.line); doc.setLineWidth(0.35);
          (doc as any).roundedRect(M, tY0c - 0.5, W - M * 2, tY1c - tY0c + 1, R, R, 'D');
          y = tY1c + 8;
          if (shareOpts.grades) {
            for (const o of custOrders) {
              const pairs = o.pairs || {};
              const sizes = Object.keys(pairs).sort((a: string, b: string) => Number(a) - Number(b));
              if (!sizes.length) continue;
              if (y > 255) { doc.addPage(); y = addHeader() + 4; }
              const p = products.find(pr => pr.id === o.productId);
              const ref = shareOpts.refs && p?.reference ? `${p.reference} · ` : '';
              doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.mid);
              doc.text(`Grade  ·  #${o.orderNumber}  ·  ${ref}${p?.name || '—'}`, M + 4, y);
              y += 3.5;
              autoTable(doc, {
                startY: y, head: [sizes], body: [sizes.map((s: string) => String(pairs[s] || 0))],
                margin: { left: M + 4, right: M },
                styles: { fontSize: 7.5, cellPadding: 1.6, halign: 'center' as const, lineColor: C.line, lineWidth: 0.2 },
                headStyles: { fillColor: C.indigoLight, textColor: C.indigo, fontStyle: 'bold' as const },
                bodyStyles: { fillColor: C.white, textColor: C.dark, fontStyle: 'bold' as const },
                theme: 'grid',
              });
              y = (doc as any).lastAutoTable.finalY + 6;
            }
          }
        }
      }

      // Rodapé em todas as páginas
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(...C.line); doc.setLineWidth(0.3);
        doc.line(M, 284, W - M, 284);
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.muted);
        doc.text(`PCP CENTRAL  ·  ${dateStr}`, M, 289);
        doc.text(`${i} / ${totalPages}`, W - M, 289, { align: 'right' });
      }

      await sharePDF(doc, `PCP_${typeLabel.replace(/ /g, '_')}_${dateStr.replace(/\//g, '-')}.pdf`);
      toast.show('PDF gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar PDF do PCP:', err);
      toast.show('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setShareGenerating(null);
    }
  };

  const generatePCPImage = async () => {
    setShareGenerating('image');
    try {
      const filtered = getShareData();
      const typeLabel = shareReportType === 'sector' ? 'Por Setor' : shareReportType === 'lot' ? 'Por Mapa' : 'Por Cliente';
      const W = 1080;
      const PAD = 40;
      const LOT_H = 42;
      const CELL_W = 72;
      const GRADE_H = 56; // size row (24) + qty row (28) + gap (4)

      type CanvasItem = {
        type: 'section' | 'lot' | 'grade' | 'spacer';
        text?: string; sub?: string; qty?: string;
        sizes?: string[]; pairsMap?: Record<string, number>;
      };
      const items: CanvasItem[] = [];

      const buildLotItems = (lot: (typeof filtered)[0], extraSub?: string, section?: { qty: number; grade: Record<string, number> | null; products: Product[] } | null) => {
        const p = products.find(pr => pr.id === lot.productId);
        const v = p?.variations?.find(va => va.id === lot.variationId);
        const ref = shareOpts.refs && p?.reference ? `${p.reference} · ` : '';
        const cust = shareOpts.customer && lot.customerName ? `  ·  ${lot.customerName}` : '';
        let prodSub: string;
        if (section && section.products.length > 1) {
          prodSub = `${section.products.length} modelos`;
        } else if (section && section.products.length === 1) {
          const sp = section.products[0];
          const spRef = shareOpts.refs && sp.reference ? `${sp.reference} · ` : '';
          prodSub = `${spRef}${sp.name}`;
        } else {
          prodSub = `${ref}${p?.name || '—'}  /  ${v?.colorName || '—'}`;
        }
        items.push({
          type: 'lot',
          text: `MAPA ${lot.orderNumber}`,
          sub: `${prodSub}${cust}${extraSub || ''}`,
          qty: `${section ? section.qty : lot.quantity} par`,
        });
        if (shareOpts.grades) {
          const pairs = (section ? section.grade : lot.pairs) || {} as Record<string, number>;
          const sizes = Object.keys(pairs).sort((a, b) => Number(a) - Number(b));
          if (sizes.length) items.push({ type: 'grade', sizes, pairsMap: pairs });
        }
      };

      const searchQ3 = shareSearch.trim().toLowerCase();
      const customerMatchOrders2 = searchQ3
        ? productionOrders.filter(o => (o.customerName || '').toLowerCase().includes(searchQ3))
        : [];

      if (customerMatchOrders2.length > 0) {
        const custMap3 = new Map<string, typeof customerMatchOrders2>();
        customerMatchOrders2.forEach(o => {
          const k = o.customerName || 'Sem Cliente';
          if (!custMap3.has(k)) custMap3.set(k, []);
          custMap3.get(k)!.push(o);
        });
        for (const [custName, orders] of custMap3) {
          const custTotal = orders.reduce((s, o) => s + o.items.reduce((ss, it) => ss + (it.toProductionQty || 0), 0), 0);
          items.push({ type: 'section', text: custName, sub: `${orders.length} pedido(s) · ${custTotal} pares` });
          for (const order of orders) {
            const orderLots3 = lots.filter(l => order.lotIds?.includes(l.id));
            const sectorSub3 = orderLots3.length > 0
              ? '  ·  ' + [...new Set(orderLots3.map(l => {
                if (l.finishedAt) return 'Concluído';
                const sid = getOrderEffectiveSector(l, order.id);
                if (sid === ORDER_FINALIZED) return 'Concluído';
                return sectors.find(s => s.id === sid)?.name || 'Sem Setor';
              }))].join(', ')
              : '';
            for (const item of order.items) {
              const p3 = products.find(pr => pr.id === item.productId);
              const v3 = p3?.variations?.find(va => va.id === item.variationId);
              const ref3 = shareOpts.refs && p3?.reference ? `${p3.reference} · ` : '';
              items.push({
                type: 'lot',
                text: `PEDIDO ${order.saleOrderNumber}`,
                sub: `${ref3}${p3?.name || item.productName || '—'}  /  ${v3?.colorName || item.variationName || '—'}${sectorSub3}`,
                qty: `${item.toProductionQty || 0} par`,
              });
              if (shareOpts.grades) {
                const itemSzs3 = Object.entries(item.sizes || {}).filter(([, v]) => v.toProduction > 0).sort(([a], [b]) => Number(a) - Number(b));
                if (itemSzs3.length) {
                  const pairsMap3: Record<string, number> = {};
                  itemSzs3.forEach(([sz, v]) => { pairsMap3[sz] = v.toProduction; });
                  items.push({ type: 'grade', sizes: itemSzs3.map(([sz]) => sz), pairsMap: pairsMap3 });
                }
              }
            }
          }
          items.push({ type: 'spacer' });
        }
      } else if (shareReportType === 'sector') {
        type SectorEntry = { lot: typeof filtered[number]; sectionItems: any[] | null };
        const sectorMap = new Map<string, { name: string; entries: SectorEntry[] }>();
        filtered.forEach(lot => {
          const pendingGroups = getLotPendingSectorGroups(lot);
          const isSplit = pendingGroups.size > 1;
          pendingGroups.forEach((groupItems, sid) => {
            const sec = sectors.find(s => s.id === sid);
            if (!sectorMap.has(sid)) sectorMap.set(sid, { name: sec?.name || 'Sem Setor', entries: [] });
            sectorMap.get(sid)!.entries.push({ lot, sectionItems: isSplit ? groupItems : null });
          });
        });
        for (const [, { name, entries }] of sectorMap) {
          const total = entries.reduce((s, { lot, sectionItems }) => s + (sectionItems ? computeSectionGroup(lot, sectionItems).qty : lot.quantity), 0);
          items.push({ type: 'section', text: name, sub: `${entries.length} mapas · ${total} pares` });
          entries.forEach(({ lot, sectionItems }) => buildLotItems(lot, '', sectionItems ? computeSectionGroup(lot, sectionItems) : null));
          items.push({ type: 'spacer' });
        }
      } else {
        filtered.forEach(lot => {
          const sectorNames = Array.from(getLotPendingSectorGroups(lot).keys())
            .map(sid => sectors.find(s => s.id === sid)?.name || sid)
            .join(', ');
          buildLotItems(lot, sectorNames ? `  ·  ${sectorNames}` : '');
        });
      }

      const gradeH = (it: CanvasItem) => {
        if (it.type !== 'grade' || !it.sizes) return 0;
        const cols = Math.floor((W - PAD * 2 - 24) / CELL_W);
        return Math.ceil(it.sizes.length / cols) * GRADE_H + 12;
      };

      const HEADER_H = 80;
      const FOOTER_H = 44;
      const H = HEADER_H
        + items.reduce((s, it) =>
          s + (it.type === 'section' ? 46 : it.type === 'spacer' ? 20 : it.type === 'grade' ? gradeH(it) : LOT_H)
          , PAD)
        + FOOTER_H + PAD;

      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = Math.max(H, 400);
      const ctx = canvas.getContext('2d')!;

      // ── Background branco ──────────────────────────────────
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, canvas.height);

      // ── Header limpo ──────────────────────────────────────
      // Linha acento indigo no topo (4px)
      ctx.fillStyle = '#6366f1'; ctx.fillRect(0, 0, W, 4);
      // Título
      ctx.fillStyle = '#0f172a'; ctx.font = 'bold 32px Arial,sans-serif';
      ctx.fillText('PCP CENTRAL', PAD, 44);
      // Subtítulo
      ctx.fillStyle = '#6366f1'; ctx.font = '13px Arial,sans-serif';
      ctx.fillText('Planejamento e Controle de Produção', PAD, 63);
      // Data + tipo à direita
      ctx.fillStyle = '#94a3b8'; ctx.font = '13px Arial,sans-serif';
      const hRight = `${typeLabel}  ·  ${new Date().toLocaleDateString('pt-BR')}  ·  ${filtered.length} mapas`;
      ctx.fillText(hRight, W - PAD - ctx.measureText(hRight).width, 44);
      // Linha separadora
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD, HEADER_H - 4); ctx.lineTo(W - PAD, HEADER_H - 4); ctx.stroke();

      let y = HEADER_H + PAD;

      for (const item of items) {
        if (item.type === 'section') {
          // Seção: linha indigo esquerda + texto
          ctx.fillStyle = '#6366f1'; ctx.fillRect(PAD, y + 2, 4, 34);
          ctx.fillStyle = '#0f172a'; ctx.font = 'bold 16px Arial,sans-serif';
          ctx.fillText(item.text!.toUpperCase(), PAD + 14, y + 20);
          ctx.fillStyle = '#94a3b8'; ctx.font = '13px Arial,sans-serif';
          ctx.fillText(item.sub!, PAD + 14, y + 37);
          // Linha separadora leve
          ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(PAD, y + 44); ctx.lineTo(W - PAD, y + 44); ctx.stroke();
          y += 46;
        } else if (item.type === 'lot') {
          // Ponto indigo + MAPA em negrito + info
          ctx.fillStyle = '#6366f1'; ctx.beginPath(); ctx.arc(PAD + 8, y + LOT_H / 2, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#4f46e5'; ctx.font = 'bold 14px Arial,sans-serif';
          ctx.fillText(item.text!, PAD + 22, y + LOT_H / 2 + 5);
          const mapW = ctx.measureText(item.text!).width;
          ctx.fillStyle = '#475569'; ctx.font = '13px Arial,sans-serif';
          // Truncar sub se muito longa
          const maxSubW = W - PAD * 2 - 22 - mapW - 16 - 80;
          let sub = item.sub!;
          while (sub.length > 4 && ctx.measureText(sub).width > maxSubW) sub = sub.slice(0, -1);
          if (sub !== item.sub) sub += '…';
          ctx.fillText(sub, PAD + 22 + mapW + 14, y + LOT_H / 2 + 5);
          // Qty à direita
          ctx.fillStyle = '#6366f1'; ctx.font = 'bold 13px Arial,sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(item.qty!, W - PAD, y + LOT_H / 2 + 5);
          ctx.textAlign = 'left';
          // Linha separadora fina
          ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(PAD + 22, y + LOT_H - 1); ctx.lineTo(W - PAD, y + LOT_H - 1); ctx.stroke();
          y += LOT_H;
        } else if (item.type === 'grade') {
          const sizes = item.sizes!;
          const pairsMap = item.pairsMap!;
          const cols = Math.floor((W - PAD * 2 - 24) / CELL_W);
          let gy = y + 4;
          for (let i = 0; i < sizes.length; i++) {
            if (i > 0 && i % cols === 0) gy += GRADE_H;
            const cx = PAD + 24 + (i % cols) * CELL_W;
            // Célula tamanho: grafite (apenas aqui)
            ctx.fillStyle = '#475569';
            ctx.fillRect(cx, gy, CELL_W - 3, 24);
            ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 12px Arial,sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(sizes[i], cx + (CELL_W - 3) / 2, gy + 16);
            // Célula quantidade: branca com borda leve
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(cx, gy + 24, CELL_W - 3, 28);
            ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5;
            ctx.strokeRect(cx, gy + 24, CELL_W - 3, 28);
            ctx.fillStyle = '#0f172a'; ctx.font = 'bold 14px Arial,sans-serif';
            ctx.fillText(String(pairsMap[sizes[i]] || 0), cx + (CELL_W - 3) / 2, gy + 42);
            ctx.textAlign = 'left';
          }
          y += Math.ceil(sizes.length / cols) * GRADE_H + 12;
        } else {
          y += 20;
        }
      }

      // ── Footer limpo ──────────────────────────────────────
      const footY = canvas.height - FOOTER_H;
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD, footY); ctx.lineTo(W - PAD, footY); ctx.stroke();
      ctx.fillStyle = '#94a3b8'; ctx.font = '12px Arial,sans-serif';
      ctx.fillText(
        `PCP CENTRAL  ·  ${filtered.length} mapas  ·  ${filtered.reduce((s, l) => s + (l.quantity || 0), 0)} pares  ·  ${new Date().toLocaleString('pt-BR')}`,
        PAD, footY + 26
      );

      const base64 = canvas.toDataURL('image/jpeg', 0.93);
      await shareImage(base64, `PCP_${typeLabel.replace(/ /g, '_')}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.jpg`);
      toast.show('Imagem gerada com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar imagem do PCP:', err);
      toast.show('Erro ao gerar imagem. Tente novamente.');
    } finally {
      setShareGenerating(null);
    }
  };

  if (isCuttingAreaOpen) {
    return (
      <CuttingAreaPanel
        lots={lots}
        products={products}
        sectors={sectors}
        flowTags={flowTags}
        colors={colors}
        productionConfigs={productionConfigs}
        people={people}
        accounts={accounts}
        categories={categories}
        serviceOrders={serviceOrders}
        isDarkMode={isDarkMode}
        onBack={() => setIsCuttingAreaOpen(false)}
        onSaveLot={onSaveLot}
        userName={userName}
        productionOrders={productionOrders}
      />
    );
  }

  return (
    <div className={`flex flex-col gap-6 pb-32 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <header className="flex flex-col gap-4">
        {/* Linha 1: Voltar + Título */}
        <div className="flex items-center gap-4 px-2">
          <button
            type="button"
            onClick={onBack}
            title="Voltar ao Painel"
            aria-label="Voltar para a tela anterior"
            className={`p-3 rounded-2xl transition-all flex-shrink-0 ${isDarkMode ? 'bg-slate-900 text-slate-400 hover:text-white' : 'bg-white text-slate-400 hover:text-slate-900 shadow-sm border border-slate-100'}`}
          >
            <ChevronRight className="rotate-180" size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight leading-none">PCP Central</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Planejamento e Controle de Produção</p>
          </div>
        </div>

        {/* As Ações Rápidas (Escanear, Filtros, Compartilhar, Mapas) ficam agora no
            popup do 6º ícone ("Ações") da navegação. */}

        {/* Popup centralizado — Filtros (mesmo padrão das Ações Rápidas/Cor de Badges) */}
        {isFilterPopupOpen && (
          <div className="fixed inset-0 z-[300000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsFilterPopupOpen(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md max-h-[85vh] overflow-y-auto rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-50 text-violet-500'}`}>
                    <Filter size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Filtros</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Barra de estatísticas</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterPopupOpen(false)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
                  aria-label="Fechar" title="Fechar"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>

              <div className="p-5 flex flex-col gap-4">
                <div className={`flex flex-col gap-3`}>
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Barra de Estatísticas</h4>
                    <button
                      type="button"
                      onClick={toggleStatsBarHidden}
                      aria-label={statsBarHidden ? 'Mostrar barra de estatísticas' : 'Ocultar barra de estatísticas'}
                      className={`w-12 h-7 rounded-full transition-all relative flex-shrink-0 ${!statsBarHidden ? 'bg-indigo-600' : isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}
                    >
                      <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-200 flex items-center justify-center ${!statsBarHidden ? 'left-5' : 'left-0.5'}`}>
                        {statsBarHidden ? <EyeOff size={10} className="text-slate-400" /> : <Eye size={10} className="text-indigo-600" />}
                      </span>
                    </button>
                  </div>

                  {!statsBarHidden && (
                    <div className="flex flex-col gap-2 px-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest -mt-1">Cartões exibidos na barra</p>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { id: 'total', label: 'Produção Total' },
                          { id: 'inProgress', label: 'Em Produção' },
                          { id: 'active', label: 'Pedidos em Produção' },
                          { id: 'delayed', label: 'Atrasos' },
                        ] as { id: StatsBarTile; label: string }[]).map(tile => {
                          const on = statsBarTiles[tile.id];
                          return (
                            <button
                              key={tile.id}
                              type="button"
                              onClick={() => toggleStatsBarTile(tile.id)}
                              className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${on
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50'
                                : isDarkMode ? 'bg-slate-800/40 border border-slate-700 text-slate-500' : 'bg-slate-50 border border-slate-100 text-slate-400'
                                }`}
                            >
                              {tile.label}
                              {on ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navegação — card único com 6 divisões (5 entradas + Ações Rápidas) */}
        <div className={`w-full rounded-2xl overflow-hidden border ${isDarkMode ? 'border-slate-800' : 'border-slate-100 shadow-sm'}`}>
          <div className={`grid grid-cols-3 sm:grid-cols-6 gap-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            {/* Monitor */}
            <button
              type="button"
              onClick={() => { setActiveTab('monitor'); setSelectedSectorId(null); }}
              className={`relative flex items-center justify-center gap-1.5 py-3 px-2 transition-all active:scale-95 ${activeTab === 'monitor' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-600'}`}
            >
              <LayoutDashboard size={15} strokeWidth={2.5} className={`shrink-0 ${activeTab === 'monitor' ? 'text-white' : 'text-indigo-500'}`} />
              <span className="text-[9px] font-black uppercase tracking-wide truncate">Monitor</span>
            </button>
            {/* Área de Corte (no lugar de Mapas) */}
            <button
              type="button"
              onClick={() => setIsCuttingAreaOpen(true)}
              className={`relative flex items-center justify-center gap-1.5 py-3 px-2 transition-all active:scale-95 ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-600'}`}
            >
              <Scissors size={15} strokeWidth={2.5} className="shrink-0 text-indigo-500" />
              <span className="text-[9px] font-black uppercase tracking-wide truncate">Corte</span>
              {cuttingAreaLotsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center">
                  {cuttingAreaLotsCount}
                </span>
              )}
            </button>
            {/* Pedidos */}
            <button
              type="button"
              onClick={() => { setActiveTab('orders'); setSelectedSectorId(null); }}
              className={`relative flex items-center justify-center gap-1.5 py-3 px-2 transition-all active:scale-95 ${activeTab === 'orders' ? 'bg-violet-600 text-white' : isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-600'}`}
            >
              <ClipboardList size={15} strokeWidth={2.5} className={`shrink-0 ${activeTab === 'orders' ? 'text-white' : 'text-violet-500'}`} />
              <span className="text-[9px] font-black uppercase tracking-wide truncate">Pedidos</span>
              {pendingOrders.length > 0 && (
                <span className={`absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-1 rounded-full text-[8px] font-black flex items-center justify-center ${activeTab === 'orders' ? 'bg-white text-violet-600' : 'bg-violet-500 text-white'}`}>
                  {pendingOrders.length}
                </span>
              )}
            </button>
            {/* Necessidades */}
            <button
              type="button"
              onClick={() => { setActiveTab('needs'); setSelectedSectorId(null); }}
              className={`relative flex items-center justify-center gap-1.5 py-3 px-2 transition-all active:scale-95 ${activeTab === 'needs' ? 'bg-amber-500 text-white' : isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-600'}`}
            >
              <AlertCircle size={15} strokeWidth={2.5} className={`shrink-0 ${activeTab === 'needs' ? 'text-white' : 'text-amber-500'}`} />
              <span className="text-[9px] font-black uppercase tracking-wide truncate">Necessid.</span>
              {purchaseNeeds.length > 0 ? (
                <span className={`absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-1 rounded-full text-[8px] font-black flex items-center justify-center ${activeTab === 'needs'
                  ? 'bg-white text-amber-600'
                  : (purchaseNeeds.some(i => i.type === 'MATERIAL' ? i.required > i.stock : i.sizeShortages ? Object.values(i.sizeShortages).some((s: any) => s.required > s.stock) : false) ? 'bg-rose-500 text-white' : 'bg-indigo-400 text-white')
                  }`}>
                  {purchaseNeeds.length}
                </span>
              ) : hasAnyPurchaseNeed && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500" title="Há necessidades de compra em outra origem (Mapas/Pedidos)" />
              )}
            </button>
            {/* Solados */}
            <button
              type="button"
              onClick={() => { setActiveTab('solados'); setSelectedSectorId(null); }}
              className={`relative flex items-center justify-center gap-1.5 py-3 px-2 transition-all active:scale-95 ${activeTab === 'solados' ? 'bg-cyan-600 text-white' : isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-600'}`}
            >
              <Footprints size={15} strokeWidth={2.5} className={`shrink-0 ${activeTab === 'solados' ? 'text-white' : 'text-cyan-500'}`} />
              <span className="text-[9px] font-black uppercase tracking-wide truncate">Solados</span>
            </button>
            {/* Ações Rápidas (no lugar de Enviar) — abre popup centralizado */}
            <button
              type="button"
              onClick={() => setShowQuickActions(true)}
              className={`relative flex items-center justify-center gap-1.5 py-3 px-2 transition-all active:scale-95 ${showQuickActions ? 'bg-rose-500 text-white' : isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-600'}`}
            >
              <Zap size={15} strokeWidth={2.5} className={`shrink-0 ${showQuickActions ? 'text-white' : 'text-rose-500'}`} />
              <span className="text-[9px] font-black uppercase tracking-wide truncate">Ações</span>
            </button>
          </div>
        </div>
      </header>

      {/* Popup centralizado — Ações Rápidas */}
      {showQuickActions && (
        <div className="fixed inset-0 z-[300000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowQuickActions(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-500'}`}>
                  <Zap size={22} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className={`text-lg font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Ações Rápidas</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Atalhos da produção</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickActions(false)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
                aria-label="Fechar" title="Fechar"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              {[
                { label: 'Escanear', icon: <Camera size={20} />, color: 'text-sky-500', bg: isDarkMode ? 'bg-sky-500/10' : 'bg-sky-50', run: () => setIsScannerOpen(true) },
                { label: 'Filtros', icon: <Filter size={20} />, color: 'text-violet-500', bg: isDarkMode ? 'bg-violet-500/10' : 'bg-violet-50', run: () => setIsFilterPopupOpen(true), dot: statsBarHidden || Object.values(statsBarTiles).some(v => !v) },
                { label: 'Compartilhar', icon: <Share2 size={20} />, color: 'text-orange-500', bg: isDarkMode ? 'bg-orange-500/10' : 'bg-orange-50', run: () => setShareModal({ isOpen: true, format: 'jpg', selectedItems: filteredActiveLots }) },
                { label: 'Mapas', icon: <ListTodo size={20} />, color: 'text-emerald-500', bg: isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50', run: () => { setActiveTab('lots'); setSelectedSectorId(null); } },
                { label: 'Cor Mapa', icon: <Palette size={20} />, color: 'text-indigo-500', bg: isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50', run: () => { setColorPickerLot(null); setIsColorPickerOpen(true); } },
                { label: 'Cor Badges', icon: <Tag size={20} />, color: 'text-rose-500', bg: isDarkMode ? 'bg-rose-500/10' : 'bg-rose-50', run: () => setIsBadgeColorPickerOpen(true) },
                { label: 'OS Concluídas', icon: <CheckSquare size={20} />, color: 'text-emerald-500', bg: isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50', run: () => setShowCompletedOSModal(true) },
                { label: 'Diag. Estoque', icon: <AlertTriangle size={20} />, color: 'text-rose-500', bg: isDarkMode ? 'bg-rose-500/10' : 'bg-rose-50', run: () => setShowStockDiagnosticModal(true), dot: duplicateStockLotGroups.length > 0 },
                { label: 'Reparar Caixas', icon: <Wrench size={20} />, color: 'text-amber-500', bg: isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50', run: () => { const items = buildStockRepairItems(); setStockRepairModal({ phase: 'preview', items, appliedCount: 0 }); } },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => { setShowQuickActions(false); action.run(); }}
                  className={`relative flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl border transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800/40 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm'}`}
                >
                  {action.dot && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-sky-500" />}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${action.bg} ${action.color}`}>
                    {action.icon}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest text-center leading-tight ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'monitor' && (
        <div className="flex flex-col gap-8">
          <StockDuplicateBanner
            count={duplicateStockLotGroups.length}
            onOpen={() => setShowStockDiagnosticModal(true)}
            isDarkMode={isDarkMode}
          />

          {/* WIP Overview — Produção Total (todos os mapas, histórico) / Em Produção
              (pares ainda pendentes nos setores, já descontando pedidos do mapa que
              tiveram sua expedição finalizada via activePendingPairs) / Pedidos em
              Produção (contagem) / Atrasos. Visibilidade geral e por cartão
              configurável no popup de Filtros. */}
          {!statsBarHidden && (() => {
            const tileDefs: { id: StatsBarTile; label: string; value: number; unit: string; color: string }[] = [
              { id: 'total', label: 'Produção Total', value: lots.reduce((acc, l) => acc + l.quantity, 0), unit: 'Pares', color: 'text-violet-600' },
              { id: 'inProgress', label: 'Em Produção', value: activePendingPairs, unit: 'Pares', color: 'text-indigo-600' },
              { id: 'active', label: 'Pedidos em Prod.', value: activeOrdersCount, unit: 'Pedidos', color: 'text-emerald-600' },
              { id: 'delayed', label: 'Atrasos', value: Object.values(sectorMetrics).reduce((acc, m) => acc + m.delayedCount, 0), unit: 'Críticos', color: 'text-rose-500' },
            ];
            const visibleTiles = tileDefs.filter(t => statsBarTiles[t.id]);
            if (visibleTiles.length === 0) return null;
            const gridColsClass = visibleTiles.length === 1 ? 'grid-cols-1' : visibleTiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';
            return (
              <div className={`grid ${gridColsClass} gap-3`}>
                {visibleTiles.map(tile => (
                  <div key={tile.id} className={`flex flex-col items-center text-center px-4 py-4 rounded-[1.5rem] border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight mb-1.5" style={{ minHeight: 26 }}>{tile.label}</span>
                    <span className={`text-xl font-black leading-none ${tile.color}`}>{tile.value}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase mt-1">{tile.unit}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Sectors Dashboard or Specific Sector View */}
          {!selectedSectorId ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleSectors.map((sector) => {
                const metric = sectorMetrics[sector.id];
                return (
                  <button
                    key={sector.id}
                    onClick={() => setSelectedSectorId(sector.id)}
                    title={`Ver detalhes do setor ${sector.name}`}
                    className={`group relative rounded-[2rem] border transition-all flex flex-col text-left hover:-translate-y-1 active:scale-[0.98] overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-100 shadow-sm shadow-slate-200/60 hover:shadow-xl hover:shadow-slate-200/60'
                      }`}
                  >
                    {/* Brilho sutil da cor do setor */}
                    {!isIndustrial && (
                      <div className="absolute -top-20 -right-16 w-44 h-44 rounded-full blur-3xl opacity-[0.18] pointer-events-none" style={{ backgroundColor: sector.color }} />
                    )}
                    {/* Barra superior com a cor do setor */}
                    {!isIndustrial && (
                      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: sector.color }} />
                    )}

                    <div className="relative p-6 flex flex-col gap-5">
                      {/* Header: ícone + nome + badges */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md" style={{ background: `linear-gradient(135deg, ${sector.color}, ${sector.color}bb)`, color: '#fff', boxShadow: `0 8px 20px -6px ${sector.color}88` }}>
                            <Factory size={24} strokeWidth={2.2} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-[15px] font-black uppercase tracking-wide leading-tight text-slate-900 dark:text-white">{sector.name}</h3>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Setor de Produção</span>
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {metric?.delayedCount > 0 && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-rose-500 text-white rounded-full shadow-lg shadow-rose-500/30 animate-pulse">
                              <Clock size={9} strokeWidth={3} />
                              <span className="text-[9px] font-black tracking-widest">{metric.delayedCount}</span>
                            </div>
                          )}
                          {metric?.urgentCount > 0 && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white rounded-full shadow-lg shadow-amber-500/30">
                              <AlertCircle size={9} strokeWidth={3} />
                              <span className="text-[9px] font-black tracking-widest">{metric.urgentCount}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Estatísticas em tiles */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className={`rounded-2xl px-4 py-3 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pares no Setor</span>
                          <p className={`text-2xl font-black leading-none mt-1.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{metric?.totalPares || 0}</p>
                        </div>
                        <div className={`rounded-2xl px-4 py-3 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Mapas WIP</span>
                          <p className={`text-2xl font-black leading-none mt-1.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{metric?.lotsCount || 0}</p>
                        </div>
                      </div>

                      {/* Rodapé: ação */}
                      <div className="flex items-center justify-between pt-1">
                        <span 
                          className={`text-[10px] font-black uppercase tracking-widest ${isIndustrial ? 'text-slate-500 dark:text-zinc-400' : ''}`} 
                          style={isIndustrial ? undefined : { color: sector.color }}
                        >
                          Ver Detalhes
                        </span>
                        <div 
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-1 ${isIndustrial ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400' : ''}`} 
                          style={isIndustrial ? undefined : { backgroundColor: `${sector.color}1f`, color: sector.color }}
                        >
                          <ChevronRight size={16} strokeWidth={2.5} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 px-2">
                {/* Nome do setor atual, centralizado pela largura do subcard abaixo */}
                <div className="flex items-center justify-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 truncate">
                    {sectors.find(s => s.id === selectedSectorId)?.name}
                  </h3>
                </div>

                {/* Subcard dividido em 2: Voltar para Setores | Mudar Setor */}
                <div className={`p-1.5 rounded-2xl shadow-sm flex gap-1.5 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 border'}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedSectorId(null)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <ChevronRight size={14} className="rotate-180" /> Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSectorSwitcherOpen(true)}
                    title="Mudar para outro setor"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-orange-500 text-white shadow-md shadow-orange-500/25 hover:bg-orange-600 transition-all active:scale-95"
                  >
                    <ArrowLeftRight size={14} /> Mudar Setor
                  </button>
                </div>
                {isSectorSwitcherOpen && createPortal(
                  <div
                    className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
                    style={{ zIndex: 60000 }}
                    onClick={() => setIsSectorSwitcherOpen(false)}
                  >
                    <div
                      className={`w-full max-w-xs rounded-[2rem] border shadow-2xl p-5 flex flex-col gap-3 animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between px-1">
                        <h3 className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>Mudar Setor</h3>
                        <button
                          type="button"
                          title="Fechar"
                          onClick={() => setIsSectorSwitcherOpen(false)}
                          className={`p-1.5 rounded-full transition-all ${isDarkMode ? 'text-slate-500 hover:bg-slate-800 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {visibleSectors.map(sector => (
                          <button
                            key={sector.id}
                            type="button"
                            onClick={() => {
                              setSelectedSectorId(sector.id);
                              setIsSectorSwitcherOpen(false);
                            }}
                            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-left transition-all ${sector.id === selectedSectorId
                              ? 'bg-orange-500 text-white'
                              : isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'
                              }`}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sector.color }} />
                            {sector.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
              </div>


              {(
                <>
                  {/* ── Pedidos Vinculados — padrão idêntico ao setor de Corte ── */}
                  {(() => {
                    type FichaItem = { lot: ProductionLot; si: any; siIdx: number; product: any; variation: any; orderItem: any; order: any; coveringOS?: ServiceOrder };
                    // sourceItemKeys (formato lotId::orderId::siIdx) é gravado pela OS desde sempre
                    // e identifica o item exato selecionado — usar isso em vez de sourceOrderIds
                    // (que guarda só o orderId "puro") evita travar os outros itens do mesmo pedido
                    // que não foram selecionados na emissão da OS. sourceOrderIds só entra como
                    // fallback pra OS antigas, criadas antes de sourceItemKeys existir.
                    const osCoversItem = (os: ServiceOrder, lotId: string, orderId: string, siIdx: number): boolean => {
                      if (os.sourceItemKeys && os.sourceItemKeys.length > 0) {
                        return os.sourceItemKeys.includes(`${lotId}::${orderId}::${siIdx}`);
                      }
                      if (os.sourceOrderIds && os.sourceOrderIds.length > 0) {
                        return os.sourceOrderIds.includes(orderId);
                      }
                      return false;
                    };
                    const allFichas: FichaItem[] = [];
                    filteredActiveLots.forEach(lot => {
                      // Mapas antigos criados sem metadata.sourceItems (ex: via Venda → Pedido
                      // de Produção) não tinham ficha nenhuma aqui — sintetiza uma a partir do
                      // productionOrderId pra não ficarem invisíveis em "Pedidos Vinculados".
                      const lotSI: any[] = (lot as any).metadata?.sourceItems
                        || (lot.productionOrderId ? [{ orderId: lot.productionOrderId, itemIdx: 0, qty: lot.quantity }] : []);

                      lotSI.forEach((si: any, idx: number) => {
                        const effectiveSector = getOrderEffectiveSector(lot, si.orderId, si);
                        if (effectiveSector !== selectedSectorId) return;

                        const prod = products.find(p => p.id === si.productId);
                        const vari = prod?.variations.find((v: any) => v.id === si.variationId);
                        const ord = productionOrders.find(o => o.id === si.orderId);
                        const ordItem: any = si.itemIdx !== undefined ? ord?.items[si.itemIdx] : ord?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
                        const siIdx = idx;
                        // O casamento por sourceItemKeys/sourceOrderIds já identifica o item exato
                        // coberto pela OS — não precisa (e não deve) também exigir os.sectorId ===
                        // selectedSectorId aqui: esse campo é só um denormalizado da OS, e exigir
                        // os dois batendo causava o caso real de uma OS pendente que comprovadamente
                        // cobria o item (confirmado abrindo "Visualizar" na OS) ficar sem o feedback
                        // de "Atrelado à OS" só porque sectorId não coincidia. O filtro por setor
                        // continua só no fallback genérico (OS sem nenhuma restrição de item), onde
                        // é a única forma de não misturar OS de outro setor com nenhuma precisão.
                        //
                        // status: 'PENDING' é essencial aqui — sourceItemKeys casa pra sempre, então
                        // toda OS antiga já concluída do mesmo item também "bate" na busca. Sem esse
                        // filtro, o .find() podia parar numa OS antiga concluída (ordem do array) e
                        // nunca chegar a achar a OS nova pendente, deixando o item sem o feedback de
                        // "Atrelado à OS" mesmo com uma OS pendente genuína cobrindo ele.
                        const coveringOS = serviceOrders.find(os =>
                          os.status === 'PENDING' &&
                          (os.lotId === lot.id || (os.lotIds && os.lotIds.includes(lot.id))) &&
                          osCoversItem(os, lot.id, si.orderId, siIdx)
                        ) || serviceOrders.find(os =>
                          os.status === 'PENDING' &&
                          (os.lotId === lot.id || (os.lotIds && os.lotIds.includes(lot.id))) &&
                          os.sectorId === selectedSectorId &&
                          (!os.sourceOrderIds || os.sourceOrderIds.length === 0) &&
                          (!os.sourceItemKeys || os.sourceItemKeys.length === 0)
                        );
                        allFichas.push({ lot, si, siIdx, product: prod, variation: vari, orderItem: ordItem, order: ord, coveringOS });
                      });
                    });
                    if (allFichas.length === 0) return null;

                    // Cor do setor atual — usada no card "Atrelado à OS" (era sempre laranja,
                    // agora assume um tom bem claro da cor do próprio setor selecionado).
                    const sectorColor = sectors.find(s => s.id === selectedSectorId)?.color || '#f59e0b';

                    // ── State helpers (using fichaListOpen / fichaFilters keyed by '__pedidos__')
                    const mainKey = `__pedidos__${selectedSectorId}`;
                    const filterKey = `__filter__${selectedSectorId}`;
                    const isMainOpen = !fichaListOpen.has(mainKey + '_closed');
                    const isFilterOpen = fichaListOpen.has(filterKey);
                    const activeFilt = fichaFilters[mainKey] || { model: '', color: '', search: '', customerName: '', providerName: '' };
                    const filterSearch = (activeFilt.search || '').trim().toLowerCase();

                    // Modelos únicos: chave = nome (usado no filtro), label = referência (exibida nos chips)
                    const modelMap = new Map<string, { key: string; label: string }>();
                    allFichas.forEach(f => {
                      const name = f.product?.name || f.orderItem?.productName || '';
                      if (!name) return;
                      const label = f.product?.reference || name;
                      if (!modelMap.has(name)) modelMap.set(name, { key: name, label });
                    });
                    const modelOptions = Array.from(modelMap.values()).filter(opt =>
                      !filterSearch || opt.label.toLowerCase().includes(filterSearch) || opt.key.toLowerCase().includes(filterSearch)
                    );
                    const uniqueModels = modelOptions.map(opt => opt.key);
                    // Cores disponíveis: restritas ao modelo/referência selecionado, se houver
                    const fichasForColors = activeFilt.model
                      ? allFichas.filter(f => (f.product?.name || f.orderItem?.productName || '') === activeFilt.model)
                      : allFichas;
                    const uniqueColors = Array.from(new Set(fichasForColors.map(f => f.variation?.colorName || f.orderItem?.variationName || '').filter(Boolean)))
                      .filter(c => !filterSearch || c.toLowerCase().includes(filterSearch));

                    // Clientes com pedidos neste setor — usado na busca com sugestão de nome
                    const customerMap = new Map<string, string>();
                    allFichas.forEach(f => {
                      const cname = f.order?.customerName || 'Estoque';
                      const cid = f.order?.customerId || cname;
                      if (!customerMap.has(cid)) customerMap.set(cid, cname);
                    });
                    const customerOptions = Array.from(customerMap.entries()).map(([id, name]) => ({ id, name }));

                    // Prestadores que já estão atendendo neste setor (via OS pendente vinculada)
                    const uniqueProviders = Array.from(new Set(
                      allFichas
                        .filter(f => f.coveringOS && f.coveringOS.status === 'PENDING')
                        .map(f => f.coveringOS!.providerName)
                        .filter(Boolean)
                    ));

                    // Filtered fichas
                    const filteredFichas = allFichas.filter(f => {
                      const m = f.product?.name || f.orderItem?.productName || '';
                      const c = f.variation?.colorName || f.orderItem?.variationName || '';
                      const customerName = f.order?.customerName || 'Estoque';
                      if (activeFilt.model && m !== activeFilt.model) return false;
                      if (activeFilt.color && c !== activeFilt.color) return false;
                      if (activeFilt.customerName && customerName !== activeFilt.customerName) return false;
                      if (activeFilt.providerName && f.coveringOS?.providerName !== activeFilt.providerName) return false;
                      return true;
                    });

                    // Fichas com OS pendente saem da lista normal e vão pro card "Fichas com
                    // OS Ativas" (fora de "Pedidos Vinculados", acordeão fechado por padrão) —
                    // só fichas livres (sem OS ou com OS já concluída) continuam selecionáveis aqui.
                    const fichasComOSAtivas = filteredFichas.filter(f => !!f.coveringOS && f.coveringOS.status === 'PENDING');
                    const fichasSemOSAtiva = filteredFichas.filter(f => !(f.coveringOS && f.coveringOS.status === 'PENDING'));
                    const osCardKey = `__fichas_os_ativas__${selectedSectorId}`;
                    const isOSCardOpen = fichaListOpen.has(osCardKey + '_open');
                    const sectorOSList = serviceOrders.filter(os => os.sectorId === selectedSectorId && os.status === 'PENDING' &&
                      filteredActiveLots.some(l => os.lotId === l.id));
                    const activeOSCardKey = `__os_ativas__${selectedSectorId}`;
                    const isActiveOSCardOpen = !fichaListOpen.has(activeOSCardKey + '_closed');

                    // ── Filtro de OS Ativas no Setor (mesmas funções do filtro de Pedidos no Setor) ──
                    const osFilterKey = `__os_filter__${selectedSectorId}`;
                    const isOSFilterOpen = fichaListOpen.has(osFilterKey);
                    const activeOSFilt = fichaFilters[activeOSCardKey] || { model: '', color: '', search: '', customerName: '', providerName: '' };
                    const osFilterSearch = (activeOSFilt.search || '').trim().toLowerCase();

                    const osFichasMap = new Map<string, FichaItem[]>();
                    sectorOSList.forEach(os => osFichasMap.set(os.id, getFichasForOS(os)));

                    const osModelMap = new Map<string, { key: string; label: string }>();
                    sectorOSList.forEach(os => {
                      osFichasMap.get(os.id)!.forEach(f => {
                        const name = f.product?.name || f.orderItem?.productName || '';
                        if (!name) return;
                        const label = f.product?.reference || name;
                        if (!osModelMap.has(name)) osModelMap.set(name, { key: name, label });
                      });
                    });
                    const osModelOptions = Array.from(osModelMap.values()).filter(opt =>
                      !osFilterSearch || opt.label.toLowerCase().includes(osFilterSearch) || opt.key.toLowerCase().includes(osFilterSearch)
                    );
                    const osFichasForColors = (activeOSFilt.model
                      ? sectorOSList.flatMap(os => osFichasMap.get(os.id)!.filter(f => (f.product?.name || f.orderItem?.productName || '') === activeOSFilt.model))
                      : sectorOSList.flatMap(os => osFichasMap.get(os.id)!));
                    const osUniqueColors = Array.from(new Set(osFichasForColors.map(f => f.variation?.colorName || f.orderItem?.variationName || '').filter(Boolean)))
                      .filter(c => !osFilterSearch || c.toLowerCase().includes(osFilterSearch));

                    const osCustomerMap = new Map<string, string>();
                    sectorOSList.forEach(os => {
                      osFichasMap.get(os.id)!.forEach(f => {
                        const cname = f.order?.customerName || 'Estoque';
                        const cid = f.order?.customerId || cname;
                        if (!osCustomerMap.has(cid)) osCustomerMap.set(cid, cname);
                      });
                    });
                    const osCustomerOptions = Array.from(osCustomerMap.entries()).map(([id, name]) => ({ id, name }));

                    const osUniqueProviders = Array.from(new Set(sectorOSList.map(os => os.providerName).filter(Boolean)));

                    const filteredSectorOSList = sectorOSList.filter(os => {
                      if (activeOSFilt.providerName && os.providerName !== activeOSFilt.providerName) return false;
                      const fichas = osFichasMap.get(os.id) || [];
                      if (activeOSFilt.model && !fichas.some(f => (f.product?.name || f.orderItem?.productName || '') === activeOSFilt.model)) return false;
                      if (activeOSFilt.color && !fichas.some(f => (f.variation?.colorName || f.orderItem?.variationName || '') === activeOSFilt.color)) return false;
                      if (activeOSFilt.customerName && !fichas.some(f => (f.order?.customerName || 'Estoque') === activeOSFilt.customerName)) return false;
                      return true;
                    });

                    // Selectable = fichas with no pending OS
                    const selectable = fichasSemOSAtiva;
                    const selected = selectable.filter(f => fichaSelection.has(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));
                    const allSelected = selectable.length > 0 && selectable.every(f => fichaSelection.has(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));
                    const selectedQty = selected.reduce((s, f) => s + (f.si.qty || 0), 0);

                    // Group selected fichas by lot for multi-lot OS emission
                    const selByLot = new Map<string, FichaItem[]>();
                    selected.forEach(f => {
                      if (!selByLot.has(f.lot.id)) selByLot.set(f.lot.id, []);
                      selByLot.get(f.lot.id)!.push(f);
                    });

                    return (
                      <>
                      <div className={`mt-4 rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-sky-100 shadow-sm'}`}>

                        {/* ── Cabeçalho acordeão ── */}
                        <button type="button"
                          onClick={() => { const n = new Set(fichaListOpen); isMainOpen ? n.add(mainKey + '_closed') : n.delete(mainKey + '_closed'); setFichaListOpen(n); }}
                          className={`w-full flex items-center justify-between p-4 transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-sky-50/50'}`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Hash size={13} className="text-indigo-500 shrink-0" />
                            <div className="min-w-0">
                              <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Pedidos no Setor</h3>
                            </div>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                              {allFichas.length}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {fichaSelection.size > 0 && (
                              <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                                {fichaSelection.size} sel.
                              </span>
                            )}
                            <ChevronDown size={15} className={`text-slate-400 transition-transform duration-200 ${isMainOpen ? 'rotate-180' : ''}`} />
                          </div>
                        </button>

                        {/* Hint when closed */}
                        {!isMainOpen && (
                          <div className={`px-4 pb-3 flex flex-col gap-1.5 border-t ${isDarkMode ? 'border-slate-800' : 'border-sky-50'}`}>
                            <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest leading-relaxed mt-1">
                              Expandir para selecionar pedidos e criar ordens de serviço
                            </span>
                          </div>
                        )}

                        {isMainOpen && (
                          <div className="p-4 pt-0 flex flex-col gap-3">
                            <p className="text-[9px] text-slate-400 uppercase font-bold">{fichasSemOSAtiva.length} fichas · {selectable.length} disponíveis</p>

                            {/* Select-all row */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-2">
                                {selectable.length > 0 && (
                                  <input type="checkbox"
                                    title="Selecionar todos os pedidos disponíveis"
                                    checked={allSelected}
                                    onChange={() => {
                                      const n = new Set(fichaSelection);
                                      if (allSelected) {
                                        selectable.forEach(f => n.delete(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));
                                      } else {
                                        selectable.forEach(f => n.add(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));
                                      }
                                      setFichaSelection(n);
                                    }}
                                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                                  />
                                )}
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                  {selectable.length} disponíve{selectable.length === 1 ? 'l' : 'is'}
                                </span>
                              </div>
                            </div>

                            {/* Botão que abre o popup de filtros com fundo laranja claro e badge de Filtrar pulsante */}
                            <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-orange-900/40 bg-orange-950/20' : 'border-orange-200 bg-orange-50/50'}`}>
                              <button type="button"
                                onClick={() => { const n = new Set(fichaListOpen); isFilterOpen ? n.delete(filterKey) : n.add(filterKey); setFichaListOpen(n); }}
                                className={`w-full flex items-center gap-2 px-4 py-2.5 transition-colors ${isDarkMode ? 'hover:bg-orange-900/20' : 'hover:bg-orange-100/40'}`}
                              >
                                <Filter size={12} className="text-orange-500 animate-bounce" />
                                <span className="flex-1 text-left">
                                  <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full animate-pulse ${isDarkMode ? 'bg-orange-900/60 text-orange-200' : 'bg-orange-100 text-orange-700'}`}>Filtrar</span>
                                </span>
                                {(activeFilt.model || activeFilt.color || activeFilt.customerName || activeFilt.providerName) && (
                                  <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-indigo-500 text-white">Ativo</span>
                                )}
                              </button>
                            </div>

                            {isFilterOpen && createPortal(
                              <div className="fixed inset-0 z-[60000] flex items-center justify-center p-4">
                                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { const n = new Set(fichaListOpen); n.delete(filterKey); setFichaListOpen(n); }} />
                                <div className={`relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-[2rem] shadow-2xl border p-5 flex flex-col gap-4 bg-gradient-to-br ${isDarkMode ? 'from-slate-800 via-slate-900 to-slate-950 border-slate-800' : 'from-white via-slate-50 to-slate-100 border-slate-100'}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Filter size={14} className="text-orange-500" />
                                      <span className="text-[11px] font-black uppercase tracking-widest">Filtrar Pedidos</span>
                                    </div>
                                    <button type="button" title="Fechar" onClick={() => { const n = new Set(fichaListOpen); n.delete(filterKey); setFichaListOpen(n); }}
                                      className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                                      <X size={16} />
                                    </button>
                                  </div>

                                  <input type="text"
                                    placeholder="Buscar modelo ou referência..."
                                    title="Buscar modelo ou referência"
                                    value={activeFilt.search || ''}
                                    onChange={(e) => setFichaFilters(prev => ({ ...prev, [mainKey]: { ...activeFilt, search: e.target.value } }))}
                                    className={`w-full px-3 py-2.5 rounded-xl text-[11px] font-bold outline-none border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400'}`}
                                  />

                                  {modelOptions.length > 0 && (
                                    <div className={`rounded-2xl border p-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Referência</p>
                                      <div className="grid grid-cols-3 gap-1.5">
                                        {modelOptions.map(({ key, label }) => (
                                          <button type="button" key={key}
                                            onClick={() => setFichaFilters(prev => ({ ...prev, [mainKey]: { ...activeFilt, model: activeFilt.model === key ? '' : key, color: '' } }))}
                                            className={`w-full h-9 px-1 rounded-xl text-[9px] font-black uppercase truncate transition-all border active:translate-y-0.5 active:shadow-none bg-gradient-to-b ${activeFilt.model === key ? 'from-indigo-500 to-indigo-700 text-white border-indigo-800 shadow-[0_3px_0_rgba(67,56,202,0.5)]' : isDarkMode ? 'from-slate-700 to-slate-800 text-slate-300 border-slate-900 shadow-[0_2px_0_rgba(0,0,0,0.35)]' : 'from-white to-slate-100 text-slate-600 border-slate-300 shadow-[0_2px_0_rgba(0,0,0,0.08)]'}`}
                                          >{label}</button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {uniqueColors.length > 0 && (
                                    <div className={`rounded-2xl border p-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Cor</p>
                                      <div className="grid grid-cols-3 gap-1.5">
                                        {uniqueColors.map(c => (
                                          <button type="button" key={c}
                                            onClick={() => setFichaFilters(prev => ({ ...prev, [mainKey]: { ...activeFilt, color: activeFilt.color === c ? '' : c } }))}
                                            className={`w-full h-9 px-1 rounded-xl text-[9px] font-black uppercase truncate transition-all border active:translate-y-0.5 active:shadow-none bg-gradient-to-b ${activeFilt.color === c ? 'from-amber-400 to-amber-600 text-white border-amber-700 shadow-[0_3px_0_rgba(180,83,9,0.5)]' : isDarkMode ? 'from-slate-700 to-slate-800 text-slate-300 border-slate-900 shadow-[0_2px_0_rgba(0,0,0,0.35)]' : 'from-white to-slate-100 text-slate-600 border-slate-300 shadow-[0_2px_0_rgba(0,0,0,0.08)]'}`}
                                          >{c}</button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {customerOptions.length > 0 && (
                                    <div className={`rounded-2xl border p-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Cliente</p>
                                      <ComboBox
                                        options={customerOptions}
                                        value={customerOptions.find(o => o.name === activeFilt.customerName)?.id || ''}
                                        onChange={(val) => {
                                          const opt = customerOptions.find(o => o.id === val);
                                          setFichaFilters(prev => ({ ...prev, [mainKey]: { ...activeFilt, customerName: opt?.name || '' } }));
                                        }}
                                        placeholder="Digite para buscar cliente..."
                                        isDarkMode={isDarkMode}
                                        compact
                                      />
                                    </div>
                                  )}

                                  {uniqueProviders.length > 0 && (
                                    <div className={`rounded-2xl border p-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Prestador de Serviço</p>
                                      <div className="grid grid-cols-3 gap-1.5">
                                        {uniqueProviders.map(p => (
                                          <button type="button" key={p}
                                            onClick={() => setFichaFilters(prev => ({ ...prev, [mainKey]: { ...activeFilt, providerName: activeFilt.providerName === p ? '' : p } }))}
                                            className={`w-full h-9 px-1 rounded-xl text-[9px] font-black uppercase truncate transition-all border active:translate-y-0.5 active:shadow-none bg-gradient-to-b ${activeFilt.providerName === p ? 'from-emerald-500 to-emerald-700 text-white border-emerald-800 shadow-[0_3px_0_rgba(4,120,87,0.5)]' : isDarkMode ? 'from-slate-700 to-slate-800 text-slate-300 border-slate-900 shadow-[0_2px_0_rgba(0,0,0,0.35)]' : 'from-white to-slate-100 text-slate-600 border-slate-300 shadow-[0_2px_0_rgba(0,0,0,0.08)]'}`}
                                          >{p}</button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 pt-1">
                                    {(activeFilt.model || activeFilt.color || activeFilt.search || activeFilt.customerName || activeFilt.providerName) && (
                                      <button type="button" title="Limpar filtros"
                                        onClick={() => setFichaFilters(prev => ({ ...prev, [mainKey]: { model: '', color: '', search: '', customerName: '', providerName: '' } }))}
                                        className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:translate-y-0.5 active:shadow-none bg-gradient-to-b ${isDarkMode ? 'from-slate-700 to-slate-800 text-slate-300 border-slate-900 shadow-[0_3px_0_rgba(0,0,0,0.35)]' : 'from-white to-slate-100 text-slate-500 border-slate-300 shadow-[0_3px_0_rgba(0,0,0,0.08)]'}`}
                                      >✕ Limpar</button>
                                    )}
                                    <button type="button"
                                      onClick={() => { const n = new Set(fichaListOpen); n.delete(filterKey); setFichaListOpen(n); }}
                                      className="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white border border-indigo-800 bg-gradient-to-b from-indigo-500 to-indigo-700 shadow-[0_4px_0_rgba(67,56,202,0.5)] transition-all active:translate-y-0.5 active:shadow-none"
                                    >Aplicar</button>
                                  </div>
                                </div>
                              </div>,
                              document.body
                            )}

                            {/* Ficha cards — flat list */}
                            <div className="flex flex-col gap-1.5">
                              {fichasSemOSAtiva.map((f) => {
                                const itemKey = `${f.lot.id}::${f.si.orderId}::${f.siIdx}`;
                                const hasOS = !!f.coveringOS && f.coveringOS.status === 'PENDING';
                                const isChecked = fichaSelection.has(itemKey);
                                const gradeKey = `grade-${itemKey}`;
                                const gradeOpen = fichaItemExpanded.has(gradeKey);
                                // Fallback pro snapshot salvo no lote (f.si.sizes) — sem isso,
                                // a grade some se o Pedido de Produção original for editado/excluído.
                                // Fichas FRACIONADAS sempre priorizam f.si.sizes (a fatia da fração) —
                                // f.orderItem.sizes é a grade do pedido INTEIRO, compartilhada por
                                // todas as frações do mesmo pedido, e mostraria o total errado aqui.
                                const szSizesSource = f.si?.fractionLabel ? (f.si?.sizes || f.orderItem?.sizes) : (f.orderItem?.sizes || f.si?.sizes);
                                const szEntries = szSizesSource
                                  ? Object.entries(szSizesSource as Record<string, any>)
                                    .filter(([, s]) => (s?.toProduction || 0) > 0)
                                    .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                                  : [];
                                const orderItem = f.orderItem;
                                const product = f.product;
                                const variation = f.variation;
                                const productName = product?.name || orderItem?.productName || '-';
                                const productRef = product?.reference || '';
                                const colorName = variation?.colorName || orderItem?.variationName || '';
                                const completedOS = serviceOrders.find((so: any) => osCoversItem(so, f.lot.id, f.si.orderId, f.siIdx) && so.status === 'COMPLETED');
                                const hasCompletedOS = !!completedOS;
                                const linkedOSList = serviceOrders.filter((so: any) => osCoversItem(so, f.lot.id, f.si.orderId, f.siIdx));
                                const orderItemIdx = f.si.itemIdx !== undefined
                                  ? f.si.itemIdx
                                  : (f.order?.items.findIndex((i: any) => i.productId === f.si.productId && i.variationId === f.si.variationId) ?? -1);
                                const updateOrderItemNote = (updates: { notes?: string | null; reminderAt?: number | null; reminderTitle?: string | null }) => {
                                  if (!f.order || orderItemIdx < 0) return;
                                  const newItems = [...f.order.items];
                                  const updatedItem = { ...newItems[orderItemIdx], ...updates };
                                  newItems[orderItemIdx] = updatedItem;
                                  firebaseService.updateDocument('productionOrders', f.order.id, { items: newItems });

                                  if ('reminderAt' in updates || 'reminderTitle' in updates) {
                                    const reminderId = `order-${f.order.id}-${updatedItem.productId}-${updatedItem.variationId}`;
                                    if (updatedItem.reminderAt) {
                                      notificationService.scheduleReminder({
                                        id: reminderId,
                                        title: updatedItem.reminderTitle || `Pedido ${f.order.orderNumber}`,
                                        body: `${f.order.customerName || 'Estoque'} · Pedido ${f.order.orderNumber}`,
                                        at: updatedItem.reminderAt,
                                      });
                                    } else {
                                      notificationService.cancelReminder(reminderId);
                                    }
                                  }
                                };

                                return (
                                  <div key={itemKey} id={`pedido-card-${itemKey}`} className={`rounded-2xl border overflow-hidden transition-all ${hasOS
                                    ? (isDarkMode ? 'bg-amber-950/20 border-amber-700/40' : 'bg-amber-50 border-amber-200')
                                    : hasCompletedOS
                                      ? (isDarkMode ? 'bg-emerald-950/20 border-emerald-700/40' : 'bg-emerald-50/60 border-emerald-200')
                                      : isChecked
                                        ? (isDarkMode ? 'bg-indigo-950/30 border-indigo-700' : 'bg-indigo-50 border-indigo-200')
                                        : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')
                                    } ${highlightedPedidoKey === itemKey ? 'ring-4 ring-indigo-500/60 border-indigo-500 dark:border-indigo-500 shadow-lg shadow-indigo-500/30 scale-[1.02]' : ''}`}>
                                    {/* Cabeçalho */}
                                    <div className="p-3 flex items-center gap-3">
                                      {hasOS ? (
                                        <div className="text-amber-500 shrink-0 animate-pulse" title="Este pedido já está em uma ordem de serviço ativa neste setor.">
                                          <AlertTriangle size={16} />
                                        </div>
                                      ) : hasCompletedOS ? (
                                        <input
                                          type="checkbox"
                                          title="Selecionar para mover de setor"
                                          checked={isChecked}
                                          onChange={() => {
                                            const n = new Set(fichaSelection);
                                            isChecked ? n.delete(itemKey) : n.add(itemKey);
                                            setFichaSelection(n);
                                          }}
                                          className="w-4 h-4 accent-emerald-500 cursor-pointer shrink-0"
                                        />
                                      ) : (
                                        <input
                                          type="checkbox"
                                          title="Selecionar para mover de setor"
                                          checked={isChecked}
                                          onChange={() => {
                                            const n = new Set(fichaSelection);
                                            isChecked ? n.delete(itemKey) : n.add(itemKey);
                                            setFichaSelection(n);
                                          }}
                                          className="w-4 h-4 accent-indigo-600 cursor-pointer shrink-0"
                                        />
                                      )}

                                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => { const n = new Set(fichaItemExpanded); gradeOpen ? n.delete(gradeKey) : n.add(gradeKey); setFichaItemExpanded(n); }}>
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider leading-none shrink-0" style={{ backgroundColor: productBadgeBg, color: productBadgeText, fontWeight: productBadgeBold ? 900 : 400, fontStyle: productBadgeItalic ? 'italic' : 'normal' }}>
                                              {`${productRef || productName}${colorName ? ` ${colorName}` : ''}`.trim()}
                                            </span>
                                            {f.si.fractionLabel && (
                                              <span title="Pedido fracionado — esta é uma das partes" className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider leading-none shrink-0 bg-amber-500 text-white flex items-center gap-1">
                                                <Scissors size={9} /> Fração {f.si.fractionLabel}
                                              </span>
                                            )}
                                            {(() => {
                                              const effSec = getOrderEffectiveSector(f.lot, f.si.orderId, f.si);
                                              const secName = effSec === ORDER_FINALIZED
                                                ? 'Finalizado'
                                                : (sectors.find(s => s.id === effSec)?.name || effSec || '—');
                                              return hideSectorBadge ? null : (
                                                <span className="text-[9px] uppercase tracking-wider leading-none shrink-0" style={{ color: sectorBadgeColor, fontWeight: sectorBadgeBold ? 900 : 400, fontStyle: sectorBadgeItalic ? 'italic' : 'normal' }}>
                                                  {secName}
                                                </span>
                                              );
                                            })()}
                                          </div>
                                          <span
                                            className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest leading-none shrink-0"
                                            style={(() => {
                                              const bg = (f.lot as any).metadata?.badgeColor || mapBadgeBg;
                                              const txt = (f.lot as any).metadata?.badgeTextColor || getContrastingColor(bg);
                                              return {
                                                backgroundColor: bg,
                                                color: txt,
                                                boxShadow: `0 1px 2px ${bg}40`
                                              };
                                            })()}
                                          >
                                            MAPA{f.lot.orderNumber}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                            PED. {f.lot.orderNumber}
                                          </span>
                                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                            {f.order?.customerName || 'ESTOQUE'}
                                          </span>
                                          <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400">
                                            · {f.si.qty} {f.si.qty === 1 ? 'par' : 'pares'}
                                          </span>
                                          {hasOS && f.coveringOS && (
                                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                                              Atrelado à {f.coveringOS.osNumber} (Já possui OS neste setor!)
                                            </span>
                                          )}
                                        </div>
                                        {hasOS && f.coveringOS && (
                                          <p className="text-[8px] font-bold text-slate-900 dark:text-white uppercase tracking-widest mt-1">
                                            Prestador: {f.coveringOS.providerName || '—'} · Criada em {new Date(f.coveringOS.createdAt).toLocaleDateString('pt-BR')}
                                          </p>
                                        )}
                                      </div>

                                    </div>

                                    {/* ── Rodapé (Sempre visível) ── */}
                                    <div className="px-3 pb-3 pt-1.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-3">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const n = new Set(fichaItemExpanded);
                                          gradeOpen ? n.delete(gradeKey) : n.add(gradeKey);
                                          setFichaItemExpanded(n);
                                        }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all text-[9px] font-black uppercase tracking-wider ${gradeOpen ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                                      >
                                        <ChevronDown size={12} className={`transition-transform duration-200 ${gradeOpen ? 'rotate-180' : ''}`} />
                                        {gradeOpen ? 'Recolher' : 'Grade / Detalhes'}
                                      </button>
                                    </div>

                                    {/* Corpo (expandido) */}
                                    {gradeOpen && (
                                      <div className={`p-4 border-t flex flex-col gap-4 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
                                        {/* Grade */}
                                        {szEntries.length > 0 && (
                                          <div className="flex flex-col gap-2">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Grade de Produção</p>
                                            <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start px-2 py-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                              {szEntries.map(([sz, s]) => (
                                                <div key={sz} className={`flex flex-col items-center justify-center min-w-[32px] sm:min-w-[40px] px-2 py-1.5 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                                                  <span className="text-[9px] font-black text-slate-400 mb-0.5 leading-none">{sz}</span>
                                                  <span className="text-sm font-black text-slate-800 dark:text-white leading-none">{s?.toProduction ?? s}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Infos do Pedido */}
                                        <div className="grid grid-cols-3 gap-4 px-2">
                                          <div>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Cliente</p>
                                            <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase truncate">{f.order?.customerName || 'Estoque'}</p>
                                          </div>
                                          <div>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Entrega</p>
                                            <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">
                                              {f.order?.deliveryDate ? new Date(f.order.deliveryDate).toLocaleDateString('pt-BR') : '-'}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                                            <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">{f.si.qty} pares</p>
                                          </div>
                                        </div>

                                        {/* Observações + Lembrete deste pedido — título e data/hora opcionais para entrar no card de Lembretes do Dashboard */}
                                        {f.order && orderItemIdx >= 0 && (
                                          <div className="flex flex-col gap-1.5 px-2">
                                            <textarea
                                              defaultValue={orderItem?.notes || ''}
                                              placeholder="Observações sobre este pedido..."
                                              title="Observações do pedido"
                                              onBlur={(e) => {
                                                if (e.target.value !== (orderItem?.notes || '')) {
                                                  updateOrderItemNote({ notes: e.target.value || null });
                                                }
                                              }}
                                              className={`w-full px-3 py-2 rounded-xl text-[10px] font-bold outline-none border resize-none h-16 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-700 placeholder:text-slate-400'}`}
                                            />
                                            <input
                                              type="text"
                                              defaultValue={orderItem?.reminderTitle || ''}
                                              placeholder="Título do lembrete..."
                                              title="Título do lembrete"
                                              onBlur={(e) => {
                                                if (e.target.value !== (orderItem?.reminderTitle || '')) {
                                                  updateOrderItemNote({ reminderTitle: e.target.value || null });
                                                }
                                              }}
                                              className={`w-full px-3 py-2 rounded-xl text-[10px] font-bold outline-none border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-700 placeholder:text-slate-400'}`}
                                            />
                                            <DateTimePicker
                                              value={orderItem?.reminderAt}
                                              isDarkMode={isDarkMode}
                                              placeholder="Definir lembrete"
                                              onChange={(ts) => updateOrderItemNote({ reminderAt: ts })}
                                            />
                                          </div>
                                        )}

                                        {/* Instruções */}
                                        {variation?.sectorNotes && Object.keys(variation.sectorNotes).length > 0 && (
                                          <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-indigo-50/50 border-indigo-100'}`}>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500/70 dark:text-indigo-400/70 mb-3 px-1">
                                              Instruções por Setor
                                            </p>
                                            <div className="flex flex-col gap-3">
                                              {Object.entries(variation.sectorNotes)
                                                .filter(([sid, notes]) => Array.isArray(notes) && notes.some((n: any) => n.text?.trim()))
                                                .map(([sid, notes]) => {
                                                  const sn = sectors.find(s => s.id === sid);
                                                  return (
                                                    <div key={sid} className="flex flex-col">
                                                      <div className="flex items-center gap-1.5 mb-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                                        <span className="text-[9px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest">{sn?.name || 'Setor'}</span>
                                                      </div>
                                                      <div className="pl-3 ml-[3px] border-l-2 border-indigo-200 dark:border-indigo-800 flex flex-col gap-2">
                                                        {(notes as any[]).filter(n => n.text?.trim()).map((n, nidx) => (
                                                          <div key={nidx} className="flex flex-col">
                                                            <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">
                                                              {n.label || `${sn?.name} ${productRef} ${colorName}`}
                                                            </span>
                                                            <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 leading-snug">
                                                              {n.text}
                                                            </span>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                            </div>
                                          </div>
                                        )}

                                        {/* Ordens de Serviço Vinculadas */}
                                        {linkedOSList.length > 0 && (
                                          <div className="flex flex-col gap-2">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Histórico de OS</p>
                                            <div className="flex flex-wrap gap-1.5 px-2 py-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                              {linkedOSList.map((os: any) => {
                                                const sec = sectors.find(s => s.id === os.sectorId);
                                                return (
                                                  <span
                                                    key={os.id}
                                                    className={`text-[8.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${os.status === 'PENDING'
                                                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                      }`}
                                                  >
                                                    {os.osNumber} ({sec?.name || os.sectorId}){os.providerName ? ` — ${os.providerName}` : ''} — {os.status === 'PENDING' ? 'Pendente' : 'Concluído'}
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}

                                        <hr className={`border-dashed ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`} />

                                        {/* Ações — dois subcards divididos em 2 botões cada (em vez da lista
                                            label+botão que apertava/sobrepunha "Imprimir/Compartilhar" e
                                            "Print Studio" lado a lado em telas estreitas). */}
                                        <div className="flex flex-col gap-2">
                                          <div className="flex items-center justify-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Etiqueta Deste Pedido</span>
                                          </div>
                                          <div className={`p-1.5 rounded-2xl shadow-sm flex gap-1.5 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 border'}`}>
                                            <button type="button"
                                              onClick={() => {
                                                const resolvedProductId = f.si.productId || f.orderItem?.productId;
                                                const resolvedVariationId = f.si.variationId || f.orderItem?.variationId;
                                                const itemProduct = products.find(p => p.id === resolvedProductId);
                                                const itemVariation = itemProduct?.variations.find(v => v.id === resolvedVariationId);
                                                const labelSizesSource = f.si?.fractionLabel ? (f.si?.sizes || f.orderItem?.sizes) : (f.orderItem?.sizes || f.si?.sizes);
                                                if (itemProduct && itemVariation && labelSizesSource) {
                                                  const szStr = Object.entries(labelSizesSource as Record<string, { toProduction: number }>)
                                                    .filter(([, s]) => s.toProduction > 0)
                                                    .sort(([a], [b]) => Number(a) - Number(b))
                                                    .map(([sz, s]) => `${sz}x${s.toProduction}`)
                                                    .join('-');

                                                  if (szStr) {
                                                    setLabelModalProduct(itemProduct);
                                                    setLabelModalLot(f.lot);
                                                    setLabelModalSizeGrid(szStr);
                                                    setLabelModalBatchItems([{ product: itemProduct, variation: itemVariation, sizeGrid: szStr, lotId: f.lot.id, orderId: f.si.orderId, itemIdx: f.siIdx }]);
                                                  }
                                                }
                                              }}
                                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all active:scale-95"
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                              Imprimir / Compartilhar
                                            </button>
                                            <button type="button"
                                              title="Print Studio"
                                              onClick={() => sendPCPItemsToPrintStudio([buildPCPShareItem(f)], { isDarkMode })}
                                              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-cyan-900/30 text-cyan-300 hover:bg-cyan-900/50' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'}`}
                                            >
                                              <Printer size={13} /> Print Studio
                                            </button>
                                          </div>

                                          <div className="flex items-center justify-center gap-1.5 mt-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ficha &amp; Setor</span>
                                          </div>
                                          <div className={`p-1.5 rounded-2xl shadow-sm flex gap-1.5 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 border'}`}>
                                            <button type="button"
                                              onClick={() => setShareModal({ isOpen: true, format: 'jpg', selectedItems: [f] })}
                                              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-600 text-white hover:bg-slate-700'}`}
                                            >
                                              <Share2 size={14} /> Compartilhar Ficha
                                            </button>
                                            <button type="button"
                                              onClick={() => setManualSectorPicker({ fichas: [f] })}
                                              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-violet-700 text-violet-100 hover:bg-violet-600' : 'bg-violet-600 text-white hover:bg-violet-700'}`}
                                            >
                                              <ArrowLeftRight size={14} /> Mudar Setor
                                            </button>
                                          </div>
                                          {/* Fracionar Pedido — só pra fichas sem OS pendente (fracionar uma
                                              já comprometida com OS exigiria reescrever a OS também). */}
                                          {!hasOS && (f.si.qty || 0) > 1 && (
                                            <button type="button"
                                              onClick={() => handleOpenFractionModal({ lot: f.lot, si: f.si, siIdx: f.siIdx, product: f.product, variation: f.variation, orderItem: f.orderItem })}
                                              className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${isDarkMode ? 'border-amber-700/50 bg-amber-900/20 text-amber-400 hover:bg-amber-900/35' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                                            >
                                              <Scissors size={14} /> Fracionar Pedido
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Emitir OS — grouped by lot */}
                            {selected.length > 0 && (
                              <div className={`flex flex-col gap-2 p-2 rounded-2xl border ${isDarkMode ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50/60'}`}>
                                <button type="button"
                                  onClick={() => {
                                    const selectedFichasData = filteredFichas.filter(f => fichaSelection.has(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));
                                    setShareModal({ isOpen: true, format: 'jpg', selectedItems: selectedFichasData });
                                  }}
                                  className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 ${isDarkMode ? 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                                >
                                  <Share2 size={13} /> Compartilhar {selected.length} {selected.length === 1 ? 'Pedido' : 'Pedidos'} ({selectedQty} {selectedQty === 1 ? 'par' : 'pares'})
                                </button>

                                <button type="button"
                                  onClick={() => {
                                    const selectedFichasData = filteredFichas.filter(f => fichaSelection.has(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));
                                    setManualSectorPicker({ fichas: selectedFichasData });
                                  }}
                                  className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 ${isDarkMode ? 'bg-violet-500/15 text-violet-400 hover:bg-violet-500/25' : 'bg-violet-50 text-violet-600 hover:bg-violet-100'}`}
                                >
                                  <ArrowLeftRight size={13} /> Transferir de Setor — {selected.length} {selected.length === 1 ? 'Pedido' : 'Pedidos'}
                                </button>

                                {selByLot.size > 1 && (
                                  <button type="button"
                                    onClick={() => {
                                      const uniqueLots = Array.from(selByLot.keys()).map(id => allFichas.find(f => f.lot.id === id)?.lot).filter(Boolean) as ProductionLot[];
                                      const orderIds = selected.map(f => `${f.lot.id}::${f.si.orderId}::${f.siIdx}`);

                                      const n = new Set(fichaSelection);
                                      selected.forEach(f => n.delete(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));
                                      setFichaSelection(n);

                                      const firstLot = uniqueLots[0];
                                      const lotCurrentSector = firstLot.route?.[firstLot.currentSectorIndex];
                                      const isRedirected = lotCurrentSector !== selectedSectorId;
                                      const sectorOvr = isRedirected ? selectedSectorId : undefined;
                                      const qtyOvr = selectedQty;

                                      handleOpenOSModalForOrder(uniqueLots, orderIds, undefined, sectorOvr, qtyOvr);
                                    }}
                                    className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${isDarkMode ? 'bg-sky-500/15 text-sky-400 hover:bg-sky-500/25' : 'bg-sky-50 text-sky-600 hover:bg-sky-100'}`}
                                  >
                                    <Hammer size={13} /> Emitir OS Unificada — {selected.length} Pedidos ({selectedQty} {selectedQty === 1 ? 'par' : 'pares'})
                                  </button>
                                )}

                                {selByLot.size === 1 && Array.from(selByLot.entries()).map(([lotId, lotSelected]) => {
                                  const lot = allFichas.find(f => f.lot.id === lotId)?.lot;
                                  if (!lot) return null;
                                  const qty = lotSelected.reduce((s, f) => s + (f.si.qty || 0), 0);
                                  return (
                                    <button type="button" key={lotId}
                                      onClick={() => {
                                        const orderIds = lotSelected.map(f => `${f.lot.id}::${f.si.orderId}::${f.siIdx}`);
                                        const n = new Set(fichaSelection);
                                        lotSelected.forEach(f => n.delete(`${lotId}::${f.si.orderId}::${f.siIdx}`));
                                        setFichaSelection(n);
                                        const lotCurrentSector = lot.route?.[lot.currentSectorIndex];
                                        const isRedirected = lotCurrentSector !== selectedSectorId;
                                        const sectorOvr = isRedirected ? selectedSectorId : undefined;
                                        const qtyOvr = qty;
                                        handleOpenOSModalForOrder(lot, orderIds, undefined, sectorOvr, qtyOvr);
                                      }}
                                      className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${isDarkMode ? 'bg-sky-500/15 text-sky-400 hover:bg-sky-500/25' : 'bg-sky-50 text-sky-600 hover:bg-sky-100'}`}
                                    >
                                      <Hammer size={13} /> Emitir OS — {lotSelected.length} {lotSelected.length === 1 ? 'Pedido' : 'Pedidos'} ({qty} {qty === 1 ? 'par' : 'pares'}) · MAPA{lot.orderNumber}
                                    </button>
                                  );
                                })}

                                {(() => {
                                  const isEndCycle = !!sectors.find(s => s.id === selectedSectorId)?.isProductionCycleEnd ||
                                    selectedSectorId?.toUpperCase().includes('EXPEDIÇÃO') ||
                                    selectedSectorId?.toUpperCase().includes('EXPEDICAO');

                                  if (!isEndCycle) return null;

                                  return (
                                    <button type="button"
                                      onClick={() => {
                                        const selectedFichasData = filteredFichas.filter(f => fichaSelection.has(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));

                                        const resolved: LotAdvanceItem[] = selectedFichasData.map((f: any, idx: number) => {
                                          const resolvedProductId = f.si.productId || f.orderItem?.productId;
                                          const itemProduct = products.find(p => p.id === resolvedProductId);
                                          const effSector = getOrderEffectiveSector(f.lot, f.si.orderId, f.si);
                                          const resolved = resolveCorrectSectorForProduct(effSector, itemProduct, sectors);
                                          const chosenSectorId = resolved.isFinished ? '' : resolved.sectorId;
                                          return {
                                            key: `${f.si.orderId}-${idx}`,
                                            orderId: f.si.orderId,
                                            itemIdx: f.si.itemIdx,
                                            variationId: f.si.variationId,
                                            productId: resolvedProductId,
                                            productName: itemProduct?.name || f.orderItem?.productName || '—',
                                             productReference: itemProduct?.reference || '',
                                            colorName: '',
                                            qty: f.si.qty || 0,
                                            suggestedSectorId: chosenSectorId,
                                            suggestedSectorName: resolved.isFinished ? 'CONCLUÍDO' : (sectors.find(s => s.id === resolved.sectorId)?.name || ''),
                                            skippedSectorNames: resolved.skippedSectorNames,
                                            chosenSectorId,
                                            lotId: f.lot.id,
                                            saleType: f.orderItem?.saleType,
                                            siIdx: f.siIdx,
                                          };
                                        });

                                        const toFinalize = resolved.filter(it => it.chosenSectorId === '');
                                        const toMove = resolved.filter(it => it.chosenSectorId !== '');
                                        const lines: string[] = [`Avançar/finalizar ${resolved.length} pedido(s) selecionado(s)?`];
                                        const stockInfo: Record<string, { destino: string; currentQty: number; addQty: number; projectedQty: number; unit: string }> = {};
                                        const soleInfo: {
                                          moldName: string;
                                          colorName: string;
                                          rows: { size: string; before: number; deducted: number; after: number }[];
                                          contributions: { orderLabel: string; lotNumber: string; qty: number }[]
                                        }[] = [];

                                        if (toFinalize.length > 0) {
                                          const { customerItems, stockItems } = classifyExpedicaoOrders(toFinalize.map(it => ({ orderId: it.orderId, itemIdx: it.itemIdx, fractionLabel: it.fractionLabel })));
                                          lines.push('');
                                          if (customerItems.length > 0) lines.push(`📦 ${customerItems.length} pedido(s) → RESERVA PARA O CLIENTE (aguardando baixa manual na Venda)`);
                                          if (stockItems.length > 0) lines.push(`🏭 ${stockItems.length} pedido(s) → ENTRADA EM ESTOQUE (+ baixa de solados)`);

                                          resolved.forEach(it => {
                                            const isStock = stockItems.some(si => si.orderId === it.orderId && si.itemIdx === it.itemIdx && (si.fractionLabel || undefined) === (it.fractionLabel || undefined));
                                            const fichaItem = selectedFichasData.find(f =>
                                              f.lot.id === it.lotId &&
                                              f.si.orderId === it.orderId &&
                                              (it.itemIdx === undefined || f.si.itemIdx === it.itemIdx) &&
                                              f.si.variationId === it.variationId
                                            );
                                            const customerName = fichaItem?.order?.customerName || fichaItem?.lot.customerName;
                                            const info = computeStockProjection(it, { isStock, customerName });
                                            if (info) stockInfo[it.key] = info;
                                          });

                                          // Sole consumption preview
                                          const consumptionByKey = new Map<string, { moldId: string; colorId: string; gradeQuantities: Record<string, number>; contributions: { orderLabel: string; lotNumber: string; qty: number }[] }>();
                                          toFinalize.forEach(it => {
                                            const fichaItem = selectedFichasData.find(f =>
                                              f.lot.id === it.lotId &&
                                              f.si.orderId === it.orderId &&
                                              (it.itemIdx === undefined || f.si.itemIdx === it.itemIdx) &&
                                              f.si.variationId === it.variationId
                                            );
                                            if (!fichaItem) return;
                                            const { product: prod, variation: vari, si, orderItem } = fichaItem;
                                            // Mesma lógica de resolveSourceItem: embalagem cadastrada → ordItem.sizes escalado
                                            let pairsPreview: Record<string, number> = {};
                                            if (si?.fractionLabel && si?.sizes) {
                                              Object.entries(si.sizes as Record<string, any>).forEach(([sz, d]) => { const q = Number(d?.toProduction) || 0; if (q > 0) pairsPreview[sz] = q; });
                                            } else if (it.qty > 0) {
                                              const gridIdP = prod?.productionGridId || prod?.defaultGridId;
                                              if (gridIdP) {
                                                const pkgP = productionConfigs.find(c => c.type === 'PACKAGING' && (c.metadata as any)?.productionGradeId === gridIdP);
                                                const pkgBD = (pkgP?.metadata as any)?.sizeQuantities as Record<string, number> | undefined;
                                                const boxCfg = (pkgBD && Object.values(pkgBD).some(q => (q || 0) > 0)) ? pkgBD : (grids.find(g => g.id === gridIdP)?.configuration || null);
                                                if (boxCfg) {
                                                  const ppb = Object.values(boxCfg).reduce((s, q) => s + (q || 0), 0);
                                                  if (ppb > 0) { const nb = Math.round(it.qty / ppb); Object.entries(boxCfg).forEach(([sz, q]) => { const p = Math.round((q || 0) * nb); if (p > 0) pairsPreview[sz] = p; }); }
                                                }
                                              }
                                              if (Object.keys(pairsPreview).length === 0) {
                                                const sfp = si?.sizes || orderItem?.sizes;
                                                const rpP: Record<string, number> = {};
                                                Object.entries(sfp || {}).forEach(([sz, d]: [string, any]) => { const q = Number(d?.toProduction) || 0; if (q > 0) rpP[sz] = q; });
                                                const rtP = Object.values(rpP).reduce((s, q) => s + q, 0);
                                                if (rtP > 0 && it.qty !== rtP) {
                                                  const sc = it.qty / rtP; const keys = Object.keys(rpP); let dist = 0;
                                                  keys.forEach((sz, i) => { if (i === keys.length - 1) { const r = it.qty - dist; if (r > 0) pairsPreview[sz] = r; } else { const s = Math.round(rpP[sz] * sc); if (s > 0) { pairsPreview[sz] = s; dist += s; } } });
                                                } else { pairsPreview = rpP; }
                                              }
                                            }
                                            const consumption = resolveSoleConsumption(prod, vari, pairsPreview, it.qty, soleStock);
                                            if (!consumption) return;
                                            const key = `${consumption.moldId}_${consumption.colorId || 'default'}`;

                                            let existing = consumptionByKey.get(key);
                                            if (!existing) {
                                              existing = {
                                                moldId: consumption.moldId,
                                                colorId: consumption.colorId,
                                                gradeQuantities: {},
                                                contributions: []
                                              };
                                              consumptionByKey.set(key, existing);
                                            }

                                            Object.entries(consumption.gradeQuantities).forEach(([gradeKey, qty]) => {
                                              existing!.gradeQuantities[gradeKey] = (existing!.gradeQuantities[gradeKey] || 0) + qty;
                                            });

                                            existing.contributions.push({
                                              orderLabel: `${fichaItem.product?.name || '—'} ${fichaItem.variation?.colorName || ''}`,
                                              lotNumber: fichaItem.lot.orderNumber,
                                              qty: it.qty
                                            });
                                          });

                                          consumptionByKey.forEach(({ moldId, colorId, gradeQuantities, contributions }) => {
                                            const entry = soleStock.find(s => String(s.moldId).trim() === moldId && String(s.colorId || '').trim() === colorId);
                                            const mold = productionConfigs.find(c => c.id === moldId);
                                            const color = colors.find(c => c.id === colorId);

                                            const rows = Object.entries(gradeQuantities)
                                              .filter(([k]) => k !== 'pesagem' && k !== 'total')
                                              .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                                              .map(([size, qty]) => ({
                                                size,
                                                before: entry?.stock[size] || 0,
                                                deducted: Number(qty) || 0,
                                                after: (entry?.stock[size] || 0) - (Number(qty) || 0)
                                              }));
                                            soleInfo.push({
                                              moldName: entry?.moldName || mold?.name || '',
                                              colorName: entry?.colorName || color?.name || '',
                                              rows,
                                              contributions
                                            });
                                          });
                                        }

                                        if (toMove.length > 0) {
                                          const bySector = new Map<string, number>();
                                          toMove.forEach(it => bySector.set(it.suggestedSectorName, (bySector.get(it.suggestedSectorName) || 0) + it.qty));
                                          lines.push('');
                                          bySector.forEach((qty, name) => lines.push(`➡ ${qty} par(es) → ${name}`));
                                        }

                                        const uniqueLotsList = Array.from(new Set(selectedFichasData.map(f => f.lot.id)))
                                          .map(id => lots.find(l => l.id === id))
                                          .filter(Boolean) as ProductionLot[];

                                        if (uniqueLotsList.length > 0) {
                                          setFinalizeSelectedConfirm({
                                            lot: uniqueLotsList[0],
                                            items: resolved,
                                            lines,
                                            stockInfo,
                                            soleInfo
                                          });
                                          setFichaSelection(new Set());
                                        }
                                      }}
                                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm shadow-emerald-500/20"
                                    >
                                      <CheckCircle2 size={13} /> Concluir / Dar Baixa {selected.length} Pedido(s) ({selectedQty} {selectedQty === 1 ? 'par' : 'pares'})
                                    </button>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Fim do corpo de Pedidos no Setor */}
                          </div>
                        )}
                      </div>

                      {/* ── CARD: OS ATIVAS NO SETOR ── */}
                      {sectorOSList.length > 0 && (
                        <div className={`mt-3 rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-sky-100 shadow-sm'}`}>
                          
                          {/* Cabeçalho acordeão */}
                          <button type="button"
                            onClick={() => { const n = new Set(fichaListOpen); isActiveOSCardOpen ? n.add(activeOSCardKey + '_closed') : n.delete(activeOSCardKey + '_closed'); setFichaListOpen(n); }}
                            className={`w-full flex items-center justify-between p-4 transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-sky-50/50'}`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <ClipboardList size={13} className="text-indigo-500 shrink-0" />
                              <div className="min-w-0">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">OS Ativas no Setor</h3>
                              </div>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                                {sectorOSList.length}
                              </span>
                            </div>
                            <ChevronDown size={15} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isActiveOSCardOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Hint when closed */}
                          {!isActiveOSCardOpen && (
                            <div className={`px-4 pb-3 flex flex-col gap-1.5 border-t ${isDarkMode ? 'border-slate-800' : 'border-sky-50'}`}>
                              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest leading-relaxed mt-1">
                                Expandir para visualizar ordens de serviço ativas no setor
                              </span>
                            </div>
                          )}

                          {/* Corpo (expandido) */}
                          {isActiveOSCardOpen && (
                            <div className="p-4 pt-0 flex flex-col gap-3">
                              <p className="text-[9px] text-slate-400 uppercase font-bold">{filteredSectorOSList.length} de {sectorOSList.length} OS</p>

                              {/* Card de controle — 3 seções: Filtrar | Pedidos | Grade */}
                              {(() => {
                                const hasOSFilter = !!(activeOSFilt.model || activeOSFilt.color || activeOSFilt.customerName || activeOSFilt.providerName);
                                return (
                                  <div className={`rounded-2xl border overflow-hidden shadow-sm ${isDarkMode ? 'border-slate-700/50 bg-slate-900/40' : 'border-slate-200 bg-white/90'}`}>
                                    <div className={`grid grid-cols-3 divide-x ${isDarkMode ? 'divide-slate-700/50' : 'divide-slate-200'}`}>

                                      {/* FILTRAR */}
                                      <button type="button"
                                        onClick={() => { const n = new Set(fichaListOpen); isOSFilterOpen ? n.delete(osFilterKey) : n.add(osFilterKey); setFichaListOpen(n); }}
                                        className={`flex flex-col items-center gap-1 py-3 px-2 transition-all active:scale-95 ${hasOSFilter || isOSFilterOpen ? (isDarkMode ? 'bg-orange-950/40' : 'bg-orange-50/80') : (isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}`}
                                      >
                                        <Filter size={14} className={hasOSFilter || isOSFilterOpen ? 'text-orange-500 animate-bounce' : 'text-slate-400'} />
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${hasOSFilter || isOSFilterOpen ? (isDarkMode ? 'text-orange-300' : 'text-orange-600') : (isDarkMode ? 'text-slate-500' : 'text-slate-400')}`}>Filtrar</span>
                                        <span className={`w-1.5 h-1.5 rounded-full transition-all ${hasOSFilter ? 'bg-orange-500 animate-pulse' : 'bg-transparent'}`} />
                                      </button>

                                      {/* PEDIDOS */}
                                      <button type="button"
                                        onClick={() => setShowOSPedidosInline(v => !v)}
                                        className={`flex flex-col items-center gap-1 py-3 px-2 transition-all active:scale-95 ${showOSPedidosInline ? (isDarkMode ? 'bg-indigo-950/40' : 'bg-indigo-50/80') : (isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}`}
                                      >
                                        <Eye size={14} className={showOSPedidosInline ? 'text-indigo-400 animate-pulse' : 'text-slate-400'} />
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${showOSPedidosInline ? (isDarkMode ? 'text-indigo-300' : 'text-indigo-600') : (isDarkMode ? 'text-slate-500' : 'text-slate-400')}`}>Pedidos</span>
                                        <span className={`w-1.5 h-1.5 rounded-full transition-all ${showOSPedidosInline ? 'bg-indigo-500 animate-pulse' : 'bg-transparent'}`} />
                                      </button>

                                      {/* GRADE */}
                                      <button type="button"
                                        onClick={() => setShowOSGradeInline(v => !v)}
                                        className={`flex flex-col items-center gap-1 py-3 px-2 transition-all active:scale-95 ${showOSGradeInline ? (isDarkMode ? 'bg-emerald-950/40' : 'bg-emerald-50/80') : (isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}`}
                                      >
                                        <LayoutGrid size={14} className={showOSGradeInline ? 'text-emerald-400 animate-pulse' : 'text-slate-400'} />
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${showOSGradeInline ? (isDarkMode ? 'text-emerald-300' : 'text-emerald-600') : (isDarkMode ? 'text-slate-500' : 'text-slate-400')}`}>Grade</span>
                                        <span className={`w-1.5 h-1.5 rounded-full transition-all ${showOSGradeInline ? 'bg-emerald-500 animate-pulse' : 'bg-transparent'}`} />
                                      </button>

                                    </div>
                                  </div>
                                );
                              })()}

                              {isOSFilterOpen && createPortal(
                                <div className="fixed inset-0 z-[60000] flex items-center justify-center p-4">
                                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { const n = new Set(fichaListOpen); n.delete(osFilterKey); setFichaListOpen(n); }} />
                                  <div className={`relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-[2rem] shadow-2xl border p-5 flex flex-col gap-4 bg-gradient-to-br ${isDarkMode ? 'from-slate-800 via-slate-900 to-slate-950 border-slate-800' : 'from-white via-slate-50 to-slate-100 border-slate-100'}`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Filter size={14} className="text-orange-500" />
                                        <span className="text-[11px] font-black uppercase tracking-widest">Filtrar OS</span>
                                      </div>
                                      <button type="button" title="Fechar" onClick={() => { const n = new Set(fichaListOpen); n.delete(osFilterKey); setFichaListOpen(n); }}
                                        className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                                        <X size={16} />
                                      </button>
                                    </div>

                                    <input type="text"
                                      placeholder="Buscar modelo ou referência..."
                                      title="Buscar modelo ou referência"
                                      value={activeOSFilt.search || ''}
                                      onChange={(e) => setFichaFilters(prev => ({ ...prev, [activeOSCardKey]: { ...activeOSFilt, search: e.target.value } }))}
                                      className={`w-full px-3 py-2.5 rounded-xl text-[11px] font-bold outline-none border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400'}`}
                                    />

                                    {osModelOptions.length > 0 && (
                                      <div className={`rounded-2xl border p-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Referência</p>
                                        <div className="grid grid-cols-3 gap-1.5">
                                          {osModelOptions.map(({ key, label }) => (
                                            <button type="button" key={key}
                                              onClick={() => setFichaFilters(prev => ({ ...prev, [activeOSCardKey]: { ...activeOSFilt, model: activeOSFilt.model === key ? '' : key, color: '' } }))}
                                              className={`w-full h-9 px-1 rounded-xl text-[9px] font-black uppercase truncate transition-all border active:translate-y-0.5 active:shadow-none bg-gradient-to-b ${activeOSFilt.model === key ? 'from-indigo-500 to-indigo-700 text-white border-indigo-800 shadow-[0_3px_0_rgba(67,56,202,0.5)]' : isDarkMode ? 'from-slate-700 to-slate-800 text-slate-300 border-slate-900 shadow-[0_2px_0_rgba(0,0,0,0.35)]' : 'from-white to-slate-100 text-slate-600 border-slate-300 shadow-[0_2px_0_rgba(0,0,0,0.08)]'}`}
                                            >{label}</button>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {osUniqueColors.length > 0 && (
                                      <div className={`rounded-2xl border p-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Cor</p>
                                        <div className="grid grid-cols-3 gap-1.5">
                                          {osUniqueColors.map(c => (
                                            <button type="button" key={c}
                                              onClick={() => setFichaFilters(prev => ({ ...prev, [activeOSCardKey]: { ...activeOSFilt, color: activeOSFilt.color === c ? '' : c } }))}
                                              className={`w-full h-9 px-1 rounded-xl text-[9px] font-black uppercase truncate transition-all border active:translate-y-0.5 active:shadow-none bg-gradient-to-b ${activeOSFilt.color === c ? 'from-amber-400 to-amber-600 text-white border-amber-700 shadow-[0_3px_0_rgba(180,83,9,0.5)]' : isDarkMode ? 'from-slate-700 to-slate-800 text-slate-300 border-slate-900 shadow-[0_2px_0_rgba(0,0,0,0.35)]' : 'from-white to-slate-100 text-slate-600 border-slate-300 shadow-[0_2px_0_rgba(0,0,0,0.08)]'}`}
                                            >{c}</button>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {osCustomerOptions.length > 0 && (
                                      <div className={`rounded-2xl border p-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Cliente</p>
                                        <ComboBox
                                          options={osCustomerOptions}
                                          value={osCustomerOptions.find(o => o.name === activeOSFilt.customerName)?.id || ''}
                                          onChange={(val) => {
                                            const opt = osCustomerOptions.find(o => o.id === val);
                                            setFichaFilters(prev => ({ ...prev, [activeOSCardKey]: { ...activeOSFilt, customerName: opt?.name || '' } }));
                                          }}
                                          placeholder="Digite para buscar cliente..."
                                          isDarkMode={isDarkMode}
                                          compact
                                        />
                                      </div>
                                    )}

                                    {osUniqueProviders.length > 0 && (
                                      <div className={`rounded-2xl border p-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Prestador de Serviço</p>
                                        <div className="grid grid-cols-3 gap-1.5">
                                          {osUniqueProviders.map(p => (
                                            <button type="button" key={p}
                                              onClick={() => setFichaFilters(prev => ({ ...prev, [activeOSCardKey]: { ...activeOSFilt, providerName: activeOSFilt.providerName === p ? '' : p } }))}
                                              className={`w-full h-9 px-1 rounded-xl text-[9px] font-black uppercase truncate transition-all border active:translate-y-0.5 active:shadow-none bg-gradient-to-b ${activeOSFilt.providerName === p ? 'from-emerald-500 to-emerald-700 text-white border-emerald-800 shadow-[0_3px_0_rgba(4,120,87,0.5)]' : isDarkMode ? 'from-slate-700 to-slate-800 text-slate-300 border-slate-900 shadow-[0_2px_0_rgba(0,0,0,0.35)]' : 'from-white to-slate-100 text-slate-600 border-slate-300 shadow-[0_2px_0_rgba(0,0,0,0.08)]'}`}
                                            >{p}</button>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    <div className="flex items-center gap-2 pt-1">
                                      {(activeOSFilt.model || activeOSFilt.color || activeOSFilt.search || activeOSFilt.customerName || activeOSFilt.providerName) && (
                                        <button type="button" title="Limpar filtros"
                                          onClick={() => setFichaFilters(prev => ({ ...prev, [activeOSCardKey]: { model: '', color: '', search: '', customerName: '', providerName: '' } }))}
                                          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all active:translate-y-0.5 active:shadow-none bg-gradient-to-b ${isDarkMode ? 'from-slate-700 to-slate-800 text-slate-300 border-slate-900 shadow-[0_3px_0_rgba(0,0,0,0.35)]' : 'from-white to-slate-100 text-slate-500 border-slate-300 shadow-[0_3px_0_rgba(0,0,0,0.08)]'}`}
                                        >✕ Limpar</button>
                                      )}
                                      <button type="button"
                                        onClick={() => { const n = new Set(fichaListOpen); n.delete(osFilterKey); setFichaListOpen(n); }}
                                        className="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white border border-indigo-800 bg-gradient-to-b from-indigo-500 to-indigo-700 shadow-[0_4px_0_rgba(67,56,202,0.5)] transition-all active:translate-y-0.5 active:shadow-none"
                                      >Aplicar</button>
                                    </div>
                                  </div>
                                </div>,
                                document.body
                              )}

                              {filteredSectorOSList.map(os => {
                                const lot = filteredActiveLots.find(l => os.lotId === l.id) ?? null;
                                const nextSId = (lot?.route?.length ?? 0) > (lot?.currentSectorIndex ?? 0) + 1
                                  ? (lot?.route?.[(lot?.currentSectorIndex ?? 0) + 1] ?? '')
                                  : '';
                                const nextSName = sectors.find(s => s.id === nextSId)?.name ?? 'CONCLUÍDO';
                                const isOSActionsOpen = fichaListOpen.has(os.id + '_actions_open');
                                const isNaoContabil = !os.transactionId && os.totalValue > 0;
                                return (
                                  <div key={os.id} id={`os-card-${os.id}`} className={`rounded-2xl border flex flex-col gap-3 px-3 py-3 transition-all ${highlightedOSId === os.id ? 'ring-4 ring-indigo-500/60 border-indigo-500 dark:border-indigo-500 shadow-lg shadow-indigo-500/30 scale-[1.02]' : ''} ${isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-700/60' : 'bg-gradient-to-br from-white to-slate-50 border-slate-200/70 shadow-md'}`}>
                                    {/* Linha 1: prestador | número da OS */}
                                    <div className="flex items-center justify-between gap-2">
                                      <span
                                        className="text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 truncate max-w-[130px]"
                                        style={{
                                          backgroundColor: providerBadgeBg,
                                          color: providerBadgeText,
                                          boxShadow: `0 1px 2px ${providerBadgeBg}30`,
                                          fontWeight: providerBadgeBold ? 900 : 400,
                                          fontStyle: providerBadgeItalic ? 'italic' : 'normal',
                                        }}
                                      >
                                        {os.providerName || '—'}
                                      </span>
                                      <span
                                        className="text-[10px] px-2.5 py-1 rounded-full uppercase shrink-0"
                                        style={{
                                          backgroundColor: osBadgeBg,
                                          color: osBadgeText,
                                          boxShadow: `0 1px 2px ${osBadgeBg}30`,
                                          fontWeight: osBadgeBold ? 900 : 400,
                                          fontStyle: osBadgeItalic ? 'italic' : 'normal',
                                        }}
                                      >
                                        {os.osNumber}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 px-0.5">
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                        {new Date(os.createdAt).toLocaleDateString('pt-BR')}
                                      </span>
                                      {isNaoContabil ? (
                                        <span className="text-[7px] font-black px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-500 uppercase tracking-widest shrink-0 whitespace-nowrap">
                                          Não Contábil
                                        </span>
                                      ) : (
                                        <span className={`text-[13px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                          R$ {os.totalValue.toFixed(2)}
                                        </span>
                                      )}
                                    </div>

                                    {/* Pedidos inline — visível quando o toggle "Pedidos" está ativo */}
                                    {showOSPedidosInline && (() => {
                                      const fichas = osFichasMap.get(os.id) ?? [];
                                      if (!fichas.length) return null;
                                      return (
                                        <div className={`flex flex-col gap-0 rounded-xl border overflow-hidden ${isDarkMode ? 'border-slate-800/60 bg-slate-900/40' : 'border-slate-100 bg-slate-50/80'}`}>
                                          {fichas.map((f, fi) => {
                                            const pName = f.product?.reference || f.product?.name || f.orderItem?.productName || '—';
                                            const cName = f.variation?.colorName || f.orderItem?.variationName || '—';
                                            const qty: number = f.si?.qty ?? f.orderItem?.quantity ?? 0;
                                            const cust: string = f.order?.customerName || 'Estoque';
                                            const rawSizes: Record<string, any> = (f.si?.fractionLabel ? f.si?.sizes : (f.orderItem?.sizes || f.si?.sizes)) || {};
                                            const sizeEntries = Object.entries(rawSizes).filter(([, v]) => {
                                              const q = typeof v === 'number' ? v : ((v as any)?.total ?? (v as any)?.toProduction ?? 0);
                                              return q > 0;
                                            });
                                            return (
                                              <div key={fi} className={`flex flex-col px-2.5 py-1.5 ${fi > 0 ? `border-t ${isDarkMode ? 'border-slate-800/50' : 'border-slate-100'}` : ''}`}>
                                                <div className="flex items-center justify-between gap-2">
                                                  <div className="flex flex-col min-w-0">
                                                    <span className={`text-[9px] font-black truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{pName}</span>
                                                    <span className={`text-[8px] truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{cName} · {cust}</span>
                                                  </div>
                                                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full shrink-0 ${isDarkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>{qty} prs</span>
                                                </div>
                                                {showOSGradeInline && sizeEntries.length > 0 && (
                                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {sizeEntries.map(([sz, v]) => {
                                                      const q = typeof v === 'number' ? v : ((v as any)?.total ?? (v as any)?.toProduction ?? 0);
                                                      return (
                                                        <span key={sz} className={`flex flex-col items-center px-2 py-1 rounded-lg border shadow-sm ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                          <span className={`text-[8px] font-black leading-tight ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{sz}</span>
                                                          <span className={`text-[8px] font-black leading-tight ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{q}</span>
                                                        </span>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()}

                                    {/* Ações — grade 3x2 dentro de acordeão (fechado por padrão), fundo branco
                                        e apenas os ícones coloridos para visual limpo */}
                                    <div className="flex flex-col gap-2">
                                      <button type="button"
                                        onClick={() => { const n = new Set(fichaListOpen); isOSActionsOpen ? n.delete(os.id + '_actions_open') : n.add(os.id + '_actions_open'); setFichaListOpen(n); }}
                                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-[#e2e8f0] dark:border-[#334155] bg-[#ffffff] dark:bg-[#0f172a] transition-all active:scale-[0.98] hover:bg-[#f8fafc] dark:hover:bg-[#1e293b]"
                                      >
                                        <span className="text-[9px] font-black uppercase tracking-widest text-[#64748b] dark:text-[#94a3b8]">Mais Ações</span>
                                        <ChevronDown size={14} className={`text-[#94a3b8] transition-transform duration-200 ${isOSActionsOpen ? 'rotate-180' : ''}`} />
                                      </button>

                                      {isOSActionsOpen && (
                                      <div className="grid grid-cols-3 gap-2">
                                        <button type="button" title="Editar OS" onClick={() => handleEditOS(os)}
                                          className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border shadow-sm transition-all active:scale-95 ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-slate-200/60 hover:bg-slate-50'}`}>
                                          <Edit2 size={16} className="text-amber-500 dark:text-amber-400" />
                                          <span className="text-[8px] font-black uppercase tracking-widest text-center leading-tight text-slate-600 dark:text-slate-400">Editar</span>
                                        </button>
                                        <button type="button" title="Excluir OS" onClick={() => handleDeleteOS(os)}
                                          className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border shadow-sm transition-all active:scale-95 ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-slate-200/60 hover:bg-slate-50'}`}>
                                          <Trash2 size={16} className="text-rose-500 dark:text-rose-400" />
                                          <span className="text-[8px] font-black uppercase tracking-widest text-center leading-tight text-slate-600 dark:text-slate-400">Excluir</span>
                                        </button>
                                        <button type="button" title="Compartilhar OS" onClick={() => setShareModal({ isOpen: true, format: 'jpg', selectedItems: getFichasForOS(os) })}
                                          className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border shadow-sm transition-all active:scale-95 ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-slate-200/60 hover:bg-slate-50'}`}>
                                          <Share2 size={16} className="text-orange-500 dark:text-orange-400" />
                                          <span className="text-[8px] font-black uppercase tracking-widest text-center leading-tight text-slate-600 dark:text-slate-400">Compartilhar</span>
                                        </button>
                                        <button type="button" title="Imprimir Etiqueta / OS" onClick={() => {
                                          setPrintOSData({ os, nextSectorName: nextSName });
                                          setIsPrintOSModalOpen(true);
                                        }}
                                          className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border shadow-sm transition-all active:scale-95 ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-slate-200/60 hover:bg-slate-50'}`}>
                                          <Printer size={16} className="text-emerald-500 dark:text-emerald-400" />
                                          <span className="text-[8px] font-black uppercase tracking-widest text-center leading-tight text-slate-600 dark:text-slate-400">Etiqueta / OS</span>
                                        </button>
                                        <button type="button" title="Print Studio" onClick={() => sendPCPItemsToPrintStudio(getFichasForOS(os).map(buildPCPShareItem), { isDarkMode })}
                                          className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border shadow-sm transition-all active:scale-95 ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-slate-200/60 hover:bg-slate-50'}`}>
                                          <Printer size={16} className="text-cyan-500 dark:text-cyan-400" />
                                          <span className="text-[8px] font-black uppercase tracking-widest text-center leading-tight text-slate-600 dark:text-slate-400">Print Studio</span>
                                        </button>
                                        <button type="button" title="Lembretes" onClick={() => setOsNotesPopup(os)}
                                          className={`relative flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border shadow-sm transition-all active:scale-95 ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-slate-200/60 hover:bg-slate-50'}`}>
                                          {(os.notes || os.reminderTitle || os.reminderAt) && (
                                            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                          )}
                                          <Bell size={16} className="text-amber-500 dark:text-amber-400" />
                                          <span className="text-[8px] font-black uppercase tracking-widest text-center leading-tight text-slate-600 dark:text-slate-400">Lembretes</span>
                                        </button>
                                      </div>
                                      )}

                                      <button type="button" onClick={() => handleCompleteOS(os)}
                                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border border-emerald-200 dark:border-emerald-800/40 bg-gradient-to-br from-white to-emerald-50 dark:from-slate-900 dark:to-emerald-950/30 text-emerald-600 dark:text-emerald-400 shadow-sm hover:to-emerald-100 dark:hover:to-emerald-950/50">
                                        <CheckCircle2 size={13} /> Dar Baixa
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Fichas com OS Ativas — card separado de "Pedidos Vinculados",
                          acordeão fechado por padrão. Toda ficha que já tem uma OS pendente
                          neste setor sai da lista normal e aparece aqui. */}
                      {fichasComOSAtivas.length > 0 && (
                        <div className={`mt-3 rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-sky-100 shadow-sm'}`}>
                          <button type="button"
                            onClick={() => { const n = new Set(fichaListOpen); isOSCardOpen ? n.delete(osCardKey + '_open') : n.add(osCardKey + '_open'); setFichaListOpen(n); }}
                            className={`w-full flex items-center justify-between p-4 transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-sky-50/50'}`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Hammer size={13} className="text-amber-500 shrink-0" />
                              <div className="min-w-0">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Fichas com OS Ativas</h3>
                              </div>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${isDarkMode ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                                {fichasComOSAtivas.length}
                              </span>
                            </div>
                            <ChevronDown size={15} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOSCardOpen ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {/* Hint when closed */}
                          {!isOSCardOpen && (
                            <div className={`px-4 pb-3 flex flex-col gap-1.5 border-t ${isDarkMode ? 'border-slate-800' : 'border-sky-50'}`}>
                              <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest leading-relaxed mt-1">
                                Expandir para visualizar fichas de pedidos vinculadas a ordens de serviço ativas
                              </span>
                            </div>
                          )}

                          {isOSCardOpen && (
                            <div className="p-4 pt-0 flex flex-col gap-1.5">
                              {fichasComOSAtivas.map((f) => {
                                const itemKey = `${f.lot.id}::${f.si.orderId}::${f.siIdx}`;
                                const product = f.product;
                                const variation = f.variation;
                                const orderItem = f.orderItem;
                                const productName = product?.name || orderItem?.productName || '-';
                                const productRef = product?.reference || '';
                                const colorName = variation?.colorName || orderItem?.variationName || '';
                                const os = f.coveringOS!;
                                const cardSectorColor = sectors.find(s => s.id === os.sectorId)?.color || '#f59e0b';
                                return (
                                  <div key={itemKey}
                                    className="rounded-2xl border p-3"
                                    style={{ backgroundColor: hexToRgba(cardSectorColor, isDarkMode ? 0.14 : 0.1), borderColor: hexToRgba(cardSectorColor, isDarkMode ? 0.5 : 0.35) }}
                                  >
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <div className="shrink-0 animate-pulse" style={{ color: cardSectorColor }}>
                                        <AlertTriangle size={14} />
                                      </div>
                                      <span className="text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider leading-none shrink-0" style={{ backgroundColor: productBadgeBg, color: productBadgeText, fontWeight: productBadgeBold ? 900 : 400, fontStyle: productBadgeItalic ? 'italic' : 'normal' }}>
                                        {`${productRef || productName}${colorName ? ` ${colorName}` : ''}`.trim()}
                                      </span>
                                      <span
                                        className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest leading-none shrink-0 ml-auto"
                                        style={(() => {
                                          const bg = (f.lot as any).metadata?.badgeColor || mapBadgeBg;
                                          const txt = (f.lot as any).metadata?.badgeTextColor || getContrastingColor(bg);
                                          return { backgroundColor: bg, color: txt, boxShadow: `0 1px 2px ${bg}40` };
                                        })()}
                                      >
                                        MAPA{f.lot.orderNumber}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">PED. {f.lot.orderNumber}</span>
                                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{f.order?.customerName || 'ESTOQUE'}</span>
                                      <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400">· {f.si.qty} {f.si.qty === 1 ? 'par' : 'pares'}</span>
                                    </div>
                                    <span
                                      className="inline-flex text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border"
                                      style={{ backgroundColor: hexToRgba(cardSectorColor, 0.12), color: cardSectorColor, borderColor: hexToRgba(cardSectorColor, 0.3) }}
                                    >
                                      Atrelado à {os.osNumber} (Já possui OS neste setor!)
                                    </span>
                                    <p className="text-[8px] font-bold text-slate-900 dark:text-white uppercase tracking-widest mt-1">
                                      Prestador: {os.providerName || '—'} · Criada em {new Date(os.createdAt).toLocaleDateString('pt-BR')}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      </>
                    );
                  })()}
                </>
              )}

              {/* Subcard de navegação repetido no fim do setor — evita ter que rolar até
                  o topo só pra voltar ou mudar de setor depois de revisar a lista toda. */}
              <div className="flex flex-col gap-2 px-2">
                <div className="flex items-center justify-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 truncate">
                    {sectors.find(s => s.id === selectedSectorId)?.name}
                  </h3>
                </div>
                <div className={`p-1.5 rounded-2xl shadow-sm flex gap-1.5 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 border'}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedSectorId(null)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <ChevronRight size={14} className="rotate-180" /> Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSectorSwitcherOpen(true)}
                    title="Mudar para outro setor"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-orange-500 text-white shadow-md shadow-orange-500/25 hover:bg-orange-600 transition-all active:scale-95"
                  >
                    <ArrowLeftRight size={14} /> Mudar Setor
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-[600px] pb-20">
          {/* Main List: Grouped by Product/Color */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex items-center justify-between px-2">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Sugestões de Mapas</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Itens agrupados por modelo e cor</p>
              </div>
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-indigo-500" />
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{groupedPendingItems.length} Grupos</span>
              </div>
            </div>

            {/* Busca por digitação + sugestão de agrupamento */}
            <div className="flex items-center gap-2 px-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={mapSuggestionSearch}
                  onChange={e => setMapSuggestionSearch(e.target.value)}
                  placeholder="Buscar por modelo, referência ou cor..."
                  className={`w-full pl-9 pr-3 py-2.5 rounded-2xl text-xs font-bold outline-none transition-all border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-indigo-400'}`}
                />
              </div>
              <button
                type="button"
                onClick={() => setIsGroupingConfigOpen(true)}
                title="Configurar sugestão de agrupamento"
                className={`relative w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-95 border ${groupingMode !== 'REF_COLOR' || suggestionFilterOrderIds.size > 0
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : (isDarkMode ? 'bg-orange-950/40 border-orange-900/50 text-orange-400 hover:border-orange-700' : 'bg-orange-50 border-orange-200 text-orange-400 hover:border-orange-300')
                  }`}
              >
                <Filter size={15} />
                {(groupingMode !== 'REF_COLOR' || suggestionFilterOrderIds.size > 0) && (
                  <span className="filter-pulse-badge absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full ring-2 ring-white dark:ring-slate-950 text-[9px] font-black text-white flex items-center justify-center px-0.5">
                    {suggestionFilterOrderIds.size > 0 ? suggestionFilterOrderIds.size : ''}
                  </span>
                )}
              </button>
            </div>

            {/* Popup de configuração de sugestão de agrupamento */}
            <Modal isOpen={isGroupingConfigOpen} onClose={() => setIsGroupingConfigOpen(false)} title="Sugestão de Agrupamento" icon={<Layers size={18} />} maxWidth="max-w-md">
              <div className="p-6 flex flex-col gap-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                  Escolha como os pedidos pendentes devem ser agrupados em "Sugestões de Mapas"
                </p>
                {[
                  { id: 'REF_COMBO' as const, label: 'Combinações de referências', desc: 'Escolha referências cadastradas (ex: 200 e 300) para combiná-las em um mesmo grupo de sugestão.' },
                  { id: 'REF_COLOR' as const, label: 'Mesma referência, com agrupamento de cor', desc: 'Padrão: um grupo por modelo e cor.' },
                  { id: 'REF_ONLY' as const, label: 'Mesma referência, sem agrupamento de cor', desc: 'Reúne todas as cores de um mesmo modelo em um único grupo.' },
                  { id: 'TOTAL' as const, label: 'Total', desc: 'Reúne todos os pedidos pendentes em um único grupo geral.' },
                ].map(opt => (
                  <React.Fragment key={opt.id}>
                    <button
                      type="button"
                      onClick={() => setGroupingMode(opt.id)}
                      className={`text-left p-4 rounded-2xl border-2 transition-all ${groupingMode === opt.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-transparent bg-slate-50 dark:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${groupingMode === opt.id ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-slate-600'}`}>
                          {groupingMode === opt.id && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 leading-tight">{opt.label}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-snug normal-case">{opt.desc}</p>
                        </div>
                      </div>
                    </button>

                    {opt.id === 'REF_COMBO' && groupingMode === 'REF_COMBO' && (
                      <div className={`-mt-1 ml-8 p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest normal-case mb-2">
                          Selecione as referências a combinar (ex: 200 e 300):
                        </p>
                        {availableReferences.length === 0 ? (
                          <p className="text-[10px] font-bold text-slate-400 normal-case">Nenhuma referência cadastrada nos pedidos pendentes.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {availableReferences.map(ref => {
                              const active = comboReferences.includes(ref);
                              return (
                                <button
                                  key={ref}
                                  type="button"
                                  onClick={() => setComboReferences(prev => active ? prev.filter(r => r !== ref) : [...prev, ref])}
                                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 ${active
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                                    : (isDarkMode ? 'bg-slate-900 text-slate-400 border border-slate-700' : 'bg-white text-slate-500 border border-slate-200')
                                    }`}
                                >
                                  {ref}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {comboReferences.length === 1 && (
                          <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest normal-case mt-2">Selecione ao menos mais uma referência para formar uma combinação.</p>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                ))}
                {/* Divisor */}
                <div className={`my-1 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`} />

                {/* Opção: Filtrar por pedidos específicos */}
                <button
                  type="button"
                  onClick={() => setIsOrderFilterOpen(v => !v)}
                  className={`text-left p-4 rounded-2xl border-2 transition-all ${suggestionFilterOrderIds.size > 0 || isOrderFilterOpen ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-transparent bg-slate-50 dark:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${suggestionFilterOrderIds.size > 0 || isOrderFilterOpen ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-slate-600'}`}>
                      {(suggestionFilterOrderIds.size > 0 || isOrderFilterOpen) && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 leading-tight">Filtrar por pedidos específicos</p>
                        {suggestionFilterOrderIds.size > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-600 text-white shrink-0">
                            {suggestionFilterOrderIds.size}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-snug normal-case">
                        Mostre sugestões apenas dos pedidos selecionados.
                      </p>
                    </div>
                  </div>
                </button>

                {isOrderFilterOpen && (
                  <div className={`-mt-1 ml-8 rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                    {pendingOrders.length === 0 ? (
                      <div className="px-4 py-4 text-center text-xs text-slate-400">Nenhum pedido pendente.</div>
                    ) : (
                      <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700 max-h-52 overflow-y-auto">
                        {pendingOrders.map(order => {
                          const isSelected = suggestionFilterOrderIds.has(order.id);
                          const orderItems = pendingItems.filter(i => i.orderId === order.id);
                          const totalPairs = orderItems.reduce((s, i) => s + (i.toProductionQty || 0), 0);
                          return (
                            <button
                              key={order.id}
                              type="button"
                              onClick={() => setSuggestionFilterOrderIds(prev => {
                                const next = new Set(prev);
                                if (next.has(order.id)) next.delete(order.id);
                                else next.add(order.id);
                                return next;
                              })}
                              className={`flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? (isDarkMode ? 'bg-indigo-900/40' : 'bg-indigo-50') : (isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50')}`}
                            >
                              <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : (isDarkMode ? 'border-slate-600' : 'border-slate-300')}`}>
                                {isSelected && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
                                    <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                    #{order.saleOrderNumber || order.orderNumber}
                                  </span>
                                  {order.customerName && (
                                    <span className="text-[10px] font-bold text-slate-400 truncate">— {order.customerName}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold text-indigo-500">{totalPairs} pares</span>
                                  {order.createdAt && (
                                    <span className="text-[10px] text-slate-400">
                                      {new Date(order.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {suggestionFilterOrderIds.size > 0 && (
                      <div className={`px-4 py-2 border-t flex items-center justify-between ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                        <span className="text-[10px] font-bold text-indigo-500">{suggestionFilterOrderIds.size} pedido{suggestionFilterOrderIds.size > 1 ? 's' : ''} selecionado{suggestionFilterOrderIds.size > 1 ? 's' : ''}</span>
                        <button
                          type="button"
                          onClick={() => setSuggestionFilterOrderIds(new Set())}
                          className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          Limpar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsGroupingConfigOpen(false)}
                  className="mt-2 w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  Aplicar
                </button>
              </div>
            </Modal>

            {groupedPendingItems.length === 0 ? (
              <div className={`py-20 rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center gap-3 ${isDarkMode ? 'border-slate-800 text-slate-700' : 'border-slate-200 text-slate-300'}`}>
                <ClipboardList size={48} className="opacity-20" />
                <p className="text-xs font-black uppercase tracking-widest">Nenhum pedido pendente</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {groupedPendingItems.map(group => (
                  <div key={group.groupKey} className={`p-6 rounded-[2.5rem] border-2 transition-all overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                    {/* Group Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
                          <Package size={28} />
                        </div>
                        <div className="min-w-0">
                          {group.members.length > 1 ? (
                            <>
                              <div className="flex flex-wrap items-center gap-1 mb-1">
                                {group.members.map((m, idx) => {
                                  const ref = products.find(p => p.id === m.productId)?.reference;
                                  const label = ref ? `${ref} ${m.productName}` : m.productName;
                                  return (
                                    <span key={idx} className="inline-flex items-center max-w-[220px] px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight truncate bg-amber-400 text-white">
                                      <span className="truncate">{label}{m.variationName ? ` · ${m.variationName}` : ''}</span>
                                    </span>
                                  );
                                })}
                              </div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{group.members.length} Modelos</p>
                            </>
                          ) : (
                            <>
                              <p className="text-base font-black uppercase leading-tight text-slate-900 dark:text-white truncate">
                                {(() => {
                                  const ref = products.find(p => p.id === group.productId)?.reference;
                                  return ref ? `${ref} ${group.productName}` : group.productName;
                                })()}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-0.5">{group.variationName}</p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 leading-none">{group.totalQty} <span className="text-[9px] uppercase tracking-widest text-slate-400">Pares</span></p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{group.orders.length} Pedidos</p>
                        </div>
                        <button
                          onClick={() => {
                            const groupItems = group.orders.map(o => ({ orderId: o.orderId, itemIdx: o.itemIdx }));
                            setSelectedOrderItems(prev => {
                              const filtered = prev.filter(p => !groupItems.some(gi => gi.orderId === p.orderId && gi.itemIdx === p.itemIdx));
                              const allSelectedInGroup = groupItems.every(gi => prev.some(p => p.orderId === gi.orderId && p.itemIdx === gi.itemIdx));
                              if (allSelectedInGroup) return filtered;
                              return [...filtered, ...groupItems];
                            });
                          }}
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-lg ${group.orders.every(gi => selectedOrderItems.some(p => p.orderId === gi.orderId && p.itemIdx === gi.itemIdx))
                            ? 'bg-rose-500 text-white shadow-rose-500/20'
                            : 'bg-indigo-600 text-white shadow-indigo-600/20 active:scale-90'
                            }`}
                          title="Selecionar Todos"
                        >
                          {group.orders.every(gi => selectedOrderItems.some(p => p.orderId === gi.orderId && p.itemIdx === gi.itemIdx)) ? <X size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={3} />}
                        </button>

                      </div>
                    </div>

                    {/* Orders List in this group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {group.orders.map(item => {
                        const isSelected = selectedOrderItems.some(s => s.orderId === item.orderId && s.itemIdx === item.itemIdx);
                        return (
                          <div
                            key={item.uniqueKey}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedOrderItems(prev => prev.filter(s => s.orderId !== item.orderId || s.itemIdx !== item.itemIdx));
                              } else {
                                setSelectedOrderItems(prev => [...prev, { orderId: item.orderId, itemIdx: item.itemIdx }]);
                              }
                            }}
                            className={`flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-transparent bg-slate-50 dark:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
                          >
                            {/* Top row: checkbox + cliente + badge | hora + lixeira */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'border-slate-300 dark:border-slate-600'}`}>
                                  {isSelected && <CheckCircle2 size={14} strokeWidth={4} />}
                                </div>
                                <p className="text-[10px] font-black uppercase text-slate-900 dark:text-white truncate leading-none">{item.customerName}</p>
                                <span className="text-[8px] font-bold text-slate-500 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full uppercase tracking-widest shrink-0">#{item.saleOrderNumber}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                                {item.orderCreatedAt && (
                                  <span className="text-[8px] font-bold text-slate-500">
                                    {new Date(item.orderCreatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                                {onDeleteProductionOrder && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const sourcePurchase = item.saleId ? purchases.find(p => p.id === item.saleId) : undefined;
                                      setOrderDeleteConfirm({
                                        orderId: item.orderId,
                                        saleOrderNumber: item.saleOrderNumber,
                                        hasSourcePurchase: !!sourcePurchase
                                      });
                                    }}
                                    className="p-1 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all"
                                    title="Excluir pedido"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Produto */}
                            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-2 pl-8">
                              <span className="text-[9px] font-black text-slate-900 dark:text-slate-100 uppercase">
                                {(() => {
                                  const ref = products.find(p => p.id === item.productId)?.reference;
                                  return ref ? `${ref} ${item.productName}` : item.productName;
                                })()}
                              </span>
                              <span className="text-[9px] font-bold text-slate-500 uppercase">{item.variationName}</span>
                            </div>

                            {/* Badge de observação do item */}
                            {item.notes && (
                              <div className={`flex items-start gap-1.5 mt-1 mb-1 pl-8`}>
                                <div className={`flex items-start gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-bold leading-snug ${isDarkMode ? 'bg-amber-900/30 border border-amber-700/40 text-amber-300' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                                  <MessageSquare size={9} className="text-amber-500 shrink-0 mt-0.5" />
                                  <span>{item.notes}</span>
                                </div>
                              </div>
                            )}

                            {/* Grade de tamanhos */}
                            <div className="flex flex-wrap gap-1 pl-8">
                              {Object.entries(item.sizes || {})
                                .filter(([_, s]: any) => s.toProduction > 0)
                                .map(([size, s]: any) => (
                                  <div key={size} className="flex flex-col items-center min-w-[28px] p-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <span className="text-[9px] font-black text-slate-500 leading-none mb-0.5">{size}</span>
                                    <span className="text-[11px] font-black text-slate-900 dark:text-white leading-none">{s.toProduction}</span>
                                  </div>
                                ))}
                            </div>

                            {/* Linha inferior: data de entrega + pares */}
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 pl-8">
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${item.deliveryDate < Date.now() ? 'text-rose-500' : 'text-slate-500'}`}>
                                {new Date(item.deliveryDate).toLocaleDateString('pt-BR')}
                              </span>
                              <span className="text-sm font-black text-slate-900 dark:text-white">{item.toProductionQty} <span className="text-[9px] font-bold text-slate-400 uppercase">P</span></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Carrinho Sidebar */}
          <div className="lg:col-span-4">
            <div className={`sticky top-6 p-8 rounded-[3rem] border-2 flex flex-col gap-8 min-h-[500px] ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-2xl shadow-indigo-600/5'}`}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-[1.8rem] bg-amber-500 text-white flex items-center justify-center shadow-xl shadow-amber-500/20">
                  <LayoutDashboard size={28} />
                </div>
                <div>
                  <h4 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">Carrinho</h4>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Novo Mapa de Produção</p>
                </div>
              </div>

              {selectedOrderItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-4">
                  <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-700">
                    <Plus size={40} className="opacity-20" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed max-w-[180px]">Selecione os pedidos ao lado para agrupar em um Mapa</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-8">
                  {/* Carrinho Summary */}
                  {(() => {
                    const selectedData = selectedOrderItems.map(s => pendingItems.find(p => p.orderId === s.orderId && p.itemIdx === s.itemIdx)).filter(Boolean);
                    const totalPairs = selectedData.reduce((acc, i) => acc + (i?.toProductionQty || 0), 0);

                    const groupedByProduct: Record<string, { productId: string, variationId: string, name: string, color: string, qty: number }> = {};
                    selectedData.forEach(item => {
                      if (!item) return;
                      const key = `${item.productId}-${item.variationId}`;
                      if (!groupedByProduct[key]) {
                        groupedByProduct[key] = {
                          productId: item.productId,
                          variationId: item.variationId,
                          name: item.productName,
                          color: item.variationName,
                          qty: 0
                        };
                      }
                      groupedByProduct[key].qty += item.toProductionQty;
                    });

                    return (
                      <div className="flex flex-col gap-6">
                        <div className="p-6 rounded-[2rem] bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800/30">
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">Total do Mapa</p>
                          <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{totalPairs} <span className="text-xs uppercase tracking-widest text-indigo-300">Pares</span></p>
                        </div>

                        <div className="flex flex-col gap-3">
                          <h5 className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Conteúdo do Mapa</h5>
                          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {Object.values(groupedByProduct).map((g, idx) => (
                              <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm">
                                <div className="min-w-0 pr-2">
                                  <p className="text-[11px] font-black uppercase truncate text-slate-800 dark:text-slate-200 leading-none mb-1">{g.name}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2">{g.color}</p>

                                  {/* Aggregated Grid for Sidebar */}
                                  <div className="flex flex-wrap gap-1">
                                    {(() => {
                                      const aggregatedGrid: Record<string, number> = {};
                                      selectedData.filter(i => i && i.productId === g.productId && i.variationId === g.variationId).forEach(i => {
                                        Object.entries(i!.sizes || {}).forEach(([size, s]: any) => {
                                          if (s.toProduction > 0) aggregatedGrid[size] = (aggregatedGrid[size] || 0) + s.toProduction;
                                        });
                                      });
                                      return Object.entries(aggregatedGrid).map(([size, qty]) => (
                                        <div key={size} className="flex flex-col items-center min-w-[24px] p-1 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-700">
                                          <span className="text-[8px] font-black text-slate-400 leading-none mb-0.5">{size}</span>
                                          <span className="text-[10px] font-black text-indigo-500 leading-none">{qty}</span>
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                </div>
                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 shrink-0">{g.qty} P</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="mt-auto flex flex-col gap-4">
                    <button
                      onClick={() => setSelectedOrderItems([])}
                      className="w-full py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all"
                    >
                      Limpar Seleção
                    </button>
                    <button
                      onClick={handleBatchCreateLots}
                      className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.25em] shadow-2xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      Criar 1 Mapa com Selecionados
                    </button>

                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'needs' && (
        <div className="flex flex-col gap-6">
          <div className={`p-8 rounded-[2.5rem] border-2 shadow-xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Necessidades de Materiais</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Requisitos de Produção vs Estoque — Inclui Solados</p>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const shortages = purchaseNeeds.filter(i =>
                    i.type === 'MATERIAL'
                      ? i.required > i.stock
                      : i.sizeShortages
                        ? Object.values(i.sizeShortages).some((s: any) => s.required > s.stock)
                        : i.required > i.stock
                  );
                  const solesOk = purchaseNeeds.filter(i => i.type === 'SOLE' && !shortages.includes(i));
                  return (
                    <>
                      {shortages.length > 0 && (
                        <span className="px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-rose-50 dark:bg-rose-900/20 text-rose-500">
                          {shortages.length} Falta{shortages.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {solesOk.length > 0 && (
                        <span className="px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600">
                          {solesOk.length} Solado{solesOk.length > 1 ? 's' : ''} OK
                        </span>
                      )}
                      {purchaseNeeds.length === 0 && (
                        <span className="px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-500">
                          Tudo OK
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="flex flex-col gap-3 mb-6">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exibir necessidades de:</span>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'LOTS', label: 'Mapas', desc: 'Lotes ativos' },
                    { key: 'ORDERS', label: 'Pedidos', desc: 'Todos pendentes' },
                    { key: 'BOTH', label: 'Pedidos + Mapas', desc: 'Combinado' },
                    { key: 'SELECTED_ORDERS', label: 'Por Pedido', desc: 'Escolha pedidos' },
                  ] as { key: 'LOTS' | 'ORDERS' | 'BOTH' | 'SELECTED_ORDERS'; label: string; desc: string }[]).map(opt => {
                    const active = needsSourceFilter === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setNeedsSourceFilter(opt.key);
                          if (opt.key !== 'SELECTED_ORDERS') setSelectedNeedsOrderIds(new Set());
                        }}
                        className={`flex flex-col items-start px-4 py-3 rounded-2xl border-2 transition-all active:scale-95 ${active
                          ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/20'
                          : (isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-300')
                          }`}
                      >
                        <span className={`text-[11px] font-black uppercase tracking-widest leading-none ${active ? 'text-white' : (isDarkMode ? 'text-slate-200' : 'text-slate-700')}`}>
                          {opt.label}
                        </span>
                        <span className={`text-[9px] font-bold mt-1 leading-none ${active ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {opt.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {needsSourceFilter === 'SELECTED_ORDERS' && (
                <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Selecionar pedidos
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedNeedsOrderIds.size > 0 && (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white">
                          {selectedNeedsOrderIds.size} selecionado{selectedNeedsOrderIds.size > 1 ? 's' : ''}
                        </span>
                      )}
                      {selectedNeedsOrderIds.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedNeedsOrderIds(new Set())}
                          className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>
                  {pendingOrders.length === 0 ? (
                    <div className="px-4 py-5 text-center text-xs text-slate-400">
                      Nenhum pedido pendente encontrado.
                    </div>
                  ) : (
                    <div className="flex flex-col divide-y divide-slate-200 dark:divide-slate-700 max-h-64 overflow-y-auto">
                      {pendingOrders.map(order => {
                        const isSelected = selectedNeedsOrderIds.has(order.id);
                        const orderItems = pendingItems.filter(i => i.orderId === order.id);
                        const totalPairs = orderItems.reduce((s, i) => s + (i.toProductionQty || 0), 0);
                        return (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => {
                              setSelectedNeedsOrderIds(prev => {
                                const next = new Set(prev);
                                if (next.has(order.id)) next.delete(order.id);
                                else next.add(order.id);
                                return next;
                              });
                            }}
                            className={`flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected
                              ? isDarkMode ? 'bg-indigo-900/40' : 'bg-indigo-50'
                              : isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-white'
                              }`}
                          >
                            <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : isDarkMode ? 'border-slate-600' : 'border-slate-300'
                              }`}>
                              {isSelected && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
                                  <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                  Pedido #{order.saleOrderNumber || order.orderNumber}
                                </span>
                                {order.customerName && (
                                  <span className="text-[10px] font-bold text-slate-400 truncate">
                                    — {order.customerName}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] text-slate-400">
                                  {orderItems.length} item{orderItems.length !== 1 ? 's' : ''}
                                </span>
                                <span className="text-[10px] font-bold text-indigo-500">
                                  {totalPairs} par{totalPairs !== 1 ? 'es' : ''}
                                </span>
                                {order.deliveryDate && (
                                  <span className="text-[10px] text-slate-400">
                                    Entrega: {new Date(order.deliveryDate).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                                {order.createdAt && (
                                  <span className="text-[10px] text-slate-400">
                                    Criado: {new Date(order.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selectedNeedsOrderIds.size === 0 && pendingOrders.length > 0 && (
                    <div className={`px-4 py-2.5 border-t text-[10px] text-slate-400 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                      Selecione um ou mais pedidos para ver a necessidade de solados.
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedSoleNeedIds.size > 0 && (
              <div className={`flex flex-col gap-3 px-5 py-4 mb-4 rounded-2xl border ${isDarkMode ? 'bg-indigo-950/30 border-indigo-800' : 'bg-indigo-50 border-indigo-200'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white">
                      {selectedSoleNeedIds.size} selecionado{selectedSoleNeedIds.size > 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solicitação agrupada</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSoleNeedIds(new Set())}
                    className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    Limpar
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const selected = purchaseNeeds.filter(n => n.type === 'SOLE' && selectedSoleNeedIds.has(n.id));
                      if (selected.length === 0) return;
                      const items = selected.map(need => {
                        const initialGrid: Record<string, number> = {};
                        Object.entries(need.sizeShortages || {}).forEach(([grade, s]: any) => {
                          const falta = Math.max(0, (s.required || 0) - (s.stock || 0));
                          if (falta > 0) initialGrid[grade] = falta;
                        });
                        return { moldId: need.moldId, colorId: need.colorId, initialGrid };
                      }).filter(it => Object.keys(it.initialGrid).length > 0);
                      if (items.length === 0) {
                        toast.show('Nenhuma falta encontrada nos solados selecionados.');
                        return;
                      }
                      if (onNavigate) {
                        onNavigate(ViewType.PRODUCTION_SOLE_PURCHASE, {
                          items,
                          description: `Compra direta via PCP — ${items.length} solado${items.length > 1 ? 's' : ''} agrupados`
                        });
                      }
                      setSelectedSoleNeedIds(new Set());
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.98] transition-all"
                  >
                    <ShoppingCart size={14} />
                    Fazer a Compra
                  </button>
                  <button
                    type="button"
                    disabled={isRequestingBatch || !onRequestPurchase}
                    onClick={async () => {
                      if (!onRequestPurchase || isRequestingBatch) return;
                      const selected = purchaseNeeds.filter(n => n.type === 'SOLE' && selectedSoleNeedIds.has(n.id));
                      if (selected.length === 0) return;
                      const requests = selected.map(need => {
                        const sizeBreakdown: Record<string, number> = {};
                        Object.entries(need.sizeShortages || {}).forEach(([grade, s]: any) => {
                          const falta = Math.max(0, (s.required || 0) - (s.stock || 0));
                          if (falta > 0) sizeBreakdown[grade] = falta;
                        });
                        return { need, sizeBreakdown };
                      }).filter(r => Object.keys(r.sizeBreakdown).length > 0);
                      if (requests.length === 0) {
                        toast.show('Nenhuma falta encontrada nos solados selecionados.');
                        return;
                      }
                      setIsRequestingBatch(true);
                      try {
                        for (const { need, sizeBreakdown } of requests) {
                          await onRequestPurchase({
                            requestKey: need.id,
                            type: 'SOLE',
                            name: need.name,
                            unit: 'PAR',
                            requiredQty: Object.values(sizeBreakdown).reduce((a, b) => a + b, 0),
                            sizeBreakdown,
                            status: 'PENDING',
                            requestedAt: Date.now(),
                            requestedBy: userName,
                            contributingLots: need.contributingLots,
                            moldId: need.moldId,
                            colorId: need.colorId,
                          });
                        }
                        toast.show(`Solicitação enviada para ${requests.length} solado${requests.length > 1 ? 's' : ''} com sucesso!`);
                        setSelectedSoleNeedIds(new Set());
                      } catch (err) {
                        toast.show('Erro ao enviar solicitação agrupada.');
                      } finally {
                        setIsRequestingBatch(false);
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isRequestingBatch
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-[0.98]'
                      }`}
                  >
                    {isRequestingBatch ? <Loader2 size={14} className="animate-spin" /> : <ClipboardList size={14} />}
                    Solicitar ao Setor de Compras
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {purchaseNeeds.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 size={40} />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase text-slate-900 dark:text-white">Produção Garantida</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Todo o material necessário para os mapas ativos está disponível em estoque.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {(() => {
                    // Group same materialId/moldId items together, sorted by group total shortage
                    const groupMap = new Map<string, typeof purchaseNeeds>();
                    purchaseNeeds.forEach(item => {
                      const gk = item.type === 'MATERIAL'
                        ? (item.materialId || item.id)
                        : `SOLE_${item.moldId || item.id}`;
                      if (!groupMap.has(gk)) groupMap.set(gk, []);
                      groupMap.get(gk)!.push(item);
                    });
                    const sortedGroups = Array.from(groupMap.entries()).sort(([, ai], [, bi]) => {
                      const as_ = ai.reduce((s, i) => s + Math.max(0, i.required - i.stock), 0);
                      const bs_ = bi.reduce((s, i) => s + Math.max(0, i.required - i.stock), 0);
                      return bs_ - as_;
                    });
                    // Build flat list enriched with group metadata
                    type Enriched = typeof purchaseNeeds[0] & {
                      _gk: string; _idx: number; _size: number;
                      _gTotal: number; _gShortage: number; _gBaseName: string;
                    };
                    const flat: Enriched[] = [];
                    sortedGroups.forEach(([gk, items]) => {
                      const sorted = [...items].sort((a, b) => (b.required - b.stock) - (a.required - a.stock));
                      const gTotal = sorted.reduce((s, i) => s + i.required, 0);
                      const gShortage = sorted.reduce((s, i) => s + Math.max(0, i.required - i.stock), 0);
                      const gBase = sorted[0].type === 'MATERIAL'
                        ? (sorted[0].name || '').replace(/ — .*$/, '')
                        : (sorted[0].name || '').split(' - ')[0];
                      sorted.forEach((item, idx) => flat.push({ ...item, _gk: gk, _idx: idx, _size: sorted.length, _gTotal: gTotal, _gShortage: gShortage, _gBaseName: gBase }));
                    });
                    return flat;
                  })().map((item) => {
                    const isFirst = item._idx === 0;
                    const unitNoun = item.type === 'MATERIAL' ? 'cor' : 'variação';
                    const isGroupCollapsed = collapsedGroupKeys.has(item._gk);
                    const groupHeader = isFirst ? (
                      <button
                        key={`gh_${item._gk}`}
                        type="button"
                        onClick={() => toggleGroupCollapse(item._gk)}
                        title={isGroupCollapsed ? `Expandir grupo ${item._gBaseName}` : `Recolher grupo ${item._gBaseName}`}
                        aria-label={isGroupCollapsed ? `Expandir grupo ${item._gBaseName}` : `Recolher grupo ${item._gBaseName}`}
                        className={`w-full flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl border transition-all ${isDarkMode ? 'bg-slate-800 border-slate-600 hover:bg-slate-700' : 'bg-slate-200 border-slate-300 hover:bg-slate-300'}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 ${isGroupCollapsed ? '' : 'rotate-180'} ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-300 text-slate-600'}`}>
                            <ChevronDown size={14} strokeWidth={3} />
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-widest break-words ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item._gBaseName}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isDarkMode ? 'bg-slate-600 text-slate-100' : 'bg-slate-700 text-white'}`}>{item._size} {item._size === 1 ? unitNoun : `${unitNoun}s`}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-[8px] font-black uppercase text-slate-400">Total necessário</p>
                            <p className={`text-[11px] font-black ${item._gShortage > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{/m[²2]/i.test(item.unit || '') ? item._gTotal.toFixed(2) : Math.round(item._gTotal)} {item.unit}</p>
                          </div>
                          {isGroupCollapsed && (
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-300 text-slate-500'}`}>Recolhido</span>
                          )}
                        </div>
                      </button>
                    ) : null;
                    const fmtQty = (val: number) => /m[²2]/i.test(item.unit || '') ? Number(val).toFixed(2) : String(Math.round(val));
                    const isExpanded = expandedNeedIds.has(item.id);

                    // Existing purchase request
                    const existingReqOuter = purchaseRequests.find(r => r.requestKey === item.id && r.status !== 'RECEIVED');

                    // Quick shortage (real stock, no color fallback)
                    const realGradeStockOuter: Record<string, number> = {};
                    if (item.type === 'SOLE') {
                      soleStock
                        .filter(s => s.moldId === item.moldId && String(s.colorId || '').trim() === String(item.colorId || '').trim())
                        .forEach(e => {
                          Object.entries(e.stock).forEach(([k, v]) => {
                            const key = String(k).trim();
                            if (key === 'pesagem' || key === 'total') return;
                            realGradeStockOuter[key] = (realGradeStockOuter[key] || 0) + (Number(v) || 0);
                          });
                        });
                    }
                    const quickShortage = item.type === 'SOLE' && item.sizeShortages
                      ? Object.keys(item.sizeShortages).reduce((s: number, grade: string) => {
                        const req = (item.sizeShortages as any)[grade].required;
                        const stk = realGradeStockOuter[grade] || 0;
                        return s + Math.max(0, req - stk);
                      }, 0)
                      : Math.max(0, item.required - item.stock);

                    // In-transit quantities for this mold
                    const inTransitOuter: Record<string, number> = {};
                    if (item.type === 'SOLE') {
                      purchases.filter(p => {
                        if (p.registerAsReceived === true) return false;
                        const si: any[] = (p as any).soleItems || (p as any).items || [];
                        return si.some((s: any) => s.moldId);
                      }).forEach(p => {
                        const allItems: any[] = (p as any).soleItems || (p as any).items || [];
                        allItems
                          .filter((si: any) =>
                            si.moldId &&
                            String(si.moldId).trim() === String(item.moldId).trim() &&
                            String(si.colorId || '').trim() === String(item.colorId || '').trim()
                          )
                          .forEach((si: any) => {
                            Object.entries(si.quantities || {}).forEach(([size, qty]: [string, any]) => {
                              const q = Number(qty) || 0;
                              if (q > 0) inTransitOuter[size] = (inTransitOuter[size] || 0) + q;
                            });
                          });
                      });
                    }
                    const totalInTransitOuter = Object.values(inTransitOuter).reduce((a, b) => a + b, 0);
                    const realToComprarOuter = item.type === 'SOLE' && item.sizeShortages
                      ? Object.keys(item.sizeShortages).reduce((s: number, grade: string) => {
                        const req = (item.sizeShortages as any)[grade].required;
                        const stk = realGradeStockOuter[grade] || 0;
                        const transit = inTransitOuter[grade] || 0;
                        return s + Math.max(0, req - stk - transit);
                      }, 0)
                      : Math.max(0, quickShortage - totalInTransitOuter);

                    // If the group is collapsed, only render the header for the first item
                    if (isGroupCollapsed && !isFirst) return null;

                    return (
                      <React.Fragment key={item.id}>
                        {groupHeader}
                        {isGroupCollapsed ? null : <>
                          <div
                            className={`rounded-[2rem] border-2 transition-all overflow-hidden ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-white shadow-sm'} ${isExpanded ? 'border-indigo-300 dark:border-indigo-700' : ''}`}
                          >
                            {/* ── Acordeão Header (clicável) ── */}
                            <button
                              type="button"
                              onClick={() => toggleNeedExpand(item.id)}
                              title={isExpanded ? `Recolher detalhes de ${item.name}` : `Expandir detalhes de ${item.name}`}
                              aria-label={isExpanded ? `Recolher detalhes de ${item.name}` : `Expandir detalhes de ${item.name}`}
                              className={`w-full flex flex-col gap-3 px-5 py-4 text-left transition-colors ${isExpanded ? isDarkMode ? 'bg-indigo-950/30' : 'bg-indigo-50/60' : ''}`}
                            >
                              {/* ── Linha 1: checkbox + ícone + tipo + nome + chevron ── */}
                              <div className="flex items-center gap-3">
                                {item.type === 'SOLE' && quickShortage > 0 && !existingReqOuter && (
                                  <span
                                    role="checkbox"
                                    aria-checked={selectedSoleNeedIds.has(item.id)}
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); toggleSoleNeedSelection(item.id); }}
                                    onKeyDown={(e) => { if (e.key === ' ') { e.stopPropagation(); toggleSoleNeedSelection(item.id); } }}
                                    title="Selecionar para compra agrupada"
                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${selectedSoleNeedIds.has(item.id)
                                      ? 'bg-indigo-600 border-indigo-600 text-white'
                                      : isDarkMode ? 'border-slate-700 hover:border-indigo-500' : 'border-slate-300 hover:border-indigo-400'
                                      }`}
                                  >
                                    {selectedSoleNeedIds.has(item.id) && <CheckCircle2 size={14} strokeWidth={3} />}
                                  </span>
                                )}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.type === 'SOLE' ? 'bg-indigo-100 text-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                  {item.type === 'SOLE' ? <Layers size={18} /> : <Package size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${item.type === 'SOLE' ? 'text-indigo-500' : 'text-amber-600 dark:text-amber-400'}`}>
                                    {item.type === 'SOLE' ? 'Solado' : 'Material'}
                                  </p>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {quickShortage > 0 && (
                                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                                    )}
                                    <p className={`text-sm font-black uppercase leading-tight ${quickShortage > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                                      {item.type === 'SOLE' ? item.name.split(' - ')[0] : item.name}
                                    </p>
                                    {item.type === 'SOLE' && (() => {
                                      const colorName = item.name.split(' - ').slice(1).join(' - ');
                                      return colorName ? (
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${isDarkMode ? 'bg-indigo-950/40 border-indigo-800 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>
                                          {colorName}
                                        </span>
                                      ) : null;
                                    })()}
                                  </div>
                                </div>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                                  <ChevronDown size={16} strokeWidth={2.5} />
                                </div>
                              </div>

                              {/* ── Linha 3: referência de mapas/pedidos + alerta falta ── */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                  {formatContributingSources(item.contributingLots, item.contributingOrders)}
                                </span>
                                {item.mappingWarning && (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMappingDiagnosticCopied(false);
                                      setMappingWarningModal({ itemName: item.name, reason: item.mappingWarning!, diagnostic: item.mappingDiagnostic || '' });
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.stopPropagation();
                                        setMappingDiagnosticCopied(false);
                                        setMappingWarningModal({ itemName: item.name, reason: item.mappingWarning!, diagnostic: item.mappingDiagnostic || '' });
                                      }
                                    }}
                                    title="Clique para ver o motivo"
                                    className="text-[10px] font-black text-amber-500 uppercase tracking-widest underline decoration-dotted cursor-pointer hover:text-amber-600"
                                  >
                                    ⚠ Cruzamento desatualizado
                                  </span>
                                )}
                              </div>
                            </button>

                            {/* ── Linha 4: quantidade + botão de ação (FORA do button para evitar button-in-button) ── */}
                            <div
                              className={`flex items-center justify-between px-5 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 cursor-pointer`}
                              onClick={() => toggleNeedExpand(item.id)}
                            >
                              <div>
                                <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none mb-0.5">Falta</p>
                                <p className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-none">
                                  {fmtQty(quickShortage)} <span className="text-xs font-bold text-slate-400">{item.unit}</span>
                                </p>
                              </div>
                              {existingReqOuter ? (
                                <span className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                                  <CheckCircle2 size={12} strokeWidth={3} /> Solicitado
                                </span>
                              ) : totalInTransitOuter > 0 && realToComprarOuter === 0 ? (
                                <span className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${isDarkMode ? 'bg-amber-950/30 border-amber-700/50 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                  <ShoppingCart size={12} /> Em Trânsito
                                </span>
                              ) : quickShortage > 0 ? (
                                <button
                                  type="button"
                                  disabled={requestingId === item.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!onRequestPurchase || requestingId) return;
                                    if (item.type === 'SOLE') {
                                      setSelectedSoleNeed(item);
                                      setExtraSoleQty({});
                                      setIsSoleOrderModalOpen(true);
                                    }
                                  }}
                                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${requestingId === item.id
                                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-wait'
                                    : 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                                    }`}
                                >
                                  {requestingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpRight size={12} strokeWidth={3} />}
                                  Solicitar
                                </button>
                              ) : null}
                            </div>

                            {/* ── Conteúdo expansível ── */}
                            {isExpanded && (
                              <div className={`px-6 pb-6 pt-2 flex flex-col gap-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                {/* Badges */}
                                <div className="flex flex-wrap items-center gap-2">
                                  {item.type !== 'SOLE' && (
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                                      Estoque: {fmtQty(item.stock)} {item.unit}
                                    </span>
                                  )}
                                  {item.type === 'SOLE' && (() => {
                                    const hasSoleShortage = item.sizeShortages
                                      ? Object.values(item.sizeShortages).some((s: any) => s.required > s.stock)
                                      : item.required > item.stock;
                                    return (
                                      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border ${hasSoleShortage
                                        ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                                        }`}>
                                        {hasSoleShortage ? '⚠ Falta Solado' : '✓ Solado OK'}
                                      </span>
                                    );
                                  })()}
                                  <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                                    {formatContributingSources(item.contributingLots, item.contributingOrders)}
                                  </span>
                                </div>

                                {/* Tabela de grades de solado */}
                                {item.type === 'SOLE' && item.sizeShortages && (() => {
                                  // Total necessário = soma de todos os tamanhos do mapa para este molde
                                  const totReq = Object.values(item.sizeShortages as any)
                                    .reduce((s: number, v: any) => s + v.required, 0) as number;

                                  // Estoque EXCLUSIVO por moldId + colorId (sem fallback para outras cores)
                                  const gradeStock: Record<string, number> = {};
                                  soleStock
                                    .filter(s => s.moldId === item.moldId && String(s.colorId || '').trim() === String(item.colorId || '').trim())
                                    .forEach(e => {
                                      Object.entries(e.stock).forEach(([k, v]) => {
                                        const key = String(k).trim();
                                        if (key === 'pesagem' || key === 'total') return;
                                        gradeStock[key] = (gradeStock[key] || 0) + (Number(v) || 0);
                                      });
                                    });

                                  const totEst = Object.values(gradeStock).reduce((s, v) => s + v, 0);
                                  const totFalta = Math.max(0, totReq - totEst);

                                  // Unir chaves do estoque com as chaves de necessidade do PCP
                                  const allSizes = new Set([
                                    ...Object.keys(gradeStock),
                                    ...Object.keys(item.sizeShortages || {})
                                  ]);
                                  const gradeKeys = Array.from(allSizes).sort((a, b) => {
                                    const numA = parseFloat(a);
                                    const numB = parseFloat(b);
                                    if (isNaN(numA) || isNaN(numB)) return a.localeCompare(b);
                                    return numA - numB;
                                  });

                                  return (
                                    <div className={`rounded-2xl overflow-hidden border ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                                      {/* Header - 4 Colunas para alinhar com totais */}
                                      <div className={`grid grid-cols-4 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                        <span>Grade Sola</span>
                                        <span className="text-center">Estoque</span>
                                        <span className="text-center">Necess.</span>
                                        <span className="text-right">Falta</span>
                                      </div>
                                      {gradeKeys.length > 0 ? gradeKeys.map(grade => {
                                        const stock = gradeStock[grade] || 0;
                                        const req = item.sizeShortages?.[grade]?.required || 0;
                                        const shortage = Math.max(0, req - stock);

                                        return (
                                          <div key={grade} className={`grid grid-cols-4 px-4 py-3 border-t text-[13px] font-black ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
                                            <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>{grade}</span>
                                            <span className={`text-center ${stock > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>{stock}</span>
                                            <span className="text-center text-slate-400">{req}</span>
                                            <span className={`text-right ${shortage > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                                              {shortage > 0 ? `-${shortage}` : '✓'}
                                            </span>
                                          </div>
                                        );
                                      }) : (
                                        <div className={`px-4 py-3 border-t text-[11px] text-slate-400 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
                                          Sem grade de sola cadastrada
                                        </div>
                                      )}
                                      {/* Linha de totais */}
                                      <div className={`grid grid-cols-4 px-4 py-3 border-t-2 text-[12px] font-black ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Total</span>
                                        <span className={`text-center font-black ${totEst > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>{totEst}</span>
                                        <span className="text-center text-slate-500">{totReq}</span>
                                        <span className={`text-right font-black text-[14px] ${totFalta > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                                          {totFalta > 0 ? `-${totFalta}` : '✓'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Tabela de detalhamento por mapa/pedido — só para MATERIAL */}
                                {item.type === 'MATERIAL' && item.sourceBreakdown && Object.keys(item.sourceBreakdown).length > 0 && (() => {
                                  const sources = Object.values(item.sourceBreakdown);
                                  const totalPairs = sources.reduce((s, src) => s + src.pairs, 0);
                                  return (
                                    <div className={`rounded-2xl overflow-hidden border ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                                      <div className={`grid grid-cols-4 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                        <span>Origem</span>
                                        <span className="text-center">Pares</span>
                                        <span className="text-center">Consumo/Par</span>
                                        <span className="text-right">Subtotal</span>
                                      </div>
                                      {sources.map(src => {
                                        const perUnit = src.pairs > 0 ? src.increment / src.pairs : 0;
                                        return (
                                          <div key={`${src.sourceType}_${src.label}`} className={`grid grid-cols-4 px-4 py-3 border-t text-[12px] font-black ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
                                            <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>{src.sourceType === 'LOT' ? 'Mapa' : 'Pedido'} {src.label}</span>
                                            <span className="text-center text-slate-400">{fmtQty(src.pairs)}</span>
                                            <span className="text-center text-slate-400">{perUnit.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</span>
                                            <span className={isDarkMode ? 'text-right text-white' : 'text-right text-slate-800'}>{fmtQty(src.increment)} {item.unit}</span>
                                          </div>
                                        );
                                      })}
                                      <div className={`grid grid-cols-4 px-4 py-3 border-t-2 text-[12px] font-black ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Total</span>
                                        <span className="text-center text-slate-500">{fmtQty(totalPairs)}</span>
                                        <span />
                                        <span className={`text-right text-[14px] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{fmtQty(item.required)} {item.unit}</span>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Rodapé: a comprar + botão solicitar */}
                                {(() => {
                                  const existingReq = purchaseRequests.find(r => r.requestKey === item.id && r.status !== 'RECEIVED');

                                  // Estoque real EXCLUSIVO por moldId + colorId (sem fallback para outras cores)
                                  let realGradeStock: Record<string, number> = {};
                                  if (item.type === 'SOLE') {
                                    soleStock
                                      .filter(s => s.moldId === item.moldId && String(s.colorId || '').trim() === String(item.colorId || '').trim())
                                      .forEach(e => {
                                        Object.entries(e.stock).forEach(([k, v]) => {
                                          const key = String(k).trim();
                                          if (key === 'pesagem' || key === 'total') return;
                                          realGradeStock[key] = (realGradeStock[key] || 0) + (Number(v) || 0);
                                        });
                                      });
                                  }

                                  // Falta real usando estoque do soleStock (corrige o bug dos 60 → 7)
                                  const totalFaltaSole = item.type === 'SOLE' && item.sizeShortages
                                    ? Object.keys(item.sizeShortages).reduce((s: number, grade: string) => {
                                      const req = (item.sizeShortages as any)[grade].required;
                                      const stock = realGradeStock[grade] || 0;
                                      return s + Math.max(0, req - stock);
                                    }, 0)
                                    : Math.max(0, item.required - item.stock);

                                  const displayQty = item.type === 'SOLE' ? totalFaltaSole : item.required;
                                  const displayLabel = item.type === 'SOLE' ? 'A Comprar' : 'Necessário';

                                  // Verifica compras de solado pendentes para este molde (qualquer cor ou cor específica)
                                  const inTransitQtys: Record<string, number> = {};
                                  const inTransitByColor: Record<string, { colorName: string; qtys: Record<string, number> }> = {};
                                  if (item.type === 'SOLE') {
                                    purchases
                                      .filter(p => {
                                        if (p.registerAsReceived === true) return false;
                                        // Aceita qualquer tipo de compra que tenha itens de solado
                                        const si: any[] = (p as any).soleItems || (p as any).items || [];
                                        return si.some((s: any) => s.moldId);
                                      })
                                      .forEach(p => {
                                        const allItems: any[] = (p as any).soleItems || (p as any).items || [];
                                        allItems
                                          .filter((si: any) => {
                                            if (!si.moldId) return false;
                                            if (String(si.moldId).trim() !== String(item.moldId).trim()) return false;
                                            if (!item.colorId) return true;
                                            if (si.colorId && String(si.colorId).trim() === String(item.colorId).trim()) return true;
                                            const needColor = item.name?.split(' - ')[1]?.toUpperCase().trim() || '';
                                            if (needColor && si.colorName?.toUpperCase().trim() === needColor) return true;
                                            return false;
                                          })
                                          .forEach((si: any) => {
                                            const colorKey = si.colorName || si.colorId || 'Padrão';
                                            if (!inTransitByColor[colorKey]) {
                                              inTransitByColor[colorKey] = { colorName: colorKey, qtys: {} };
                                            }
                                            Object.entries(si.quantities || {}).forEach(([size, qty]: [string, any]) => {
                                              const qtyNum = Number(qty) || 0;
                                              if (qtyNum > 0) {
                                                inTransitQtys[size] = (inTransitQtys[size] || 0) + qtyNum;
                                                inTransitByColor[colorKey].qtys[size] = (inTransitByColor[colorKey].qtys[size] || 0) + qtyNum;
                                              }
                                            });
                                          });
                                      });
                                  }
                                  const totalInTransit = Object.values(inTransitQtys).reduce((a, b) => a + b, 0);

                                  const STATUS_LABEL: Record<string, string> = {
                                    PENDING: 'Solicitado',
                                    IN_PROGRESS: 'Em Andamento',
                                    ORDERED: 'Pedido Feito',
                                  };
                                  const STATUS_COLOR: Record<string, string> = {
                                    PENDING: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
                                    IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700',
                                    ORDERED: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-700',
                                  };

                                  // Cruzamento: saldo real a comprar descontando o que está em trânsito
                                  const realToComprar = item.type === 'SOLE' && item.sizeShortages
                                    ? Object.keys(item.sizeShortages).reduce((s: number, grade: string) => {
                                      const req = (item.sizeShortages as any)[grade].required;
                                      const stock = realGradeStock[grade] || 0;
                                      const transit = inTransitQtys[grade] || 0;
                                      return s + Math.max(0, req - stock - transit);
                                    }, 0)
                                    : Math.max(0, displayQty - totalInTransit);

                                  return (
                                    <div className={`pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>

                                      {/* Tabela inline de cruzamento — só para SOLE com trânsito */}
                                      {totalInTransit > 0 && item.type === 'SOLE' && item.sizeShortages && (
                                        <div className={`mb-3 rounded-xl overflow-hidden border ${isDarkMode ? 'border-amber-800/50 bg-amber-950/20' : 'border-amber-200 bg-amber-50/60'}`}>
                                          {/* Header aviso */}
                                          <div className={`flex items-center gap-2 px-3 py-2 border-b ${isDarkMode ? 'border-amber-800/40' : 'border-amber-200'}`}>
                                            <ShoppingCart size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                                              {totalInTransit} par(es) em trânsito — aguardando recebimento
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => setInTransitPopupItem({ item, inTransitQtys, inTransitByColor, realGradeStock, totalFaltaSole, totalInTransit })}
                                              className="ml-auto text-[9px] font-black text-amber-600 dark:text-amber-400 underline hover:no-underline"
                                              title="Ver detalhes"
                                            >
                                              Detalhes
                                            </button>
                                          </div>
                                          {/* Mini tabela cruzada */}
                                          <div className={`grid grid-cols-4 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                            <span>Grade</span>
                                            <span className="text-center text-rose-500">Falta</span>
                                            <span className="text-center text-amber-500">Trânsito</span>
                                            <span className="text-right text-emerald-500">Saldo</span>
                                          </div>
                                          {Object.keys(item.sizeShortages).sort((a, b) => parseFloat(a) - parseFloat(b)).map(grade => {
                                            const req = (item.sizeShortages as any)[grade].required;
                                            const stock = realGradeStock[grade] || 0;
                                            const falta = Math.max(0, req - stock);
                                            const transit = inTransitQtys[grade] || 0;
                                            const saldo = Math.max(0, falta - transit);
                                            if (falta === 0 && transit === 0) return null;
                                            return (
                                              <div key={grade} className={`grid grid-cols-4 px-3 py-2 border-t text-xs font-black ${isDarkMode ? 'border-amber-900/40 bg-slate-900/40' : 'border-amber-100 bg-white/60'}`}>
                                                <span className={isDarkMode ? 'text-white' : 'text-slate-700'}>{grade}</span>
                                                <span className={`text-center ${falta > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{falta > 0 ? `-${falta}` : '✓'}</span>
                                                <span className={`text-center ${transit > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{transit > 0 ? `+${transit}` : '—'}</span>
                                                <span className={`text-right ${saldo > 0 ? 'text-rose-600 font-black' : 'text-emerald-500'}`}>{saldo > 0 ? `-${saldo}` : '✓'}</span>
                                              </div>
                                            );
                                          })}
                                          {realToComprar === 0 && (
                                            <div className={`px-3 py-2 border-t text-[9px] font-black text-emerald-600 dark:text-emerald-400 ${isDarkMode ? 'border-amber-900/40 bg-emerald-950/20' : 'border-amber-100 bg-emerald-50/60'}`}>
                                              ✓ As compras em trânsito cobrem toda a necessidade. Aguarde o recebimento.
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      <div className="flex items-center justify-between">
                                        <div>
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                            {totalInTransit > 0 ? 'Saldo Real a Comprar' : displayLabel}
                                          </p>
                                          <p className={`text-2xl font-black leading-none ${realToComprar > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                                            {fmtQty(totalInTransit > 0 ? realToComprar : displayQty)}
                                            <span className="text-[11px] text-slate-400 ml-1">{item.unit}</span>
                                          </p>
                                        </div>
                                        {existingReq ? (
                                          <span className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border ${STATUS_COLOR[existingReq.status] || ''}`}>
                                            <CheckCircle2 size={13} strokeWidth={3} />
                                            {STATUS_LABEL[existingReq.status] || existingReq.status}
                                          </span>
                                        ) : totalInTransit > 0 && realToComprar === 0 ? (
                                          <div className="flex flex-col items-end gap-1">
                                            <span className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border ${isDarkMode ? 'bg-amber-950/30 border-amber-700/50 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                              <ShoppingCart size={12} />
                                              Em Trânsito
                                            </span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Aguarde o recebimento</span>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            disabled={requestingId === item.id}
                                            onClick={async () => {
                                              if (!onRequestPurchase || requestingId) return;
                                              if (item.type === 'SOLE') {
                                                setSelectedSoleNeed(item);
                                                setExtraSoleQty({});
                                                setIsSoleOrderModalOpen(true);
                                                return;
                                              }
                                              setRequestingId(item.id);
                                              try {
                                                await onRequestPurchase({
                                                  requestKey: item.id,
                                                  type: 'MATERIAL',
                                                  name: item.name,
                                                  unit: item.unit,
                                                  requiredQty: Math.max(0, item.required - item.stock),
                                                  status: 'PENDING',
                                                  requestedAt: Date.now(),
                                                  requestedBy: userName,
                                                  contributingLots: item.contributingLots,
                                                  materialId: item.materialId,
                                                });
                                                toast.show(`Solicitação de ${item.name} enviada com sucesso!`);
                                              } catch (err) {
                                                toast.show('Erro ao enviar solicitação.');
                                              } finally {
                                                setRequestingId(null);
                                              }
                                            }}
                                            className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 ${requestingId === item.id
                                              ? 'bg-slate-200 text-slate-400 cursor-wait'
                                              : 'bg-indigo-600 text-white shadow-indigo-500/20 hover:scale-105 active:scale-95'
                                              }`}
                                          >
                                            {requestingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} strokeWidth={3} />}
                                            {requestingId === item.id ? 'Enviando...' : 'Solicitar'}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </>}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {palmilhaItems.length > 0 && (
            <div className={`p-8 rounded-[2.5rem] border-2 shadow-xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Palmilhas</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Reserva dos Mapas vs Estoque de Palmilhas</p>
                </div>
                <span className="px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-rose-50 dark:bg-rose-900/20 text-rose-500">
                  {palmilhaItems.length} Falta{palmilhaItems.length > 1 ? 's' : ''}
                </span>
              </div>

              {([
                { key: 'MONTAGEM', label: 'Palmilha de Montagem', items: palmilhaMontagemItems },
                { key: 'ACABAMENTO', label: 'Palmilha de Acabamento', items: palmilhaAcabamentoItems },
              ] as { key: 'MONTAGEM' | 'ACABAMENTO'; label: string; items: typeof palmilhaItems }[]).map(group => {
                if (group.items.length === 0) return null;
                return (
                  <div key={group.key} className="flex flex-col gap-3 mb-6 last:mb-0">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Footprints size={14} /> {group.label}
                    </h4>
                    {group.items.map(item => {
                      const needId = `palmilha_${item.toolId}_${item.colorId || 'default'}`;
                      const isExpanded = expandedNeedIds.has(needId);
                      const gradeKeys = Object.keys(item.sizeShortages).sort((a, b) => {
                        const numA = parseFloat(a);
                        const numB = parseFloat(b);
                        if (isNaN(numA) || isNaN(numB)) return a.localeCompare(b);
                        return numA - numB;
                      });

                      return (
                        <div
                          key={needId}
                          className={`rounded-[2rem] border-2 transition-all overflow-hidden ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-white shadow-sm'} ${isExpanded ? 'border-rose-300 dark:border-rose-700' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleNeedExpand(needId)}
                            title={isExpanded ? `Recolher detalhes de ${item.toolName}` : `Expandir detalhes de ${item.toolName}`}
                            aria-label={isExpanded ? `Recolher detalhes de ${item.toolName}` : `Expandir detalhes de ${item.toolName}`}
                            className={`w-full flex flex-col gap-3 px-5 py-4 text-left transition-colors ${isExpanded ? isDarkMode ? 'bg-rose-950/30' : 'bg-rose-50/60' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-rose-100 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400">
                                <Footprints size={18} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1 text-rose-500">
                                  {item.subtype === 'MONTAGEM' ? 'Palmilha Montagem' : 'Palmilha Acabamento'}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                                  <p className="text-sm font-black uppercase leading-tight text-rose-600 dark:text-rose-400">
                                    {item.toolName}
                                  </p>
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${isDarkMode ? 'bg-rose-950/40 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                                    {item.colorName}
                                  </span>
                                  {item.silkSector && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border" style={{ borderColor: item.silkSector.color, color: item.silkSector.color }}>
                                      SILK · {item.silkSector.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                                <ChevronDown size={16} strokeWidth={2.5} />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                              <div>
                                <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none mb-0.5">Falta</p>
                                <p className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-none">
                                  {Math.round(item.totalShortage)} <span className="text-xs font-bold text-slate-400">PAR</span>
                                </p>
                              </div>
                              {item.silkCostEstimate > 0 && (
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none mb-0.5">Custo SILK Estimado</p>
                                  <p className="text-sm font-black text-violet-600 dark:text-violet-400 leading-none">
                                    R$ {item.silkCostEstimate.toFixed(2)}
                                  </p>
                                </div>
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className={`px-6 pb-6 pt-2 flex flex-col gap-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                              <div className={`rounded-2xl overflow-hidden border ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                                <div className={`grid grid-cols-4 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                  <span>Grade</span>
                                  <span className="text-center">Estoque</span>
                                  <span className="text-center">Necess.</span>
                                  <span className="text-right">Falta</span>
                                </div>
                                {gradeKeys.map(grade => {
                                  const s = item.sizeShortages[grade];
                                  const shortage = Math.max(0, s.required - s.stock - s.pending);
                                  return (
                                    <div key={grade} className={`grid grid-cols-4 px-4 py-3 border-t text-[13px] font-black ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
                                      <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>{grade}</span>
                                      <span className={`text-center ${s.stock > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>{s.stock}</span>
                                      <span className="text-center text-slate-400">{s.required}</span>
                                      <span className={`text-right ${shortage > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                                        {shortage > 0 ? `-${shortage}` : '✓'}
                                      </span>
                                    </div>
                                  );
                                })}
                                <div className={`grid grid-cols-4 px-4 py-3 border-t-2 text-[12px] font-black ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Total</span>
                                  <span className={`text-center font-black ${item.totalStock > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>{item.totalStock}</span>
                                  <span className="text-center text-slate-500">{item.totalRequired}</span>
                                  <span className="text-right font-black text-[14px] text-rose-600">-{item.totalShortage}</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-end pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const initialGrid: Record<string, number> = {};
                                    gradeKeys.forEach(grade => {
                                      const s = item.sizeShortages[grade];
                                      const shortage = Math.max(0, s.required - s.stock - s.pending);
                                      if (shortage > 0) initialGrid[grade] = shortage;
                                    });
                                    onNavigate(ViewType.PRODUCTION_PALMILHA_PURCHASE, {
                                      items: [{
                                        toolId: item.toolId,
                                        toolName: item.toolName,
                                        subtype: item.subtype,
                                        colorId: item.colorId,
                                        colorName: item.colorName,
                                        initialGrid
                                      }],
                                      description: `Pedido formulado a partir das Necessidades — ${item.toolName} (${item.colorName})`
                                    });
                                  }}
                                  className="flex items-center gap-1.5 px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg transition-all bg-rose-600 text-white shadow-rose-500/20 hover:scale-105 active:scale-95"
                                >
                                  <ArrowUpRight size={14} strokeWidth={3} /> Formular Pedido
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'lots' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por mapa, modelo ou referência..."
                className={`w-full pl-14 pr-6 py-5 rounded-[2rem] border-2 transition-all outline-none text-sm font-black uppercase tracking-wider ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-600 shadow-sm'}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {filteredLots.length > 0 && (
              <button
                onClick={async () => {
                  if (confirm(`Deseja excluir TODOS os ${filteredLots.length} mapas e voltar os pedidos para pendentes?`)) {
                    for (const lot of filteredLots) {
                      await onDeleteLot(lot.id);
                    }
                  }
                }}
                className="px-6 py-5 rounded-[2rem] bg-rose-50 dark:bg-rose-900/20 text-rose-500 border-2 border-rose-100 dark:border-rose-900/30 hover:bg-rose-100 transition-all flex items-center gap-2"
                title="Limpar todos os mapas"
              >
                <Trash2 size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Limpar Tudo</span>
              </button>
            )}
          </div>

          {/* Barra de Filtros de Status (Pills e Checkboxes) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1 py-2 border-b border-slate-100 dark:border-slate-800/40 pb-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'active', label: 'Em Produção', count: lots.filter(l => !l.finishedAt).length, activeClass: 'bg-indigo-600 text-white border-transparent', idleClass: isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-sm' },
                { id: 'finished', label: 'Produzidos', count: lots.filter(l => !!l.finishedAt).length, activeClass: 'bg-emerald-600 text-white border-transparent', idleClass: isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-sm' },
                { id: 'urgent', label: 'Urgentes', count: lots.filter(l => !l.finishedAt && (l.prioridade === 'URGENTE' || l.prioridade === 'ALTA')).length, activeClass: 'bg-rose-600 text-white border-transparent', idleClass: isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-sm' },
                { id: 'all', label: 'Todos', count: lots.length, activeClass: 'bg-slate-700 text-white border-transparent', idleClass: isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-sm' }
              ].map(f => {
                const isActive = statusFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id as any)}
                    className={`px-3.5 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-[0.98] ${isActive ? f.activeClass : f.idleClass}`}
                  >
                    <span>{f.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${isActive ? 'bg-white/20 text-white' : isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400 sm:self-center">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={statusFilter === 'active'}
                  onChange={(e) => setStatusFilter(e.target.checked ? 'active' : 'all')}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span>Ocultar Concluídos</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={statusFilter === 'finished'}
                  onChange={(e) => setStatusFilter(e.target.checked ? 'finished' : 'all')}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span>Ocultar Em Produção</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {[...filteredLots].sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0) || b.createdAt - a.createdAt).map(lot => {
              const product = products.find(p => p.id === lot.productId);
              const variation = product?.variations.find(v => v.id === lot.variationId);
              const sector = sectors.find(s => s.id === (lot.route && lot.route[lot.currentSectorIndex]));
              const isFinished = !!lot.finishedAt;

              return (
                <div
                  key={lot.id}
                  onClick={() => {
                    setSelectedLot(lot);
                    setIsDetailModalOpen(true);
                  }}
                  className={`relative p-5 rounded-3xl border flex items-center gap-4 transition-all cursor-pointer ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                >
                  {/* Botão de Ação no canto superior direito */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Excluir este mapa permanentemente?')) {
                          onDeleteLot(lot.id);
                        }
                      }}
                      className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 hover:text-rose-600 transition-all"
                      title="Excluir Mapa"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 flex-1 min-w-0 pr-10">
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isFinished ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'}`}>
                          {isFinished ? <CheckCircle2 size={13} strokeWidth={3} /> : <Factory size={13} />}
                        </div>
                        <span
                          className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest leading-none shrink-0"
                          style={(() => {
                            const bg = (lot as any).metadata?.badgeColor || mapBadgeBg;
                            const txt = (lot as any).metadata?.badgeTextColor || getContrastingColor(bg);
                            return {
                              backgroundColor: bg,
                              color: txt,
                              boxShadow: `0 1px 2px ${bg}40`
                            };
                          })()}
                        >
                          MAPA {lot.orderNumber}
                        </span>
                        {isFinished && <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-500 text-white px-2 py-0.5 rounded-md">Finalizado</span>}
                        {lot.productionOrderId && (() => {
                          const linkedOrder = productionOrders.find(o => o.id === lot.productionOrderId);
                          if (!linkedOrder) return (
                            <span className="text-[8px] font-black uppercase tracking-widest bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-md">OP</span>
                          );
                          const linkedSale = linkedOrder.saleId ? sales?.find(s => s.id === linkedOrder.saleId) : undefined;
                          const isStockOrder = linkedOrder.customerName?.toLowerCase() === 'estoque' || linkedSale?.saleDestination === 'STOCK';
                          if (linkedOrder.status === 'COMPLETED') {
                            return isStockOrder ? (
                              <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Package size={9} /> Produzido
                              </span>
                            ) : (
                              <span className="text-[8px] font-black uppercase tracking-widest bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Truck size={9} /> Entregue
                              </span>
                            );
                          }
                          return (
                            <span className="text-[8px] font-black uppercase tracking-widest bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-md">
                              {linkedOrder.orderNumber}
                            </span>
                          );
                        })()}

                        {/* Botão de Paleta (Configurar Cor do Mapa) no local do print */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setColorPickerLot(lot);
                            setIsColorPickerOpen(true);
                          }}
                          className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:text-indigo-600 transition-all flex items-center gap-1 shrink-0 ml-1 border border-indigo-100 dark:border-indigo-900/30 shadow-sm"
                          title="Configurar Cor do Mapa"
                        >
                          <Palette size={10} />
                          <span className="text-[8px] font-black uppercase tracking-widest">Cor do Mapa</span>
                        </button>
                      </div>
                      <p className="text-[13px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                        {product ? (product.reference ? `${product.reference} · ${product.name}` : product.name) : '---'} • {variation?.colorName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{lot.quantity} PARES</span>
                        {lot.customerName && <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase truncate max-w-[150px]"> • {lot.customerName}</span>}
                      </div>

                      {/* Grade do Pedido (Grid) */}
                      {lot.pairs && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {Object.entries(lot.pairs).map(([size, qty]) => (
                            <div key={size} className="flex flex-col items-center min-w-[36px] p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-md">
                              <span className="text-[11px] font-black text-slate-600 dark:text-slate-400 leading-none mb-1">{size}</span>
                              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 leading-none">{qty as number}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {lot.deliveryDate && (
                        <div className="flex items-center gap-2 mt-3">
                          <CalendarClock size={14} className={lot.deliveryDate < Date.now() ? 'text-rose-500' : 'text-slate-400'} />
                          <p className={`text-[13px] font-black uppercase tracking-widest ${lot.deliveryDate < Date.now() ? 'text-rose-500' : 'text-slate-500'}`}>
                            Entrega: {new Date(lot.deliveryDate).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <ChevronRight size={18} className="text-slate-300 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'solados' && (
        <div className="flex flex-col gap-6">
          <header className="mb-1">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Gestão de Solados</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Pesagem, conferência, estoque e matrizes</p>
          </header>

          <div className={`rounded-[2.5rem] border shadow-sm overflow-hidden ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
            {[
              { id: ViewType.PRODUCTION_WEIGHING, label: 'Pesagem e Contagem de Solados', description: 'Bipagem, pesagem e contagem de pares', icon: <Scale size={24} />, color: 'text-violet-600' },
              { id: ViewType.PRODUCTION_SOLE_RECEIPT, label: 'Conferência de Compras (Solas)', description: 'Receber e conferir solados comprados', icon: <ShoppingCart size={24} />, color: 'text-cyan-600' },
              { id: ViewType.PRODUCTION_SOLE_STOCK, label: 'Estoque de Solados', description: 'Gerenciamento por modelo, cor e tamanho', icon: <Package size={24} />, color: 'text-emerald-600' },
            ].map((item, index, array) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between p-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all active:scale-[0.98] ${index !== array.length - 1 ? (isDarkMode ? "border-b border-slate-800" : "border-b border-slate-50") : ""}`}
              >
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? "bg-slate-800" : "bg-slate-50"} ${item.color}`}>
                    {item.icon}
                  </div>
                  <div className="text-left">
                    <p className={`text-lg font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>{item.label}</p>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{item.description}</p>
                  </div>
                </div>
                <ChevronRight size={24} className={isDarkMode ? "text-slate-700" : "text-slate-300"} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => onNavigateProduction?.('MATRIZES')}
              className="w-full flex items-center justify-between p-8 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? "bg-slate-800" : "bg-slate-50"} text-indigo-500`}>
                  <Database size={24} />
                </div>
                <div className="text-left">
                  <p className={`text-lg font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>Matrizes</p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Cadastro de moldes e matrizes de solados</p>
                </div>
              </div>
              <ChevronRight size={24} className={isDarkMode ? "text-slate-700" : "text-slate-300"} />
            </button>
          </div>
        </div>
      )}

      {/* ── Centro de Compartilhamento PCP ── */}
      <Modal
        isOpen={isPCPShareModalOpen}
        onClose={() => setIsPCPShareModalOpen(false)}
        title="Centro de Compartilhamento PCP"
        maxWidth="max-w-xl"
      >
        <div className="flex flex-col gap-5">

          {/* Tipo de relatório */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 px-1">Tipo de Relatório</p>
            <div className={`flex rounded-2xl p-1 gap-1 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
              {([
                { id: 'sector', label: 'Por Setor' },
                { id: 'lot', label: 'Por Mapa' },
                { id: 'customer', label: 'Por Cliente' },
              ] as const).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setShareReportType(t.id)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${shareReportType === t.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 px-1">Status dos Mapas</p>
            <div className="flex gap-2 flex-wrap">
              {([
                { id: 'active', label: 'Em Produção' },
                { id: 'finished', label: 'Concluídos' },
                { id: 'all', label: 'Todos' },
              ] as const).map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setShareFilterStatus(s.id)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${shareFilterStatus === s.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-500 border-slate-200'
                    }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro por setor */}
          {sectors.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Setores</p>
                <button
                  type="button"
                  onClick={() => setShareFilterSectors(new Set())}
                  className="text-[9px] font-black text-indigo-500 uppercase tracking-widest"
                >
                  {shareFilterSectors.size === 0 ? 'Todos selecionados' : `${shareFilterSectors.size} filtrado(s) — limpar`}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {visibleSectors.map(sec => {
                  const active = shareFilterSectors.size === 0 || shareFilterSectors.has(sec.id);
                  const color = sec.color || '#6366f1';
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        setShareFilterSectors(prev => {
                          const next = new Set(prev.size === 0 ? visibleSectors.map(s => s.id) : prev);
                          if (next.has(sec.id)) { next.delete(sec.id); if (next.size === visibleSectors.length) return new Set(); }
                          else next.add(sec.id);
                          return next;
                        });
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${active
                        ? isDarkMode ? 'bg-indigo-900/30 border-indigo-700 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-white border-slate-200 text-slate-400'
                        }`}
                    >
                      <span
                        className="w-4 h-4 rounded-md flex items-center justify-center shrink-0 transition-colors border-2"
                        style={active ? { background: color, borderColor: color } : { borderColor: isDarkMode ? '#475569' : '#cbd5e1' }}
                      >
                        {active && <CheckCircle2 size={10} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest leading-tight">
                        {sec.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Busca com sugestões */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 px-1">Buscar por Produto / Cliente / Mapa</p>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={shareSearch}
                onChange={e => setShareSearch(e.target.value)}
                placeholder="Ex: BOSS, Cliente XYZ, 003..."
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm font-bold border outline-none focus:ring-2 focus:ring-indigo-500/20 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
              />
              {shareSearch && (
                <button type="button" onClick={() => setShareSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" title="Limpar busca" aria-label="Limpar busca">
                  <X size={14} />
                </button>
              )}
              {/* Sugestões */}
              {shareSearch.trim().length > 0 && (() => {
                const q = shareSearch.toLowerCase();
                const suggestions: { label: string; kind: 'map' | 'product' | 'customer' }[] = [];
                const seen = new Set<string>();
                lots.forEach(l => {
                  const p = products.find(pr => pr.id === l.productId);
                  const order = l.productionOrderId ? productionOrders.find(o => o.id === l.productionOrderId) : undefined;
                  // Número do mapa
                  if (l.orderNumber?.toLowerCase().includes(q)) {
                    const k = `map:${l.orderNumber}`;
                    if (!seen.has(k)) { seen.add(k); suggestions.push({ label: `MAPA ${l.orderNumber}`, kind: 'map' }); }
                  }
                  // Produto
                  if (p?.name?.toLowerCase().includes(q)) {
                    const k = `prod:${p.id}`;
                    if (!seen.has(k)) { seen.add(k); suggestions.push({ label: p.name, kind: 'product' }); }
                  }
                  if (p?.reference?.toLowerCase().includes(q)) {
                    const k = `ref:${p.id}`;
                    if (!seen.has(k)) { seen.add(k); suggestions.push({ label: p.reference!, kind: 'product' }); }
                  }
                  // Cliente (no lote ou no pedido vinculado)
                  const custName = l.customerName || order?.customerName;
                  if (custName && custName.toLowerCase().includes(q)) {
                    const k = `cust:${custName}`;
                    if (!seen.has(k)) { seen.add(k); suggestions.push({ label: custName, kind: 'customer' }); }
                  }
                  ((l as any).groups || []).forEach((g: any) => {
                    const go = g.productionOrderId ? productionOrders.find((o: any) => o.id === g.productionOrderId) : undefined;
                    const gCust = g.customerName || go?.customerName;
                    if (gCust && gCust.toLowerCase().includes(q)) {
                      const k = `cust:${gCust}`;
                      if (!seen.has(k)) { seen.add(k); suggestions.push({ label: gCust, kind: 'customer' }); }
                    }
                  });
                });
                if (!suggestions.length) return null;
                return (
                  <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    {suggestions.slice(0, 6).map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setShareSearch(s.kind === 'map' ? s.label.replace('MAPA ', '') : s.label)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'} ${i > 0 ? (isDarkMode ? 'border-t border-slate-700' : 'border-t border-slate-100') : ''}`}
                      >
                        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${s.kind === 'map' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                          : s.kind === 'product' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          }`}>
                          {s.kind === 'map' ? 'Mapa' : s.kind === 'product' ? 'Produto' : 'Cliente'}
                        </span>
                        <span className={`text-[13px] font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{s.label}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Opções de conteúdo */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 px-1">Incluir no Relatório</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'grades', label: 'Grade Completa (tamanhos)' },
                { key: 'totals', label: 'Totais por Setor' },
                { key: 'dates', label: 'Datas de Entrega' },
                { key: 'refs', label: 'Referência do Produto' },
                { key: 'customer', label: 'Nome do Cliente' },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setShareOpts(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${shareOpts[opt.key]
                    ? isDarkMode ? 'bg-indigo-900/30 border-indigo-700 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-white border-slate-200 text-slate-400'
                    }`}
                >
                  <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${shareOpts[opt.key] ? 'bg-indigo-600 border-indigo-600' : isDarkMode ? 'border-slate-600' : 'border-slate-300'}`}>
                    {shareOpts[opt.key] && <CheckCircle2 size={10} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Resumo + botão pré-visualizar */}
          {(() => {
            const preview = getShareData();
            const totalPairs = preview.reduce((s, l) => s + (l.quantity || 0), 0);
            const sectorSet = new Set(preview.map(l => l.route?.[l.currentSectorIndex]).filter(Boolean));
            return (
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Prévia do Conteúdo</p>
                  {preview.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSharePreviewOpen(true)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 border ${isDarkMode ? 'bg-indigo-900/30 border-indigo-700 text-indigo-300 hover:bg-indigo-900/50' : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'}`}
                    >
                      <Eye size={10} strokeWidth={2.5} /> Pré-visualizar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{preview.length}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Mapas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-indigo-500">{totalPairs}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pares</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{sectorSet.size}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Setores</p>
                  </div>
                </div>
                {preview.length === 0 && (
                  <p className="text-[10px] text-slate-400 text-center mt-3 italic">Nenhum mapa corresponde aos filtros</p>
                )}
              </div>
            );
          })()}

          {/* Botões de exportação */}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={!!shareGenerating || getShareData().length === 0}
              onClick={generatePCPPDF}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${!!shareGenerating || getShareData().length === 0
                ? 'opacity-40 cursor-not-allowed ' + (isDarkMode ? 'bg-slate-700 text-slate-500' : 'bg-slate-100 text-slate-400')
                : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                }`}
            >
              {shareGenerating === 'pdf'
                ? <><Loader2 size={14} className="animate-spin" /> Gerando...</>
                : <><FileText size={14} strokeWidth={3} /> Gerar PDF</>
              }
            </button>
            <button
              type="button"
              disabled={!!shareGenerating || getShareData().length === 0}
              onClick={generatePCPImage}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${!!shareGenerating || getShareData().length === 0
                ? 'opacity-40 cursor-not-allowed ' + (isDarkMode ? 'bg-slate-700 text-slate-500' : 'bg-slate-100 text-slate-400')
                : isDarkMode ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                }`}
            >
              {shareGenerating === 'image'
                ? <><Loader2 size={14} className="animate-spin" /> Gerando...</>
                : <><Share2 size={14} strokeWidth={3} /> Gerar Imagem</>
              }
            </button>
          </div>

        </div>
      </Modal>

      {/* ── Popup Pré-visualização do Relatório PCP ── */}
      {sharePreviewOpen && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 70000 }}>
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setSharePreviewOpen(false)} />
          {/* Popup centralizado */}
          <div className="relative w-full flex flex-col rounded-3xl overflow-hidden shadow-2xl" style={{ height: '94vh', maxWidth: 560, background: '#f4f6fb' }}>

            {/* ── Topo ── */}
            <div className="shrink-0 bg-white px-5 py-4 flex items-center gap-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                <Factory size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-black text-slate-900 leading-none">Pré-visualização</p>
                <p className="text-[10px] text-indigo-500 font-bold mt-0.5 truncate">
                  {(() => {
                    const q = shareSearch.trim().toLowerCase();
                    const custOrders = q ? productionOrders.filter(o => (o.customerName || '').toLowerCase().includes(q)) : [];
                    if (custOrders.length > 0) {
                      const total = custOrders.reduce((s, o) => s + o.items.reduce((ss, it) => ss + (it.toProductionQty || 0), 0), 0);
                      return `Cliente: ${shareSearch.trim()} · ${total} pares`;
                    }
                    const total = getShareData().reduce((s, l) => s + (l.quantity || 0), 0);
                    return `${shareReportType === 'sector' ? 'Por Setor' : shareReportType === 'lot' ? 'Por Mapa' : 'Por Cliente'} · ${total} pares`;
                  })()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSharePreviewOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500 text-white active:scale-95 transition-all shrink-0"
                title="Fechar pré-visualização"
                aria-label="Fechar pré-visualização"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>

            {/* ── Conteúdo scrollável ── */}
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {(() => {
                const preview = getShareData();
                const typeLabel = shareReportType === 'sector' ? 'sector' : shareReportType === 'lot' ? 'lot' : 'customer';

                const renderGrade = (pairs: Record<string, number>) => {
                  const sizes = Object.keys(pairs).sort((a, b) => Number(a) - Number(b));
                  if (!sizes.length) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {sizes.map(s => (
                        <div key={s} className="flex flex-col overflow-hidden rounded-lg" style={{ minWidth: 34 }}>
                          <div className="text-center text-[10px] font-black px-2 py-1 leading-none" style={{ background: '#475569', color: '#f1f5f9' }}>
                            {s}
                          </div>
                          <div className="text-center text-[11px] font-black px-2 py-1.5 leading-none bg-slate-100 text-slate-900">
                            {pairs[s] || 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                };

                const renderLotCard = (lot: (typeof preview)[0]) => {
                  const p = products.find(pr => pr.id === lot.productId);
                  const v = p?.variations?.find(va => va.id === lot.variationId);
                  const ref = shareOpts.refs && p?.reference ? `${p.reference} · ` : '';
                  const pairs = (lot.pairs || {}) as Record<string, number>;
                  return (
                    <div key={lot.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-2">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span
                          className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest leading-none shrink-0"
                          style={(() => {
                            const bg = (lot as any).metadata?.badgeColor || mapBadgeBg;
                            const txt = (lot as any).metadata?.badgeTextColor || getContrastingColor(bg);
                            return {
                              backgroundColor: bg,
                              color: txt,
                              boxShadow: `0 1px 2px ${bg}30`
                            };
                          })()}
                        >
                          MAPA {lot.orderNumber}
                        </span>
                        <span className="text-[11px] font-black text-indigo-400 shrink-0">{lot.quantity} par</span>
                      </div>
                      <p className="text-[12px] font-bold text-slate-700 leading-snug">
                        {ref}{p?.name || '—'}
                      </p>
                      <p className="text-[11px] text-slate-400 font-bold">{v?.colorName || '—'}</p>
                      {shareOpts.customer && lot.customerName && (
                        <p className="text-[10px] text-slate-400 mt-1">{lot.customerName}</p>
                      )}
                      {shareOpts.dates && lot.deliveryDate && (
                        <p className="text-[10px] text-slate-400 mt-0.5">Entrega: {new Date(lot.deliveryDate).toLocaleDateString('pt-BR')}</p>
                      )}
                      {shareOpts.grades && renderGrade(pairs)}
                    </div>
                  );
                };

                const renderSectionHeader = (title: string, count: string) => (
                  <div className="flex items-center gap-3 mb-2 mt-1">
                    <div className="w-1 h-8 rounded-full bg-indigo-500 shrink-0" />
                    <div>
                      <p className="text-[12px] font-black text-slate-900 uppercase tracking-widest leading-none">{title}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">{count}</p>
                    </div>
                  </div>
                );

                // ── Busca por cliente tem prioridade sobre qualquer typeLabel ──
                const searchQ = shareSearch.trim().toLowerCase();
                const matchingCustomerOrders = searchQ.length > 0
                  ? productionOrders.filter(o => (o.customerName || '').toLowerCase().includes(searchQ))
                  : [];
                const searchMatchesCustomer = matchingCustomerOrders.length > 0;

                if (searchMatchesCustomer || typeLabel === 'customer') {
                  const ordersToShow = searchMatchesCustomer
                    ? matchingCustomerOrders
                    : productionOrders.filter(o => preview.some(l => l.productionOrderId === o.id));

                  const custGroups = new Map<string, typeof ordersToShow>();
                  ordersToShow.forEach(o => {
                    const cust = o.customerName || 'Sem Cliente';
                    if (!custGroups.has(cust)) custGroups.set(cust, []);
                    custGroups.get(cust)!.push(o);
                  });

                  const renderOrderCard = (order: typeof productionOrders[0]) => {
                    const totalPairs = order.items.reduce((s, it) => s + (it.toProductionQty || 0), 0);
                    const orderLots = lots.filter(l => order.lotIds?.includes(l.id));
                    const sectorMap = new Map<string, { name: string; qty: number }>();
                    orderLots.forEach(l => {
                      const sid = l.route?.[l.currentSectorIndex] || '__none__';
                      const sec = sectors.find(s => s.id === sid);
                      const name = l.finishedAt ? 'Concluído' : (sec?.name || 'Sem Setor');
                      if (!sectorMap.has(name)) sectorMap.set(name, { name, qty: 0 });
                      sectorMap.get(name)!.qty += l.quantity || 0;
                    });
                    return (
                      <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-2">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-[12px] font-black text-indigo-600">PEDIDO {order.saleOrderNumber}</span>
                          <span className="text-[11px] font-black text-indigo-400 shrink-0">{totalPairs} {totalPairs === 1 ? 'par' : 'pares'}</span>
                        </div>
                        {order.items.map((item, i) => {
                          const p = products.find(pr => pr.id === item.productId);
                          const v = p?.variations?.find(va => va.id === item.variationId);
                          const itemGrade = Object.entries(item.sizes || {})
                            .filter(([, v]) => v.toProduction > 0)
                            .sort(([a], [b]) => Number(a) - Number(b));
                          return (
                            <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t border-slate-100' : ''}>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[12px] font-bold text-slate-700 leading-snug">
                                  {shareOpts.refs && p?.reference ? `${p.reference} · ` : ''}{p?.name || item.productName || '—'}{v?.colorName || item.variationName ? ` · ${v?.colorName || item.variationName}` : ''}
                                </p>
                                <span className="text-[11px] font-black text-slate-500 shrink-0">{item.toProductionQty} {item.toProductionQty === 1 ? 'par' : 'pares'}</span>
                              </div>
                              {shareOpts.grades && itemGrade.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {itemGrade.map(([sz, val]) => (
                                    <div key={sz} className="flex flex-col overflow-hidden rounded-lg" style={{ minWidth: 30 }}>
                                      <div className="text-center text-[9px] font-black px-1.5 py-0.5 leading-none" style={{ background: '#475569', color: '#f1f5f9' }}>{sz}</div>
                                      <div className="text-center text-[10px] font-black px-1.5 py-1 leading-none bg-slate-100 text-slate-900">{val.toProduction}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {shareOpts.dates && order.deliveryDate && (
                          <p className="text-[10px] text-slate-400 mt-2">Entrega: {new Date(order.deliveryDate).toLocaleDateString('pt-BR')}</p>
                        )}
                        {sectorMap.size > 0 && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                            {Array.from(sectorMap.values()).map(({ name, qty }) => (
                              <div key={name} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${name === 'Concluído' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                <span>{name}</span>
                                <span className="font-black">{qty}p</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return Array.from(custGroups.entries()).map(([cust, orders], ci) => {
                    const totalPairs = orders.reduce((s, o) => s + o.items.reduce((ss, it) => ss + (it.toProductionQty || 0), 0), 0);
                    return (
                      <div key={ci} className="mb-2">
                        {renderSectionHeader(cust, `${orders.length} pedido${orders.length !== 1 ? 's' : ''} · ${totalPairs} pares`)}
                        {orders.map(o => renderOrderCard(o))}
                      </div>
                    );
                  });
                }

                if (typeLabel === 'sector') {
                  const sMap = new Map<string, { name: string; lots: typeof preview }>();
                  preview.forEach(l => {
                    const sid = l.route?.[l.currentSectorIndex] || '__none__';
                    const sec = sectors.find(s => s.id === sid);
                    if (!sMap.has(sid)) sMap.set(sid, { name: sec?.name || 'Sem Setor', lots: [] });
                    sMap.get(sid)!.lots.push(l);
                  });
                  return Array.from(sMap.values()).map(({ name, lots: sl }, si) => (
                    <div key={si} className="mb-2">
                      {renderSectionHeader(name, `${sl.length} mapas · ${sl.reduce((s, l) => s + (l.quantity || 0), 0)} pares`)}
                      {sl.map(renderLotCard)}
                    </div>
                  ));
                }

                return <>{preview.map(renderLotCard)}</>;
              })()}

              {/* Rodapé simulado */}
              <div className="mt-2 bg-white rounded-2xl px-4 py-3 border border-slate-100 shadow-sm">
                <p className="text-[9px] text-slate-400 font-bold text-center">
                  PCP CENTRAL · {getShareData().length} mapas · {getShareData().reduce((s, l) => s + (l.quantity || 0), 0)} pares · {new Date().toLocaleString('pt-BR')}
                </p>
              </div>
            </div>

            {/* ── Barra de ações ── */}
            <div className="shrink-0 bg-white px-5 py-4 flex gap-3 border-t border-slate-100">
              <button
                type="button"
                disabled={!!shareGenerating}
                onClick={() => { setSharePreviewOpen(false); generatePCPPDF(); }}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
              >
                <FileText size={14} strokeWidth={2.5} /> Gerar PDF
              </button>
              <button
                type="button"
                disabled={!!shareGenerating}
                onClick={() => { setSharePreviewOpen(false); generatePCPImage(); }}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
              >
                <Share2 size={14} strokeWidth={2.5} /> Imagem
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}



      {/* Modal Detalhe / Apontamento */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedSourceItemKeys(new Set()); }}
        title={selectedLot ? `MAPA ${selectedLot.orderNumber}` : 'Detalhes do MAPA'}
        maxWidth="max-w-3xl"
      >
        {selectedLot && (() => {
          const product = products.find(p => p.id === selectedLot.productId);
          const variation = product?.variations.find(v => v.id === selectedLot.variationId);
          // Prévia consistente com o que a confirmação de avanço (e o avanço em si) vão
          // decidir: resolve o destino de cada modelo pelo SEU PRÓPRIO roteiro — não o
          // do "modelo principal" do mapa — e prevê para onde a maior parte das peças vai.
          const previewCurrentSectorId = (selectedLot.route || [])[selectedLot.currentSectorIndex] || '';
          const previewItems = buildLotAdvanceItems(selectedLot, previewCurrentSectorId);
          const previewDestSectorId = resolveLotDestination(previewItems);
          const previewIsFinished = previewDestSectorId === '';
          const nextSector = previewIsFinished ? undefined : sectors.find(s => s.id === previewDestSectorId);
          const isFinished = !!selectedLot.finishedAt;

          return (
            <div className="flex flex-col gap-6">
              {/* Header Info */}
              <div className={`rounded-[1.8rem] overflow-hidden border ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                {/* Top color bar */}
                <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400" />

                <div className={`p-5 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                  {/* Row 1: Lot# + actions */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                        <Factory size={16} className="text-white" />
                      </div>
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Mapa de Produção</p>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">MAPA {selectedLot.orderNumber}</h4>
                          {selectedLot.notes && (
                            <button
                              type="button"
                              onClick={() => setLotNotesPopup({ lot: selectedLot })}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all hover:opacity-80 ${isDarkMode ? 'bg-amber-900/30 border border-amber-700/40 text-amber-400' : 'bg-amber-50 border border-amber-200 text-amber-600'}`}
                              title="Ver observação do mapa"
                            >
                              <MessageSquare size={9} /> Obs.
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {selectedLot.prioridade && (
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${selectedLot.prioridade === 'URGENTE' ? 'bg-rose-500 text-white' :
                          selectedLot.prioridade === 'ALTA' ? 'bg-amber-400 text-white' :
                            'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}>{selectedLot.prioridade}</span>
                      )}
                    </div>
                  </div>

                  {/* Cor do Identificador do Mapa */}
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/40 flex-wrap">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cor do Identificador:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        '#7c3aed', '#4f46e5', '#2563eb', '#0891b2', '#0d9488',
                        '#059669', '#16a34a', '#ca8a04', '#ea580c', '#dc2626',
                        '#db2777', '#475569', '#0f172a'
                      ].map((c) => {
                        const isSelected = (selectedLot as any).metadata?.badgeColor === c || (!(selectedLot as any).metadata?.badgeColor && c === mapBadgeBg);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={async () => {
                              await firebaseService.updateDocument('productionLots', selectedLot.id, {
                                metadata: {
                                  ...(selectedLot as any).metadata,
                                  badgeColor: c,
                                  badgeTextColor: getContrastingColor(c)
                                }
                              });
                            }}
                            className="w-4 h-4 rounded-full border-2 transition-all hover:scale-110 active:scale-95"
                            style={{
                              backgroundColor: c,
                              borderColor: isSelected ? (isDarkMode ? '#ffffff' : '#000000') : 'transparent',
                              boxShadow: isSelected ? '0 0 0 2px rgba(99, 102, 241, 0.4)' : 'none'
                            }}
                            title={c}
                          />
                        );
                      })}
                      <div className="flex items-center gap-1.5 ml-1">
                        <input
                          type="color"
                          value={(selectedLot as any).metadata?.badgeColor || mapBadgeBg}
                          onChange={async (e) => {
                            const val = e.target.value;
                            await firebaseService.updateDocument('productionLots', selectedLot.id, {
                              metadata: {
                                ...(selectedLot as any).metadata,
                                badgeColor: val,
                                badgeTextColor: getContrastingColor(val)
                              }
                            });
                          }}
                          className="w-5 h-5 rounded-md cursor-pointer border border-slate-200 dark:border-slate-700 bg-transparent shrink-0"
                          title="Escolher cor personalizada"
                        />
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Outra</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Product + color */}
                  <div className="flex items-center gap-2 mb-4 min-w-0">
                    {(() => {
                      const groups: any[] = (selectedLot as any).metadata?.groups || [];
                      const seen = new Set<string>();
                      const uniqueProds: any[] = [];
                      groups.forEach((g: any) => {
                        const p = products.find(pr => pr.id === g.productId);
                        const name = p?.name || g.productName;
                        const label = p?.reference ? `${p.reference} ${name}` : name;
                        if (!seen.has(label)) { seen.add(label); uniqueProds.push({ ...g, label }); }
                      });
                      if (uniqueProds.length > 1) {
                        return (
                          <div className="flex flex-wrap items-center gap-1">
                            {uniqueProds.map((g: any, idx: number) => (
                              <span key={idx} className="inline-flex items-center max-w-[180px] px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight truncate bg-amber-400 text-white">
                                <span className="truncate">{g.label}</span>
                              </span>
                            ))}
                          </div>
                        );
                      }
                      return (
                        <>
                          {variation?.color && <div className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/10" style={{ backgroundColor: variation.color }} />}
                          <p className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase leading-tight truncate">
                            {product ? (product.reference ? `${product.reference} ${product.name}` : product.name) : '—'}
                          </p>
                          {variation?.colorName && <span className="text-[10px] font-bold text-slate-400 shrink-0">· {variation.colorName}</span>}
                        </>
                      );
                    })()}
                  </div>

                  {/* Row 3: Stats */}
                  {(() => {
                    const currentSectorId = selectedLot.route?.[selectedLot.currentSectorIndex];
                    const lotSI: any[] = (selectedLot as any).metadata?.sourceItems || [];
                    const movedOutQty = lotSI.reduce((acc, si: any) => {
                      const dest = getOrderEffectiveSector(selectedLot, si.orderId, si);
                      return dest !== currentSectorId ? acc + (si.qty || 0) : acc;
                    }, 0);
                    const currentQty = selectedLot.quantity - movedOutQty;
                    return (
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-50'}`}>
                          <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{currentQty}</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Pares</span>
                        </div>
                        {movedOutQty > 0 && (
                          <div className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl ${isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50'}`}>
                            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 leading-none">+{movedOutQty}</span>
                            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mt-0.5">Outros Setores</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Row 4: Size grid */}
                  {selectedLot.pairs && (() => {
                    const lotCurrentSectorId = selectedLot.route?.[selectedLot.currentSectorIndex];
                    const lotSI: any[] = (selectedLot as any).metadata?.sourceItems || [];
                    const deductBySize: Record<string, number> = {};
                    lotSI.forEach((si: any) => {
                      const destSector = getOrderEffectiveSector(selectedLot, si.orderId, si);
                      if (destSector === lotCurrentSectorId) return;
                      const ord = productionOrders.find(o => o.id === si.orderId);
                      if (!ord) return;
                      const ordItem: any = si.itemIdx !== undefined ? ord.items[si.itemIdx] : ord.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
                      if (!ordItem?.sizes) return;
                      Object.entries(ordItem.sizes).forEach(([sz, sData]: any) => {
                        const qty = Number(sData.toProduction) || 0;
                        if (qty > 0) deductBySize[sz] = (deductBySize[sz] || 0) + qty;
                      });
                    });
                    const adjustedPairs = Object.fromEntries(
                      Object.entries(selectedLot.pairs as Record<string, number>)
                        .map(([sz, q]) => [sz, Math.max(0, q - (deductBySize[sz] || 0))])
                        .filter(([, q]) => (q as number) > 0)
                    );
                    return (
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {Object.entries(adjustedPairs).sort(([a], [b]) => Number(a) - Number(b)).map(([size, qty]) => (
                          <div key={size} className={`flex flex-col items-center min-w-[36px] px-2 py-2 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                            <span className="text-[10px] font-black text-slate-400 leading-none mb-1">{size}</span>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 leading-none">{qty as number}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Linked Orders Section */}
              {((selectedLot as any).metadata?.sourceItems?.length > 0 || selectedLot.productionOrderId) && (() => {
                const allSourceItems: any[] = (selectedLot as any).metadata?.sourceItems || [
                  { orderId: selectedLot.productionOrderId, itemIdx: 0, qty: selectedLot.quantity }
                ];

                // OS ativas do lote no setor atual
                const currentSectorId = selectedLot.route && selectedLot.route[selectedLot.currentSectorIndex];
                // Setor sob o qual este mapa está sendo visualizado (coluna do Kanban
                // selecionada) — cada pedido aparece na lista principal apenas se estiver
                // efetivamente neste setor; os demais aparecem no card "Outros Setores".
                // Se o setor selecionado não tiver nenhum pedido pendente deste mapa
                // (ex.: aberto via QR Code, fora do contexto de uma coluna), cai para o
                // setor-âncora do mapa.
                const lotPendingGroups = getLotPendingSectorGroups(selectedLot);
                const viewSectorId = (selectedSectorId && lotPendingGroups.has(selectedSectorId))
                  ? selectedSectorId
                  : currentSectorId;

                // Mostra apenas os pedidos pendentes que estão, efetivamente, no setor
                // sendo visualizado (`viewSectorId`).
                const sourceItems = allSourceItems.filter((si: any) => {
                  const eff = getOrderEffectiveSector(selectedLot, si.orderId, si);
                  return eff !== ORDER_FINALIZED && eff === viewSectorId;
                });
                // Pedidos pendentes que estão em OUTROS setores (divergentes do setor visualizado)
                const otherSectorItems = allSourceItems.filter((si: any) => {
                  const eff = getOrderEffectiveSector(selectedLot, si.orderId, si);
                  return eff !== ORDER_FINALIZED && eff !== viewSectorId;
                });
                // Pedidos já finalizados (baixa de Expedição individual) — saíram do fluxo
                const finalizedOutItems = allSourceItems.filter((si: any) =>
                  getOrderEffectiveSector(selectedLot, si.orderId, si) === ORDER_FINALIZED
                );
                const lotOSList = serviceOrders.filter(so =>
                  (so.lotId === selectedLot.id || (so.lotIds && so.lotIds.includes(selectedLot.id))) &&
                  so.sectorId === currentSectorId &&
                  so.status === 'PENDING'
                );
                // OS pendentes (bloqueiam criação de nova OS)
                const getOrderOS = (orderId: string) => lotOSList.find(so =>
                  so.sourceOrderIds && so.sourceOrderIds.length > 0 && so.sourceOrderIds.some(id => id === orderId || id.startsWith(`${orderId}::`))
                );

                // OS concluída NO SETOR ATUAL, com o pedido explicitamente listado
                const completedOSForOrder = (orderId: string) => serviceOrders.find(so =>
                  so.sourceOrderIds &&
                  so.sourceOrderIds.length > 0 &&
                  so.sourceOrderIds.some(id => id === orderId || id.startsWith(`${orderId}::`)) &&
                  (so.lotId === selectedLot.id || so.lotIds?.includes(selectedLot.id)) &&
                  so.sectorId === currentSectorId &&
                  so.status === 'COMPLETED'
                );

                // Pedidos SEM OS pendente → podem criar nova OS
                const selectableItems = sourceItems.filter((si: any) => !getOrderOS(si.orderId));
                const selectedItemsList = sourceItems.filter((si: any, idx: number) =>
                  selectedSourceItemKeys.has(`${si.orderId}-${idx}`) && !getOrderOS(si.orderId)
                );

                // Pedidos COM OS concluída → podem ser movidos para outro setor
                const moveableItems = sourceItems.filter((si: any) => !!completedOSForOrder(si.orderId));
                const selectedMoveableItems = sourceItems.filter((si: any, idx: number) =>
                  selectedSourceItemKeys.has(`${si.orderId}-${idx}`) && !!completedOSForOrder(si.orderId)
                );
                const selectedMoveQty = selectedMoveableItems.reduce((acc: number, si: any) => acc + (si.qty || 0), 0);

                // Identidade per-item usada para gravar overrides em `orderSectors` —
                // pedidos que compartilham `orderId` (ex.: várias cores do mesmo pedido
                // de compra) são movidos individualmente, sem afetar os demais itens.
                const toMoveItem = (si: any) => ({ orderId: si.orderId, itemIdx: si.itemIdx, productId: si.productId, variationId: si.variationId });

                // Setores disponíveis: calcula a partir do setor atual dos pedidos (via orderSectors ou setor do lote)
                const getEffectiveFromSector = () => {
                  // Para pedidos adiantados, usa o setor onde os pedidos estão (via completedOSForOrder)
                  const completedOs = selectedMoveableItems.length > 0
                    ? serviceOrders.find(so =>
                      so.sourceOrderIds?.includes(selectedMoveableItems[0]?.si?.orderId) &&
                      (so.lotId === selectedLot.id || so.lotIds?.includes(selectedLot.id)) &&
                      so.status === 'COMPLETED'
                    )
                    : null;
                  if (completedOs?.sectorId) return completedOs.sectorId;
                  return currentSectorId || selectedLot.route?.[selectedLot.currentSectorIndex] || '';
                };
                const fromSectorId = getEffectiveFromSector();
                const fromSectorIdx = (selectedLot.route || []).indexOf(fromSectorId);
                // Só mostra o próximo setor imediato (não permite pular setores)
                const nextOnlySector = fromSectorIdx >= 0 && fromSectorIdx + 1 < (selectedLot.route || []).length
                  ? sectors.find(s => s.id === selectedLot.route![fromSectorIdx + 1])
                  : null;
                const availableSectors = nextOnlySector ? [nextOnlySector] : [];
                const selectedQty = selectedItemsList.reduce((acc: number, si: any) => acc + (si.qty || 0), 0);
                // "Avançar/Finalizar Pedido(s) Selecionados" só finaliza (baixa de
                // estoque/reserva) — por isso só aparece quando os pedidos selecionados
                // estão em um setor marcado como "Fim do Ciclo de Produção" (Cadastro de
                // Setores). Fora dele, "Mover Setor"/"Mudar Setor Manualmente" cobrem o avanço.
                const selectedEffectiveSectorIds = Array.from(new Set(selectedItemsList.map((si: any) => getOrderEffectiveSector(selectedLot, si.orderId, si))));
                const canFinalizeSelected = selectedEffectiveSectorIds.length > 0 && selectedEffectiveSectorIds.every(sid => {
                  const s = sectors.find(x => x.id === sid);
                  if (!s) return false;
                  const isLastInRoute = selectedLot.route && selectedLot.route[selectedLot.route.length - 1] === sid;
                  return !!s.isProductionCycleEnd ||
                    s.name.toUpperCase().includes('EXPEDIÇÃO') ||
                    s.name.toUpperCase().includes('EXPEDICAO') ||
                    isLastInRoute;
                });
                const allSelected = selectableItems.length > 0 && selectableItems.every((si: any) => {
                  const idx = sourceItems.indexOf(si);
                  return selectedSourceItemKeys.has(`${si.orderId}-${idx}`);
                });

                const computeSizeGrid = () => {
                  const hasItemIdx = sourceItems[0]?.itemIdx !== undefined;
                  if (!hasItemIdx || selectedItemsList[0]?.itemIdx === undefined) {
                    if (!selectedLot.pairs) return '';
                    return Object.entries(selectedLot.pairs)
                      .filter(([, q]) => (q as number) > 0)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([sz, q]) => `${sz}x${q}`)
                      .join('-');
                  }
                  const sizeTotals: Record<string, number> = {};
                  selectedItemsList.forEach((si: any) => {
                    const order = productionOrders.find(o => o.id === si.orderId);
                    if (!order) return;
                    const item = order.items[si.itemIdx];
                    if (!item?.sizes) return;
                    Object.entries(item.sizes).forEach(([size, data]: [string, any]) => {
                      sizeTotals[size] = (sizeTotals[size] || 0) + (data.toProduction || 0);
                    });
                  });
                  return Object.entries(sizeTotals)
                    .filter(([, q]) => q > 0)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([sz, q]) => `${sz}x${q}`)
                    .join('-');
                };

                // Cada pedido selecionado vira UMA etiqueta própria, com sua grade e
                // instruções por setor (não agrega tudo num único mapa).
                const computeBatchItems = (): { product: import('../types').Product; variation: import('../types').Variation; sizeGrid: string; lotId?: string; orderId?: string; itemIdx?: number }[] => {
                  const items: { product: import('../types').Product; variation: import('../types').Variation; sizeGrid: string; lotId?: string; orderId?: string; itemIdx?: number }[] = [];
                  selectedItemsList.forEach((si: any) => {
                    const order = productionOrders.find(o => o.id === si.orderId);
                    const orderItem: any = si.itemIdx !== undefined
                      ? order?.items[si.itemIdx]
                      : order?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
                    const resolvedProductId = si.productId || orderItem?.productId;
                    const resolvedVariationId = si.variationId || orderItem?.variationId;
                    const itemProduct = products.find(p => p.id === resolvedProductId);
                    const itemVariation = itemProduct?.variations.find(v => v.id === resolvedVariationId);
                    const batchSizesSource = si.fractionLabel ? (si.sizes || orderItem?.sizes) : (orderItem?.sizes || si.sizes);
                    if (!itemProduct || !itemVariation || !batchSizesSource) return;
                    const itemSizeGrid = Object.entries(batchSizesSource as Record<string, { toProduction: number }>)
                      .filter(([, s]) => s.toProduction > 0)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([sz, s]) => `${sz}x${s.toProduction}`)
                      .join('-');
                    if (!itemSizeGrid) return;
                    items.push({ product: itemProduct, variation: itemVariation, sizeGrid: itemSizeGrid, lotId: selectedLot.id, orderId: si.orderId, itemIdx: si.itemIdx });
                  });
                  return items;
                };

                return (
                  <div className="flex flex-col gap-3">
                    {/* Header with select-all */}
                    <div className={`flex items-center justify-between px-4 py-3 rounded-2xl ${isDarkMode ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                      <div className="flex items-center gap-2.5">
                        {selectableItems.length > 0 && (
                          <input
                            type="checkbox"
                            title="Selecionar todos os pedidos sem OS"
                            checked={allSelected}
                            onChange={() => {
                              if (allSelected) {
                                setSelectedSourceItemKeys(new Set());
                              } else {
                                const keys = new Set<string>();
                                sourceItems.forEach((si: any, idx: number) => {
                                  if (!getOrderOS(si.orderId)) keys.add(`${si.orderId}-${idx}`);
                                });
                                setSelectedSourceItemKeys(keys);
                              }
                            }}
                            className="w-4 h-4 accent-indigo-600 cursor-pointer rounded"
                          />
                        )}
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Pedidos Vinculados</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {finalizedOutItems.length > 0 && (
                          <span className="text-[8px] font-black text-violet-500 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded-full uppercase">✓ {finalizedOutItems.length} finalizados</span>
                        )}
                        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-full uppercase">{sourceItems.length} {sourceItems.length === 1 ? 'pedido' : 'pedidos'}</span>
                      </div>
                    </div>

                    {/* ── Filtros em acordeão ── */}
                    {(() => {
                      const uniqueModels = Array.from(new Set(sourceItems.map((si: any) => {
                        const ord = productionOrders.find(o => o.id === si.orderId);
                        const ordItem: any = si.itemIdx !== undefined ? ord?.items[si.itemIdx] : ord?.items.find((i: any) => i.productId === si.productId);
                        const prod = products.find(p => p.id === (si.productId || ordItem?.productId));
                        return prod?.name || ordItem?.productName || '';
                      }).filter(Boolean)));
                      const uniqueColors = Array.from(new Set(sourceItems.map((si: any) => {
                        const ord = productionOrders.find(o => o.id === si.orderId);
                        const ordItem: any = si.itemIdx !== undefined ? ord?.items[si.itemIdx] : ord?.items.find((i: any) => i.productId === si.productId);
                        const prod = products.find(p => p.id === (si.productId || ordItem?.productId));
                        const vari = prod?.variations.find(v => v.id === (si.variationId || ordItem?.variationId));
                        return vari?.colorName || ordItem?.variationName || '';
                      }).filter(Boolean)));
                      if (uniqueModels.length <= 1 && uniqueColors.length <= 1) return null;
                      const hasFilter = !!sourceFilterModel || !!sourceFilterColor;
                      const filterOpen = expandedSourceItems.has('__filter__');
                      return (
                        <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                          <button type="button"
                            onClick={() => {
                              const next = new Set(expandedSourceItems);
                              filterOpen ? next.delete('__filter__') : next.add('__filter__');
                              setExpandedSourceItems(next);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100'}`}
                          >
                            <div className="flex items-center gap-2">
                              <Filter size={12} className={hasFilter ? 'text-violet-600' : 'text-violet-500'} />
                              <span className={`text-[9px] font-black uppercase tracking-widest ${hasFilter ? 'text-violet-600' : 'text-violet-500'}`}>
                                Filtrar
                              </span>
                              {hasFilter && (
                                <span className="flex items-center gap-1">
                                  {sourceFilterModel && <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-indigo-600 text-white">{sourceFilterModel}</span>}
                                  {sourceFilterColor && <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-violet-600 text-white">{sourceFilterColor}</span>}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {hasFilter && (
                                <button type="button" onClick={e => { e.stopPropagation(); setSourceFilterModel(''); setSourceFilterColor(''); }}
                                  className="text-[7px] font-black text-rose-500 px-1.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/20 uppercase">
                                  Limpar
                                </button>
                              )}
                              <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`} />
                            </div>
                          </button>
                          {filterOpen && (
                            <div className={`px-3 pb-3 pt-2 flex flex-col gap-2 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50/80'}`}>
                              {uniqueModels.length > 1 && (
                                <div>
                                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Modelo</p>
                                  <div className="flex flex-wrap gap-1">
                                    <button type="button" onClick={() => setSourceFilterModel('')}
                                      className={`text-[8px] font-black px-2 py-1 rounded-full uppercase transition-all ${!sourceFilterModel ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-white border border-slate-200 text-slate-500'}`}>
                                      Todos
                                    </button>
                                    {uniqueModels.map(m => (
                                      <button key={m} type="button" onClick={() => setSourceFilterModel(sourceFilterModel === m ? '' : m)}
                                        className={`text-[8px] font-black px-2 py-1 rounded-full uppercase transition-all ${sourceFilterModel === m ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-white border border-slate-200 text-slate-500'}`}>
                                        {m}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {uniqueColors.length > 1 && (
                                <div>
                                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Cor</p>
                                  <div className="flex flex-wrap gap-1">
                                    <button type="button" onClick={() => setSourceFilterColor('')}
                                      className={`text-[8px] font-black px-2 py-1 rounded-full uppercase transition-all ${!sourceFilterColor ? 'bg-violet-600 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-white border border-slate-200 text-slate-500'}`}>
                                      Todas
                                    </button>
                                    {uniqueColors.map(c => (
                                      <button key={c} type="button" onClick={() => setSourceFilterColor(sourceFilterColor === c ? '' : c)}
                                        className={`text-[8px] font-black px-2 py-1 rounded-full uppercase transition-all ${sourceFilterColor === c ? 'bg-violet-600 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-white border border-slate-200 text-slate-500'}`}>
                                        {c}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Order cards */}
                    <div className="flex flex-col gap-2">
                      {sourceItems.filter((si: any) => {
                        if (!sourceFilterModel && !sourceFilterColor) return true;
                        const ord = productionOrders.find(o => o.id === si.orderId);
                        const ordItem: any = si.itemIdx !== undefined ? ord?.items[si.itemIdx] : ord?.items.find((i: any) => i.productId === si.productId);
                        const prod = products.find(p => p.id === (si.productId || ordItem?.productId));
                        const vari = prod?.variations.find(v => v.id === (si.variationId || ordItem?.variationId));
                        const pName = prod?.name || ordItem?.productName || '';
                        const cName = vari?.colorName || ordItem?.variationName || '';
                        if (sourceFilterModel && pName !== sourceFilterModel) return false;
                        if (sourceFilterColor && cName !== sourceFilterColor) return false;
                        return true;
                      }).map((si: any) => {
                        const idx = sourceItems.indexOf(si);
                        const order = productionOrders.find(o => o.id === si.orderId);
                        const orderItem: any = si.itemIdx !== undefined
                          ? order?.items[si.itemIdx]
                          : order?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
                        // Usa productId do si ou do orderItem como fallback
                        const resolvedProductId = si.productId || orderItem?.productId;
                        const resolvedVariationId = si.variationId || orderItem?.variationId;
                        const product = products.find(p => p.id === resolvedProductId);
                        const variation = product?.variations.find(v => v.id === resolvedVariationId);
                        const productName = product?.name || orderItem?.productName || '—';
                        const productRef = product?.reference || '';
                        const colorName = variation?.colorName || orderItem?.variationName || '';
                        const key = `${si.orderId}-${idx}`;
                        const isChecked = selectedSourceItemKeys.has(key);
                        const orderOS = getOrderOS(si.orderId);
                        const hasOS = !!orderOS;
                        const completedOS = completedOSForOrder(si.orderId);
                        const hasCompletedOS = !!completedOS;
                        const isExpanded = expandedSourceItems.has(key);

                        const sizeEntriesSource = si.fractionLabel ? (si.sizes || orderItem?.sizes) : (orderItem?.sizes || si.sizes);
                        const sizeEntries = sizeEntriesSource
                          ? Object.entries(sizeEntriesSource as Record<string, { toProduction: number }>)
                            .filter(([, s]) => s.toProduction > 0)
                            .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                          : [];

                        const orderOSSectorColor = sectors.find(s => s.id === orderOS?.sectorId)?.color || '#f59e0b';

                        return (
                          <div key={idx} id={`pedido-card-${key}`} className={`rounded-2xl border overflow-hidden transition-all ${hasOS
                            ? ''
                            : hasCompletedOS
                              ? (isDarkMode ? 'bg-emerald-950/20 border-emerald-700/40' : 'bg-emerald-50/60 border-emerald-200')
                              : isChecked
                                ? (isDarkMode ? 'bg-indigo-950/30 border-indigo-700' : 'bg-indigo-50 border-indigo-200')
                                : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')
                            }`}
                            style={hasOS ? { backgroundColor: hexToRgba(orderOSSectorColor, isDarkMode ? 0.14 : 0.1), borderColor: hexToRgba(orderOSSectorColor, isDarkMode ? 0.5 : 0.35) } : undefined}
                          >
                            {/* ── Cabeçalho (sempre visível) ── */}
                            <div className="p-3 flex items-center gap-3">
                              {hasOS ? (
                                <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: orderOSSectorColor }} title="OS pendente">
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                </div>
                              ) : hasCompletedOS ? (
                                <input
                                  type="checkbox"
                                  title="Selecionar para mover de setor"
                                  checked={isChecked}
                                  onChange={() => {
                                    const next = new Set(selectedSourceItemKeys);
                                    if (isChecked) next.delete(key); else next.add(key);
                                    setSelectedSourceItemKeys(next);
                                  }}
                                  className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                                />
                              ) : (
                                <input
                                  type="checkbox"
                                  title="Selecionar pedido"
                                  checked={isChecked}
                                  onChange={() => {
                                    const next = new Set(selectedSourceItemKeys);
                                    if (isChecked) next.delete(key); else next.add(key);
                                    setSelectedSourceItemKeys(next);
                                  }}
                                  className="w-4 h-4 accent-indigo-600 cursor-pointer shrink-0"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                {/* Linha 1: Referência + Nome + Cor + Setor */}
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider leading-none shrink-0" style={{ backgroundColor: productBadgeBg, color: productBadgeText, fontWeight: productBadgeBold ? 900 : 400, fontStyle: productBadgeItalic ? 'italic' : 'normal' }}>
                                      {`${productRef || productName}${colorName ? ` ${colorName}` : ''}`.trim()}
                                    </span>
                                    {(() => {
                                      const effSec = getOrderEffectiveSector(selectedLot, si.orderId, si);
                                      const secName = effSec === ORDER_FINALIZED
                                        ? 'Finalizado'
                                        : (sectors.find(s => s.id === effSec)?.name || effSec || '—');
                                      return hideSectorBadge ? null : (
                                        <span className="text-[9px] uppercase tracking-wider leading-none shrink-0" style={{ color: sectorBadgeColor, fontWeight: sectorBadgeBold ? 900 : 400, fontStyle: sectorBadgeItalic ? 'italic' : 'normal' }}>
                                          {secName}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <span
                                    className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest leading-none shrink-0"
                                    style={(() => {
                                      const bg = (selectedLot as any).metadata?.badgeColor || mapBadgeBg;
                                      const txt = (selectedLot as any).metadata?.badgeTextColor || getContrastingColor(bg);
                                      return {
                                        backgroundColor: bg,
                                        color: txt,
                                        boxShadow: `0 1px 2px ${bg}40`
                                      };
                                    })()}
                                  >
                                    MAPA{selectedLot.orderNumber}
                                  </span>
                                </div>
                                {/* Linha 2: Pedido */}
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {order?.saleOrderNumber || selectedLot.saleOrderNumber}</span>
                                  <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400">· {si.qty} {si.qty === 1 ? 'par' : 'pares'}</span>
                                  {hasOS && (
                                    <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">· {orderOS!.osNumber}</span>
                                  )}
                                </div>
                                {/* Linha 3: Origem do pedido — Cliente ou Estoque */}
                                {(() => {
                                  const custName = (order?.customerName || selectedLot.customerName || '').trim();
                                  if (!custName) return null;
                                  const isStock = custName.toUpperCase() === 'ESTOQUE';
                                  return (
                                    <p className="text-[8px] font-black text-slate-900 dark:text-white uppercase tracking-widest mt-0.5 truncate">
                                      {isStock ? 'Estoque' : `Cliente: ${custName}`}
                                    </p>
                                  );
                                })()}
                                {/* Indicador de vínculo quebrado: a venda deste pedido não referencia mais esta OP */}
                                {(() => {
                                  if (!order?.saleId) return null;
                                  const linkedSale = sales.find(s => s.id === order.saleId);
                                  if (!linkedSale || linkedSale.productionOrderId === order.id) return null;
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRepairSaleLink(order);
                                      }}
                                      className="mt-1 flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-all"
                                      title="A venda perdeu a referência para esta Ordem de Produção. Toque para reparar o vínculo."
                                    >
                                      <AlertTriangle size={9} />
                                      Reparar Vínculo com a Venda
                                    </button>
                                  );
                                })()}
                                {/* Indicador de roteiro divergente: este modelo segue um caminho diferente do mapa */}
                                {(() => {
                                  if (!hasCompletedOS) return null;
                                  const lotRoute = selectedLot.route || [];
                                  const currentLotSectorId = lotRoute[selectedLot.currentSectorIndex] || '';
                                  const resolved = resolveCorrectSectorForProduct(currentLotSectorId, product, sectors);
                                  const correctSectorId = resolved.isFinished ? '' : resolved.sectorId;
                                  const correctSectorName = resolved.isFinished ? 'CONCLUÍDO' : (sectors.find(s => s.id === correctSectorId)?.name || correctSectorId);
                                  const genericNextSectorId = lotRoute[selectedLot.currentSectorIndex + 1] || '';
                                  const assignedSectorId = getOrderEffectiveSector(selectedLot, si.orderId, si);
                                  if (!correctSectorId || correctSectorId === genericNextSectorId || assignedSectorId === correctSectorId) return null;
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRouteOrderToCorrectSector(selectedLot, si, correctSectorId, correctSectorName, productName);
                                      }}
                                      className="mt-1 flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all"
                                      title={`Este modelo segue um roteiro de produção diferente — direcionar para "${correctSectorName}"`}
                                    >
                                      <ArrowLeftRight size={9} />
                                      Direcionar p/ {correctSectorName}
                                    </button>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* ── Rodapé (Sempre visível) ── */}
                            <div className="px-3 pb-3 pt-1.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = new Set(expandedSourceItems);
                                  isExpanded ? next.delete(key) : next.add(key);
                                  setExpandedSourceItems(next);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-all text-[9px] font-black uppercase tracking-wider"
                              >
                                <ChevronDown size={12} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                {isExpanded ? 'Recolher' : 'Grade / Detalhes'}
                              </button>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {/* Botão Mudar Setor */}
                                <button
                                  type="button"
                                  title="Mudar o setor deste pedido"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMoveSectorModal({
                                      lotId: selectedLot.id,
                                      items: [toMoveItem(si)],
                                      qty: si.qty || 0,
                                      manual: true,
                                    });
                                    setMoveSectorTarget('');
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95"
                                >
                                  <ArrowLeftRight size={11} strokeWidth={3} /> Mudar Setor
                                </button>

                                {hasOS && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleEditOS(orderOS!)}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider transition-all active:scale-95"
                                    >
                                      <Edit2 size={11} />
                                      Editar OS
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteOS(orderOS!)}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-wider transition-all"
                                    >
                                      <Trash2 size={11} />
                                      Excluir OS
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* ── Linha exclusiva de Ação de Remoção ── */}
                            {!selectedLot.finishedAt && (
                              <div className="px-3 pb-3 pt-1.5 border-t border-slate-100 dark:border-slate-800/60 flex justify-end">
                                <button
                                  type="button"
                                  title="Retirar este pedido do mapa"
                                  onClick={() => handleRemoveItemFromLot(selectedLot, si.orderId)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-wider transition-all active:scale-95"
                                >
                                  <MinusCircle size={12} />
                                  Retirar do Mapa
                                </button>
                              </div>
                            )}

                            {/* ── Expanded: grade + info completa ── */}
                            {isExpanded && (
                              <div className={`px-3 pb-3 pt-1 border-t flex flex-col gap-3 ${isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/60'}`}>
                                {sizeEntries.length > 0 && (
                                  <div>
                                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Grade de Produção</p>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                      {sizeEntries.map(([size, s]) => (
                                        <div key={size} className={`flex flex-col items-center min-w-[38px] py-1.5 px-2 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                          <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 leading-none">{size}</p>
                                          <p className="text-[16px] font-black text-slate-900 dark:text-white leading-none mt-0.5">{s.toProduction}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                  {order?.customerName && (
                                    <div>
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cliente</p>
                                      <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">{order.customerName}</p>
                                    </div>
                                  )}
                                  {order?.deliveryDate && (
                                    <div>
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Entrega</p>
                                      <p className="text-[10px] font-black text-slate-700 dark:text-slate-300">{new Date(order.deliveryDate).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                                    <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{si.qty} pares</p>
                                  </div>
                                  {hasOS && (
                                    <div>
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">OS</p>
                                      <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">{orderOS!.osNumber} · {orderOS!.providerName}</p>
                                    </div>
                                  )}
                                </div>
                                {order?.notes && (
                                  <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl ${isDarkMode ? 'bg-amber-900/20 border border-amber-700/30' : 'bg-amber-50 border border-amber-200'}`}>
                                    <MessageSquare size={12} className="text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-0.5">Observação do Pedido</p>
                                      <p className={`text-[11px] font-bold leading-snug ${isDarkMode ? 'text-amber-200' : 'text-amber-800'}`}>{order.notes}</p>
                                    </div>
                                  </div>
                                )}
                                {variation?.sectorNotes && Object.keys(variation.sectorNotes).length > 0 && (() => {
                                  const secEntries = Object.entries(variation.sectorNotes)
                                    .map(([sid, notes]) => ({ sid, notes: (notes as SectorNote[]).filter(n => n.text) }))
                                    .filter(({ notes }) => notes.length > 0);
                                  if (secEntries.length === 0) return null;
                                  return (
                                    <div className={`flex flex-col gap-2 px-3 py-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-900/20 border border-indigo-700/30' : 'bg-indigo-50 border border-indigo-200'}`}>
                                      <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Instruções por Setor</p>
                                      {secEntries.map(({ sid, notes }) => {
                                        const sec = sectors.find(s => s.id === sid);
                                        if (!sec) return null;
                                        return (
                                          <div key={sid} className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5">
                                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sec.color || '#6366f1' }} />
                                              <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: sec.color || '#6366f1' }}>{sec.name}</span>
                                            </div>
                                            {notes.map(note => (
                                              <div key={note.id} className={`ml-3.5 pl-2 border-l-2 ${isDarkMode ? 'border-indigo-700/40' : 'border-indigo-200'}`}>
                                                {note.name && <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">{note.name}</p>}
                                                <p className={`text-[11px] font-bold leading-snug ${isDarkMode ? 'text-indigo-200' : 'text-indigo-800'}`}>{note.text}</p>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                                {product && variation && (
                                  <div className={`flex items-center justify-between gap-2 pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Etiqueta deste Pedido</p>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const itemSizeGrid = sizeEntries.map(([sz, s]) => `${sz}x${s.toProduction}`).join('-');
                                          setLabelModalProduct(product);
                                          setLabelModalLot(selectedLot);
                                          setLabelModalSizeGrid(itemSizeGrid);
                                          setLabelModalBatchItems([{ product, variation, sizeGrid: itemSizeGrid, lotId: selectedLot.id, orderId: si.orderId, itemIdx: si.itemIdx }]);
                                        }}
                                        className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-all active:scale-95"
                                      >
                                        <Printer size={11} />
                                        Imprimir / Compartilhar
                                      </button>
                                      <button
                                        type="button"
                                        title="Print Studio"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          sendPCPItemsToPrintStudio([buildPCPShareItem({ product, variation, si })], { isDarkMode });
                                        }}
                                        className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all active:scale-95 ${isDarkMode ? 'bg-cyan-900/30 text-cyan-300 hover:bg-cyan-900/50' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'}`}
                                      >
                                        <Printer size={11} />
                                        Print Studio
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {product && (
                                  <div className={`relative flex items-center justify-between gap-2 pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ficha do Pedido</p>
                                    <button
                                      type="button"
                                      disabled={isPedidoShareExporting}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSharePedidoPopupKey(sharePedidoPopupKey === key ? null : key);
                                      }}
                                      className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-600 text-white hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                      {isPedidoShareExporting && sharePedidoPopupKey === key
                                        ? <span className="animate-spin text-xs leading-none">⏳</span>
                                        : <Share2 size={11} />}
                                      Compartilhar Ficha
                                    </button>
                                    {sharePedidoPopupKey === key && (
                                      <>
                                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setSharePedidoPopupKey(null); }} />
                                        <div className={`absolute bottom-full right-0 mb-1.5 rounded-2xl shadow-2xl border z-50 p-2 flex flex-col gap-1 min-w-[190px] ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                          <p className={`text-[8px] font-black uppercase tracking-widest px-2 pb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Ficha do Pedido</p>
                                          <button type="button" onClick={(e) => { e.stopPropagation(); setSharePedidoPopupKey(null); handleSharePedidoSheet(selectedLot, product, variation, order, sizeEntries.map(([sz, s]) => [sz, s.toProduction] as [string, number]), si.qty, 'pdf'); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 text-left ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}>
                                            <Share2 size={11} className="shrink-0" /> PDF — Impressão
                                          </button>
                                          <button type="button" onClick={(e) => { e.stopPropagation(); setSharePedidoPopupKey(null); handleSharePedidoSheet(selectedLot, product, variation, order, sizeEntries.map(([sz, s]) => [sz, s.toProduction] as [string, number]), si.qty, 'jpg'); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 text-left ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}>
                                            <Share2 size={11} className="shrink-0" /> JPG — Imagem
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Pedidos do mapa que estão em OUTROS setores (não o setor visualizado) */}
                    {otherSectorItems.length > 0 && (
                      <div className={`rounded-2xl border p-3 flex flex-col gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Pedidos em Outros Setores</span>
                          <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/20 px-2.5 py-1 rounded-full uppercase">{otherSectorItems.length} {otherSectorItems.length === 1 ? 'pedido' : 'pedidos'}</span>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          {otherSectorItems.map((si: any, idx: number) => {
                            const order = productionOrders.find(o => o.id === si.orderId);
                            const orderItem: any = si.itemIdx !== undefined
                              ? order?.items[si.itemIdx]
                              : order?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
                            const resolvedProductId = si.productId || orderItem?.productId;
                            const resolvedVariationId = si.variationId || orderItem?.variationId;
                            const product = products.find(p => p.id === resolvedProductId);
                            const variation = product?.variations.find(v => v.id === resolvedVariationId);
                            const productName = product?.name || orderItem?.productName || '—';
                            const productRef = product?.reference || '';
                            const colorName = variation?.colorName || orderItem?.variationName || '';
                            const effSector = getOrderEffectiveSector(selectedLot, si.orderId, si);
                            const secName = sectors.find(s => s.id === effSector)?.name || effSector;

                            const key = `${si.orderId}-${idx}-other`;
                            const isExpanded = expandedSourceItems.has(key);
                            const otherSizesSource = si.fractionLabel ? (si.sizes || orderItem?.sizes) : (orderItem?.sizes || si.sizes);
                            const sizeEntries = otherSizesSource
                              ? Object.entries(otherSizesSource as Record<string, { toProduction: number }>)
                                .filter(([, s]) => s.toProduction > 0)
                                .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                              : [];

                            return (
                              <div key={`${si.orderId}-${idx}`} className={`rounded-2xl border overflow-hidden transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                                {/* ── Cabeçalho (sempre visível) ── */}
                                <div className="p-3 flex items-center gap-3">
                                  <div className="w-1" />
                                  <div className="min-w-0 flex-1">
                                    {/* Linha 1: Referência + Nome + Cor + Setor */}
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider leading-none shrink-0" style={{ backgroundColor: productBadgeBg, color: productBadgeText, fontWeight: productBadgeBold ? 900 : 400, fontStyle: productBadgeItalic ? 'italic' : 'normal' }}>
                                          {`${productRef || productName}${colorName ? ` ${colorName}` : ''}`.trim()}
                                        </span>
                                        {!hideSectorBadge && (
                                          <span className="text-[9px] uppercase tracking-wider leading-none shrink-0" style={{ color: sectorBadgeColor, fontWeight: sectorBadgeBold ? 900 : 400, fontStyle: sectorBadgeItalic ? 'italic' : 'normal' }}>
                                            {secName}
                                          </span>
                                        )}
                                      </div>
                                      <span
                                        className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest leading-none shrink-0"
                                        style={(() => {
                                          const bg = (selectedLot as any).metadata?.badgeColor || mapBadgeBg;
                                          const txt = (selectedLot as any).metadata?.badgeTextColor || getContrastingColor(bg);
                                          return {
                                            backgroundColor: bg,
                                            color: txt,
                                            boxShadow: `0 1px 2px ${bg}40`
                                          };
                                        })()}
                                      >
                                        MAPA{selectedLot.orderNumber}
                                      </span>
                                    </div>
                                    {/* Linha 2: Pedido */}
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {order?.saleOrderNumber || selectedLot.saleOrderNumber}</span>
                                      <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400">· {si.qty} {si.qty === 1 ? 'par' : 'pares'}</span>
                                    </div>
                                    {/* Linha 3: Origem do pedido — Cliente ou Estoque */}
                                    {(() => {
                                      const custName = (order?.customerName || selectedLot.customerName || '').trim();
                                      if (!custName) return null;
                                      const isStock = custName.toUpperCase() === 'ESTOQUE';
                                      return (
                                        <p className="text-[8px] font-black text-slate-900 dark:text-white uppercase tracking-widest mt-0.5 truncate">
                                          {isStock ? 'Estoque' : `Cliente: ${custName}`}
                                        </p>
                                      );
                                    })()}
                                  </div>
                                </div>

                                {/* ── Rodapé (Sempre visível) ── */}
                                <div className="px-3 pb-3 pt-1.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = new Set(expandedSourceItems);
                                      isExpanded ? next.delete(key) : next.add(key);
                                      setExpandedSourceItems(next);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-all text-[9px] font-black uppercase tracking-wider"
                                  >
                                    <ChevronDown size={12} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                    {isExpanded ? 'Recolher' : 'Grade / Detalhes'}
                                  </button>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      title="Mudar o setor deste pedido"
                                      onClick={() => {
                                        setMoveSectorModal({
                                          lotId: selectedLot.id,
                                          items: [toMoveItem(si)],
                                          qty: si.qty || 0,
                                          manual: true,
                                        });
                                        setMoveSectorTarget('');
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95"
                                    >
                                      <ArrowLeftRight size={11} strokeWidth={3} /> Mudar Setor
                                    </button>
                                  </div>
                                </div>

                                {/* ── Linha exclusiva de Ação de Remoção ── */}
                                {!selectedLot.finishedAt && (
                                  <div className="px-3 pb-3 pt-1.5 border-t border-slate-100 dark:border-slate-800/60 flex justify-end">
                                    <button
                                      type="button"
                                      title="Retirar este pedido do mapa"
                                      onClick={() => handleRemoveItemFromLot(selectedLot, si.orderId)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-wider transition-all active:scale-95"
                                    >
                                      <MinusCircle size={12} />
                                      Retirar do Mapa
                                    </button>
                                  </div>
                                )}

                                {/* ── Expanded: grade + info completa ── */}
                                {isExpanded && (
                                  <div className={`px-3 pb-3 pt-1 border-t flex flex-col gap-3 ${isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/60'}`}>
                                    {sizeEntries.length > 0 && (
                                      <div>
                                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Grade de Produção</p>
                                        <div className="flex flex-wrap gap-2 justify-center">
                                          {sizeEntries.map(([size, s]) => (
                                            <div key={size} className={`flex flex-col items-center min-w-[38px] py-1.5 px-2 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                              <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 leading-none">{size}</p>
                                              <p className="text-[16px] font-black text-slate-900 dark:text-white leading-none mt-0.5">{s.toProduction}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                      {order?.customerName && (
                                        <div>
                                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cliente</p>
                                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">{order.customerName}</p>
                                        </div>
                                      )}
                                      {order?.deliveryDate && (
                                        <div>
                                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Entrega</p>
                                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-300">{new Date(order.deliveryDate).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                      )}
                                      <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{si.qty} pares</p>
                                      </div>
                                    </div>
                                    {order?.notes && (
                                      <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl ${isDarkMode ? 'bg-amber-900/20 border border-amber-700/30' : 'bg-amber-50 border border-amber-200'}`}>
                                        <MessageSquare size={12} className="text-amber-500 shrink-0 mt-0.5" />
                                        <div>
                                          <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-0.5">Observação do Pedido</p>
                                          <p className={`text-[11px] font-bold leading-snug ${isDarkMode ? 'text-amber-200' : 'text-amber-800'}`}>{order.notes}</p>
                                        </div>
                                      </div>
                                    )}
                                    {variation?.sectorNotes && Object.keys(variation.sectorNotes).length > 0 && (() => {
                                      const secEntries = Object.entries(variation.sectorNotes)
                                        .map(([sid, notes]) => ({ sid, notes: (notes as SectorNote[]).filter(n => n.text) }))
                                        .filter(({ notes }) => notes.length > 0);
                                      if (secEntries.length === 0) return null;
                                      return (
                                        <div className={`flex flex-col gap-2 px-3 py-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-900/20 border border-indigo-700/30' : 'bg-indigo-50 border border-indigo-200'}`}>
                                          <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Instruções por Setor</p>
                                          {secEntries.map(({ sid, notes }) => {
                                            const sec = sectors.find(s => s.id === sid);
                                            if (!sec) return null;
                                            return (
                                              <div key={sid} className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1.5">
                                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sec.color || '#6366f1' }} />
                                                  <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: sec.color || '#6366f1' }}>{sec.name}</span>
                                                </div>
                                                {notes.map(note => (
                                                  <div key={note.id} className={`ml-3.5 pl-2 border-l-2 ${isDarkMode ? 'border-indigo-700/40' : 'border-indigo-200'}`}>
                                                    {note.name && <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">{note.name}</p>}
                                                    <p className={`text-[11px] font-bold leading-snug ${isDarkMode ? 'text-indigo-200' : 'text-indigo-800'}`}>{note.text}</p>
                                                  </div>
                                                ))}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Action bar — shown when ≥1 order is selected */}
                    {selectedQty > 0 && (
                      <div className={`p-4 rounded-2xl border-2 flex flex-col gap-3 ${isDarkMode ? 'bg-indigo-950/20 border-indigo-700/50' : 'bg-indigo-50 border-indigo-200'}`}>
                        <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${isDarkMode ? 'bg-indigo-900/30 border-indigo-700/40' : 'bg-white border-indigo-200'}`}>
                          <div className="w-7 h-7 rounded-lg bg-indigo-500 text-white flex items-center justify-center shrink-0">
                            <Info size={14} />
                          </div>
                          <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 leading-snug">
                            As ações abaixo afetam apenas os <strong className="font-black">pedidos selecionados</strong>, não o mapa inteiro.
                          </p>
                        </div>
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                              <Tag size={13} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase leading-none">
                                {selectedItemsList.length} {selectedItemsList.length === 1 ? 'pedido' : 'pedidos'} selecionado{selectedItemsList.length > 1 ? 's' : ''}
                              </p>
                              <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">{selectedQty} pares</p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 w-full">
                            <button
                              type="button"
                              onClick={() => {
                                const items = computeBatchItems();
                                if (items.length > 0) {
                                  setLabelModalProduct(items[0].product);
                                  setLabelModalLot(null);
                                  setLabelModalSizeGrid(items[0].sizeGrid);
                                  setLabelModalBatchItems(items.length > 1 ? items : [items[0]]);
                                } else {
                                  if (!product) return;
                                  setLabelModalProduct(product);
                                  setLabelModalLot(null);
                                  setLabelModalSizeGrid(computeSizeGrid());
                                  setLabelModalBatchItems(undefined);
                                }
                              }}
                              className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                              <Tag size={12} strokeWidth={3} /> Etiqueta
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPendingOsSourceOrderIds(selectedItemsList.map((si: any) => `${selectedLot.id}::${si.orderId}::${sourceItems.indexOf(si)}`));
                                handleOpenOSModal({ ...selectedLot, quantity: selectedQty } as any);
                              }}
                              className={`w-full px-4 py-2.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${isDarkMode ? 'bg-slate-600 hover:bg-slate-500' : 'bg-slate-700 hover:bg-slate-800'}`}
                            >
                              <Hammer size={12} strokeWidth={3} /> Emitir OS
                            </button>
                            {(() => {
                              const selectedEffectiveSectors = Array.from(new Set(selectedItemsList.map((si: any) => getOrderEffectiveSector(selectedLot, si.orderId, si))));
                              const moveFromSectorId = selectedEffectiveSectors.length === 1 ? selectedEffectiveSectors[0] : null;
                              const moveFromIdx = moveFromSectorId ? (selectedLot.route || []).indexOf(moveFromSectorId) : -1;
                              const moveNextSector = moveFromIdx >= 0 && moveFromIdx + 1 < (selectedLot.route || []).length
                                ? sectors.find(s => s.id === selectedLot.route![moveFromIdx + 1])
                                : null;
                              if (selectedEffectiveSectors.length === 1 && !moveNextSector) return null;
                              const mixedSectors = selectedEffectiveSectors.length > 1;
                              return (
                                <button
                                  type="button"
                                  disabled={mixedSectors}
                                  title={mixedSectors
                                    ? 'Os pedidos selecionados estão em setores diferentes — selecione pedidos do mesmo setor para mover juntos.'
                                    : `Mover pedido(s) selecionado(s) para ${moveNextSector?.name}, sem mover o mapa inteiro`}
                                  onClick={() => {
                                    if (mixedSectors || !moveNextSector || !moveFromSectorId) return;
                                    setMoveSectorModal({
                                      lotId: selectedLot.id,
                                      items: selectedItemsList.map(toMoveItem),
                                      qty: selectedQty,
                                      fromSectorId: moveFromSectorId,
                                    });
                                    setMoveSectorTarget(moveNextSector.id);
                                  }}
                                  className={`w-full px-4 py-2.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${mixedSectors ? 'bg-slate-400 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                >
                                  <ChevronRight size={12} strokeWidth={3} /> Mover Setor
                                </button>
                              );
                            })()}
                            <button
                              type="button"
                              title="Escolher livremente o setor de destino dos pedidos selecionados, sem seguir o roteiro padrão"
                              onClick={() => {
                                setMoveSectorModal({
                                  lotId: selectedLot.id,
                                  items: selectedItemsList.map(toMoveItem),
                                  qty: selectedQty,
                                  manual: true,
                                });
                                setMoveSectorTarget('');
                              }}
                              className="w-full px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                              <ArrowLeftRight size={12} strokeWidth={3} /> Mudar Setor
                            </button>
                            {canFinalizeSelected && (
                              <button
                                type="button"
                                onClick={() => {
                                  const resolved: LotAdvanceItem[] = selectedItemsList.map((si: any, idx: number) => {
                                    const order = productionOrders.find(o => o.id === si.orderId);
                                    const orderItem: any = si.itemIdx !== undefined
                                      ? order?.items[si.itemIdx]
                                      : order?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
                                    const resolvedProductId = si.productId || orderItem?.productId;
                                    const itemProduct = products.find(p => p.id === resolvedProductId);
                                    const effSector = getOrderEffectiveSector(selectedLot, si.orderId, si);
                                    const resolved = resolveCorrectSectorForProduct(effSector, itemProduct, sectors);
                                    const chosenSectorId = resolved.isFinished ? '' : resolved.sectorId;
                                    return {
                                      key: `${si.orderId}-${idx}`,
                                      orderId: si.orderId,
                                      itemIdx: si.itemIdx,
                                      variationId: si.variationId,
                                      productId: resolvedProductId,
                                      productName: itemProduct?.name || orderItem?.productName || '—',
                                      productReference: itemProduct?.reference || '',
                                      colorName: '',
                                      qty: si.qty || 0,
                                      suggestedSectorId: chosenSectorId,
                                      suggestedSectorName: resolved.isFinished ? 'CONCLUÍDO' : (sectors.find(s => s.id === resolved.sectorId)?.name || ''),
                                      skippedSectorNames: resolved.skippedSectorNames,
                                      chosenSectorId,
                                      lotId: selectedLot.id,
                                      saleType: orderItem?.saleType,
                                      siIdx: sourceItems.indexOf(si),
                                    };
                                  });
                                  const toFinalize = resolved.filter(it => it.chosenSectorId === '');
                                  const toMove = resolved.filter(it => it.chosenSectorId !== '');
                                  const lines: string[] = [`Avançar/finalizar ${resolved.length} pedido(s) selecionado(s)?`];
                                  const stockInfo: Record<string, { destino: string; currentQty: number; addQty: number; projectedQty: number; unit: string }> = {};
                                  const soleInfo: {
                                    moldName: string;
                                    colorName: string;
                                    rows: { size: string; before: number; deducted: number; after: number }[];
                                    contributions: { orderLabel: string; lotNumber: string; qty: number }[]
                                  }[] = [];
                                  if (toFinalize.length > 0) {
                                    const { customerItems, stockItems } = classifyExpedicaoOrders(toFinalize.map(it => ({ orderId: it.orderId, itemIdx: it.itemIdx, fractionLabel: it.fractionLabel })));
                                    lines.push('');
                                    if (customerItems.length > 0) lines.push(`📦 ${customerItems.length} pedido(s) → RESERVA PARA O CLIENTE (aguardando baixa manual na Venda)`);
                                    if (stockItems.length > 0) lines.push(`🏭 ${stockItems.length} pedido(s) → ENTRADA EM ESTOQUE (+ baixa de solados)`);
                                    toFinalize.forEach(it => {
                                      const isStock = stockItems.some(si => si.orderId === it.orderId && si.itemIdx === it.itemIdx && (si.fractionLabel || undefined) === (it.fractionLabel || undefined));
                                      const order = productionOrders.find(o => o.id === it.orderId);
                                      const customerName = order?.customerName || selectedLot.customerName;
                                      const info = computeStockProjection(it, { isStock, customerName });
                                      if (info) stockInfo[it.key] = info;
                                    });

                                    // Pré-visualização da baixa em soleStock que `applyExpedicaoStockUpdate`
                                    // executará: agrega o consumo de pares por molde/cor entre todos os
                                    // pedidos finalizados e mostra estoque atual → estoque após a baixa.
                                    const consumptionByKey = new Map<string, { moldId: string; colorId: string; gradeQuantities: Record<string, number>; contributions: { orderLabel: string; lotNumber: string; qty: number }[] }>();
                                    toFinalize.forEach(it => {
                                      // Busca o sourceItem bruto (tem si.sizes com a grade da fração/lote)
                                      // em vez de passar diretamente o LotAdvanceItem (que não tem .sizes
                                      // e faria resolveSourceItem cair no ordItem.sizes do pedido inteiro).
                                      const rawSI = it.siIdx !== undefined
                                        ? (selectedLot as any).metadata?.sourceItems?.[it.siIdx]
                                        : undefined;
                                      const resolvedSI = resolveSourceItem(rawSI || it);
                                      if (!resolvedSI || resolvedSI.totalQty <= 0) return;
                                      const { prod, vari, pairs, totalQty } = resolvedSI;
                                      const consumption = resolveSoleConsumption(prod, vari, pairs, totalQty, soleStock);
                                      if (!consumption) return;
                                      const key = `${consumption.moldId}_${consumption.colorId || 'default'}`;

                                      let existing = consumptionByKey.get(key);
                                      if (!existing) {
                                        existing = {
                                          moldId: consumption.moldId,
                                          colorId: consumption.colorId,
                                          gradeQuantities: {},
                                          contributions: []
                                        };
                                        consumptionByKey.set(key, existing);
                                      }

                                      Object.entries(consumption.gradeQuantities).forEach(([gradeKey, qty]) => {
                                        existing!.gradeQuantities[gradeKey] = (existing!.gradeQuantities[gradeKey] || 0) + qty;
                                      });

                                      existing.contributions.push({
                                        orderLabel: `${prod?.name || '—'} ${vari?.colorName || ''}`,
                                        lotNumber: selectedLot.orderNumber,
                                        qty: it.qty
                                      });
                                    });
                                    consumptionByKey.forEach(({ moldId, colorId, gradeQuantities, contributions }) => {
                                      const entry = soleStock.find(s => String(s.moldId).trim() === moldId && String(s.colorId || '').trim() === colorId);
                                      const mold = productionConfigs.find(c => c.id === moldId);
                                      const color = colors.find(c => c.id === colorId);

                                      const rows = Object.entries(gradeQuantities)
                                        .filter(([k]) => k !== 'pesagem' && k !== 'total')
                                        .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                                        .map(([size, qty]) => ({
                                          size,
                                          before: entry?.stock[size] || 0,
                                          deducted: Number(qty) || 0,
                                          after: (entry?.stock[size] || 0) - (Number(qty) || 0)
                                        }));
                                      soleInfo.push({
                                        moldName: entry?.moldName || mold?.name || '',
                                        colorName: entry?.colorName || color?.name || '',
                                        rows,
                                        contributions
                                      });
                                    });
                                  }
                                  if (toMove.length > 0) {
                                    const bySector = new Map<string, number>();
                                    toMove.forEach(it => bySector.set(it.suggestedSectorName, (bySector.get(it.suggestedSectorName) || 0) + it.qty));
                                    lines.push('');
                                    bySector.forEach((qty, name) => lines.push(`➡ ${qty} par(es) → ${name}`));
                                  }
                                  setFinalizeSelectedConfirm({ lot: selectedLot, items: resolved, lines, stockInfo, soleInfo });
                                }}
                                className="w-full px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                              >
                                <CheckCircle2 size={12} strokeWidth={3} /> Avançar/Finalizar Pedido(s) Selecionados
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Botão Mover para Setor — apenas pedidos com OS concluída */}
                    {selectedMoveQty > 0 && availableSectors.length > 0 && (
                      <div className={`p-4 rounded-2xl border-2 flex flex-col gap-3 ${isDarkMode ? 'bg-emerald-950/20 border-emerald-700/50' : 'bg-emerald-50 border-emerald-200'}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <ChevronRight size={14} strokeWidth={3} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase">
                              {selectedMoveableItems.length} pedido(s) com OS concluída — {selectedMoveQty} pares
                            </p>
                            <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">Prontos para avançar de setor</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMoveSectorModal({
                              lotId: selectedLot.id,
                              items: selectedMoveableItems.map(toMoveItem),
                              qty: selectedMoveQty,
                              fromSectorId,
                            });
                            setMoveSectorTarget(availableSectors[0]?.id || '');
                          }}
                          className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                          <ChevronRight size={13} strokeWidth={3} /> Mover para Próximo Setor
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {!isFinished && (() => {
                const currentSectorId = selectedLot.route && selectedLot.route[selectedLot.currentSectorIndex];
                const activeOSList = serviceOrders.filter(so =>
                  (so.lotId === selectedLot.id || (so.lotIds && so.lotIds.includes(selectedLot.id))) &&
                  so.sectorId === currentSectorId &&
                  so.status === 'PENDING'
                );
                const hasActiveOS = activeOSList.length > 0;

                return (
                  <div className="flex flex-col gap-6">
                    {/* Lista de OS ativas */}
                    {hasActiveOS && (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between px-1">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ordens de Serviço Ativas</h4>
                          <span className="text-[10px] font-black text-indigo-500 uppercase">{activeOSList.length} {activeOSList.length === 1 ? 'OS' : 'OS'}</span>
                        </div>
                        {activeOSList.map((os) => {
                          const osExpanded = expandedOSIds.has(os.id);
                          // Parse size grid: "38x22-39x44-40x66" → [{sz,qty}]
                          const sizeEntries = os.sizeGrid
                            ? os.sizeGrid.split('-').map(tok => {
                              const [sz, q] = tok.split('x');
                              return { sz: sz || tok, qty: q ? parseInt(q) : null };
                            }).filter(e => e.sz)
                            : [];
                          // Source orders for this OS
                          const osSourceOrders = (os.sourceOrderIds || [])
                            .map(oid => productionOrders.find(o => o.id === oid))
                            .filter(Boolean) as any[];
                          // Lots covered
                          const osLots = (os.lotIds || [os.lotId])
                            .map(lid => lots.find(l => l.id === lid))
                            .filter(Boolean) as any[];

                          return (
                            <div key={os.id} className="rounded-[2rem] bg-indigo-50/50 dark:bg-indigo-950/20 border-2 border-indigo-500/20 overflow-hidden flex flex-col">
                              <div className="p-6 flex flex-col gap-4">
                                {/* Header */}
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                                    <Hammer size={18} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h5 className="text-xs font-black text-indigo-950 dark:text-indigo-200 leading-none mb-1">{os.osNumber}</h5>
                                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest leading-none truncate">
                                      {os.type === 'INTERNAL' ? 'Interna' : 'Terceirizada'} • {os.providerName}
                                    </p>
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={() => {
                                    const osLotIds = os.lotIds || [os.lotId];
                                    const osSourceOrderIds = os.sourceOrderIds || [];
                                    const osSourceItemKeys = os.sourceItemKeys || [];

                                    const mappedFichas: any[] = [];
                                    osLotIds.forEach(lId => {
                                      const l = lots.find(lot => lot.id === lId);
                                      if (!l) return;
                                      const sourceItems: any[] = (l as any).metadata?.sourceItems || [];
                                      sourceItems.forEach((si, siIdx) => {
                                        const itemKey = `${l.id}::${si.orderId}::${siIdx}`;
                                        const isIncluded = osSourceItemKeys.includes(itemKey) ||
                                          (osSourceItemKeys.length === 0 && osSourceOrderIds.includes(si.orderId));

                                        if (isIncluded) {
                                          const prod = products.find(p => p.id === si.productId);
                                          const vari = prod?.variations.find((v: any) => v.id === si.variationId);
                                          const ord = productionOrders.find(o => o.id === si.orderId);
                                          const ordItem: any = si.itemIdx !== undefined ? ord?.items[si.itemIdx] : ord?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);

                                          mappedFichas.push({
                                            lot: l,
                                            si,
                                            siIdx,
                                            product: prod,
                                            variation: vari,
                                            orderItem: ordItem,
                                            order: ord,
                                            coveringOS: os
                                          });
                                        }
                                      });
                                    });
                                    setShareModal({ isOpen: true, format: 'jpg', selectedItems: mappedFichas });
                                  }} className="flex-1 text-[11px] font-black uppercase text-orange-600 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 py-2.5 rounded-xl transition-all text-center">Compartilhar</button>
                                  <button type="button" onClick={() => {
                                    const printNextSectorName = selectedLot ? computeOSAdvanceOutcome(os, selectedLot, products, sectors).nextSectorName : 'CONCLUÍDO';
                                    setPrintOSData({ os, nextSectorName: printNextSectorName });
                                    setIsPrintOSModalOpen(true);
                                  }} className="flex-1 text-[11px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 py-2.5 rounded-xl transition-all text-center">Imprimir</button>
                                  <button type="button" onClick={() => handleEditOS(os)} className="flex-1 text-[11px] font-black uppercase text-white bg-amber-400 hover:bg-amber-500 py-2.5 rounded-xl transition-all text-center active:scale-95">Editar</button>
                                  <button type="button" onClick={() => handleDeleteOS(os)} className="flex-1 text-[11px] font-black uppercase text-rose-500 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 py-2.5 rounded-xl transition-all text-center">Excluir</button>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-3 gap-3 bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-950 shadow-sm">
                                  <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Pares</span>
                                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">{os.quantity} prs</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Vlr / Par</span>
                                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">R$ {os.valuePerPair.toFixed(2)}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total OS</span>
                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">R$ {os.totalValue.toFixed(2)}</span>
                                  </div>
                                </div>

                                {os.notes && (
                                  <div className="p-3 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-xl border border-indigo-100/50 dark:border-indigo-950/50 text-[10px] font-medium italic text-indigo-900/80 dark:text-indigo-300">
                                    Obs: {os.notes}
                                  </div>
                                )}

                                {/* Ver Itens toggle */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = new Set(expandedOSIds);
                                    osExpanded ? next.delete(os.id) : next.add(os.id);
                                    setExpandedOSIds(next);
                                  }}
                                  className={`w-full py-3 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${osExpanded
                                    ? (isDarkMode ? 'border-violet-700/50 bg-violet-900/20 text-violet-400' : 'border-violet-200 bg-violet-50 text-violet-600')
                                    : (isDarkMode ? 'border-slate-700 bg-slate-800/50 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500')
                                    }`}
                                >
                                  <List size={13} />
                                  {osExpanded ? 'Ocultar Itens' : 'Ver Itens da O.S'}
                                  <ChevronDown size={13} className={`transition-transform duration-200 ${osExpanded ? 'rotate-180' : ''}`} />
                                </button>

                                <button type="button" onClick={() => handleCompleteOS(os)}
                                  className="w-full py-5 rounded-[2rem] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95">
                                  <CheckSquare size={18} /> Concluir OS & Baixar Setor
                                </button>
                              </div>

                              {/* ── Painel expandido: fichas + grade ── */}
                              {osExpanded && (
                                <div className={`px-4 pb-5 pt-3 border-t flex flex-col gap-3 ${isDarkMode ? 'border-indigo-900/50 bg-indigo-950/30' : 'border-indigo-100 bg-white/60'}`}>
                                  {/* Mapas cobertos */}
                                  {osLots.length > 0 && (
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Mapa:</span>
                                      {osLots.map((l: any) => (
                                        <span key={l.id} className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{l.orderNumber}</span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Fichas selecionadas — uma linha por produto+variação */}
                                  {(() => {
                                    const itemMap: Record<string, { productId: string; variationId: string; sizeQtys: Record<string, number>; totalQty: number; orderNums: string[] }> = {};

                                    // Usa metadata.sourceItems do lote para iterar exatamente os itens incluídos (sem duplicatas)
                                    const lotSI: any[] = (selectedLot as any).metadata?.sourceItems || [];
                                    // Filtra pelos orderIds desta OS (set para lookup rápido)
                                    const osOrderIdSet = new Set(os.sourceOrderIds || []);
                                    const relevantSI = osOrderIdSet.size > 0
                                      ? lotSI.filter((si: any) => osOrderIdSet.has(si.orderId))
                                      : lotSI;

                                    if (relevantSI.length > 0) {
                                      relevantSI.forEach((si: any) => {
                                        const ord = productionOrders.find(o => o.id === si.orderId);
                                        if (!ord) return;
                                        const ordItem: any = si.itemIdx !== undefined
                                          ? ord.items[si.itemIdx]
                                          : ord.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
                                        if (!ordItem) return;
                                        const k = `${si.productId}-${si.variationId}`;
                                        if (!itemMap[k]) itemMap[k] = { productId: si.productId, variationId: si.variationId, sizeQtys: {}, totalQty: 0, orderNums: [] };
                                        Object.entries(ordItem.sizes || {}).forEach(([sz, s]: any) => {
                                          const qty = Number(s.toProduction) || 0;
                                          if (qty > 0) {
                                            itemMap[k].sizeQtys[sz] = (itemMap[k].sizeQtys[sz] || 0) + qty;
                                            itemMap[k].totalQty += qty;
                                          }
                                        });
                                        if (!itemMap[k].orderNums.includes(ord.saleOrderNumber)) itemMap[k].orderNums.push(ord.saleOrderNumber);
                                      });
                                    } else {
                                      // Fallback: sizeGrid do próprio OS
                                      const k = `${os.productId}-${os.variationId}`;
                                      const sizes: Record<string, number> = {};
                                      sizeEntries.forEach(({ sz, qty }) => { if (qty) sizes[sz] = qty; });
                                      itemMap[k] = { productId: os.productId, variationId: os.variationId, sizeQtys: sizes, totalQty: os.quantity, orderNums: [] };
                                    }

                                    const entries = Object.entries(itemMap);
                                    if (entries.length === 0) return null;
                                    return (
                                      <div className="flex flex-col gap-2">
                                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 px-1">Fichas Selecionadas · {entries.length} item(s)</p>
                                        {entries.map(([k, item]) => {
                                          const prod = products.find(p => p.id === item.productId);
                                          const vari = prod?.variations.find(v => v.id === item.variationId);
                                          const colorName = vari?.colorName || '';
                                          const isItemExp = expandedOSItemKeys.has(`${os.id}-${k}`);
                                          const szEntries = Object.entries(item.sizeQtys).sort(([a], [b]) => parseFloat(a) - parseFloat(b));
                                          return (
                                            <div key={k} className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                                              {/* Minimizado: referência + cor + total */}
                                              <button
                                                type="button"
                                                title="Expandir grade"
                                                aria-label="Expandir grade de tamanhos"
                                                onClick={() => {
                                                  const next = new Set(expandedOSItemKeys);
                                                  isItemExp ? next.delete(`${os.id}-${k}`) : next.add(`${os.id}-${k}`);
                                                  setExpandedOSItemKeys(next);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                                              >
                                                <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                  {(vari?.photoUrl || prod?.photoUrl)
                                                    ? <img src={vari?.photoUrl || prod?.photoUrl} alt="" className="w-full h-full object-cover" />
                                                    : <Package size={14} className="text-slate-400" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-[10px] font-black uppercase text-slate-800 dark:text-white leading-none truncate">
                                                    {prod?.reference && <span className="text-indigo-500 mr-1">{prod.reference}</span>}
                                                    {prod?.name || os.productName}
                                                  </p>
                                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">
                                                    {colorName || '—'} · {item.totalQty} {item.totalQty === 1 ? 'par' : 'pares'}
                                                    {item.orderNums.length > 0 && <span className="ml-1 text-slate-300">· Ped. {item.orderNums.join(', ')}</span>}
                                                  </p>
                                                </div>
                                                <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-200 ${isItemExp ? 'rotate-180' : ''}`} />
                                              </button>
                                              {/* Expandido: grade de tamanhos */}
                                              {isItemExp && szEntries.length > 0 && (
                                                <div className={`px-3 pb-3 pt-1 border-t ${isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/60'}`}>
                                                  <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Grade de Tamanhos</p>
                                                  <div className="flex flex-wrap gap-1.5">
                                                    {szEntries.map(([sz, qty]) => (
                                                      <div key={sz} className={`px-2.5 py-1.5 rounded-xl border-2 text-center min-w-[38px] ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                        <p className="text-[7px] font-bold text-slate-400 leading-none">{sz}</p>
                                                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 leading-none mt-0.5">{qty} {qty === 1 ? 'par' : 'pares'}</p>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Sem OS — mostrar opção de emitir + apontamento */}
                    {!hasActiveOS && (
                      <div className={`p-5 sm:p-6 rounded-[2rem] border-2 flex flex-col gap-5 ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <div className="flex items-center gap-2 px-1">
                          <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center shrink-0">
                            <Layers size={15} />
                          </div>
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ações do Mapa</h4>
                        </div>

                        <div className={`p-4 rounded-2xl border-2 flex items-start gap-3 ${isDarkMode ? 'bg-amber-950/30 border-amber-700/50' : 'bg-amber-50 border-amber-200'}`}>
                          <div className="w-8 h-8 rounded-xl bg-amber-400 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-400/30">
                            <AlertCircle size={16} strokeWidth={2.5} />
                          </div>
                          <p className={`text-[11px] font-bold leading-snug ${isDarkMode ? 'text-amber-200' : 'text-amber-800'}`}>
                            Você pode emitir a Ordem de Serviço deste mapa ou usar as ações rápidas abaixo para avançar ou concluir a produção do lote inteiro de uma vez.
                          </p>
                        </div>

                        <div className="p-5 rounded-[2rem] bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0">
                              <FileText size={20} />
                            </div>
                            <div className="text-left">
                              <h5 className="text-xs font-black text-slate-800 dark:text-slate-200 leading-none mb-1">
                                Emitir Ordem de Serviço
                              </h5>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                Gerar OS para mão de obra (Interna ou Terceirizada)
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenOSModal(selectedLot)}
                            className="px-5 py-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
                          >
                            <Plus size={14} strokeWidth={3} /> Emitir OS
                          </button>
                        </div>

                        {(() => {
                          const currentSecId = (selectedLot.route && selectedLot.route[selectedLot.currentSectorIndex]) || '';
                          const sectorObj = sectors.find(s => s.id === currentSecId);
                          const isEndCycle = !!sectorObj?.isProductionCycleEnd ||
                            sectorObj?.name?.toUpperCase().includes('EXPEDIÇÃO') ||
                            sectorObj?.name?.toUpperCase().includes('EXPEDICAO') ||
                            (selectedLot.route && selectedLot.currentSectorIndex === selectedLot.route.length - 1);

                          if (isEndCycle) {
                            return (
                              <div className="p-5 rounded-[2rem] bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                    <CheckCircle2 size={20} />
                                  </div>
                                  <div className="text-left">
                                    <h5 className="text-xs font-black text-slate-800 dark:text-slate-200 leading-none mb-1 font-black">
                                      Dar Baixa na Produção
                                    </h5>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                      Concluir o mapa e enviar os pedidos para estoque / cliente
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openSectorChangeConfirm(selectedLot, '', 'Baixa de expedição manual.')}
                                  className="px-5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-emerald-500/25"
                                >
                                  <CheckCircle2 size={14} strokeWidth={3} /> Concluir e Baixar Lote
                                </button>
                              </div>
                            );
                          } else {
                            const fromSectorIdx = selectedLot.route ? selectedLot.route.indexOf(currentSecId) : -1;
                            const nextSector = fromSectorIdx >= 0 && selectedLot.route && fromSectorIdx + 1 < selectedLot.route.length
                              ? sectors.find(s => s.id === selectedLot.route![fromSectorIdx + 1])
                              : null;
                            if (!nextSector) return null;

                            return (
                              <div className="p-5 rounded-[2rem] bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                    <ChevronRight size={20} />
                                  </div>
                                  <div className="text-left">
                                    <h5 className="text-xs font-black text-slate-800 dark:text-slate-200 leading-none mb-1 font-black">
                                      Avançar Setor
                                    </h5>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                      Avançar mapa inteiro para o setor: {nextSector.name}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openSectorChangeConfirm(selectedLot, '', 'Avanço manual de setor.')}
                                  className="px-5 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-amber-500/25"
                                >
                                  <ChevronRight size={14} strokeWidth={3} /> Avançar Lote Inteiro
                                </button>
                              </div>
                            );
                          }
                        })()}

                      </div>
                    )}
                  </div>
                );
              })()}

              {/* History Timeline */}
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setHistoryExpanded(!historyExpanded)}
                  className="w-full flex items-center justify-between px-1 py-1 group"
                >
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-slate-500 transition-colors">Histórico de Movimentação</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400">{(selectedLot.history || []).length}</span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${historyExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {historyExpanded && (
                  <div className="flex flex-col gap-3">
                    {(selectedLot.history || []).slice().sort((a, b) => b.timestamp - a.timestamp).map((h, i) => {
                      const sector = sectors.find(s => s.id === h.sectorId);
                      const tag = flowTags.find(t => t.id === h.statusId);
                      const canRevert = i === 0 && (selectedLot.history?.length || 0) > 0;
                      return (
                        <div key={i} className={`p-4 rounded-2xl border flex flex-col gap-2 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${i === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                              {i === 0 ? <Clock size={17} /> : <History size={17} />}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                              <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 leading-tight">{sector?.name || '---'}</span>
                              <span className="text-[9px] font-bold text-slate-400">{new Date(h.timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pl-[52px] flex-wrap">
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest shrink-0">{tag?.name || 'MIGRAÇÃO'}</span>
                            {h.notes && <span className="text-[10px] text-slate-400 font-bold italic truncate">• {h.notes}</span>}
                          </div>
                          {canRevert && (
                            <button
                              type="button"
                              onClick={() => handleRevertLot(selectedLot)}
                              title="Reverter esta movimentação"
                              className="self-end flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all"
                            >
                              <History size={13} />
                              Reverter
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Delete Option */}
              <div className="mt-4 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm('Deseja excluir este mapa permanentemente?')) {
                      await onDeleteLot(selectedLot.id);
                      setIsDetailModalOpen(false);
                      setSelectedLot(null);
                    }
                  }}
                  title="Excluir MAPA Permanentemente"
                  aria-label="Excluir este mapa de produção"
                  className="flex items-center gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                >
                  <Trash2 size={14} /> Excluir MAPA
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanLotResult}
        title="Escanear MAPA"
      />
      {/* ── Popup: Comparação Em Trânsito vs Necessidade ─────────────────── */}
      {inTransitPopupItem && (
        <div className="fixed inset-0 z-[180] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setInTransitPopupItem(null)} />
          <div className={`relative w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            {/* Header */}
            <div className={`px-5 py-4 border-b ${isDarkMode ? 'border-slate-800 bg-amber-950/20' : 'border-amber-100 bg-amber-50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={16} className="text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Compras em Trânsito</h3>
                </div>
                <button type="button" title="Fechar" aria-label="Fechar popup" onClick={() => setInTransitPopupItem(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-all">
                  <X size={16} />
                </button>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600/70 dark:text-amber-500 mt-1">
                {inTransitPopupItem.item.name} · Verifique antes de solicitar novo pedido
              </p>
            </div>

            {/* Table: Necessidade vs Em Trânsito vs Saldo */}
            <div className="p-4 flex flex-col gap-3">
              <div className={`rounded-xl overflow-hidden border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className={`grid grid-cols-4 px-3 py-2 text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  <span>Tamanho</span>
                  <span className="text-center text-rose-500">Falta</span>
                  <span className="text-center text-amber-500">Trânsito</span>
                  <span className="text-right text-emerald-500">Saldo</span>
                </div>
                {(() => {
                  const { inTransitQtys, realGradeStock, item: need } = inTransitPopupItem;
                  const allSizes = new Set([
                    ...Object.keys(need.sizeShortages || {}),
                    ...Object.keys(inTransitQtys),
                  ]);
                  const sorted = Array.from(allSizes).sort((a, b) => parseFloat(a) - parseFloat(b));
                  let totalFalta = 0, totalTransito = 0, totalSaldo = 0;
                  const rows = sorted.map(size => {
                    const req = (need.sizeShortages?.[size]?.required || 0);
                    const stock = realGradeStock[size] || 0;
                    const falta = Math.max(0, req - stock);
                    const transito = inTransitQtys[size] || 0;
                    const saldo = Math.max(0, falta - transito);
                    totalFalta += falta; totalTransito += transito; totalSaldo += saldo;
                    return { size, falta, transito, saldo };
                  });
                  return (
                    <>
                      {rows.map(r => (
                        <div key={r.size} className={`grid grid-cols-4 px-3 py-2.5 border-t text-sm font-black ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-100 bg-white'}`}>
                          <span className={isDarkMode ? 'text-white' : 'text-slate-700'}>{r.size}</span>
                          <span className={`text-center ${r.falta > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{r.falta > 0 ? `-${r.falta}` : '✓'}</span>
                          <span className={`text-center ${r.transito > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{r.transito > 0 ? `+${r.transito}` : '—'}</span>
                          <span className={`text-right ${r.saldo > 0 ? 'text-rose-600 font-black' : 'text-emerald-500'}`}>{r.saldo > 0 ? `-${r.saldo}` : '✓'}</span>
                        </div>
                      ))}
                      <div className={`grid grid-cols-4 px-3 py-2.5 border-t-2 text-sm font-black ${isDarkMode ? 'border-slate-600 bg-slate-800' : 'border-slate-300 bg-slate-50'}`}>
                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Total</span>
                        <span className={`text-center ${totalFalta > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{totalFalta > 0 ? `-${totalFalta}` : '✓'}</span>
                        <span className={`text-center ${totalTransito > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{totalTransito > 0 ? `+${totalTransito}` : '—'}</span>
                        <span className={`text-right text-base ${totalSaldo > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>{totalSaldo > 0 ? `-${totalSaldo}` : '✓'}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Summary message */}
              {(() => {
                const { totalFaltaSole, totalInTransit } = inTransitPopupItem;
                const saldoReal = Math.max(0, totalFaltaSole - totalInTransit);
                return saldoReal > 0 ? (
                  <div className={`p-3 rounded-xl text-xs font-bold ${isDarkMode ? 'bg-rose-950/30 text-rose-400 border border-rose-800' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                    Ainda faltam <span className="font-black">{saldoReal} par(es)</span> após o recebimento das compras em trânsito.
                  </div>
                ) : (
                  <div className={`p-3 rounded-xl text-xs font-bold ${isDarkMode ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-800' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                    As compras em trânsito cobrem toda a necessidade. Aguarde o recebimento antes de fazer novo pedido.
                  </div>
                );
              })()}
            </div>

            <div className="px-4 pb-4">
              <button type="button" onClick={() => setInTransitPopupItem(null)} className="w-full py-3 rounded-2xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:scale-95 transition-all">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Pedido de Solas com Grade */}
      <Modal
        isOpen={isSoleOrderModalOpen}
        onClose={() => setIsSoleOrderModalOpen(false)}
        title="Pedido de Solados"
        maxWidth="max-w-xl"
      >
        {selectedSoleNeed && (() => {
          // Constrói grade de solados a partir do soleStock (faixas reais, ex: "38-39", "40-41")
          const exactSoleEntries = selectedSoleNeed.colorId
            ? soleStock.filter(s => s.moldId === selectedSoleNeed.moldId && s.colorId === selectedSoleNeed.colorId)
            : [];
          const soleEntries = exactSoleEntries.length > 0
            ? exactSoleEntries
            : soleStock.filter(s => s.moldId === selectedSoleNeed.moldId);

          // Get standard sizes from mold config
          const mold = productionConfigs.find(m => m.id === selectedSoleNeed.moldId);
          const moldSizes = mold?.metadata?.sizes || [];

          // Monta rangeMap com estoque direto por faixa
          const modalRangeMap: Record<string, { stock: number; min: number; max: number }> = {};

          // Pre-populate with mold sizes
          moldSizes.forEach(size => {
            const parts = String(size).split('-').map(p => parseFloat(p.trim()));
            modalRangeMap[size] = {
              stock: 0,
              min: parts[0],
              max: parts.length === 2 ? parts[1] : parts[0]
            };
          });

          // Aggregate stock on top
          soleEntries.forEach(e => {
            Object.entries(e.stock).forEach(([k, v]) => {
              const key = String(k).trim();
              if (key === 'pesagem' || key === 'total') return;
              if (modalRangeMap[key]) {
                modalRangeMap[key].stock += Number(v) || 0;
              } else {
                // If stock has a range not in mold (unlikely but safe), add it
                const parts = key.split('-').map(p => parseFloat(p.trim()));
                modalRangeMap[key] = { stock: Number(v) || 0, min: parts[0], max: parts.length === 2 ? parts[1] : parts[0] };
              }
            });
          });

          // Para cada faixa, soma required dos tamanhos individuais contidos nela
          const gradeRows = Object.entries(modalRangeMap)
            .sort(([a], [b]) => {
              const numA = parseFloat(a);
              const numB = parseFloat(b);
              if (isNaN(numA) || isNaN(numB)) return a.localeCompare(b);
              return numA - numB;
            })
            .map(([rangeKey, range]) => {
              // Agora sz pode ser uma grade de sola já agrupada (ex: "38-39")
              let required = 0;
              Object.entries(selectedSoleNeed.sizeShortages || {}).forEach(([sz, s]: any) => {
                const parts = sz.split('-').map((p: string) => parseFloat(p.trim()));
                const nMin = parts[0];
                const nMax = parts.length === 2 ? parts[1] : parts[0];

                // Se houver qualquer interseção entre a grade da necessidade e a grade do estoque
                const hasIntersection = (nMin >= range.min && nMin <= range.max) ||
                  (nMax >= range.min && nMax <= range.max) ||
                  (range.min >= nMin && range.min <= nMax);

                if (hasIntersection) required += s.required;
              });
              const falta = Math.max(0, required - range.stock);
              const extra = extraSoleQty[rangeKey] || 0;
              return { rangeKey, required, stock: range.stock, falta, extra, total: falta + extra };
            })
            .filter(r => r.required > 0 || r.stock > 0 || extraSoleQty[r.rangeKey] > 0);

          const totalFalta = gradeRows.reduce((s, r) => s + r.falta, 0);
          const totalPedido = gradeRows.reduce((s, r) => s + r.total, 0);

          return (
            <div className="flex flex-col gap-5">
              {/* Cabeçalho */}
              <div className={`flex items-center gap-3 p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Layers size={18} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-tight text-slate-900 dark:text-white">{selectedSoleNeed.name}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    {formatContributingSources(selectedSoleNeed.contributingLots, selectedSoleNeed.contributingOrders)}
                  </p>
                </div>
              </div>

              {/* Tabela por grade de solado */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
                  Grade de Solados — Necessário · Estoque · Falta · Extra
                </p>
                <div className={`rounded-2xl overflow-hidden border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className={`grid grid-cols-5 px-4 py-2 text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                    <span>Grade</span>
                    <span className="text-center">Nec.</span>
                    <span className="text-center text-emerald-600">Est.</span>
                    <span className="text-center text-rose-500">Falta</span>
                    <span className="text-center text-indigo-500">+ Extra</span>
                  </div>

                  {gradeRows.map(row => (
                    <div key={row.rangeKey} className={`grid grid-cols-5 px-4 py-2.5 items-center border-t text-[12px] font-black ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-50 bg-white'}`}>
                      <span className={isDarkMode ? 'text-white' : 'text-slate-700'}>{row.rangeKey}</span>
                      <span className="text-center text-slate-400">{row.required}</span>
                      <span className={`text-center font-black ${row.stock > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>{row.stock}</span>
                      <span className={`text-center font-black ${row.falta > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {row.falta > 0 ? row.falta : '✓'}
                      </span>
                      <div className="flex justify-center">
                        <input
                          type="number"
                          min="0"
                          value={row.extra || ''}
                          placeholder="0"
                          title={`Extra grade ${row.rangeKey}`}
                          aria-label={`Extra grade ${row.rangeKey}`}
                          onChange={e => setExtraSoleQty(prev => ({ ...prev, [row.rangeKey]: parseInt(e.target.value) || 0 }))}
                          className={`w-14 text-center text-[12px] font-black rounded-lg py-1 outline-none border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}
                        />
                      </div>
                    </div>
                  ))}

                  <div className={`grid grid-cols-5 px-4 py-3 border-t-2 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                    <span className={`text-[9px] font-black uppercase col-span-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Geral</span>
                    <span className="text-center text-[11px] font-black text-slate-400">—</span>
                    <span className="text-center text-[13px] font-black text-rose-500">{totalFalta}</span>
                    <span className="text-center text-[13px] font-black text-indigo-600">{totalPedido}</span>
                  </div>
                </div>
              </div>

              {/* Resumo */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-4 rounded-2xl text-center ${isDarkMode ? 'bg-rose-900/20' : 'bg-rose-50'}`}>
                  <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1">Em Falta</p>
                  <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{totalFalta} <span className="text-[10px] text-rose-400">pares</span></p>
                </div>
                <div className={`p-4 rounded-2xl text-center ${isDarkMode ? 'bg-indigo-900/20' : 'bg-indigo-50'}`}>
                  <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1">Total do Pedido</p>
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{totalPedido} <span className="text-[10px] text-indigo-400">pares</span></p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const finalOrder: Record<string, number> = {};
                    gradeRows.forEach(row => {
                      if (row.total > 0) finalOrder[row.rangeKey] = row.total;
                    });
                    if (Object.keys(finalOrder).length === 0) {
                      toast.show('O pedido está vazio.');
                      return;
                    }
                    if (onNavigate) {
                      onNavigate(ViewType.PRODUCTION_SOLE_PURCHASE, {
                        moldId: selectedSoleNeed.moldId,
                        colorId: selectedSoleNeed.colorId,
                        initialGrid: finalOrder,
                        description: `Compra direta via PCP: ${selectedSoleNeed.name}`
                      });
                    }
                    setIsSoleOrderModalOpen(false);
                  }}
                  disabled={totalPedido === 0}
                  className={`w-full py-5 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl transition-all ${totalPedido > 0
                    ? 'bg-emerald-600 text-white shadow-emerald-500/20 hover:bg-emerald-700 active:scale-[0.99]'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                >
                  <ShoppingCart size={18} />
                  Lançar Compra Agora
                </button>

                <button
                  type="button"
                  disabled={totalPedido === 0 || requestingId === selectedSoleNeed.id}
                  onClick={async () => {
                    console.log('[PCPView] Solicitar button clicked', {
                      needId: selectedSoleNeed.id,
                      total: totalPedido
                    });

                    if (!onRequestPurchase || requestingId) return;

                    const finalOrder: Record<string, number> = {};
                    gradeRows.forEach(row => {
                      if (row.total > 0) finalOrder[row.rangeKey] = row.total;
                    });

                    if (Object.keys(finalOrder).length === 0) {
                      toast.show('O pedido está vazio.');
                      return;
                    }

                    setRequestingId(selectedSoleNeed.id);
                    try {
                      console.log('[PCPView] Sending request to App...');
                      await onRequestPurchase({
                        requestKey: selectedSoleNeed.id,
                        type: 'SOLE',
                        name: selectedSoleNeed.name,
                        unit: 'PAR',
                        requiredQty: totalPedido,
                        sizeBreakdown: finalOrder,
                        status: 'PENDING',
                        requestedAt: Date.now(),
                        requestedBy: userName,
                        contributingLots: selectedSoleNeed.contributingLots,
                        moldId: selectedSoleNeed.moldId,
                        colorId: selectedSoleNeed.colorId,
                      });
                      console.log('[PCPView] Request successful!');
                      toast.show(`Solicitação de ${selectedSoleNeed.name} enviada com sucesso!`);
                      setIsSoleOrderModalOpen(false);
                    } catch (err) {
                      console.error('[PCPView] Error in request:', err);
                      toast.show('Erro ao enviar solicitação.');
                    } finally {
                      setRequestingId(null);
                    }
                  }}
                  className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${totalPedido > 0 && requestingId !== selectedSoleNeed.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-[0.98]'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                >
                  {requestingId === selectedSoleNeed.id ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={16} />
                      Solicitar ao Setor de Compras
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>



      {isPrintOSModalOpen && printOSData && (
        <PrintOSModal
          isOpen={isPrintOSModalOpen}
          onClose={() => { setIsPrintOSModalOpen(false); setPrintOSData(null); }}
          os={printOSData.os}
          nextSectorName={printOSData.nextSectorName}
          isDarkMode={isDarkMode}
          product={(products || []).find(p => p.id === printOSData.os.productId)}
          grids={grids || []}
          lot={(lots || []).find(l => l.id === printOSData.os.lotId)}
        />
      )}

      {labelModalProduct && (
        <PrintLabelEditorModal
          isOpen={!!labelModalProduct}
          onClose={() => { setLabelModalProduct(null); setLabelModalLot(null); setLabelModalSizeGrid(''); setLabelModalBatchItems(undefined); }}
          product={labelModalProduct}
          isDarkMode={isDarkMode}
          grids={grids || []}
          lot={labelModalLot ?? undefined}
          sizeGridOverride={labelModalSizeGrid || undefined}
          sectors={sectors}
          batchItems={labelModalBatchItems}
        />
      )}

      {/* ── QR Baixa Modal ──────────────────────────────────────────── */}
      {qrBaixaModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className={`w-full max-w-sm rounded-[2rem] border shadow-2xl flex flex-col gap-0 overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>

            {/* Header */}
            <div className={`flex items-center justify-between px-6 pt-6 pb-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <QrCode size={20} className="text-violet-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">Baixa por QR Code</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Escanear ou digitar número da OS</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                title="Fechar"
                onClick={() => { setQrBaixaModal(null); setQrBaixaConfirm(null); setQrBaixaManualCode(''); setQrBaixaShowWebCamera(false); }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5 p-6">

              {/* Pre-selected OS info */}
              {qrBaixaModal.preselectedOS && !qrBaixaConfirm && (
                <div className={`p-4 rounded-2xl border flex flex-col gap-1 ${isDarkMode ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-100'}`}>
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">OS Pré-selecionada</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{qrBaixaModal.preselectedOS.osNumber}</span>
                  <span className="text-[10px] font-bold text-slate-400">{qrBaixaModal.preselectedOS.providerName} • R$ {qrBaixaModal.preselectedOS.totalValue.toFixed(2)}</span>
                </div>
              )}

              {/* Confirmation panel — shown after resolving an OS */}
              {qrBaixaConfirm ? (
                <div className="flex flex-col gap-4">
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckSquare size={16} className="text-emerald-500" />
                      <span className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Confirmar Baixa</span>
                    </div>
                    <div className="flex flex-col gap-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase tracking-wider">OS</span>
                        <span className="font-black text-indigo-600 dark:text-indigo-400">{qrBaixaConfirm.os.osNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase tracking-wider">Prestador</span>
                        <span className="font-black text-slate-800 dark:text-slate-200">{qrBaixaConfirm.os.providerName}</span>
                      </div>
                      {qrBaixaConfirm.lot && (
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-bold uppercase tracking-wider">Mapa</span>
                          <span className="font-black text-slate-800 dark:text-slate-200">#{qrBaixaConfirm.lot.orderNumber}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase tracking-wider">Próximo Setor</span>
                        <span className={`font-black ${qrBaixaConfirm.nextSectorName === 'CONCLUÍDO' ? 'text-emerald-500' : 'text-violet-600 dark:text-violet-400'}`}>
                          {qrBaixaConfirm.nextSectorName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase tracking-wider">Valor</span>
                        <span className="font-black text-rose-500">R$ {qrBaixaConfirm.os.totalValue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setQrBaixaConfirm(null)}
                      className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const os = qrBaixaConfirm.os;
                        setQrBaixaModal(null);
                        setQrBaixaConfirm(null);
                        setQrBaixaManualCode('');
                        setQrBaixaShowWebCamera(false);
                        await handleCompleteOS(os);
                      }}
                      className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckSquare size={14} /> Confirmar Baixa
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Camera scan area */}
                  {isWebPlatform && qrBaixaShowWebCamera ? (
                    <WebCameraScanner
                      onScan={(raw) => {
                        setQrBaixaShowWebCamera(false);
                        handleQrBaixaResolve(raw);
                      }}
                      onClose={() => setQrBaixaShowWebCamera(false)}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={qrBaixaScanning}
                      onClick={async () => {
                        if (!isWebPlatform) {
                          // Native Android: câmera SEMPRE abre primeiro
                          setQrBaixaScanning(true);
                          try {
                            const raw = await scannerService.scan();
                            if (raw) {
                              handleQrBaixaResolve(raw);
                            } else if (qrBaixaModal.preselectedOS) {
                              // Usuário cancelou scan — confirmar a OS pré-selecionada
                              const os = qrBaixaModal.preselectedOS;
                              const lot = (lots || []).find(l => l.id === os.lotId || (os.lotIds && os.lotIds.includes(l.id))) || null;
                              const nextSectorId = lot?.route?.[(lot?.currentSectorIndex ?? 0) + 1] || '';
                              const nextSec = (sectors || []).find(s => s.id === nextSectorId);
                              setQrBaixaConfirm({ os, lot, nextSectorName: nextSec?.name || 'CONCLUÍDO' });
                            }
                          } finally {
                            setQrBaixaScanning(false);
                          }
                        } else if (qrBaixaModal.preselectedOS) {
                          // Web + OS pré-selecionada: confirmar direto
                          const os = qrBaixaModal.preselectedOS;
                          const lot = (lots || []).find(l => l.id === os.lotId || (os.lotIds && os.lotIds.includes(l.id))) || null;
                          const nextSectorId = lot?.route?.[(lot?.currentSectorIndex ?? 0) + 1] || '';
                          const nextSec = (sectors || []).find(s => s.id === nextSectorId);
                          setQrBaixaConfirm({ os, lot, nextSectorName: nextSec?.name || 'CONCLUÍDO' });
                        } else {
                          // Web + sem pré-seleção: abre câmera web
                          setQrBaixaShowWebCamera(true);
                        }
                      }}
                      className={`w-full flex flex-col items-center justify-center gap-3 py-8 rounded-2xl border-2 border-dashed transition-all active:scale-98 ${qrBaixaScanning
                        ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/20 animate-pulse'
                        : isDarkMode
                          ? 'border-violet-700/50 bg-violet-950/10 hover:bg-violet-950/25 text-violet-400'
                          : 'border-violet-200 bg-violet-50/50 hover:bg-violet-50 text-violet-600'
                        }`}
                    >
                      <div className="relative">
                        <ScanLine size={40} className={qrBaixaScanning ? 'animate-bounce' : ''} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className={`w-full h-0.5 rounded-full ${isDarkMode ? 'bg-violet-400' : 'bg-violet-500'} opacity-60`} />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black uppercase tracking-widest">
                          {qrBaixaScanning ? 'Abrindo câmera...' : 'Escanear QR Code da OS'}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                          {qrBaixaModal.preselectedOS && !isWebPlatform
                            ? `Escaneie para confirmar ${qrBaixaModal.preselectedOS.osNumber || ''}`
                            : 'Toque para abrir a câmera'}
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Manual entry divider */}
                  <div className="flex items-center gap-3">
                    <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">ou digitar manualmente</span>
                    <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                  </div>

                  {/* Manual OS number input */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={qrBaixaManualCode}
                        onChange={e => setQrBaixaManualCode(e.target.value.toUpperCase())}
                        onKeyDown={e => { if (e.key === 'Enter' && qrBaixaManualCode.trim()) handleQrBaixaResolve(qrBaixaManualCode); }}
                        placeholder="Ex: OS-0003"
                        className={`w-full pl-8 pr-3 py-3 rounded-2xl text-xs font-black uppercase tracking-widest outline-none border-2 transition-colors ${isDarkMode
                          ? 'bg-slate-950 border-slate-800 text-white focus:border-violet-500 placeholder:text-slate-700'
                          : 'bg-white border-slate-200 text-slate-900 focus:border-violet-500 placeholder:text-slate-300'
                          }`}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!qrBaixaManualCode.trim()}
                      onClick={() => handleQrBaixaResolve(qrBaixaManualCode)}
                      className="px-4 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-40 shrink-0"
                    >
                      Buscar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal: Mover Pedidos para Setor ── */}
      {moveSectorModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: 60000 }}>
          <div className={`w-full max-w-sm rounded-[2rem] p-6 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
            <div>
              <h3 className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {moveSectorModal.manual ? 'Mudar Setor' : 'Mover para Setor'}
              </h3>
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 text-emerald-500`}>
                {moveSectorModal.items.length} pedido(s) · {moveSectorModal.qty} pares
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Selecione o Setor de Destino</p>
              {(() => {
                if (moveSectorModal.manual) {
                  const availSectors = [...sectors].sort((a, b) => a.order - b.order);
                  return availSectors.map((sec: any) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setMoveSectorTarget(sec.id)}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all active:scale-95 ${moveSectorTarget === sec.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'
                        }`}
                    >
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sec.color || '#6366f1' }} />
                      <span className={`text-[11px] font-black uppercase ${moveSectorTarget === sec.id ? 'text-emerald-600 dark:text-emerald-400' : isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        {sec.name}
                      </span>
                      {moveSectorTarget === sec.id && <CheckSquare size={14} className="text-emerald-500 ml-auto" />}
                    </button>
                  ));
                }
                const lot = lots.find(l => l.id === moveSectorModal.lotId);
                // Calcula próximo setor a partir do setor de origem (não do índice atual do lote)
                const fromSec = moveSectorModal.fromSectorId;
                const fromIdx = fromSec ? (lot?.route || []).indexOf(fromSec) : (lot?.currentSectorIndex ?? 0);
                const effectiveFrom = fromIdx >= 0 ? fromIdx : (lot?.currentSectorIndex ?? 0);
                // Apenas o próximo setor imediato (sem pular setores)
                const nextSecId = (lot?.route || [])[effectiveFrom + 1];
                const nextSec = nextSecId ? sectors.find(s => s.id === nextSecId) : null;
                const availSectors = nextSec ? [nextSec] : [];
                return availSectors.map((sec: any) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setMoveSectorTarget(sec.id)}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all active:scale-95 ${moveSectorTarget === sec.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'
                      }`}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sec.color || '#6366f1' }} />
                    <span className={`text-[11px] font-black uppercase ${moveSectorTarget === sec.id ? 'text-emerald-600 dark:text-emerald-400' : isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      {sec.name}
                    </span>
                    {moveSectorTarget === sec.id && <CheckSquare size={14} className="text-emerald-500 ml-auto" />}
                  </button>
                ));
              })()}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setMoveSectorModal(null); setMoveSectorTarget(''); }}
                className={`flex-1 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!moveSectorTarget}
                onClick={() => handleMoveOrdersToSector(moveSectorModal.lotId, moveSectorModal.items, moveSectorTarget)}
                className="flex-1 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-40 active:scale-95 transition-all"
              >
                Confirmar →
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal: Confirmação de Conclusão da OS ── */}
      <CompletedServiceOrdersModal
        isOpen={showCompletedOSModal}
        onClose={() => setShowCompletedOSModal(false)}
        serviceOrders={serviceOrders}
        lots={lots}
        sectors={sectors}
        transactions={transactions}
        isDarkMode={isDarkMode}
        onViewOS={(os) => setViewOSModal({ isOpen: true, os, items: getFichasForOS(os) })}
        onDeleteOS={handleDeleteOS}
        onShareOS={(os) => setShareModal({ isOpen: true, format: 'jpg', selectedItems: getFichasForOS(os) })}
        onPrintOS={(os) => { setPrintOSData({ os, nextSectorName: 'CONCLUÍDO' }); setIsPrintOSModalOpen(true); }}
        onPrintStudio={(os) => sendPCPItemsToPrintStudio(getFichasForOS(os).map(buildPCPShareItem), { isDarkMode })}
        onOpenReminders={(os) => setOsNotesPopup(os)}
        osBadgeBg={osBadgeBg}
        osBadgeText={osBadgeText}
        osBadgeBold={osBadgeBold}
        osBadgeItalic={osBadgeItalic}
        products={products}
        productionOrders={productionOrders}
      />

      <StockDuplicateDiagnosticModal
        isOpen={showStockDiagnosticModal}
        onClose={() => setShowStockDiagnosticModal(false)}
        isDarkMode={isDarkMode}
        groups={duplicateStockByRefColor}
        onMarkResolved={markStockDuplicatesResolved}
      />

      {/* ── Modal: Reparar Caixas ATACADO ── */}
      {stockRepairModal && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ zIndex: 70000 }} onClick={() => stockRepairModal.phase !== 'running' && setStockRepairModal(null)}>
          <div onClick={e => e.stopPropagation()} className={`w-full max-w-md rounded-[2rem] flex flex-col shadow-2xl max-h-[85vh] ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-5 pt-5 pb-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Wrench size={18} />
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Reparar Estoque de Caixas</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Corrige entradas sem boxQty (bug ATACADO)</p>
                </div>
              </div>
              {stockRepairModal.phase !== 'running' && (
                <button type="button" onClick={() => setStockRepairModal(null)} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {stockRepairModal.phase === 'done' ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <CheckCircle2 size={28} />
                  </div>
                  <p className={`text-sm font-black text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stockRepairModal.appliedCount} entradas corrigidas!</p>
                  <p className="text-[11px] text-slate-400 text-center">Estoque de caixas e histórico de StockLots atualizados.</p>
                </div>
              ) : stockRepairModal.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <CheckCircle2 size={28} />
                  </div>
                  <p className={`text-sm font-black text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Nenhuma entrada a reparar</p>
                  <p className="text-[11px] text-slate-400 text-center">Todos os StockLots ATACADO já têm boxQty preenchido.</p>
                </div>
              ) : (
                <>
                  <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {stockRepairModal.items.length} entrada(s) encontrada(s) sem boxQty. Selecione as que deseja corrigir e confirme.
                  </p>
                  {stockRepairModal.errorMsg && (
                    <div className="rounded-xl bg-rose-500/10 border border-rose-300 p-3 text-[11px] text-rose-600 font-bold">{stockRepairModal.errorMsg}</div>
                  )}
                  {stockRepairModal.items.map((it, i) => (
                    <div key={i} className={`rounded-2xl border p-3.5 flex flex-col gap-2 ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${it.kind === 'fix_boxqty' ? 'bg-amber-500/15 text-amber-600' : 'bg-rose-500/15 text-rose-600'}`}>
                              {it.kind === 'fix_boxqty' ? 'Corrigir boxQty' : 'Criar StockLot'}
                            </span>
                          </div>
                          <p className={`text-[11px] font-black uppercase truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{it.productName}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase truncate">{it.variationName} · Mapa #{it.lotOrderNumber}</p>
                        </div>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${it.productName} ${it.variationName}`}
                          checked={it.selected}
                          onChange={e => setStockRepairModal(prev => prev ? {
                            ...prev,
                            items: prev.items.map((x, xi) => xi === i ? { ...x, selected: e.target.checked } : x)
                          } : prev)}
                          className="w-4 h-4 rounded accent-amber-500 shrink-0 mt-0.5"
                          disabled={stockRepairModal.phase === 'running'}
                        />
                      </div>
                      <div className={`rounded-xl p-2.5 text-[10px] font-bold flex flex-col gap-1 ${isDarkMode ? 'bg-slate-900/60' : 'bg-white'}`}>
                        {it.kind === 'fix_boxqty' ? (
                          <>
                            <div className="flex justify-between">
                              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Total de pares:</span>
                              <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>{it.totalPairs} prs</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Pares por caixa:</span>
                              <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>{it.pairsPerBox} prs/cx</span>
                            </div>
                            <div className="flex justify-between text-rose-500">
                              <span>Pares incorretos a remover:</span>
                              <span>-{Object.values(it.sizeBreakdown).reduce((s, v) => s + v, 0)} prs</span>
                            </div>
                            <div className="flex justify-between text-emerald-500">
                              <span>Caixas a creditar:</span>
                              <span>+{it.correctBoxQty} cx → total {it.currentWholesaleStock + it.correctBoxQty} cx</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between">
                              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Qtd. finalizada:</span>
                              <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>{it.qty} prs</span>
                            </div>
                            <div className="flex justify-between text-emerald-500">
                              <span>Ação:</span>
                              <span>Criar StockLot + creditar estoque</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            {stockRepairModal.phase !== 'done' && stockRepairModal.items.length > 0 && (
              <div className={`shrink-0 p-4 border-t flex gap-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <button
                  type="button"
                  onClick={() => setStockRepairModal(null)}
                  disabled={stockRepairModal.phase === 'running'}
                  className={`flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeStockRepair}
                  disabled={stockRepairModal.phase === 'running' || !stockRepairModal.items.some(it => it.selected)}
                  className="flex-1 py-3.5 rounded-2xl bg-amber-500 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {stockRepairModal.phase === 'running' ? <><Loader2 size={14} className="animate-spin" /> Corrigindo...</> : `Corrigir ${stockRepairModal.items.filter(it => it.selected).length} entrada(s)`}
                </button>
              </div>
            )}
            {stockRepairModal.phase === 'done' && (
              <div className={`shrink-0 p-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <button type="button" onClick={() => setStockRepairModal(null)} className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all">
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ── Popup de Observações/Lembrete da OS — saiu do card pra ocupar menos espaço ── */}
      {osNotesPopup && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" style={{ zIndex: 60000 }} onClick={() => setOsNotesPopup(null)}>
          <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-sm rounded-[2rem] p-6 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Observações &amp; Lembrete</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">{osNotesPopup.osNumber}</p>
                </div>
              </div>
              <button type="button" title="Fechar" onClick={() => setOsNotesPopup(null)} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                <X size={16} />
              </button>
            </div>

            <textarea
              defaultValue={osNotesPopup.notes || ''}
              placeholder="Observações sobre esta OS..."
              title="Observações da OS"
              onBlur={(e) => {
                if (e.target.value !== (osNotesPopup.notes || '')) {
                  firebaseService.updateDocument('serviceOrders', osNotesPopup.id, { notes: e.target.value || null });
                }
              }}
              className={`w-full px-3 py-2 rounded-xl text-[11px] font-bold outline-none border resize-none h-20 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-700 placeholder:text-slate-400'}`}
            />
            <input
              type="text"
              defaultValue={osNotesPopup.reminderTitle || ''}
              placeholder="Título do lembrete..."
              title="Título do lembrete"
              onBlur={(e) => {
                if (e.target.value !== (osNotesPopup.reminderTitle || '')) {
                  const reminderTitle = e.target.value || null;
                  firebaseService.updateDocument('serviceOrders', osNotesPopup.id, { reminderTitle });
                  syncOSReminderNotification(osNotesPopup, { reminderTitle });
                }
              }}
              className={`w-full px-3 py-2 rounded-xl text-[11px] font-bold outline-none border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-700 placeholder:text-slate-400'}`}
            />
            <DateTimePicker
              value={osNotesPopup.reminderAt}
              isDarkMode={isDarkMode}
              placeholder="Definir lembrete"
              onChange={(ts) => {
                firebaseService.updateDocument('serviceOrders', osNotesPopup.id, { reminderAt: ts });
                syncOSReminderNotification(osNotesPopup, { reminderAt: ts });
              }}
            />

            <button
              type="button"
              onClick={() => setOsNotesPopup(null)}
              className="w-full py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-amber-500 text-white shadow-lg shadow-amber-500/20 active:scale-95 transition-all hover:bg-amber-600"
            >
              Concluído
            </button>
          </div>
        </div>,
        document.body
      )}

      {osBaixaPanel && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
          style={{ zIndex: 60000 }}
          onClick={() => setOsBaixaPanel(null)}
        >
          <div
            className={`w-full max-w-lg rounded-[2rem] border shadow-2xl p-5 flex flex-col gap-3 animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CheckSquare size={14} className="text-emerald-500 shrink-0" />
                  <h3 className={`text-[11px] font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                    Dar Baixa — {osBaixaPanel.os.osNumber}
                  </h3>
                </div>
                <p className={`text-[9px] font-bold mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Marque os pedidos prontos e confira o destino de cada um antes de baixar
                </p>
              </div>
              <button
                type="button"
                title="Fechar"
                onClick={() => setOsBaixaPanel(null)}
                className={`p-1.5 rounded-full transition-all shrink-0 ${isDarkMode ? 'text-slate-500 hover:bg-slate-800 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
              >
                <X size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={toggleOsBaixaSelectAll}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${isDarkMode ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              <input
                type="checkbox"
                checked={osBaixaPanel.items.every(it => it.included)}
                readOnly
                className="w-4 h-4 accent-indigo-600 pointer-events-none"
              />
              <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Selecionar todos ({osBaixaPanel.items.filter(it => it.included).length}/{osBaixaPanel.items.length})
              </span>
            </button>

            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
              {osBaixaPanel.items.map(item => {
                const isOverridden = item.included && item.chosenSectorId !== item.suggestedSectorId;
                return (
                  <div
                    key={item.key}
                    className={`flex flex-col gap-2 p-3 rounded-2xl border transition-opacity ${item.included
                      ? (isDarkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200')
                      : (isDarkMode ? 'bg-slate-900/40 border-slate-800/60 opacity-60' : 'bg-slate-100/60 border-slate-200/60 opacity-60')
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={item.included}
                        onChange={() => toggleOsBaixaItemIncluded(item.key)}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[10px] font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                          {item.productReference ? `${item.productReference} ` : ''}{item.productName}
                        </p>
                        {item.colorName && (
                          <p className={`text-[11px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{item.colorName}</p>
                        )}
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 px-2.5 py-1 rounded-full ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600'}`}>
                        {item.qty} {item.qty === 1 ? 'par' : 'pares'}
                      </span>
                    </div>
                    {item.included ? (
                      <div className="flex items-center gap-2 pl-7">
                        <span className={`text-[9px] font-black uppercase tracking-widest shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Mover para</span>
                        {/* Cápsula estilizada com nome do setor em laranja + ponto pulsante.
                            O <select> nativo fica invisível sobre a cápsula para capturar o
                            toque e abrir o picker nativo do Android sem perder o visual custom. */}
                        <div className="relative flex-1 min-w-0">
                          <div className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                            isOverridden
                              ? 'border-orange-400 bg-orange-500/15'
                              : 'border-orange-300 bg-orange-50 dark:border-orange-700/50 dark:bg-orange-900/20'
                          }`}>
                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 truncate">
                              {item.chosenSectorId === ''
                                ? 'CONCLUÍDO'
                                : (visibleSectors.find(s => s.id === item.chosenSectorId)?.name || item.chosenSectorId)}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                              <ChevronDown size={13} className="text-orange-500" />
                            </div>
                          </div>
                          <select
                            title={`Setor de destino para ${item.productName}`}
                            value={item.chosenSectorId}
                            onChange={(e) => updateOsBaixaItemSector(item.key, e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          >
                            <option value="">CONCLUÍDO (finalizar)</option>
                            {visibleSectors.map(sector => (
                              <option key={sector.id} value={sector.id}>{sector.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <p className={`text-[8px] font-bold uppercase tracking-widest pl-7 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Permanece nesta OS — não baixado agora
                      </p>
                    )}
                    {item.included && isOverridden && (
                      <p className="text-[8px] font-bold uppercase tracking-widest pl-7 text-orange-500">
                        Ajustado manualmente — sugestão original: {item.suggestedSectorName}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOsBaixaPanel(null)}
                className={`flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!osBaixaPanel.items.some(it => it.included)}
                onClick={executeOsBaixaPanel}
                className={`flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all ${!osBaixaPanel.items.some(it => it.included)
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                  : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
              >
                Dar Baixa ({osBaixaPanel.items.filter(it => it.included).length}/{osBaixaPanel.items.length})
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {fractionModal && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
          style={{ zIndex: 60000 }}
          onClick={() => setFractionModal(null)}
        >
          <div
            className={`w-full max-w-lg rounded-[2rem] border shadow-2xl p-5 flex flex-col gap-3 animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Scissors size={14} className="text-amber-500 shrink-0" />
                  <h3 className={`text-[11px] font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                    Fracionar Pedido
                  </h3>
                </div>
                <p className={`text-[9px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {fractionModal.product.name}{fractionModal.variation?.colorName ? ` · ${fractionModal.variation.colorName}` : ''} — {Object.values(fractionModal.baseSizes).reduce((a, b) => a + b, 0)} pares
                </p>
              </div>
              <button
                type="button"
                title="Fechar"
                onClick={() => setFractionModal(null)}
                className={`p-1.5 rounded-full transition-all shrink-0 ${isDarkMode ? 'text-slate-500 hover:bg-slate-800 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modo determinado automaticamente pelo tipo do pedido — grade padrão (atacado)
                só fraciona em caixas cheias, pra não quebrar a baixa de estoque por caixa;
                varejo fraciona livre por tamanho, já que não segue embalagem nenhuma. */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <span className="text-[9px] font-black uppercase tracking-widest shrink-0 px-2 py-0.5 rounded-full bg-amber-500 text-white">
                {fractionModal.mode === 'grade' ? 'Múltiplos da Embalagem' : 'Livre (Varejo)'}
              </span>
              <span className={`text-[8px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {fractionModal.mode === 'grade' ? 'Pedido em grade padrão — só caixas cheias' : 'Pedido de varejo — quantidade livre por tamanho'}
              </span>
            </div>

            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
              {fractionModal.fractions.map((fr, idx) => {
                const isLast = idx === fractionModal.fractions.length - 1;
                const total = Object.values(fr.sizes).reduce((a, b) => a + b, 0);
                const hasNegative = Object.values(fr.sizes).some(q => q < 0);
                return (
                  <div key={idx} className={`flex flex-col gap-2 p-3 rounded-2xl border ${hasNegative
                    ? (isDarkMode ? 'bg-rose-950/30 border-rose-700/50' : 'bg-rose-50 border-rose-200')
                    : isLast
                      ? (isDarkMode ? 'bg-slate-800/40 border-slate-700/40' : 'bg-slate-50/60 border-slate-200/60')
                      : (isDarkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200')
                    }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest shrink-0 px-2.5 py-1 rounded-full bg-amber-500 text-white">
                        Fração {fr.label}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${hasNegative ? 'text-rose-500' : isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {total} {total === 1 ? 'par' : 'pares'}{isLast ? ' (resto)' : ''}
                      </span>
                      {!isLast && fractionModal.fractions.length > 2 && (
                        <button type="button" title="Remover fração" onClick={() => removeFractionRow(idx)}
                          className={`p-1 rounded-full shrink-0 ${isDarkMode ? 'text-slate-500 hover:bg-slate-700 hover:text-white' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'}`}>
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {fractionModal.mode === 'grade' && fractionModal.gridConfig ? (
                      isLast ? (
                        <p className={`text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {fr.multiplier > 0 ? `${fr.multiplier}× grade` : 'calculado automaticamente'}
                        </p>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-widest shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>× Grade</span>
                          <button type="button" onClick={() => updateFractionMultiplier(idx, fr.multiplier - 1)}
                            className={`w-7 h-7 rounded-lg text-sm font-black ${isDarkMode ? 'bg-slate-900 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>−</button>
                          <input type="number" min={0} value={fr.multiplier}
                            onChange={(e) => updateFractionMultiplier(idx, Number(e.target.value))}
                            className={`w-14 text-center text-[11px] font-black rounded-lg px-1 py-1.5 border outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                          />
                          <button type="button" onClick={() => updateFractionMultiplier(idx, fr.multiplier + 1)}
                            className={`w-7 h-7 rounded-lg text-sm font-black ${isDarkMode ? 'bg-slate-900 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>+</button>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col gap-1">
                        {Object.keys(fractionModal.baseSizes).sort((a, b) => parseFloat(a) - parseFloat(b)).map(sz => (
                          <div key={sz} className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg ${isDarkMode ? 'bg-slate-900/60' : 'bg-white'}`}>
                            <span className={`text-[10px] font-black uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Tam. {sz}</span>
                            {isLast ? (
                              <span className={`text-[12px] font-black ${(fr.sizes[sz] || 0) < 0 ? 'text-rose-500' : isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{fr.sizes[sz] || 0}</span>
                            ) : (
                              <input type="number" min={0} value={fr.sizes[sz] || 0}
                                onChange={(e) => updateFractionSize(idx, sz, Number(e.target.value))}
                                className={`w-16 text-center text-[11px] font-black rounded-lg px-1 py-1 border outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button type="button" onClick={addFractionRow}
              className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-dashed transition-all ${isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800/50' : 'border-slate-300 text-slate-500 hover:bg-slate-50'}`}
            >
              + Adicionar Fração
            </button>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setFractionModal(null)}
                className={`flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!isFractionPlanValid(fractionModal)}
                onClick={executeFractionFicha}
                className={`flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all ${!isFractionPlanValid(fractionModal)
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                  : 'bg-amber-600 hover:bg-amber-700'
                  }`}
              >
                Fracionar ({fractionModal.fractions.length})
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── OS Completion Feedback Modal ── */}
      {osFeedback && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200" style={{ zIndex: 60000 }}>
          <div className={`w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center text-center gap-5 animate-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl animate-bounce ${osFeedback.nextSector === 'FINALIZADO'
              ? 'bg-violet-500 shadow-violet-500/30'
              : 'bg-emerald-500 shadow-emerald-500/30'
              }`}>
              <CheckSquare size={38} className="text-white" strokeWidth={2.5} />
            </div>

            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {osFeedback.type === 'pedido' ? 'Pedido' : 'Ordem de Serviço'}
              </p>
              <h2 className={`text-xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {osFeedback.type === 'pedido'
                  ? (osFeedback.nextSector === 'FINALIZADO' ? 'Pedido Finalizado!' : 'Pedido Movido!')
                  : (osFeedback.nextSector === 'FINALIZADO' ? 'OS Concluída!' : 'OS Movida!')}
              </h2>
              <p className={`text-sm font-black mt-1 ${osFeedback.nextSector === 'FINALIZADO' ? 'text-violet-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {osFeedback.osNumber}
              </p>
            </div>

            <div className={`w-full px-4 py-3 rounded-2xl flex flex-col gap-1 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
              <p className={`text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {osFeedback.nextSector === 'FINALIZADO' ? 'Status' : 'Próximo Setor'}
              </p>
              <p className={`text-sm font-black uppercase ${osFeedback.nextSector === 'FINALIZADO' ? 'text-violet-500' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {osFeedback.nextSector}
              </p>
              {osFeedback.action && (
                <p className="text-[9px] font-bold text-slate-400 mt-0.5">{osFeedback.action}</p>
              )}
            </div>

            {osFeedback.details && osFeedback.details.length > 0 && (
              <div className={`w-full px-4 py-3 rounded-2xl flex flex-col gap-1.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                <p className={`text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {osFeedback.details.length === 1 ? 'Pedido' : 'Pedidos'}
                </p>
                {osFeedback.details.map((d, i) => (
                  <p key={i} className={`text-[11px] font-bold text-left uppercase ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{d}</p>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setOsFeedback(null)}
              className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg active:scale-95 transition-all"
            >
              Continuar
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── Popup de confirmação: Finalizar Pedido(s) no Setor ── */}
      {finalizeSelectedConfirm && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200" style={{ zIndex: 60000 }}>
          <div className={`w-full max-w-sm max-h-[90vh] rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center text-center gap-5 animate-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="shrink-0 w-20 h-20 rounded-full flex items-center justify-center shadow-xl bg-violet-500 shadow-violet-500/30">
              <CheckCircle2 size={38} className="text-white" strokeWidth={2.5} />
            </div>

            <div className="shrink-0">
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Confirmar Ação
              </p>
              <h2 className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {finalizeSelectedConfirm.lines[0]}
              </h2>
            </div>

            <div className="w-full flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 -mx-1 px-1">
              <div className={`w-full px-4 py-3 rounded-2xl flex flex-col gap-1.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                <p className={`text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {finalizeSelectedConfirm.items.length === 1 ? 'Pedido' : 'Pedidos'}
                </p>
                {finalizeSelectedConfirm.items.map((it, i) => {
                  const info = finalizeSelectedConfirm.stockInfo?.[it.key];
                  return (
                    <div key={i} className="flex flex-col gap-0.5">
                      <p className={`text-[11px] font-bold text-left uppercase ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        {describeMoveItem(finalizeSelectedConfirm.lot, it)}
                      </p>
                      {info && (
                        <p className={`text-[10px] font-bold text-left normal-case ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          → {info.destino} · Estoque atual: <strong>{info.currentQty} {info.unit}</strong>
                          {info.projectedQty !== info.currentQty && <> · Ficará com: <strong className="text-emerald-600 dark:text-emerald-400">{info.projectedQty} {info.unit}</strong></>}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resumo Geral de Baixas e Estoque de Caixas Somadas */}
              {(() => {
                let totalSolesDeducted = 0;
                finalizeSelectedConfirm.soleInfo?.forEach(group => {
                  group.rows.forEach(row => {
                    totalSolesDeducted += (row.before - row.after);
                  });
                });

                let totalCurrentBoxes = 0;
                let totalAddedBoxes = 0;
                let totalProjectedBoxes = 0;
                let hasBoxes = false;

                let totalCurrentPairs = 0;
                let totalAddedPairs = 0;
                let totalProjectedPairs = 0;
                let hasPairs = false;

                Object.values(finalizeSelectedConfirm.stockInfo || {}).forEach(info => {
                  if (info.destino === 'Estoque') {
                    if (info.unit === 'caixas') {
                      totalCurrentBoxes += info.currentQty;
                      totalAddedBoxes += info.addQty;
                      totalProjectedBoxes += info.projectedQty;
                      hasBoxes = true;
                    } else if (info.unit === 'pares') {
                      totalCurrentPairs += info.currentQty;
                      totalAddedPairs += info.addQty;
                      totalProjectedPairs += info.projectedQty;
                      hasPairs = true;
                    }
                  }
                });

                if (totalSolesDeducted === 0 && !hasBoxes && !hasPairs) return null;

                return (
                  <div className={`w-full px-4 py-3 rounded-2xl flex flex-col gap-2.5 ${isDarkMode ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-indigo-50/50 border border-indigo-100/55'}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 text-left">
                      Resumo Geral de Baixas
                    </p>

                    {totalSolesDeducted > 0 && (
                      <div className="flex justify-between items-center text-[11px] font-bold text-left">
                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Total Solas Abatidas:</span>
                        <span className="text-rose-600 dark:text-rose-400 font-black">-{totalSolesDeducted} pares</span>
                      </div>
                    )}

                    {hasBoxes && (
                      <div className="flex flex-col gap-1 text-[11px] font-bold text-left border-t border-slate-200/50 dark:border-slate-700/50 pt-2">
                        <div className="flex justify-between items-center">
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Estoque Caixas (Somado):</span>
                          <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{totalCurrentBoxes} cx</span>
                        </div>
                        <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                          <span>Entrada Produção:</span>
                          <span className="font-black">+{totalAddedBoxes} cx</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-dashed border-slate-200/50 dark:border-slate-700/50 pt-1">
                          <span>Projeção Final:</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-black">{totalProjectedBoxes} cx</span>
                        </div>
                      </div>
                    )}

                    {hasPairs && (
                      <div className="flex flex-col gap-1 text-[11px] font-bold text-left border-t border-slate-200/50 dark:border-slate-700/50 pt-2">
                        <div className="flex justify-between items-center">
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Estoque Pares (Somado):</span>
                          <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{totalCurrentPairs} prs</span>
                        </div>
                        <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                          <span>Entrada Produção:</span>
                          <span className="font-black">+{totalAddedPairs} prs</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-dashed border-slate-200/50 dark:border-slate-700/50 pt-1">
                          <span>Projeção Final:</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-black">{totalProjectedPairs} prs</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {finalizeSelectedConfirm.lines.slice(1).some(l => l) && (
                <div className={`w-full px-4 py-3 rounded-2xl flex flex-col gap-1.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                  {finalizeSelectedConfirm.lines.slice(1).filter(l => l).map((line, i) => (
                    <p key={i} className={`text-xs font-bold text-left ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{line}</p>
                  ))}
                </div>
              )}

              {finalizeSelectedConfirm.soleInfo && finalizeSelectedConfirm.soleInfo.length > 0 && (
                <div className={`w-full px-4 py-3 rounded-2xl flex flex-col gap-3.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <TrendingDown size={12} strokeWidth={3} /> Estoque de Solados (vai diminuir)
                  </p>
                  {finalizeSelectedConfirm.soleInfo.map((group, gi) => (
                    <div key={gi} className="flex flex-col gap-2">
                      <p className={`text-[10px] font-black uppercase tracking-wider text-left border-b pb-1 ${isDarkMode ? 'text-slate-200 border-slate-700/50' : 'text-slate-800 border-slate-200/50'}`}>
                        {group.moldName}{group.colorName ? ` · ${group.colorName}` : ''}
                      </p>

                      {group.contributions && group.contributions.length > 0 && (
                        <div className="flex flex-col gap-1 pl-1">
                          {group.contributions.map((c, ci) => (
                            <p key={ci} className="text-[9px] font-bold text-left text-slate-500 dark:text-slate-400 leading-snug">
                              • {c.orderLabel} (Mapa {c.lotNumber}): <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold">{c.qty} pares</strong>
                            </p>
                          ))}
                        </div>
                      )}

                      <div className={`w-full overflow-hidden rounded-xl border mt-1 ${isDarkMode ? 'border-slate-800 bg-slate-950/20' : 'border-slate-150 bg-white'}`}>
                        <table className="w-full text-left text-[9px] border-collapse">
                          <thead>
                            <tr className={`border-b font-black uppercase tracking-wider text-center ${isDarkMode ? 'bg-slate-950/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                              <th className="py-1.5 px-2">Grade</th>
                              <th className="py-1.5 px-2">Atual</th>
                              <th className="py-1.5 px-2 text-rose-600 dark:text-rose-400">Descontou</th>
                              <th className="py-1.5 px-2 text-emerald-600 dark:text-emerald-400">Final</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row, ri) => (
                              <tr key={ri} className={`border-b last:border-b-0 text-center ${isDarkMode ? 'border-slate-800/50 hover:bg-slate-800/20' : 'border-slate-50 hover:bg-slate-50/50'}`}>
                                <td className="py-1.5 px-2 font-bold text-slate-800 dark:text-slate-200">{row.size}</td>
                                <td className="py-1.5 px-2 text-slate-500 dark:text-slate-455">{row.before} prs</td>
                                <td className="py-1.5 px-2 font-black text-rose-600 dark:text-rose-400">-{row.deducted} prs</td>
                                <td className="py-1.5 px-2 font-black text-emerald-600 dark:text-emerald-400">{row.after} prs</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 w-full flex gap-3">
              <button
                type="button"
                onClick={() => setFinalizeSelectedConfirm(null)}
                className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleFinalizeSelectedSourceItems(finalizeSelectedConfirm.lot, finalizeSelectedConfirm.items, finalizeSelectedConfirm.os);
                  setFinalizeSelectedConfirm(null);
                }}
                className="flex-1 py-4 rounded-2xl bg-violet-600 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg active:scale-95 transition-all"
              >
                OK
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Popup de Observação do Lote ── */}
      {lotNotesPopup && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
          style={{ zIndex: 60000 }}
          onClick={() => setLotNotesPopup(null)}
        >
          <div
            className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-100'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-amber-900/30' : 'bg-amber-50'}`}>
                <MessageSquare size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-500">Observação</p>
                <p className={`text-[11px] font-black uppercase ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  MAPA {lotNotesPopup.lot.orderNumber}
                </p>
              </div>
            </div>
            <p className={`text-sm font-bold leading-relaxed px-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
              {lotNotesPopup.lot.notes}
            </p>
            <button
              type="button"
              onClick={() => setLotNotesPopup(null)}
              className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Fechar
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── Seleção Manual de Setor (escapatória para quando o cálculo automático erra) ── */}
      {manualSectorPicker && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
          style={{ zIndex: 60000 }}
          onClick={() => setManualSectorPicker(null)}
        >
          <div
            className={`w-full max-w-xs rounded-[2rem] border shadow-2xl p-5 flex flex-col gap-3 animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>Escolher Setor Manualmente</h3>
                <p className={`text-[9px] font-bold mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {manualSectorPicker.lot
                    ? `Mapa #${manualSectorPicker.lot.orderNumber} — use apenas se o cálculo automático estiver errado`
                    : `${manualSectorPicker.fichas?.length} pedido(s) selecionado(s)`}
                </p>
              </div>
              <button
                type="button"
                title="Fechar"
                onClick={() => setManualSectorPicker(null)}
                className={`p-1.5 rounded-full transition-all shrink-0 ${isDarkMode ? 'text-slate-500 hover:bg-slate-800 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {visibleSectors.map(sector => {
                const isCurrent = manualSectorPicker.lot
                  ? manualSectorPicker.lot.route?.[manualSectorPicker.lot.currentSectorIndex] === sector.id
                  : false;
                return (
                  <button
                    key={sector.id}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => {
                      setManualSectorMoveConfirm({
                        lot: manualSectorPicker.lot,
                        fichas: manualSectorPicker.fichas,
                        targetSectorId: sector.id,
                        targetSectorName: sector.name,
                      });
                      setManualSectorPicker(null);
                    }}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-left transition-all ${isCurrent
                      ? `cursor-not-allowed opacity-40 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`
                      : isDarkMode ? 'text-slate-300 hover:bg-orange-500 hover:text-white' : 'text-slate-600 hover:bg-orange-500 hover:text-white'
                      }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sector.color }} />
                    {sector.name}
                    {isCurrent && <span className="text-[8px] font-black ml-auto">ATUAL</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {manualSectorMoveConfirm && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
          style={{ zIndex: 60001 }}
          onClick={() => setManualSectorMoveConfirm(null)}
        >
          <div
            className={`w-full max-w-md rounded-[2rem] border shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-indigo-500">
                <ArrowLeftRight size={18} />
                <h3 className="text-[12px] font-black uppercase tracking-widest">Confirmar Movimentação Manual</h3>
              </div>
              <button
                type="button"
                onClick={() => setManualSectorMoveConfirm(null)}
                className={`p-1.5 rounded-full transition-all shrink-0 ${isDarkMode ? 'text-slate-500 hover:bg-slate-800 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
              >
                <X size={16} />
              </button>
            </div>

            {/* Target Sector info */}
            <div className={`p-4 rounded-2xl flex items-center gap-3.5 ${isDarkMode ? 'bg-slate-800/40 border border-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-500 shrink-0">
                <ArrowLeftRight size={18} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">Mover para o Setor</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sectors.find(s => s.id === manualSectorMoveConfirm.targetSectorId)?.color || '#ccc' }} />
                  <span className="text-sm font-black uppercase tracking-wider">{manualSectorMoveConfirm.targetSectorName}</span>
                </div>
              </div>
            </div>

            {/* Content Details */}
            <div className="flex flex-col gap-2.5">
              {manualSectorMoveConfirm.lot ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mapa Selecionado</p>
                  <p className="text-sm font-bold text-indigo-500 mt-0.5">Mapa #{manualSectorMoveConfirm.lot.orderNumber}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    Todo o conteúdo do mapa será movido de forma manual.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Pedidos Selecionados ({manualSectorMoveConfirm.fichas?.length})
                  </p>
                  <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                    {manualSectorMoveConfirm.fichas?.map((f, idx) => {
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold ${isDarkMode ? 'bg-slate-800/20 hover:bg-slate-800/40' : 'bg-slate-50/50 hover:bg-slate-100/50'}`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black text-slate-400">PED {f.si.orderId.substring(0, 6)}</span>
                              <span className="text-slate-300 dark:text-slate-700">·</span>
                              <span className="truncate">{f.product?.reference || '---'}</span>
                            </div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider truncate mt-0.5">{f.variation?.colorName || '---'}</p>
                          </div>
                          <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-full shrink-0">
                            {f.si.qty} {f.si.qty === 1 ? 'par' : 'pares'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  if (manualSectorMoveConfirm.lot) {
                    handleManualSectorOverride(manualSectorMoveConfirm.lot, manualSectorMoveConfirm.targetSectorId);
                  } else if (manualSectorMoveConfirm.fichas) {
                    handleManualFichasSectorOverride(manualSectorMoveConfirm.fichas, manualSectorMoveConfirm.targetSectorId);
                  }
                }}
                className="w-full py-3.5 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg transition-all active:scale-[0.98] bg-indigo-600 text-white shadow-indigo-100 dark:shadow-none hover:bg-indigo-700"
              >
                Sim, mover pedido(s)
              </button>
              <button
                type="button"
                onClick={() => setManualSectorMoveConfirm(null)}
                className="w-full py-3.5 rounded-2xl font-black uppercase tracking-widest text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {sectorChangeConfirm && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
          style={{ zIndex: 60000 }}
          onClick={closeSectorChangeConfirm}
        >
          <div
            className={`w-full max-w-lg rounded-[2rem] border shadow-2xl p-5 flex flex-col gap-3 animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>Confirmar Mudança de Setor</h3>
                  {lotConfirmQueue.length > 0 && (
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      +{lotConfirmQueue.length} mapa{lotConfirmQueue.length > 1 ? 's' : ''} na fila
                    </span>
                  )}
                </div>
                <p className={`text-[9px] font-bold mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Mapa #{sectorChangeConfirm.lot.orderNumber} — confira o destino de cada modelo antes de avançar</p>
              </div>
              <button
                type="button"
                title="Fechar"
                onClick={closeSectorChangeConfirm}
                className={`p-1.5 rounded-full transition-all shrink-0 ${isDarkMode ? 'text-slate-500 hover:bg-slate-800 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
              {sectorChangeConfirm.items.map(item => {
                const isOverridden = item.chosenSectorId !== '__PENDING_SELECTION__' && item.chosenSectorId !== item.suggestedSectorId;
                return (
                  <div
                    key={item.key}
                    className={`flex flex-col gap-2 p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-[10px] font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                          {item.productReference ? `${item.productReference} ` : ''}{item.productName}
                        </p>
                        {item.colorName && (
                          <p className={`text-[11px] font-bold mt-0.5 truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{item.colorName}</p>
                        )}
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 px-2.5 py-1 rounded-full ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-white text-slate-600'}`}>
                        {item.qty} {item.qty === 1 ? 'par' : 'pares'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase tracking-widest shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Mover para</span>
                      <select
                        title={`Setor de destino para ${item.productName}`}
                        value={item.chosenSectorId}
                        onChange={(e) => updateSectorChoiceItem(item.key, e.target.value)}
                        className={`flex-1 min-w-0 text-[10px] font-black uppercase tracking-widest rounded-xl px-3 py-2 border outline-none transition-all ${item.chosenSectorId === '__PENDING_SELECTION__'
                          ? isDarkMode ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600'
                          : isOverridden
                            ? 'border-orange-500 text-orange-500 bg-orange-500/10'
                            : isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-200 bg-white text-slate-700'
                          }`}
                      >
                        <option value="__PENDING_SELECTION__" disabled>-- SELECIONE O SETOR DE DESTINO --</option>
                        <option value="">CONCLUÍDO (finalizar)</option>
                        {visibleSectors.map(sector => (
                          <option key={sector.id} value={sector.id}>{sector.name}</option>
                        ))}
                      </select>
                    </div>
                    {isOverridden && (
                      <p className="text-[8px] font-bold uppercase tracking-widest text-orange-500">
                        Ajustado manualmente — sugestão original: {item.suggestedSectorName}
                      </p>
                    )}
                    {!isOverridden && item.chosenSectorId !== '__PENDING_SELECTION__' && item.skippedSectorNames.length > 0 && (
                      <p className={`text-[8px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Não passa por: {item.skippedSectorNames.join(', ')} — não faz parte do roteiro deste modelo
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={closeSectorChangeConfirm}
                className={`flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={sectorChangeConfirm.items.some(item => item.chosenSectorId === '__PENDING_SELECTION__')}
                onClick={handleConfirmSectorChange}
                className={`flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all ${sectorChangeConfirm.items.some(item => item.chosenSectorId === '__PENDING_SELECTION__')
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                  : 'bg-orange-500 hover:bg-orange-600'
                  }`}
              >
                Confirmar e Avançar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <Modal
        isOpen={!!mappingWarningModal}
        onClose={() => setMappingWarningModal(null)}
        title="Cruzamento de Numerações Desatualizado"
        icon={<AlertCircle size={20} />}
        maxWidth="max-w-xl"
      >
        {mappingWarningModal && (
          <div className="flex flex-col gap-5 p-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">{mappingWarningModal.itemName}</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">{mappingWarningModal.reason}</p>
            </div>
            <div className={`rounded-2xl border p-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Diagnóstico técnico (para conferência)</p>
              <pre className="text-[11px] font-mono whitespace-pre-wrap break-words text-slate-600 dark:text-slate-300">{mappingWarningModal.diagnostic}</pre>
            </div>
            <button
              type="button"
              onClick={async () => {
                const fullText = `${mappingWarningModal.itemName}\n\n${mappingWarningModal.reason}\n\n${mappingWarningModal.diagnostic}`;
                try {
                  await navigator.clipboard.writeText(fullText);
                } catch {
                  const ta = document.createElement('textarea');
                  ta.value = fullText;
                  ta.style.position = 'fixed';
                  ta.style.opacity = '0';
                  document.body.appendChild(ta);
                  ta.select();
                  try { document.execCommand('copy'); } catch { }
                  document.body.removeChild(ta);
                }
                setMappingDiagnosticCopied(true);
                setTimeout(() => setMappingDiagnosticCopied(false), 2000);
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all active:scale-[0.98]"
            >
              {mappingDiagnosticCopied ? <><CheckCircle2 size={16} /> Copiado!</> : <><ClipboardList size={16} /> Copiar diagnóstico</>}
            </button>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!orderDeleteConfirm}
        onClose={() => setOrderDeleteConfirm(null)}
        title="Excluir Pedido da Fila do PCP"
        icon={<AlertCircle size={20} />}
        maxWidth="max-w-md"
      >
        {orderDeleteConfirm && (
          <div className="flex flex-col gap-5 p-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Pedido {orderDeleteConfirm.saleOrderNumber}</p>
              {orderDeleteConfirm.hasSourcePurchase ? (
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                  A compra de origem deste pedido ainda existe. Para manter tudo sincronizado, o ideal é excluir a <span className="text-indigo-500">compra</span> na tela de Compras — o PCP é recalculado automaticamente. Mesmo assim, deseja remover apenas este pedido da fila do PCP?
                </p>
              ) : (
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                  A compra de origem deste pedido já foi excluída — ele ficou <span className="text-rose-500">órfão</span> na fila do PCP. Deseja remover este pedido (e seus itens) da lista de sugestões de mapas?
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onDeleteProductionOrder?.(orderDeleteConfirm.orderId);
                  setOrderDeleteConfirm(null);
                }}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg transition-all active:scale-[0.98] bg-rose-500 text-white shadow-rose-100 dark:shadow-none hover:bg-rose-600"
              >
                Sim, excluir pedido
              </button>
              <button
                type="button"
                onClick={() => setOrderDeleteConfirm(null)}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
              >
                Agora não
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!repairLinkConfirm}
        onClose={() => setRepairLinkConfirm(null)}
        title="Reparar Vínculo com a Venda"
        icon={<AlertTriangle size={20} />}
        maxWidth="max-w-md"
      >
        {repairLinkConfirm && (
          <div className="flex flex-col gap-5 p-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Pedido #{repairLinkConfirm.sale.orderNumber}</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                Reapontar o pedido <span className="text-indigo-500">#{repairLinkConfirm.sale.orderNumber}</span> para a Ordem de Produção <span className="text-indigo-500">{repairLinkConfirm.order.orderNumber}</span> (que gerou este mapa)?
              </p>
              {repairLinkConfirm.orphanOrder && (
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed mt-3">
                  {repairLinkConfirm.orphanIsEmpty ? (
                    <>A Ordem de Produção órfã <span className="text-rose-500">{repairLinkConfirm.orphanOrder.orderNumber}</span> (sem mapas vinculados) será removida.</>
                  ) : (
                    <>A Ordem de Produção atual <span className="text-rose-500">{repairLinkConfirm.orphanOrder.orderNumber}</span> também tem mapas — ela será apenas desvinculada da venda, sem ser excluída.</>
                  )}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={executeRepairSaleLink}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg transition-all active:scale-[0.98] bg-indigo-600 text-white shadow-indigo-100 dark:shadow-none hover:bg-indigo-700"
              >
                Sim, reparar vínculo
              </button>
              <button
                type="button"
                onClick={() => setRepairLinkConfirm(null)}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ExportNoteModal
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={async (note, format, showVals, groupMode, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList, splitPages, showProvider, showOSData, showSoleGrid, selectedSectorIds, pageSize) => {
          let { finalItems, lotNumbers } = buildGroupedShareItems(shareModal.selectedItems, groupMode);

          if (showSectorNotes && selectedSectorIds && selectedSectorIds.length > 0) {
            finalItems = finalItems.map(item => {
              const filteredNotes = item.sectorNotes.filter(n => {
                const sec = sectors.find(s => s.name === n.sectorName);
                if (!sec) return false;
                return selectedSectorIds.includes(sec.id);
              });
              return { ...item, sectorNotes: filteredNotes };
            });
          }

          const success = await generatePCPShareExport({
            lotNumber: lotNumbers || 'Vários',
            items: finalItems,
            additionalNote: note,
            isDarkMode,
            showTotalGrid,
            showMaterials,
            showItemGrid,
            showSectorNotes,
            showOrderList,
            splitPages,
            showProvider,
            showOSData,
            showSoleGrid,
            pageSize
          }, format);

          if (success) {
            setShareModal(prev => ({ ...prev, isOpen: false }));
          }
        }}
        onPreview={async (note, format, showVals, groupMode, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList, splitPages, showProvider, showOSData, showSoleGrid, selectedSectorIds, pageSize) => {
          let { finalItems, lotNumbers } = buildGroupedShareItems(shareModal.selectedItems, groupMode);

          if (showSectorNotes && selectedSectorIds && selectedSectorIds.length > 0) {
            finalItems = finalItems.map(item => {
              const filteredNotes = item.sectorNotes.filter(n => {
                const sec = sectors.find(s => s.name === n.sectorName);
                if (!sec) return false;
                return selectedSectorIds.includes(sec.id);
              });
              return { ...item, sectorNotes: filteredNotes };
            });
          }

          return await generatePCPShareExport({
            lotNumber: lotNumbers || 'Vários',
            items: finalItems,
            additionalNote: note,
            isDarkMode,
            showTotalGrid,
            showMaterials,
            showItemGrid,
            showSectorNotes,
            showOrderList,
            splitPages,
            showProvider,
            showOSData,
            showSoleGrid,
            pageSize
          }, format, true);
        }}
        onOpenInPrintStudio={async (note, format, showVals, groupMode, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList, splitPages, showProvider, showOSData, showSoleGrid, selectedSectorIds, pageSize) => {
          // Print Studio trabalha com blocos de imagem (bitmap), nunca PDF — por isso
          // ignora o formato escolhido no popup (sempre gera como JPG), mas respeita as
          // mesmas opções de conteúdo (grade, materiais, instruções etc.) já configuradas.
          let { finalItems } = buildGroupedShareItems(shareModal.selectedItems, groupMode);

          if (showSectorNotes && selectedSectorIds && selectedSectorIds.length > 0) {
            finalItems = finalItems.map(item => {
              const filteredNotes = item.sectorNotes.filter(n => {
                const sec = sectors.find(s => s.name === n.sectorName);
                if (!sec) return false;
                return selectedSectorIds.includes(sec.id);
              });
              return { ...item, sectorNotes: filteredNotes };
            });
          }

          await sendPCPItemsToPrintStudio(finalItems, {
            isDarkMode, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList, showProvider, showOSData, showSoleGrid, pageSize,
          });
          setShareModal(prev => ({ ...prev, isOpen: false }));
        }}
        isDarkMode={isDarkMode}
        initialFormat={shareModal.format}
        title="Central de Compartilhamento - PCP"
        sectors={sectors}
        showGroupingToggle={true}
        showPCPTotalGridToggle={true}
        showMaterialsToggle={true}
        showItemGridToggle={true}
        showSectorNotesToggle={true}
        showOrderListToggle={true}
        showSplitPagesToggle={true}
        showProviderToggle={true}
        showOSDataToggle={true}
        showSoleGridToggle={true}
        showOpenInPrintStudioToggle={true}
      />

      <Modal
        isOpen={viewOSModal.isOpen}
        onClose={() => setViewOSModal({ isOpen: false, os: null, items: [] })}
        title={viewOSModal.os ? `${viewOSModal.os.osNumber}${viewOSModal.os.providerName ? ` — ${viewOSModal.os.providerName}` : ''}` : 'Pedidos da OS'}
        icon={<Eye size={18} />}
        maxWidth="max-w-md"
      >
        <div className="p-5 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
          {viewOSModal.items.length > 0 && (
            <button
              type="button"
              onClick={() => setShowViewOSGrid(v => !v)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all active:scale-[0.98] ${isDarkMode ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
            >
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Mostrar Grade por Tamanho</span>
              <span
                role="switch"
                aria-checked={showViewOSGrid}
                aria-label="Mostrar grade por tamanho"
                className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${showViewOSGrid ? 'bg-indigo-600' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${showViewOSGrid ? 'left-5' : 'left-1'}`} />
              </span>
            </button>
          )}
          {viewOSModal.items.length === 0 && (
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 text-center py-6">Nenhum pedido encontrado para esta OS.</p>
          )}
          {viewOSModal.items.map((f: any, idx: number) => {
            const productName = f.product?.name || f.orderItem?.productName || '—';
            const productRef = f.product?.reference || '';
            const colorName = f.variation?.colorName || f.orderItem?.variationName || '';
            // Fallback pro snapshot salvo no lote (f.si.sizes) — sem isso, a grade some
            // se o Pedido de Produção original for editado/excluído depois da criação.
            // Fichas FRACIONADAS sempre priorizam f.si.sizes (a fatia da fração) — ver
            // mesmo comentário no card de "Pedidos no Setor".
            const szSizesSource = f.si?.fractionLabel ? (f.si?.sizes || f.orderItem?.sizes) : (f.orderItem?.sizes || f.si?.sizes);
            const szEntries = szSizesSource
              ? Object.entries(szSizesSource as Record<string, any>)
                .filter(([, s]) => (s?.toProduction || 0) > 0)
                .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
              : [];
            return (
              <div key={idx} className={`rounded-2xl border p-3 flex flex-col gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-[11px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {productRef ? `${productRef} ` : ''}{productName}
                    </p>
                    {colorName && <p className="text-[10px] text-slate-400 font-bold uppercase">{colorName}</p>}
                  </div>
                  <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 shrink-0">{f.si?.qty || 0} pares</span>
                </div>
                {showViewOSGrid && szEntries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {szEntries.map(([sz, s]: [string, any]) => (
                      <div key={sz} className={`px-2 py-1 rounded-lg border text-center min-w-[32px] ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <p className="text-[7px] font-bold text-slate-400 leading-none">{sz}</p>
                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 leading-none mt-0.5">{s.toProduction}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Modal>

      <Modal
        isOpen={isColorPickerOpen}
        onClose={() => { setIsColorPickerOpen(false); setColorPickerLot(null); }}
        title={colorPickerLot ? `Cor do Mapa ${colorPickerLot.orderNumber}` : "Cor do Badge de Mapa"}
        icon={<Palette size={20} />}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-5 p-1">
          {/* Seletor de Mapa */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selecionar Mapa</label>
            <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-0.5">
              {/* Opção global */}
              <button type="button"
                onClick={() => setColorPickerLot(null)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${!colorPickerLot ? (isDarkMode ? 'border-indigo-500 bg-indigo-900/20' : 'border-indigo-400 bg-indigo-50') : (isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50')}`}
              >
                <span className="text-[8px] font-black px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: mapBadgeBg, color: mapBadgeText }}>PADRÃO</span>
                <span className={`text-[10px] font-bold truncate ${!colorPickerLot ? 'text-indigo-500' : (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>Cor padrão (todos os mapas)</span>
              </button>
              {/* Mapas individuais */}
              {[...lots].sort((a, b) => ((b as any).createdAt || 0) - ((a as any).createdAt || 0)).map(lot => {
                const lBg: string = (lot as any).metadata?.badgeColor || mapBadgeBg;
                const lTxt: string = (lot as any).metadata?.badgeTextColor || mapBadgeText;
                const isSel = colorPickerLot?.id === lot.id;
                return (
                  <button key={lot.id} type="button"
                    onClick={() => setColorPickerLot(lot)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${isSel ? (isDarkMode ? 'border-indigo-500 bg-indigo-900/20' : 'border-indigo-400 bg-indigo-50') : (isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50')}`}
                  >
                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap" style={{ backgroundColor: lBg, color: lTxt }}>MAPA {lot.orderNumber}</span>
                    <span className={`text-[10px] font-bold truncate ${isSel ? 'text-indigo-500' : (isDarkMode ? 'text-slate-400' : 'text-slate-600')}`}>{products.find(p => p.id === lot.productId)?.name || lot.customerName || `Mapa ${lot.orderNumber}`}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pré-visualização</label>
            <div className="flex justify-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span
                className="text-[11px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-widest shadow-lg"
                style={{
                  backgroundColor: colorPickerLot ? ((colorPickerLot as any).metadata?.badgeColor || mapBadgeBg) : mapBadgeBg,
                  color: colorPickerLot ? ((colorPickerLot as any).metadata?.badgeTextColor || mapBadgeText) : mapBadgeText,
                  boxShadow: `0 4px 12px ${(colorPickerLot ? ((colorPickerLot as any).metadata?.badgeColor || mapBadgeBg) : mapBadgeBg)}30`
                }}
              >
                MAPA {colorPickerLot ? colorPickerLot.orderNumber : '009'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cor de Fundo (RGB)</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={colorPickerLot ? ((colorPickerLot as any).metadata?.badgeColor || mapBadgeBg) : mapBadgeBg}
                onChange={(e) => {
                  const bg = e.target.value;
                  const txt = colorPickerLot ? ((colorPickerLot as any).metadata?.badgeTextColor || getContrastingColor(bg)) : mapBadgeText;
                  if (colorPickerLot) {
                    updateLotColor(colorPickerLot, bg, txt);
                  } else {
                    updateMapBadgeColors(bg, txt);
                  }
                }}
                className="w-10 h-10 rounded-xl cursor-pointer border-2 border-slate-200 dark:border-slate-700 bg-transparent shrink-0"
                title="Escolher cor personalizada"
              />
              <div className="flex flex-wrap gap-2 max-w-[320px]">
                {[
                  // Cores Vibrantes/Escuras
                  '#7c3aed', '#4f46e5', '#2563eb', '#0891b2', '#0d9488',
                  '#059669', '#16a34a', '#65a30d', '#ca8a04', '#d97706',
                  '#ea580c', '#b45309', '#dc2626', '#e11d48', '#db2777',
                  '#c026d3', '#9333ea', '#000000', '#475569', '#0f172a',
                  // Cores Claras/Pastéis
                  '#ddd6fe', '#c7d2fe', '#bfdbfe', '#c5f2f7', '#ccfbf1',
                  '#d1fae5', '#dcfce7', '#fef08a', '#fed7aa', '#fee2e2',
                  '#fce7f3', '#fae8ff', '#f3f4f6', '#ffffff'
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      const txt = colorPickerLot ? getContrastingColor(c) : mapBadgeText;
                      if (colorPickerLot) {
                        updateLotColor(colorPickerLot, c, txt);
                      } else {
                        updateMapBadgeColors(c, txt);
                      }
                    }}
                    className={`w-7 h-7 rounded-lg border transition-all ${(colorPickerLot ? ((colorPickerLot as any).metadata?.badgeColor || mapBadgeBg) : mapBadgeBg) === c ? 'border-indigo-500 scale-110 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cor do Texto</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (colorPickerLot) {
                    updateLotColor(colorPickerLot, (colorPickerLot as any).metadata?.badgeColor || mapBadgeBg, '#ffffff');
                  } else {
                    updateMapBadgeColors(mapBadgeBg, '#ffffff');
                  }
                }}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${(colorPickerLot ? ((colorPickerLot as any).metadata?.badgeTextColor || mapBadgeText) : mapBadgeText) === '#ffffff'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-800 dark:border-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-white border border-slate-300 shrink-0" />
                Texto Branco
              </button>
              <button
                type="button"
                onClick={() => {
                  if (colorPickerLot) {
                    updateLotColor(colorPickerLot, (colorPickerLot as any).metadata?.badgeColor || mapBadgeBg, '#000000');
                  } else {
                    updateMapBadgeColors(mapBadgeBg, '#000000');
                  }
                }}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${(colorPickerLot ? ((colorPickerLot as any).metadata?.badgeTextColor || mapBadgeText) : mapBadgeText) === '#000000'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-800 dark:border-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-black shrink-0" />
                Texto Preto
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { setIsColorPickerOpen(false); setColorPickerLot(null); }}
            className="w-full mt-2 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
          >
            Confirmar Cor
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isBadgeColorPickerOpen}
        onClose={() => setIsBadgeColorPickerOpen(false)}
        title="Cor de Badges PCP"
        icon={<Tag size={20} />}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-6 p-1">
          {/* Badge de Produto/Cor */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
              Badge de Referência (Produto / Cor)
            </span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
              Cor de fundo e do texto do badge de produto/cor (ex: 310 BRANCO) exibido nas fichas.
            </p>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pré-visualização</label>
              <div className="flex justify-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span
                  className="text-[11px] px-3.5 py-1.5 rounded-full uppercase tracking-widest shadow-lg"
                  style={{
                    backgroundColor: productBadgeBg,
                    color: productBadgeText,
                    boxShadow: `0 4px 12px ${productBadgeBg}30`,
                    fontWeight: productBadgeBold ? 900 : 400,
                    fontStyle: productBadgeItalic ? 'italic' : 'normal',
                  }}
                >
                  310 BRANCO
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cor de Fundo</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={productBadgeBg}
                  onChange={(e) => updateProductBadgeColors(e.target.value, productBadgeText)}
                  className="w-10 h-10 rounded-xl cursor-pointer border-2 border-slate-200 dark:border-slate-700 bg-transparent shrink-0"
                  title="Escolher cor personalizada"
                />
                <div className="flex flex-wrap gap-2 max-w-[320px]">
                  {[
                    '#000000', '#1e293b', '#475569', '#7c3aed', '#4f46e5',
                    '#2563eb', '#0891b2', '#0d9488', '#059669', '#16a34a',
                    '#ca8a04', '#d97706', '#ea580c', '#dc2626', '#e11d48',
                    // Tons suaves/pastéis
                    '#ffffff', '#f1f5f9', '#fce7f3', '#fae8ff', '#ede9fe',
                    '#e0e7ff', '#dbeafe', '#cffafe', '#ccfbf1', '#d1fae5',
                    '#dcfce7', '#fef9c3', '#fef3c7', '#ffedd5', '#fee2e2',
                    '#ffe4e6',
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateProductBadgeColors(c, getContrastingColor(c))}
                      className={`w-7 h-7 rounded-lg border transition-all ${productBadgeBg === c ? 'border-indigo-500 scale-110 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => updateProductBadgeColors(productBadgeBg, '#ffffff')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${productBadgeText === '#ffffff'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-800 dark:border-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-white border border-slate-300 shrink-0" />
                Texto Branco
              </button>
              <button
                type="button"
                onClick={() => updateProductBadgeColors(productBadgeBg, '#000000')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${productBadgeText === '#000000'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-800 dark:border-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-black shrink-0" />
                Texto Preto
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={toggleProductBadgeBold}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${productBadgeBold
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <span className="font-black">N</span> Negrito
              </button>
              <button
                type="button"
                onClick={toggleProductBadgeItalic}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${productBadgeItalic
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <span className="italic font-black">I</span> Itálico
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Texto do Setor/Status */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
              Badge de Setor / Status
            </span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
              Cor do texto do setor/status atual (ex: PREPARAÇÃO E CONFERÊNCIA) exibido nas fichas.
            </p>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pré-visualização</label>
              <div className="flex justify-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span
                  className="text-[11px] uppercase tracking-widest"
                  style={{
                    color: sectorBadgeColor,
                    fontWeight: sectorBadgeBold ? 900 : 400,
                    fontStyle: sectorBadgeItalic ? 'italic' : 'normal',
                  }}
                >
                  {hideSectorBadge ? '(oculto nas fichas)' : 'PREPARAÇÃO E CONFERÊNCIA'}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cor do Texto</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={sectorBadgeColor}
                  onChange={(e) => updateSectorBadgeColor(e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border-2 border-slate-200 dark:border-slate-700 bg-transparent shrink-0"
                  title="Escolher cor personalizada"
                />
                <div className="flex flex-wrap gap-2 max-w-[320px]">
                  {[
                    '#e11d48', '#dc2626', '#ea580c', '#d97706', '#ca8a04',
                    '#16a34a', '#059669', '#0d9488', '#0891b2', '#2563eb',
                    '#4f46e5', '#7c3aed', '#c026d3', '#475569', '#000000',
                    // Tons suaves/pastéis
                    '#ffffff', '#f1f5f9', '#fce7f3', '#fae8ff', '#ede9fe',
                    '#e0e7ff', '#dbeafe', '#cffafe', '#ccfbf1', '#d1fae5',
                    '#dcfce7', '#fef9c3', '#fef3c7', '#ffedd5', '#fee2e2',
                    '#ffe4e6',
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateSectorBadgeColor(c)}
                      className={`w-7 h-7 rounded-lg border transition-all ${sectorBadgeColor === c ? 'border-indigo-500 scale-110 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={toggleSectorBadgeBold}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${sectorBadgeBold
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <span className="font-black">N</span> Negrito
              </button>
              <button
                type="button"
                onClick={toggleSectorBadgeItalic}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${sectorBadgeItalic
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <span className="italic font-black">I</span> Itálico
              </button>
            </div>
            <button
              type="button"
              onClick={toggleHideSectorBadge}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${hideSectorBadge
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                }`}
            >
              {hideSectorBadge ? <Eye size={14} /> : <Eye size={14} className="opacity-50" />}
              {hideSectorBadge ? 'Setor Oculto nas Fichas' : 'Ocultar Nome do Setor nas Fichas'}
            </button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Badge de OS — independente do Mapa, pois uma OS pode reunir pedidos de mapas diferentes */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
              Badge de OS (Ordem de Serviço)
            </span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
              Cor de fundo e do texto da cápsula com o número da OS, exibida no card de cada Ordem de Serviço.
            </p>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pré-visualização</label>
              <div className="flex justify-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span
                  className="text-[11px] px-3.5 py-1.5 rounded-full uppercase tracking-widest shadow-lg"
                  style={{
                    backgroundColor: osBadgeBg,
                    color: osBadgeText,
                    boxShadow: `0 4px 12px ${osBadgeBg}30`,
                    fontWeight: osBadgeBold ? 900 : 400,
                    fontStyle: osBadgeItalic ? 'italic' : 'normal',
                  }}
                >
                  OS-0014
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cor de Fundo</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={osBadgeBg}
                  onChange={(e) => updateOSBadgeColors(e.target.value, osBadgeText)}
                  className="w-10 h-10 rounded-xl cursor-pointer border-2 border-slate-200 dark:border-slate-700 bg-transparent shrink-0"
                  title="Escolher cor personalizada"
                />
                <div className="flex flex-wrap gap-2 max-w-[320px]">
                  {[
                    '#000000', '#1e293b', '#475569', '#7c3aed', '#4f46e5',
                    '#2563eb', '#0891b2', '#0d9488', '#059669', '#16a34a',
                    '#ca8a04', '#d97706', '#ea580c', '#dc2626', '#e11d48',
                    // Tons suaves/pastéis
                    '#ffffff', '#f1f5f9', '#fce7f3', '#fae8ff', '#ede9fe',
                    '#e0e7ff', '#dbeafe', '#cffafe', '#ccfbf1', '#d1fae5',
                    '#dcfce7', '#fef9c3', '#fef3c7', '#ffedd5', '#fee2e2',
                    '#ffe4e6',
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateOSBadgeColors(c, getContrastingColor(c))}
                      className={`w-7 h-7 rounded-lg border transition-all ${osBadgeBg === c ? 'border-indigo-500 scale-110 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => updateOSBadgeColors(osBadgeBg, '#ffffff')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${osBadgeText === '#ffffff'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-800 dark:border-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-white border border-slate-300 shrink-0" />
                Texto Branco
              </button>
              <button
                type="button"
                onClick={() => updateOSBadgeColors(osBadgeBg, '#000000')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${osBadgeText === '#000000'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-800 dark:border-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-black shrink-0" />
                Texto Preto
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={toggleOSBadgeBold}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${osBadgeBold
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <span className="font-black">N</span> Negrito
              </button>
              <button
                type="button"
                onClick={toggleOSBadgeItalic}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${osBadgeItalic
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <span className="italic font-black">I</span> Itálico
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Badge de Prestador de Serviço */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
              Badge de Prestador de Serviço
            </span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
              Cor de fundo e do texto da cápsula com o nome do Prestador de Serviço, exibida no card de cada Ordem de Serviço.
            </p>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pré-visualização</label>
              <div className="flex justify-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span
                  className="text-[11px] px-3.5 py-1.5 rounded-full uppercase tracking-widest shadow-lg"
                  style={{
                    backgroundColor: providerBadgeBg,
                    color: providerBadgeText,
                    boxShadow: `0 4px 12px ${providerBadgeBg}30`,
                    fontWeight: providerBadgeBold ? 900 : 400,
                    fontStyle: providerBadgeItalic ? 'italic' : 'normal',
                  }}
                >
                  Fábrica Musgo
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cor de Fundo</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={providerBadgeBg}
                  onChange={(e) => updateProviderBadgeColors(e.target.value, providerBadgeText)}
                  className="w-10 h-10 rounded-xl cursor-pointer border-2 border-slate-200 dark:border-slate-700 bg-transparent shrink-0"
                  title="Escolher cor personalizada"
                />
                <div className="flex flex-wrap gap-2 max-w-[320px]">
                  {[
                    '#000000', '#1e293b', '#475569', '#7c3aed', '#4f46e5',
                    '#2563eb', '#0891b2', '#0d9488', '#059669', '#16a34a',
                    '#ca8a04', '#d97706', '#ea580c', '#dc2626', '#e11d48',
                    // Tons suaves/pastéis
                    '#ffffff', '#f1f5f9', '#fce7f3', '#fae8ff', '#ede9fe',
                    '#e0e7ff', '#dbeafe', '#cffafe', '#ccfbf1', '#d1fae5',
                    '#dcfce7', '#fef9c3', '#fef3c7', '#ffedd5', '#fee2e2',
                    '#ffe4e6',
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateProviderBadgeColors(c, getContrastingColor(c))}
                      className={`w-7 h-7 rounded-lg border transition-all ${providerBadgeBg === c ? 'border-indigo-500 scale-110 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700 hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => updateProviderBadgeColors(providerBadgeBg, '#ffffff')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${providerBadgeText === '#ffffff'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-800 dark:border-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-white border border-slate-300 shrink-0" />
                Texto Branco
              </button>
              <button
                type="button"
                onClick={() => updateProviderBadgeColors(providerBadgeBg, '#000000')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${providerBadgeText === '#000000'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-800 dark:border-slate-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-black shrink-0" />
                Texto Preto
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={toggleProviderBadgeBold}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${providerBadgeBold
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <span className="font-black">N</span> Negrito
              </button>
              <button
                type="button"
                onClick={toggleProviderBadgeItalic}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${providerBadgeItalic
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
              >
                <span className="italic font-black">I</span> Itálico
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsBadgeColorPickerOpen(false)}
            className="w-full mt-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
          >
            Confirmar Cores
          </button>
        </div>
      </Modal>
    </div>
  );
}

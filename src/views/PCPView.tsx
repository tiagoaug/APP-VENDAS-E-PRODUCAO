import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, ChevronRight, Filter,
  Factory, LayoutDashboard, ListTodo,
  History, MoreVertical, ArrowRight,
  CheckCircle2, AlertCircle, Clock,
  ArrowUpRight, ArrowDownRight, Loader2,
  Settings2, Trash2, Edit3, Edit2, ClipboardList,
  Save, X, Info, Layers, Tag, Package, MinusCircle, CalendarClock, ShoppingCart,
  DollarSign, Hammer, FileText, CheckSquare, Scissors, Printer, Share2,
  QrCode, ScanLine, Hash, Lock, ChevronDown, List
} from 'lucide-react';
import {
  ProductionLot, Product, Sector,
  FlowTag, Variation, ColorValue, ProductionOrder,
  ProductionConfigItem, SoleStockEntry, ViewType, PurchaseRequest, Grid,
  ServiceOrder, Person, Account, Category, Transaction, Purchase, PurchaseType
} from '../types';
import Modal from '../components/Modal';
import ComboBox from '../components/ComboBox';
import ScannerModal from '../components/ScannerModal';
import PrintOSModal from '../components/PrintOSModal';
import PrintLabelEditorModal from '../components/PrintLabelEditorModal';
import { Camera } from 'lucide-react';
import { labelService } from '../services/labelService';
import { printLotSheet, shareImage } from '../utils/pdfExport';
import { scannerService } from '../services/scannerService';
import { financeService } from '../services/financeService';
import WebCameraScanner from '../components/WebCameraScanner';
import { Capacitor } from '@capacitor/core';
import { firebaseService } from '../services/firebaseService';
import CuttingProjectionPanel from '../components/CuttingProjectionPanel';

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
  purchaseRequests?: PurchaseRequest[];
  isDarkMode: boolean;
  onSaveLot: (lot: ProductionLot) => Promise<void>;
  onDeleteLot: (id: string) => Promise<void>;
  onNavigate: (view: ViewType, params?: any) => void;
  onRequestPurchase?: (req: Omit<PurchaseRequest, 'id'>) => Promise<void>;
  onBack: () => void;
  userName?: string;
  initialTab?: 'monitor' | 'lots' | 'orders' | 'needs';
  people?: Person[];
  accounts?: Account[];
  categories?: Category[];
  serviceOrders?: ServiceOrder[];
  purchases?: Purchase[];
  sales?: import('../types').Sale[];
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
  purchaseRequests = [],
  isDarkMode,
  onSaveLot,
  onDeleteLot,
  onNavigate,
  onRequestPurchase,
  onBack,
  userName,
  initialTab = 'monitor',
  people = [],
  accounts = [],
  categories = [],
  serviceOrders = [],
  purchases = [],
  sales = [],
}: PCPViewProps) {
  const [activeTab, setActiveTab] = useState<'monitor' | 'lots' | 'orders' | 'needs'>(initialTab);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [inTransitPopupItem, setInTransitPopupItem] = useState<any | null>(null);
  const [expandedNeedIds, setExpandedNeedIds] = useState<Set<string>>(new Set());
  const toggleNeedExpand = (id: string) => setExpandedNeedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'finished' | 'urgent'>('active');
  const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<ProductionLot | null>(null);
  const [selectedLots, setSelectedLots] = useState<ProductionLot[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSoleOrderModalOpen, setIsSoleOrderModalOpen] = useState(false);
  const [selectedSoleNeed, setSelectedSoleNeed] = useState<any>(null);
  const [extraSoleQty, setExtraSoleQty] = useState<Record<string, number>>({});
  const [isProjectionMode, setIsProjectionMode] = useState(true);

  // Service Order (OS) state declarations
  const [isOSModalOpen, setIsOSModalOpen] = useState(false);
  const [editingOS, setEditingOS] = useState<ServiceOrder | null>(null);
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
  const [selectedSourceItemKeys, setSelectedSourceItemKeys] = useState<Set<string>>(new Set());
  const [expandedSourceItems, setExpandedSourceItems] = useState<Set<string>>(new Set());
  const [sourceFilterModel, setSourceFilterModel] = useState<string>('');
  const [sourceFilterColor, setSourceFilterColor] = useState<string>('');
  const [osFeedback, setOsFeedback] = useState<{ osNumber: string; nextSector: string; action?: string } | null>(null);
  const [moveSectorModal, setMoveSectorModal] = useState<{ lotId: string; orderIds: string[]; qty: number; fromSectorId?: string } | null>(null);
  const [moveSectorTarget, setMoveSectorTarget] = useState<string>('');
  const [expandedOSIds, setExpandedOSIds] = useState<Set<string>>(new Set());
  const [expandedOSItemKeys, setExpandedOSItemKeys] = useState<Set<string>>(new Set());
  const [pendingOsSourceOrderIds, setPendingOsSourceOrderIds] = useState<string[]>([]);
  const [pendingOsSectorOverride, setPendingOsSectorOverride] = useState<string>('');
  const [pendingOsQuantityOverride, setPendingOsQuantityOverride] = useState<number | null>(null);

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
  
  const filteredActiveLots = useMemo(() => {
    return filteredLots.filter(l => !l.finishedAt);
  }, [filteredLots]);

  const isCuttingSector = useMemo(() => {
    if (!selectedSectorId) return false;
    const currentSector = sectors.find(s => s.id === selectedSectorId);
    return currentSector?.name.toLowerCase().includes('corte') || false;
  }, [selectedSectorId, sectors]);

  const knives = useMemo(() => productionConfigs.filter(c => c.type === 'TOOL'), [productionConfigs]);

  // Sector Metrics for Dashboard
  const sectorMetrics = useMemo(() => {
    const metrics: Record<string, {
      totalPares: number;     // pares do lote no setor (desconta movidos)
      lotsCount: number;
      delayedCount: number;
      urgentCount: number;
      movedOutPairs: number;  // pares que saíram deste setor via orderSectors
      arrivedPairs: number;   // pares que chegaram de outro setor via orderSectors
      arrivedOrders: number;  // número de pedidos vindos de outro setor
    }> = {};

    sectors.forEach(s => {
      metrics[s.id] = { totalPares: 0, lotsCount: 0, delayedCount: 0, urgentCount: 0, movedOutPairs: 0, arrivedPairs: 0, arrivedOrders: 0 };
    });

    filteredActiveLots.forEach(lot => {
      const sectorId = (lot.route && lot.route[lot.currentSectorIndex]);
      const orderSectors: Record<string, string> = (lot as any).metadata?.orderSectors || {};
      const lotSI: any[] = (lot as any).metadata?.sourceItems || [];

      if (sectorId && metrics[sectorId]) {
        // Pares movidos para fora — descontar do setor atual do lote
        let movedOut = 0;
        lotSI.forEach((si: any) => {
          if (orderSectors[si.orderId] && orderSectors[si.orderId] !== sectorId) {
            movedOut += si.qty || 0;
          }
        });
        metrics[sectorId].movedOutPairs += movedOut;
        metrics[sectorId].totalPares += Math.max(0, lot.quantity - movedOut);
        metrics[sectorId].lotsCount += 1;

        const lastMove = (lot.history && lot.history.length > 0)
          ? lot.history[lot.history.length - 1]?.timestamp || lot.createdAt
          : lot.createdAt;
        if (Date.now() - lastMove > 24 * 60 * 60 * 1000) metrics[sectorId].delayedCount += 1;
        if (lot.prioridade === 'URGENTE' || lot.prioridade === 'ALTA') metrics[sectorId].urgentCount += 1;
      }

      // Pedidos adiantados para outro setor — contam como JÁ PRESENTES naquele setor
      lotSI.forEach((si: any) => {
        const destSector = orderSectors[si.orderId];
        if (destSector && destSector !== sectorId && metrics[destSector]) {
          metrics[destSector].arrivedPairs += si.qty || 0;
          metrics[destSector].arrivedOrders += 1;
          // Já estão no setor destino — somam ao total de pares
          metrics[destSector].totalPares += si.qty || 0;
        }
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

  const purchaseNeeds = useMemo(() => {
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

    activeLots.forEach(lot => {
      const product = products.find(p => p.id === lot.productId);

      // Para mapas multi-variação (variationId vazio), expande os grupos via metadata
      const lotGroups: { productId: string; variationId: string; pairs: Record<string, number> }[] = [];

      if (!lot.variationId && (lot as any).metadata?.groups?.length > 0) {
        const groupsMeta: any[] = (lot as any).metadata.groups;
        const totalGroupQty = groupsMeta.reduce((s: number, g: any) => s + (g.quantity || 0), 0);
        groupsMeta.forEach((g: any) => {
          let gPairs: Record<string, number>;
          if (g.pairs && Object.keys(g.pairs).length > 0) {
            // Novo: pares por grupo salvos corretamente
            gPairs = g.pairs;
          } else {
            // Legado: distribui lot.pairs proporcionalmente pelo peso do grupo
            const ratio = totalGroupQty > 0 ? (g.quantity || 0) / totalGroupQty : 0;
            gPairs = {};
            Object.entries(lot.pairs || {}).forEach(([size, qty]) => {
              const v = Math.round(Number(qty) * ratio);
              if (v > 0) gPairs[size] = v;
            });
          }
          lotGroups.push({ productId: g.productId, variationId: g.variationId, pairs: gPairs });
        });
      } else {
        lotGroups.push({ productId: lot.productId, variationId: lot.variationId, pairs: lot.pairs || {} });
      }

      lotGroups.forEach(({ productId, variationId, pairs: groupPairs }) => {
      const groupProduct = products.find(p => p.id === productId) || product;
      const variation = groupProduct?.variations.find(v => v.id === variationId);

      if (!variation) return;

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
          materialReqs[key] = {
            id: key,
            materialId: cons.materialId,
            name: colorName ? `${config?.name || cons.name} — ${colorName}` : (config?.name || cons.name),
            required: 0,
            stock: config?.metadata?.stock || 0,
            minStock: config?.metadata?.minStock || 0,
            unit: productionConfigs.find(c => c.id === config?.metadata?.unitId)?.name || 'UN',
            type: 'MATERIAL',
            colorId: colorKey || undefined,
            contributingLots: []
          };
        }
        // 'grade' basis: 1 caixa coletiva por grade, não por par
        // Retrocompat: se quantity < 1 (valor legado ex. 0.0833 = 1/12), infere pares/grade e converte
        let lotMultiplier: number;
        if (cons.consumptionBasis === 'grade') {
          if (lot.gradesQty) {
            lotMultiplier = lot.gradesQty;
          } else if (cons.quantity > 0 && cons.quantity < 1) {
            // legado: 0.0833 → pairsPerGrade ≈ round(1/0.0833) = 12
            const pairsPerGrade = Math.round(1 / cons.quantity);
            lotMultiplier = Math.round(lot.quantity / Math.max(1, pairsPerGrade));
          } else {
            // Tenta obter pairsPerGrade pelo grid do produto para maior precisão
            const gridId = product?.productionGridId || product?.defaultGridId;
            const grid = grids.find(gr => gr.id === gridId);
            const pairsPerGrade = grid ? Object.values(grid.configuration).reduce((a: number, b: number) => a + b, 0) : 12;
            lotMultiplier = Math.round(lot.quantity / Math.max(1, pairsPerGrade));
          }
        } else {
          lotMultiplier = lot.quantity;
        }
        // Para /grade sempre arredonda para inteiro (caixas são unidades inteiras)
        const reqIncrement = cons.consumptionBasis === 'grade'
          ? Math.round(lotMultiplier * (cons.quantity < 1 ? 1 : cons.quantity))
          : lotMultiplier * cons.quantity;
        materialReqs[key].required += reqIncrement;
        if (!materialReqs[key].contributingLots.includes(lot.orderNumber)) {
          materialReqs[key].contributingLots.push(lot.orderNumber);
        }
      });

      // 2. Soles — hierarquia: variation.soleMapping > product.soleMapping > product.moldId (molde único p/ todos os tamanhos)
      let mapping: Record<string, string> | null = null;
      if (variation.soleMapping && Object.keys(variation.soleMapping).length > 0) {
        mapping = variation.soleMapping;
      } else if (product?.soleMapping && Object.keys(product.soleMapping).length > 0) {
        mapping = product.soleMapping;
      } else if (product?.moldId) {
        // Fallback: molde único — expande as faixas do soleStock para tamanhos individuais válidos.
        // Isso evita que tamanhos do lote que não pertencem a nenhuma faixa registrada (ex: 42 quando
        // só existem "38-39", "40-41", "43-44") apareçam como necessidade de compra.
        const stockEntries = soleStock.filter(s => s.moldId === product.moldId);
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

        // Usa tamanhos válidos do estoque; se não houver estoque ainda, usa tamanhos do lote
        const sizesToMap = validSizes.size > 0
          ? Array.from(validSizes)
          : (groupPairs && Object.keys(groupPairs).length > 0 ? Object.keys(groupPairs) : []);

        if (sizesToMap.length > 0) {
          mapping = {};
          sizesToMap.forEach(size => { mapping![size] = product!.moldId!; });
        }
      }

      if (mapping) {
        // Monta pares efetivos por tamanho
        const effectivePairs: Record<string, number> = { ...(groupPairs || {}) };
        if (Object.keys(effectivePairs).length === 0 && lot.quantity > 0) {
          const mappingSizes = Object.keys(mapping);
          if (mappingSizes.length > 0) {
            const qtyPerSize = Math.floor(lot.quantity / mappingSizes.length);
            const remainder = lot.quantity % mappingSizes.length;
            mappingSizes.forEach((size, idx) => {
              effectivePairs[size] = qtyPerSize + (idx < remainder ? 1 : 0);
            });
          }
        }

        Object.entries(effectivePairs).forEach(([size, qty]) => {
          if (qty <= 0) return;
          let mappedId = String(mapping[size] || '').trim();
          if (!mappedId) return;

          // Tenta resolver o moldId REAL. Se o que está no mapeamento não for um molde conhecido, 
          // mas for uma chave de grade existente no estoque, usamos o moldId do estoque.
          let resolvedMoldId = mappedId;
          const isKnownMold = productionConfigs.some(c => c.id === mappedId);
          if (!isKnownMold) {
            const entry = soleStock.find(s => Object.keys(s.stock).some(k => String(k).trim() === mappedId));
            if (entry) resolvedMoldId = entry.moldId;
          }

          const colorId = String(variation.soleColorId || '').trim();
          const key = `SOLE_${resolvedMoldId}_${colorId || 'default'}`;
          
          // Resolve a grade da sola (ex: 38 -> "38-39"); null = tamanho não existe nesta sola
          const gradeKey = getGradeForSize(resolvedMoldId, size);
          if (!gradeKey) return;

          const mold = productionConfigs.find(c => c.id === resolvedMoldId);
          const color = colors.find(c => c.id === colorId);
          
          // Calcula estoque EXCLUSIVAMENTE para este molde + cor (sem fallback para outras cores)
          const currentGradeStock = soleStock
            .filter(s => String(s.moldId).trim() === resolvedMoldId && String(s.colorId || '').trim() === colorId)
            .reduce((sum, s) => sum + (Number(s.stock[gradeKey]) || 0), 0);

          if (!materialReqs[key]) {
            materialReqs[key] = {
              id: key,
              moldId: resolvedMoldId,
              colorId: colorId,
              name: `${mold?.name || 'Solado'} - ${color?.name || 'Cor Padrão'}`,
              required: 0,
              stock: 0,
              minStock: 0,
              unit: 'PAR',
              type: 'SOLE',
              sizeShortages: {},
              contributingLots: []
            };
          }
          
          materialReqs[key].required += qty;
          if (!materialReqs[key].contributingLots.includes(lot.orderNumber)) {
            materialReqs[key].contributingLots.push(lot.orderNumber);
          }
          
          if (!materialReqs[key].sizeShortages![gradeKey]) {
            materialReqs[key].sizeShortages![gradeKey] = { required: 0, stock: currentGradeStock };
          }
          materialReqs[key].sizeShortages![gradeKey].required += qty;
        });
      }
      }); // end lotGroups.forEach
    }); // end activeLots.forEach

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
  }, [activeLots, productionConfigs, soleStock, products, colors]);

  // Pedidos que ainda não têm um mapa ativo em produção
  const pendingOrders = useMemo(() => {
    return productionOrders.filter(order => 
      order.status === 'PENDING' && 
      !lots.some(lot => lot.productionOrderId === order.id && !lot.finishedAt)
    );
  }, [productionOrders, lots]);

  // State para seleção de itens de pedidos para formar um mapa (carrinho)
  const [selectedOrderItems, setSelectedOrderItems] = useState<{orderId: string, itemIdx: number}[]>([]);

  // Seleção de fichas individuais para emissão de OS (key = `${lotId}::${orderId}::${idx}`)
  const [fichaSelection, setFichaSelection] = useState<Set<string>>(new Set());
  const [fichaListOpen, setFichaListOpen] = useState<Set<string>>(new Set()); // expanded lot keys
  const [fichaItemExpanded, setFichaItemExpanded] = useState<Set<string>>(new Set()); // expanded grade keys
  const [fichaFilters, setFichaFilters] = useState<Record<string, { model: string; color: string }>>({});

  // Itens de pedidos pendentes decupados
  const pendingItems = useMemo(() => {
    const items: any[] = [];
    pendingOrders.forEach(order => {
      order.items.forEach((item, idx) => {
        if (item.toProductionQty > 0) {
          items.push({
            ...item,
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            deliveryDate: order.deliveryDate,
            saleOrderNumber: order.saleOrderNumber,
            saleId: order.saleId,
            itemIdx: idx,
            uniqueKey: `${order.id}-${idx}`
          });
        }
      });
    });
    return items;
  }, [pendingOrders]);

  // Agrupamento de itens pendentes por Modelo e Cor para análise
  const groupedPendingItems = useMemo(() => {
    const groups: Record<string, {
      productId: string;
      productName: string;
      variationId: string;
      variationName: string;
      totalQty: number;
      orders: any[];
    }> = {};

    pendingItems.forEach(item => {
      const key = `${item.productId}-${item.variationId}`;
      if (!groups[key]) {
        groups[key] = {
          productId: item.productId,
          productName: item.productName,
          variationId: item.variationId,
          variationName: item.variationName,
          totalQty: 0,
          orders: []
        };
      }
      groups[key].totalQty += item.toProductionQty;
      groups[key].orders.push(item);
    });

    return Object.values(groups).sort((a, b) => b.totalQty - a.totalQty);
  }, [pendingItems]);

  // Lot Creation State
  const [newLot, setNewLot] = useState<Partial<ProductionLot>>({
    prioridade: 'NORMAL',
    quantity: 0
  });

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

  // Automatically calculate custom delivery date when creating a brand new lot and modal opens
  useEffect(() => {
    if (isCreateModalOpen && !newLot.id && !newLot.deliveryDate) {
      const defaultDays = getDefaultDaysForDeadline(newLot.prioridade || 'NORMAL');
      const calculatedDate = Date.now() + defaultDays * 24 * 60 * 60 * 1000;
      setNewLot(prev => ({
        ...prev,
        deliveryDate: calculatedDate
      }));
    }
  }, [isCreateModalOpen]);

  const deadlineConfigs = useMemo(() => {
    return (productionConfigs || []).filter(c => c.type === 'DEADLINE');
  }, [productionConfigs]);

  const priorityOptions = useMemo(() => {
    if (deadlineConfigs.length > 0) {
      return deadlineConfigs.map(c => c.name.toUpperCase().trim());
    }
    return ['NORMAL', 'ALTA', 'URGENTE'];
  }, [deadlineConfigs]);

  const handlePriorityChange = (p: string) => {
    const defaultDays = getDefaultDaysForDeadline(p);
    const calculatedDate = Date.now() + defaultDays * 24 * 60 * 60 * 1000;
    setNewLot(prev => ({
      ...prev,
      prioridade: p,
      deliveryDate: calculatedDate
    }));
  };

  const handleCreateLot = async () => {
    if (!newLot.productId || !newLot.variationId || !newLot.quantity) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    // Validação: Uma OP só pode estar em um mapa ativo (ignorando o lote atual se for edição)
    if (newLot.productionOrderId) {
      const existingLot = lots.find(l => l.productionOrderId === newLot.productionOrderId && !l.finishedAt && l.id !== newLot.id);
      if (existingLot) {
        alert(`Esta OP já possui um mapa em andamento (${existingLot.orderNumber}). Não é possível criar múltiplos mapas para a mesma OP.`);
        return;
      }
    }

    const product = products.find(p => p.id === newLot.productId);
    if (!product) return;

    if (newLot.id) {
      // MODO EDIÇÃO
      const existingLot = lots.find(l => l.id === newLot.id);
      if (!existingLot) return;

      await onSaveLot({
        ...existingLot,
        productId: newLot.productId,
        variationId: newLot.variationId,
        quantity: newLot.quantity,
        prioridade: newLot.prioridade || 'NORMAL',
        deliveryDate: newLot.deliveryDate || undefined,
      } as ProductionLot);
    } else {
      // MODO CRIAÇÃO
      const lot: ProductionLot = {
        id: Math.random().toString(36).substr(2, 9),
        orderNumber: `MAPA #${String(lots.length + 1).padStart(3, '0')}`,
        productId: newLot.productId,
        variationId: newLot.variationId,
        quantity: newLot.quantity,
        route: product.productionRoute || sectors.map(s => s.id),
        currentSectorIndex: 0,
        prioridade: newLot.prioridade || 'NORMAL',
        history: [{
          sectorId: (product.productionRoute || sectors.map(s => s.id))[0],
          statusId: '',
          timestamp: Date.now(),
          userName: userName,
          notes: newLot.productionOrderId ? `Criado via ${newLot.productionOrderId}` : 'MAPA criado'
        }],
        createdAt: Date.now(),
        ...(newLot.saleId && { saleId: newLot.saleId }),
        ...(newLot.productionOrderId && { productionOrderId: newLot.productionOrderId }),
        ...(newLot.customerName && { customerName: newLot.customerName }),
        ...(newLot.deliveryDate && { deliveryDate: newLot.deliveryDate }),
        ...(newLot.saleOrderNumber && { saleOrderNumber: newLot.saleOrderNumber }),
      };

      await onSaveLot(lot);
    }

    setIsCreateModalOpen(false);
    setNewLot({ prioridade: 'NORMAL', quantity: 0 });
  };

  // Bloqueia avanço do mapa inteiro se houver OS pendente
  const hasPendingOS = (lot: ProductionLot): boolean => {
    const currentSectorId = lot.route?.[lot.currentSectorIndex];
    return serviceOrders.some(so =>
      (so.lotId === lot.id || so.lotIds?.includes(lot.id)) &&
      so.sectorId === currentSectorId &&
      so.status === 'PENDING'
    );
  };

  // Move pedidos individuais para um setor específico (apenas para OS já concluídas)
  const handleMoveOrdersToSector = async (lotId: string, orderIds: string[], targetSectorId: string) => {
    const lot = lots.find(l => l.id === lotId);
    if (!lot) return;
    const currentOrderSectors: Record<string, string> = (lot as any).metadata?.orderSectors || {};
    const updatedOrderSectors = { ...currentOrderSectors };
    orderIds.forEach(oid => { updatedOrderSectors[oid] = targetSectorId; });
    const allSI: any[] = (lot as any).metadata?.sourceItems || [];
    const allAdvanced = allSI.length > 0 && allSI.every((si: any) => updatedOrderSectors[si.orderId]);
    if (allAdvanced) {
      const nextIdx = lot.currentSectorIndex + 1;
      if (nextIdx < (lot.route?.length || 0)) {
        await onSaveLot({
          ...lot,
          currentSectorIndex: nextIdx,
          currentStatusId: undefined,
          metadata: { ...(lot as any).metadata, orderSectors: updatedOrderSectors },
          history: [...(lot.history || []), { sectorId: lot.route?.[lot.currentSectorIndex] || '', statusId: '', timestamp: Date.now(), userName: userName || 'Usuário', notes: 'Todos os pedidos movidos manualmente.' }],
        });
      }
    } else {
      await firebaseService.updateDocument('productionLots', lotId, {
        metadata: { ...(lot as any).metadata, orderSectors: updatedOrderSectors }
      });
    }
    setMoveSectorModal(null);
    setMoveSectorTarget('');
    setSelectedSourceItemKeys(new Set());
    setOsFeedback({ osNumber: `${orderIds.length} pedido(s)`, nextSector: sectors.find(s => s.id === targetSectorId)?.name || targetSectorId, action: 'Movidos para o setor com sucesso.' });
  };

  const handleMoveLotSilent = async (lot: ProductionLot, nextStatusId: string, notes: string) => {
    const isLastSector = lot.route && lot.currentSectorIndex === lot.route.length - 1;

    const updatedLot: ProductionLot = {
      ...lot,
      currentStatusId: nextStatusId,
      history: [
        ...(lot.history || []),
        {
          sectorId: lot.route?.[lot.currentSectorIndex] || '',
          statusId: nextStatusId,
          timestamp: Date.now(),
          userName: userName,
          notes: notes
        }
      ]
    };

    if (isLastSector) {
      updatedLot.finishedAt = Date.now();
    } else {
      updatedLot.currentSectorIndex += 1;
      updatedLot.currentStatusId = undefined;
    }

    await onSaveLot(updatedLot);
  };

  const handleMoveLot = async (lot: ProductionLot, nextStatusId: string, notes: string) => {
    await handleMoveLotSilent(lot, nextStatusId, notes);
    setIsDetailModalOpen(false);
    setSelectedLot(null);
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

  const handleOpenOSModal = (lotsToProcess: ProductionLot | ProductionLot[], _sectorOverride?: string, _qtyOverride?: number) => {
    const list = Array.isArray(lotsToProcess) ? lotsToProcess : [lotsToProcess];

    // Guard: block duplicate whole-lot OS creation
    const firstLot = list[0];
    // Usa setor efetivo: override para pedidos adiantados, senão setor atual do lote
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
        alert(`Já existe a OS ${blockingOS.osNumber} em aberto para este lote em "${sectorName}". Conclua ou exclua-a antes de emitir uma nova.`);
        return;
      }
    }

    setSelectedLots(list);

    if (!Array.isArray(lotsToProcess)) {
      setSelectedLot(lotsToProcess);
    } else {
      setSelectedLot(null);
    }

    let nextNum = 1;
    if (serviceOrders && serviceOrders.length > 0) {
      serviceOrders.forEach(so => {
        const match = so.osNumber.match(/OS-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= nextNum) {
            nextNum = num + 1;
          }
        }
      });
    }
    const formattedOSNum = `OS-${String(nextNum).padStart(4, '0')}`;
    setOsNumber(formattedOSNum);

    setOsType('OUTSOURCED');

    const lot = list[0];
    // Usa setor override quando os pedidos foram adiantados para outro setor
    // _sectorOverride tem prioridade pois é passado diretamente (evita problema de timing do state)
    const effectiveSectorId = _sectorOverride || pendingOsSectorOverride || (lot.route && lot.route[lot.currentSectorIndex]);
    const currentSector = sectors.find(s => s.id === effectiveSectorId);
    
    if (currentSector && currentSector.defaultServiceProviderId) {
      setOsProviderId(currentSector.defaultServiceProviderId);
      setOsProviderManualName(currentSector.defaultServiceProviderName || '');
    } else {
      const workers = people.filter(p => p.isSupplier || (p as any).isWorker || (p as any).role);
      if (workers.length > 0) {
        setOsProviderId(workers[0].id);
        setOsProviderManualName(workers[0].name);
      } else if (people.length > 0) {
        setOsProviderId(people[0].id);
        setOsProviderManualName(people[0].name);
      } else {
        setOsProviderId('');
        setOsProviderManualName('');
      }
    }

    // Para pedidos adiantados, usa o produto do primeiro pedido selecionado
    const resolvedProductId = (() => {
      if ((_sectorOverride || pendingOsSectorOverride) && pendingOsSourceOrderIds.length > 0) {
        const si = ((lot as any).metadata?.sourceItems || []).find((s: any) => s.orderId === pendingOsSourceOrderIds[0]);
        return si?.productId || lot.productId;
      }
      return lot.productId;
    })();
    const lotProduct = products.find(p => p.id === resolvedProductId);
    const productSectorPrice = lotProduct?.sectorPrices?.[(currentSector?.id || '')];
    if (productSectorPrice !== undefined) {
      setOsValuePerPair(productSectorPrice);
    } else if (currentSector && currentSector.defaultServiceValue !== undefined) {
      setOsValuePerPair(currentSector.defaultServiceValue);
    } else {
      setOsValuePerPair(0);
    }

    setOsNotes('');

    const defAccount = accounts.find(a => a.isDefault) || accounts[0];
    setOsAccountId(defAccount?.id || '');

    const prodCategory = categories.find(c => 
      c.type === 'EXPENSE' && 
      (c.name.toLowerCase().includes('produ') || c.name.toLowerCase().includes('mão') || c.name.toLowerCase().includes('obra') || c.name.toLowerCase().includes('servi'))
    ) || categories.find(c => c.type === 'EXPENSE');
    setOsCategoryId(prodCategory?.id || '');

    setOsDirectComplete(false);
    setOsNaoContabil(false);
    setIsOSModalOpen(true);
  };

  const handleSaveOS = async () => {
    const targetLots = selectedLots.length > 0 ? selectedLots : (selectedLot ? [selectedLot] : []);
    if (targetLots.length === 0) return;
    if (!osNumber.trim()) {
      alert("Por favor, digite o número da OS.");
      return;
    }

    const firstLot = targetLots[0];
    // Usa setor override (pedidos adiantados) ou setor do lote
    const resolvedSectorId = pendingOsSectorOverride || (firstLot.route && firstLot.route[firstLot.currentSectorIndex]);
    const currentSector = sectors.find(s => s.id === resolvedSectorId);
    if (!currentSector) {
      alert("Setor atual inválido.");
      return;
    }

    // Trava: impede duplicação de OS do lote inteiro
    // Para OS por pedido, a UI já impede via checkbox desabilitado em pedidos com OS ativa
    if (!editingOS && pendingOsSourceOrderIds.length === 0) {
      for (const lot of targetLots) {
        const existing = serviceOrders.find(so =>
          (so.lotId === lot.id || (so.lotIds && so.lotIds.includes(lot.id))) &&
          so.sectorId === currentSector.id &&
          so.status === 'PENDING' &&
          (!so.sourceOrderIds || so.sourceOrderIds.length === 0)
        );
        if (existing) {
          alert(`Já existe a OS ${existing.osNumber} em aberto para este lote no setor "${currentSector.name}". Conclua ou exclua-a antes de criar uma nova.`);
          return;
        }
      }
    }

    const product = products.find(p => p.id === firstLot.productId);
    const variation = product?.variations.find(v => v.id === firstLot.variationId);

    const providerName = osProviderId 
      ? (people.find(p => p.id === osProviderId)?.name || osProviderManualName)
      : osProviderManualName;

    if (!providerName.trim()) {
      alert("Por favor, selecione ou digite o prestador de serviço.");
      return;
    }

    if (osValuePerPair < 0) {
      alert("O valor por par não pode ser negativo.");
      return;
    }

    setIsSavingOS(true);
    try {
      // Usa quantidade override para pedidos adiantados, senão soma do lote
      const quantity = pendingOsQuantityOverride ?? targetLots.reduce((acc, l) => acc + (l.quantity || 0), 0);
      const totalValue = quantity * osValuePerPair;

      // --- MODO EDIÇÃO ---
      if (editingOS) {
        let newTransactionId = editingOS.transactionId;
        if (editingOS.transactionId) {
          await financeService.deleteTransaction(editingOS.transactionId);
          newTransactionId = undefined;
        }
        if (!osNaoContabil && osAccountId && osCategoryId && totalValue > 0) {
          const txId = `tx_os_${editingOS.id}`;
          await financeService.createTransaction({
            id: txId,
            type: 'EXPENSE',
            amount: totalValue,
            description: `Mão de Obra - OS ${editingOS.osNumber} (Lote: ${firstLot.orderNumber} - Setor: ${currentSector.name})`,
            accountId: osAccountId,
            categoryId: osCategoryId,
            date: Date.now(),
            status: 'PENDING',
            personId: osProviderId || undefined,
            notes: `OS Número: ${editingOS.osNumber}\nPrestador: ${providerName}\nQuantidade: ${quantity} pares\nValor por par: R$ ${osValuePerPair.toFixed(2)}`
          });
          newTransactionId = txId;
        }
        await firebaseService.updateDocument("serviceOrders", editingOS.id, {
          type: osType,
          providerId: osProviderId || undefined,
          providerName,
          valuePerPair: osValuePerPair,
          totalValue,
          notes: osNotes,
          transactionId: newTransactionId || undefined,
        });
        alert("Ordem de Serviço atualizada com sucesso!");
        setEditingOS(null);
        setIsOSModalOpen(false);
        return;
      }

      // --- MODO CRIAÇÃO ---
      const isPerOrderOS = pendingOsSourceOrderIds.length > 0;
      const uniqueId = `os_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      let transactionId = '';
      if (!osNaoContabil && osAccountId && osCategoryId && totalValue > 0) {
        const txId = `tx_os_${uniqueId}`;
        const txData = {
          id: txId,
          type: 'EXPENSE',
          amount: totalValue,
          description: `Mão de Obra - OS ${osNumber} (${targetLots.length === 1 ? `Lote: ${firstLot.orderNumber}` : `${targetLots.length} Lotes`} - Setor: ${currentSector.name})`,
          accountId: osAccountId,
          categoryId: osCategoryId,
          date: Date.now(),
          status: osDirectComplete ? 'COMPLETED' : 'PENDING',
          personId: osProviderId || undefined,
          notes: `OS Número: ${osNumber}\nPrestador: ${providerName}\nLotes: ${targetLots.map(l => l.orderNumber).join(', ')}\nQuantidade: ${quantity} pares\nValor por par: R$ ${osValuePerPair.toFixed(2)}`
        };

        await financeService.createTransaction(txData);
        transactionId = txId;
      }

      const newOS: ServiceOrder = {
        id: uniqueId,
        osNumber: osNumber,
        lotId: firstLot.id,
        lotNumber: firstLot.orderNumber,
        lotIds: targetLots.map(l => l.id),
        lotNumbers: targetLots.map(l => l.orderNumber),
        productId: firstLot.productId,
        productName: product?.name || '',
        variationId: firstLot.variationId,
        variationName: variation?.colorName || '',
        sectorId: pendingOsSectorOverride || currentSector.id,
        sectorName: (pendingOsSectorOverride ? sectors.find(s => s.id === pendingOsSectorOverride)?.name : undefined) || currentSector.name,
        type: osType,
        providerId: osProviderId || undefined,
        providerName: providerName,
        quantity: quantity,
        valuePerPair: osValuePerPair,
        totalValue: totalValue,
        notes: osNotes,
        status: osDirectComplete ? 'COMPLETED' : 'PENDING',
        transactionId: transactionId || undefined,
        createdAt: Date.now(),
        finishedAt: osDirectComplete ? Date.now() : undefined,
        ...(pendingOsSourceOrderIds.length > 0 && { sourceOrderIds: pendingOsSourceOrderIds })
      };

      await firebaseService.saveDocument("serviceOrders", newOS);
      setPendingOsSourceOrderIds([]);
      setPendingOsSectorOverride('');
      setPendingOsQuantityOverride(null);

      if (osDirectComplete) {
        for (const lot of targetLots) {
          await handleMoveLotSilent(lot, lot.currentStatusId || '', `Baixa automática via OS ${osNumber}. ${osNotes}`);
        }
      }

      alert("Ordem de Serviço criada com sucesso!");
      setIsOSModalOpen(false);
      if (!isPerOrderOS) setIsDetailModalOpen(false);

      // Reset multi-select states
      setSelectedLotIds([]);
      setIsMultiSelectMode(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar Ordem de Serviço: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSavingOS(false);
    }
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
      alert('Erro ao gerar imagem. Tente novamente.');
    } finally {
      setIsShareExporting(false);
    }
  };

  const handleCompleteOS = async (os: ServiceOrder) => {
    if (!confirm(`Deseja concluir a Ordem de Serviço ${os.osNumber}?`)) return;
    try {
      const lotId = os.lotId || os.lotIds?.[0] || '';
      if (!lotId) { alert('OS sem lote vinculado.'); return; }

      const lotObj = lots.find(l => l.id === lotId || (os.lotIds && os.lotIds.includes(l.id)));
      if (!lotObj) { alert('Lote não encontrado.'); return; }

      const sectorId = os.sectorId || (lotObj.route?.[lotObj.currentSectorIndex] ?? '');
      // Calcula próximo setor a partir da posição da OS no roteiro (não do lote)
      // Isso garante que pedidos adiantados avancem corretamente sem pular setores
      const osSectorIdx = lotObj.route?.indexOf(sectorId) ?? lotObj.currentSectorIndex ?? 0;
      const nextSectorIdx = osSectorIdx + 1;
      const nextSectorId = lotObj.route?.[nextSectorIdx] ?? '';
      const nextSectorName = sectors.find(s => s.id === nextSectorId)?.name || 'CONCLUÍDO';

      // 1. Mark OS as completed
      await firebaseService.updateDocument('serviceOrders', os.id, {
        status: 'COMPLETED',
        finishedAt: Date.now(),
      });

      // 2. Settle transaction if present
      if (os.transactionId) {
        try { await financeService.settleTransaction(os.transactionId); } catch { /* ignore */ }
      }

      // 2b. Se setor atual é Expedição → baixa automática (entrega ou estoque)
      const currentSectorObj = sectors.find(s => s.id === sectorId);
      const isExpedicao = currentSectorObj?.name?.toLowerCase().includes('expedi');
      if (isExpedicao && os.sourceOrderIds && os.sourceOrderIds.length > 0) {
        const uniqueOrderIds = Array.from(new Set(os.sourceOrderIds));
        const customerItems: string[] = [];
        const stockItems: string[] = [];

        for (const oid of uniqueOrderIds) {
          const prodOrder = productionOrders.find(o => o.id === oid);
          if (!prodOrder) continue;
          const sale = sales?.find(s => s.id === prodOrder.saleId);
          if (sale?.saleDestination === 'STOCK') {
            stockItems.push(oid);
          } else {
            customerItems.push(oid);
          }
        }

        // Monta mensagem de confirmação
        const lines: string[] = [`Setor de Expedição — ${os.osNumber}`];
        if (customerItems.length > 0) lines.push(`📦 ${customerItems.length} pedido(s) → ENTREGA AO CLIENTE`);
        if (stockItems.length > 0) lines.push(`🏭 ${stockItems.length} pedido(s) → ENTRADA EM ESTOQUE`);
        lines.push('\nConfirmar baixa de expedição?');

        if (!confirm(lines.join('\n'))) return;

        // Executa entrada em estoque para pedidos de estoque
        if (stockItems.length > 0) {
          const lotSI: any[] = (lotObj as any).metadata?.sourceItems || [];
          const stockSI = lotSI.filter((si: any) => stockItems.includes(si.orderId));
          for (const si of stockSI) {
            const prodOrder = productionOrders.find(o => o.id === si.orderId);
            if (!prodOrder) continue;
            const ordItem: any = si.itemIdx !== undefined ? prodOrder.items[si.itemIdx] : prodOrder.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
            if (!ordItem) continue;
            const prod = products.find(p => p.id === (si.productId || ordItem.productId));
            if (!prod) continue;
            const variIdx = prod.variations.findIndex(v => v.id === (si.variationId || ordItem.variationId));
            if (variIdx === -1) continue;
            const updVars = prod.variations.map((v, idx) => {
              if (idx !== variIdx) return v;
              const newStock = { ...v.stock };
              Object.entries(ordItem.sizes || {}).forEach(([size, sData]: any) => {
                const qty = Number(sData.toProduction) || 0;
                if (qty > 0) newStock[size] = (newStock[size] || 0) + qty;
              });
              return { ...v, stock: newStock };
            });
            await firebaseService.updateDocument('products', prod.id, { variations: updVars });
          }
        }

        // Para pedidos de cliente — registra entrega (sem ação de estoque)
        // Futuramente: atualizar status da venda para "entregue"
      }

      // 3. Count remaining PENDING OS for this lot in this sector
      //    (exclude the current OS by id — state may not have updated yet)
      const otherPendingOS = serviceOrders.filter(o =>
        o.id !== os.id &&
        o.status === 'PENDING' &&
        o.sectorId === sectorId &&
        (o.lotId === lotId || (o.lotIds?.includes(lotId) ?? false))
      );

      if (otherPendingOS.length > 0) {
        // Still has pending OS — lot stays
        setOsFeedback({
          osNumber: os.osNumber,
          nextSector: nextSectorName,
          action: `Ainda ${otherPendingOS.length} OS pendente(s) neste setor.`,
        });
      } else {
        // Last pending OS — advance lot to next sector
        const isLast = nextSectorIdx >= (lotObj.route?.length ?? 0);
        const updatedLot: ProductionLot = {
          ...lotObj,
          currentSectorIndex: isLast ? lotObj.currentSectorIndex : nextSectorIdx,
          currentStatusId: undefined,
          finishedAt: isLast ? Date.now() : undefined,
          history: [
            ...(lotObj.history || []),
            {
              sectorId: sectorId,
              statusId: '',
              timestamp: Date.now(),
              userName: userName || 'Usuário',
              notes: `Mapa avançado para "${nextSectorName}" — última OS ${os.osNumber} concluída.`,
            },
          ],
        };
        await onSaveLot(updatedLot);
        setOsFeedback({
          osNumber: os.osNumber,
          nextSector: isLast ? 'FINALIZADO' : nextSectorName,
          action: isLast ? 'Mapa de produção finalizado!' : `Mapa #${lotObj.orderNumber} avançado com sucesso.`,
        });
      }

      setIsDetailModalOpen(false);
      setSelectedLot(null);
    } catch (e) {
      console.error(e);
      alert('Erro ao concluir OS: ' + (e instanceof Error ? e.message : String(e)));
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
          alert(`Encontradas ${matches.length} OS abertas para este produto. Use a busca manual ou escaneie o QR da OS específica.`);
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

    if (!os) { alert('OS não encontrada. Verifique o código e tente novamente.'); return; }
    if (os.status === 'COMPLETED') { alert(`A OS ${os.osNumber} já foi concluída.`); return; }

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
        alert("Ordem de Serviço excluída com sucesso!");
      } catch (e) {
        console.error(e);
        alert("Erro ao excluir Ordem de Serviço: " + (e instanceof Error ? e.message : String(e)));
      }
    }
  };


  // Open OS modal pre-configured for a specific order (per-ficha creation)
  const handleOpenOSModalForOrder = (lot: ProductionLot, orderIds: string[], preNote?: string, sectorOverride?: string, qtyOverride?: number) => {
    setPendingOsSourceOrderIds(orderIds);
    if (preNote) setOsNotes(preNote);
    if (sectorOverride) setPendingOsSectorOverride(sectorOverride);
    if (qtyOverride !== undefined) setPendingOsQuantityOverride(qtyOverride);
    // Passa valores diretamente para evitar problema de timing do React state
    handleOpenOSModal(lot, sectorOverride, qtyOverride);
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
      alert('Revertido com sucesso. Pedidos disponíveis novamente.');
    } catch (e) {
      alert('Erro ao reverter: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleEditOS = (os: ServiceOrder) => {
    setEditingOS(os);
    setOsNumber(os.osNumber);
    setOsType(os.type);
    setOsProviderId(os.providerId || '');
    setOsProviderManualName(os.providerName);
    setOsValuePerPair(os.valuePerPair);
    setOsNotes(os.notes || '');
    setOsDirectComplete(false);
    const defAccount = accounts.find(a => a.isDefault) || accounts[0];
    setOsAccountId(os.transactionId ? os.transactionId.replace(/^tx_os_os_\d+_/, '') : (defAccount?.id || ''));
    const prodCategory = categories.find(c => c.type === 'EXPENSE' && (c.name.toLowerCase().includes('produ') || c.name.toLowerCase().includes('mão') || c.name.toLowerCase().includes('obra') || c.name.toLowerCase().includes('servi'))) || categories.find(c => c.type === 'EXPENSE');
    setOsCategoryId(prodCategory?.id || '');
    setIsOSModalOpen(true);
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
    const lotNumber = `${String(lots.length + 1).padStart(3, '0')}`;
    const isMultiGroup = groupEntries.length > 1;

    const singleLot: ProductionLot = {
      id: Math.random().toString(36).substr(2, 9),
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
        sourceItems: selectedData.map(i => ({ orderId: i.orderId, itemIdx: i.itemIdx, qty: i.toProductionQty, productId: i.productId, variationId: i.variationId })),
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
    } as any;

    try {
      await onSaveLot(singleLot);
      setSelectedOrderItems([]);
      alert(`Mapa ${lotNumber} criado com ${groupEntries.length} grupo(s) e ${totalQty} pares!`);
      setActiveTab('monitor');
    } catch (err) {
      console.error(err);
      alert('Erro ao criar mapa.');
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

  const handleScanLotResult = (result: string) => {
    setIsScannerOpen(false);

    // Tentar parsear formato estruturado (OS|id, LOT|id, etc.)
    const parsed = scannerService.parseScanResult(result);

    if (parsed?.type === 'OS') {
      const os = serviceOrders?.find(so => so.id === parsed.osId);
      if (!os) { alert('Ordem de Serviço não encontrada.'); return; }
      if (os.status === 'COMPLETED') { alert(`A OS ${os.osNumber} já foi concluída.`); return; }
      const lot = lots.find(l => l.id === os.lotId || (os.lotIds && os.lotIds.includes(l.id)));
      const nextSectorId = lot && lot.route && lot.route[lot.currentSectorIndex + 1];
      const nextSec = sectors.find(s => s.id === nextSectorId);
      if (confirm(`Concluir ${os.osNumber} e avançar lote(s) para "${nextSec?.name || 'CONCLUÍDO'}"?`)) {
        handleCompleteOS(os);
      }
      return;
    }

    // Formato LOT|id ou fallback JSON/id direto
    let lotId = parsed?.type === 'LOT' ? parsed.lotId : '';
    if (!lotId) {
      try { lotId = JSON.parse(result)?.id || result; } catch { lotId = result; }
    }

    if (!lotId) { alert('QR Code inválido'); return; }

    const lot = lots.find(l => l.id === lotId || l.orderNumber === lotId);
    if (!lot) { alert('Mapa não encontrado: ' + lotId); return; }

    setSelectedLot(lot);
    setIsDetailModalOpen(true);
  };

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

        {/* Linha 2: Botões de ação em card único */}
        <div className={`flex items-center gap-2 px-3 py-3 rounded-[2rem] border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className={`flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-sky-900/30 text-sky-400' : 'bg-sky-50 text-sky-600'}`}
          >
            <Camera size={14} strokeWidth={3} /> Escanear
          </button>
          <button
            type="button"
            onClick={() => setIsFilterPopupOpen(!isFilterPopupOpen)}
            className={`flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-sky-900/30 text-sky-400' : 'bg-sky-50 text-sky-600'}`}
          >
            <Filter size={14} /> Filtros
            {statusFilter !== 'all' && <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />}
          </button>
          <button
            type="button"
            onClick={() => pendingOrders.length > 0 && setIsCreateModalOpen(true)}
            disabled={pendingOrders.length === 0}
            title={pendingOrders.length === 0 ? 'Nenhum pedido pendente para formar um mapa' : 'Iniciar novo mapa de produção'}
            className={`flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              pendingOrders.length === 0
                ? 'opacity-40 cursor-not-allowed ' + (isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')
                : 'active:scale-95 ' + (isDarkMode ? 'bg-sky-900/30 text-sky-400' : 'bg-sky-50 text-sky-600')
            }`}
          >
            {pendingOrders.length === 0
              ? <><Lock size={12} strokeWidth={3} /> Iniciar MAPA</>
              : <><Plus size={14} strokeWidth={3} /> Iniciar MAPA</>
            }
          </button>
        </div>

        {/* Filter Popup/Section */}
        <AnimatePresence>
          {isFilterPopupOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className={`p-8 rounded-[2.5rem] border-2 flex flex-col gap-6 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xl'}`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Filtrar MAPAS por Status</h4>
                  <button onClick={() => { setStatusFilter('all'); setIsFilterPopupOpen(false); }} className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Limpar Filtros</button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'all', label: 'Todos os MAPAS' },
                    { id: 'active', label: 'Em Produção (WIP)' },
                    { id: 'finished', label: 'Concluídos / Expedidos' },
                    { id: 'urgent', label: 'Atrasos e Urgências' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setStatusFilter(f.id as 'all' | 'active' | 'finished' | 'urgent')}
                      className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        statusFilter === f.id
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                          : isDarkMode ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-50 text-slate-500 border border-slate-100'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="grid grid-cols-2 sm:flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-full sm:w-fit sm:self-center">
          <button
            type="button"
            onClick={() => { setActiveTab('monitor'); setSelectedSectorId(null); }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 sm:px-5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'monitor' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
          >
            <LayoutDashboard size={14} className="text-indigo-500 shrink-0" /> Monitor WIP
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('lots'); setSelectedSectorId(null); }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 sm:px-5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'lots' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
          >
            <ListTodo size={14} className="text-emerald-500 shrink-0" /> MAPAS
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('orders'); setSelectedSectorId(null); }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 sm:px-5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'orders' ? 'bg-white dark:bg-slate-800 text-violet-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
          >
            <ClipboardList size={14} className="text-violet-500 shrink-0" /> Pedidos
            {pendingOrders.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-violet-500 text-white text-[8px] font-black flex items-center justify-center">
                {pendingOrders.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('needs'); setSelectedSectorId(null); }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 sm:px-5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'needs' ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
          >
            <AlertCircle size={14} className="text-amber-500 shrink-0" /> Necessidades
            {purchaseNeeds.length > 0 && (
              <span className={`w-4 h-4 rounded-full text-white text-[8px] font-black flex items-center justify-center ${
                purchaseNeeds.some(i => i.type === 'MATERIAL' ? i.required > i.stock : i.sizeShortages ? Object.values(i.sizeShortages).some((s: any) => s.required > s.stock) : false)
                  ? 'bg-rose-500' : 'bg-indigo-400'
              }`}>
                {purchaseNeeds.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {activeTab === 'monitor' && (
        <div className="flex flex-col gap-8">
          {/* WIP Overview */}
          <div className={`px-5 py-4 rounded-[2rem] border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
              <div className="flex flex-col gap-0.5 pr-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Produção</span>
                <span className="text-2xl font-black text-indigo-600">{activeLots.reduce((acc, l) => acc + l.quantity, 0)}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Pares</span>
              </div>
              <div className="flex flex-col gap-0.5 px-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mapas Ativos</span>
                <span className="text-2xl font-black text-emerald-600">{activeLots.length}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Mapas</span>
              </div>
              <div className="flex flex-col gap-0.5 pl-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Atrasos</span>
                <span className="text-2xl font-black text-rose-500">{Object.values(sectorMetrics).reduce((acc, m) => acc + m.delayedCount, 0)}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Críticos</span>
              </div>
            </div>
          </div>

          {/* Sectors Dashboard or Specific Sector View */}
          {!selectedSectorId ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sectors.map((sector) => {
                const metric = sectorMetrics[sector.id];
                return (
                  <button
                    key={sector.id}
                    onClick={() => setSelectedSectorId(sector.id)}
                    title={`Ver detalhes do setor ${sector.name}`}
                    className={`group relative p-8 rounded-[2.5rem] border-2 transition-all flex flex-col gap-6 text-left hover:scale-[1.02] active:scale-95 overflow-hidden ${
                      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white shadow-sm shadow-slate-200/50'
                    }`}
                    style={{ borderColor: `${sector.color}45` }}
                  >
                    {/* Colored top accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: sector.color }} />
                    {/* Status Badges */}
                    <div className="absolute top-6 right-6 flex gap-2">
                      {metric?.delayedCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 text-white rounded-full shadow-lg shadow-rose-500/30 animate-pulse">
                          <Clock size={10} strokeWidth={3} />
                          <span className="text-[9px] font-black uppercase tracking-widest">{metric.delayedCount}</span>
                        </div>
                      )}
                      {metric?.urgentCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-full shadow-lg shadow-amber-500/30">
                          <AlertCircle size={10} strokeWidth={3} />
                          <span className="text-[9px] font-black uppercase tracking-widest">{metric.urgentCount}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg" style={{ backgroundColor: `${sector.color}22`, color: sector.color }}>
                        <Factory size={28} />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-lg font-black uppercase tracking-wider leading-tight text-slate-900 dark:text-white">{sector.name}</h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Setor de Produção</span>
                      </div>
                    </div>

                    <div className={`grid gap-4 mt-auto ${(metric?.arrivedPairs || 0) > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pares no Setor</span>
                        <span className={`text-xl font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{metric?.totalPares || 0}</span>
                        {(metric?.movedOutPairs || 0) > 0 && (
                          <span className="text-[8px] font-bold text-emerald-500">↗ {metric!.movedOutPairs} saíram</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">MAPAS WIP</span>
                        <span className={`text-xl font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{metric?.lotsCount || 0}</span>
                      </div>
                      {(metric?.arrivedPairs || 0) > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Adiantados</span>
                          <span className="text-xl font-black text-amber-600 dark:text-amber-400">{metric!.arrivedPairs}</span>
                          <span className="text-[8px] font-bold text-amber-400">{metric!.arrivedOrders} pedido(s)</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform" style={{ color: sector.color }}>Ver Detalhes</span>
                      <ChevronRight size={16} style={{ color: sector.color }} />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => {
                      setSelectedSectorId(null);
                      setIsMultiSelectMode(false);
                      setSelectedLotIds([]);
                    }}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:gap-3 transition-all shrink-0"
                  >
                    <ChevronRight size={16} className="rotate-180" /> Voltar para Setores
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                      {sectors.find(s => s.id === selectedSectorId)?.name}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isCuttingSector && (
                    <button
                      onClick={() => setIsProjectionMode(!isProjectionMode)}
                      className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                        isProjectionMode
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                          : isDarkMode
                          ? 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-indigo-500/50'
                          : 'bg-white text-slate-500 border border-slate-100 shadow-sm hover:border-indigo-300'
                      }`}
                    >
                      <Scissors size={14} />
                      {isProjectionMode ? 'Ver Mapas do Setor' : 'Painel de Projeção'}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsMultiSelectMode(!isMultiSelectMode);
                      setSelectedLotIds([]);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 relative ${
                      isMultiSelectMode 
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 ring-4 ring-rose-500/30 animate-pulse'
                        : isDarkMode
                        ? 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-indigo-500/50'
                        : 'bg-white text-slate-500 border border-slate-100 shadow-sm hover:border-indigo-300'
                    }`}
                  >
                    {isMultiSelectMode && (
                      <span className="relative flex h-2 w-2 mr-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                      </span>
                    )}
                    {isMultiSelectMode ? 'Cancelar Seleção' : 'Seleção Múltipla'}
                  </button>
                </div>
              </div>


              {isCuttingSector && isProjectionMode ? (
                <CuttingProjectionPanel
                  lots={filteredActiveLots}
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
                  selectedSectorId={selectedSectorId!}
                  onBack={() => {
                    setSelectedSectorId(null);
                    setIsMultiSelectMode(false);
                    setSelectedLotIds([]);
                  }}
                  onSaveLot={onSaveLot}
                  userName={userName}
                  productionOrders={productionOrders}
                />
              ) : (
                <>
                  {isMultiSelectMode && selectedLotIds.length > 0 && (
                <div className={`p-5 rounded-[2rem] border-2 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all ${isDarkMode ? 'bg-slate-900 border-indigo-950/50 text-white' : 'bg-indigo-50/50 border-indigo-100/50 text-indigo-950 shadow-sm'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
                      <CheckSquare size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider">{selectedLotIds.length} Mapa(s) Selecionado(s)</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        Total: {filteredActiveLots.filter(l => selectedLotIds.includes(l.id)).reduce((acc, l) => acc + (l.quantity || 0), 0)} Pares
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => {
                        const lotsToEmit = filteredActiveLots.filter(l => selectedLotIds.includes(l.id));
                        handleOpenOSModal(lotsToEmit);
                      }}
                      className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                    >
                      Emitir OS em Grupo
                    </button>
                    
                    <button
                      onClick={async () => {
                        const lotsToAdvance = filteredActiveLots.filter(l => selectedLotIds.includes(l.id));
                        const blockedLots = lotsToAdvance.filter(l => hasPendingOS(l));
                        if (blockedLots.length > 0) {
                          alert(`${blockedLots.length} mapa(s) têm OS pendentes e não podem ser avançados:\n${blockedLots.map(l => `• Mapa #${l.orderNumber}`).join('\n')}\n\nConclua as OS antes de avançar.`);
                          return;
                        }
                        if (confirm(`Deseja avançar os ${selectedLotIds.length} lotes selecionados de uma vez?`)) {
                          try {
                            for (const lot of lotsToAdvance) {
                              await handleMoveLotSilent(lot, lot.currentStatusId || '', 'Avanço em lote (Massa).');
                            }
                            setSelectedLotIds([]);
                            setIsMultiSelectMode(false);
                            alert("Todos os lotes avançaram com sucesso!");
                          } catch (e) {
                            console.error(e);
                            alert("Erro ao avançar lotes: " + (e instanceof Error ? e.message : String(e)));
                          }
                        }
                      }}
                      className={`flex-1 sm:flex-none px-5 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                        isDarkMode ? 'border-slate-800 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Avançar em Massa
                    </button>

                    <button
                      onClick={async () => {
                        if (confirm(`Tem certeza de que deseja EXCLUIR e CANCELAR todos os ${selectedLotIds.length} mapas selecionados?`)) {
                          try {
                            for (const id of selectedLotIds) {
                              await onDeleteLot(id);
                            }
                            setSelectedLotIds([]);
                            setIsMultiSelectMode(false);
                            alert("Mapas excluídos com sucesso!");
                          } catch (e) {
                            console.error(e);
                            alert("Erro ao excluir mapas: " + (e instanceof Error ? e.message : String(e)));
                          }
                        }
                      }}
                      className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-100 dark:border-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                    >
                      Excluir Mapas
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredActiveLots.filter(l => l.route && l.route[l.currentSectorIndex] === selectedSectorId).map(lot => {
                  const product = products.find(p => p.id === lot.productId);
                  const variation = product?.variations.find(v => v.id === lot.variationId);
                  const status = flowTags.find(t => t.id === lot.currentStatusId);
                  const lastMove = (lot.history && lot.history.length > 0) 
                    ? lot.history[lot.history.length - 1]?.timestamp || lot.createdAt 
                    : lot.createdAt;
                  const isDelayed = Date.now() - lastMove > 24 * 60 * 60 * 1000;
                  const isSelected = selectedLotIds.includes(lot.id);
                  const cardOSList = serviceOrders.filter(so =>
                    (so.lotId === lot.id || (so.lotIds && so.lotIds.includes(lot.id))) &&
                    so.sectorId === selectedSectorId &&
                    so.status === 'PENDING'
                  );
                  const cardOS = cardOSList[0] ?? null;

                  return (
                    <motion.div
                      layoutId={lot.id}
                      key={lot.id}
                      onClick={() => {
                        if (isMultiSelectMode) {
                          setSelectedLotIds(prev => 
                            prev.includes(lot.id) 
                              ? prev.filter(id => id !== lot.id) 
                              : [...prev, lot.id]
                          );
                        } else {
                          setSelectedLot(lot);
                          setIsDetailModalOpen(true);
                        }
                      }}
                      className={`group p-6 rounded-[2.5rem] border-2 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-95 transition-all ${
                        isMultiSelectMode && isSelected
                          ? 'border-indigo-600 bg-indigo-50/10 dark:bg-indigo-950/10'
                          : isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-100 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {isMultiSelectMode && (
                            <div className={`w-5 h-5 rounded-lg flex items-center justify-center border-2 transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                              {isSelected && <CheckCircle2 size={12} strokeWidth={4} />}
                            </div>
                          )}
                          <div className="flex flex-col gap-1.5">
                            <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest w-fit ${
                              lot.prioridade === 'URGENTE' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' :
                              lot.prioridade === 'ALTA' ? 'bg-amber-500 text-white' :
                              isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {lot.prioridade}
                            </span>
                            {isDelayed && (
                              <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                                <Clock size={10} /> Atrasado há {Math.floor((Date.now() - lastMove) / (1000 * 60 * 60))}h
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl">{lot.orderNumber}</span>
                          {cardOSList.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {cardOSList.map(os => (
                                <span key={os.id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest">
                                  <Hammer size={9}/> {os.osNumber}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                              Sem OS
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {(() => {
                        const lotGroups = (lot as any).metadata?.groups;
                        const isMultiProduct = lotGroups?.length > 1 && !lot.variationId;
                        if (isMultiProduct) {
                          const uniqueProds = Array.from(
                            new Map(lotGroups.map((g: any) => [g.productId, g])).values()
                          ) as any[];
                          return (
                            <div className="flex items-center gap-3 mb-5">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-indigo-900/30' : 'bg-indigo-50'}`}>
                                <Layers size={20} className="text-indigo-500"/>
                              </div>
                              <div className="flex flex-col min-w-0">
                                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{uniqueProds.length} Modelos</p>
                                <p className="text-sm font-black text-slate-900 dark:text-white uppercase leading-tight truncate">
                                  {uniqueProds.map((g: any) => products.find(p => p.id === g.productId)?.name || g.productName).join(' · ')}
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="flex items-center gap-4 mb-5">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 transition-colors">
                              {(variation?.photoUrl || product?.photoUrl) ? (
                                <img src={variation?.photoUrl || product?.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Package size={24} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <p className="text-sm font-black truncate text-slate-900 dark:text-white uppercase leading-tight">{product?.name || '---'}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{product?.reference} • {variation?.colorName}</p>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-700 shadow-sm" style={{ backgroundColor: variation?.color }} />
                          <span className="text-sm font-black text-slate-700 dark:text-slate-300">{lot.quantity} <span className="text-[10px] text-slate-400 font-bold uppercase">PARES</span></span>
                        </div>

                        {status ? (
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isDarkMode ? 'bg-indigo-900/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                            <Clock size={12} />
                            <span className="text-[10px] font-black uppercase tracking-wider">{status.name}</span>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
                            <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                            <span className="text-[10px] font-black uppercase tracking-wider">Aguardando</span>
                          </div>
                        )}
                      </div>

                      {/* Grade de tamanhos */}
                      {lot.pairs && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {Object.entries(lot.pairs).map(([size, qty]) => (
                            <div key={size} className="flex flex-col items-center min-w-[32px] p-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                              <span className="text-[10px] font-black text-slate-400 leading-none mb-1">{size}</span>
                              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 leading-none">{qty as number}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Ações do card: OS, Baixa, Imprimir, Etiqueta */}
                      <div className="mt-3 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                        {/* Linha 1: OS info + Baixa rápida + QR Baixa */}
                        {cardOS ? (
                          <div className="flex items-center gap-2">
                            <div className={`flex-1 text-[9px] font-bold truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              {cardOS.providerName} • R$ {cardOS.totalValue.toFixed(2)}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCompleteOS(cardOS)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest shadow-sm shadow-emerald-500/20 active:scale-95 transition-all shrink-0"
                            >
                              <CheckSquare size={11}/> Baixa
                            </button>
                            {/* QR Baixa — abre scanner com a OS pré-selecionada */}
                            <button
                              type="button"
                              title="Baixa por QR Code"
                              onClick={() => {
                                setQrBaixaModal({ sectorId: selectedSectorId!, preselectedOS: cardOS });
                                setQrBaixaManualCode('');
                                setQrBaixaConfirm(null);
                              }}
                              className={`flex items-center gap-1 px-2.5 py-2 rounded-xl active:scale-95 transition-all border shrink-0 text-[9px] font-black uppercase tracking-widest ${
                                isDarkMode
                                  ? 'bg-violet-950/40 border-violet-700/40 text-violet-400 hover:bg-violet-900/50'
                                  : 'bg-violet-50 border-violet-200 text-violet-600 hover:bg-violet-100'
                              }`}
                            >
                              <QrCode size={12} /> Baixa QR
                            </button>
                          </div>
                        ) : (
                          /* Sem OS — botão Emitir OS + QR scan para buscar OS existente */
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLot(lot);
                                setSelectedSourceItemKeys(new Set());
                                setIsDetailModalOpen(true);
                              }}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all border ${
                                isDarkMode
                                  ? 'bg-indigo-950/40 border-indigo-700/50 text-indigo-400 hover:bg-indigo-900/50'
                                  : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                              }`}
                            >
                              <Hammer size={11}/> Emitir OS
                            </button>
                            <button
                              type="button"
                              title="Baixa por QR Code"
                              onClick={() => {
                                setQrBaixaModal({ sectorId: selectedSectorId!, preselectedOS: null });
                                setQrBaixaManualCode('');
                                setQrBaixaConfirm(null);
                              }}
                              className={`flex items-center gap-1 px-2.5 py-2 rounded-xl active:scale-95 transition-all border shrink-0 text-[9px] font-black uppercase tracking-widest ${
                                isDarkMode
                                  ? 'bg-violet-950/40 border-violet-700/40 text-violet-400 hover:bg-violet-900/50'
                                  : 'bg-violet-50 border-violet-200 text-violet-600 hover:bg-violet-100'
                              }`}
                            >
                              <QrCode size={12} /> Baixa QR
                            </button>
                          </div>
                        )}

                        {/* Linha 2: Compartilhar — popup PDF/JPG */}
                        <div className="relative">
                          <button
                            type="button"
                            disabled={isShareExporting}
                            onClick={() => setSharePopupLotId(sharePopupLotId === lot.id ? null : lot.id)}
                            className={`w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all border disabled:opacity-50 ${
                              isDarkMode
                                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {isShareExporting && sharePopupLotId === lot.id
                              ? <span className="animate-spin text-sm leading-none">⏳</span>
                              : <Share2 size={11}/>
                            } Compartilhar
                          </button>

                          {sharePopupLotId === lot.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setSharePopupLotId(null)} />
                              <div className={`absolute bottom-full left-0 mb-1.5 rounded-2xl shadow-2xl border z-50 p-2 flex flex-col gap-1 min-w-[190px] ${
                                isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                              }`}>
                                <p className={`text-[8px] font-black uppercase tracking-widest px-2 pb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Ficha Técnica</p>
                                <button type="button" onClick={() => { setSharePopupLotId(null); handleShareLotSheet(lot, product, variation, cardOS, 'pdf', false); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 text-left ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}>
                                  <Share2 size={11} className="shrink-0" /> PDF — Impressão
                                </button>
                                <button type="button" onClick={() => { setSharePopupLotId(null); handleShareLotSheet(lot, product, variation, cardOS, 'jpg', false); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 text-left ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}>
                                  <Share2 size={11} className="shrink-0" /> JPG — Imagem
                                </button>
                                {cardOS && (
                                  <>
                                    <div className={`my-1 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`} />
                                    <p className={`text-[8px] font-black uppercase tracking-widest px-2 pb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Ficha + OS</p>
                                    <button type="button" onClick={() => { setSharePopupLotId(null); handleShareLotSheet(lot, product, variation, cardOS, 'pdf', true); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 text-left ${isDarkMode ? 'text-emerald-400 hover:bg-slate-800' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                                      <Share2 size={11} className="shrink-0" /> PDF — Com OS
                                    </button>
                                    <button type="button" onClick={() => { setSharePopupLotId(null); handleShareLotSheet(lot, product, variation, cardOS, 'jpg', true); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 text-left ${isDarkMode ? 'text-emerald-400 hover:bg-slate-800' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                                      <Share2 size={11} className="shrink-0" /> JPG — Com OS
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Linha 3: Baixar etiqueta */}
                        {product && (
                          <button
                            type="button"
                            onClick={() => {
                              setLabelModalProduct(product);
                              setLabelModalLot(lot);
                              // Build sizeGrid: lot.pairs first, then production order totals as fallback
                              let sg = '';
                              const pairsEntries = Object.entries(lot.pairs || {}).filter(([, q]) => q > 0);
                              if (pairsEntries.length > 0) {
                                sg = pairsEntries
                                  .sort(([a], [b]) => Number(a) - Number(b))
                                  .map(([sz, q]) => `${sz}x${q}`)
                                  .join('-');
                              } else {
                                const sourceItems = (lot as any).metadata?.sourceItems ||
                                  (lot.productionOrderId ? [{ orderId: lot.productionOrderId, itemIdx: 0 }] : []);
                                const fallback: Record<string, number> = {};
                                sourceItems.forEach((si: any) => {
                                  const order = productionOrders.find(o => o.id === si.orderId);
                                  if (!order) return;
                                  const item = order.items[si.itemIdx ?? 0];
                                  if (!item?.sizes) return;
                                  Object.entries(item.sizes).forEach(([size, sd]: any) => {
                                    const qty = sd.toProduction || sd.total || 0;
                                    if (qty > 0) fallback[size] = (fallback[size] || 0) + qty;
                                  });
                                });
                                if (Object.keys(fallback).length > 0) {
                                  sg = Object.entries(fallback)
                                    .sort(([a], [b]) => Number(a) - Number(b))
                                    .map(([sz, q]) => `${sz}x${q}`)
                                    .join('-');
                                }
                              }
                              setLabelModalSizeGrid(sg);
                            }}
                            className={`w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all border ${
                              isDarkMode
                                ? 'bg-amber-950/30 border-amber-700/40 text-amber-400 hover:bg-amber-900/40'
                                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                            }`}
                          >
                            <Tag size={11}/> Baixar Etiqueta
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                {/* Cards de lotes com pedidos adiantados para este setor */}
                {filteredActiveLots
                  .filter(l => {
                    if (l.route && l.route[l.currentSectorIndex] === selectedSectorId) return false; // já aparece acima
                    const os: Record<string, string> = (l as any).metadata?.orderSectors || {};
                    return Object.values(os).some(sid => sid === selectedSectorId);
                  })
                  .map(lot => {
                    const orderSectorsMap: Record<string, string> = (lot as any).metadata?.orderSectors || {};
                    const lotSI: any[] = (lot as any).metadata?.sourceItems || [];
                    const advancedSI = lotSI.filter((si: any) => orderSectorsMap[si.orderId] === selectedSectorId);
                    const totalAdvancedQty = advancedSI.reduce((acc, si: any) => acc + (si.qty || 0), 0);

                    // Calcula grade dos pedidos adiantados
                    const advancedGrade: Record<string, number> = {};
                    advancedSI.forEach((si: any) => {
                      const ord = productionOrders.find(o => o.id === si.orderId);
                      if (!ord) return;
                      const ordItem: any = si.itemIdx !== undefined ? ord.items[si.itemIdx] : ord.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
                      if (!ordItem?.sizes) return;
                      Object.entries(ordItem.sizes).forEach(([sz, sd]: any) => {
                        const q = Number(sd.toProduction) || 0;
                        if (q > 0) advancedGrade[sz] = (advancedGrade[sz] || 0) + q;
                      });
                    });

                    // Produtos únicos nos pedidos adiantados
                    const advancedProducts = Array.from(new Map(
                      advancedSI.map((si: any) => [si.productId, products.find(p => p.id === si.productId)])
                    ).values()).filter(Boolean) as any[];

                    const lotCurrentSector = sectors.find(s => s.id === lot.route?.[lot.currentSectorIndex]);

                    return (
                      <motion.div
                        key={`adv-${lot.id}`}
                        layoutId={`adv-${lot.id}`}
                        className={`p-5 rounded-[2.5rem] border-2 border-dashed flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-amber-700/40' : 'bg-amber-50/40 border-amber-200'}`}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white uppercase tracking-widest">
                                Pedidos Adiantados
                              </span>
                              <span className="text-[9px] font-black text-amber-600 dark:text-amber-400">#{lot.orderNumber}</span>
                            </div>
                            <p className={`text-xs font-black uppercase truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {advancedProducts.map(p => p?.name).join(' · ') || lot.customerName}
                            </p>
                            {lotCurrentSector && (
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                Mapa em: {lotCurrentSector.name}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <span className="text-lg font-black text-amber-600 dark:text-amber-400">{totalAdvancedQty}</span>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pares</p>
                          </div>
                        </div>

                        {/* Grade dos pedidos adiantados */}
                        {Object.keys(advancedGrade).length > 0 && (
                          <div className="flex flex-col gap-2">
                            <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Grade neste Setor</p>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(advancedGrade)
                                .sort(([a], [b]) => Number(a) - Number(b))
                                .map(([sz, qty]) => (
                                  <div key={sz} className={`flex flex-col items-center min-w-[36px] px-2 py-1.5 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-amber-700/40 text-amber-400' : 'bg-white border-amber-200 text-amber-700'}`}>
                                    <span className="text-[9px] font-black leading-none">{sz}</span>
                                    <span className="text-xs font-black leading-none mt-0.5">{qty}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Botão ver detalhe */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLot(lot);
                            setIsDetailModalOpen(true);
                          }}
                          className={`w-full flex items-center justify-between py-2.5 px-4 rounded-2xl border transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'border-amber-700/40 text-amber-400 hover:bg-amber-900/20' : 'border-amber-200 text-amber-700 hover:bg-amber-100/50'}`}
                        >
                          <span>{advancedSI.length} pedido(s) aguardando OS</span>
                          <ChevronRight size={14} />
                        </button>
                      </motion.div>
                    );
                  })
                }

                {filteredActiveLots.filter(l => l.route && l.route[l.currentSectorIndex] === selectedSectorId).length === 0 &&
                  !filteredActiveLots.some(l => Object.values((l as any).metadata?.orderSectors || {}).some((sid: any) => sid === selectedSectorId)) && (
                  <div className="col-span-full py-20 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem] flex flex-col items-center justify-center text-slate-300 dark:text-slate-700">
                    <div className="w-20 h-20 rounded-[2.5rem] bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-4">
                      <Clock size={40} className="opacity-20" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest">Sem mapas ativos neste setor</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">Novos mapas aparecerão aqui conforme a produção avançar</p>
                  </div>
                )}
              </div>

              {/* ── Pedidos Vinculados — padrão idêntico ao setor de Corte ── */}
              {(() => {
                type FichaItem = { lot: ProductionLot; si: any; siIdx: number; product: any; variation: any; orderItem: any; order: any; coveringOS?: ServiceOrder };
                const allFichas: FichaItem[] = [];
                filteredActiveLots.forEach(lot => {
                  const orderSectors: Record<string, string> = (lot as any).metadata?.orderSectors || {};
                  const lotCurrentSector = lot.route && lot.route[lot.currentSectorIndex];
                  const lotSI: any[] = (lot as any).metadata?.sourceItems || [];

                  lotSI.forEach((si: any) => {
                    const orderSector = orderSectors[si.orderId];
                    const effectiveSector = orderSector || lotCurrentSector;
                    if (effectiveSector !== selectedSectorId) return;

                    const prod = products.find(p => p.id === si.productId);
                    const vari = prod?.variations.find((v: any) => v.id === si.variationId);
                    const ord = productionOrders.find(o => o.id === si.orderId);
                    const ordItem: any = si.itemIdx !== undefined ? ord?.items[si.itemIdx] : ord?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
                    const coveringOS = serviceOrders.find(os =>
                      (os.lotId === lot.id || (os.lotIds && os.lotIds.includes(lot.id))) &&
                      os.sectorId === selectedSectorId &&
                      os.sourceOrderIds && os.sourceOrderIds.includes(si.orderId)
                    ) || serviceOrders.find(os =>
                      (os.lotId === lot.id || (os.lotIds && os.lotIds.includes(lot.id))) &&
                      os.sectorId === selectedSectorId &&
                      (!os.sourceOrderIds || os.sourceOrderIds.length === 0)
                    );
                    const siIdx = lotSI.indexOf(si);
                    allFichas.push({ lot, si, siIdx, product: prod, variation: vari, orderItem: ordItem, order: ord, coveringOS });
                  });
                });
                if (allFichas.length === 0) return null;

                // ── State helpers (using fichaListOpen / fichaFilters keyed by '__pedidos__')
                const mainKey = `__pedidos__${selectedSectorId}`;
                const filterKey = `__filter__${selectedSectorId}`;
                const isMainOpen = fichaListOpen.has(mainKey);
                const isFilterOpen = fichaListOpen.has(filterKey);
                const activeFilt = fichaFilters[mainKey] || { model: '', color: '' };

                // Unique models and colors across all fichas
                const uniqueModels = Array.from(new Set(allFichas.map(f => f.product?.name || f.orderItem?.productName || '').filter(Boolean)));
                const uniqueColors = Array.from(new Set(allFichas.map(f => f.variation?.colorName || f.orderItem?.variationName || '').filter(Boolean)));

                // Filtered fichas
                const filteredFichas = allFichas.filter(f => {
                  const m = f.product?.name || f.orderItem?.productName || '';
                  const c = f.variation?.colorName || f.orderItem?.variationName || '';
                  if (activeFilt.model && m !== activeFilt.model) return false;
                  if (activeFilt.color && c !== activeFilt.color) return false;
                  return true;
                });

                // Selectable = fichas with no pending OS
                const selectable = filteredFichas.filter(f => !f.coveringOS || f.coveringOS.status !== 'PENDING');
                const selected = selectable.filter(f => fichaSelection.has(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));
                const allSelected = selectable.length > 0 && selectable.every(f => fichaSelection.has(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));
                const selectedQty = selected.reduce((s, f) => s + (f.si.qty || 0), 0);

                // Group selected fichas by lot for multi-lot OS emission
                const selByLot = new Map<string, FichaItem[]>();
                selected.forEach(f => {
                  if (!selByLot.has(f.lot.id)) selByLot.set(f.lot.id, []);
                  selByLot.get(f.lot.id)!.push(f);
                });

                {/* Grupos de mapas que têm pedidos neste setor */}
                const lotGroups = Array.from(new Map(allFichas.map(f => [f.lot.id, f.lot])).values()) as ProductionLot[];
                const awaitingLots = lotGroups.filter(lot => {
                  const lotCurrentSector = lot.route?.[lot.currentSectorIndex];
                  return lotCurrentSector !== selectedSectorId; // mapa em outro setor
                });

                return (
                  <div className={`mt-4 rounded-3xl border overflow-hidden ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white/80 border-sky-100 shadow-sm'}`}>

                    {/* ── Cabeçalho acordeão ── */}
                    <button type="button"
                      onClick={() => { const n = new Set(fichaListOpen); isMainOpen ? n.delete(mainKey) : n.add(mainKey); setFichaListOpen(n); }}
                      className={`w-full flex items-center justify-between p-4 transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-sky-50/50'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Hash size={13} className="text-indigo-500 shrink-0" />
                        <div className="min-w-0">
                          <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Pedidos Vinculados</h3>
                          {awaitingLots.length > 0 && (
                            <p className="text-[8px] font-bold text-amber-500 uppercase tracking-widest mt-0.5 truncate">
                              {awaitingLots.map(l => {
                                const sec = sectors.find(s => s.id === l.route?.[l.currentSectorIndex]);
                                return `Mapa #${l.orderNumber} em ${sec?.name || 'outro setor'}`;
                              }).join(' · ')}
                            </p>
                          )}
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
                        {awaitingLots.length > 0 && (
                          <div className={`flex items-start gap-2 mt-2 px-3 py-2 rounded-xl ${isDarkMode ? 'bg-amber-900/20' : 'bg-amber-50'}`}>
                            <Clock size={11} className="text-amber-500 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Aguardando conclusão em outro setor</p>
                              {awaitingLots.map(l => {
                                const sec = sectors.find(s => s.id === l.route?.[l.currentSectorIndex]);
                                const count = allFichas.filter(f => f.lot.id === l.id).length;
                                return (
                                  <p key={l.id} className="text-[8px] font-bold text-amber-500 mt-0.5">
                                    Mapa <span className="font-black">#{l.orderNumber}</span> — atualmente em <span className="font-black">{sec?.name || 'outro setor'}</span> · {count} pedido(s) adiantados aqui
                                  </p>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest leading-relaxed mt-1">
                          Expandir para selecionar pedidos e criar ordens de serviço
                        </span>
                      </div>
                    )}

                    {isMainOpen && (
                      <div className="p-4 pt-0 flex flex-col gap-3">
                        <p className="text-[9px] text-slate-400 uppercase font-bold">{filteredFichas.length} fichas · {selectable.length} disponíveis</p>

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

                        {/* FILTRAR accordion */}
                        <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                          <button type="button"
                            onClick={() => { const n = new Set(fichaListOpen); isFilterOpen ? n.delete(filterKey) : n.add(filterKey); setFichaListOpen(n); }}
                            className={`w-full flex items-center gap-2 px-4 py-2.5 transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
                          >
                            <Filter size={12} className="text-slate-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex-1 text-left">Filtrar</span>
                            {(activeFilt.model || activeFilt.color) && (
                              <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-indigo-500 text-white">Ativo</span>
                            )}
                            <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {isFilterOpen && (
                            <div className={`px-4 pb-3 pt-2 border-t flex flex-wrap gap-1.5 ${isDarkMode ? 'border-slate-800 bg-slate-950/30' : 'border-slate-100 bg-slate-50/60'}`}>
                              {uniqueModels.map(m => (
                                <button type="button" key={m}
                                  onClick={() => setFichaFilters(prev => ({ ...prev, [mainKey]: { ...activeFilt, model: activeFilt.model === m ? '' : m } }))}
                                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all border ${activeFilt.model === m ? 'bg-indigo-600 text-white border-indigo-600' : isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200'}`}
                                >{m}</button>
                              ))}
                              {uniqueColors.map(c => (
                                <button type="button" key={c}
                                  onClick={() => setFichaFilters(prev => ({ ...prev, [mainKey]: { ...activeFilt, color: activeFilt.color === c ? '' : c } }))}
                                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all border ${activeFilt.color === c ? 'bg-amber-500 text-white border-amber-500' : isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200'}`}
                                >{c}</button>
                              ))}
                              {(activeFilt.model || activeFilt.color) && (
                                <button type="button" title="Limpar filtros"
                                  onClick={() => setFichaFilters(prev => ({ ...prev, [mainKey]: { model: '', color: '' } }))}
                                  className="text-[9px] font-black uppercase text-slate-400 hover:text-slate-700 px-2"
                                >✕ Limpar</button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Ficha cards — flat list */}
                        <div className="flex flex-col gap-1.5">
                          {filteredFichas.map((f) => {
                            const itemKey = `${f.lot.id}::${f.si.orderId}::${f.siIdx}`;
                            const hasOS = !!f.coveringOS && f.coveringOS.status === 'PENDING';
                            const isChecked = fichaSelection.has(itemKey);
                            const gradeKey = `grade-${itemKey}`;
                            const gradeOpen = fichaItemExpanded.has(gradeKey);
                            const szEntries = (f.orderItem?.sizes)
                              ? Object.entries(f.orderItem.sizes as Record<string, any>)
                                  .filter(([, s]) => (s?.toProduction || 0) > 0)
                                  .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                              : [];
                            return (
                              <div key={itemKey} className={`rounded-2xl border overflow-hidden transition-all ${
                                hasOS
                                  ? isDarkMode ? 'bg-emerald-950/30 border-emerald-700/50' : 'bg-emerald-50 border-emerald-200'
                                  : isChecked
                                    ? isDarkMode ? 'bg-indigo-950/30 border-indigo-700' : 'bg-indigo-50 border-indigo-200'
                                    : isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-100'
                              }`}>
                                <div className="flex items-center gap-2 px-3 py-2.5">
                                  {hasOS ? (
                                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                                      <div className="w-2 h-2 rounded-full bg-white" />
                                    </div>
                                  ) : (
                                    <input type="checkbox"
                                      title="Selecionar este pedido"
                                      checked={isChecked}
                                      onChange={() => { const n = new Set(fichaSelection); isChecked ? n.delete(itemKey) : n.add(itemKey); setFichaSelection(n); }}
                                      className="w-4 h-4 accent-indigo-600 cursor-pointer shrink-0"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black uppercase truncate text-slate-800 dark:text-slate-200 leading-none">
                                      {f.product?.name || f.orderItem?.productName || '—'}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      {(f.variation?.colorName || f.orderItem?.variationName) && (
                                        <span className="text-[8px] font-bold text-slate-400 uppercase">{f.variation?.colorName || f.orderItem?.variationName}</span>
                                      )}
                                      <span className="text-[7px] text-slate-400 uppercase">· Ped. {f.order?.saleOrderNumber || '—'}</span>
                                      {f.coveringOS && (
                                        <span className={`text-[7px] font-black uppercase ${f.coveringOS.status === 'COMPLETED' ? 'text-emerald-500' : 'text-sky-500'}`}>
                                          {f.coveringOS.osNumber}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                                    <span className="text-[7px] font-black px-2 py-0.5 rounded-full uppercase bg-violet-600 text-white tracking-widest">
                                      MAPA{f.lot.orderNumber}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{f.si.qty}P</span>
                                      {szEntries.length > 0 && (
                                        <button type="button"
                                          title={gradeOpen ? 'Recolher grade' : 'Ver grade'}
                                          onClick={() => { const n = new Set(fichaItemExpanded); gradeOpen ? n.delete(gradeKey) : n.add(gradeKey); setFichaItemExpanded(n); }}
                                          className="p-0.5 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                                        >
                                          <ChevronDown size={12} className={`transition-transform duration-200 ${gradeOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {gradeOpen && szEntries.length > 0 && (
                                  <div className={`px-3 pb-2.5 pt-1 border-t flex flex-wrap gap-1.5 ${isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-white/60'}`}>
                                    {szEntries.map(([sz, s]) => (
                                      <div key={sz} className={`px-2.5 py-1.5 rounded-xl border-2 text-center min-w-[36px] ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                                        <p className="text-[7px] font-bold text-slate-400 leading-none">{sz}</p>
                                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 leading-none mt-0.5">{s?.toProduction ?? s}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Emitir OS — grouped by lot */}
                        {selected.length > 0 && (
                          <div className="flex flex-col gap-2">
                            {Array.from(selByLot.entries()).map(([lotId, lotSelected]) => {
                              const lot = allFichas.find(f => f.lot.id === lotId)?.lot;
                              if (!lot) return null;
                              const nextSId = lot.route?.[lot.currentSectorIndex + 1] || '';
                              const nextSName = sectors.find(s => s.id === nextSId)?.name || 'CONCLUÍDO';
                              const qty = lotSelected.reduce((s, f) => s + (f.si.qty || 0), 0);
                              return (
                                <button type="button" key={lotId}
                                  onClick={() => {
                                    const orderIds = lotSelected.map(f => f.si.orderId);
                                    const n = new Set(fichaSelection);
                                    lotSelected.forEach(f => n.delete(`${lotId}::${f.si.orderId}::${f.siIdx}`));
                                    setFichaSelection(n);
                                    // Verifica se são pedidos adiantados (mapa em outro setor)
                                    const lotCurrentSector = lot.route?.[lot.currentSectorIndex];
                                    const isAdvanced = lotCurrentSector !== selectedSectorId;
                                    const preNote = isAdvanced
                                      ? `Pedidos adiantados do Mapa #${lot.orderNumber} (mapa atualmente em: ${sectors.find(s => s.id === lotCurrentSector)?.name || 'outro setor'})`
                                      : undefined;
                                    const sectorOvr = isAdvanced ? selectedSectorId : undefined;
                                    const qtyOvr = isAdvanced ? qty : undefined;
                                    handleOpenOSModalForOrder(lot, orderIds, preNote, sectorOvr, qtyOvr);
                                  }}
                                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shadow-sky-500/30"
                                >
                                  <Hammer size={13} /> Emitir OS — {lotSelected.length} {lotSelected.length === 1 ? 'Pedido' : 'Pedidos'} ({qty}P) · MAPA{lot.orderNumber}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* OS emitidas neste setor */}
                        {serviceOrders
                          .filter(os => os.sectorId === selectedSectorId && os.status === 'PENDING' &&
                            filteredActiveLots.some(l => os.lotId === l.id))
                          .map(os => {
                            const lot = filteredActiveLots.find(l => os.lotId === l.id) ?? null;
                            const nextSId = (lot?.route?.length ?? 0) > (lot?.currentSectorIndex ?? 0) + 1
                              ? (lot?.route?.[(lot?.currentSectorIndex ?? 0) + 1] ?? '')
                              : '';
                            const nextSName = sectors.find(s => s.id === nextSId)?.name ?? 'CONCLUÍDO';
                            return (
                              <div key={os.id} className={`rounded-2xl border flex items-center gap-2 px-3 py-2.5 ${isDarkMode ? 'bg-sky-950/20 border-sky-700/40' : 'bg-sky-50 border-sky-200'}`}>
                                {lot && <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-violet-600 text-white uppercase shrink-0">MAPA{lot.orderNumber}</span>}
                                <div className="flex-1 min-w-0">
                                  <span className={`text-[10px] font-black uppercase ${isDarkMode ? 'text-sky-400' : 'text-sky-700'}`}>{os.osNumber}</span>
                                  {os.providerName ? <p className="text-[9px] text-slate-400 truncate">{os.providerName}</p> : null}
                                </div>
                                <button type="button" onClick={() => handleCompleteOS(os)}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase transition-all active:scale-95 shrink-0 ${isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                                  <CheckCircle2 size={11} /> Baixa → {nextSName}
                                </button>
                              </div>
                            );
                          })
                        }

                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
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

             {groupedPendingItems.length === 0 ? (
                <div className={`py-20 rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center gap-3 ${isDarkMode ? 'border-slate-800 text-slate-700' : 'border-slate-200 text-slate-300'}`}>
                  <ClipboardList size={48} className="opacity-20" />
                  <p className="text-xs font-black uppercase tracking-widest">Nenhum pedido pendente</p>
                </div>
             ) : (
                <div className="flex flex-col gap-4">
                  {groupedPendingItems.map(group => (
                    <div key={`${group.productId}-${group.variationId}`} className={`p-6 rounded-[2.5rem] border-2 transition-all overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                        {/* Group Header */}
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-4">
                              <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                <Package size={28} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-base font-black uppercase leading-tight text-slate-900 dark:text-white truncate">{group.productName}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-0.5">{group.variationName}</p>
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
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                                  group.orders.every(gi => selectedOrderItems.some(p => p.orderId === gi.orderId && p.itemIdx === gi.itemIdx))
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
                                    className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-transparent bg-slate-50 dark:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'border-slate-300 dark:border-slate-600'}`}>
                                          {isSelected && <CheckCircle2 size={14} strokeWidth={4} />}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <p className="text-[10px] font-black uppercase text-slate-800 dark:text-slate-200 truncate leading-none">{item.customerName}</p>
                                            <span className="text-[8px] font-bold text-slate-400 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full uppercase tracking-widest">Pedido {item.saleOrderNumber}</span>
                                          </div>
                                          
                                          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase">{item.productName}</span>
                                            <span className="text-[9px] font-bold text-indigo-500 uppercase">{item.variationName}</span>
                                          </div>

                                          {/* Size Grid */}
                                          <div className="flex flex-wrap gap-1">
                                            {Object.entries(item.sizes || {})
                                              .filter(([_, s]: any) => s.toProduction > 0)
                                              .map(([size, s]: any) => (
                                                <div key={size} className="flex flex-col items-center min-w-[28px] p-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                                                  <span className="text-[9px] font-black text-slate-400 leading-none mb-0.5">{size}</span>
                                                  <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 leading-none">{s.toProduction}</span>
                                                </div>
                                              ))}
                                          </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0 ml-3">
                                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{item.toProductionQty} P</span>
                                      <span className={`text-[10px] font-bold uppercase tracking-widest ${item.deliveryDate < Date.now() ? 'text-rose-500' : 'text-slate-400'}`}>{new Date(item.deliveryDate).toLocaleDateString('pt-BR')}</span>
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
                      const isGrouped = item._size > 1;
                      const isFirst  = item._idx === 0;
                      const groupHeader = (isGrouped && isFirst) ? (
                        <div key={`gh_${item._gk}`} className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item._gBaseName}</span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-white text-slate-500 border border-slate-200'}`}>{item._size} {item.type === 'MATERIAL' ? 'cores' : 'variações'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-[8px] font-black uppercase text-slate-400">Total necessário</p>
                              <p className={`text-[11px] font-black ${item._gShortage > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{/m[²2]/i.test(item.unit || '') ? item._gTotal.toFixed(2) : Math.round(item._gTotal)} {item.unit}</p>
                            </div>
                          </div>
                        </div>
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

                      return (
                        <React.Fragment key={item.id}>
                          {groupHeader}
                        <div
                          className={`rounded-[2rem] border-2 transition-all overflow-hidden ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-white shadow-sm'} ${isExpanded ? 'border-indigo-300 dark:border-indigo-700' : ''}`}
                        >
                          {/* ── Acordeão Header (clicável) ── */}
                          <button
                            type="button"
                            onClick={() => toggleNeedExpand(item.id)}
                            className={`w-full flex items-center justify-between gap-3 px-5 py-4 transition-colors ${isExpanded ? isDarkMode ? 'bg-indigo-950/30' : 'bg-indigo-50/60' : ''}`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.type === 'SOLE' ? 'bg-indigo-100 text-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                {item.type === 'SOLE' ? <Layers size={16} /> : <Package size={16} />}
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                {item.type === 'SOLE' ? (() => {
                                  const [moldName, ...colorParts] = item.name.split(' - ');
                                  const colorName = colorParts.join(' - ');
                                  return (
                                    <>
                                      <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-0.5">Solado</p>
                                      <p className="text-sm font-black text-slate-900 dark:text-white uppercase leading-tight truncate">{moldName}</p>
                                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        {colorName && (
                                          <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{colorName}</span>
                                        )}
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                          {item.contributingLots.length} {item.contributingLots.length === 1 ? 'Mapa' : 'Mapas'}: {item.contributingLots.join(', ')}
                                        </span>
                                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">⚠ Falta</span>
                                      </div>
                                    </>
                                  );
                                })() : (
                                  <>
                                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase leading-tight truncate">{item.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                        {item.contributingLots.length} {item.contributingLots.length === 1 ? 'Mapa' : 'Mapas'}: {item.contributingLots.join(', ')}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              {/* Linha 1: Falta + chevron */}
                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Falta</p>
                                  <p className="text-xl font-black text-rose-600 leading-none">{fmtQty(quickShortage)} <span className="text-[9px] text-slate-400">{item.unit}</span></p>
                                </div>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                                  <ChevronDown size={16} strokeWidth={2.5} />
                                </div>
                              </div>
                              {/* Linha 2: Ação */}
                              {existingReqOuter ? (
                                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                                  <CheckCircle2 size={10} strokeWidth={3} /> Solicitado
                                </span>
                              ) : totalInTransitOuter > 0 && realToComprarOuter === 0 ? (
                                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${isDarkMode ? 'bg-amber-950/30 border-amber-700/50 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                  <ShoppingCart size={10} /> Em Trânsito
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
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                                    requestingId === item.id
                                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-wait'
                                      : 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                                  }`}
                                >
                                  {requestingId === item.id ? <Loader2 size={10} className="animate-spin" /> : <ArrowUpRight size={10} strokeWidth={3} />}
                                  Solicitar
                                </button>
                              ) : null}
                            </div>
                          </button>

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
                                  <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border ${
                                    hasSoleShortage
                                      ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                                  }`}>
                                    {hasSoleShortage ? '⚠ Falta Solado' : '✓ Solado OK'}
                                  </span>
                                );
                              })()}
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                                {item.contributingLots.length} {item.contributingLots.length === 1 ? 'Mapa' : 'Mapas'}: {item.contributingLots.join(', ')}
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
                                        alert(`Solicitação de ${item.name} enviada com sucesso!`);
                                      } catch (err) {
                                        alert('Erro ao enviar solicitação.');
                                      } finally {
                                        setRequestingId(null);
                                      }
                                    }}
                                    className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2 ${
                                      requestingId === item.id
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
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
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
                    className={`p-5 rounded-3xl border flex items-center justify-between gap-4 transition-all cursor-pointer ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isFinished ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'}`}>
                        {isFinished ? <CheckCircle2 size={24} /> : <Factory size={24} />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-black text-slate-900 dark:text-white uppercase leading-none">{lot.orderNumber}</span>
                          {isFinished && <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-500 text-white px-2 py-0.5 rounded-md">Finalizado</span>}
                          {lot.productionOrderId && (
                            <span className="text-[8px] font-black uppercase tracking-widest bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-md">
                              {productionOrders.find(o => o.id === lot.productionOrderId)?.orderNumber || 'OP'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                          {product?.name} • {variation?.colorName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{lot.quantity} PARES</span>
                          {lot.customerName && <span className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[150px]"> • {lot.customerName}</span>}
                        </div>
                        
                        {/* Grade do Pedido (Grid) */}
                        {lot.pairs && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {Object.entries(lot.pairs).map(([size, qty]) => (
                              <div key={size} className="flex flex-col items-center min-w-[36px] p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-md">
                                <span className="text-[11px] font-black text-slate-400 leading-none mb-1">{size}</span>
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
                        <p className="text-[9px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest mt-2">MAPA #{lot.orderNumber}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Excluir este mapa permanentemente?')) {
                              onDeleteLot(lot.id);
                            }
                          }}
                          className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all"
                          title="Excluir Mapa"
                        >
                          <Trash2 size={16} />
                        </button>


                        <ChevronRight size={18} className="text-slate-300" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Criar MAPA */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Iniciar Novo MAPA de Produção"
        maxWidth="max-w-2xl"
      >
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Produto / Modelo</label>
              <ComboBox
                options={products.map(p => ({ id: p.id, name: `${p.reference} - ${p.name}` }))}
                value={newLot.productId || ''}
                onChange={(id) => {
                  const p = products.find(prod => prod.id === id);
                  setNewLot({ ...newLot, productId: id, variationId: p?.variations[0]?.id || '' });
                }}
                placeholder="Selecionar produto..."
                isDarkMode={isDarkMode}
                icon={<Package size={18} />}
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Cor / Variação</label>
              <ComboBox
                options={(() => {
                  const product = products.find(p => p.id === newLot.productId);
                  return product?.variations.map(v => ({ id: v.id, name: v.colorName })) || [];
                })()}
                value={newLot.variationId || ''}
                onChange={(id) => setNewLot({ ...newLot, variationId: id })}
                placeholder="Selecionar cor..."
                isDarkMode={isDarkMode}
                icon={<Tag size={18} />}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Quantidade (Pares)</label>
              <input
                type="number"
                className={`w-full px-6 py-4 rounded-2xl border-2 font-black text-sm outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}`}
                value={newLot.quantity || ''}
                onChange={(e) => setNewLot({ ...newLot, quantity: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Prioridade</label>
              <div className="flex flex-wrap gap-2">
                {priorityOptions.map(p => {
                  const isActive = newLot.prioridade === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePriorityChange(p)}
                      className={`flex-1 min-w-[85px] py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${
                        isActive 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20 scale-[1.02]' 
                          : isDarkMode 
                            ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200' 
                            : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Prazo de Entrega (Personalizado)</label>
              <div className="relative flex items-center">
                <CalendarClock size={18} className="absolute left-4 text-slate-400" />
                <input
                  type="date"
                  title="Prazo de Entrega"
                  aria-label="Prazo de Entrega Personalizado"
                  className={`w-full pl-12 pr-6 py-4 rounded-2xl border-2 font-black text-sm outline-none transition-all ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500 [color-scheme:dark]'
                      : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'
                  }`}
                  value={formatDateForInput(newLot.deliveryDate)}
                  onChange={(e) => {
                    const parsed = parseDateFromInput(e.target.value);
                    setNewLot({ ...newLot, deliveryDate: parsed });
                  }}
                />
              </div>
              {(() => {
                const currentPriority = newLot.prioridade || 'NORMAL';
                const cleanPriorityName = currentPriority.toUpperCase().trim();
                const matchedConfig = (productionConfigs || []).find(c => 
                  c.type === 'DEADLINE' && 
                  (c.name.toUpperCase().trim() === cleanPriorityName || 
                   (cleanPriorityName === 'ALTA' && c.name.toUpperCase().trim() === 'PADRÃO') || 
                   (cleanPriorityName === 'URGENTE' && c.name.toUpperCase().trim() === 'URGENTE'))
                );
                const defaultDays = matchedConfig?.metadata?.days ?? (currentPriority === 'URGENTE' ? 3 : currentPriority === 'ALTA' ? 7 : 15);
                
                return (
                  <div className="flex items-center gap-2 px-1">
                    <span className={`w-2 h-2 rounded-full ${
                      currentPriority === 'URGENTE' ? 'bg-rose-500 animate-pulse' : currentPriority === 'ALTA' ? 'bg-amber-500' : 'bg-green-500'
                    }`} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Prazo Padrão ({currentPriority}): {defaultDays} dias
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          <button
            onClick={handleCreateLot}
            className="w-full mt-4 py-5 bg-indigo-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Confirmar Abertura de MAPA
          </button>
        </div>
      </Modal>

      {/* Modal Detalhe / Apontamento */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedSourceItemKeys(new Set()); }}
        title={selectedLot?.orderNumber || 'Detalhes do MAPA'}
        maxWidth="max-w-3xl"
      >
        {selectedLot && (() => {
          const product = products.find(p => p.id === selectedLot.productId);
          const variation = product?.variations.find(v => v.id === selectedLot.variationId);
          const currentSector = sectors.find(s => s.id === (selectedLot.route && selectedLot.route[selectedLot.currentSectorIndex]));
          const nextSector = sectors.find(s => s.id === (selectedLot.route && selectedLot.route[selectedLot.currentSectorIndex + 1]));
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
                        <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">#{selectedLot.orderNumber}</h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {selectedLot.prioridade && (
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                          selectedLot.prioridade === 'URGENTE' ? 'bg-rose-500 text-white' :
                          selectedLot.prioridade === 'ALTA' ? 'bg-amber-400 text-white' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>{selectedLot.prioridade}</span>
                      )}
                      <button onClick={() => {
                        setNewLot({ id: selectedLot.id, productId: selectedLot.productId, variationId: selectedLot.variationId, quantity: selectedLot.quantity, prioridade: selectedLot.prioridade, productionOrderId: selectedLot.productionOrderId, customerName: selectedLot.customerName, deliveryDate: selectedLot.deliveryDate, saleId: selectedLot.saleId, saleOrderNumber: selectedLot.saleOrderNumber });
                        setIsDetailModalOpen(false); setIsCreateModalOpen(true);
                      }} title="Editar Mapa"
                        className="p-2 rounded-xl transition-all bg-amber-400 hover:bg-amber-500 text-white active:scale-95">
                        <Edit2 size={13} strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Product + color */}
                  <div className="flex items-center gap-2 mb-4">
                    {variation?.color && <div className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/10" style={{ backgroundColor: variation.color }} />}
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase leading-tight truncate">{product?.name || '—'}</p>
                    {variation?.colorName && <span className="text-[10px] font-bold text-slate-400 shrink-0">· {variation.colorName}</span>}
                  </div>

                  {/* Row 3: Stats */}
                  {(() => {
                    const orderSectorsMap: Record<string, string> = (selectedLot as any).metadata?.orderSectors || {};
                    const currentSectorId = selectedLot.route?.[selectedLot.currentSectorIndex];
                    const lotSI: any[] = (selectedLot as any).metadata?.sourceItems || [];
                    const movedOutQty = lotSI.reduce((acc, si: any) => {
                      const dest = orderSectorsMap[si.orderId];
                      return dest && dest !== currentSectorId ? acc + (si.qty || 0) : acc;
                    }, 0);
                    const currentQty = selectedLot.quantity - movedOutQty;
                    return (
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-indigo-50'}`}>
                          <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{currentQty}</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Pares</span>
                        </div>
                        <div className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                          <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 leading-none truncate max-w-full px-1">{currentSector?.name || '—'}</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Setor Atual</span>
                        </div>
                        {nextSector && (
                          <div className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 leading-none truncate max-w-full px-1">{nextSector.name}</span>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Próximo</span>
                          </div>
                        )}
                        {movedOutQty > 0 && (
                          <div className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl ${isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50'}`}>
                            <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 leading-none">+{movedOutQty}</span>
                            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mt-0.5">Outros</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Row 4: Size grid */}
                  {selectedLot.pairs && (() => {
                    const orderSectorsMap: Record<string, string> = (selectedLot as any).metadata?.orderSectors || {};
                    const lotCurrentSectorId = selectedLot.route?.[selectedLot.currentSectorIndex];
                    const lotSI: any[] = (selectedLot as any).metadata?.sourceItems || [];
                    const deductBySize: Record<string, number> = {};
                    lotSI.forEach((si: any) => {
                      const destSector = orderSectorsMap[si.orderId];
                      if (!destSector || destSector === lotCurrentSectorId) return;
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
                        .filter(([, q]) => q > 0)
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

                // Filtra: oculta pedidos já movidos para outro setor
                const orderSectorsMap: Record<string, string> = (selectedLot as any).metadata?.orderSectors || {};
                const sourceItems = allSourceItems.filter((si: any) => {
                  const destSector = orderSectorsMap[si.orderId];
                  // Mostrar apenas pedidos SEM setor atribuído OU no setor atual do lote
                  return !destSector || destSector === currentSectorId;
                });

                // Pedidos que foram movidos para outros setores (para info)
                const movedOutItems = allSourceItems.filter((si: any) => {
                  const destSector = orderSectorsMap[si.orderId];
                  return destSector && destSector !== currentSectorId;
                });
                const lotOSList = serviceOrders.filter(so =>
                  (so.lotId === selectedLot.id || (so.lotIds && so.lotIds.includes(selectedLot.id))) &&
                  so.sectorId === currentSectorId &&
                  so.status === 'PENDING'
                );
                // OS pendentes (bloqueiam criação de nova OS)
                const getOrderOS = (orderId: string) => lotOSList.find(so =>
                  so.sourceOrderIds && so.sourceOrderIds.length > 0 && so.sourceOrderIds.includes(orderId)
                );

                // OS concluída NO SETOR ATUAL, com o pedido explicitamente listado
                const completedOSForOrder = (orderId: string) => serviceOrders.find(so =>
                  so.sourceOrderIds &&
                  so.sourceOrderIds.length > 0 &&
                  so.sourceOrderIds.includes(orderId) &&
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
                        {movedOutItems.length > 0 && (
                          <span className="text-[8px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full uppercase">↗ {movedOutItems.length} em outros</span>
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
                        const colorName = variation?.colorName || orderItem?.variationName || '';
                        const key = `${si.orderId}-${idx}`;
                        const isChecked = selectedSourceItemKeys.has(key);
                        const orderOS = getOrderOS(si.orderId);
                        const hasOS = !!orderOS;
                        const completedOS = completedOSForOrder(si.orderId);
                        const hasCompletedOS = !!completedOS;
                        const isExpanded = expandedSourceItems.has(key);

                        const sizeEntries = orderItem
                          ? Object.entries(orderItem.sizes as Record<string, { toProduction: number }>)
                              .filter(([, s]) => s.toProduction > 0)
                              .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                          : [];

                        return (
                          <div key={idx} className={`rounded-2xl border overflow-hidden transition-all ${
                            hasOS
                              ? (isDarkMode ? 'bg-amber-950/20 border-amber-700/40' : 'bg-amber-50 border-amber-200')
                              : hasCompletedOS
                                ? (isDarkMode ? 'bg-emerald-950/20 border-emerald-700/40' : 'bg-emerald-50/60 border-emerald-200')
                                : isChecked
                                  ? (isDarkMode ? 'bg-indigo-950/30 border-indigo-700' : 'bg-indigo-50 border-indigo-200')
                                  : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')
                          }`}>
                            {/* ── Cabeçalho (sempre visível) ── */}
                            <div className="p-3 flex items-center gap-3">
                              {hasOS ? (
                                <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center shrink-0" title="OS pendente">
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
                                {/* Linha 1: Nome */}
                                <p className="text-[11px] font-black uppercase truncate text-slate-800 dark:text-slate-200 leading-none">
                                  {productName}
                                </p>
                                {/* Linha 2: Cor + Pedido */}
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {colorName && (
                                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wide">{colorName}</span>
                                  )}
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {order?.saleOrderNumber || selectedLot.saleOrderNumber}</span>
                                  {hasOS && (
                                    <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">· {orderOS!.osNumber}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-0.5 shrink-0">
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-violet-600 text-white tracking-widest shadow-sm shadow-violet-500/30">
                                  MAPA{selectedLot.orderNumber}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{si.qty}P</span>
                                  <button
                                    type="button"
                                    title={isExpanded ? 'Recolher' : 'Expandir grade'}
                                    aria-label={isExpanded ? 'Recolher pedido' : 'Expandir pedido'}
                                    onClick={() => {
                                      const next = new Set(expandedSourceItems);
                                      isExpanded ? next.delete(key) : next.add(key);
                                      setExpandedSourceItems(next);
                                    }}
                                    className={`p-1 rounded-lg transition-all ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-300 hover:text-slate-600'}`}
                                  >
                                    <ChevronDown size={13} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                </div>
                                {hasOS ? (
                                  <>
                                    <button type="button" onClick={() => handleEditOS(orderOS!)} className="p-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-white transition-all active:scale-95" title="Editar OS"><Edit2 size={13} /></button>
                                    <button type="button" onClick={() => handleDeleteOS(orderOS!)} className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-300 hover:text-rose-500 transition-all" title="Excluir OS"><Trash2 size={13} /></button>
                                  </>
                                ) : (
                                  selectedLot.currentSectorIndex === 0 && !selectedLot.finishedAt && (
                                    <button type="button" onClick={() => handleRemoveItemFromLot(selectedLot, si.orderId)} className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-300 hover:text-rose-500 transition-all" title="Retirar do Mapa"><MinusCircle size={14} /></button>
                                  )
                                )}
                              </div>
                            </div>

                            {/* ── Expanded: grade + info completa ── */}
                            {isExpanded && (
                              <div className={`px-3 pb-3 pt-1 border-t flex flex-col gap-3 ${isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/60'}`}>
                                {sizeEntries.length > 0 && (
                                  <div>
                                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Grade de Produção</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {sizeEntries.map(([size, s]) => (
                                        <div key={size} className={`px-2.5 py-1.5 rounded-xl border-2 text-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                                          <p className="text-[8px] font-bold text-slate-400 leading-none">{size}</p>
                                          <p className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 leading-none mt-0.5">{s.toProduction}</p>
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
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Action bar — shown when ≥1 order is selected */}
                    {selectedQty > 0 && (
                      <div className={`p-4 rounded-2xl border-2 flex flex-col sm:flex-row items-center gap-3 ${isDarkMode ? 'bg-indigo-950/20 border-indigo-700/50' : 'bg-indigo-50 border-indigo-200'}`}>
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
                        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              if (!product) return;
                              setLabelModalProduct(product);
                              setLabelModalLot(null);
                              setLabelModalSizeGrid(computeSizeGrid());
                            }}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                          >
                            <Tag size={12} strokeWidth={3} /> Etiqueta
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingOsSourceOrderIds(selectedItemsList.map((si: any) => si.orderId));
                              handleOpenOSModal({ ...selectedLot, quantity: selectedQty } as any);
                            }}
                            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${isDarkMode ? 'bg-slate-600 hover:bg-slate-500' : 'bg-slate-700 hover:bg-slate-800'}`}
                          >
                            <Hammer size={12} strokeWidth={3} /> Emitir OS
                          </button>
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
                              orderIds: selectedMoveableItems.map((si: any) => si.orderId),
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
                                  const nextSectorId = selectedLot?.route && selectedLot.route[(selectedLot.currentSectorIndex ?? 0) + 1];
                                  const nextSec = (sectors || []).find(s => s.id === nextSectorId);
                                  setPrintOSData({ os, nextSectorName: nextSec?.name || 'CONCLUÍDO' });
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
                                className={`w-full py-3 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${
                                  osExpanded
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
                                                  ? <img src={vari?.photoUrl || prod?.photoUrl} alt="" className="w-full h-full object-cover"/>
                                                  : <Package size={14} className="text-slate-400"/>}
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black uppercase text-slate-800 dark:text-white leading-none truncate">
                                                  {prod?.reference && <span className="text-indigo-500 mr-1">{prod.reference}</span>}
                                                  {prod?.name || os.productName}
                                                </p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">
                                                  {colorName || '—'} · {item.totalQty}p
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
                                                      <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 leading-none mt-0.5">{qty}p</p>
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
                      <>
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

                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between px-1">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Apontamento de Produção</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-500 uppercase">{currentSector?.name}</span>
                              <ChevronRight size={14} className="text-slate-300" />
                              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">{nextSector?.name || 'CONCLUÍDO'}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status / Operação</label>
                              <ComboBox
                                options={flowTags.map(t => ({ id: t.id, name: t.name }))}
                                value={selectedLot.currentStatusId || ''}
                                onChange={(id) => setSelectedLot({ ...selectedLot, currentStatusId: id })}
                                placeholder="Selecionar operação..."
                                isDarkMode={isDarkMode}
                                icon={<ClipboardList size={18} />}
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Anotações do Setor</label>
                              <input
                                type="text"
                                className={`w-full px-5 py-4 rounded-xl border-2 font-bold text-xs outline-none ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                                placeholder="Opcional: perdas, observações..."
                                id="lot-notes-input"
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const notesInput = document.getElementById('lot-notes-input') as HTMLInputElement;
                            handleMoveLot(selectedLot, selectedLot.currentStatusId || '', notesInput.value);
                          }}
                          className={`w-full py-5 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 ${
                            nextSector ? 'bg-indigo-600 text-white shadow-indigo-600/20' : 'bg-emerald-600 text-white shadow-emerald-600/20'
                          }`}
                        >
                          {nextSector ? (
                            <>Próximo Setor: {nextSector.name} <ArrowRight size={18} /></>
                          ) : (
                            <>Finalizar Produção <CheckCircle2 size={18} /></>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* History Timeline */}
              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-1">Histórico de Movimentação</h4>
                <div className="flex flex-col gap-3">
                  {(selectedLot.history || []).slice().sort((a, b) => b.timestamp - a.timestamp).map((h, i) => {
                    const sector = sectors.find(s => s.id === h.sectorId);
                    const tag = flowTags.find(t => t.id === h.statusId);
                    const canRevert = i === 0 && (selectedLot.history?.length || 0) > 0;
                    return (
                      <div key={i} className={`p-4 rounded-2xl border flex items-center gap-4 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${i === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                          {i === 0 ? <Clock size={17} /> : <History size={17} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">{sector?.name || '---'}</span>
                            <span className="text-[9px] font-bold text-slate-400">{new Date(h.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{tag?.name || 'MIGRAÇÃO'}</span>
                            {h.notes && <span className="text-[10px] text-slate-400 font-bold italic truncate">• {h.notes}</span>}
                          </div>
                        </div>
                        {canRevert && (
                          <button
                            type="button"
                            onClick={() => handleRevertLot(selectedLot)}
                            title="Reverter esta movimentação"
                            className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all"
                          >
                            <History size={13} />
                            Reverter
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
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

          const totalFalta  = gradeRows.reduce((s, r) => s + r.falta, 0);
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
                    {selectedSoleNeed.contributingLots.length} {selectedSoleNeed.contributingLots.length === 1 ? 'mapa' : 'mapas'}: {selectedSoleNeed.contributingLots.join(', ')}
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
                      alert('O pedido está vazio.');
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
                  className={`w-full py-5 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl transition-all ${
                    totalPedido > 0
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
                      alert('O pedido está vazio.');
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
                      alert(`Solicitação de ${selectedSoleNeed.name} enviada com sucesso!`);
                      setIsSoleOrderModalOpen(false);
                    } catch (err) {
                      console.error('[PCPView] Error in request:', err);
                      alert('Erro ao enviar solicitação.');
                    } finally {
                      setRequestingId(null);
                    }
                  }}
                  className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                    totalPedido > 0 && requestingId !== selectedSoleNeed.id
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

      {/* Service Order (OS) Creation Modal */}
      <Modal
        isOpen={isOSModalOpen}
        onClose={() => { setIsOSModalOpen(false); setEditingOS(null); setPendingOsSourceOrderIds([]); }}
        title={editingOS ? `Editar OS ${editingOS.osNumber}` : "Emitir Ordem de Serviço (OS)"}
        maxWidth="max-w-2xl"
      >
        <div className="flex flex-col gap-6 p-1">
          {/* OS Header Info */}
          {selectedLot && (
            <div className={`p-4 rounded-2xl flex flex-col gap-2 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
              {(() => {
                const hasSelectedOrders = pendingOsSourceOrderIds.length > 0;
                const isAdvancedOS = !!pendingOsSectorOverride && hasSelectedOrders;
                const effectiveQty = pendingOsQuantityOverride ?? selectedLot.quantity;
                const effectiveSector = pendingOsSectorOverride
                  ? sectors.find(s => s.id === pendingOsSectorOverride)?.name
                  : sectors.find(s => s.id === (selectedLot.route && selectedLot.route[selectedLot.currentSectorIndex]))?.name;

                // Produtos e cores dos pedidos selecionados
                const selectedOrderProducts = hasSelectedOrders ? Array.from(new Set(
                  pendingOsSourceOrderIds.map(oid => {
                    const si = ((selectedLot as any).metadata?.sourceItems || []).find((s: any) => s.orderId === oid);
                    const prod = si ? products.find(p => p.id === si.productId) : null;
                    const vari = prod?.variations.find((v: any) => v.id === si?.variationId);
                    return prod ? `${prod.name}${vari?.colorName ? ' · ' + vari.colorName : ''}` : null;
                  }).filter(Boolean)
                )) : [];

                // Quantidade total dos pedidos selecionados
                const selectedOrderQty = hasSelectedOrders
                  ? ((selectedLot as any).metadata?.sourceItems || [])
                      .filter((si: any) => pendingOsSourceOrderIds.includes(si.orderId))
                      .reduce((acc: number, si: any) => acc + (si.qty || 0), 0)
                  : effectiveQty;

                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {isAdvancedOS ? 'Pedidos Adiantados — Mapa' : 'Mapa de Produção'}
                      </span>
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">
                        Qtd: {hasSelectedOrders ? selectedOrderQty : effectiveQty} Pares
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
                      {selectedOrderProducts.length > 0
                        ? selectedOrderProducts.slice(0, 3).join(', ') + (selectedOrderProducts.length > 3 ? ` +${selectedOrderProducts.length - 3}` : '')
                        : (selectedLot.customerName || 'Lote sem cliente')
                      } — #{selectedLot.orderNumber}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {hasSelectedOrders ? `${pendingOsSourceOrderIds.length} pedido(s)` : `Ref: ${products.find(p => p.id === selectedLot.productId)?.reference || '---'}`} • Setor: {effectiveSector || '---'}
                    </p>
                    {isAdvancedOS && (
                      <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">
                        Mapa atualmente em: {sectors.find(s => s.id === (selectedLot.route && selectedLot.route[selectedLot.currentSectorIndex]))?.name || '---'}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* OS Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* OS Number & Type */}
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Número da OS</label>
              <input
                type="text"
                value={osNumber}
                onChange={e => setOsNumber(e.target.value)}
                placeholder="Ex: OS-0001"
                className={`w-full px-5 py-4 rounded-xl border-2 font-bold text-xs outline-none ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-500'}`}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tipo de Serviço</label>
              <div className="grid grid-cols-2 gap-2 h-full">
                <button
                  type="button"
                  onClick={() => setOsType('INTERNAL')}
                  className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    osType === 'INTERNAL'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                      : isDarkMode
                      ? 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Interno
                </button>
                <button
                  type="button"
                  onClick={() => setOsType('OUTSOURCED')}
                  className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    osType === 'OUTSOURCED'
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                      : isDarkMode
                      ? 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Terceirizado
                </button>
              </div>
            </div>

            {/* Provider Selection */}
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Prestador do Serviço</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ComboBox
                  options={people
                    .filter(p => p.isSupplier || (p as any).role === 'WORKER')
                    .map(p => ({ id: p.id || '', name: p.name }))}
                  value={osProviderId}
                  onChange={(id) => {
                    setOsProviderId(id);
                    if (id) setOsProviderManualName('');
                  }}
                  placeholder="Selecionar da agenda..."
                  isDarkMode={isDarkMode}
                  icon={<ClipboardList size={18} />}
                />
                <input
                  type="text"
                  value={osProviderManualName}
                  onChange={e => {
                    setOsProviderManualName(e.target.value);
                    if (e.target.value) setOsProviderId('');
                  }}
                  placeholder="Ou digite o nome manualmente..."
                  className={`w-full px-5 py-4 rounded-xl border-2 font-bold text-xs outline-none ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-500'}`}
                />
              </div>
            </div>

            {/* Account & Category Selection */}
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Conta Financeira (Débito)</label>
              <ComboBox
                options={accounts.map(acc => ({ id: acc.id || '', name: acc.name }))}
                value={osAccountId}
                onChange={setOsAccountId}
                placeholder="Selecionar conta..."
                isDarkMode={isDarkMode}
                icon={<DollarSign size={18} />}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Categoria de Despesa</label>
              <ComboBox
                options={categories.filter(c => c.type === 'EXPENSE').map(c => ({ id: c.id || '', name: c.name }))}
                value={osCategoryId}
                onChange={setOsCategoryId}
                placeholder="Selecionar categoria..."
                isDarkMode={isDarkMode}
                icon={<Tag size={18} />}
              />
            </div>

            {/* Financial cost pricing */}
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Valor por Par (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={osValuePerPair || ''}
                onChange={e => setOsValuePerPair(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className={`w-full px-5 py-4 rounded-xl border-2 font-bold text-xs outline-none ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-500'}`}
              />
            </div>

            <div className="flex flex-col gap-2 justify-center">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Valor Total Estimado</label>
              <div className={`px-5 py-4 rounded-xl border border-dashed text-sm font-black text-emerald-600 dark:text-emerald-400 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                {(() => {
                  const displayQty = pendingOsQuantityOverride ??
                    (pendingOsSourceOrderIds.length > 0
                      ? ((selectedLot as any).metadata?.sourceItems || [])
                          .filter((si: any) => pendingOsSourceOrderIds.includes(si.orderId))
                          .reduce((acc: number, si: any) => acc + (si.qty || 0), 0)
                      : (selectedLot?.quantity ?? 0));
                  return `R$ ${(displayQty * osValuePerPair).toFixed(2)}`;
                })()}
              </div>
            </div>

            {/* Observations */}
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Anotações da OS</label>
              <textarea
                value={osNotes}
                onChange={e => setOsNotes(e.target.value)}
                placeholder="Observações ou instruções específicas para esta OS..."
                rows={2}
                className={`w-full px-5 py-4 rounded-xl border-2 font-bold text-xs outline-none resize-none ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-500'}`}
              />
            </div>

            {/* Não Contábil */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50/20 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-800/30 sm:col-span-2">
              <input
                type="checkbox"
                id="os-nao-contabil"
                checked={osNaoContabil}
                onChange={e => setOsNaoContabil(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300"
              />
              <div>
                <label htmlFor="os-nao-contabil" className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 select-none cursor-pointer block">
                  Não Contábil
                </label>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Não gera lançamento financeiro</span>
              </div>
            </div>

            {/* Direct completion check */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100/30 dark:border-indigo-950/30 sm:col-span-2">
              <input
                type="checkbox"
                id="os-direct-complete"
                checked={osDirectComplete}
                onChange={e => setOsDirectComplete(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <label htmlFor="os-direct-complete" className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 select-none cursor-pointer">
                Concluir e baixar setor imediatamente?
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={() => setIsOSModalOpen(false)}
              className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                isDarkMode 
                  ? 'border-slate-800 text-slate-400 hover:bg-slate-900' 
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSavingOS || (!osProviderId && !osProviderManualName)}
              onClick={handleSaveOS}
              className={`flex-[2] py-4 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 transition-all ${
                isSavingOS || (!osProviderId && !osProviderManualName)
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 text-white shadow-indigo-600/20 hover:bg-indigo-700 hover:scale-[1.01] active:scale-95'
              }`}
            >
              {isSavingOS ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvando OS...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  {editingOS ? 'Salvar Alterações' : 'Emitir Ordem de Serviço'}
                </>
              )}
            </button>
          </div>
        </div>
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
          onClose={() => { setLabelModalProduct(null); setLabelModalLot(null); setLabelModalSizeGrid(''); }}
          product={labelModalProduct}
          isDarkMode={isDarkMode}
          grids={grids || []}
          lot={labelModalLot ?? undefined}
          sizeGridOverride={labelModalSizeGrid || undefined}
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
                      className={`w-full flex flex-col items-center justify-center gap-3 py-8 rounded-2xl border-2 border-dashed transition-all active:scale-98 ${
                        qrBaixaScanning
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
                        className={`w-full pl-8 pr-3 py-3 rounded-2xl text-xs font-black uppercase tracking-widest outline-none border-2 transition-colors ${
                          isDarkMode
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
      {moveSectorModal && (
        <div className="fixed inset-0 z-[400] flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-[2rem] p-6 flex flex-col gap-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
            <div>
              <h3 className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Mover para Setor</h3>
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 text-emerald-500`}>
                {moveSectorModal.orderIds.length} pedido(s) · {moveSectorModal.qty} pares
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Selecione o Setor de Destino</p>
              {(() => {
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
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all active:scale-95 ${
                      moveSectorTarget === sec.id
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
                onClick={() => handleMoveOrdersToSector(moveSectorModal.lotId, moveSectorModal.orderIds, moveSectorTarget)}
                className="flex-1 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-40 active:scale-95 transition-all"
              >
                Confirmar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── OS Completion Feedback Modal ── */}
      {osFeedback && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl flex flex-col items-center text-center gap-5 animate-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl animate-bounce ${
              osFeedback.nextSector === 'FINALIZADO'
                ? 'bg-violet-500 shadow-violet-500/30'
                : 'bg-emerald-500 shadow-emerald-500/30'
            }`}>
              <CheckSquare size={38} className="text-white" strokeWidth={2.5} />
            </div>

            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Ordem de Serviço
              </p>
              <h2 className={`text-xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                OS Concluída!
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

            <button
              type="button"
              onClick={() => setOsFeedback(null)}
              className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg active:scale-95 transition-all"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, ChevronRight, Filter,
  Factory, LayoutDashboard, ListTodo,
  History, MoreVertical, ArrowRight,
  CheckCircle2, AlertCircle, Clock,
  ArrowUpRight, ArrowDownRight, Loader2,
  Settings2, Trash2, Edit3, Edit2, ClipboardList,
  Save, X, Info, Layers, Tag, Package, MinusCircle, CalendarClock, ShoppingCart,
  DollarSign, Hammer, FileText, CheckSquare, Scissors
} from 'lucide-react';
import {
  ProductionLot, Product, Sector,
  FlowTag, Variation, ColorValue, ProductionOrder,
  ProductionConfigItem, SoleStockEntry, ViewType, PurchaseRequest, Grid,
  ServiceOrder, Person, Account, Category, Transaction
} from '../types';
import Modal from '../components/Modal';
import ComboBox from '../components/ComboBox';
import ScannerModal from '../components/ScannerModal';
import PrintOSModal from '../components/PrintOSModal';
import { Camera } from 'lucide-react';
import { labelService } from '../services/labelService';
import { scannerService } from '../services/scannerService';
import { financeService } from '../services/financeService';
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
}: PCPViewProps) {
  const [activeTab, setActiveTab] = useState<'monitor' | 'lots' | 'orders' | 'needs'>(initialTab);
  const [requestingId, setRequestingId] = useState<string | null>(null);
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
  const [isSavingOS, setIsSavingOS] = useState(false);
  const [isPrintOSModalOpen, setIsPrintOSModalOpen] = useState(false);
  const [printOSData, setPrintOSData] = useState<{ os: ServiceOrder; nextSectorName: string } | null>(null);

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
        const searchStr = `${l.orderNumber} ${product?.name} ${product?.reference}`.toLowerCase();
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
      totalPares: number; 
      lotsCount: number; 
      delayedCount: number; 
      urgentCount: number;
    }> = {};
    
    sectors.forEach(s => {
      metrics[s.id] = { totalPares: 0, lotsCount: 0, delayedCount: 0, urgentCount: 0 };
    });

    filteredActiveLots.forEach(lot => {
      const sectorId = (lot.route && lot.route[lot.currentSectorIndex]);
      if (sectorId && metrics[sectorId]) {
        metrics[sectorId].totalPares += lot.quantity;
        metrics[sectorId].lotsCount += 1;
        
        // Delay check: > 24h
        const lastMove = (lot.history && lot.history.length > 0) 
          ? lot.history[lot.history.length - 1]?.timestamp || lot.createdAt 
          : lot.createdAt;
        if (Date.now() - lastMove > 24 * 60 * 60 * 1000) {
          metrics[sectorId].delayedCount += 1;
        }

        if (lot.prioridade === 'URGENTE' || lot.prioridade === 'ALTA') {
          metrics[sectorId].urgentCount += 1;
        }
      }
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
      const variation = product?.variations.find(v => v.id === lot.variationId);
      
      if (!variation) return;

      // 1. Regular Materials from ComponentConsumption
      variation.consumptions?.forEach(cons => {
        if (!cons.materialId) return;
        const config = productionConfigs.find(c => c.id === cons.materialId);
        const key = String(cons.materialId || '').trim();
        if (!key) return;
        if (!materialReqs[key]) {
          materialReqs[key] = {
            id: cons.materialId,
            materialId: cons.materialId,
            name: config?.name || cons.name,
            required: 0,
            stock: config?.metadata?.stock || 0,
            minStock: config?.metadata?.minStock || 0,
            unit: productionConfigs.find(c => c.id === config?.metadata?.unitId)?.name || 'UN',
            type: 'MATERIAL',
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
          : (lot.pairs && Object.keys(lot.pairs).length > 0 ? Object.keys(lot.pairs) : []);

        if (sizesToMap.length > 0) {
          mapping = {};
          sizesToMap.forEach(size => { mapping![size] = product!.moldId!; });
        }
      }

      if (mapping) {
        // Monta pares efetivos por tamanho
        const effectivePairs: Record<string, number> = { ...(lot.pairs || {}) };
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
          
          // Calcula estoque consolidado para esta grade e cor usando o resolvedMoldId
          const currentGradeStock = soleStock
            .filter(s => String(s.moldId).trim() === resolvedMoldId && (String(s.colorId || '').trim() === colorId || (!s.colorId && !colorId)))
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
    });

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

  const handleMoveLotSilent = async (lot: ProductionLot, nextStatusId: string, notes: string) => {
    const isLastSector = lot.route && lot.currentSectorIndex === lot.route.length - 1;
    
    const updatedLot: ProductionLot = {
      ...lot,
      currentStatusId: nextStatusId,
      history: [
        ...lot.history,
        {
          sectorId: lot.route[lot.currentSectorIndex],
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
      updatedLot.currentStatusId = undefined; // Reset status for next sector
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

  const handleOpenOSModal = (lotsToProcess: ProductionLot | ProductionLot[]) => {
    const list = Array.isArray(lotsToProcess) ? lotsToProcess : [lotsToProcess];
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
    const currentSector = sectors.find(s => s.id === (lot.route && lot.route[lot.currentSectorIndex]));
    
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

    const lotProduct = products.find(p => p.id === lot.productId);
    const productSectorPrice = lotProduct?.sectorPrices?.[currentSector?.id || ''];
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
    const currentSector = sectors.find(s => s.id === (firstLot.route && firstLot.route[firstLot.currentSectorIndex]));
    if (!currentSector) {
      alert("Setor atual inválido.");
      return;
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
      const quantity = targetLots.reduce((acc, l) => acc + (l.quantity || 0), 0);
      const totalValue = quantity * osValuePerPair;

      // --- MODO EDIÇÃO ---
      if (editingOS) {
        let newTransactionId = editingOS.transactionId;
        if (editingOS.transactionId) {
          await financeService.deleteTransaction(editingOS.transactionId);
          newTransactionId = undefined;
        }
        if (osAccountId && osCategoryId && totalValue > 0) {
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
      const uniqueId = `os_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      let transactionId = '';
      if (osAccountId && osCategoryId && totalValue > 0) {
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
        sectorId: currentSector.id,
        sectorName: currentSector.name,
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
        finishedAt: osDirectComplete ? Date.now() : undefined
      };

      await firebaseService.saveDocument("serviceOrders", newOS);

      if (osDirectComplete) {
        for (const lot of targetLots) {
          await handleMoveLotSilent(lot, lot.currentStatusId || '', `Baixa automática via OS ${osNumber}. ${osNotes}`);
        }
      }

      alert("Ordem de Serviço criada com sucesso!");
      setIsOSModalOpen(false);
      setIsDetailModalOpen(false);

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

  const handleCompleteOS = async (os: ServiceOrder) => {
    if (confirm(`Deseja concluir a Ordem de Serviço ${os.osNumber} e realizar a baixa de todos os lotes vinculados?`)) {
      try {
        await firebaseService.updateDocument("serviceOrders", os.id, {
          status: 'COMPLETED',
          finishedAt: Date.now()
        });

        if (os.transactionId) {
          await financeService.settleTransaction(os.transactionId);
        }

        const targetLotIds = os.lotIds || [os.lotId];
        for (const lotId of targetLotIds) {
          const lotObj = activeLots.find(l => l.id === lotId) || lots.find(l => l.id === lotId);
          if (lotObj) {
            await handleMoveLotSilent(lotObj, lotObj.currentStatusId || '', `Baixa via conclusão de OS ${os.osNumber}.`);
          }
        }
        
        setIsDetailModalOpen(false);
        setSelectedLot(null);
        alert(`Ordem de Serviço ${os.osNumber} concluída e lotes baixados com sucesso!`);
      } catch (e) {
        console.error(e);
        alert("Erro ao concluir Ordem de Serviço: " + (e instanceof Error ? e.message : String(e)));
      }
    }
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

    const groups: Record<string, {
      productId: string;
      variationId: string;
      quantity: number;
      items: any[];
    }> = {};

    selectedData.forEach(item => {
      const key = `${item.productId}-${item.variationId}`;
      if (!groups[key]) {
        groups[key] = {
          productId: item.productId,
          variationId: item.variationId,
          quantity: 0,
          items: []
        };
      }
      groups[key].quantity += item.toProductionQty;
      groups[key].items.push(item);
    });

    const lotsToCreate: ProductionLot[] = [];
    const groupEntries = Object.values(groups);

    for (const group of groupEntries) {
      const product = products.find(p => p.id === group.productId);
      const route = product?.productionRoute || sectors.map(s => s.id);
      
      const lotId = Math.random().toString(36).substr(2, 9);
      const lotNumber = `${String(lots.length + lotsToCreate.length + 1).padStart(3, '0')}`;

      const newLot: ProductionLot = {
        id: lotId,
        orderNumber: lotNumber,
        productId: group.productId,
        variationId: group.variationId,
        quantity: group.quantity,
        route,
        currentSectorIndex: 0,
        prioridade: 'NORMAL',
        history: [{
          sectorId: route[0] || '',
          statusId: '',
          timestamp: Date.now(),
          userName: userName || 'Usuário',
          notes: `Mapa criado via agrupamento de ${group.items.length} pedidos.`
        }],
        createdAt: Date.now(),
        customerName: group.items.length > 1 ? `${group.items.length} Pedidos Agrupados` : group.items[0].customerName,
        saleId: group.items[0].saleId,
        productionOrderId: group.items[0].orderId,
        saleOrderNumber: group.items[0].saleOrderNumber,
        metadata: {
          sourceItems: group.items.map(i => ({ orderId: i.orderId, itemIdx: i.itemIdx, qty: i.toProductionQty }))
        },
        pairs: group.items.reduce((acc: any, item) => {
          Object.entries(item.sizes || {}).forEach(([size, s]: any) => {
            if (s.toProduction > 0) {
              acc[size] = (acc[size] || 0) + s.toProduction;
            }
          });
          return acc;
        }, {})
      } as any;

      lotsToCreate.push(newLot);
    }

    try {
      for (const lot of lotsToCreate) {
        await onSaveLot(lot);
      }
      setSelectedOrderItems([]);
      alert(`${lotsToCreate.length} Mapa(s) criado(s) com sucesso!`);
      setActiveTab('monitor');
    } catch (err) {
      console.error(err);
      alert('Erro ao criar mapas.');
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

        {/* Linha 2: Botões de ação */}
        <div className="flex items-center gap-2 px-2">
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className={`flex items-center justify-center gap-2 h-12 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-900 text-indigo-400 border border-slate-800' : 'bg-white text-indigo-600 border border-slate-100 shadow-sm'}`}
          >
            <Camera size={15} strokeWidth={3} /> Escanear
          </button>
          <button
            type="button"
            onClick={() => setIsFilterPopupOpen(!isFilterPopupOpen)}
            className={`flex items-center justify-center gap-2 h-12 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border ${
              statusFilter !== 'all' || isFilterPopupOpen
                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-200 dark:border-indigo-800'
                : isDarkMode ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-white text-slate-400 border-slate-100 shadow-sm'
            }`}
          >
            <Filter size={15} /> Filtros
            {statusFilter !== 'all' && <span className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0" />}
          </button>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 h-12 px-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
          >
            <Plus size={15} strokeWidth={3} /> Iniciar MAPA
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
            className={`flex items-center justify-center gap-2 px-3 py-2.5 sm:px-5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'monitor' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
          >
            <LayoutDashboard size={14} /> Monitor WIP
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('lots'); setSelectedSectorId(null); }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 sm:px-5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'lots' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
          >
            <ListTodo size={14} /> MAPAS
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('orders'); setSelectedSectorId(null); }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 sm:px-5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'orders' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
          >
            <ClipboardList size={14} /> Pedidos
            {pendingOrders.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[8px] font-black flex items-center justify-center">
                {pendingOrders.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('needs'); setSelectedSectorId(null); }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 sm:px-5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'needs' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
          >
            <AlertCircle size={14} /> Necessidades
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-6 rounded-[2rem] border flex flex-col gap-1 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total em Produção</span>
              <span className="text-3xl font-black text-indigo-600">{activeLots.reduce((acc, l) => acc + l.quantity, 0)} <span className="text-xs text-slate-400">Pares</span></span>
            </div>
            <div className={`p-6 rounded-[2rem] border flex flex-col gap-1 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MAPAS Ativos</span>
              <span className="text-3xl font-black text-emerald-600">{activeLots.length}</span>
            </div>
            <div className={`p-6 rounded-[2rem] border flex flex-col gap-1 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atrasos Críticos</span>
              <span className="text-3xl font-black text-rose-500">
                {Object.values(sectorMetrics).reduce((acc, m) => acc + m.delayedCount, 0)}
              </span>
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
                    className={`group relative p-8 rounded-[2.5rem] border-2 transition-all flex flex-col gap-6 text-left hover:scale-[1.02] active:scale-95 ${
                      isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-100 hover:border-indigo-200 shadow-sm shadow-slate-200/50'
                    }`}
                  >
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
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                        <Factory size={28} />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white leading-tight">{sector.name}</h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Setor de Produção</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-auto">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Pares</span>
                        <span className={`text-xl font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{metric?.totalPares || 0}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">MAPAS WIP</span>
                        <span className={`text-xl font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{metric?.lotsCount || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest group-hover:translate-x-1 transition-transform">Ver Detalhes</span>
                      <ChevronRight size={16} className="text-indigo-600 dark:text-indigo-400" />
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
                      {isProjectionMode ? 'Ver Lotes Padrão' : 'Painel de Projeção'}
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
                  lots={filteredActiveLots.filter(l => l.route && l.route[l.currentSectorIndex] === selectedSectorId)}
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
                      <p className="text-xs font-black uppercase tracking-wider">{selectedLotIds.length} Lote(s) Selecionado(s)</p>
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
                        if (confirm(`Deseja avançar os ${selectedLotIds.length} lotes selecionados de uma vez?`)) {
                          try {
                            const lotsToAdvance = filteredActiveLots.filter(l => selectedLotIds.includes(l.id));
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
                      Excluir Lotes
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
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-xl">{lot.orderNumber}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 mb-5">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 transition-colors">
                          <Package size={24} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <p className="text-sm font-black truncate text-slate-900 dark:text-white uppercase leading-tight">{product?.name || '---'}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{product?.reference} • {variation?.colorName}</p>
                        </div>
                      </div>

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
                    </motion.div>
                  );
                })}
                {filteredActiveLots.filter(l => l.route && l.route[l.currentSectorIndex] === selectedSectorId).length === 0 && (
                  <div className="col-span-full py-20 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem] flex flex-col items-center justify-center text-slate-300 dark:text-slate-700">
                    <div className="w-20 h-20 rounded-[2.5rem] bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-4">
                      <Clock size={40} className="opacity-20" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest">Sem mapas ativos neste setor</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">Novos mapas aparecerão aqui conforme a produção avançar</p>
                  </div>
                )}
              </div>
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
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Formação de Lote</p>
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
                            Criar Mapas Agrupados
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
                    {purchaseNeeds.sort((a, b) => (b.required - b.stock) - (a.required - a.stock)).map((item) => {
                      const fmtQty = (val: number) => /m[²2]/i.test(item.unit || '') ? Number(val).toFixed(2) : String(Math.round(val));
                      return (
                        <div
                          key={item.id}
                          className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col gap-4 relative ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-white shadow-sm'}`}
                        >
                          {/* Ícone no canto superior direito */}
                          <div className={`absolute top-5 right-5 w-9 h-9 rounded-xl flex items-center justify-center ${item.type === 'SOLE' ? 'bg-indigo-100 text-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                            {item.type === 'SOLE' ? <Layers size={17} /> : <Package size={17} />}
                          </div>

                          {/* Cabeçalho: nome + badges */}
                          <div className="flex flex-col min-w-0 pr-12">
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-black text-slate-900 dark:text-white uppercase leading-tight truncate">{item.name}</p>
                                {item.moldId && (
                                  <span className="text-[8px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase">
                                    ID: {item.moldId.slice(-6)}
                                  </span>
                                )}
                              </div>
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
                        </div>
                      </div>

                          {/* Tabela de grades de solado */}
                          {item.type === 'SOLE' && item.sizeShortages && (() => {
                            // Total necessário = soma de todos os tamanhos do mapa para este molde
                            const totReq = Object.values(item.sizeShortages as any)
                              .reduce((s: number, v: any) => s + v.required, 0) as number;

                            // Estratégia duas etapas para buscar estoque: cor exata → qualquer cor do molde
                            const exactEntries = item.colorId
                              ? soleStock.filter(s => s.moldId === item.moldId && s.colorId === item.colorId)
                              : [];
                            const entries = exactEntries.length > 0
                              ? exactEntries
                              : soleStock.filter(s => s.moldId === item.moldId);

                            // Estoque por grade de sola (chaves do soleStock, ex: "38-39", "43-44")
                            const gradeStock: Record<string, number> = {};
                            entries.forEach(e => {
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
                            const totalFaltaSole = item.type === 'SOLE' && item.sizeShortages
                              ? Object.values(item.sizeShortages).reduce((s: number, v: any) => s + Math.max(0, v.required - v.stock), 0)
                              : Math.max(0, item.required - item.stock);
                            const displayQty = item.type === 'SOLE' ? totalFaltaSole : item.required;
                            const displayLabel = item.type === 'SOLE' ? 'A Comprar' : 'Necessário';

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

                            return (
                              <div className={`flex items-center justify-between pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{displayLabel}</p>
                                  <p className="text-2xl font-black text-rose-600 leading-none">{fmtQty(displayQty)} <span className="text-[11px] text-slate-400">{item.unit}</span></p>
                                </div>
                                {existingReq ? (
                                  <span className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border ${STATUS_COLOR[existingReq.status] || ''}`}>
                                    <CheckCircle2 size={13} strokeWidth={3} />
                                    {STATUS_LABEL[existingReq.status] || existingReq.status}
                                  </span>
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
                                        console.log('[PCPView] Material request sent:', item.name);
                                        alert(`Solicitação de ${item.name} enviada com sucesso!`);
                                      } catch (err) {
                                        console.error('[PCPView] Error sending material request:', err);
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
                                    {requestingId === item.id ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                      <ArrowUpRight size={14} strokeWidth={3} />
                                    )}
                                    {requestingId === item.id ? 'Enviando...' : 'Solicitar'}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
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
              {filteredLots.sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0) || b.createdAt - a.createdAt).map(lot => {
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
        onClose={() => setIsDetailModalOpen(false)}
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
            <div className="flex flex-col gap-8">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="w-20 h-20 rounded-3xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xl shadow-indigo-500/20">
                  <Factory size={40} />
                </div>
                <div className="flex flex-col min-w-0 flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-3 mb-1">
                    <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase leading-none">{selectedLot.orderNumber}</h4>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handlePrintLotLabel(selectedLot)}
                        className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all"
                        title="Imprimir Etiqueta"
                      >
                        <Tag size={14} strokeWidth={3} />
                      </button>
                      <button 
                        onClick={() => {
                          setNewLot({
                            id: selectedLot.id,
                            productId: selectedLot.productId,
                            variationId: selectedLot.variationId,
                            quantity: selectedLot.quantity,
                            prioridade: selectedLot.prioridade,
                            productionOrderId: selectedLot.productionOrderId,
                            customerName: selectedLot.customerName,
                            deliveryDate: selectedLot.deliveryDate,
                            saleId: selectedLot.saleId,
                            saleOrderNumber: selectedLot.saleOrderNumber
                          });
                          setIsDetailModalOpen(false);
                          setIsCreateModalOpen(true);
                        }}
                        className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 transition-all"
                        title="Editar MAPA"
                      >
                        <Edit2 size={14} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{product?.name} • {variation?.colorName}</p>

                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                    <div className="w-3 h-3 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: variation?.color }} />
                    {selectedLot.prioridade && (
                      <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">{selectedLot.prioridade}</span>
                    )}
                  </div>

                  {/* Total em linha única acima da grade */}
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{selectedLot.quantity}</span>
                    <span className="text-sm font-black text-slate-400 uppercase tracking-widest leading-none">Pares</span>
                  </div>

                  {/* Chips de grade */}
                  {selectedLot.pairs && (
                    <div className="flex flex-wrap gap-1.5 mt-2 justify-center sm:justify-start">
                      {Object.entries(selectedLot.pairs).map(([size, qty]) => (
                        <div key={size} className="flex flex-col items-center min-w-[36px] px-2 py-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                          <span className="text-[10px] font-black text-slate-400 leading-none mb-1">{size}</span>
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 leading-none">{qty as number}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Linked Orders Section */}
              {((selectedLot as any).metadata?.sourceItems?.length > 0 || selectedLot.productionOrderId) && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pedidos Vinculados</h4>
                    <span className="text-[10px] font-black text-indigo-500 uppercase">{(selectedLot as any).metadata?.sourceItems?.length || 1} Pedidos</span>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {(() => {
                      const items = (selectedLot as any).metadata?.sourceItems || [
                        { orderId: selectedLot.productionOrderId, qty: selectedLot.quantity }
                      ];
                      
                      return items.map((si: any, idx: number) => {
                        const order = productionOrders.find(o => o.id === si.orderId);
                        return (
                          <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                            <div className="min-w-0 pr-2">
                              <p className="text-[11px] font-black uppercase truncate text-slate-800 dark:text-slate-200 leading-none mb-1">
                                {order?.customerName || selectedLot.customerName || '---'}
                              </p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Pedido {order?.saleOrderNumber || selectedLot.saleOrderNumber}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{si.qty} P</span>
                              {selectedLot.currentSectorIndex === 0 && !selectedLot.finishedAt && (
                                <button 
                                  onClick={() => handleRemoveItemFromLot(selectedLot, si.orderId)}
                                  className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-300 hover:text-rose-500 transition-all"
                                  title="Retirar do Mapa"
                                >
                                  <MinusCircle size={16} />
                                </button>


                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {!isFinished && (() => {
                const currentSectorId = selectedLot.route && selectedLot.route[selectedLot.currentSectorIndex];
                const activeOS = serviceOrders.find(so => 
                  (so.lotId === selectedLot.id || (so.lotIds && so.lotIds.includes(selectedLot.id))) && 
                  so.sectorId === currentSectorId && 
                  so.status === 'PENDING'
                );

                return (
                  <div className="flex flex-col gap-6">
                    {/* OS Section */}
                    {activeOS ? (
                      <div className="p-6 rounded-[2rem] bg-indigo-50/50 dark:bg-indigo-950/20 border-2 border-indigo-500/20 flex flex-col gap-4">
                        {/* OS header: icon + info */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                            <Hammer size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-black text-indigo-950 dark:text-indigo-200 leading-none mb-1">
                              OS Ativa: {activeOS.osNumber}
                            </h5>
                            <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest leading-none truncate">
                              {activeOS.type === 'INTERNAL' ? 'Interna' : 'Terceirizada'} • {activeOS.providerName}
                            </p>
                          </div>
                        </div>

                        {/* Action buttons — own row so never overflow on mobile */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const lot = selectedLot || (lots || []).find(l => l.id === activeOS.lotId);
                              const nextSectorId = lot?.route && lot.route[(lot.currentSectorIndex ?? 0) + 1];
                              const nextSec = (sectors || []).find(s => s.id === nextSectorId);
                              setPrintOSData({ os: activeOS, nextSectorName: nextSec?.name || 'CONCLUÍDO' });
                              setIsPrintOSModalOpen(true);
                            }}
                            className="flex-1 text-[11px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 py-2.5 rounded-xl transition-all text-center"
                          >
                            Imprimir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditOS(activeOS)}
                            className="flex-1 text-[11px] font-black uppercase text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 py-2.5 rounded-xl transition-all text-center"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOS(activeOS)}
                            className="flex-1 text-[11px] font-black uppercase text-rose-500 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 py-2.5 rounded-xl transition-all text-center"
                          >
                            Excluir
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3 bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-950 shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Pares</span>
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">{activeOS.quantity} prs</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Vlr / Par</span>
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">R$ {activeOS.valuePerPair.toFixed(2)}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total OS</span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">R$ {activeOS.totalValue.toFixed(2)}</span>
                          </div>
                        </div>

                        {activeOS.notes && (
                          <div className="p-3 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-xl border border-indigo-100/50 dark:border-indigo-950/50 text-[10px] font-medium italic text-indigo-900/80 dark:text-indigo-300">
                            Obs: {activeOS.notes}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCompleteOS(activeOS)}
                          className="w-full py-5 rounded-[2rem] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
                        >
                          <CheckSquare size={18} /> Concluir OS & Baixar Setor
                        </button>
                      </div>
                    ) : (
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

                        {/* Standard Apontamento de Produção */}
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
                  {selectedLot.history.sort((a, b) => b.timestamp - a.timestamp).map((h, i) => {
                    const sector = sectors.find(s => s.id === h.sectorId);
                    const tag = flowTags.find(t => t.id === h.statusId);
                    const canRevert = i === 0 && selectedLot.history.length > 0;
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
        onClose={() => { setIsOSModalOpen(false); setEditingOS(null); }}
        title={editingOS ? `Editar OS ${editingOS.osNumber}` : "Emitir Ordem de Serviço (OS)"}
        maxWidth="max-w-2xl"
      >
        <div className="flex flex-col gap-6 p-1">
          {/* OS Header Info */}
          {selectedLot && (
            <div className={`p-4 rounded-2xl flex flex-col gap-2 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mapa / Lote</span>
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">
                  Qtd: {selectedLot.quantity} Pares
                </span>
              </div>
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
                {selectedLot.customerName || 'Lote sem cliente'} - OS: {selectedLot.saleOrderNumber || '---'}
              </h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Referência: {products.find(p => p.id === selectedLot.productId)?.reference || '---'} • Setor Atual: {sectors.find(s => s.id === (selectedLot.route && selectedLot.route[selectedLot.currentSectorIndex]))?.name || '---'}
              </p>
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
                R$ {((selectedLot?.quantity || 0) * osValuePerPair).toFixed(2)}
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
    </div>
  );
}

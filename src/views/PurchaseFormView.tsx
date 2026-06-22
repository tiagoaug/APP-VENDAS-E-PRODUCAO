import { useState, useMemo, useEffect } from "react";
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
  ProductionConfigItem,
  ColorValue,
  SolePurchaseItem,
  CategoryType,
  ProductionOrder,
  ProductionOrderItem,
  ProductionLot,
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
  CheckCircle2,
  Users,
  Clock,
  Truck,
  AlertCircle,
  Factory,
  Layers,
  ShoppingBag,
  Box,
  MessageSquare,
  Copy
} from "lucide-react";
import { format } from "date-fns";
import CalculatorModal from '../components/CalculatorModal';
import Modal from '../components/Modal';
import ComboBox from "../components/ComboBox";
import PackagingBuilderModal from '../components/PackagingBuilderModal';
import GradeBuilderModal from '../components/GradeBuilderModal';
import { toast } from '../utils/toast';
import { generateId } from '../utils/id';
import { isHybridProduct } from '../utils/stockPools';

// Cor de texto legível sobre um fundo hexadecimal (preto ou branco, pelo contraste YIQ).
const getContrastingColor = (hexcolor: string) => {
  if (!hexcolor || hexcolor.length < 6) return '#ffffff';
  const cleanHex = hexcolor.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
};

interface PurchaseFormViewProps {
  purchaseId: string | null;
  purchases: Purchase[];
  products: Product[];
  suppliers: Person[];
  categories: Category[];
  accounts: Account[];
  grids: Grid[];
  people: Person[];
  productionConfigs?: ProductionConfigItem[];
  colors?: ColorValue[];
  productionOrders: ProductionOrder[];
  onCreateProductionOrder: (order: ProductionOrder, lots: ProductionLot[], deductions: { productId: string; variationId: string; size?: string; quantity: number }[]) => Promise<void>;
  onSave: (purchase: Purchase) => void;
  onCancel: () => void;
  isDarkMode: boolean;
  initialParams?: any;
}

export default function PurchaseFormView({
  purchaseId,
  purchases,
  products,
  suppliers,
  categories,
  accounts,
  grids,
  people,
  productionConfigs = [],
  colors = [],
  productionOrders,
  onCreateProductionOrder,
  onSave,
  // colors fallback handled below

  onCancel,
  isDarkMode,
  initialParams,
}: PurchaseFormViewProps) {
  const DEFAULT_COLORS: ColorValue[] = [
    { id: 'BRANCO', name: 'BRANCO', hex: '#FFFFFF' } as ColorValue,
    { id: 'PRETO', name: 'PRETO', hex: '#000000' } as ColorValue,
    { id: 'CARAMELO', name: 'CARAMELO', hex: '#C68642' } as ColorValue,
    { id: 'MARROM', name: 'MARROM', hex: '#8B4513' } as ColorValue,
    { id: 'VERMELHO', name: 'VERMELHO', hex: '#FF0000' } as ColorValue,
    { id: 'AZUL', name: 'AZUL', hex: '#0000FF' } as ColorValue,
    { id: 'CINZA', name: 'CINZA', hex: '#808080' } as ColorValue,
    { id: 'NUDE', name: 'NUDE', hex: '#D4A987' } as ColorValue,
    { id: 'OFF WHITE', name: 'OFF WHITE', hex: '#F5F0E8' } as ColorValue,
    { id: 'GELO', name: 'GELO', hex: '#E8F4F8' } as ColorValue,
  ];
  const allColors: ColorValue[] = colors.length > 0 ? colors : DEFAULT_COLORS;

  const getMoldColorOptions = (mold: any): { id: string; label: string }[] => {
    const variations: any[] = Array.isArray(mold?.metadata?.colorVariations) ? mold.metadata.colorVariations : [];
    if (variations.length > 0) {
      const opts = variations
        .filter((cv: any) => cv?.colorId)
        .map((cv: any) => {
          const g = allColors.find(c => c.id === cv.colorId);
          return { id: cv.colorId, label: g?.name || cv.colorName || cv.subRef || cv.colorId };
        });
      if (opts.length > 0) return opts;
    }
    return allColors.map(c => ({ id: c.id, label: c.name }));
  };

  const existing = purchaseId
    ? purchases.find((p) => p.id === purchaseId)
    : null;

  // Pré-preenchimento vindo do "Formular Pedido" (Estoque de Solados): converte
  // { moldId, colorId, initialGrid }[] em SolePurchaseItem[], usando os moldes cadastrados
  // para resolver nome/custo unitário (mirror de SolePurchaseModal initialParams.items).
  const buildSoleItemsFromParams = (): SolePurchaseItem[] => {
    if (!initialParams?.items || initialParams.items.length === 0) return [];
    const moldsList = productionConfigs.filter(c => c.type === 'MOLD');
    const result: SolePurchaseItem[] = [];
    initialParams.items.forEach((p: { moldId: string; colorId?: string; initialGrid?: Record<string, number> }) => {
      const mold = moldsList.find(m => m.id === p.moldId || m.name.toLowerCase() === String(p.moldId).toLowerCase());
      if (!mold) return;
      const initialQuantities = p.initialGrid || {};
      const unitCost = mold.metadata?.unitCost || 0;
      result.push({
        moldId: mold.id,
        moldName: mold.name,
        colorId: p.colorId || '',
        colorName: p.colorId ? (allColors.find(c => c.id === p.colorId)?.name || '') : '',
        quantities: initialQuantities,
        unitCost,
        totalCost: Object.values(initialQuantities).reduce((a: number, b: any) => a + (Number(b) || 0), 0) * unitCost
      });
    });
    return result;
  };

  const [type, setType] = useState<PurchaseType>(
    existing?.type || (initialParams?.type === PurchaseType.SOLE ? PurchaseType.SOLE : PurchaseType.GENERAL),
  );
  const [supplierId, setSupplierId] = useState(() => {
    if (existing?.supplierId) return existing.supplierId;
    if (initialParams?.supplierId) return initialParams.supplierId;
    if (initialParams?.items?.length) {
      const moldsList = productionConfigs.filter(c => c.type === 'MOLD');
      for (const p of initialParams.items) {
        const mold = moldsList.find(m => m.id === p.moldId || m.name.toLowerCase() === String(p.moldId).toLowerCase());
        if (mold?.metadata?.supplierId) return mold.metadata.supplierId;
      }
    }
    return "";
  });
  const [sellerId, setSellerId] = useState(existing?.sellerId || '');
  interface PurchaseBlock {
    id: string;
    productId: string;
    isBox: boolean;
    cost: number;
    unitCost?: number;
    blockPkgId?: string;
    saleType?: SaleType; // pool de estoque a reabastecer (produtos híbridos)
    variations: Record<string, { quantity: number; size?: string; note?: string }>;
  }

  const [blocks, setBlocks] = useState<PurchaseBlock[]>(() => {
    if (!existing?.items || existing.items.length === 0) return [];
    const b: Record<string, PurchaseBlock> = {};
    existing.items.forEach((item) => {
      const key = `${item.productId}-${item.isBox}-${item.cost}`;
      if (!b[key]) {
        const prod = products.find(p => p.id === item.productId);
        b[key] = {
          id: generateId(),
          productId: item.productId,
          isBox: item.isBox,
          cost: item.cost,
          unitCost: item.unitCost,
          saleType: item.saleType ?? prod?.saleTypes?.[0] ?? prod?.type,
          variations: {},
        };
      }
      // Varejo (com tamanho) usa chave composta para não mesclar tamanhos diferentes
      // da mesma variação em uma única entrada.
      const varKey = item.size ? `${item.variationId}-${item.size}` : item.variationId;
      if (!b[key].variations[varKey]) {
        b[key].variations[varKey] = { quantity: 0, size: "" };
      }
      b[key].variations[varKey].quantity += item.quantity;
      b[key].variations[varKey].size =
        item.size || b[key].variations[varKey].size;
    });
    return Object.values(b);
  });
  
  const [expandedBlocks, setExpandedBlocks] = useState<string[]>([]);
  
  const [generalItems, setGeneralItems] = useState<GeneralPurchaseItem[]>(
    existing?.generalItems || initialParams?.initialGeneralItems || [],
  );
  const [soleItems, setSoleItems] = useState<SolePurchaseItem[]>(
    existing?.soleItems || buildSoleItemsFromParams()
  );
  const [notes, setNotes] = useState(existing?.notes || initialParams?.initialDescription || "");
  const [productionGlobalNote, setProductionGlobalNote] = useState<string>(() => {
    if (!existing?.productionOrderId) return '';
    return productionOrders.find(o => o.id === existing.productionOrderId)?.notes || '';
  });
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
    existing?.categoryId || categories?.[0]?.id || "",
  );
  const [accountId, setAccountId] = useState(() => {
    if (existing?.accountId) return existing.accountId;
    const defaultAcc = accounts.find(a => a.isDefault);
    return defaultAcc?.id || accounts?.[0]?.id || "";
  });
  const [generateTransaction, setGenerateTransaction] = useState(
    existing?.generateTransaction !== undefined ? existing?.generateTransaction : true
  );
  // Compras de materiais não são mais recebidas direto no formulário — a entrada no
  // estoque (e por cor) é feita na tela "Recebimento de Compras". Por isso o padrão é
  // "não recebido". O estado segue sendo usado apenas pelo toggle de solados ("Já foi
  // entregue?").
  const [registerAsReceived, setRegisterAsReceived] = useState(
    existing?.registerAsReceived !== undefined ? existing.registerAsReceived : false
  );
  const [isProductionOrder, setIsProductionOrder] = useState(existing?.isProductionOrder ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [packagingPerVar, setPackagingPerVar] = useState<Record<string, { pkgId: string; breakdown: Record<string, number>; fromStock: Record<string, number> }>>({});
  const [packagingModalTarget, setPackagingModalTarget] = useState<{ blockId: string; variationId: string; variationName: string } | null>(null);
  const [pkgPickerBlockIndex, setPkgPickerBlockIndex] = useState<number | null>(null);
  const [gradePerVar, setGradePerVar] = useState<Record<string, Record<string, number>>>({});
  const [gradeModalTarget, setGradeModalTarget] = useState<{ blockId: string; variationId: string; variationName: string; productId: string } | null>(null);
  // Duplicação de modelo (item): escolhe quantas cópias serão criadas a partir de um bloco.
  const [duplicateTarget, setDuplicateTarget] = useState<{ index: number } | null>(null);
  const [duplicateCount, setDuplicateCount] = useState<number>(1);
  const [deliveryDate, setDeliveryDate] = useState<string>(
    existing?.deliveryDate ? new Date(existing.deliveryDate).toISOString().split('T')[0] : ''
  );
  const [prioridade, setPrioridade] = useState<string>(existing?.prioridade || 'NORMAL');

  const activeProducts = useMemo(
    () => products.filter((p) => !p.status || p.status === ProductStatus.ACTIVE),
    [products],
  );

  const calcUnitCost = (costPerGrade: number, prod: Product | undefined): number => {
    if (!prod) return 0;
    if (prod.unitCostPrice) return prod.unitCostPrice;
    const grid = grids.find(g => g.id === prod.defaultGridId);
    if (grid) {
      const gradeSize = Object.values(grid.configuration).reduce((a: number, b: number) => a + b, 0);
      if (gradeSize > 0) return Math.round((costPerGrade / gradeSize) * 100) / 100;
    }
    return 0;
  };

  // Auto-calcular unitCost para blocos sem custo unitário definido
  useEffect(() => {
    const updated = blocks.map(b => {
      if (!b.unitCost) {
        const prod = products.find(p => p.id === b.productId);
        // 1) Packaging block-level
        if (b.blockPkgId) {
          const pkg = productionConfigs.find(c => c.id === b.blockPkgId && c.type === 'PACKAGING');
          const capacity = pkg?.metadata?.capacity || 0;
          if (capacity > 0) {
            const val = (prod?.unitCostPrice) || Math.round((b.cost / capacity) * 100) / 100;
            if (val) return { ...b, unitCost: val };
          }
        }
        // 2) Grid padrão do produto
        const computed = calcUnitCost(b.cost, prod);
        if (computed) return { ...b, unitCost: computed };
      }
      return b;
    });
    if (updated.some((b, i) => b.unitCost !== blocks[i].unitCost)) {
      setBlocks(updated);
    }
  }, [blocks, products, productionConfigs, grids]);

  // Auto-populate seller when supplier changes
  useEffect(() => {
    if (supplierId && !sellerId) {
      const supplier = people.find(p => p.id === supplierId);
      if (supplier) {
        const associatedIds = [
          ...(supplier.associatedContactIds || []),
          ...(supplier.associatedSellerIds || [])
        ];

        if (associatedIds.length > 0) {
          const firstRep = people.find(p => associatedIds.includes(p.id) && (p.isBuyer || p.isSeller));
          if (firstRep) {
            setSellerId(firstRep.id);
          } else {
            const internalRep = supplier.internalContacts?.[0];
            if (internalRep) {
              setSellerId(internalRep.name);
            }
          }
        }
      }
    }
  }, [supplierId, people, sellerId]);

  // Calculator Modal State
  const [calcModal, setCalcModal] = useState<{ isOpen: boolean; field: 'blocks' | 'generalItems' | 'generalItemsQty'; index: number; value: number } | null>(null);

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

  const availableMaterials = useMemo(
    () => productionConfigs.filter(c => c.type === 'MATERIAL' || c.type === 'PACKAGING'),
    [productionConfigs]
  );

  const availableThirdParties = useMemo(
    () => people.filter(p => p.isSupplier || p.isServiceProvider),
    [people]
  );

  const unitConfigs = useMemo(
    () => productionConfigs.filter(c => c.type === 'UNIT'),
    [productionConfigs]
  );

  const getMaterialUnit = (mat: ProductionConfigItem) => {
    const unitItem = unitConfigs.find(u => u.id === mat.metadata?.unitId);
    return unitItem?.name || mat.metadata?.unit || '';
  };

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
    if (cleanName === 'URGENTE') return 3;
    if (cleanName === 'ALTA') return 7;
    return 15;
  };

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
    setPrioridade(p);
    const defaultDays = getDefaultDaysForDeadline(p);
    const calculatedDate = new Date(Date.now() + defaultDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setDeliveryDate(calculatedDate);
  };

  const itemTotal = (item: GeneralPurchaseItem) =>
    (item.quantity ?? 1) * item.value;

  const total = useMemo(() => {
    if (type === PurchaseType.GENERAL) {
      return generalItems.reduce((acc, item) => acc + itemTotal(item), 0);
    }
    if (type === PurchaseType.SOLE) {
      return soleItems.reduce((acc, item) => acc + (Number(item.totalCost) || 0), 0);
    }
    return blocks.reduce((acc, block) => {
      const qtySum = Object.values(block.variations).reduce((sum: number, v: any) => sum + Number(v.quantity || 0), 0) as number;
      return acc + block.cost * qtySum;
    }, 0);
  }, [blocks, type, generalItems, soleItems]);

  const addBlock = (pId: string) => {
    const p = products.find(prod => prod.id === pId);
    if (!p) return;

    const newId = generateId();
    setBlocks([
      ...blocks,
      {
        id: newId,
        productId: p.id,
        isBox: (p.saleTypes?.[0] ?? p.type) === SaleType.WHOLESALE,
        cost: p.costPrice || 0,
        unitCost: calcUnitCost(p.costPrice || 0, p),
        saleType: p.saleTypes?.[0] ?? p.type,
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
    // Varejo (grade por tamanho): chave composta variationId-size, uma entrada por
    // tamanho — igual ao padrão já usado em SaleFormView. Atacado: chave simples
    // (variationId), sem mudança de comportamento.
    const key = size ? `${variationId}-${size}` : variationId;
    const current = block.variations[key] || { quantity: 0, size: "" };
    block.variations = {
      ...block.variations,
      [key]: { ...current, quantity: Math.max(0, quantity), size },
    };
    setBlocks(newBlocks);
  };

  const removeBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  // Duplica o bloco `index` criando `count` cópias logo após ele. Copia também as
  // grades/embalagens por variação (chaveadas por `${blockId}-${variationId}`), para
  // que cada cópia fique idêntica ao original (quantidades, custo, grade e embalagem).
  const duplicateBlock = (index: number, count: number) => {
    const source = blocks[index];
    if (!source || count < 1) return;

    const newBlocks: PurchaseBlock[] = [];
    const newIds: string[] = [];
    const pkgAdditions: Record<string, { pkgId: string; breakdown: Record<string, number>; fromStock: Record<string, number> }> = {};
    const gradeAdditions: Record<string, Record<string, number>> = {};

    for (let i = 0; i < count; i++) {
      const newId = generateId();
      newIds.push(newId);
      // Deep-copy das variações (cada uma é um objeto próprio).
      const clonedVariations: Record<string, { quantity: number; size?: string; note?: string }> = {};
      Object.entries(source.variations).forEach(([varId, data]) => {
        clonedVariations[varId] = { ...data };
        const srcKey = `${source.id}-${varId}`;
        const newKey = `${newId}-${varId}`;
        if (packagingPerVar[srcKey]) {
          pkgAdditions[newKey] = {
            pkgId: packagingPerVar[srcKey].pkgId,
            breakdown: { ...packagingPerVar[srcKey].breakdown },
            fromStock: { ...packagingPerVar[srcKey].fromStock },
          };
        }
        if (gradePerVar[srcKey]) {
          gradeAdditions[newKey] = { ...gradePerVar[srcKey] };
        }
      });
      newBlocks.push({ ...source, id: newId, variations: clonedVariations });
    }

    const next = [...blocks];
    next.splice(index + 1, 0, ...newBlocks);
    setBlocks(next);
    if (Object.keys(pkgAdditions).length > 0) setPackagingPerVar(prev => ({ ...prev, ...pkgAdditions }));
    if (Object.keys(gradeAdditions).length > 0) setGradePerVar(prev => ({ ...prev, ...gradeAdditions }));
    setExpandedBlocks(prev => [...prev, ...newIds]);
  };

  const addCheck = () => {
    setChecks([
      ...checks,
      {
        id: generateId(),
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
        id: generateId(),
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

  const addSoleItem = () => {
    const molds = productionConfigs.filter(c => c.type === 'MOLD');
    const firstMold = molds[0];
    if (!firstMold) { toast.show('Nenhuma matriz de solado cadastrada.'); return; }
    const sizes = firstMold.metadata?.sizes || [];
    const quantities: Record<string, number> = {};
    sizes.forEach((s: string) => { quantities[s] = 0; });
    const firstColor = getMoldColorOptions(firstMold)[0];
    setSoleItems(prev => [...prev, {
      moldId: firstMold.id,
      moldName: firstMold.name,
      colorId: firstColor?.id || '',
      colorName: firstColor?.label || '',
      quantities,
      unitCost: firstMold.metadata?.unitCost || 0,
      totalCost: 0,
    }]);
  };

  const removeSoleItem = (index: number) => {
    setSoleItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateSoleItem = (index: number, updates: Partial<SolePurchaseItem>) => {
    setSoleItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      const item = next[index];
      const pairs = Object.values(item.quantities || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
      next[index].totalCost = pairs * (Number(item.unitCost) || 0);
      return next;
    });
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
    const finalItems: PurchaseItem[] = [];
    if (type === PurchaseType.REPLENISHMENT) {
      blocks.forEach((b) => {
        Object.entries(b.variations).forEach(([varKey, data]) => {
          const typedData = data as { quantity: number; size?: string };
          if (typedData.quantity > 0) {
            // Varejo (grade por tamanho) usa chave composta `${variationId}-${size}`;
            // Atacado usa a chave simples (variationId). IDs gerados por generateId()
            // nunca têm hífen, então o split é seguro.
            const variationId = typedData.size ? varKey.split('-')[0] : varKey;
            finalItems.push({
              productId: b.productId,
              variationId,
              quantity: typedData.quantity,
              size: typedData.size,
              // Deriva sempre de saleType (não da flag isBox armazenada no bloco), pra
              // nunca dessincronizar com a Modalidade (Varejo/Atacado) escolhida acima.
              isBox: b.saleType === SaleType.WHOLESALE,
              cost: b.cost,
              unitCost: b.unitCost,
              saleType: b.saleType,
            });
          }
        });
      });
      if (finalItems.length === 0) {
        toast.show("Adicione pelo menos um item para compra de estoque.");
        return;
      }
    } else if (type === PurchaseType.SOLE) {
      if (soleItems.length === 0) {
        toast.show("Adicione pelo menos um item de solado.");
        return;
      }
    } else {
      if (generalItems.length === 0) {
        toast.show("Adicione pelo menos um item para a compra geral.");
        return;
      }
    }

    const finalRegisterAsReceived = registerAsReceived;

    const purchaseToSave: Purchase = {
      id: purchaseId || generateId(),
      supplierId,
      date: existing?.date || Date.now(),
      dueDate,
      paymentTerm,
      type,
      items: finalItems,
      generalItems: type === PurchaseType.GENERAL ? generalItems : [],
      soleItems: type === PurchaseType.SOLE ? soleItems : [],
      categoryId,
      accountId,
      total,
      notes,
      batchNumber,
      checks,
      generateTransaction,
      registerAsReceived: finalRegisterAsReceived,
      isProductionOrder: type === PurchaseType.REPLENISHMENT ? isProductionOrder : undefined,
      prioridade: type === PurchaseType.REPLENISHMENT ? prioridade : undefined,
      deliveryDate: type === PurchaseType.REPLENISHMENT && deliveryDate ? new Date(deliveryDate).getTime() : undefined,
      sellerId,
      sellerName: people.find(p => p.id === sellerId)?.name || sellerId || '',
      paymentStatus: paymentTerm === PaymentTerm.INSTALLMENTS ? PaymentStatus.PENDING : PaymentStatus.PAID,
    };

    // Cria (ou atualiza) o Pedido de Produção (OP) na fila de espera do PCP — mapas são criados manualmente lá
    if (type === PurchaseType.REPLENISHMENT && isProductionOrder) {
      // Validação: embalagem obrigatória para cada variação com quantidade > 0 — só
      // se aplica a Atacado (caixa coletiva agrupando pares). Varejo não tem grade/
      // embalagem: cada entrada já é a quantidade exata de pares daquele tamanho.
      const missingPkg: string[] = [];
      blocks.forEach(block => {
        if (block.saleType === SaleType.RETAIL) return;
        const product = products.find(p => p.id === block.productId);
        Object.entries(block.variations).forEach(([variationId, varData]) => {
          const typedVarData = varData as { quantity: number; size?: string; note?: string };
          if (typedVarData.quantity <= 0) return;
          const varKey = `${block.id}-${variationId}`;
          const pkg = packagingPerVar[varKey];
          if (!pkg?.pkgId) {
            const variation = product?.variations.find(v => v.id === variationId);
            missingPkg.push(`• ${product?.name || 'Produto'} — ${variation?.colorName || variationId}`);
          }
        });
      });
      if (missingPkg.length > 0) {
        toast.show(`Embalagem obrigatória para OP de produção.\nConfigure antes de salvar:\n${missingPkg.join('\n')}`);
        return;
      }

      // Reutiliza o ID da OP existente ao editar — evita duplicação de OPs com quantidades acumuladas
      const existingOrderId = existing?.productionOrderId;
      const existingOrder = productionOrders.find(o => o.id === existingOrderId);
      const orderId = existingOrderId || generateId();
      const orderNum = existingOrder?.orderNumber || `OP #${String(productionOrders.length + 1).padStart(3, '0')}`;
      const orderItems: ProductionOrderItem[] = [];

      blocks.forEach(block => {
        const product = products.find(p => p.id === block.productId);

        if (block.saleType === SaleType.RETAIL) {
          // Varejo: não existe grade/embalagem — cada entrada da grade por tamanho já
          // É a quantidade exata de pares daquele tamanho (sem multiplicador de caixa).
          // Agrupa por variação (cor) para gerar um ProductionOrderItem por cor, igual ao Atacado.
          const byVariation = new Map<string, { sizes: Record<string, number>; note?: string }>();
          Object.entries(block.variations).forEach(([varKey, varData]) => {
            const typedVarData = varData as { quantity: number; size?: string; note?: string };
            if (typedVarData.quantity <= 0 || !typedVarData.size) return;
            const variationId = varKey.split('-')[0];
            const entry = byVariation.get(variationId) || { sizes: {} as Record<string, number> };
            entry.sizes[typedVarData.size] = (entry.sizes[typedVarData.size] || 0) + typedVarData.quantity;
            if (typedVarData.note?.trim()) entry.note = typedVarData.note.trim();
            byVariation.set(variationId, entry);
          });

          byVariation.forEach((entry, variationId) => {
            const variation = product?.variations.find(v => v.id === variationId);
            const sizesResult: Record<string, { total: number; fromStock: number; toProduction: number }> = {};
            let totalPairs = 0;
            Object.entries(entry.sizes).forEach(([size, qty]) => {
              sizesResult[size] = { total: qty, fromStock: 0, toProduction: qty };
              totalPairs += qty;
            });
            if (totalPairs === 0) return;
            const combinedNote = [productionGlobalNote?.trim(), entry.note].filter(Boolean).join('\n') || undefined;
            orderItems.push({
              productId: block.productId,
              productName: product?.name || '',
              variationId,
              variationName: variation?.colorName || '',
              saleType: SaleType.RETAIL,
              sizes: sizesResult,
              totalQuantity: totalPairs,
              fromStockQty: 0,
              toProductionQty: totalPairs,
              ...(combinedNote ? { notes: combinedNote } : {}),
            });
          });
          return;
        }

        Object.entries(block.variations).forEach(([variationId, varData]) => {
          const typedVarData = varData as { quantity: number; size?: string; note?: string };
          if (typedVarData.quantity <= 0) return;
          const variation = product?.variations.find(v => v.id === variationId);
          const varKey = `${block.id}-${variationId}`;
          const pkg = packagingPerVar[varKey];
          const breakdown: Record<string, number> = pkg?.pkgId ? pkg.breakdown : (gradePerVar[varKey] || {});
          const pairsPerGrade = Object.values(breakdown).reduce((a, b) => a + b, 0);
          if (pairsPerGrade === 0) return;

          const totalPairsPerSize: Record<string, number> = {};
          let totalPairs = 0;
          Object.entries(breakdown).forEach(([size, ppg]) => {
            if (ppg > 0) {
              totalPairsPerSize[size] = ppg * typedVarData.quantity;
              totalPairs += ppg * typedVarData.quantity;
            }
          });
          if (totalPairs === 0) return;

          const stockDeductPerSize = pkg?.fromStock || {};
          const sizesResult: Record<string, { total: number; fromStock: number; toProduction: number }> = {};
          let fromStockTotal = 0;
          Object.entries(totalPairsPerSize).forEach(([size, total]) => {
            const fs = Math.min(stockDeductPerSize[size] || 0, total);
            sizesResult[size] = { total, fromStock: fs, toProduction: total - fs };
            fromStockTotal += fs;
          });
          const combinedNote = [productionGlobalNote?.trim(), typedVarData.note?.trim()].filter(Boolean).join('\n') || undefined;
          orderItems.push({
            productId: block.productId,
            productName: product?.name || '',
            variationId,
            variationName: variation?.colorName || '',
            saleType: SaleType.WHOLESALE,
            sizes: sizesResult,
            totalQuantity: totalPairs,
            fromStockQty: fromStockTotal,
            toProductionQty: totalPairs - fromStockTotal,
            ...(combinedNote ? { notes: combinedNote } : {}),
          });
        });
      });

      if (orderItems.length > 0) {
        const order: ProductionOrder = {
          id: orderId,
          orderNumber: orderNum,
          saleId: purchaseToSave.id,
          saleOrderNumber: `Compra ${batchNumber}`,
          customerName: 'Estoque',
          orderDate: purchaseToSave.date,
          deliveryDate: purchaseToSave.deliveryDate || Date.now(),
          items: orderItems,
          status: 'PENDING',
          lotIds: [], // mapas criados manualmente no PCP
          notes: productionGlobalNote?.trim() || undefined,
          createdAt: Date.now(),
        };
        purchaseToSave.productionOrderId = orderId;
        await onSave(purchaseToSave);
        await onCreateProductionOrder(order, [], []); // sem lotes — fila de espera
        return;
      }
    }

    onSave(purchaseToSave);
    } finally {
      setIsSaving(false);
    }
  };

  // Aplica embalagem a todas as variações do bloco
  const applyBlockPackaging = (blockIndex: number, pkgId: string) => {
    const block = blocks[blockIndex];
    const product = products.find(p => p.id === block.productId);
    if (!product) return;
    if (!pkgId) {
      updateBlock(blockIndex, { blockPkgId: undefined });
      setPackagingPerVar(prev => {
        const next = { ...prev };
        product.variations.forEach(v => { delete next[`${block.id}-${v.id}`]; });
        return next;
      });
      return;
    }
    const pkg = productionConfigs.find(c => c.id === pkgId && c.type === 'PACKAGING');
    if (!pkg) return;
    // Auto-calcular custo unitário por par se ainda não definido
    const capacity = pkg.metadata?.capacity || 0;
    const blockUpdates: Partial<PurchaseBlock> = { blockPkgId: pkgId };
    if (capacity > 0 && !block.unitCost) {
      const registeredUnitCost = product.unitCostPrice || 0;
      const calculatedUnitCost = Math.round((block.cost / capacity) * 100) / 100;
      blockUpdates.unitCost = registeredUnitCost || calculatedUnitCost;
    }
    updateBlock(blockIndex, blockUpdates);
    const sizeQtys: Record<string, number> = pkg.metadata?.sizeQuantities || {};
    const pkgSizes: string[] = pkg.metadata?.sizes?.length ? pkg.metadata.sizes as string[] : Object.keys(sizeQtys);
    const breakdown: Record<string, number> = {};
    pkgSizes.forEach(s => { breakdown[s] = sizeQtys[s] || 0; });
    setPackagingPerVar(prev => {
      const next = { ...prev };
      product.variations.forEach(v => { next[`${block.id}-${v.id}`] = { pkgId, breakdown, fromStock: {} }; });
      return next;
    });
  };

  // Cesta de compras — itens configurados
  const cartItems = useMemo(() => {
    const items: { blockId: string; blockIndex: number; productId: string; productName: string; reference: string; variationId: string; variationName: string; quantity: number; cost: number; pkgConfig?: { pkgId: string; pkgName: string; breakdown: Record<string, number>; pairsPerEmb: number } }[] = [];
    blocks.forEach((block, blockIndex) => {
      const product = products.find(p => p.id === block.productId);
      Object.entries(block.variations).forEach(([variationKey, varData]) => {
        if (varData.quantity <= 0) return;
        const variationId = variationKey.split('-')[0];
        const variation = product?.variations.find(v => v.id === variationId);
        const pkg = packagingPerVar[`${block.id}-${variationId}`];
        const pkgConfig = pkg?.pkgId ? productionConfigs.find(c => c.id === pkg.pkgId) : undefined;
        const pairsPerEmb = pkg ? Object.values(pkg.breakdown).reduce((a, b) => a + b, 0) : 0;
        items.push({
          blockId: block.id, blockIndex,
          productId: block.productId,
          productName: product?.name || '',
          reference: product?.reference || '',
          variationId,
          variationName: variation?.colorName || '',
          quantity: varData.quantity,
          cost: block.cost,
          ...(pkg?.pkgId ? { pkgConfig: { pkgId: pkg.pkgId, pkgName: pkgConfig?.name || '', breakdown: pkg.breakdown, pairsPerEmb } } : {})
        });
      });
    });
    return items;
  }, [blocks, products, packagingPerVar, productionConfigs]);

  const openCalculator = (index: number, type: 'blocks' | 'generalItems' | 'generalItemsQty') => {
    let value = 0;
    if (type === 'generalItems') {
      value = generalItems[index].value || 0;
    } else if (type === 'generalItemsQty') {
      value = generalItems[index].quantity || 0;
    } else {
      value = blocks[index].cost || 0;
    }
    setCalcModal({ isOpen: true, field: type, index, value });
  };

  // Duplica um item de compra geral logo após o original (mesmo material, cor,
  // quantidade e valor) — cada cópia recebe um id próprio.
  const duplicateGeneralItem = (index: number, count: number) => {
    const source = generalItems[index];
    if (!source || count < 1) return;
    const copies: GeneralPurchaseItem[] = [];
    for (let i = 0; i < count; i++) {
      copies.push({ ...source, id: generateId() });
    }
    const next = [...generalItems];
    next.splice(index + 1, 0, ...copies);
    setGeneralItems(next);
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
        <div className="flex bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700 gap-1">
          <button
            onClick={() => setType(PurchaseType.REPLENISHMENT)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              type === PurchaseType.REPLENISHMENT
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 dark:text-slate-500 hover:text-indigo-500'
            }`}
            aria-label="Tipo de compra estoque"
            title="Estoque"
          >
            <Package size={14} strokeWidth={2.5} /> Estoque
          </button>
          <button
            onClick={() => setType(PurchaseType.GENERAL)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              type === PurchaseType.GENERAL
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-400/25'
                : 'text-slate-400 dark:text-slate-500 hover:text-amber-500'
            }`}
            aria-label="Tipo de compra geral"
            title="Geral"
          >
            <ShoppingCart size={14} strokeWidth={2.5} /> Geral
          </button>
          <button
            type="button"
            onClick={() => setType(PurchaseType.SOLE)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              type === PurchaseType.SOLE
                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-400/25'
                : 'text-slate-400 dark:text-slate-500 hover:text-cyan-500'
            }`}
            aria-label="Compra de solados"
            title="Solados"
          >
            <ShoppingCart size={14} strokeWidth={2.5} /> Solados
          </button>
        </div>

        {/* Identificação da Compra/Lote — acima do fornecedor */}
        <div className="relative">
          <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-400 px-3 mb-2 block tracking-widest leading-none">
            Identificação da Compra/Lote
          </label>
          <div className={`flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl pl-4 pr-5`}>
            {/* Toggle AUTO */}
            <label className="flex items-center gap-2 cursor-pointer shrink-0">
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
            {/* Input na mesma linha */}
            <input
              type="text"
              className={`flex-1 bg-transparent border-none py-4 text-[12px] font-black uppercase tracking-widest focus:ring-0 outline-none ${isAutoBatchNumber ? 'text-slate-400' : 'text-indigo-500 dark:text-indigo-400'}`}
              value={batchNumber}
              onChange={(e) => { setBatchNumber(e.target.value); setIsAutoBatchNumber(false); }}
              placeholder="Ex: Nota Fiscal 1234"
              disabled={isAutoBatchNumber}
              aria-label="Número do lote"
              title="Número do Lote"
            />
            <Info size={14} className="text-cyan-400 shrink-0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="relative col-span-2">
            <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-400 px-3 mb-2 block tracking-widest leading-none">
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
            <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-400 px-3 mb-2 block tracking-widest leading-none">Comprador / Representante</label>
            <ComboBox 
              options={[
                ...people.filter(p => p.isSeller || p.isBuyer).map(p => ({ id: p.id, name: p.name })),
                ...(suppliers.find(s => s.id === supplierId)?.internalContacts?.map(c => ({ id: c.name, name: c.name })) || [])
              ]}
              value={sellerId}
              onChange={setSellerId}
              placeholder="SELECIONE O RESPONSÁVEL"
              isDarkMode={isDarkMode}
              icon={<Users size={18} />}
            />

            {/* Badges de Sugestão do Fornecedor */}
            {supplierId && (
              <div className="mt-3 flex flex-wrap gap-2 px-1">
                {(() => {
                  const s = suppliers.find(sup => sup.id === supplierId);
                  if (!s) return null;
                  
                  const linkedReps = people.filter(p => 
                    (s.associatedContactIds?.includes(p.id) || s.associatedSellerIds?.includes(p.id))
                  );

                  return (
                    <>
                      {linkedReps.map(rep => (
                        <button
                          key={rep.id}
                          type="button"
                          onClick={() => setSellerId(rep.id)}
                          className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all active:scale-95 ${sellerId === rep.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600')}`}
                        >
                          <Users size={12} />
                          <span className="text-[10px] font-black uppercase tracking-tight">{rep.name}</span>
                        </button>
                      ))}
                      {s.internalContacts?.map((c, idx) => (
                        <button
                          key={`int-${idx}`}
                          type="button"
                          onClick={() => setSellerId(c.name)}
                          className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all active:scale-95 ${sellerId === c.name ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600')}`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[10px] font-black uppercase tracking-tight">{c.name}</span>
                        </button>
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="relative col-span-2">
            <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-400 px-3 mb-2 block tracking-widest leading-none">
              Lançamento Financeiro
            </label>
            <div className={`p-1.5 rounded-2xl border flex items-center gap-2 transition-all ${generateTransaction ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/50' : 'bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
              <button
                type="button"
                onClick={() => setGenerateTransaction(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${generateTransaction ? "bg-emerald-500 shadow-lg shadow-emerald-500/20 text-white" : "text-slate-400 dark:text-slate-500"}`}
                aria-label="Gerar transação contábil"
                title="Contábil"
              >
                <div className={`w-2 h-2 rounded-full ${generateTransaction ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
                Contábil
              </button>
              <button
                type="button"
                onClick={() => setGenerateTransaction(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!generateTransaction ? "bg-rose-500 shadow-lg shadow-rose-500/20 text-white" : "text-slate-400 dark:text-slate-500"}`}
                aria-label="Não gerar transação contábil"
                title="Não Contábil"
              >
                <div className={`w-2 h-2 rounded-full ${!generateTransaction ? 'bg-white' : 'bg-slate-300'}`} />
                Não Contábil
              </button>
            </div>
            <p className={`text-[8px] font-bold uppercase tracking-widest mt-2 px-3 ${generateTransaction ? 'text-emerald-500 font-black' : 'text-rose-500 font-black'}`}>
              {generateTransaction ? "*GERARÁ UM TÍTULO NO FINANCEIRO PARA PAGAMENTO" : "*NÃO SERÁ TRACKEADO NO FLUXO DE CONTAS A PAGAR"}
            </p>
          </div>

          {/* Campos fiscais — ocultos quando Não Contábil */}
          {generateTransaction && (<>
          <div className="relative col-span-2">
            <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-400 px-3 mb-2 block tracking-widest leading-none">
              Data de Vencimento
            </label>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-[1.5rem] border-2 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-amber-500/50' : 'bg-white border-slate-200 hover:border-amber-300'} shadow-sm`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-amber-900/30' : 'bg-amber-50'}`}>
                <CalendarIcon size={17} className="text-amber-500" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 leading-none mb-0.5">Vencimento</span>
                <input
                  type="date"
                  className={`w-full bg-transparent border-none p-0 text-[13px] font-black focus:ring-0 outline-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}
                  value={(() => {
                    try { return format(dueDate, "yyyy-MM-dd"); } catch { return format(new Date(), "yyyy-MM-dd"); }
                  })()}
                  onChange={(e) => setDueDate(new Date(e.target.value).getTime() || Date.now())}
                  aria-label="Data de vencimento"
                  title="Vencimento"
                />
              </div>
            </div>
          </div>

          <div className="relative col-span-2">
            <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-400 px-3 mb-2 block tracking-widest leading-none">
              Pagamento
            </label>
            <div className="flex bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setPaymentTerm(PaymentTerm.CASH)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentTerm === PaymentTerm.CASH ? "bg-emerald-500 shadow-lg shadow-emerald-500/20 text-white" : "text-slate-600 dark:text-slate-300"}`}
                aria-label="Pagamento à vista"
                title="À Vista"
              >
                À Vista
              </button>
              <button
                onClick={() => setPaymentTerm(PaymentTerm.INSTALLMENTS)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentTerm === PaymentTerm.INSTALLMENTS ? "bg-orange-500 shadow-lg shadow-orange-500/20 text-white" : "text-slate-600 dark:text-slate-300"}`}
                aria-label="Pagamento a prazo"
                title="A Prazo"
              >
                A Prazo
              </button>
            </div>
          </div>

          <div className="relative col-span-2">
            <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-400 px-3 mb-2 block tracking-widest leading-none">
              Categoria Financeira
            </label>
            <ComboBox
              options={type === PurchaseType.SOLE
                ? categories.filter(c => c.type === CategoryType.EXPENSE)
                : categories}
              value={categoryId}
              onChange={setCategoryId}
              isDarkMode={isDarkMode}
            />
          </div>

          <div className="relative col-span-2">
            <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-400 px-3 mb-2 block tracking-widest leading-none">
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
          </>)}
        </div>
      </div>

      {type === PurchaseType.GENERAL && (
        <section>
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h3 className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-900 dark:text-white leading-none">
                Itens da Compra Geral
              </h3>
              <p className="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">
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
            {generalItems.map((item, index) => {
              const selectedMat = availableMaterials.find(m => m.id === item.materialId);
              const unitLabel = item.unit || (selectedMat ? getMaterialUnit(selectedMat) : '');
              const total = itemTotal(item);
              const isPersonItem = item.kind === 'person';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-[2rem] border shadow-sm flex flex-col gap-3 relative group overflow-hidden ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
                >
                  {/* Tipo do item: Material x Fornecedor/Terceirizado */}
                  <div className="flex gap-2 p-1 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => updateGeneralItem(index, { kind: 'material', personId: undefined })}
                      className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${!isPersonItem ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      Material
                    </button>
                    <button
                      type="button"
                      onClick={() => updateGeneralItem(index, { kind: 'person', materialId: undefined, colorId: undefined, colorName: undefined, unit: undefined })}
                      className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isPersonItem ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      Fornecedor / Terceirizado
                    </button>
                  </div>

                  {/* Campo 1: Seleção do Material ou do Fornecedor/Terceirizado */}
                  <div className="flex gap-3 items-start">
                    <div className="flex-1 flex flex-col gap-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white ml-1">
                        {isPersonItem ? 'Fornecedor / Terceirizado' : 'Material'}
                      </p>
                      {isPersonItem ? (
                        <ComboBox
                          options={availableThirdParties.map(p => ({ id: p.id, name: p.name }))}
                          value={item.personId || ''}
                          onChange={(val) => {
                            const person = availableThirdParties.find(p => p.id === val);
                            updateGeneralItem(index, {
                              personId: val || undefined,
                              description: person?.name || item.description,
                            });
                          }}
                          placeholder="Pesquisar fornecedor ou terceirizado..."
                          isDarkMode={isDarkMode}
                        />
                      ) : (
                        <>
                          <ComboBox
                            options={availableMaterials.map(m => ({ id: m.id, name: m.name }))}
                            value={item.materialId || ''}
                            onChange={(val) => {
                              const mat = availableMaterials.find(m => m.id === val);
                              updateGeneralItem(index, {
                                materialId: val || undefined,
                                description: mat?.name || item.description,
                                unit: mat ? getMaterialUnit(mat) : item.unit,
                                value: mat?.metadata?.baseCost ?? item.value,
                              });
                            }}
                            placeholder="Pesquisar material..."
                            isDarkMode={isDarkMode}
                          />
                          {!item.materialId && (
                            <input
                              type="text"
                              placeholder="Ou descreva manualmente..."
                              title="Descrição manual"
                              className={`mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-[12px] font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none`}
                              value={item.description}
                              onChange={(e) => updateGeneralItem(index, { description: e.target.value })}
                            />
                          )}
                          {(selectedMat?.metadata?.colorIds?.length || 0) > 0 && (
                            <select
                              className={`mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-[11px] font-bold outline-none ${isDarkMode ? 'text-white' : 'text-slate-700'}`}
                              value={item.colorId || ''}
                              onChange={(e) => {
                                const cid = e.target.value;
                                const cname = allColors.find(c => c.id === cid)?.name || '';
                                updateGeneralItem(index, { colorId: cid || undefined, colorName: cname || undefined });
                              }}
                            >
                              <option value="">Selecione a Cor...</option>
                              {(selectedMat!.metadata!.colorIds || []).map((cid: string) => {
                                const color = allColors.find(c => c.id === cid);
                                return <option key={cid} value={cid}>{color?.name || cid}</option>;
                              })}
                            </select>
                          )}
                        </>
                      )}
                    </div>
                    <div className="mt-5 flex flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => duplicateGeneralItem(index, 1)}
                        className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 transition-colors"
                        aria-label="Duplicar item"
                        title="Duplicar item"
                      >
                        <Copy size={16} strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGeneralItem(index)}
                        className="p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors"
                        aria-label="Remover item"
                        title="Remover"
                      >
                        <Trash2 size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  {/* Linha 1: Quantidade + Valor Unitário */}
                  <div className="flex gap-2 items-end">
                    {/* Quantidade */}
                    <div className="flex flex-col gap-1 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white ml-1">
                        Qtd{unitLabel ? ` (${unitLabel})` : ''}
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={0}
                          step="0.001"
                          title="Quantidade"
                          placeholder="0"
                          className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl px-3 py-3 text-[13px] font-black text-center text-slate-800 dark:text-slate-100 outline-none`}
                          value={item.quantity ?? ''}
                          onChange={(e) => updateGeneralItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                        />
                        <button
                          type="button"
                          onClick={() => openCalculator(index, 'generalItemsQty')}
                          className="w-11 shrink-0 flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl hover:bg-indigo-100 transition-colors"
                          aria-label="Calculadora da quantidade"
                          title="Calculadora da quantidade"
                        >
                          <Calculator size={16} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>

                    {/* Valor Unitário */}
                    <div className="flex flex-col gap-1 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white ml-1">Valor Unit. (R$)</p>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-400">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            title="Valor unitário"
                            placeholder="0,00"
                            className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl pl-8 pr-3 py-3 text-[13px] font-black text-slate-800 dark:text-slate-100 outline-none font-mono`}
                            value={item.value || ''}
                            onChange={(e) => updateGeneralItem(index, { value: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => openCalculator(index, 'generalItems')}
                          className="w-11 shrink-0 flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl hover:bg-indigo-100 transition-colors"
                          aria-label="Calculadora"
                          title="Calculadora"
                        >
                          <Calculator size={16} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Linha 2: Total do item */}
                  <div className={`flex items-center justify-between px-4 py-3 rounded-2xl ${total > 0 ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'bg-slate-50 dark:bg-slate-800/40'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Total do Item</p>
                    <p className={`text-sm font-black ${total > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600'}`}>
                      R$ {total.toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}

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

      {/* SOLE ITEMS SECTION */}
      {type === PurchaseType.SOLE && (
        <div className={`p-6 rounded-[2rem] border flex flex-col gap-4 shadow-sm ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
          <div className="flex items-center justify-between">
            <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Itens / Grade de Solados
            </p>
            <button
              type="button"
              onClick={addSoleItem}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 text-white text-[10px] font-black uppercase tracking-widest"
            >
              <Plus size={14} /> Adicionar Item
            </button>
          </div>

          {soleItems.map((item, index) => {
            const molds = productionConfigs.filter(c => c.type === 'MOLD');
            const mold = molds.find(m => m.id === item.moldId);
            const sizes = mold?.metadata?.sizes || [];
            const colorOpts = getMoldColorOptions(mold);
            const totalPairs = Object.values(item.quantities || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);

            return (
              <div key={index} className={`p-4 rounded-2xl border-2 flex flex-col gap-3 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                {/* Linha 1: Nome do Solado + remover */}
                <div className="flex items-end gap-3">
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Nome do Solado</label>
                    <select
                      value={item.moldId}
                      aria-label="Selecionar modelo de solado"
                      title="Modelo de Solado"
                      onChange={(e) => {
                        const m = molds.find(mod => mod.id === e.target.value);
                        const newSizes = m?.metadata?.sizes || [];
                        const newQtys: Record<string, number> = {};
                        newSizes.forEach((s: string) => { newQtys[s] = 0; });
                        updateSoleItem(index, { moldId: e.target.value, moldName: m?.name || '', quantities: newQtys });
                      }}
                      className={`w-full px-4 py-3 rounded-xl text-xs font-black border-2 outline-none ${isDarkMode ? 'bg-slate-900 border-slate-800 focus:border-cyan-500' : 'bg-white border-slate-200 focus:border-cyan-600'}`}
                    >
                      {molds.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => removeSoleItem(index)} aria-label="Remover item de solado" title="Remover" className="mb-0.5 p-3 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">
                    <Trash2 size={18} />
                  </button>
                </div>

                {/* Linha 2: Cor */}
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Cor</label>
                  <select
                    value={item.colorId}
                    aria-label="Selecionar cor do solado"
                    title="Cor do Solado"
                    onChange={(e) => {
                      const found = colorOpts.find(c => c.id === e.target.value);
                      updateSoleItem(index, { colorId: e.target.value, colorName: found?.label || e.target.value });
                    }}
                    className={`w-full px-4 py-3 rounded-xl text-xs font-black border-2 outline-none ${isDarkMode ? 'bg-slate-900 border-slate-800 focus:border-cyan-500' : 'bg-white border-slate-200 focus:border-cyan-600'}`}
                  >
                    <option value="">SELECIONAR COR...</option>
                    {colorOpts.map((c, i) => <option key={`${c.id}-${i}`} value={c.id}>{c.label}</option>)}
                  </select>
                </div>

                {/* Grade de tamanhos */}
                {sizes.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {sizes.map((size: string) => (
                      <div key={size} className="flex flex-col gap-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase text-center">{size}</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={item.quantities[size] === 0 ? '' : (item.quantities[size] || '')}
                          onFocus={e => e.target.select()}
                          onChange={(e) => updateSoleItem(index, { quantities: { ...item.quantities, [size]: parseInt(e.target.value) || 0 } })}
                          placeholder="0"
                          className={`w-full px-1 py-2 rounded-lg text-[11px] font-black text-center border-2 outline-none ${isDarkMode ? 'bg-slate-900 border-slate-800 focus:border-cyan-500' : 'bg-white border-slate-200 focus:border-cyan-600'}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Custo e total */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Custo Un. (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitCost || ''}
                      onChange={(e) => updateSoleItem(index, { unitCost: parseFloat(e.target.value) || 0 })}
                      onFocus={(e) => e.target.select()}
                      placeholder="0,00"
                      className={`w-24 px-3 py-2 rounded-xl text-xs font-black border-2 outline-none ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total do Item</p>
                    <p className="text-sm font-black text-cyan-600 dark:text-cyan-400">R$ {Number(item.totalCost || 0).toFixed(2)}</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{totalPairs} pares</p>
                  </div>
                </div>
              </div>
            );
          })}

          {soleItems.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-6">Nenhum item adicionado. Clique em "Adicionar Item".</p>
          )}

          {/* Toggle: Já foi entregue? */}
          <div className={`mt-4 rounded-2xl border-2 overflow-hidden transition-all ${
            registerAsReceived
              ? isDarkMode ? 'border-emerald-800 bg-emerald-950/20' : 'border-emerald-200 bg-emerald-50'
              : isDarkMode ? 'border-amber-700/60 bg-amber-950/20' : 'border-amber-300 bg-amber-50'
          }`}>
            {/* Banner de status */}
            {!registerAsReceived && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-400/20 border-b border-amber-300/50 dark:border-amber-700/40">
                <AlertCircle size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
                  Pendente de recebimento — será enviado para Recebimento de Estoques Gerais
                </p>
              </div>
            )}
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                  registerAsReceived
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                }`}>
                  {registerAsReceived ? <Truck size={22} strokeWidth={2} /> : <Clock size={22} strokeWidth={2} />}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-black uppercase tracking-tight ${
                    registerAsReceived ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                  }`}>
                    {registerAsReceived ? 'Já foi entregue' : 'Aguardando entrega'}
                  </p>
                  <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${
                    registerAsReceived ? 'text-emerald-600/70 dark:text-emerald-500' : 'text-amber-600/80 dark:text-amber-500'
                  }`}>
                    {registerAsReceived
                      ? 'Estoque atualizado ao salvar'
                      : 'Entrada no estoque via recebimento'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRegisterAsReceived(v => !v)}
                aria-label="Marcar como já entregue"
                className={`relative shrink-0 w-14 h-8 rounded-full border-2 transition-colors duration-200 flex items-center px-1 ${
                  registerAsReceived
                    ? 'bg-emerald-500 border-emerald-400 justify-end'
                    : 'bg-amber-200 dark:bg-amber-900/60 border-amber-300 dark:border-amber-700 justify-start'
                }`}
              >
                <span className="w-6 h-6 bg-white rounded-full shadow-md block transition-all duration-200" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items List (only for Replenishment) */}
      {type === PurchaseType.REPLENISHMENT && (
        <section>
          {/* Prazo e Prioridade — aparece apenas quando o Pedido de Produção (OP) está ativo */}
          {isProductionOrder && (
          <div className="flex flex-col gap-3 p-4 rounded-3xl border border-dashed border-indigo-500/30 dark:border-indigo-500/20 bg-indigo-50/10 dark:bg-indigo-950/10 mb-4">
            <div className="flex items-center justify-between">
              <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-400 px-1 tracking-widest leading-none">Prazo e Prioridade</label>
              {prioridade && (
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full border border-slate-200/50 dark:border-slate-700/50">
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${prioridade === 'URGENTE' ? 'bg-rose-500' : prioridade === 'ALTA' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">SLA: {getDefaultDaysForDeadline(prioridade)} dias</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {priorityOptions.map(p => {
                const isActive = prioridade === p;
                const days = getDefaultDaysForDeadline(p);
                const activeStyles = isActive
                  ? p === 'URGENTE' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20 scale-[1.02] border-rose-500'
                  : p === 'ALTA' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 scale-[1.02] border-amber-500'
                  : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 scale-[1.02] border-emerald-600'
                  : isDarkMode ? 'bg-slate-800/40 text-slate-400 hover:text-slate-200 border-slate-700/50 hover:bg-slate-800/80' : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50';
                return (
                  <button key={p} type="button" onClick={() => handlePriorityChange(p)}
                    className={`flex-1 min-w-[85px] flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all duration-300 ${activeStyles}`}>
                    <span>{p.charAt(0) + p.slice(1).toLowerCase()}</span>
                    <span className="text-[8px] font-bold mt-0.5 opacity-80">{days} {days === 1 ? 'dia' : 'dias'}</span>
                  </button>
                );
              })}
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <CalendarIcon size={13} className="text-indigo-400 shrink-0" />
              <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                title="Data de entrega para produção" aria-label="Data de entrega para produção"
                className={`flex-1 bg-transparent font-black text-xs outline-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`} />
            </div>
          </div>
          )}

          {/* OP Toggle — Ordem de Produção para Estoque */}
          <button
            type="button"
            onClick={() => setIsProductionOrder(v => !v)}
            title={isProductionOrder ? 'Desativar OP de Estoque' : 'Ativar Pedido de Produção para Estoque'}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all mb-4 ${
              isProductionOrder
                ? 'bg-sky-500 border-sky-400 text-white shadow-lg shadow-sky-400/20'
                : isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-sky-700 hover:text-sky-400'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-600'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isProductionOrder ? 'bg-white/20' : isDarkMode ? 'bg-slate-700' : 'bg-white'}`}>
              <Factory size={14} strokeWidth={2.5} className={isProductionOrder ? 'text-white' : 'text-sky-500'} />
            </div>
            <div className="text-left flex-1">
              <p className={`text-[10px] font-black uppercase tracking-widest leading-none ${isProductionOrder ? 'text-white' : ''}`}>Pedido de Produção (OP)</p>
              <p className={`text-[9px] font-bold mt-0.5 leading-none ${isProductionOrder ? 'text-sky-100' : 'text-slate-400'}`}>
                {isProductionOrder ? `${blocks.length} produto(s) selecionado(s)` : 'Gera mapa de produção para o estoque'}
              </p>
            </div>
            <div className={`w-8 h-4 rounded-full relative shrink-0 transition-all ${isProductionOrder ? 'bg-white/30' : isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${isProductionOrder ? 'left-4' : 'left-0.5'}`} />
            </div>
          </button>

          {/* Info card quando OP ativa */}
          {isProductionOrder && (
            <div className={`mb-4 flex items-start gap-3 p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-amber-900/20 border-amber-800/40' : 'bg-amber-50 border-amber-200'}`}>
              <Factory size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1 text-amber-600 dark:text-amber-400">
                  Pedido de Produção — Estoque
                </p>
                <p className="text-[9px] font-bold leading-relaxed text-amber-500">
                  Produção para estoque. Configure o padrão de embalagem e salve — o pedido entra na fila de espera do PCP. Os mapas são criados manualmente lá.
                </p>
              </div>
            </div>
          )}

          {/* Observação Geral da OP — aparece em TODOS os modelos */}
          {isProductionOrder && (
            <div className={`mb-4 rounded-2xl border-2 p-4 flex flex-col gap-2 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-amber-50 border-amber-200'}`}>
              <label className="text-[9px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                <MessageSquare size={11} /> Observação Geral — todos os modelos
              </label>
              <textarea
                className={`w-full rounded-xl border px-3 py-2.5 text-[11px] font-bold resize-none h-14 focus:ring-2 focus:ring-amber-400/20 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-amber-100 text-slate-800'}`}
                value={productionGlobalNote}
                onChange={(e) => setProductionGlobalNote(e.target.value)}
                placeholder="Nota que aparecerá em TODOS os modelos deste pedido…"
                aria-label="Observação geral da OP"
                title="Observação geral"
              />
            </div>
          )}

          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h3 className="text-[12px] font-black uppercase tracking-[0.15em] text-slate-900 dark:text-white leading-none">
                Itens
              </h3>
              <p className="text-[9px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">
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
              // Caixa coletiva/grade só existem em Atacado — Varejo não agrupa pares em
              // caixa, cada par já é uma unidade vendida individualmente.
              const blockIsWholesale = (block.saleType ?? product.type) === SaleType.WHOLESALE;

              const totalItemsInBlock = Object.values(block.variations).reduce<number>((sum, v) => sum + (v as { quantity: number }).quantity, 0);

              return (
                <div
                  key={block.id}
                  className={`rounded-[2.5rem] border shadow-sm flex flex-col relative overflow-hidden ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
                >
                  {/* Header — igual ao de vendas */}
                  <div className="p-5 flex justify-between items-start gap-4">
                    <div className="flex gap-4 flex-1">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700 shrink-0">
                        <Package size={24} className="text-slate-400 dark:text-slate-600" />
                      </div>
                      <div className="flex flex-col justify-center relative flex-1 min-w-0">
                        <h4 className="text-[13px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 truncate pr-4">
                          {product.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">REF: {product.reference || '---'}</p>
                          {totalItemsInBlock > 0 && (
                            <span className="text-[8px] font-black uppercase tracking-widest bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                              {totalItemsInBlock} {totalItemsInBlock === 1 ? 'Item' : 'Itens'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleBlockExpanded(block.id)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-90 transition-all"
                        aria-label="Expandir/Recolher item"
                        title="Ver detalhes"
                      >
                        {isExpanded ? <ChevronUp size={18} strokeWidth={2.5} /> : <ChevronDown size={18} strokeWidth={2.5} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDuplicateTarget({ index }); setDuplicateCount(1); }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 active:scale-90 transition-all"
                        aria-label="Duplicar item"
                        title="Duplicar"
                      >
                        <Copy size={17} strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBlock(index)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 active:scale-90 transition-all"
                        aria-label="Remover item da lista"
                        title="Remover"
                      >
                        <Trash2 size={17} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-3 border-t border-slate-50 dark:border-slate-800 flex flex-col gap-4">

                      {/* Caixa Coletiva — quando OP ativo, só para Atacado */}
                      {isProductionOrder && blockIsWholesale && (() => {
                        const packagingConfigs = productionConfigs.filter(c => c.type === 'PACKAGING');
                        const selectedPkg = block.blockPkgId ? packagingConfigs.find(c => c.id === block.blockPkgId) : null;
                        const capacity = selectedPkg?.metadata?.capacity || 0;
                        return (
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-violet-500 flex items-center gap-1.5">
                              <Layers size={11} /> Caixa Coletiva (Padrão de Embalagem)
                            </label>
                            <button
                              type="button"
                              onClick={() => setPkgPickerBlockIndex(index)}
                              title="Escolher padrão de embalagem"
                              aria-label="Escolher padrão de embalagem"
                              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${selectedPkg ? isDarkMode ? 'bg-violet-900/20 border-violet-700' : 'bg-violet-50 border-violet-300' : isDarkMode ? 'bg-slate-800 border-slate-700 border-dashed' : 'bg-slate-50 border-dashed border-slate-300'}`}>
                              <Package size={16} className={selectedPkg ? 'text-violet-500' : 'text-slate-400'} />
                              <span className={`flex-1 font-black text-[11px] uppercase tracking-widest truncate ${selectedPkg ? 'text-violet-700 dark:text-violet-300' : 'text-slate-400'}`}>
                                {selectedPkg ? `${selectedPkg.name} — ${selectedPkg.metadata?.capacity || 0} pares ${selectedPkg.metadata?.mode === 'FREE' ? '(Grade Livre)' : '(Grade Padrão)'}` : 'Selecione o padrão de embalagem…'}
                              </span>
                              <Info size={14} className={selectedPkg ? 'text-violet-400' : 'text-slate-300'} />
                            </button>
                            {selectedPkg && capacity > 0 && (
                              <p className="text-[9px] text-violet-500 font-black px-1 flex items-center gap-1">
                                <CheckCircle2 size={10} /> 1 grade = 1 caixa de {capacity} pares — aplicado a todas as variações
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Modalidade */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest px-1">Modalidade</label>
                        {isHybridProduct(product) ? (
                          <button
                            type="button"
                            onClick={() => {
                              const newType = block.saleType === SaleType.RETAIL ? SaleType.WHOLESALE : SaleType.RETAIL;
                              updateBlock(index, { saleType: newType, isBox: newType === SaleType.WHOLESALE });
                            }}
                            className={`w-full text-[9px] font-black py-3 rounded-2xl border-2 uppercase tracking-widest transition-all ${block.saleType === SaleType.WHOLESALE ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50'}`}
                            aria-label="Mudar modalidade de reposição"
                            title="Modalidade"
                          >
                            {block.saleType === SaleType.WHOLESALE ? 'Atacado' : 'Varejo'}
                          </button>
                        ) : (
                          <div className="text-[9px] font-black py-3 rounded-2xl border-2 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-800 text-center flex items-center justify-center gap-2">
                            <Box size={12} /> {block.saleType === SaleType.RETAIL ? 'Somente Varejo' : 'Somente Atacado'}
                          </div>
                        )}
                      </div>

                      {/* Custo Grade (Atacado) / Custo Unitário (Varejo — não há grade, cada par é uma unidade) */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] uppercase font-black text-slate-400 tracking-widest px-1">
                          {blockIsWholesale ? 'Custo Grade (R$)' : 'Custo Unitário (R$/par)'}
                        </label>
                        <div className="flex gap-2">
                          <input type="number" step="0.01"
                            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl py-2.5 text-right pr-3 text-[12px] font-black text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
                            value={block.cost} onChange={(e) => updateBlock(index, { cost: parseFloat(e.target.value) || 0 })}
                            aria-label={blockIsWholesale ? 'Custo Grade' : 'Custo Unitário por Par'} title={blockIsWholesale ? 'Custo Grade' : 'Custo Unitário por Par'} />
                          <button type="button" onClick={(e) => { e.preventDefault(); openCalculator(index, 'blocks'); }}
                            className="w-10 flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-xl" title="Calculadora" aria-label="Calculadora">
                            <Calculator size={16} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>

                      {/* Custo Unitário — só em Atacado (preço por par avulso de uma caixa fechada) */}
                      {blockIsWholesale && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[8px] uppercase font-black text-sky-400 tracking-widest px-1">Custo Unitário (R$/par)</label>
                          <input type="number" step="0.01"
                            className="w-full bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl py-2.5 text-right pr-3 text-[12px] font-black text-sky-600 dark:text-sky-400 focus:ring-2 focus:ring-sky-500/10 transition-all"
                            value={block.unitCost || ''}
                            placeholder="0,00"
                            aria-label="Custo por par"
                            title="Custo Unitário por Par"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateBlock(index, { unitCost: parseFloat(e.target.value) || 0 })} />
                        </div>
                      )}

                      {/* Variações */}
                      <div className="flex flex-col gap-3">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Variações Disponíveis</h4>
                        {product.variations.map((v) => {
                          const varState = block.variations[v.id] || { quantity: 0 };
                          const qty = varState.quantity;
                          // Estoque exibido deve casar com o pool escolhido na Modalidade:
                          // Atacado é a contagem de caixas (v.stock['WHOLESALE']); Varejo é a
                          // soma dos pares por tamanho (todas as chaves exceto 'WHOLESALE').
                          const stock = blockIsWholesale
                            ? (v.stock?.['WHOLESALE'] || 0)
                            : Object.entries(v.stock || {}).reduce((s, [k, q]) => k === 'WHOLESALE' ? s : s + (Number(q) || 0), 0);
                          const varPkgKey = `${block.id}-${v.id}`;
                          const varPkg = packagingPerVar[varPkgKey];
                          const varPkgConfig = varPkg?.pkgId ? productionConfigs.find(c => c.id === varPkg.pkgId) : null;
                          const varPkgTotal = varPkg ? Object.values(varPkg.breakdown).reduce((a, b) => a + b, 0) : 0;

                          // Varejo: grade por tamanho — necessária para reabastecer o pool
                          // varejo na chave certa (sem tamanho, a compra cairia em 'WHOLESALE').
                          const grid = !blockIsWholesale ? grids.find(g => g.id === product.defaultGridId) : null;
                          if (grid) {
                            const textColor = getContrastingColor(v.color);
                            return (
                              <div key={v.id} className={`rounded-[1.75rem] border overflow-hidden shadow-lg ${isDarkMode ? 'border-slate-800 shadow-black/30' : 'border-slate-100 shadow-slate-200/60'}`}>
                                <div
                                  className="relative overflow-hidden px-4 py-3 flex items-center gap-3"
                                  style={{ background: `linear-gradient(135deg, ${v.color} 0%, ${v.color}aa 100%)` }}
                                >
                                  <div className="absolute -right-8 -top-8 w-28 h-28 bg-white/15 rounded-full blur-2xl pointer-events-none" />
                                  <div className="absolute -left-6 -bottom-8 w-20 h-20 bg-black/10 rounded-full blur-xl pointer-events-none" />
                                  <div
                                    className="w-8 h-8 rounded-full border-2 shrink-0 shadow-md relative z-10"
                                    style={{ backgroundColor: v.color, borderColor: textColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.2)' }}
                                  />
                                  <p className="text-sm font-black uppercase tracking-wide relative z-10" style={{ color: textColor, textShadow: textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.25)' : 'none' }}>
                                    {v.colorName}
                                  </p>
                                </div>
                                <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                                  {grid.sizes.map(size => {
                                    const sizeKey = `${v.id}-${size}`;
                                    const sizeState = block.variations[sizeKey] || { quantity: 0, size };
                                    const sizeStock = v.stock?.[size] || 0;
                                    return (
                                      <div key={sizeKey} className={`p-3 rounded-2xl border flex flex-col gap-2 ${sizeState.quantity > 0 ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50/50 dark:bg-slate-800/30 border-transparent'}`}>
                                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tight">
                                          <span className="text-slate-700 dark:text-slate-200">TAM. {size}</span>
                                          <span className={sizeStock > 0 ? 'text-emerald-500' : 'text-rose-500'}>{sizeStock} prs</span>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-1">
                                          <button type="button" onClick={() => updateVariation(index, v.id, Math.max(0, (sizeState.quantity || 0) - 1), size)}
                                            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500" title="Diminuir" aria-label="Diminuir"><Minus size={12} strokeWidth={3} /></button>
                                          <input type="number" className="flex-1 w-full bg-transparent border-none p-0 text-center font-black text-[11px] text-slate-800 dark:text-white focus:ring-0"
                                            value={sizeState.quantity || ''} placeholder="0" title="Quantidade" aria-label="Quantidade"
                                            onChange={(e) => updateVariation(index, v.id, parseInt(e.target.value) || 0, size)} />
                                          <button type="button" onClick={() => updateVariation(index, v.id, (sizeState.quantity || 0) + 1, size)}
                                            className="w-6 h-6 rounded-lg flex items-center justify-center text-indigo-500" title="Aumentar" aria-label="Aumentar"><Plus size={12} strokeWidth={3} /></button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={v.id} className={`rounded-2xl border overflow-hidden ${qty > 0 ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50/50 dark:bg-slate-800/30 border-transparent'}`}>
                              <div className="p-4 flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200">{v.colorName}</p>
                                  <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${stock > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    Estoque: {stock} {blockIsWholesale ? 'grades' : 'pares'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-1">
                                  <button type="button" onClick={() => updateVariation(index, v.id, Math.max(0, qty - 1), undefined)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500" title="Diminuir" aria-label="Diminuir"><Minus size={14} /></button>
                                  <input type="number" className="w-8 bg-transparent border-none p-0 text-center font-black text-xs text-slate-800 dark:text-white focus:ring-0"
                                    value={qty} title="Quantidade" aria-label="Quantidade"
                                    onChange={(e) => updateVariation(index, v.id, parseInt(e.target.value) || 0, undefined)} />
                                  <button type="button" onClick={() => updateVariation(index, v.id, qty + 1, undefined)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-indigo-500" title="Aumentar" aria-label="Aumentar"><Plus size={14} /></button>
                                </div>
                              </div>
                              {/* Botões Embalagem / Grade — quando OP ativo */}
                              {isProductionOrder && qty > 0 && (
                                <div className={`px-4 pb-3 border-t ${isDarkMode ? 'border-indigo-800/40' : 'border-indigo-100'} flex flex-col gap-2`}>
                                  <button type="button"
                                    onClick={() => setPackagingModalTarget({ blockId: block.id, variationId: v.id, variationName: v.colorName })}
                                    className={`mt-2 w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${varPkg?.pkgId ? isDarkMode ? 'bg-violet-900/30 border border-violet-700' : 'bg-violet-50 border border-violet-200' : isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-dashed border-slate-300'}`}>
                                    <div className="flex items-center gap-2">
                                      <Layers size={13} className={varPkg?.pkgId ? 'text-violet-500' : 'text-slate-400'} />
                                      <span className={`text-[11px] font-black uppercase tracking-widest ${varPkg?.pkgId ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'}`}>
                                        {varPkgConfig ? varPkgConfig.name : 'Selecionar Embalagem'}
                                      </span>
                                    </div>
                                    {varPkg?.pkgId
                                      ? <span className="text-[11px] font-black text-violet-500">{varPkgTotal} pares/emb · <span className="underline">Editar</span></span>
                                      : <span className="text-[11px] font-black text-slate-400">Toque para configurar ›</span>}
                                  </button>
                                  {!varPkg?.pkgId && (
                                    <button type="button"
                                      onClick={() => setGradeModalTarget({ blockId: block.id, variationId: v.id, variationName: v.colorName, productId: block.productId })}
                                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${gradePerVar[varPkgKey] ? isDarkMode ? 'bg-emerald-900/30 border border-emerald-700' : 'bg-emerald-50 border border-emerald-200' : isDarkMode ? 'bg-slate-800 border border-dashed border-slate-600' : 'bg-white border border-dashed border-slate-200'}`}>
                                      <div className="flex items-center gap-2">
                                        <CheckCircle2 size={13} className={gradePerVar[varPkgKey] ? 'text-emerald-500' : 'text-slate-400'} />
                                        <span className={`text-[11px] font-black uppercase tracking-widest ${gradePerVar[varPkgKey] ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                          {gradePerVar[varPkgKey] ? `Grade: ${Object.values(gradePerVar[varPkgKey]).reduce((a,b)=>a+b,0)} pares` : 'Configurar Grade'}
                                        </span>
                                      </div>
                                      <span className="text-[11px] font-black text-slate-400">
                                        {gradePerVar[varPkgKey] ? <span className="text-emerald-500 underline">Editar</span> : 'Toque para configurar ›'}
                                      </span>
                                    </button>
                                  )}
                                  {/* Nota exclusiva desta variação */}
                                  <div className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-amber-50 border-amber-100'}`}>
                                    <MessageSquare size={10} className="text-amber-500 shrink-0" />
                                    <input
                                      type="text"
                                      className={`flex-1 bg-transparent text-[11px] font-bold outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}
                                      value={block.variations[v.id]?.note || ''}
                                      onChange={(e) => {
                                        const current = block.variations[v.id] || { quantity: 0 };
                                        updateBlock(index, {
                                          variations: {
                                            ...block.variations,
                                            [v.id]: { ...current, note: e.target.value }
                                          }
                                        });
                                      }}
                                      placeholder="Obs. desta variação…"
                                      aria-label={`Observação para ${v.colorName}`}
                                      title={`Observação para ${v.colorName}`}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
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
                        value={(() => {
                          try {
                            return format(check.dueDate, "yyyy-MM-dd");
                          } catch (e) {
                            return format(new Date(), "yyyy-MM-dd");
                          }
                        })()}
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

      {/* Aviso: materiais entram no estoque pela tela de Recebimento de Compras */}
      {generalItems.some(i => i.materialId) && (
        <div className={`p-4 rounded-[2rem] border flex items-center gap-3 mt-2 ${
          isDarkMode ? 'bg-amber-950/20 border-amber-800/60' : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
            <Clock size={18} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-amber-700 dark:text-amber-400">Pendente de Recebimento</p>
            <p className="text-[9px] font-bold text-amber-600/80 dark:text-amber-500 uppercase tracking-widest leading-tight mt-0.5">
              A entrada no estoque (por cor) é feita em "Recebimento de Compras"
            </p>
          </div>
        </div>
      )}

      <CalculatorModal
        isOpen={!!calcModal}
        onClose={() => setCalcModal(null)}
        isDarkMode={isDarkMode}
        initialValue={calcModal?.value || 0}
        onResult={(res) => {
            if (!calcModal) return;
            if (calcModal.field === 'generalItems') updateGeneralItem(calcModal.index, { value: res });
            if (calcModal.field === 'generalItemsQty') updateGeneralItem(calcModal.index, { quantity: res });
            if (calcModal.field === 'blocks') updateBlock(calcModal.index, { cost: res });
        }}
      />

      {/* Cesta de Compras */}
      {type === PurchaseType.REPLENISHMENT && cartItems.length > 0 && (
        <section className={`rounded-[2rem] border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className={`flex items-center justify-between px-5 py-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                <ShoppingBag size={15} className="text-white" />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 leading-none">Cesta de Compras</h3>
                <p className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {cartItems.length} {cartItems.length === 1 ? 'item configurado' : 'itens configurados'}
                </p>
              </div>
            </div>
            {isProductionOrder && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-violet-900/30 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
                <Factory size={11} /> Modo Produção
              </div>
            )}
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {cartItems.map((item, i) => (
              <div key={`${item.blockId}-${item.variationId}-${i}`} className={`px-5 py-3.5 flex gap-3 ${isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/70'} transition-colors`}>
                <div className="w-1.5 self-stretch rounded-full bg-indigo-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-[11px] font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {item.productName}
                        {item.reference && <span className="text-slate-400 font-bold ml-1 text-[9px]">#{item.reference}</span>}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{item.variationName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.quantity}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">grades</p>
                    </div>
                  </div>
                  {item.pkgConfig && (
                    <div className={`mt-2 px-3 py-2 rounded-xl text-[9px] font-black ${isDarkMode ? 'bg-violet-900/20 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
                      📦 {item.pkgConfig.pkgName} — {item.pkgConfig.pairsPerEmb} pares/emb × {item.quantity} = {item.pkgConfig.pairsPerEmb * item.quantity} pares
                    </div>
                  )}
                  <p className={`text-[9px] font-black mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    R$ {item.cost.toFixed(2)}/grade · Total: R$ {(item.cost * item.quantity).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Card TOTAL — fica após a Cesta de Itens */}
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
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`h-12 px-6 rounded-full font-black uppercase tracking-widest text-[11px] flex items-center gap-2 transition-all ${isSaving ? 'bg-slate-400 text-white cursor-wait' : 'bg-white text-slate-900 hover:bg-emerald-400 hover:text-white'}`}
            aria-label="Finalizar compra"
            title="Finalizar"
          >
            <Save size={16} strokeWidth={3} className={isSaving ? 'animate-spin' : ''} /> {isSaving ? 'Salvando...' : 'Finalizar'}
          </button>
        </div>
      </div>

      {/* Modal de duplicação de modelo — escolhe quantas cópias serão criadas */}
      {duplicateTarget !== null && (() => {
        const block = blocks[duplicateTarget.index];
        const product = block ? products.find(p => p.id === block.productId) : undefined;
        return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`rounded-[2rem] p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 mb-1">
                  <Copy size={30} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">Duplicar Modelo</h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed px-2">
                  Quantas cópias de <span className="text-indigo-500">{product?.name || 'este item'}</span> deseja criar? Cada cópia mantém as quantidades, grades e embalagens configuradas.
                </p>

                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-2xl p-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setDuplicateCount(c => Math.max(1, c - 1))}
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 bg-white dark:bg-slate-900 active:scale-90 transition-all"
                    aria-label="Diminuir cópias"
                  >
                    <Minus size={18} strokeWidth={3} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={duplicateCount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDuplicateCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 bg-transparent border-none p-0 text-center text-2xl font-black text-slate-900 dark:text-white focus:ring-0"
                    aria-label="Número de cópias"
                  />
                  <button
                    type="button"
                    onClick={() => setDuplicateCount(c => c + 1)}
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-indigo-500 bg-white dark:bg-slate-900 active:scale-90 transition-all"
                    aria-label="Aumentar cópias"
                  >
                    <Plus size={18} strokeWidth={3} />
                  </button>
                </div>

                <div className="flex gap-2 w-full mt-4">
                  <button
                    type="button"
                    onClick={() => setDuplicateTarget(null)}
                    className="flex-1 py-4 px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      duplicateBlock(duplicateTarget.index, duplicateCount);
                      setDuplicateTarget(null);
                    }}
                    className="flex-1 py-4 px-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                  >
                    Duplicar {duplicateCount > 1 ? `(${duplicateCount}x)` : ''}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PackagingBuilderModal */}
      {packagingModalTarget && (() => {
        const { blockId, variationId, variationName } = packagingModalTarget;
        const block = blocks.find(b => b.id === blockId);
        const product = block ? products.find(p => p.id === block.productId) : undefined;
        const variation = product?.variations.find(v => v.id === variationId);
        const productGrid = product?.defaultGridId ? (grids.find(g => g.id === product.defaultGridId) ?? null) : null;
        const stockPerSize: Record<string, number> = {};
        if (variation?.stock) Object.entries(variation.stock).forEach(([sz, q]) => { stockPerSize[sz] = Number(q) || 0; });
        const existing = packagingPerVar[`${blockId}-${variationId}`];
        return (
          <PackagingBuilderModal isOpen onClose={() => setPackagingModalTarget(null)}
            onConfirm={result => { setPackagingPerVar(prev => ({ ...prev, [`${blockId}-${variationId}`]: { pkgId: result.pkgId, breakdown: result.breakdown, fromStock: result.fromStock } })); setPackagingModalTarget(null); }}
            productName={product?.name || ''} variationName={variationName}
            packagingItems={productionConfigs.filter(c => c.type === 'PACKAGING')} productGrid={productGrid}
            stockPerSize={stockPerSize} stockGrades={variation?.stock?.['WHOLESALE'] || 0}
            orderQuantity={block?.variations[variationId]?.quantity}
            initialPkgId={existing?.pkgId} initialBreakdown={existing?.breakdown} initialFromStock={existing?.fromStock}
            isDarkMode={isDarkMode} />
        );
      })()}

      {/* GradeBuilderModal */}
      {gradeModalTarget && (() => {
        const { blockId, variationId, variationName, productId } = gradeModalTarget;
        const product = products.find(p => p.id === productId);
        const existing = gradePerVar[`${blockId}-${variationId}`];
        return (
          <GradeBuilderModal isOpen onClose={() => setGradeModalTarget(null)}
            onConfirm={breakdown => { setGradePerVar(prev => ({ ...prev, [`${blockId}-${variationId}`]: breakdown })); setGradeModalTarget(null); }}
            productName={product?.name || ''} variationName={variationName}
            grids={grids} defaultGridId={product?.defaultGridId} initialBreakdown={existing} isDarkMode={isDarkMode} />
        );
      })()}

      {/* Popup explicativo — escolha do Padrão de Embalagem (Caixa Coletiva) */}
      {pkgPickerBlockIndex !== null && (() => {
        const block = blocks[pkgPickerBlockIndex];
        if (!block) return null;
        const packagingConfigs = productionConfigs.filter(c => c.type === 'PACKAGING');
        return (
          <Modal isOpen onClose={() => setPkgPickerBlockIndex(null)} title="Padrão de Embalagem" icon={<Package size={20} />} maxWidth="max-w-xl">
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 flex flex-col gap-3">
                <p className="text-[10px] font-bold text-violet-700 dark:text-violet-300 leading-relaxed">
                  A <span className="font-black">Caixa Coletiva</span> define como os pares serão agrupados dentro de cada embalagem da OP — a quantidade escolhida aqui é replicada para todas as variações deste modelo.
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Grade Padrão</span>
                    <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                      Numerações e quantidades por tamanho já vêm <span className="font-black">pré-definidas</span> no cadastro do padrão — ao selecionar, a distribuição é aplicada automaticamente, sem precisar preencher nada.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Grade Livre</span>
                    <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                      Não tem numerações fixas — apenas uma <span className="font-black">capacidade total</span> de pares. A distribuição por tamanho é preenchida manualmente no momento de montar cada caixa.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {packagingConfigs.length === 0 && (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      Nenhum padrão de embalagem cadastrado. Acesse Produção → Configurações → Padrão Embalagens.
                    </p>
                  </div>
                )}
                {packagingConfigs.map(pkg => {
                  const isFree = pkg.metadata?.mode === 'FREE';
                  const capacity = pkg.metadata?.capacity || 0;
                  const sizes: string[] = pkg.metadata?.sizes || [];
                  const sizeQtys: Record<string, number> = pkg.metadata?.sizeQuantities || {};
                  const isSelected = block.blockPkgId === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => { applyBlockPackaging(pkgPickerBlockIndex, pkg.id); setPkgPickerBlockIndex(null); }}
                      className={`text-left p-4 rounded-2xl border-2 transition-all flex flex-col gap-2.5 ${isSelected ? isDarkMode ? 'bg-violet-900/20 border-violet-600' : 'bg-violet-50 border-violet-400' : isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-violet-700' : 'bg-slate-50 border-slate-100 hover:border-violet-200'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Package size={15} className={isSelected ? 'text-violet-500' : 'text-slate-400'} />
                          <span className={`font-black text-[12px] uppercase tracking-tight truncate ${isSelected ? 'text-violet-700 dark:text-violet-300' : isDarkMode ? 'text-white' : 'text-slate-800'}`}>{pkg.name}</span>
                        </div>
                        <span className={`shrink-0 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${isFree ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                          {isFree ? 'Grade Livre' : 'Grade Padrão'}
                        </span>
                      </div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Capacidade: {capacity} pares por caixa</p>
                      {!isFree && sizes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {sizes.map(sz => (
                            <span key={sz} className={`text-[9px] font-black px-2 py-1 rounded-lg ${isDarkMode ? 'bg-slate-900 text-slate-300 border border-slate-700' : 'bg-white text-slate-600 border border-slate-200'}`}>
                              {sz}: {sizeQtys[sz] || 0}
                            </span>
                          ))}
                        </div>
                      )}
                      {isFree && (
                        <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertCircle size={11} /> Numerações preenchidas manualmente, até {capacity} pares
                        </p>
                      )}
                      {isSelected && (
                        <p className="text-[9px] font-black text-violet-500 flex items-center gap-1">
                          <CheckCircle2 size={11} /> Selecionado para este modelo
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </Modal>
        );
      })()}

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
                {(() => {
                  const filtered = activeProducts.filter(p =>
                    !productSearchQuery ||
                    p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                    p.reference?.toLowerCase().includes(productSearchQuery.toLowerCase())
                  );
                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <Package size={32} className="text-slate-200 dark:text-slate-700 mx-auto mb-2" strokeWidth={1} />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-slate-600">
                          {productSearchQuery ? 'Nenhum modelo encontrado' : 'Nenhum produto ativo cadastrado'}
                        </p>
                      </div>
                    );
                  }
                  return filtered.map(p => {
                    const isAdded = !isProductionOrder && blocks.some(b => b.productId === p.id);
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
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

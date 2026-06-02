import { useState, useMemo, useEffect } from 'react';
import { Sale, Product, SaleType, SaleItem, SalePayment, Grid, Person, PaymentMethod, SaleStatus, PaymentTerm, Account, ProductStatus, PaymentStatus, ProductionOrder, ProductionLot, Sector, AppModulesConfig, ProductionConfigItem } from '../types';
import { firebaseService } from '../services/firebaseService';
import ComboBox from '../components/ComboBox';
import { Save, Plus, Trash2, Tag, User, CreditCard, Info, Box, MessageSquare, AlertCircle, Hash, Percent, Receipt, TrendingUp, Wallet, Package, ChevronDown, ChevronUp, Search, X, CheckCircle2, Minus, FileText, Copy, Share, Share2, Calendar, Clock, RotateCcw, Ban, ShoppingCart, Users, Factory, Layers, Warehouse } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sharePDF } from '../utils/pdfExport';
import ScannerModal from '../components/ScannerModal';
import { Camera } from 'lucide-react';
import ProductionOrderModal from '../components/ProductionOrderModal';
import PackagingBuilderModal from '../components/PackagingBuilderModal';
import GradeBuilderModal from '../components/GradeBuilderModal';

interface SaleBlock {
  id: string;
  productId: string;
  saleType: SaleType;
  price: number;      // preço por grade (atacado)
  unitPrice: number;  // preço por par
  variations: Record<string, { quantity: number; price: number; size?: string }>;
  blockPkgId?: string; // padrão de embalagem do bloco (aplica a todas as variações)
}

interface SaleFormViewProps {
  saleId: string | null;
  sales: Sale[];
  products: Product[];
  grids: Grid[];
  people: Person[];
  paymentMethods: PaymentMethod[];
  accounts: Account[];
  productionOrders: ProductionOrder[];
  lots: ProductionLot[];
  sectors: Sector[];
  productionConfigs: ProductionConfigItem[];
  onSave: (sale: Sale) => void;
  onDelete: (id: string) => void;
  onCancelOnly: (id: string) => void;
  onCancel: () => void;
  onCreateProductionOrder: (order: ProductionOrder, lots: ProductionLot[], deductions: { productId: string; variationId: string; size?: string; quantity: number }[]) => Promise<void>;
  modulesConfig: AppModulesConfig;
  isDarkMode: boolean;
}

export default function SaleFormView({ saleId, sales, products, grids, people, paymentMethods, accounts, productionOrders, lots, sectors, productionConfigs, onSave, onDelete, onCancelOnly, onCancel, onCreateProductionOrder, modulesConfig, isDarkMode }: SaleFormViewProps) {
  const hasProduction = modulesConfig.production;
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [prioridade, setPrioridade] = useState<string>('NORMAL');

  // Helper to get default days based on productionConfigs (matching PCP deadlines)
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

  const [orderNumber, setOrderNumber] = useState(Math.floor(Math.random() * 10000).toString().padStart(5, '0'));
  const [isAutoOrderNumber, setIsAutoOrderNumber] = useState(true);
  const [customerId, setCustomerId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [blocks, setBlocks] = useState<SaleBlock[]>([]);
  const [status, setStatus] = useState<SaleStatus>(SaleStatus.SALE);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCancelOnlyConfirm, setShowCancelOnlyConfirm] = useState(false);

  // Remove redundant effect that was resetting status during editing

  useEffect(() => {
    if (saleId && !isInitialized) {
      const sale = sales.find(s => s.id === saleId);
      if (sale) {
        setOrderNumber(sale.orderNumber);
        setIsAutoOrderNumber(false);
        setCustomerId(sale.customerId || '');
        setSellerId(sale.sellerId || '');
        setStatus(sale.status);
        setPaymentTerm(sale.paymentTerm);
        setPaymentMethodId(sale.paymentMethodId || '');
        setAccountId(sale.accountId || '');
        setDiscount(sale.discount || 0);
        setPaymentStatus(sale.paymentStatus || PaymentStatus.PAID);
        setPaymentHistory(sale.paymentHistory || []);
        setNotes(sale.notes || '');
        if (sale.dueDate) {
          setDueDate(new Date(sale.dueDate).toISOString().split('T')[0]);
        }
        if (sale.deliveryDate) {
          setDeliveryDate(new Date(sale.deliveryDate).toISOString().split('T')[0]);
        }
        if (sale.prioridade) {
          setPrioridade(sale.prioridade);
        }
        if (sale.isProductionOrder) {
          setIsProductionOrder(true);
        }
        if (sale.saleDestination) {
          setSaleDestination(sale.saleDestination);
        }
        if (sale.isAccounting === false) {
          setIsAccounting(false);
        }

        // Group items into blocks
        const blocksMap: Record<string, SaleBlock> = {};
        sale.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (!product) return;
          
          const blockId = `${item.productId}-${item.saleType}`;
          if (!blocksMap[blockId]) {
            blocksMap[blockId] = {
              id: Math.random().toString(36).substring(2, 9),
              productId: item.productId,
              saleType: item.saleType,
              price: item.price,
              unitPrice: item.unitPrice ?? (products.find(p => p.id === item.productId)?.unitSalePrice || products.find(p => p.id === item.productId)?.salePrice || 0),
              variations: {}
            };
          }
          
          const variationKey = item.size ? `${item.variationId}-${item.size}` : item.variationId;
          blocksMap[blockId].variations[variationKey] = {
            quantity: item.quantity,
            price: item.price,
            size: item.size
          };
        });
        setBlocks(Object.values(blocksMap));
        setIsInitialized(true);
      }
    } else if (!saleId && !isInitialized) {
      const defaultDays = getDefaultDaysForDeadline('NORMAL');
      const calculatedDate = new Date(Date.now() + defaultDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setDeliveryDate(calculatedDate);
      setIsInitialized(true);
    }
  }, [saleId, sales, products, isInitialized]);

  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm>(PaymentTerm.CASH);
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id || '');
  const [accountId, setAccountId] = useState(() => {
    const existing = saleId ? sales.find(s => s.id === saleId) : null;
    if (existing?.accountId) return existing.accountId;
    const defaultAcc = accounts.find(a => a.isDefault);
    return defaultAcc?.id || accounts?.[0]?.id || '';
  });
  const [discount, setDiscount] = useState(0);
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.PAID);
  const [paymentHistory, setPaymentHistory] = useState<SalePayment[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<number>(0);
  const [partialPaymentMethodId, setPartialPaymentMethodId] = useState('');
  const [partialPaymentAccountId, setPartialPaymentAccountId] = useState('');
  const [partialPaymentNote, setPartialPaymentNote] = useState('');
  const [expandedBlocks, setExpandedBlocks] = useState<string[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [isMessageManual, setIsMessageManual] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showProductionOrderModal, setShowProductionOrderModal] = useState(false);
  const [isProductionOrder, setIsProductionOrder] = useState(false);
  const [saleDestination, setSaleDestination] = useState<'CUSTOMER' | 'STOCK'>('CUSTOMER');
  const [isAccounting, setIsAccounting] = useState(true);
  // key = `${blockId}-${variationId}` → packaging config per variation
  const [packagingPerVar, setPackagingPerVar] = useState<Record<string, {
    pkgId: string;
    breakdown: Record<string, number>;
    fromStock: Record<string, number>;
  }>>({});
  const [packagingModalTarget, setPackagingModalTarget] = useState<{
    blockId: string; variationId: string; variationName: string;
  } | null>(null);
  // key = `${blockId}-${variationId}` → grade (size breakdown) per variation (when no packaging)
  const [gradePerVar, setGradePerVar] = useState<Record<string, Record<string, number>>>({});
  const [gradeModalTarget, setGradeModalTarget] = useState<{
    blockId: string; variationId: string; variationName: string; productId: string;
  } | null>(null);

  // Cesta de pedidos — itens computados para exibição/conferência
  const cartItems = useMemo(() => {
    const items: {
      blockId: string;
      blockIndex: number;
      productId: string;
      productName: string;
      reference: string;
      variationId: string;
      variationName: string;
      quantity: number;
      price: number;
      unitPrice?: number;
      saleType: SaleType;
      size?: string;
      pkgConfig?: {
        pkgId: string;
        pkgName: string;
        breakdown: Record<string, number>;
        fromStock: Record<string, number>;
        pairsPerEmb: number;
        fromStockTotal: number;
        grandTotal: number;
      };
    }[] = [];

    blocks.forEach((block, blockIndex) => {
      const product = products.find(p => p.id === block.productId);
      Object.entries(block.variations).forEach(([variationKey, varData]) => {
        if (varData.quantity <= 0) return;
        const variationId = variationKey.split('-')[0];
        const variation = product?.variations.find(v => v.id === variationId);
        const varPkgKey = `${block.id}-${variationId}`;
        const pkg = packagingPerVar[varPkgKey];
        const pkgConfig = pkg?.pkgId ? productionConfigs.find(c => c.id === pkg.pkgId) : undefined;
        const pairsPerEmb = pkg ? Object.values(pkg.breakdown).reduce((a, b) => a + b, 0) : 0;
        const fromStockTotal = pkg ? Object.values(pkg.fromStock || {}).reduce((a, b) => a + b, 0) : 0;

        items.push({
          blockId: block.id,
          blockIndex,
          productId: block.productId,
          productName: product?.name || '',
          reference: product?.reference || '',
          variationId,
          variationName: variation?.colorName || '',
          quantity: varData.quantity,
          price: varData.price,
          unitPrice: block.unitPrice,
          saleType: block.saleType,
          size: varData.size,
          ...(pkg?.pkgId ? {
            pkgConfig: {
              pkgId: pkg.pkgId,
              pkgName: pkgConfig?.name || '',
              breakdown: pkg.breakdown,
              fromStock: pkg.fromStock || {},
              pairsPerEmb,
              fromStockTotal,
              grandTotal: pairsPerEmb * varData.quantity
            }
          } : {})
        });
      });
    });
    return items;
  }, [blocks, products, packagingPerVar, productionConfigs]);

  const subtotal = useMemo(() => {
    return blocks.reduce((acc, block) => {
      const blockTotal = Object.values(block.variations).reduce<number>((sum, v) => {
        const item = v as { quantity: number; price: number };
        return sum + (item.price * item.quantity);
      }, 0);
      return acc + blockTotal;
    }, 0);
  }, [blocks]);

  const total = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);

  const amountPaid = useMemo(() => {
    return paymentHistory.reduce((acc, p) => acc + p.amount, 0);
  }, [paymentHistory]);

  const remainingBalance = useMemo(() => Math.max(0, total - amountPaid), [total, amountPaid]);
  const surplusCredit = useMemo(() => Math.max(0, amountPaid - total), [total, amountPaid]);

  const addPartialPayment = () => {
    if (partialPaymentAmount <= 0) return;
    
    const newPayment: SalePayment = {
      id: Math.random().toString(36).substring(2, 9),
      amount: partialPaymentAmount,
      date: Date.now(),
      paymentMethodId: partialPaymentMethodId || paymentMethodId || paymentMethods[0]?.id || '',
      accountId: partialPaymentAccountId || accountId || accounts?.[0]?.id || '',
      note: partialPaymentNote
    };

    const newHistory = [...paymentHistory, newPayment];
    setPaymentHistory(newHistory);
    setPartialPaymentAmount(0);
    setPartialPaymentNote('');
    setShowPaymentModal(false);

    // If fully paid or more, update status
    const totalPaid = newHistory.reduce((acc, p) => acc + p.amount, 0);
    if (totalPaid >= total) {
      setPaymentStatus(PaymentStatus.PAID);
    }
  };

  const activeProducts = useMemo(() => products.filter(p => !p.status || p.status === ProductStatus.ACTIVE), [products]);

  useEffect(() => {
    if (status === SaleStatus.QUOTE) {
      setPaymentStatus(PaymentStatus.PENDING);
    } else {
      if (paymentTerm === PaymentTerm.CASH) {
        setPaymentStatus(PaymentStatus.PAID);
      } else {
        setPaymentStatus(PaymentStatus.PENDING);
      }
    }
  }, [status, paymentTerm]);

  useEffect(() => {
    if (!isMessageManual && showWhatsAppModal) {
      setWhatsappMessage(generateDefaultMessage());
    }
  }, [blocks, discount, total, customerId, paymentMethodId, isMessageManual, showWhatsAppModal]);

  // Auto-populate seller when customer changes
  useEffect(() => {
    if (customerId && !sellerId) {
      const customer = people.find(p => p.id === customerId);
      if (customer?.associatedSellerIds && customer.associatedSellerIds.length > 0) {
        // Find the first valid seller from the associated IDs
        const firstSeller = people.find(p => p.id === (customer.associatedSellerIds?.[0]) && p.isSeller);
        if (firstSeller) {
          setSellerId(firstSeller.id);
        }
      }
    }
  }, [customerId, people, sellerId]);

  const addBlock = (productId: string) => {
    const p = products.find(prod => prod.id === productId);
    if (!p) return;

    const newBlockId = Math.random().toString(36).substring(2, 9);
    const newBlock: SaleBlock = {
      id: newBlockId,
      productId: p.id,
      saleType: p.type || SaleType.RETAIL,
      price: p.salePrice || 0,
      unitPrice: p.unitSalePrice || p.salePrice || 0,
      variations: {},
    };
    setBlocks([...blocks, newBlock]);
    setExpandedBlocks([...expandedBlocks, newBlockId]);
    setShowProductModal(false);
    setProductSearchQuery("");
  };

  const updateBlock = (index: number, updates: Partial<SaleBlock>) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates };
    setBlocks(newBlocks);
  };

  const removeBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  const toggleBlockExpanded = (blockId: string) => {
    setExpandedBlocks(prev => 
      prev.includes(blockId) ? prev.filter(id => id !== blockId) : [...prev, blockId]
    );
  };

  const updateVariation = (blockIndex: number, variationId: string, quantity: number, price: number, size?: string) => {
    const newBlocks = [...blocks];
    const block = newBlocks[blockIndex];
    block.variations = {
      ...block.variations,
      [variationId + (size ? `-${size}` : '')]: { quantity: Math.max(0, quantity), price, size }
    };
    // Remove if quantity is 0 to keep it clean, or keep it? PurchaseForm keeps it usually until save
    // but let's keep it for visual persistence during session.
    setBlocks(newBlocks);
  };

  const handleScanResult = (result: any) => {
    if (result.type === 'PRODUCT') {
      const { productId, variationId, size } = result;
      const product = products.find(p => p.id === productId);
      if (!product) {
        alert('Produto não encontrado.');
        return;
      }

      // Check if block already exists for this product
      let blockIndex = blocks.findIndex(b => b.productId === productId);
      let newBlocks = [...blocks];
      let targetBlockId;

      if (blockIndex === -1) {
        // Add new block
        const newBlockId = Math.random().toString(36).substring(2, 9);
        const newBlock: SaleBlock = {
          id: newBlockId,
          productId,
          saleType: product.type || SaleType.RETAIL,
          price: product.salePrice || 0,
          unitPrice: product.unitSalePrice || product.salePrice || 0,
          variations: {},
        };
        newBlocks.push(newBlock);
        blockIndex = newBlocks.length - 1;
        targetBlockId = newBlockId;
      } else {
        targetBlockId = newBlocks[blockIndex].id;
      }

      // Update variation
      const variationKey = size ? `${variationId}-${size}` : variationId;
      const currentVar = newBlocks[blockIndex].variations[variationKey] || { 
        quantity: 0, 
        price: newBlocks[blockIndex].price, 
        size 
      };
      
      newBlocks[blockIndex].variations[variationKey] = {
        ...currentVar,
        quantity: (currentVar.quantity || 0) + 1
      };

      setBlocks(newBlocks);
      if (!expandedBlocks.includes(targetBlockId)) {
        setExpandedBlocks(prev => [...prev, targetBlockId]);
      }
    }
  };

  const checkStock = (productId: string, variationId: string, size?: string, quantity: number = 0): boolean => {
    const product = products.find(p => p.id === productId);
    const variation = product?.variations.find(v => v.id === variationId);
    if (!variation) return false;
    
    const stockKey = product?.type === SaleType.RETAIL && size ? size : 'WHOLESALE';
    let currentStock = variation.stock[stockKey] || 0;
    
    // Add back the stock that is ALREADY part of this sale if we are editing
    const existingSale = saleId ? sales.find(s => s.id === saleId) : null;
    if (existingSale && existingSale.status === SaleStatus.SALE) {
      const existingItem = existingSale.items.find(i => i.productId === productId && i.variationId === variationId && i.size === size);
      if (existingItem) {
        currentStock += existingItem.quantity;
      }
    }
    
    // Fallback to sum of sizes if WHOLESALE is explicitly 0 but sizes have values (unlikely but possible)
    if (stockKey === 'WHOLESALE' && currentStock === 0) {
      let totalSum = Object.values(variation.stock).reduce((a, b) => a + (Number(b) || 0), 0);
      if (existingSale && existingSale.status === SaleStatus.SALE) {
         const existingItemsTotal = existingSale.items.filter(i => i.productId === productId && i.variationId === variationId).reduce((acc, i) => acc + i.quantity, 0);
         totalSum += existingItemsTotal;
      }
      return totalSum >= quantity;
    }

    return currentStock >= quantity;
  };

  // Aplica padrão de embalagem a TODAS as variações do bloco de uma vez
  const applyBlockPackaging = (blockIndex: number, pkgId: string) => {
    const block = blocks[blockIndex];
    const product = products.find(p => p.id === block.productId);
    if (!product) return;

    updateBlock(blockIndex, { blockPkgId: pkgId || undefined });

    if (!pkgId) {
      // Remove packaging para todas as variações
      setPackagingPerVar(prev => {
        const next = { ...prev };
        product.variations.forEach(v => { delete next[`${block.id}-${v.id}`]; });
        return next;
      });
      return;
    }

    const pkg = productionConfigs.find(c => c.id === pkgId && c.type === 'PACKAGING');
    if (!pkg) return;

    // Monta breakdown a partir do sizeQuantities do padrão
    const sizeQtys: Record<string, number> = pkg.metadata?.sizeQuantities || {};
    const pkgSizes: string[] = pkg.metadata?.sizes?.length ? pkg.metadata.sizes as string[] : Object.keys(sizeQtys);
    const breakdown: Record<string, number> = {};
    pkgSizes.forEach(s => { breakdown[s] = sizeQtys[s] || 0; });

    // Aplica a todas as variações do bloco
    setPackagingPerVar(prev => {
      const next = { ...prev };
      product.variations.forEach(v => {
        next[`${block.id}-${v.id}`] = { pkgId, breakdown, fromStock: {} };
      });
      return next;
    });
  };

  const handleSave = async () => {
    const items = getItems();

    if (items.length === 0) {
      alert('Adicione pelo menos um item.');
      return;
    }

    // Optional stock warning
    const stockIssues = items.filter(item => !checkStock(item.productId, item.variationId, item.size, item.quantity));
    if (stockIssues.length > 0 && status === SaleStatus.SALE) {
      if (!confirm('Alguns itens estão com estoque insuficiente. Deseja continuar?')) return;
    }
    
    const customer = people.find(p => p.id === customerId);
    const seller = people.find(p => p.id === sellerId);
    const existingSale = saleId ? sales.find(s => s.id === saleId) : null;

    const saleToSave: Sale = {
      id: saleId || Math.random().toString(36).substring(2, 9),
      orderNumber,
      date: existingSale ? existingSale.date : Date.now(),
      customerName: customer?.name || 'Venda Avulsa',
      sellerName: seller?.name || sellerId || '',
      sellerId: sellerId || '',
      items,
      subtotal,
      discount,
      total,
      status,
      paymentTerm,
      paymentStatus,
      paymentHistory,
      notes
    };

    if (prioridade) {
      saleToSave.prioridade = prioridade;
    }
    if (customerId) saleToSave.customerId = customerId;
    if (paymentMethodId) saleToSave.paymentMethodId = paymentMethodId;
    if (accountId) saleToSave.accountId = accountId;
    if (paymentTerm === PaymentTerm.INSTALLMENTS && dueDate) {
      saleToSave.dueDate = new Date(dueDate).getTime();
    }
    if (deliveryDate) {
      saleToSave.deliveryDate = new Date(deliveryDate).getTime();
    }
    if (isProductionOrder) {
      saleToSave.isProductionOrder = true;
    }
    if (saleDestination === 'STOCK') {
      saleToSave.saleDestination = 'STOCK';
      saleToSave.customerName = saleToSave.customerName || 'Estoque';
    }
    if (!isAccounting) {
      saleToSave.isAccounting = false;
    }

    try {
      setIsSaving(true);

      // Cria o Pedido de Produção na fila de espera do PCP (sem criar mapas — feito manualmente lá)
      if (isProductionOrder && status === SaleStatus.SALE) {
        const orderId = Math.random().toString(36).substring(2, 9);
        const orderNum = `OP #${String(productionOrders.length + 1).padStart(3, '0')}`;
        const orderItems: import('../types').ProductionOrderItem[] = [];

        blocks.forEach(block => {
          const product = products.find(p => p.id === block.productId);

          Object.entries(block.variations).forEach(([variationKey, varData]) => {
            if (varData.quantity <= 0) return;
            const variationId = variationKey.split('-')[0];
            const variation = product?.variations.find(v => v.id === variationId);
            const varKey = `${block.id}-${variationId}`;
            const pkg = packagingPerVar[varKey];
            const breakdown: Record<string, number> = pkg?.pkgId
              ? pkg.breakdown
              : (gradePerVar[varKey] || {});
            const pairsPerGrade = Object.values(breakdown).reduce((a, b) => a + b, 0);
            if (pairsPerGrade === 0) return;

            const totalPairsPerSize: Record<string, number> = {};
            let totalPairs = 0;
            Object.entries(breakdown).forEach(([size, ppg]) => {
              if (ppg > 0) {
                totalPairsPerSize[size] = ppg * varData.quantity;
                totalPairs += ppg * varData.quantity;
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
            orderItems.push({
              productId: block.productId,
              productName: product?.name || '',
              variationId,
              variationName: variation?.colorName || '',
              saleType: block.saleType,
              sizes: sizesResult,
              totalQuantity: totalPairs,
              fromStockQty: fromStockTotal,
              toProductionQty: totalPairs - fromStockTotal
            });
          });
        });

        if (orderItems.length > 0) {
          const order: ProductionOrder = {
            id: orderId,
            orderNumber: orderNum,
            saleId: saleToSave.id,
            saleOrderNumber: saleToSave.orderNumber,
            customerId: saleToSave.customerId,
            customerName: saleToSave.customerName || 'Avulso',
            orderDate: saleToSave.date,
            deliveryDate: saleToSave.deliveryDate || Date.now(),
            items: orderItems,
            status: 'PENDING',
            lotIds: [], // mapas criados manualmente no PCP
            createdAt: Date.now()
          };
          saleToSave.productionOrderId = orderId;
          await onSave(saleToSave);
          await onCreateProductionOrder(order, [], []); // sem lotes — fila de espera
        } else {
          await onSave(saleToSave);
        }
      } else {
        await onSave(saleToSave);
      }

      setShowSuccessModal(true);
    } catch (error) {
      console.error("error saving sale", error);
      alert("Erro ao salvar a venda. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const getItems = (): SaleItem[] => {
    const items: SaleItem[] = [];
    blocks.forEach(block => {
      Object.entries(block.variations).forEach(([key, value]) => {
        const data = value as { quantity: number; price: number; size?: string };
        if (data.quantity > 0) {
          const variationId = key.split('-')[0];
          items.push({
            productId: block.productId,
            variationId,
            size: data.size,
            saleType: block.saleType,
            quantity: data.quantity,
            price: data.price,
            ...(block.unitPrice ? { unitPrice: block.unitPrice } : {})
          });
        }
      });
    });
    return items;
  };

  const generateDefaultMessage = () => {
    const customer = people.find(p => p.id === customerId);
    const items = getItems();
    
    const itemsText = items.map(item => {
      const p = products.find(prod => prod.id === item.productId);
      const v = p?.variations.find(varItem => varItem.id === item.variationId);
      const variantDesc = v?.colorName ? ` (${v.colorName})` : '';
      const sizeDesc = item.size ? ` (TAM ${item.size})` : '';
      const typeDesc = item.saleType === SaleType.RETAIL ? 'pares' : 'grades';
      
      return `📦 *${p?.name}${variantDesc}*${sizeDesc}\n   Qtd: ${item.quantity} ${typeDesc}\n   Un: R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n   Sub: R$ ${(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }).join('\n\n');

    const paymentMethod = paymentMethods.find(pm => pm.id === paymentMethodId);
    const paymentInfo = paymentMethod?.value ? `\n\n💳 *Pagamento: ${paymentMethod.name}*\nchave pix: ${paymentMethod.value}` : `\n\n💳 *Pagamento: ${paymentMethod?.name || 'A definir'}*`;

    const statusText = status === SaleStatus.QUOTE ? 'ORÇAMENTO' : 'PEDIDO';
    const discountText = discount > 0 ? `\n📉 *Desconto:* R$ ${discount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';

    return `Olá ${customer?.name || 'Cliente'}!\n\nSeu ${statusText} #${orderNumber}.\n\n*ITENS:*\n${itemsText}\n\n------------------\n💰 *Subtotal:* R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${discountText}\n💎 *TOTAL: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*\n------------------\nStatus: ${statusText}${paymentInfo}\n\nAguardamos sua confirmação!`;
  };

  const handleWhatsApp = () => {
    const customer = people.find(p => p.id === customerId);
    if (!customer?.phone) {
      alert('Selecione um cliente com telefone cadastrado.');
      return;
    }

    const items = getItems();
    if (items.length === 0) {
      alert('Adicione pelo menos um item.');
      return;
    }

    if (!isMessageManual) {
      setWhatsappMessage(generateDefaultMessage());
    }
    setShowWhatsAppModal(true);
  };

  const sendWhatsApp = () => {
    const customer = people.find(p => p.id === customerId);
    if (!customer?.phone) return;
    
    const encodedMessage = encodeURIComponent(whatsappMessage);
    window.open(`https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodedMessage}`, '_blank');
    setShowWhatsAppModal(false);
  };

  const handleExportPDF = () => {
    const customer = people.find(p => p.id === customerId);
    const items = getItems();
    
    if (items.length === 0) {
      alert('Adicione pelo menos um item.');
      return;
    }

    const doc = new jsPDF();
    const statusText = status === SaleStatus.QUOTE ? 'ORÇAMENTO' : 'PEDIDO';
    
    // Header Decor
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('CALÇADOS', 20, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`REGISTRO DE ${statusText}`, 20, 32);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(`#${orderNumber}`, 190, 28, { align: 'right' });
    
    // Customer Section
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO DOCUMENTO', 20, 60);
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 62, 190, 62);
    
    doc.setFontSize(11);
    doc.text(customer?.name || 'CONSUMIDOR - VENDA AVULSA', 20, 72);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Tel: ${customer?.phone || '---'}`, 20, 78);
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 190, 72, { align: 'right' });
    
    // Table
    const tableData = items.map(item => {
      const p = products.find(prod => prod.id === item.productId);
      const v = p?.variations.find(varItem => varItem.id === item.variationId);
      const variantDesc = v?.colorName ? ` (${v.colorName})` : '';
      const sizeDesc = item.size ? ` / TAM ${item.size}` : '';
      
      return [
        { content: `${p?.name}${variantDesc}${sizeDesc}`, styles: { fontStyle: 'bold' } },
        item.quantity,
        `R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `R$ ${(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ];
    });

    autoTable(doc, {
      startY: 90,
      head: [['PRODUTO / COMPOSIÇÃO', 'QTD', 'VALOR UN.', 'VALOR TOTAL']],
      body: tableData as any,
      theme: 'grid',
      headStyles: { 
        fillColor: [15, 23, 42], 
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { 
        fontSize: 9, 
        cellPadding: 5,
        lineColor: [241, 245, 249]
      },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      }
    });

    // Summary
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    // Payment Card
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(20, finalY, 80, 40, 3, 3, 'F');
    
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('FORMA DE PAGAMENTO SELECIONADA', 25, finalY + 10);
    
    const paymentMethod = paymentMethods.find(pm => pm.id === paymentMethodId);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(paymentMethod?.name || 'A DEFINIR', 25, finalY + 20);
    
    if (paymentMethod?.value) {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(paymentMethod.value, 25, finalY + 30, { maxWidth: 70 });
    }

    // Totals Sidebar
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text('Subtotal Bruto:', 150, finalY + 10, { align: 'right' });
    doc.text('Desconto Aplicado:', 150, finalY + 18, { align: 'right' });
    
    doc.setTextColor(15, 23, 42);
    doc.text(`R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, finalY + 10, { align: 'right' });
    doc.setTextColor(225, 29, 72);
    doc.text(`- R$ ${discount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, finalY + 18, { align: 'right' });
    
    doc.setFillColor(15, 23, 42);
    doc.rect(130, finalY + 25, 60, 12, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('VALOR FINAL', 135, finalY + 33);
    doc.text(`R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 185, finalY + 33, { align: 'right' });

    // Legal
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text('Documento gerado para fins informativos e conferência.', 105, 285, { align: 'center' });

    sharePDF(doc, `${statusText}_#${orderNumber}_${customer?.name || 'Venda'}.pdf`);
  };

  return (
    <div className={`flex flex-col gap-6 pb-40 px-1 ${status === SaleStatus.CANCELLED ? 'grayscale-[0.8] opacity-80 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl ${
            status === SaleStatus.CANCELLED 
              ? 'bg-slate-700 shadow-none' 
              : status === SaleStatus.QUOTE
                ? 'bg-orange-500 shadow-orange-200'
                : 'bg-[#7c3aed] shadow-violet-200'
          }`}>
            <Receipt size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className={`text-lg font-black uppercase tracking-tight leading-none ${status === SaleStatus.CANCELLED ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
              {status === SaleStatus.CANCELLED 
                ? 'Venda Cancelada' 
                : saleId 
                  ? `Editando ${status === SaleStatus.QUOTE ? 'Orçamento' : 'Venda'}`
                  : `Novo ${status === SaleStatus.QUOTE ? 'Orçamento' : 'Venda'}`}
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input 
                    type="checkbox"
                    className="sr-only"
                    checked={isAutoOrderNumber}
                    aria-label="Gerar número de pedido automático"
                    onChange={() => {
                      const newAuto = !isAutoOrderNumber;
                      setIsAutoOrderNumber(newAuto);
                      if (newAuto) {
                        setOrderNumber(Math.floor(Math.random() * 10000).toString().padStart(5, '0'));
                      } else {
                        setOrderNumber('');
                      }
                    }}
                  />
                  <div className={`w-8 h-4 rounded-full transition-colors ${isAutoOrderNumber ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow-sm ${isAutoOrderNumber ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${isAutoOrderNumber ? 'text-indigo-500' : 'text-slate-400'}`}>
                  Auto
                </span>
              </label>

              <div className="flex items-center gap-1.5">
                <input 
                  type="text"
                  className={`text-[10px] bg-transparent border-b border-transparent focus:border-indigo-500 outline-none font-bold uppercase tracking-widest min-w-0 w-16 ${isAutoOrderNumber ? 'text-slate-400' : 'text-indigo-500'}`}
                  value={orderNumber}
                  aria-label="Número do pedido"
                  title="Número do Pedido"
                  placeholder="00000"
                  onChange={(e) => {
                    setOrderNumber(e.target.value);
                    setIsAutoOrderNumber(false);
                  }}
                  disabled={isAutoOrderNumber}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className={`p-1 rounded-2xl border flex gap-1 shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
           <button 
             onClick={() => setStatus(SaleStatus.SALE)}
             className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${status === SaleStatus.SALE ? 'bg-[#7c3aed] text-white shadow-lg' : 'text-slate-400'}`}
             aria-label="Definir como venda"
             title="Venda"
           >
             Venda
           </button>
           <button 
             onClick={() => setStatus(SaleStatus.QUOTE)}
             className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${status === SaleStatus.QUOTE ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400'}`}
             aria-label="Definir como orçamento"
             title="Orçamento"
           >
             Orc.
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Info */}
        <div className={`p-6 rounded-[2rem] border shadow-sm flex flex-col gap-5 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>

          {/* Toggle Destino: Cliente / Estoque */}
          <div>
            <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-1 mb-2 block tracking-widest leading-none">Destino da Venda</label>
            <div className={`p-1 rounded-2xl border flex gap-1 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setSaleDestination('CUSTOMER')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  saleDestination === 'CUSTOMER'
                    ? isDarkMode ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-400'
                }`}
                aria-label="Venda para cliente"
                title="Venda Cliente"
              >
                <User size={13} />
                Cliente
              </button>
              <button
                type="button"
                onClick={() => setSaleDestination('STOCK')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  saleDestination === 'STOCK'
                    ? isDarkMode ? 'bg-amber-600 text-white shadow-lg' : 'bg-amber-500 text-white shadow-lg'
                    : 'text-slate-400'
                }`}
                aria-label="Produção para estoque"
                title="Estoque"
              >
                <Box size={13} />
                Estoque
              </button>
            </div>
          </div>

          {/* Toggle Não Contábil (visível apenas no destino STOCK) */}
          {saleDestination === 'STOCK' && (
            <button
              type="button"
              onClick={() => setIsAccounting(prev => !prev)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
                !isAccounting
                  ? isDarkMode ? 'bg-rose-900/20 border-rose-700/50' : 'bg-rose-50 border-rose-200'
                  : isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}
              aria-label="Alternar não contábil"
              title="Não Contábil"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${!isAccounting ? 'bg-rose-500' : isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
                  <Ban size={16} className={!isAccounting ? 'text-white' : 'text-slate-400'} />
                </div>
                <div className="text-left">
                  <p className={`text-[11px] font-black uppercase tracking-widest leading-none ${!isAccounting ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                    Não Contábil
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                    {!isAccounting ? 'Sem lançamento financeiro' : 'Gera lançamento financeiro'}
                  </p>
                </div>
              </div>
              {/* Toggle visual */}
              <div className={`w-11 h-6 rounded-full transition-colors relative ${!isAccounting ? 'bg-rose-500' : isDarkMode ? 'bg-slate-600' : 'bg-slate-300'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${!isAccounting ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          )}

          {/* Campo de cliente (visível apenas no destino CUSTOMER) */}
          {saleDestination === 'CUSTOMER' && (
          <div className="relative">
            <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest leading-none">Cliente</label>
            <ComboBox
              options={people.filter(p => p.isCustomer).map(p => ({ id: p.id, name: p.name }))}
              value={customerId}
              onChange={setCustomerId}
              placeholder="SELECIONE O CLIENTE"
              isDarkMode={isDarkMode}
            />
          </div>
          )}

          <div className="relative">
            <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest leading-none">Vendedor / Responsável</label>
            <ComboBox 
              options={[
                ...people.filter(p => p.isSeller).map(p => ({ id: p.id, name: p.name })),
                ...(people.find(p => p.id === customerId)?.internalContacts?.map(c => ({ id: c.name, name: c.name })) || [])
              ]}
              value={sellerId}
              onChange={setSellerId}
              placeholder="SELECIONE O VENDEDOR"
              isDarkMode={isDarkMode}
              icon={<Users size={18} />}
            />

            {/* Badges de Sugestão do Cliente */}
            {customerId && saleDestination === 'CUSTOMER' && (
              <div className="mt-3 flex flex-wrap gap-2 px-1">
                {(() => {
                  const c = people.find(p => p.id === customerId);
                  if (!c) return null;
                  
                  const linkedSellers = people.filter(p => 
                    (c.associatedSellerIds?.includes(p.id))
                  );

                  return (
                    <>
                      {linkedSellers.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSellerId(s.id)}
                          className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all active:scale-95 ${sellerId === s.id ? 'bg-[#7c3aed] border-[#7c3aed] text-white shadow-lg' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600')}`}
                        >
                          <Users size={12} />
                          <span className="text-[10px] font-black uppercase tracking-tight">{s.name}</span>
                        </button>
                      ))}
                      {c.internalContacts?.map((ic, idx) => (
                        <button
                          key={`int-${idx}`}
                          type="button"
                          onClick={() => setSellerId(ic.name)}
                          className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all active:scale-95 ${sellerId === ic.name ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600')}`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-[10px] font-black uppercase tracking-tight">{ic.name}</span>
                        </button>
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* SLA Timeline and Prioridade Section */}
          <div className="flex flex-col gap-3 p-4 rounded-3xl border border-dashed border-indigo-500/30 dark:border-indigo-500/20 bg-indigo-50/10 dark:bg-indigo-950/10">
            <div className="flex items-center justify-between">
              <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-1 tracking-widest leading-none">Prazo e Prioridade</label>
              
              {/* Active SLA Badge Info */}
              {prioridade && (
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full border border-slate-200/50 dark:border-slate-700/50">
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                    prioridade === 'URGENTE' ? 'bg-rose-500' : prioridade === 'ALTA' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">
                    SLA: {getDefaultDaysForDeadline(prioridade)} dias
                  </span>
                </div>
              )}
            </div>

            {/* Quick SLA Selector Buttons */}
            <div className="flex flex-wrap gap-2">
              {priorityOptions.map(p => {
                const label = p.charAt(0) + p.slice(1).toLowerCase();
                const days = getDefaultDaysForDeadline(p);
                const isActive = prioridade === p;
                
                let activeStyles = '';
                
                if (isActive) {
                  if (p === 'URGENTE') {
                    activeStyles = 'bg-rose-500 text-white shadow-lg shadow-rose-500/20 scale-[1.02] border-rose-500';
                  } else if (p === 'ALTA') {
                    activeStyles = 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 scale-[1.02] border-amber-500';
                  } else {
                    activeStyles = 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 scale-[1.02] border-emerald-600';
                  }
                } else {
                  activeStyles = isDarkMode 
                    ? 'bg-slate-800/40 text-slate-400 hover:text-slate-200 border-slate-700/50 hover:bg-slate-800/80' 
                    : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50';
                }

                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePriorityChange(p)}
                    className={`flex-1 min-w-[85px] flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all duration-300 relative ${activeStyles}`}
                  >
                    <span>{label}</span>
                    <span className={`text-[8px] font-bold mt-0.5 opacity-80`}>
                      {days} {days === 1 ? 'dia' : 'dias'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Manual Date Selection & Production Toggle */}
            <div className="flex gap-2 mt-1">
              <div className="flex flex-col gap-1 flex-1">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
                  isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                }`}>
                  <Calendar size={13} className="text-indigo-400 shrink-0" />
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={e => {
                      setDeliveryDate(e.target.value);
                    }}
                    title="Data de entrega combinada"
                    aria-label="Data de entrega"
                    className={`flex-1 bg-transparent font-black text-xs outline-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}
                  />
                </div>
              </div>

              {hasProduction && (
                <div className="relative">
                  {!isProductionOrder && (
                    <span className="absolute inset-0 rounded-xl bg-sky-400 animate-ping opacity-25 pointer-events-none" />
                  )}
                  <button
                    type="button"
                    onClick={() => setIsProductionOrder(v => !v)}
                    title={isProductionOrder ? 'Desativar pedido de produção' : 'Ativar pedido de produção'}
                    className={`relative h-[38px] px-3.5 rounded-xl flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest border-2 transition-all ${
                      isProductionOrder
                        ? 'bg-sky-500 border-sky-400 text-white shadow-lg shadow-sky-400/30 border-none'
                        : isDarkMode
                          ? 'bg-sky-900/30 border-sky-700 text-sky-400'
                          : 'bg-sky-50 border-sky-300 text-sky-600'
                    }`}
                  >
                    <Factory size={12} strokeWidth={2.5} />
                    OP
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div>
                <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest">Condição</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-4 text-[11px] font-black uppercase appearance-none text-slate-700 dark:text-slate-200"
                  value={paymentTerm}
                  aria-label="Condição de pagamento"
                  title="Condição de Pagamento"
                  onChange={(e) => setPaymentTerm(e.target.value as PaymentTerm)}
                >
                  <option value={PaymentTerm.CASH}>À Vista</option>
                  <option value={PaymentTerm.INSTALLMENTS}>A Prazo</option>
                </select>
             </div>
             <div>
                <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest leading-none">Pagamento</label>
                <div className="relative">
                  <select 
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-4 text-[11px] font-black uppercase appearance-none text-slate-700 dark:text-slate-200 cursor-pointer pr-10"
                    value={paymentMethodId}
                    aria-label="Método de pagamento"
                    title="Método de Pagamento"
                    onChange={(e) => setPaymentMethodId(e.target.value)}
                  >
                    <option value="">SELECIONE O MÉTODO</option>
                    {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                  </select>
                  <CreditCard size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div>
                <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest leading-none">Tipo Pagamento</label>
                <div className="relative">
                  <select 
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-4 text-[11px] font-black uppercase appearance-none text-slate-700 dark:text-slate-200 cursor-pointer pr-10"
                    value={paymentStatus}
                    aria-label="Status do pagamento"
                    title="Status do Pagamento"
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  >
                    <option value={PaymentStatus.PENDING}>Pendente</option>
                    <option value={PaymentStatus.PAID}>Quitado</option>
                  </select>
                  <Clock size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
             </div>
             {paymentTerm === PaymentTerm.INSTALLMENTS && (
               <div>
                  <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest leading-none">Vencimento</label>
                  <div className="relative">
                    <input 
                      type="date"
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-4 text-[11px] font-black uppercase appearance-none text-slate-700 dark:text-slate-200 cursor-pointer"
                      value={dueDate}
                      aria-label="Data de vencimento"
                      title="Data de Vencimento"
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                    <Calendar size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
               </div>
             )}
          </div>

          <div>
             <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest leading-none">Conta de Destino</label>
             <div className="relative">
                <select 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-4 text-[11px] font-black uppercase appearance-none text-slate-700 dark:text-slate-200 cursor-pointer pr-10"
                  value={accountId}
                  aria-label="Conta de destino"
                  title="Conta de Destino"
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="">SELECIONE A CONTA</option>
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (SALDO: R$ {acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</option>)}
                </select>
                <Wallet size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
             </div>
          </div>
          
          <div className="mt-4">
              <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest leading-none">Observações</label>
              <textarea 
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-[12px] font-medium leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-200 resize-none h-24"
                value={notes}
                aria-label="Observações da venda"
                title="Observações"
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione observações sobre a venda..."
              />
          </div>
        </div>
      </div>

      {/* Items List */}
      <section>
        {hasProduction && isProductionOrder && (
          <div className={`mb-4 flex items-start gap-3 p-4 rounded-2xl border-2 ${
            saleDestination === 'STOCK'
              ? isDarkMode ? 'bg-amber-900/20 border-amber-800/40' : 'bg-amber-50 border-amber-200'
              : isDarkMode ? 'bg-violet-900/20 border-violet-800/40' : 'bg-violet-50 border-violet-200'
          }`}>
            <Factory size={16} className={`${saleDestination === 'STOCK' ? 'text-amber-500' : 'text-violet-500'} shrink-0 mt-0.5`} />
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${saleDestination === 'STOCK' ? 'text-amber-600 dark:text-amber-400' : 'text-violet-600 dark:text-violet-400'}`}>
                {saleDestination === 'STOCK' ? 'Pedido de Produção — Estoque' : 'Pedido de Produção — Cliente'}
              </p>
              <p className={`text-[9px] font-bold leading-relaxed ${saleDestination === 'STOCK' ? 'text-amber-500' : 'text-violet-500'}`}>
                {saleDestination === 'STOCK'
                  ? 'Produção para estoque. Configure o padrão de embalagem e salve — o pedido entra na fila de espera do PCP. Os mapas são criados manualmente lá.'
                  : 'Configure o padrão de embalagem e salve — o pedido entra na fila de espera do PCP. Os mapas de produção são criados manualmente no PCP.'}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-4 px-2">
            <div>
               <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 leading-none">Cesta de Itens</h3>
               <p className="text-[8px] text-slate-300 font-bold uppercase tracking-widest mt-1">Selecione os produtos e variações</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowProductModal(true)} 
                className={`flex items-center gap-2 font-black text-[10px] uppercase tracking-widest bg-slate-900 dark:bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-xl active:scale-95 transition-all`}
                aria-label="Adicionar modelo à cesta"
                title="Adicionar Modelo"
              >
                <Plus size={14} strokeWidth={3} /> Modelo
              </button>
              <button 
                onClick={() => setIsScannerOpen(true)} 
                className={`flex items-center gap-2 font-black text-[10px] uppercase tracking-widest bg-indigo-500 text-white px-5 py-3 rounded-2xl shadow-xl active:scale-95 transition-all`}
                aria-label="Escanear QR Code"
                title="Escanear QR"
              >
                <Camera size={14} strokeWidth={3} /> Escanear
              </button>
            </div>
        </div>

        <div className="flex flex-col gap-4">
          {blocks.map((block, index) => {
            const product = products.find(p => p.id === block.productId);
            if (!product) return null;
            const isExpanded = expandedBlocks.includes(block.id);
            
            const totalItemsInBlock = Object.values(block.variations).reduce<number>((sum, v) => sum + (v as { quantity: number }).quantity, 0);

            return (
              <div key={block.id} className={`rounded-[2.5rem] border shadow-sm flex flex-col relative overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
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
                   
                   <div className="flex items-center gap-2">
                     <button 
                       onClick={() => toggleBlockExpanded(block.id)} 
                       className="p-2 text-slate-300 dark:text-slate-600 hover:text-indigo-500 transition-colors transform active:scale-90"
                       aria-label="Expandir/Recolher item"
                       title="Ver Detalhes"
                     >
                       {isExpanded ? <ChevronUp size={20} strokeWidth={2.5} /> : <ChevronDown size={20} strokeWidth={2.5} />}
                     </button>
                     <button 
                       onClick={() => removeBlock(index)} 
                       className="p-2 text-slate-200 dark:text-slate-700 hover:text-rose-500 transition-colors transform active:scale-90"
                       aria-label="Remover item da cesta"
                       title="Remover"
                     >
                       <Trash2 size={18} strokeWidth={2.5} />
                     </button>
                   </div>
                </div>

                {isExpanded && (
                  <div className="p-5 pt-0 border-t border-slate-50 dark:border-slate-800 mt-2">
                    <div className="flex flex-col gap-3 mt-4 mb-5">
                      {/* Modalidade */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest px-1">Modalidade</label>
                        {product.type === SaleType.RETAIL ? (
                          <button
                            onClick={() => {
                              const newType = block.saleType === SaleType.RETAIL ? SaleType.WHOLESALE : SaleType.RETAIL;
                              const p = products.find(prod => prod.id === block.productId);
                              const newPrice = p?.salePrice || 0;

                              const newVariations = { ...block.variations };
                              Object.keys(newVariations).forEach(k => {
                                newVariations[k].price = newPrice;
                                if (newType === SaleType.WHOLESALE) newVariations[k].size = undefined;
                              });

                              updateBlock(index, {
                                saleType: newType,
                                price: newPrice,
                                variations: newVariations
                              });
                            }}
                            className={`w-full text-[9px] font-black py-3 rounded-2xl border-2 uppercase tracking-widest transition-all ${block.saleType === SaleType.WHOLESALE ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50'}`}
                            aria-label="Mudar modalidade de venda"
                            title="Modalidade"
                          >
                            {block.saleType === SaleType.WHOLESALE ? 'Atacado' : 'Varejo'}
                          </button>
                        ) : (
                          <div className="text-[9px] font-black py-3 rounded-2xl border-2 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-800 text-center flex items-center justify-center gap-2">
                            <Box size={12} /> Somente Atacado
                          </div>
                        )}
                      </div>

                      {/* Preço Grade */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest px-1">
                          Preço Grade (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl py-2.5 text-right pr-3 text-[12px] font-black text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                          value={block.price}
                          aria-label="Preço por grade"
                          title="Preço por Grade"
                          onChange={(e) => updateBlock(index, { price: parseFloat(e.target.value) || 0 })}
                        />
                      </div>

                      {/* Preço Unitário */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] uppercase font-black text-sky-400 tracking-widest px-1">
                          Preço Unitário (R$/par)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl py-2.5 text-right pr-3 text-[12px] font-black text-sky-600 dark:text-sky-400 focus:ring-2 focus:ring-sky-500/10 transition-all"
                          value={block.unitPrice ?? ''}
                          placeholder="0,00"
                          aria-label="Preço por par"
                          title="Preço Unitário por Par"
                          onChange={(e) => updateBlock(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        {/* Aviso quando produto não tem unitSalePrice cadastrado */}
                        {hasProduction && isProductionOrder && !products.find(p => p.id === block.productId)?.unitSalePrice && (
                          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <AlertCircle size={11} className="text-amber-500 shrink-0" />
                            <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 leading-tight">
                              Preço unitário não cadastrado no produto. Acesse o cadastro e preencha "Venda Unitária por Par".
                            </p>
                          </div>
                        )}
                        {/* Calculadora — mostra média das embalagens do bloco */}
                        {hasProduction && isProductionOrder && block.unitPrice > 0 && (() => {
                          const varKeys = Object.keys(block.variations).map(vk => `${block.id}-${vk.split('-')[0]}`);
                          const totals = varKeys.map(k => packagingPerVar[k]).filter(Boolean);
                          if (totals.length === 0) return null;
                          const avgPairs = Math.round(totals.reduce((s, p) => s + Object.values(p.breakdown).reduce((a, b) => a + b, 0), 0) / totals.length);
                          if (avgPairs === 0) return null;
                          return (
                            <div className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[9px] font-black ${isDarkMode ? 'bg-sky-900/20 text-sky-400' : 'bg-sky-50 text-sky-600'}`}>
                              <span>{avgPairs} pares × R$ {block.unitPrice.toFixed(2)}</span>
                              <span>= R$ {(block.unitPrice * avgPairs).toFixed(2)}/emb</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Padrão de Embalagem do Bloco (nível produto — aplica a todas as variações) */}
                    {hasProduction && isProductionOrder && block.saleType === SaleType.WHOLESALE && (() => {
                      const packagingConfigs = productionConfigs.filter(c => c.type === 'PACKAGING');
                      const selectedPkg = block.blockPkgId ? packagingConfigs.find(c => c.id === block.blockPkgId) : null;
                      const capacity = selectedPkg?.metadata?.capacity || 0;
                      return (
                        <div className="mb-5">
                          <label className="text-[8px] uppercase font-black text-violet-500 tracking-widest px-1 mb-2 block flex items-center gap-1.5">
                            <Layers size={10} />
                            Caixa Coletiva (Padrão de Embalagem)
                          </label>
                          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                            selectedPkg
                              ? isDarkMode ? 'bg-violet-900/20 border-violet-700' : 'bg-violet-50 border-violet-300'
                              : isDarkMode ? 'bg-slate-800 border-slate-700 border-dashed' : 'bg-slate-50 border-dashed border-slate-300'
                          }`}>
                            <Package size={16} className={selectedPkg ? 'text-violet-500' : 'text-slate-400'} />
                            <select
                              value={block.blockPkgId || ''}
                              onChange={e => applyBlockPackaging(index, e.target.value)}
                              title="Padrão de embalagem do produto"
                              aria-label="Padrão de embalagem"
                              className={`flex-1 bg-transparent font-black text-[11px] outline-none cursor-pointer ${selectedPkg ? 'text-violet-700 dark:text-violet-300' : 'text-slate-400'}`}
                            >
                              <option value="">Selecione o padrão de embalagem…</option>
                              {packagingConfigs.map(pkg => (
                                <option key={pkg.id} value={pkg.id}>
                                  {pkg.name} — {pkg.metadata?.capacity || 0} pares {pkg.metadata?.mode === 'FREE' ? '(Livre)' : '(Fixo)'}
                                </option>
                              ))}
                            </select>
                          </div>
                          {selectedPkg && capacity > 0 && (
                            <p className="text-[9px] text-violet-500 font-black mt-1.5 px-1 flex items-center gap-1">
                              <CheckCircle2 size={10} />
                              1 grade = 1 caixa coletiva de {capacity} pares — aplicado a todas as variações
                            </p>
                          )}
                          {packagingConfigs.length === 0 && (
                            <p className="text-[9px] text-amber-500 font-bold mt-1 px-1">
                              Nenhum padrão cadastrado. Acesse Produção → Configurações → Embalagens.
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex flex-col gap-3">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-1">Variações Disponíveis</h4>
                      
                      {product.variations.map(v => {
                        const grid = grids.find(g => g.id === product.defaultGridId);
                        
                        // For Retail, we might want to iterate sizes if they want specific sizes.
                        // But let's keep it simple: if Retail, show sizes.
                        
                        if (block.saleType === SaleType.RETAIL && grid) {
                          return (
                            <div key={v.id} className="space-y-2">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{v.colorName}</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {grid.sizes.map(size => {
                                  const variationKey = `${v.id}-${size}`;
                                  const varState = block.variations[variationKey] || { quantity: 0, price: block.price, size };
                                  const stock = v.stock[size] || 0;
                                  const hasStock = stock > 0;

                                  return (
                                    <div key={variationKey} className={`p-3 rounded-2xl border flex flex-col gap-2 ${varState.quantity > 0 ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50/50 dark:bg-slate-800/30 border-transparent'}`}>
                                      <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tight">
                                        <span className="text-slate-700 dark:text-slate-200">TAM. {size}</span>
                                        <span className={stock > 0 ? 'text-emerald-500' : 'text-rose-500'}>{stock} prs</span>
                                      </div>
                                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-1">
                                        <button 
                                          onClick={() => updateVariation(index, v.id, (varState.quantity || 0) - 1, varState.price, size)}
                                          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500"
                                          title="Diminuir"
                                          aria-label="Diminuir quantidade"
                                        >
                                          <Minus size={12} strokeWidth={3} />
                                        </button>
                                        <input
                                          type="number"
                                          className="flex-1 w-full bg-transparent border-none p-0 text-center font-black text-[11px] text-slate-800 dark:text-white focus:ring-0"
                                          value={varState.quantity}
                                          title="Quantidade"
                                          aria-label="Quantidade"
                                          placeholder="0"
                                          onChange={(e) => {
                                            const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                                            updateVariation(index, v.id, val || 0, varState.price, size);
                                          }}
                                        />
                                        <button 
                                          onClick={() => updateVariation(index, v.id, (varState.quantity || 0) + 1, varState.price, size)}
                                          className="w-6 h-6 rounded-lg flex items-center justify-center text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/50"
                                          title="Aumentar"
                                          aria-label="Aumentar quantidade"
                                        >
                                          <Plus size={12} strokeWidth={3} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        // Wholesale: just by color
                        const variationKey = v.id;
                        const varState = block.variations[variationKey] || { quantity: 0, price: block.price };
                        const stock = Object.values(v.stock).reduce((a, b) => a + b, 0);

                        const varPkgKey = `${block.id}-${v.id}`;
                        const varPkg = packagingPerVar[varPkgKey];
                        const varPkgConfig = varPkg?.pkgId ? productionConfigs.find(c => c.id === varPkg.pkgId) : null;
                        const varPkgTotal = varPkg ? Object.values(varPkg.breakdown).reduce((a, b) => a + b, 0) : 0;
                        const varFromStockTotal = varPkg ? Object.values(varPkg.fromStock || {}).reduce((a, b) => a + b, 0) : 0;

                        return (
                          <div key={variationKey} className={`rounded-2xl border overflow-hidden ${varState.quantity > 0 ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50/50 dark:bg-slate-800/30 border-transparent'}`}>
                            <div className="p-4 flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200">{v.colorName}</p>
                                <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${stock > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  Estoque: {stock} grades
                                </p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex flex-col gap-1 text-right mr-2">
                                  <label className="text-[7px] font-black text-slate-400 uppercase">Preço</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="w-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg py-1 px-2 text-[10px] font-black text-right"
                                    value={varState.price}
                                    title="Preço unitário"
                                    aria-label="Preço unitário"
                                    placeholder="0.00"
                                    onChange={(e) => updateVariation(index, v.id, varState.quantity, parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-1">
                                  <button onClick={() => updateVariation(index, v.id, (varState.quantity || 0) - 1, varState.price)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500" title="Diminuir" aria-label="Diminuir quantidade"><Minus size={14} /></button>
                                  <input
                                    type="number"
                                    className="w-8 bg-transparent border-none p-0 text-center font-black text-xs text-slate-800 dark:text-white focus:ring-0"
                                    value={varState.quantity}
                                    title="Quantidade"
                                    aria-label="Quantidade"
                                    placeholder="0"
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                                      updateVariation(index, v.id, val || 0, varState.price);
                                    }}
                                  />
                                  <button onClick={() => updateVariation(index, v.id, (varState.quantity || 0) + 1, varState.price)} className="w-7 h-7 rounded-lg flex items-center justify-center text-indigo-500" title="Aumentar" aria-label="Aumentar quantidade"><Plus size={14} /></button>
                                </div>
                              </div>
                            </div>

                            {/* Botões de produção por variação (embalagem + grade) */}
                            {hasProduction && isProductionOrder && varState.quantity > 0 && (() => {
                              const varGradeKey = `${block.id}-${v.id}`;
                              const varGrade = gradePerVar[varGradeKey];
                              const varGradeTotal = varGrade ? Object.values(varGrade).reduce((a, b) => a + b, 0) : 0;
                              return (
                                <div className={`px-4 pb-3 border-t ${isDarkMode ? 'border-indigo-800/40' : 'border-indigo-100'}`}>
                                  {/* Botão Embalagem */}
                                  <button
                                    type="button"
                                    onClick={() => setPackagingModalTarget({ blockId: block.id, variationId: v.id, variationName: v.colorName })}
                                    className={`mt-2 w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                                      varPkg?.pkgId
                                        ? isDarkMode ? 'bg-violet-900/30 border border-violet-700' : 'bg-violet-50 border border-violet-200'
                                        : isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-dashed border-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Layers size={13} className={varPkg?.pkgId ? 'text-violet-500' : 'text-slate-400'} />
                                      <span className={`text-[11px] font-black uppercase tracking-widest ${varPkg?.pkgId ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'}`}>
                                        {varPkgConfig ? varPkgConfig.name : 'Selecionar Embalagem'}
                                      </span>
                                    </div>
                                    {varPkg?.pkgId ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-black text-violet-500">{varPkgTotal} pares/emb</span>
                                        {varFromStockTotal > 0 && <span className="text-[10px] font-black text-emerald-500">-{varFromStockTotal} est.</span>}
                                        <span className="text-[11px] font-black text-indigo-500 underline">Editar</span>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] font-black text-slate-400">Toque para configurar ›</span>
                                    )}
                                  </button>
                                  {/* Cálculo de valor da embalagem */}
                                  {varPkg?.pkgId && block.unitPrice > 0 && varPkgTotal > 0 && (
                                    <div className={`mt-1.5 flex items-center justify-between px-3 py-1.5 rounded-xl text-[9px] font-black ${isDarkMode ? 'bg-sky-900/20 text-sky-400' : 'bg-sky-50 text-sky-600'}`}>
                                      <span>{varPkgTotal} pares × R$ {block.unitPrice.toFixed(2)}</span>
                                      <span>= R$ {(block.unitPrice * varPkgTotal).toFixed(2)}/emb</span>
                                    </div>
                                  )}
                                  {/* Botão Grade (só aparece quando NÃO há embalagem configurada) */}
                                  {!varPkg?.pkgId && (
                                    <button
                                      type="button"
                                      onClick={() => setGradeModalTarget({ blockId: block.id, variationId: v.id, variationName: v.colorName, productId: block.productId })}
                                      className={`mt-2 w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                                        varGradeTotal > 0
                                          ? isDarkMode ? 'bg-emerald-900/30 border border-emerald-700' : 'bg-emerald-50 border border-emerald-200'
                                          : isDarkMode ? 'bg-slate-800 border border-dashed border-slate-600' : 'bg-white border border-dashed border-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <CheckCircle2 size={13} className={varGradeTotal > 0 ? 'text-emerald-500' : 'text-slate-400'} />
                                        <span className={`text-[11px] font-black uppercase tracking-widest ${varGradeTotal > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                          {varGradeTotal > 0 ? `Grade: ${varGradeTotal} pares` : 'Configurar Grade'}
                                        </span>
                                      </div>
                                      {varGradeTotal > 0 ? (
                                        <span className="text-[11px] font-black text-emerald-500 underline">Editar</span>
                                      ) : (
                                        <span className="text-[11px] font-black text-slate-400">Toque para configurar ›</span>
                                      )}
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>

                    {/* Embalagem por variação — modo produção */}
                  </div>
                )}
              </div>
            );
          })}

          {blocks.length === 0 && (
            <div className="text-center py-20 bg-slate-50/30 dark:bg-slate-900/40 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem] flex flex-col items-center">
              <Package size={40} className="text-slate-200 dark:text-slate-800 mb-2" strokeWidth={1} />
              <p className="text-[10px] font-black uppercase text-slate-300 dark:text-slate-700 tracking-[0.2em] italic px-10 text-center leading-relaxed">
                Adicione modelos para iniciar a venda
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Cesta de Pedidos */}
      {cartItems.length > 0 && (
        <section className={`rounded-[2rem] border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className={`flex items-center justify-between px-5 py-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                <ShoppingCart size={15} className="text-white" />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 leading-none">Cesta de Pedidos</h3>
                <p className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {cartItems.length} {cartItems.length === 1 ? 'item configurado' : 'itens configurados'}
                </p>
              </div>
            </div>
            {isProductionOrder && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-violet-900/30 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
                <Factory size={11} />
                Modo Produção
              </div>
            )}
          </div>

          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {cartItems.map((item, i) => {
              const toProd = item.pkgConfig ? item.pkgConfig.grandTotal - (item.pkgConfig.fromStockTotal * item.quantity) : 0;
              return (
                <div key={`${item.blockId}-${item.variationId}-${i}`} className={`px-5 py-3.5 flex gap-3 ${isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/70'} transition-colors`}>
                  {/* Indicador de cor */}
                  <div className="w-1.5 self-stretch rounded-full bg-indigo-400 shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-[11px] font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          {item.productName}
                          {item.reference && <span className="text-slate-400 font-bold ml-1 text-[9px]">#{item.reference}</span>}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {item.variationName}
                          {item.size && ` · TAM ${item.size}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{item.quantity}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">
                          {item.saleType === SaleType.WHOLESALE ? 'grades' : 'pares'}
                        </p>
                      </div>
                    </div>

                    {/* Info de embalagem (modo produção) */}
                    {item.pkgConfig && (
                      <div className={`mt-2 p-2.5 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Layers size={10} className="text-violet-500" />
                            <span className="text-[9px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest">{item.pkgConfig.pkgName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPackagingModalTarget({ blockId: item.blockId, variationId: item.variationId, variationName: item.variationName })}
                            className="text-[8px] font-black text-indigo-500 uppercase tracking-widest"
                          >
                            Editar Embalagem ›
                          </button>
                        </div>

                        {/* Grade de tamanhos */}
                        <div className="flex flex-wrap gap-1 mb-2">
                          {Object.entries(item.pkgConfig.breakdown)
                            .filter(([, qty]) => qty > 0)
                            .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                            .map(([size, qty]) => (
                              <span key={size} className={`px-2 py-0.5 rounded-lg text-[8px] font-black ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600'} border ${isDarkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                                {size}: {qty}
                              </span>
                            ))}
                        </div>

                        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-700">
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                            <div className="flex items-center gap-2">
                              <span className="text-indigo-600 dark:text-indigo-400">{item.pkgConfig.grandTotal} pares no total</span>
                              <span className="text-slate-300 dark:text-slate-600 font-normal">({item.pkgConfig.pairsPerEmb} por emb. × {item.quantity} emb.)</span>
                            </div>
                          </div>
                          
                          {item.pkgConfig.fromStockTotal > 0 && (
                            <div className="flex items-center gap-3 text-[8px] font-black uppercase tracking-widest">
                              <div className="flex items-center gap-1 text-emerald-500">
                                <Warehouse size={10} />
                                <span>{item.pkgConfig.fromStockTotal * item.quantity} pares do estoque</span>
                              </div>
                              <div className="flex items-center gap-1 text-amber-500">
                                <Factory size={10} />
                                <span>{toProd} pares a produzir</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Valor */}
                    {item.price > 0 && (
                      <div className="mt-1.5 flex items-center gap-3 text-[8px] font-black">
                        <span className="text-slate-400">R$ {item.price.toFixed(2)}/grade</span>
                        {item.unitPrice && item.pkgConfig && (
                          <span className="text-sky-500">R$ {(item.unitPrice * item.pkgConfig.pairsPerEmb).toFixed(2)}/emb</span>
                        )}
                        <span className={`ml-auto font-black text-[10px] ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
                          R$ {(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totalizador da cesta */}
          <div className={`px-5 py-3 border-t flex items-center justify-between ${isDarkMode ? 'border-slate-800 bg-slate-800/30' : 'border-slate-100 bg-slate-50/50'}`}>
            {isProductionOrder ? (
              <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest">
                <span className="text-violet-500">
                  {cartItems.reduce((s, it) => s + (it.pkgConfig?.grandTotal || 0), 0)} pares total
                </span>
                <span className="text-emerald-500">
                  {cartItems.reduce((s, it) => s + (it.pkgConfig ? it.pkgConfig.fromStockTotal * it.quantity : 0), 0)} do estoque
                </span>
                <span className="text-indigo-500">
                  {cartItems.reduce((s, it) => {
                    if (!it.pkgConfig) return s;
                    return s + it.pkgConfig.grandTotal - (it.pkgConfig.fromStockTotal * it.quantity);
                  }, 0)} produzir
                </span>
              </div>
            ) : (
              <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {cartItems.reduce((s, it) => s + it.quantity, 0)} unidades
              </span>
            )}
            <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              R$ {cartItems.reduce((s, it) => s + it.price * it.quantity, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </section>
      )}

      {/* Summary and Payments near Finalize area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payments Section */}
        <div className={`p-6 rounded-[2rem] border shadow-sm flex flex-col gap-5 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
           <div className="flex justify-between items-center px-2">
              <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 leading-none">Recebimentos</h3>
              <button 
                onClick={() => setShowPaymentModal(true)}
                className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                title="Adicionar Recebimento"
              >
                <Plus size={16} strokeWidth={3} />
              </button>
           </div>

           <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                 <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pago</p>
                    <p className="text-sm font-black text-emerald-500">R$ {amountPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                 </div>
                 <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Restante</p>
                    <p className={`text-sm font-black ${remainingBalance > 0 ? 'text-rose-500' : 'text-slate-400'}`}>R$ {remainingBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                 </div>
              </div>

              {paymentHistory.length > 0 && (
                <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 overflow-hidden">
                   <p className="px-4 py-2 bg-slate-100/50 dark:bg-slate-800/50 text-[7px] font-black uppercase tracking-widest text-slate-400">Histórico de Recebimentos</p>
                   <div className="max-h-40 overflow-y-auto">
                      {paymentHistory.map((payment, idx) => {
                        const pm = paymentMethods.find(m => m.id === payment.paymentMethodId);
                        return (
                          <div key={payment.id} className="p-3 flex justify-between items-center border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-white dark:hover:bg-slate-800 transition-colors group">
                             <div>
                                <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase">{pm?.name || 'Manual'}</p>
                                <p className="text-[7px] text-slate-400 font-bold">{new Date(payment.date).toLocaleDateString('pt-BR')} {new Date(payment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                {payment.note && <p className="text-[7px] text-indigo-400 italic mt-0.5">"{payment.note}"</p>}
                             </div>
                             <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-emerald-500">R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <button 
                                  onClick={() => setPaymentHistory(paymentHistory.filter(p => p.id !== payment.id))}
                                  className="p-1 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                                  title="Remover Pagamento"
                                  aria-label="Remover este pagamento do histórico"
                                >
                                  <Minus size={12} />
                                </button>
                             </div>
                          </div>
                        );
                      })}
                   </div>
                </div>
              )}

              {surplusCredit > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex items-center gap-2">
                   <Info size={12} className="text-amber-500" />
                   <p className="text-[8px] font-bold text-amber-700 dark:text-amber-400 leading-tight uppercase tracking-widest">
                     O valor pago excede o total. O cliente terá um crédito de <span className="font-black">R$ {surplusCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>.
                   </p>
                </div>
              )}
           </div>
        </div>

        {/* General Summary */}
        <div className={`p-8 rounded-[2rem] border shadow-sm flex flex-col justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
           <div className="flex justify-between items-start px-1">
              <div>
                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-2">Resumo Geral</p>
                 <h3 className={`text-4xl font-black italic tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                 <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest mt-3 flex items-center gap-1.5 leading-none">
                    <CheckCircle2 size={10} /> {status === SaleStatus.SALE ? 'Venda Pronta' : 'Orçamento Gerado'}
                 </p>
              </div>
              <div className={`p-4 rounded-2xl shadow-lg ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                 <TrendingUp size={28} />
              </div>
           </div>
           
           <div className="flex items-center gap-3 mt-4">
              <div className="flex-1 flex flex-col gap-1.5">
                 <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Desconto (R$)</label>
                 <div className="relative">
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-3 pr-8 text-xs font-black text-rose-500"
                      value={discount}
                      title="Desconto"
                      aria-label="Valor do desconto"
                      placeholder="0.00"
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    />
                    <Percent size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
                 </div>
              </div>
              <button 
                onClick={handleWhatsApp}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${customerId ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-300'}`}
                disabled={!customerId}
                title="Compartilhar via WhatsApp"
                aria-label="Compartilhar pedido via WhatsApp"
              >
                <MessageSquare size={20} />
              </button>
           </div>
        </div>
      </div>

      {showWhatsAppModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowWhatsAppModal(false)} />
          <div className={`relative w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                    <MessageSquare size={24} />
                 </div>
                 <div>
                    <h2 className="text-lg font-black uppercase tracking-widest text-slate-800 dark:text-white">Prévia do Pedido</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Confira os detalhes antes de compartilhar</p>
                 </div>
              </div>
              <button 
                onClick={() => setShowWhatsAppModal(false)} 
                className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"
                title="Fechar"
                aria-label="Fechar prévia do WhatsApp"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 flex-1 overflow-hidden flex flex-col gap-6">
               <div className="flex items-center justify-between">
                  <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                     <button 
                        onClick={() => {
                          setIsMessageManual(false);
                          setWhatsappMessage(generateDefaultMessage());
                        }}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!isMessageManual ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                     >
                        Automática
                     </button>
                     <button 
                        onClick={() => setIsMessageManual(true)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isMessageManual ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                     >
                        Manual
                     </button>
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(whatsappMessage);
                      alert('Mensagem copiada!');
                    }}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-4 py-2 rounded-xl transition-all"
                  >
                    <Copy size={14} strokeWidth={3} /> Copiar Texto
                  </button>
               </div>

               <textarea 
                 className={`flex-1 w-full bg-slate-50 dark:bg-slate-800/30 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 text-sm font-medium leading-relaxed resize-none focus:ring-8 focus:ring-indigo-500/5 outline-none transition-all ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}
                 value={whatsappMessage}
                 title="Mensagem do WhatsApp"
                 aria-label="Conteúdo da mensagem para WhatsApp"
                 onChange={(e) => {
                   setWhatsappMessage(e.target.value);
                   setIsMessageManual(true);
                 }}
                 readOnly={!isMessageManual}
               />
            </div>

            <div className="p-8 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
               <button 
                 onClick={handleExportPDF}
                 className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 py-5 rounded-[1.5rem] flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 border border-slate-200 dark:border-slate-700"
               >
                 <Share2 size={20} strokeWidth={2.5} /> Compartilhar PDF
               </button>
               <button 
                 onClick={sendWhatsApp}
                 className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-5 rounded-[1.5rem] flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[11px] shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
               >
                 <Share size={20} strokeWidth={2.5} /> Enviar WhatsApp
               </button>
            </div>
          </div>
        </div>
      )}

      {showProductModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowProductModal(false)} />
          <div className={`relative w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Selecionar Modelo</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Busque pelo nome ou referência</p>
              </div>
              <button 
                onClick={() => setShowProductModal(false)} 
                className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"
                title="Fechar"
                aria-label="Fechar seleção de produto"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
               <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" size={18} strokeWidth={3} />
                 <input 
                   type="text" 
                   autoFocus
                   placeholder="Buscar modelo..."
                   className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-4 text-sm font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500/10 transition-all text-slate-800 dark:text-white outline-none"
                   value={productSearchQuery}
                   onChange={(e) => setProductSearchQuery(e.target.value)}
                 />
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="flex flex-col gap-2">
                {activeProducts
                  .filter(p => !productSearchQuery || p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || p.reference?.toLowerCase().includes(productSearchQuery.toLowerCase()))
                  .map(p => {
                    const addedCount = blocks.filter(b => b.productId === p.id).length;
                    const canDuplicate = hasProduction && isProductionOrder;
                    const isBlocked = !canDuplicate && addedCount > 0;
                    return (
                      <button
                        key={p.id}
                        disabled={isBlocked}
                        onClick={() => { if (!isBlocked) addBlock(p.id); }}
                        className={`flex items-center justify-between p-4 rounded-3xl transition-all border text-left ${
                          isBlocked
                            ? 'bg-slate-50/50 dark:bg-slate-800/30 border-transparent opacity-50 cursor-not-allowed'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700 bg-transparent active:scale-[0.98]'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isBlocked ? 'bg-slate-100 dark:bg-slate-800' : 'bg-indigo-50 dark:bg-indigo-900/20'}`}>
                            <Package size={20} className={isBlocked ? 'text-slate-400' : 'text-indigo-500'} />
                          </div>
                          <div>
                            <h4 className="text-[13px] font-black uppercase tracking-tight text-slate-800 dark:text-white line-clamp-1">{p.name}</h4>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">REF: {p.reference || '---'}</p>
                          </div>
                        </div>
                        {addedCount > 0 && (
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                            isBlocked
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'
                              : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500'
                          }`}>
                            {isBlocked ? <CheckCircle2 size={10} /> : <Plus size={10} strokeWidth={3} />}
                            {isBlocked ? 'Adicionado' : `+${addedCount} na cesta`}
                          </div>
                        )}
                      </button>
                    )
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)} />
          <div className={`relative w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Novo Recebimento</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Registrar pagamento parcial ou total</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors" title="Fechar" aria-label="Fechar registro de recebimento">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5">
               <div>
                  <div className="flex items-center justify-between px-3 mb-2">
                    <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 block tracking-widest">Valor Recebido</label>
                    {remainingBalance > 0 && (
                      <button 
                        type="button"
                        onClick={() => setPartialPaymentAmount(remainingBalance)}
                        className="text-[8px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
                      >
                        <CheckCircle2 size={10} />
                        Quitar Total
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.01"
                      autoFocus
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-lg font-black text-emerald-500 placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
                      placeholder="0.00"
                      value={partialPaymentAmount || ''}
                      title="Valor Recebido"
                      aria-label="Valor recebido no pagamento parcial"
                      onChange={(e) => setPartialPaymentAmount(parseFloat(e.target.value) || 0)}
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-black text-slate-300">R$</div>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest">Método</label>
                    <select 
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3.5 text-[11px] font-black uppercase appearance-none text-slate-700 dark:text-slate-200"
                      value={partialPaymentMethodId}
                      title="Selecionar método de pagamento"
                      onChange={(e) => setPartialPaymentMethodId(e.target.value)}
                    >
                      <option value="">MESMO DO PEDIDO</option>
                      {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest">Conta</label>
                    <select 
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3.5 text-[11px] font-black uppercase appearance-none text-slate-700 dark:text-slate-200"
                      value={partialPaymentAccountId}
                      title="Selecionar conta de destino"
                      onChange={(e) => setPartialPaymentAccountId(e.target.value)}
                    >
                      <option value="">MESMA DO PEDIDO</option>
                      {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                  </div>
               </div>

               <div>
                  <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-3 mb-2 block tracking-widest">Observação</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Pago via PIX pelo João"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-[12px] font-bold text-slate-700 dark:text-slate-200"
                    value={partialPaymentNote}
                    title="Observação do Recebimento"
                    aria-label="Observação sobre o pagamento parcial"
                    onChange={(e) => setPartialPaymentNote(e.target.value)}
                  />
               </div>

               <button 
                 onClick={addPartialPayment}
                 disabled={partialPaymentAmount <= 0}
                 className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg transition-all active:scale-[0.98] mt-2 ${partialPaymentAmount > 0 ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'}`}
               >
                 Confirmar Recebimento
               </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 mx-2 flex flex-col xl:flex-row xl:items-center justify-between bg-slate-900 dark:bg-slate-800 p-4 rounded-[2rem] shadow-xl z-40 animate-in slide-in-from-bottom-5 gap-4 pointer-events-auto">
         <div className="pl-3">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest leading-none mb-1">Finalizar {status === SaleStatus.QUOTE ? 'Orçamento' : 'Venda'}</p>
            <p className="text-2xl font-black text-white leading-none">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
         </div>
         <div className="flex gap-2 w-full xl:w-auto">
            {saleId && (
              <button 
                onClick={() => setShowCancelOnlyConfirm(true)} 
                disabled={status === SaleStatus.CANCELLED}
                title={status === SaleStatus.CANCELLED ? "Venda Cancelada/Neutro" : "Cancelar (Sem Estorno)"}
                className={`flex-1 h-12 px-2 rounded-full flex items-center justify-center gap-1.5 text-white font-black uppercase tracking-tight text-[9px] sm:text-[10px] transition-all active:scale-90 ${status === SaleStatus.CANCELLED ? 'bg-slate-700 cursor-not-allowed' : 'bg-white/10 hover:bg-slate-500 active:bg-slate-600'}`}
              >
                <Ban size={16} strokeWidth={2.5} className="shrink-0" /> <span className="line-clamp-1 break-all text-center leading-none mt-0.5">S/ Estorno</span>
              </button>
            )}
            <button 
              onClick={() => {
                if (saleId) {
                  setShowCancelConfirm(true);
                } else {
                  onCancel();
                }
              }} 
              disabled={status === SaleStatus.CANCELLED}
              title={saleId ? (status === SaleStatus.CANCELLED ? "Venda Cancelada/Estornada" : "Cancelar Venda e Estornar") : "Descartar"}
              className={`flex-1 h-12 px-2 rounded-full flex items-center justify-center gap-1.5 text-white font-black uppercase tracking-tight text-[9px] sm:text-[10px] transition-all active:scale-90 ${status === SaleStatus.CANCELLED ? 'bg-slate-700 cursor-not-allowed' : 'bg-white/10 hover:bg-rose-500 active:bg-rose-600'}`}
            >
              {saleId ? <><RotateCcw size={16} strokeWidth={2.5} className="shrink-0" /> <span className="line-clamp-1 break-all text-center leading-none mt-0.5">Estornar</span></> : <><Trash2 size={16} strokeWidth={2.5} className="shrink-0" /> <span className="line-clamp-1 break-all text-center leading-none mt-0.5">Descartar</span></>}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex-1 h-12 px-2 rounded-full text-white font-black uppercase tracking-tight text-[10px] sm:text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 ${isSaving ? 'bg-slate-500 cursor-wait' : 'bg-indigo-600 active:bg-indigo-700 hover:bg-indigo-500'}`}
            >
              <Save size={16} strokeWidth={3} className={`shrink-0 ${isSaving ? 'animate-spin' : ''}`} /> <span className="line-clamp-1 break-all text-center leading-none mt-0.5">{isSaving ? 'Salvando...' : status === SaleStatus.QUOTE ? 'Salvar' : 'Concluir'}</span>
            </button>
            {hasProduction && saleId && status === SaleStatus.SALE && (
              <button
                type="button"
                onClick={() => setShowProductionOrderModal(true)}
                title="Gerar Pedido de Produção"
                className={`h-12 px-3 rounded-full font-black uppercase tracking-tight text-[9px] flex items-center justify-center gap-1.5 transition-all active:scale-95 border-2 ${
                  sales.find(s => s.id === saleId)?.productionOrderId
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                    : 'border-violet-500 text-violet-400 bg-violet-500/10 hover:bg-violet-500/20'
                }`}
              >
                <Factory size={15} strokeWidth={2.5} />
                <span className="hidden sm:inline">
                  {sales.find(s => s.id === saleId)?.productionOrderId ? 'Ver OP' : 'Gerar OP'}
                </span>
              </button>
            )}
         </div>
      </div>

      {/* CONFIRMATION MODALS FOR CANCELLATION */}
      {showCancelConfirm && saleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center text-rose-600 mb-2">
                <RotateCcw size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">Cancelar e Estornar?</h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                Esta ação <span className="text-rose-500">estornará os estoques</span> e apagará as movimentações financeiras relacionadas desta venda, mantendo o registro apenas como cancelado.
              </p>
              
              <div className="flex gap-2 w-full mt-4">
                <button 
                  onClick={() => setShowCancelConfirm(false)} 
                  className="flex-1 py-4 px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  Voltar
                </button>
                <button 
                  onClick={() => {
                    setShowCancelConfirm(false);
                    onDelete(saleId);
                  }} 
                  className="flex-1 py-4 px-4 bg-rose-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-rose-200 dark:shadow-none"
                >
                  Confirmar Estorno
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCancelOnlyConfirm && saleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500 mb-2">
                <Ban size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">Cancelar sem Estornar?</h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed px-4">
                O registro mudará para o status cancelado e ficará de forma "neutra", <span className="font-black text-slate-700 dark:text-slate-300">NÃO ALTERANDO o estoque e nem as entradas financeiras</span> já lançadas.
              </p>
              
              <div className="flex gap-2 w-full mt-4">
                <button 
                  onClick={() => setShowCancelOnlyConfirm(false)} 
                  className="flex-1 py-4 px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  Voltar
                </button>
                <button 
                  onClick={() => {
                    setShowCancelOnlyConfirm(false);
                    onCancelOnly(saleId);
                  }} 
                  className="flex-1 py-4 px-4 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  Cancelar sem Estorno
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`relative w-full max-w-sm rounded-[3rem] p-8 shadow-2xl flex flex-col items-center text-center gap-6 animate-in zoom-in duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
             <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 animate-bounce">
                <CheckCircle2 size={40} strokeWidth={3} />
             </div>
             <div>
                <h2 className={`text-2xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Venda Concluída!</h2>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-2">O registro foi processado com sucesso no sistema.</p>
             </div>
             
             <div className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total da Venda</p>
                <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 italic">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
             </div>

             <button 
               onClick={() => {
                 setShowSuccessModal(false);
                 onCancel();
               }}
               className="w-full py-5 rounded-2xl bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-xl active:scale-95 transition-all"
             >
               Continuar
             </button>
          </div>
        </div>
      )}

      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanResult}
        title="Escanear Produto"
      />

      {packagingModalTarget && (() => {
        const { blockId, variationId, variationName } = packagingModalTarget;
        const block = blocks.find(b => b.id === blockId);
        const product = block ? products.find(p => p.id === block.productId) : null;
        const productGrid = product ? (grids.find(g => g.id === product.productionGridId) || grids.find(g => g.id === product.defaultGridId) || null) : null;
        const variation = product?.variations.find(v => v.id === variationId);
        const isWholesale = product?.type === SaleType.WHOLESALE;
        const stockPerSize: Record<string, number> = {};
        if (variation && !isWholesale) {
          Object.entries(variation.stock).forEach(([size, qty]) => {
            if (size !== 'WHOLESALE') stockPerSize[size] = qty;
          });
        }
        // Para atacado: estoque em grades completas e quantidade pedida
        const stockGrades = isWholesale ? (variation?.stock['WHOLESALE'] || 0) : 0;
        const varData = block?.variations[variationId];
        const orderQuantity = isWholesale ? (varData?.quantity || undefined) : undefined;

        const existing = packagingPerVar[`${blockId}-${variationId}`];
        return (
          <PackagingBuilderModal
            isOpen
            onClose={() => setPackagingModalTarget(null)}
            onConfirm={result => {
              setPackagingPerVar(prev => ({
                ...prev,
                [`${blockId}-${variationId}`]: { pkgId: result.pkgId, breakdown: result.breakdown, fromStock: result.fromStock }
              }));
              setPackagingModalTarget(null);
            }}
            productName={product?.name || ''}
            variationName={variationName}
            packagingItems={productionConfigs.filter(c => c.type === 'PACKAGING')}
            productGrid={productGrid}
            stockPerSize={stockPerSize}
            stockGrades={stockGrades}
            orderQuantity={orderQuantity}
            initialPkgId={existing?.pkgId}
            initialBreakdown={existing?.breakdown}
            initialFromStock={existing?.fromStock}
            isDarkMode={isDarkMode}
          />
        );
      })()}

      {gradeModalTarget && (() => {
        const { blockId, variationId, variationName, productId } = gradeModalTarget;
        const product = products.find(p => p.id === productId);
        const existing = gradePerVar[`${blockId}-${variationId}`];
        return (
          <GradeBuilderModal
            isOpen
            onClose={() => setGradeModalTarget(null)}
            onConfirm={breakdown => {
              setGradePerVar(prev => ({ ...prev, [`${blockId}-${variationId}`]: breakdown }));
              setGradeModalTarget(null);
            }}
            productName={product?.name || ''}
            variationName={variationName}
            grids={grids}
            defaultGridId={product?.defaultGridId}
            initialBreakdown={existing}
            isDarkMode={isDarkMode}
          />
        );
      })()}

      {showProductionOrderModal && saleId && (() => {
        const currentSale = sales.find(s => s.id === saleId);
        if (!currentSale) return null;
        return (
          <ProductionOrderModal
            isOpen={showProductionOrderModal}
            onClose={() => setShowProductionOrderModal(false)}
            sale={{ ...currentSale, deliveryDate: deliveryDate ? new Date(deliveryDate).getTime() : currentSale.deliveryDate }}
            products={products}
            grids={grids}
            sectors={sectors}
            existingOrdersCount={productionOrders.length}
            existingLotsCount={lots.length}
            isDarkMode={isDarkMode}
            onConfirm={async (order, newLots, deductions) => {
              await onCreateProductionOrder(order, newLots, deductions);
              setShowProductionOrderModal(false);
            }}
          />
        );
      })()}
    </div>
  );
}

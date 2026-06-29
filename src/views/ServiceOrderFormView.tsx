import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ArrowLeft, Check, CheckCircle2, ClipboardList, DollarSign,
  Info, Loader2, Plus, Search, Share2, Trash2, X,
  Calendar as CalendarIcon, Tag, ChevronDown, ChevronUp, Printer, Eye, Layers
} from 'lucide-react';
import { format } from 'date-fns';
import {
  ServiceOrder, ProductionLot, Product, Sector,
  ProductionOrder, Person, Account, Category, Grid, ViewType
} from '../types';
import { firebaseService } from '../services/firebaseService';
import { financeService } from '../services/financeService';
import { seedServiceOrderSequence } from '../utils/sequenceSeeds';
import { toast } from '../utils/toast';
import ComboBox from '../components/ComboBox';
import DatePicker from '../components/DatePicker';
import PrintOSModal from '../components/PrintOSModal';
import { getOrderEffectiveSector, getSourceItemKey, resolveCorrectSectorForProduct } from '../utils/productionRoute';
import { generatePCPShareExport, PCPShareItem } from '../utils/pcpShareExport';

interface ServiceOrderFormViewProps {
  serviceOrderId?: string | null;
  serviceOrders: ServiceOrder[];
  lots: ProductionLot[];
  products: Product[];
  sectors: Sector[];
  productionOrders: ProductionOrder[];
  people: Person[];
  accounts: Account[];
  categories: Category[];
  isDarkMode: boolean;
  grids: Grid[];
  onBack: () => void;
  onNavigate: (view: ViewType, idOrParams?: any, maybeParams?: any) => void;
  initialParams?: any;
}

interface BasketItem {
  id: string; // unique identifier for the basket row: lotId::orderId::siIdx
  lot: ProductionLot;
  si: any;
  siIdx: number;
  product: Product | undefined;
  variation: any;
  order: ProductionOrder | undefined;
  orderItem: any;
  quantity: number;
  price: number;
}

export default function ServiceOrderFormView({
  serviceOrderId,
  serviceOrders,
  lots,
  products,
  sectors,
  productionOrders,
  people,
  accounts,
  categories,
  isDarkMode,
  grids,
  onBack,
  onNavigate,
  initialParams
}: ServiceOrderFormViewProps) {
  const isEditing = !!serviceOrderId;

  // Existing OS (if editing)
  const existingOS = useMemo(() => {
    if (!serviceOrderId) return null;
    return serviceOrders.find(os => os.id === serviceOrderId) || null;
  }, [serviceOrderId, serviceOrders]);

  // Form Fields
  const [osNumber, setOsNumber] = useState('');
  // Sugestão automática mostrada ao abrir o formulário (apenas cosmética — calculada a
  // partir do que já está em memória). Usada para saber se o usuário editou o número
  // manualmente: se sim, o valor digitado é respeitado; se não, o número definitivo é
  // buscado do contador atômico em handleSave, evitando duplicidade.
  const [autoSuggestedOsNumber, setAutoSuggestedOsNumber] = useState('');
  const [osType, setOsType] = useState<'INTERNAL' | 'OUTSOURCED'>('OUTSOURCED');
  const [sectorId, setSectorId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [providerManualName, setProviderManualName] = useState('');
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const [defaultValuePerPair, setDefaultValuePerPair] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Financial fields
  const [generateTransaction, setGenerateTransaction] = useState(true);
  const [dueDate, setDueDate] = useState<number>(Date.now());
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // Basket State
  const [basket, setBasket] = useState<BasketItem[]>([]);

  // Search & Filtering for Available Orders
  const [searchQuery, setSearchQuery] = useState('');

  // View States
  const [isSaving, setIsSaving] = useState(false);
  const [savedOS, setSavedOS] = useState<ServiceOrder | null>(null);
  const [printOSData, setPrintOSData] = useState<{ os: ServiceOrder; nextSectorName: string } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target as Node)) {
        setIsProviderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize sequential OS number and default dropdowns (when creating)
  useEffect(() => {
    if (isEditing && existingOS) {
      setOsNumber(existingOS.osNumber);
      setOsType(existingOS.type);
      setSectorId(existingOS.sectorId);
      setProviderId(existingOS.providerId || '');
      setProviderManualName(existingOS.providerId ? '' : existingOS.providerName);
      setDefaultValuePerPair(existingOS.valuePerPair);
      setNotes(existingOS.notes || '');
      setGenerateTransaction(!!existingOS.transactionId);

      // Load financial transaction details if present
      if (existingOS.transactionId) {
        firebaseService.getDocument<any>('transactions', existingOS.transactionId)
          .then(tx => {
            if (tx) {
              setAccountId(tx.accountId || '');
              setCategoryId(tx.categoryId || '');
              if (tx.dueDate || tx.date) {
                setDueDate(tx.dueDate || tx.date);
              }
            }
          })
          .catch(err => console.error('Error fetching transaction:', err));
      }

      // Reconstruct Basket Items from OS details
      const osLotIds = existingOS.lotIds || [existingOS.lotId];
      const osSourceOrderIds = existingOS.sourceOrderIds || [];
      const osSourceItemKeys = existingOS.sourceItemKeys || [];
      const itemPrices = existingOS.itemPrices || {};

      const reconstructedBasket: BasketItem[] = [];

      osLotIds.forEach(lId => {
        const lot = lots.find(l => l.id === lId);
        if (!lot) return;
        const sourceItems: any[] = (lot as any).metadata?.sourceItems || [];
        sourceItems.forEach((si, siIdx) => {
          const itemKey = `${lot.id}::${si.orderId}::${siIdx}`;
          const isIncluded = osSourceItemKeys.includes(itemKey) || 
            (osSourceItemKeys.length === 0 && osSourceOrderIds.includes(si.orderId));

          if (isIncluded) {
            const product = products.find(p => p.id === si.productId);
            const variation = product?.variations.find((v: any) => v.id === si.variationId);
            const order = productionOrders.find(o => o.id === si.orderId);
            const orderItem = si.itemIdx !== undefined ? order?.items[si.itemIdx] : order?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
            const price = itemPrices[itemKey] !== undefined ? itemPrices[itemKey] : existingOS.valuePerPair;

            reconstructedBasket.push({
              id: itemKey,
              lot,
              si,
              siIdx,
              product,
              variation,
              order,
              orderItem,
              quantity: si.qty || 0,
              price
            });
          }
        });
      });

      setBasket(reconstructedBasket);
    } else {
      // Creation Mode
      // 1. Generate next OS Number
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
      const suggestedOsNumber = `OS-${String(nextNum).padStart(4, '0')}`;
      setOsNumber(suggestedOsNumber);
      setAutoSuggestedOsNumber(suggestedOsNumber);

      // 2. Set defaults
      const defAccount = accounts.find(a => a.isDefault) || accounts[0];
      setAccountId(defAccount?.id || '');

      const prodCategory = categories.find(c =>
        c.type === 'EXPENSE' &&
        (c.name.toLowerCase().includes('produ') || c.name.toLowerCase().includes('mão') || c.name.toLowerCase().includes('obra') || c.name.toLowerCase().includes('servi'))
      ) || categories.find(c => c.type === 'EXPENSE');
      setCategoryId(prodCategory?.id || '');

      // 3. Apply initial parameters if passed
      if (initialParams) {
        const { sectorId: initSectorId, preselectedLots, orderIds } = initialParams;
        if (initSectorId) {
          setSectorId(initSectorId);
          // Prestador fica sempre em branco ao criar — sem sugestão automática (nem do
          // padrão do setor, nem de "primeiro prestador cadastrado"), pra forçar escolha
          // manual (digitar ou selecionar no combo) em toda nova OS.
          const sectorObj = sectors.find(s => s.id === initSectorId);
          if (sectorObj) {
            if (sectorObj.defaultServiceValue !== undefined) {
              setDefaultValuePerPair(sectorObj.defaultServiceValue);
            }
          }
        }

        // Initialize basket items from initialParams
        if (preselectedLots && preselectedLots.length > 0 && initSectorId) {
          const initialBasket: BasketItem[] = [];
          preselectedLots.forEach((lotIdStr: string) => {
            const lot = lots.find(l => l.id === lotIdStr);
            if (!lot) return;
            const sourceItems: any[] = (lot as any).metadata?.sourceItems || [];
            sourceItems.forEach((si, siIdx) => {
              const effSec = getOrderEffectiveSector(lot, si.orderId, si);
              if (effSec !== initSectorId) return;

              const itemKey = `${lot.id}::${si.orderId}::${siIdx}`;
              if (!orderIds || orderIds.includes(si.orderId) || orderIds.includes(itemKey) || orderIds.includes(`${si.orderId}::${siIdx}`)) {
                const product = products.find(p => p.id === si.productId);
                const variation = product?.variations.find((v: any) => v.id === si.variationId);
                const order = productionOrders.find(o => o.id === si.orderId);
                const orderItem = si.itemIdx !== undefined ? order?.items[si.itemIdx] : order?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
                
                // Determine initial price for this item
                const productSectorPrice = product?.sectorPrices?.[initSectorId];
                const itemPrice = productSectorPrice !== undefined 
                  ? productSectorPrice 
                  : (sectors.find(s => s.id === initSectorId)?.defaultServiceValue || 0);

                initialBasket.push({
                  id: `${lot.id}::${si.orderId}::${siIdx}`,
                  lot,
                  si,
                  siIdx,
                  product,
                  variation,
                  order,
                  orderItem,
                  quantity: si.qty || 0,
                  price: itemPrice
                });
              }
            });
          });

          setBasket(initialBasket);
        }
      }
    }
  }, [isEditing, existingOS, lots, products, sectors, productionOrders, people, accounts, categories, initialParams, serviceOrders]);

  // Handle Sector Change (Updates default values and filters)
  const handleSectorChange = (newSectorId: string) => {
    setSectorId(newSectorId);
    const sectorObj = sectors.find(s => s.id === newSectorId);
    if (sectorObj) {
      if (sectorObj.defaultServiceValue !== undefined) {
        setDefaultValuePerPair(sectorObj.defaultServiceValue);
        // Update basket items that do not have custom override prices
        setBasket(prev => prev.map(item => ({ ...item, price: sectorObj.defaultServiceValue ?? 0 })));
      }
    }
  };

  // Handle Default Price Change (updates price of all items currently in basket unless already changed)
  const handleDefaultPriceChange = (val: number) => {
    setDefaultValuePerPair(val);
    setBasket(prev => prev.map(item => ({ ...item, price: val })));
  };

  // Compile list of available orders (fichas) for the active sector that are not already assigned to a PENDING OS
  const availableOrders = useMemo(() => {
    if (!sectorId) return [];

    const list: { lot: ProductionLot; si: any; siIdx: number; product: Product | undefined; variation: any; order: ProductionOrder | undefined; orderItem: any }[] = [];

    const activeLots = lots.filter(l => !l.finishedAt);
    activeLots.forEach(lot => {
      const sourceItems: any[] = (lot as any).metadata?.sourceItems || [];
      sourceItems.forEach((si, siIdx) => {
        // Effective sector of this item
        const effSec = getOrderEffectiveSector(lot, si.orderId, si);
        if (effSec !== sectorId) return;

        // Check if item is already in basket
        const itemKey = `${lot.id}::${si.orderId}::${siIdx}`;
        if (basket.some(bItem => bItem.id === itemKey)) return;

        // Check if item is already assigned to a PENDING OS in this sector
        const alreadyAssigned = serviceOrders.some(so => {
          if (so.status !== 'PENDING' || so.sectorId !== sectorId) return false;
          const sameLot = so.lotId === lot.id || so.lotIds?.includes(lot.id);
          if (!sameLot) return false;
          
          if (so.sourceItemKeys && so.sourceItemKeys.includes(itemKey)) return true;
          if (so.sourceOrderIds && so.sourceOrderIds.includes(si.orderId)) return true;
          if (!so.sourceOrderIds || so.sourceOrderIds.length === 0) return true; // Lot-level OS covers everything
          return false;
        });

        if (alreadyAssigned) return;

        const product = products.find(p => p.id === si.productId);
        const variation = product?.variations.find((v: any) => v.id === si.variationId);
        const order = productionOrders.find(o => o.id === si.orderId);
        const orderItem = si.itemIdx !== undefined ? order?.items[si.itemIdx] : order?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);

        list.push({
          lot,
          si,
          siIdx,
          product,
          variation,
          order,
          orderItem
        });
      });
    });

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return list.filter(item => {
        const searchStr = `${item.lot.orderNumber} ${item.product?.name || ''} ${item.product?.reference || ''} ${item.variation?.colorName || ''} ${item.order?.customerName || ''}`.toLowerCase();
        return searchStr.includes(q);
      });
    }

    return list;
  }, [sectorId, lots, products, productionOrders, basket, serviceOrders, searchQuery]);

  // Add Item to Basket
  const addToBasket = (item: any) => {
    // Determine initial price for this item
    const productSectorPrice = item.product?.sectorPrices?.[sectorId];
    const itemPrice = productSectorPrice !== undefined 
      ? productSectorPrice 
      : defaultValuePerPair;

    const basketItem: BasketItem = {
      id: `${item.lot.id}::${item.si.orderId}::${item.siIdx}`,
      ...item,
      quantity: item.si.qty || 0,
      price: itemPrice
    };

    setBasket(prev => [...prev, basketItem]);
  };

  // Remove Item from Basket
  const removeFromBasket = (id: string) => {
    setBasket(prev => prev.filter(item => item.id !== id));
  };

  // Update Individual Item Price
  const updateItemPrice = (id: string, price: number) => {
    setBasket(prev => prev.map(item => item.id === id ? { ...item, price } : item));
  };

  // Total Quantity of Pairs in Basket
  const totalQuantity = useMemo(() => {
    return basket.reduce((acc, item) => acc + item.quantity, 0);
  }, [basket]);

  // Total Monetary Value of the OS
  const totalValue = useMemo(() => {
    return basket.reduce((acc, item) => acc + (item.quantity * item.price), 0);
  }, [basket]);

  // Save the Service Order
  const handleSave = async () => {
    if (basket.length === 0) {
      toast.show('A cesta de produção está vazia. Adicione pelo menos um pedido.');
      return;
    }

    const providerName = providerId
      ? (people.find(p => p.id === providerId)?.name || providerManualName)
      : providerManualName;

    if (!providerName.trim()) {
      toast.show('Por favor, selecione ou digite o prestador do serviço.');
      return;
    }

    if (!osNumber.trim()) {
      toast.show('Por favor, insira o número da OS.');
      return;
    }

    if (!sectorId) {
      toast.show('Por favor, selecione o setor.');
      return;
    }

    setIsSaving(true);

    try {
      // Número sugerido era só cosmético (calculado em memória) — se o usuário não editou,
      // busca o número definitivo do contador atômico aqui para evitar duplicidade. Se
      // editou manualmente, respeita o que foi digitado.
      let finalOsNumber = osNumber;
      if (!isEditing && osNumber === autoSuggestedOsNumber) {
        const nextNum = await firebaseService.getNextSequence('serviceOrders', seedServiceOrderSequence);
        finalOsNumber = `OS-${String(nextNum).padStart(4, '0')}`;
      }

      const firstItem = basket[0];
      const lotIds = Array.from(new Set(basket.map(item => item.lot.id)));
      const lotNumbers = Array.from(new Set(basket.map(item => item.lot.orderNumber)));
      const sourceOrderIds = Array.from(new Set(basket.map(item => item.si.orderId)));
      const sourceItemKeys = basket.map(item => item.id);

      // Create itemPrices mapping
      const itemPrices: Record<string, number> = {};
      basket.forEach(item => {
        itemPrices[item.id] = item.price;
      });

      const uniqueId = isEditing && existingOS ? existingOS.id : `os_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      let transactionId = isEditing && existingOS ? existingOS.transactionId : undefined;

      // Handle Financial Transaction
      if (isEditing && transactionId) {
        // Delete old transaction if updating and recreate
        await financeService.deleteTransaction(transactionId);
        transactionId = undefined;
      }

      if (generateTransaction && accountId && categoryId && totalValue > 0) {
        const txId = `tx_os_${uniqueId}`;
        const txData = {
          id: txId,
          type: 'EXPENSE' as const,
          amount: totalValue,
          description: `Mão de Obra - OS ${finalOsNumber} (${lotIds.length === 1 ? `Lote: ${lotNumbers[0]}` : `${lotIds.length} Lotes`} - Setor: ${sectors.find(s => s.id === sectorId)?.name})`,
          accountId,
          categoryId,
          date: Date.now(),
          dueDate: dueDate,
          status: 'PENDING' as const,
          personId: providerId || undefined,
          notes: `OS Número: ${finalOsNumber}\nPrestador: ${providerName}\nSetor: ${sectors.find(s => s.id === sectorId)?.name}\nQuantidade: ${totalQuantity} pares\nItens:\n${basket.map(item => `• Mapa #${item.lot.orderNumber} (${item.product?.reference || item.product?.name}) - ${item.quantity} prs - R$ ${item.price.toFixed(2)}/par`).join('\n')}`
        };

        await financeService.createTransaction(txData);
        transactionId = txId;
      }

      // Prepare Service Order document
      const osData: ServiceOrder = {
        id: uniqueId,
        osNumber: finalOsNumber,
        lotId: firstItem.lot.id,
        lotNumber: firstItem.lot.orderNumber,
        lotIds,
        lotNumbers,
        productId: firstItem.product?.id || '',
        productName: firstItem.product?.name || 'Vários Modelos',
        variationId: firstItem.variation?.id || '',
        variationName: firstItem.variation?.colorName || 'Múltiplas Cores',
        sectorId,
        sectorName: sectors.find(s => s.id === sectorId)?.name || '',
        type: osType,
        providerId: providerId || undefined,
        providerName,
        quantity: totalQuantity,
        valuePerPair: defaultValuePerPair, // default value representer
        totalValue,
        notes,
        status: isEditing && existingOS ? existingOS.status : 'PENDING',
        transactionId,
        createdAt: isEditing && existingOS ? existingOS.createdAt : Date.now(),
        finishedAt: isEditing && existingOS ? existingOS.finishedAt : undefined,
        sourceOrderIds,
        sourceItemKeys,
        itemPrices
      };

      if (isEditing) {
        await firebaseService.updateDocument('serviceOrders', uniqueId, osData);
        toast.show('Ordem de Serviço atualizada com sucesso!');
      } else {
        await firebaseService.saveDocument('serviceOrders', osData);
        toast.show('Ordem de Serviço emitida com sucesso!');
      }

      setSavedOS(osData);
    } catch (e) {
      console.error(e);
      toast.show('Erro ao salvar Ordem de Serviço: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSaving(false);
    }
  };

  // Open Sharing options using generatePCPShareExport
  const handleShare = async (format: 'pdf' | 'jpg') => {
    if (!savedOS) return;

    // Compile items for sharing
    const shareItems: PCPShareItem[] = basket.map(item => {
      // Get exact sizes breakdown from order item
      const sizes = Object.entries(item.orderItem?.sizes || {})
        .map(([sz, sData]: [string, any]) => ({ size: sz, qty: Number(sData.toProduction) || 0 }))
        .filter(s => s.qty > 0)
        .sort((a, b) => parseFloat(a.size) - parseFloat(b.size));

      const secEntries = Object.entries(item.variation?.sectorNotes || {})
        .map(([sid, notes]) => ({ sid, notes: (notes as any[]).filter(n => n.text).map(n => n.text) }))
        .filter(({ notes }) => notes.length > 0)
        .map(({ sid, notes }) => {
          const sName = sectors.find(s => s.id === sid)?.name || 'Setor Desconhecido';
          return { sectorName: sName, notes };
        });

      return {
        orderNumber: item.order?.saleOrderNumber || item.si.orderId.substring(0, 6),
        reference: item.product?.reference || item.product?.name || '---',
        color: item.variation?.colorName || '---',
        totalPairs: item.quantity,
        sizeGrid: sizes,
        sectorNotes: secEntries
      };
    });

    const lotNumbers = Array.from(new Set(basket.map(i => i.lot.orderNumber))).join(', ');

    toast.show('Gerando arquivo de exportação...');
    const result = await generatePCPShareExport({
      lotNumber: lotNumbers,
      items: shareItems,
      additionalNote: `OS: ${savedOS.osNumber} • Prestador: ${savedOS.providerName}\n\nObservações: ${notes}`,
      isDarkMode,
      showTotalGrid: true,
      showItemGrid: true,
      showSectorNotes: true,
      showMaterials: false,
      showOrderList: true
    }, format);

    if (result) {
      toast.show(`${format.toUpperCase()} exportado com sucesso!`);
    }
  };

  // Trigger Print OS modal
  const handlePrint = () => {
    if (!savedOS) return;
    
    // Resolve next sector
    const firstItem = basket[0];
    const osProduct = firstItem?.product;
    const resolved = resolveCorrectSectorForProduct(sectorId, osProduct, sectors);
    const nextSectorName = resolved.isFinished ? 'CONCLUÍDO' : (sectors.find(s => s.id === resolved.sectorId)?.name || resolved.sectorId);

    setPrintOSData({
      os: savedOS,
      nextSectorName
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-32 px-1 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
              isDarkMode
                ? 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">
              {isEditing ? `Editar OS #${existingOS?.osNumber}` : 'Nova Ordem de Serviço'}
            </h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
              Setor de Emissão & Controle de Produção
            </p>
          </div>
        </div>
      </div>

      {savedOS ? (
        /* Success Screen with Sharing Actions */
        <div className={`p-8 rounded-[2rem] border shadow-2xl flex flex-col items-center justify-center max-w-2xl mx-auto w-full gap-6 text-center ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
            <CheckCircle2 size={42} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Ordem de Serviço {isEditing ? 'Atualizada' : 'Emitida'} com Sucesso!
            </h3>
            <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mt-2">
              Número: {savedOS.osNumber} • Qtd: {savedOS.quantity} pares • Total: R$ {savedOS.totalValue.toFixed(2)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-4">
            <button
              onClick={() => handleShare('pdf')}
              className="flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[11px] tracking-wider shadow-lg transition-all active:scale-[0.98]"
            >
              <Share2 size={16} />
              Compartilhar PDF
            </button>
            <button
              onClick={() => handleShare('jpg')}
              className="flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white font-black uppercase text-[11px] tracking-wider shadow-lg transition-all active:scale-[0.98]"
            >
              <Share2 size={16} />
              Compartilhar Imagem (JPG)
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-slate-900 dark:bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-800 dark:hover:bg-slate-700 font-black uppercase text-[11px] tracking-wider transition-all active:scale-[0.98]"
            >
              <Printer size={16} />
              Imprimir Etiqueta / OS
            </button>
            <button
              onClick={onBack}
              className="flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:text-slate-300 font-black uppercase text-[11px] tracking-wider transition-all active:scale-[0.98]"
            >
              Voltar ao PCP
            </button>
          </div>
        </div>
      ) : (
        /* Primary Form Fields */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Config */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className={`p-6 rounded-[2rem] border flex flex-col gap-5 shadow-sm ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                Parâmetros da Ordem de Serviço
              </h3>

              {/* OS Number & Service Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400 px-3 block">
                    Número da OS
                  </label>
                  <input
                    type="text"
                    value={osNumber}
                    onChange={e => setOsNumber(e.target.value)}
                    placeholder="Ex: OS-0001"
                    className={`w-full px-5 py-3.5 rounded-2xl border-2 font-bold text-xs outline-none transition-all ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400 px-3 block">
                    Tipo de Serviço
                  </label>
                  <div className="grid grid-cols-2 gap-2 h-[46px]">
                    <button
                      type="button"
                      onClick={() => setOsType('INTERNAL')}
                      className={`h-full rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        osType === 'INTERNAL'
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                          : isDarkMode
                            ? 'bg-slate-950 text-slate-500 border border-slate-800 hover:text-slate-200'
                            : 'bg-slate-50 text-slate-400 border border-slate-100 hover:text-slate-800'
                      }`}
                    >
                      Interno
                    </button>
                    <button
                      type="button"
                      onClick={() => setOsType('OUTSOURCED')}
                      className={`h-full rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        osType === 'OUTSOURCED'
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                          : isDarkMode
                            ? 'bg-slate-950 text-slate-500 border border-slate-800 hover:text-slate-200'
                            : 'bg-slate-50 text-slate-400 border border-slate-100 hover:text-slate-800'
                      }`}
                    >
                      Terceirizado
                    </button>
                  </div>
                </div>
              </div>

              {/* Target Sector */}
              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400 px-3 block">
                  Setor da Produção
                </label>
                <ComboBox
                  options={sectors.map(s => ({ id: s.id || '', name: s.name }))}
                  value={sectorId}
                  onChange={handleSectorChange}
                  placeholder="Selecionar setor..."
                  isDarkMode={isDarkMode}
                  icon={<Layers size={18} />}
                />
              </div>

              {/* Provider Selection — digite livremente (sugestão/filtro dos prestadores
                  cadastrados) ou clique numa sugestão para selecionar um já existente */}
              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400 px-3 block">
                  Prestador do Serviço
                </label>
                <div className="relative" ref={providerDropdownRef}>
                  <div className={`w-full flex items-center bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl pl-12 pr-0 py-1 focus-within:border-indigo-500 transition-all ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <ClipboardList size={18} />
                    </div>
                    <input
                      type="text"
                      value={providerId ? (people.find(p => p.id === providerId)?.name || '') : providerManualName}
                      onChange={e => {
                        setProviderId('');
                        setProviderManualName(e.target.value);
                        setIsProviderDropdownOpen(true);
                      }}
                      onFocus={() => setIsProviderDropdownOpen(true)}
                      placeholder="Digite o nome do prestador..."
                      className="flex-1 bg-transparent border-none outline-none text-[13px] font-black uppercase tracking-widest py-3 min-w-0"
                    />
                  </div>

                  {isProviderDropdownOpen && (() => {
                    const term = (providerId ? '' : providerManualName).toLowerCase();
                    const suggestions = people
                      .filter(p => p.isSupplier || p.isServiceProvider)
                      .filter(p => p.name.toLowerCase().includes(term));
                    return (
                      <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto">
                        {suggestions.length > 0 ? (
                          suggestions.map(p => (
                            <div
                              key={p.id}
                              className={`px-5 py-4 text-[13px] font-bold uppercase cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-indigo-50 ${providerId === p.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}
                              onClick={() => {
                                setProviderId(p.id || '');
                                setProviderManualName('');
                                setIsProviderDropdownOpen(false);
                              }}
                            >
                              {p.name}
                            </div>
                          ))
                        ) : (
                          <div className="px-5 py-3 text-[12px] text-slate-400 italic">Nenhum prestador cadastrado com esse nome — será salvo como digitado</div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Value per pair & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2 sm:col-span-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400 px-3 block">
                    Valor por Par Padrão (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={defaultValuePerPair || ''}
                    onChange={e => handleDefaultPriceChange(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    className={`w-full px-5 py-3.5 rounded-2xl border-2 font-bold text-xs outline-none transition-all ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-500'
                    }`}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400 px-3 block">
                    Anotações / Instruções
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Observações especiais sobre a fabricação..."
                    rows={1}
                    className={`w-full px-5 py-3 rounded-2xl border-2 font-bold text-xs outline-none resize-none transition-all ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>

              {/* Lançamento Financeiro (Accounting / Non-accounting Toggle) */}
              <div className="relative mt-2">
                <label className="text-[9px] uppercase font-black text-slate-700 dark:text-slate-400 px-3 mb-2 block tracking-widest leading-none">
                  Lançamento Financeiro
                </label>
                <div className={`p-1.5 rounded-2xl border flex items-center gap-2 transition-all ${generateTransaction ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900/50' : 'bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700'}`}>
                  <button
                    type="button"
                    onClick={() => setGenerateTransaction(true)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${generateTransaction ? "bg-white dark:bg-slate-700 shadow-lg text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`}
                    aria-label="Gerar transação contábil"
                    title="Contábil"
                  >
                    <div className={`w-2 h-2 rounded-full ${generateTransaction ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`} />
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

              {/* Financial detail fields (visible only when Contábil is active) */}
              {generateTransaction && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400 px-3 block">
                      Vencimento
                    </label>
                    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-amber-900/30 text-amber-500' : 'bg-amber-50 text-amber-600'}`}>
                        <CalendarIcon size={16} strokeWidth={2.5} />
                      </div>
                      <DatePicker
                        raw
                        value={dueDate ? format(dueDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")}
                        onChange={(val) => setDueDate(new Date(val).getTime() || Date.now())}
                        className={`w-full bg-transparent border-none p-0 text-xs font-bold focus:ring-0 outline-none text-left cursor-pointer ${isDarkMode ? 'text-white' : 'text-slate-800'}`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400 px-3 block">
                      Conta Financeira (Débito)
                    </label>
                    <ComboBox
                      options={accounts.map(acc => ({ id: acc.id || '', name: acc.name }))}
                      value={accountId}
                      onChange={setAccountId}
                      placeholder="Selecionar conta..."
                      isDarkMode={isDarkMode}
                      icon={<DollarSign size={18} />}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400 px-3 block">
                      Categoria de Despesa
                    </label>
                    <ComboBox
                      options={categories.filter(c => c.type === 'EXPENSE').map(c => ({ id: c.id || '', name: c.name }))}
                      value={categoryId}
                      onChange={setCategoryId}
                      placeholder="Selecionar categoria..."
                      isDarkMode={isDarkMode}
                      icon={<Tag size={18} />}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                  isDarkMode
                    ? 'border-slate-800 text-slate-400 hover:bg-slate-900 bg-slate-900/30'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 bg-white'
                }`}
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className={`flex-[2] py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all ${
                  isSaving
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600 shadow-none'
                    : 'bg-indigo-600 text-white shadow-indigo-600/10 hover:bg-indigo-700 hover:scale-[1.01] active:scale-95'
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Salvando OS...
                  </>
                ) : (
                  <>
                    <Check size={14} strokeWidth={3} />
                    {isEditing ? 'Salvar Alterações' : 'Emitir Ordem de Serviço'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Available Orders & OS Basket */}
          <div className="flex flex-col gap-6">
            {/* Basket (OS Production List) */}
            <div className={`p-6 rounded-[2rem] border flex flex-col gap-4 shadow-sm relative overflow-hidden ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Lista de Produção da OS
                </h3>
                <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full uppercase">
                  {basket.length} {basket.length === 1 ? 'pedido' : 'pedidos'}
                </span>
              </div>

              {basket.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                    <ClipboardList size={18} />
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    Cesta Vazia
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-slate-600 max-w-[200px]">
                    Selecione o setor e adicione pedidos ao lado para iniciar a OS.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
                  {basket.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                        isDarkMode ? 'bg-slate-950 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                            Mapa #{item.lot.orderNumber} • {item.order?.customerName || 'Sem Cliente'}
                          </span>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {item.product?.reference || '---'} · {item.product?.name || 'Sem Nome'}
                          </h4>
                          <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">
                            Cor: {item.variation?.colorName || '---'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromBasket(item.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-rose-500/10 text-rose-500 shrink-0 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2 mt-1">
                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase">
                          Qtd: {item.quantity} prs
                        </span>
                        
                        {/* Editable Price per pair */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            R$/par:
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.price}
                            onChange={(e) => updateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                            className={`w-16 px-2 py-1 border rounded-lg text-[11px] font-bold text-right outline-none ${
                              isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Basket Totalizers */}
              {basket.length > 0 && (
                <div className={`p-4 rounded-2xl border flex flex-col gap-1.5 mt-2 ${
                  isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/60'
                }`}>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wide">
                    <span>Total de Pares:</span>
                    <span className="font-black text-slate-900 dark:text-white">{totalQuantity} prs</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-black uppercase text-emerald-600 dark:text-emerald-400">
                    <span>Valor da OS:</span>
                    <span>R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Selector (Available Sector Orders) */}
            <div className={`p-6 rounded-[2rem] border flex flex-col gap-4 shadow-sm relative overflow-hidden ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Pedidos Disponíveis no Setor
                </h3>
              </div>

              {!sectorId ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                    <Layers size={18} />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Nenhum Setor Selecionado
                  </p>
                  <p className="text-[8px] text-slate-400 dark:text-slate-600 max-w-[200px]">
                    Escolha um setor de produção na coluna da esquerda para listar os pedidos pendentes.
                  </p>
                </div>
              ) : (
                <>
                  {/* Search Bar */}
                  <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border-2 transition-all ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 focus-within:border-indigo-500' : 'bg-slate-50 border-slate-100 focus-within:border-indigo-500'
                  }`}>
                    <Search size={14} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Buscar por lote, modelo ou cliente..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent border-none p-0 text-xs font-semibold placeholder-slate-400 outline-none text-slate-900 dark:text-white focus:ring-0"
                    />
                  </div>

                  {availableOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                        Nenhum pedido encontrado
                      </p>
                      <p className="text-[8px] text-slate-400 dark:text-slate-600 max-w-[200px]">
                        Não há pedidos de produção pendentes nesta etapa ou todos já foram vinculados a uma OS.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                      {availableOrders.map((item, idx) => {
                        const itemKey = `${item.lot.id}::${item.si.orderId}::${item.siIdx}`;
                        return (
                          <div
                            key={itemKey}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                              isDarkMode ? 'bg-slate-950 border-slate-850 hover:bg-slate-950' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                                Mapa #{item.lot.orderNumber} • Qtd: {item.si.qty || 0} prs
                              </span>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                {item.product?.reference || '---'} · {item.product?.name || 'Sem Nome'}
                              </h4>
                              <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate">
                                Cliente: {item.order?.customerName || 'Sem Cliente'} • Cor: {item.variation?.colorName || '---'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => addToBasket(item)}
                              className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95 shrink-0 transition-all"
                            >
                              <Plus size={14} strokeWidth={3} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printing Modal Integration */}
      {printOSData && (
        <PrintOSModal
          isOpen={!!printOSData}
          onClose={() => setPrintOSData(null)}
          os={printOSData.os}
          nextSectorName={printOSData.nextSectorName}
          isDarkMode={isDarkMode}
          product={products.find(p => p.id === printOSData.os.productId)}
          grids={grids}
          lot={lots.find(l => l.id === printOSData.os.lotId)}
        />
      )}
    </div>
  );
}

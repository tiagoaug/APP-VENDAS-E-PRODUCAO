import { useState, useMemo } from 'react';
import { Sale, SaleType, PaymentStatus, Product, Grid, SaleStatus, Person, PaymentMethod, Account, PaymentTerm, ProductionOrder, ProductionLot, Sector, AppModulesConfig } from '../types';
import { ShoppingBag, TrendingUp, User, Calendar, Tag, Filter, Plus, Hash, Clock, CheckCircle2, AlertCircle, MoreVertical, Edit2, Trash2, X, Info, Box, Ban, RotateCcw, Search, MessageSquare, Copy, Share, Share2, DollarSign, History, FileText, Lightbulb, Eye, EyeOff, Maximize2, Minimize2, Check, ChevronDown, ChevronUp, Factory } from 'lucide-react';
import ProductionOrderModal from '../components/ProductionOrderModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { exportSale } from '../utils/saleExport';
import ExportNoteModal from '../components/ExportNoteModal';
import SalePaymentModal from '../components/SalePaymentModal';
import ConfirmDialog from '../components/ConfirmDialog';

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
  onConvert: (id: string) => void;
  onUpdatePaymentStatus: (id: string, status: PaymentStatus) => void;
  onPaySale: (saleId: string, amount: number, accountId: string, paymentMethodId: string, note: string) => Promise<void>;
  onUpdatePayment: (saleId: string, paymentId: string, amount: number, accountId: string, paymentMethodId: string, note: string) => Promise<void>;
  onDeletePayment: (saleId: string, paymentId: string) => Promise<void>;
  onCreateProductionOrder: (order: ProductionOrder, lots: ProductionLot[], deductions: { productId: string; variationId: string; size?: string; quantity: number }[]) => Promise<void>;
  modulesConfig: AppModulesConfig;
  isDarkMode: boolean;
  initialSearchQuery?: string;
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
  onConvert,
  onUpdatePaymentStatus,
  onPaySale,
  onUpdatePayment,
  onDeletePayment,
  onCreateProductionOrder,
  modulesConfig,
  isDarkMode,
  initialSearchQuery = ''
}: SalesViewProps) {
  const hasProduction = modulesConfig.production;
  const [filter, setFilter] = useState<'ALL' | 'RETAIL' | 'WHOLESALE'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedStatuses, setSelectedStatuses] = useState<SaleStatus[]>([SaleStatus.SALE, SaleStatus.QUOTE]);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCards, setExpandedCards] = useState(false);
  const [showProducts, setShowProducts] = useState(true);
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
      alert('Erro ao exportar venda.');
    }
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filter !== 'ALL') count++;
    if (paymentFilter !== 'ALL') count++;
    const defaultStatuses = [SaleStatus.SALE, SaleStatus.QUOTE];
    const isDefaultStatuses = selectedStatuses.length === defaultStatuses.length && 
                              defaultStatuses.every(s => selectedStatuses.includes(s));
    if (!isDefaultStatuses) count++;
    return count;
  }, [filter, paymentFilter, selectedStatuses]);

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

    const statusText = sale.status === SaleStatus.QUOTE ? 'Orçamento' : 'Pedido';
    const discountText = sale.discount > 0 ? `\n📉 *Desconto:* R$ ${sale.discount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';

    return `Olá ${customer?.name || sale.customerName || 'Cliente'}!\n\nSeu ${statusText} #${sale.orderNumber}.\n\n*ITENS:*\n${itemsText}\n\n------------------\n💰 *Subtotal:* R$ ${sale.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${discountText}\n💎 *TOTAL: R$ ${sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*\n------------------\nStatus: ${statusText}${paymentInfo}\n\nAguardamos sua confirmação!`;
  };

  const handleCopyMessage = (sale: Sale) => {
    const message = generateMessage(sale);
    navigator.clipboard.writeText(message);
    alert('Mensagem copiada!');
  };

  const handleShareWhatsApp = (sale: Sale, customMessage?: string) => {
    const customer = people.find(p => p.id === sale.customerId);
    if (!customer?.phone && !customMessage) {
      alert('Cliente sem telefone cadastrado.');
    }
    
    if (whatsappMode === 'MANUAL' && !customMessage) {
      setEditingMessage({ sale, text: generateMessage(sale) });
      return;
    }

    const message = customMessage || generateMessage(sale);
    const encodedMessage = encodeURIComponent(message);
    const phone = customer?.phone?.replace(/\D/g, '') || '';
    
    if (!phone) {
      alert('Não é possível abrir o WhatsApp: Cliente não possui telefone cadastrado.');
      return;
    }

    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
    if (customMessage) setEditingMessage(null);
  };

  return (
    <div className="flex flex-col gap-6 h-full pb-44 px-1 overflow-y-auto overflow-x-hidden force-scrollbar">
      <ConfirmDialog
        isOpen={!!saleToDelete}
        title="Excluir Registro?"
        message="Deseja realmente excluir esta venda e reverter os lançamentos financeiros/estoque? Esta ação não pode ser desfeita."
        confirmLabel="Sim, Excluir"
        cancelLabel="Agora não"
        onConfirm={() => {
          if (saleToDelete) {
            onDelete(saleToDelete);
            setSaleToDelete(null);
          }
        }}
        onCancel={() => setSaleToDelete(null)}
        isDanger={true}
      />
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-[13px] font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Vendas</h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold tracking-widest leading-none">Relatórios</p>
          </div>
          <button 
            onClick={() => setShowFilters(true)}
            className={`h-11 px-5 rounded-2xl flex items-center gap-3 transition-all duration-300 relative ${showFilters ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40' : isDarkMode ? 'bg-slate-900 text-slate-400 hover:text-indigo-400' : 'bg-white text-slate-400 border border-slate-100 shadow-sm hover:text-indigo-500'}`}
            title="Configurações e Filtros"
          >
            <div className="relative">
              <Filter size={18} strokeWidth={2.5} />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-3 -right-3 w-5 h-5 bg-orange-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-in zoom-in">
                  {activeFiltersCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-black tracking-[0.2em]">Configurar</span>
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
                {([SaleStatus.SALE, SaleStatus.QUOTE, SaleStatus.CANCELLED] as const).map((s) => {
                  const active = selectedStatuses.includes(s);
                  const label = s === SaleStatus.SALE ? 'Venda' : s === SaleStatus.QUOTE ? 'Orçamento' : 'Cancelado';
                  const color = s === SaleStatus.SALE ? (active ? 'bg-indigo-600 text-white' : '') : s === SaleStatus.QUOTE ? (active ? 'bg-amber-500 text-white' : '') : (active ? 'bg-rose-500 text-white' : '');
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
            </div>

            <button
              onClick={() => { setFilter('ALL'); setPaymentFilter('ALL'); setSelectedStatuses([SaleStatus.SALE, SaleStatus.QUOTE]); setExpandedCards(false); setShowProducts(true); }}
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
                  <button 
                    onClick={() => setSelectedSale(sale)}
                    title="Ver Detalhes do Pedido"
                    aria-label={`Ver detalhes do pedido de ${sale.customerName || 'Cliente'}`}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer transition-all hover:scale-110 shrink-0 shadow-lg ${
                      sale.status === SaleStatus.QUOTE 
                        ? 'bg-amber-500 text-white shadow-amber-200' 
                        : 'bg-indigo-600 text-white shadow-indigo-200'
                    }`}
                  >
                    <ShoppingBag size={28} strokeWidth={2.5} />
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-black text-base tracking-tight leading-none truncate ${sale.status === SaleStatus.CANCELLED ? 'text-slate-500' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {sale.saleDestination === 'STOCK' ? 'Estoque' : (sale.customerName || 'Cliente')}
                      </h3>
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
                  ) : sale.status === 'QUOTE' ? (
                    <span className="text-[10px] font-black px-2 py-1 rounded-lg leading-none tracking-widest shadow-sm bg-orange-500 text-white">
                      Orçamento
                    </span>
                  ) : (
                    <span className="text-[10px] font-black px-2 py-1 rounded-lg leading-none tracking-widest shadow-sm bg-[#7c3aed] text-white">
                      Venda
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

              {/* Content Row: Items Preview & Large Price */}
              {isExpanded && (
                <div className={`flex ${sale.status === SaleStatus.QUOTE ? 'flex-col' : 'justify-between items-start'} z-10 gap-4`}>
                  {/* Items List (Left/Top) */}
                  {showProducts ? (
                    <button 
                      onClick={() => setSelectedSale(sale)}
                      title="Ver Detalhes"
                      aria-label="Ver detalhes dos itens do pedido"
                      className="flex-1 flex flex-col gap-3 cursor-pointer min-w-0 text-left"
                    >
                      {sale.items.slice(0, 3).map((item, idx) => {
                        const product = getProductInfo(item.productId);
                        const variation = getVariationInfo(item.productId, item.variationId);
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                               <Tag size={12} className={sale.status === SaleStatus.CANCELLED ? 'text-slate-600' : 'text-indigo-500'} strokeWidth={3} />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[11px] font-black leading-none tracking-tight truncate ${sale.status === SaleStatus.CANCELLED ? 'text-slate-500' : isDarkMode ? 'text-slate-300' : 'text-slate-400'}`}>
                                {product?.reference || '---'} {product?.name}
                              </p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold mt-1.5 tracking-widest">
                                {variation?.colorName} • <span className="text-indigo-500 dark:text-indigo-400">{item.quantity} {item.saleType === SaleType.WHOLESALE ? 'Grades' : 'Pares'}</span>
                              </p>
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
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSaleToDelete(sale.id); setActiveMenuId(null); }}
                            className="w-full px-4 py-3 text-[10px] font-bold tracking-widest flex items-center gap-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 size={14} /> Excluir
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
        title={exportModal.sale?.status === SaleStatus.QUOTE ? "Exportar Orçamento" : "Exportar Venda"}
      />

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

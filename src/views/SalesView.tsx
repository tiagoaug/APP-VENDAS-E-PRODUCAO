import { useState, useMemo } from 'react';
import { Sale, SaleType, PaymentStatus, Product, Grid, SaleStatus, Person, PaymentMethod, Account, PaymentTerm } from '../types';
import { ShoppingBag, TrendingUp, User, Calendar, Tag, Filter, Plus, Hash, Clock, CheckCircle2, AlertCircle, MoreVertical, Edit2, Trash2, X, Info, Box, Ban, RotateCcw, Search, MessageSquare, Copy, Share, DollarSign, History, FileText, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SalePaymentModal from '../components/SalePaymentModal';

interface SalesViewProps {
  sales: Sale[];
  products: Product[];
  grids: Grid[];
  people: Person[];
  paymentMethods: PaymentMethod[];
  accounts: Account[];
  onAdd: () => void;
  onEdit: (sale: Sale) => void;
  onDelete: (id: string) => void;
  onCancelOnly: (id: string) => void;
  onConvert: (id: string) => void;
  onUpdatePaymentStatus: (id: string, status: PaymentStatus) => void;
  onPaySale: (saleId: string, amount: number, accountId: string, paymentMethodId: string, note: string) => Promise<void>;
  onUpdatePayment: (saleId: string, paymentId: string, amount: number, accountId: string, paymentMethodId: string, note: string) => Promise<void>;
  onDeletePayment: (saleId: string, paymentId: string) => Promise<void>;
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
  onAdd, 
  onEdit, 
  onDelete, 
  onCancelOnly, 
  onConvert, 
  onUpdatePaymentStatus, 
  onPaySale,
  onUpdatePayment,
  onDeletePayment,
  isDarkMode,
  initialSearchQuery = ''
}: SalesViewProps) {
  const [filter, setFilter] = useState<'ALL' | 'RETAIL' | 'WHOLESALE'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedStatuses, setSelectedStatuses] = useState<SaleStatus[]>([SaleStatus.SALE, SaleStatus.QUOTE]);
  const [showFilters, setShowFilters] = useState(false);
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [paymentModalSale, setPaymentModalSale] = useState<Sale | null>(null);
  const [paymentModalMode, setPaymentModalMode] = useState<'PAYMENT' | 'HISTORY'>('PAYMENT');
  const [whatsappMode, setWhatsappMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [editingMessage, setEditingMessage] = useState<{ sale: Sale, text: string } | null>(null);
  const [noteModal, setNoteModal] = useState<{ isOpen: boolean, note: string } | null>(null);

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
        const hasType = s.items.some(item => item.saleType === filter);
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
        const matchesName = s.customerName?.toLowerCase().includes(query);
        const matchesId = s.orderNumber?.toLowerCase().includes(query);
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

    const statusText = sale.status === SaleStatus.QUOTE ? 'ORÇAMENTO' : 'PEDIDO';
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
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
    if (customMessage) setEditingMessage(null);
  };

  return (
    <div className="flex flex-col gap-6 h-full pb-44 px-1 overflow-y-auto force-scrollbar">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-[13px] font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Vendas</h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">Relatórios</p>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <div className={`flex border p-0.5 rounded-xl shadow-sm dark:shadow-none ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${showFilters ? 'bg-orange-600 dark:bg-orange-600 text-white shadow-lg shadow-orange-600/40 animate-pulse' : 'text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 active:scale-95'}`}
                  title="Filtrar Vendas"
                  aria-label={showFilters ? "Fechar filtros" : "Abrir filtros"}
                >
                  <Filter size={16} strokeWidth={2.5} />
                </button>
              </div>
              
              <div className={`flex border p-0.5 rounded-xl shadow-sm dark:shadow-none ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                {(['ALL', 'RETAIL', 'WHOLESALE'] as const).map(f => (
                  <button 
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center justify-center ${filter === f ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    title={f === 'ALL' ? "Todas as Vendas" : f === 'RETAIL' ? "Vendas Varejo" : "Vendas Atacado"}
                    aria-label={f === 'ALL' ? "Mostrar todas as vendas" : f === 'RETAIL' ? "Mostrar apenas varejo" : "Mostrar apenas atacado"}
                  >
                    {f === 'ALL' ? <Box size={14} /> : f === 'RETAIL' ? 'Varejo' : 'Atacado'}
                  </button>
                ))}
              </div>
            </div>

            <div className={`flex border p-0.5 rounded-xl shadow-sm dark:shadow-none ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              {(['ALL', 'PENDING', 'PAID'] as const).map(f => (
                <button 
                  key={f}
                  onClick={() => setPaymentFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center justify-center ${paymentFilter === f ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title={f === 'ALL' ? "Todos os Pagamentos" : f === 'PENDING' ? "Pagamentos Pendentes" : "Pagamentos Concluídos"}
                  aria-label={f === 'ALL' ? "Mostrar todos os status de pagamento" : f === 'PENDING' ? "Mostrar apenas pendentes" : "Mostrar apenas concluídos"}
                >
                  {f === 'ALL' ? 'Todos' : f === 'PENDING' ? 'Pendente' : 'Concluído'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search and Advanced Filters */}
        <div className={`flex flex-col gap-4 overflow-hidden transition-all duration-300 ${showFilters || searchQuery ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 mb-[-1.5rem]'}`}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} strokeWidth={2.5} />
            <input 
              type="text"
              placeholder="Pesquisar por nome do cliente ou Nº do pedido..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              title="Pesquisar Vendas"
              aria-label="Campo de pesquisa de vendas"
              className={`w-full h-14 pl-12 pr-4 rounded-2xl border text-[11px] font-bold uppercase tracking-widest transition-all outline-none focus:ring-2 focus:ring-indigo-600/20 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-100 text-slate-800 placeholder:text-slate-300'}`}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                title="Limpar Pesquisa"
                aria-label="Limpar campo de pesquisa"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: SaleStatus.SALE, label: 'Vendas', color: 'indigo' },
              { id: SaleStatus.QUOTE, label: 'Orçamentos', color: 'amber' },
              { id: SaleStatus.CANCELLED, label: 'Cancelados', color: 'rose' }
            ].map(status => {
              const isActive = selectedStatuses.includes(status.id);
              return (
                <button
                  key={status.id}
                  onClick={() => {
                    if (isActive) {
                      setSelectedStatuses(selectedStatuses.filter(s => s !== status.id));
                    } else {
                      setSelectedStatuses([...selectedStatuses, status.id]);
                    }
                  }}
                  title={`Filtrar por ${status.label}`}
                  aria-label={`${isActive ? 'Remover' : 'Incluir'} ${status.label} no filtro`}
                  className={`flex-none px-4 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm ${
                    isActive 
                      ? status.id === SaleStatus.SALE ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-200' :
                        status.id === SaleStatus.QUOTE ? 'bg-amber-500 border-amber-500 text-white shadow-amber-200' :
                        'bg-slate-900 border-slate-900 text-white shadow-slate-200'
                      : isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-100 text-slate-400'
                  } ${!isActive && 'dark:shadow-none'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : status.id === SaleStatus.SALE ? 'bg-indigo-600' : status.id === SaleStatus.QUOTE ? 'bg-amber-500' : 'bg-slate-900'}`} />
                  {status.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredSales.map((sale) => {
          const totalPaid = (sale.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
          const remaining = Math.max(0, sale.total - totalPaid);
          const hasPartialPayment = totalPaid > 0 && remaining > 0;

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
                  <div 
                    onClick={() => setSelectedSale(sale)}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer transition-all hover:scale-110 shrink-0 shadow-lg ${
                      sale.status === SaleStatus.QUOTE 
                        ? 'bg-amber-500 text-white shadow-amber-200' 
                        : 'bg-indigo-600 text-white shadow-indigo-200'
                    }`}
                  >
                    <ShoppingBag size={28} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <h3 className={`font-black text-base tracking-tight leading-none uppercase truncate mb-2 ${sale.status === SaleStatus.CANCELLED ? 'text-slate-500' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {sale.customerName || 'Cliente'}
                    </h3>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">
                        <Calendar size={12} strokeWidth={3} />
                        {format(sale.date, "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-indigo-500 dark:text-indigo-400 font-black uppercase tracking-widest">
                        <Hash size={12} strokeWidth={3} />
                        #{sale.orderNumber}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {sale.sellerName && (
                    <span className="text-[8px] font-black uppercase px-3 py-1 rounded-lg leading-none tracking-widest bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
                      {sale.sellerName}
                    </span>
                  )}
                  {sale.status === SaleStatus.SALE && sale.paymentStatus === PaymentStatus.PENDING && sale.dueDate && (
                    <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-lg leading-none tracking-widest flex items-center gap-1.5 shadow-lg ${
                      new Date(sale.dueDate) < new Date() 
                        ? 'bg-rose-600 text-white shadow-rose-500/20 animate-pulse-vencimento' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-slate-500/10'
                    }`}>
                      VENC. DATA {format(sale.dueDate, "dd/MM", { locale: ptBR })}
                    </span>
                  )}
                  {sale.status === SaleStatus.CANCELLED ? (
                    <span className="text-[8px] font-black uppercase px-3 py-1 rounded-lg leading-none tracking-widest bg-slate-900 text-rose-500 border border-rose-500/20 shadow-lg shadow-rose-500/10">
                       CANCELADA
                    </span>
                  ) : sale.status === 'QUOTE' ? (
                    <span className="text-[8px] font-black uppercase px-3 py-1 rounded-lg leading-none tracking-widest shadow-lg bg-orange-500 text-white shadow-orange-500/20">
                      ORÇAMENTO
                    </span>
                  ) : (
                    <>
                      <span className="text-[8px] font-black uppercase px-3 py-1 rounded-lg leading-none tracking-widest shadow-lg bg-[#7c3aed] text-white shadow-violet-500/20">
                        VENDA
                      </span>
                      <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-lg leading-none tracking-widest shadow-lg ${
                        sale.paymentStatus === PaymentStatus.PAID 
                          ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
                          : 'bg-amber-500 text-white shadow-amber-500/20'
                      }`}>
                        {sale.paymentStatus === PaymentStatus.PAID ? 'QUITADA' : 'PENDENTE'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Content Row: Items Preview & Large Price */}
              <div className="flex justify-between items-start z-10 gap-3">
                {/* Items List (Left) */}
                <div 
                  onClick={() => setSelectedSale(sale)}
                  className="flex-1 flex flex-col gap-3 cursor-pointer"
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
                          <p className={`text-[10px] font-black uppercase leading-none tracking-tight truncate ${sale.status === SaleStatus.CANCELLED ? 'text-slate-500' : isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                            {product?.reference || '---'} {product?.name}
                          </p>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-1.5 uppercase tracking-widest">
                            {variation?.colorName} • <span className="text-indigo-500 dark:text-indigo-400">{item.quantity} {item.saleType === SaleType.WHOLESALE ? 'Grades' : 'Pares'}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {sale.items.length > 3 && (
                    <span className="text-[9px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-[0.2em] italic ml-11">+{sale.items.length - 3} outros</span>
                  )}
                </div>

                {/* Price Display (Right) */}
                <div className="flex flex-col items-end shrink-0 justify-end min-w-[120px]">
                   {remaining > 0 && sale.status === SaleStatus.SALE && (
                      <p className="text-[8px] font-black text-rose-500 uppercase tracking-tight mb-1">Saldo R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                   )}
                   <p className={`text-xl font-black tracking-tighter leading-tight ${sale.status === SaleStatus.CANCELLED ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                      R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </p>
                   <div className="flex gap-1 mt-2">
                      {Array.from(new Set(sale.items.map(i => i.saleType))).map((type, idx) => (
                        <span key={idx} className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md leading-none tracking-widest ${type === SaleType.WHOLESALE ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                          {type === SaleType.WHOLESALE ? 'AT' : 'VR'}
                        </span>
                      ))}
                   </div>
                </div>
              </div>

              {/* Action Bar (Footer) */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800/50 z-10">
                <div className="flex items-center">
                  {/* Note Modal Toggle */}
                  {sale.notes && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setNoteModal({ isOpen: true, note: sale.notes || "" });
                      }}
                      className="w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-90 relative bg-[#fffbeb] text-rose-500 shadow-xl shadow-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:shadow-none"
                    >
                      <Lightbulb size={24} strokeWidth={2.5} className="animate-pulse-lamp" />
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 border-2 border-white dark:border-slate-900 rounded-full" />
                    </button>
                  )}
                </div>

                {/* Actions Group (Floating Island) */}
                <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-slate-50/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 shadow-sm backdrop-blur-md relative">
                  {/* Copy Button */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleCopyMessage(sale); }}
                    className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 text-purple-500 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90"
                    title="Copiar Texto"
                  >
                    <Copy size={18} />
                  </button>

                  {/* WhatsApp Button */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleShareWhatsApp(sale); }}
                    className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 text-emerald-500 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90"
                    title="WhatsApp"
                  >
                    <MessageSquare size={18} />
                  </button>

                  {/* Dynamic Action: Payment/History or Convert */}
                  {sale.status === SaleStatus.QUOTE ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onConvert(sale.id); }}
                      className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 text-indigo-500 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90"
                      title="Confirmar Venda"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  ) : (
                    totalPaid >= sale.total ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPaymentModalMode('HISTORY');
                          setPaymentModalSale(sale);
                        }}
                        className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 text-amber-500 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90"
                        title="Histórico"
                      >
                        <RotateCcw size={18} />
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setPaymentModalMode('PAYMENT');
                          setPaymentModalSale(sale);
                        }}
                        className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 text-emerald-500 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90"
                        title="Pagamento"
                      >
                        <DollarSign size={18} />
                      </button>
                    )
                  )}

                  {/* Edit Button */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(sale); }}
                    className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 text-blue-500 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>

                  {/* More Options Button */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowOptionsId(showOptionsId === sale.id ? null : sale.id); }}
                    className={`w-10 h-10 flex items-center justify-center rounded-full shadow-sm transition-all active:scale-90 ${showOptionsId === sale.id ? 'bg-slate-900 text-white' : 'bg-white dark:bg-slate-700 text-slate-400'}`}
                    title="Mais"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {/* Context Menu for More Options */}
                  {showOptionsId === sale.id && (
                    <div className="absolute right-0 bottom-full mb-3 z-50 min-w-[180px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <div className="p-3 border-b border-slate-50 dark:border-slate-700/50">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ações Extra</p>
                      </div>
                      <div className="p-1.5">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSaleToDelete(sale.id); setShowOptionsId(null); }}
                          className="w-full flex items-center gap-2.5 p-3 text-left text-[10px] font-black uppercase text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                        >
                          <Trash2 size={14} /> Excluir Registro
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Subtle background decoration */}
              <div className="absolute -right-8 -bottom-8 opacity-[0.03] dark:opacity-10 text-slate-900 dark:text-white pointer-events-none group-hover:scale-125 transition-transform duration-700">
                <ShoppingBag size={180} strokeWidth={1} />
              </div>
            </div>
          );
        })}

        {filteredSales.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-200 dark:text-slate-800">
             <TrendingUp size={64} strokeWidth={1} className="mb-4" />
             <p className="text-[10px] font-black uppercase tracking-widest italic">Sem registro de vendas</p>
          </div>
        )}
      </div>

      <button 
        onClick={onAdd}
        title="Nova Venda"
        aria-label="Criar nova venda"
        className={`fixed bottom-32 right-6 w-14 h-14 bg-slate-900 dark:bg-indigo-600 text-white rounded-[2rem] shadow-2xl flex items-center justify-center active:scale-95 transition-all z-20 border-4 border-white dark:border-slate-800 ${isDarkMode ? 'shadow-none' : 'shadow-slate-300'}`}
      >
         <Plus size={32} strokeWidth={2.5} />
      </button>

      {selectedSale && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedSale(null)}>
          <div 
            className={`w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 flex justify-between items-start">
              <div>
                <h3 className={`text-lg font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Detalhes do Pedido</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-2 uppercase tracking-[0.2em]">#{selectedSale.orderNumber} • {selectedSale.customerName}</p>
              </div>
              <button 
                onClick={() => setSelectedSale(null)}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                title="Fechar Detalhes"
                aria-label="Fechar modal de detalhes do pedido"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 no-scrollbar">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1 flex gap-0.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                    <button 
                      onClick={() => handleShareWhatsApp(selectedSale)}
                      className="flex-[2] py-3 bg-emerald-500 text-white rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                      title="Compartilhar no WhatsApp"
                      aria-label="Enviar detalhes do pedido para o WhatsApp do cliente"
                    >
                      <MessageSquare size={14} /> WhatsApp
                    </button>
                    <button 
                      onClick={() => setWhatsappMode(whatsappMode === 'AUTO' ? 'MANUAL' : 'AUTO')}
                      className={`flex-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all transition-colors flex items-center justify-center ${whatsappMode === 'AUTO' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 hover:text-indigo-600'}`}
                      title="Alternar Modo WhatsApp"
                      aria-label={`Alternar para modo ${whatsappMode === 'AUTO' ? 'Manual' : 'Automático'}`}
                    >
                      {whatsappMode === 'AUTO' ? 'AUTO' : 'M'}
                    </button>
                  </div>
                  <button 
                    onClick={() => handleCopyMessage(selectedSale)}
                    className="flex-1 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                    title="Copiar Pedido"
                    aria-label="Copiar texto do pedido para a área de transferência"
                  >
                    <Copy size={14} /> Copiar
                  </button>
                </div>

                {selectedSale.items.map((item, idx) => {
                  const product = getProductInfo(item.productId);
                  const variation = getVariationInfo(item.productId, item.variationId);
                  return (
                    <div key={idx} className={`p-4 rounded-3xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl shadow-sm flex items-center justify-center border border-slate-100 dark:border-slate-800">
                          <Tag size={20} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <p className={`font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{product?.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{product?.reference}</p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                        <div className="flex flex-col">
                          <span className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>{variation?.colorName}</span>
                          <span className="text-slate-400 mt-1">{item.quantity} {item.saleType === SaleType.WHOLESALE ? 'Grades' : 'Pares'}</span>
                        </div>
                        <span className="text-indigo-600 dark:text-indigo-400 text-sm">R$ {(item.price * item.quantity).toFixed(0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`p-8 border-t ${isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Subtotal</span>
                <span className="text-lg font-black text-slate-600 dark:text-slate-400">R$ {selectedSale.subtotal.toFixed(0)}</span>
              </div>
              {selectedSale.discount > 0 && (
                <div className="flex justify-between items-center mb-4 text-rose-500">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Desconto</span>
                  <span className="text-lg font-black">- R$ {selectedSale.discount.toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-black uppercase tracking-[0.4em] text-slate-900 dark:text-white">Total</span>
                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">R$ {selectedSale.total.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {paymentModalSale && (
        <SalePaymentModal
          isOpen={!!paymentModalSale}
          onClose={() => setPaymentModalSale(null)}
          sale={sales.find(s => s.id === paymentModalSale.id) || paymentModalSale}
          accounts={accounts}
          paymentMethods={paymentMethods}
          customer={people.find(p => p.id === paymentModalSale.customerId)}
          isDarkMode={isDarkMode}
          initialMode={paymentModalMode}
          onPay={async (amount, accountId, paymentMethodId, note) => {
            await onPaySale(paymentModalSale.id, amount, accountId, paymentMethodId, note);
          }}
          onUpdatePayment={async (paymentId, amount, accountId, paymentMethodId, note) => {
            await onUpdatePayment(paymentModalSale.id, paymentId, amount, accountId, paymentMethodId, note);
          }}
          onDeletePayment={async (paymentId) => {
            await onDeletePayment(paymentModalSale.id, paymentId);
          }}
        />
      )}

      {editingMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingMessage(null)}>
          <div 
            className={`w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
              <div>
                <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Editar Mensagem</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">WhatsApp para {editingMessage.sale.customerName || "Cliente"}</p>
              </div>
              <button 
                onClick={() => setEditingMessage(null)} 
                className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400"
                title="Fechar Edição"
                aria-label="Fechar modal de edição de mensagem"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <textarea 
                className={`w-full h-64 p-4 rounded-2xl text-[12px] font-medium leading-relaxed border-none outline-none focus:ring-4 focus:ring-emerald-500/10 resize-none ${isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-50 text-slate-700'}`}
                value={editingMessage.text}
                onChange={(e) => setEditingMessage({ ...editingMessage, text: e.target.value })}
                placeholder="Escreva sua mensagem aqui..."
                title="Editar Mensagem"
                aria-label="Campo para editar a mensagem do WhatsApp"
              />
              
              <div className="mt-6 flex gap-3">
                <button 
                  onClick={() => setEditingMessage(null)}
                  className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleShareWhatsApp(editingMessage.sale, editingMessage.text)}
                  className="flex-[2] py-4 rounded-2xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare size={16} /> Enviar WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {noteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setNoteModal(null)}>
          <div 
            className={`w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
               <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Observação</h2>
               <button 
                 onClick={() => setNoteModal(null)} 
                 className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400"
                 title="Fechar Observação"
                 aria-label="Fechar visualização de observação"
               >
                 <X size={20} />
               </button>
            </div>
            <div className="p-6">
               <p className={`text-[12px] font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{noteModal.note}</p>
            </div>
         </div>
       </div>
      )}
    </div>
  );
}

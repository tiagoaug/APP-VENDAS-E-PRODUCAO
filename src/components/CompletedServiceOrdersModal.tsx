import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Filter, Download, Eye, Trash2, Share2, Printer, Bell, CheckSquare, Search, Send, FileText, Check, ListChecks,
} from 'lucide-react';
import { ServiceOrder, ProductionLot, Sector, Transaction, Product, ProductionOrder } from '../types';
import DatePicker from './DatePicker';
import { exportCompletedServiceOrders, sendCompletedOSToPrintStudio, CompletedOSExportItem } from '../utils/completedServiceOrderExport';
import { formatCurrency } from '../utils/numbers';

interface Filters {
  search: string;
  customerName: string;
  productName: string;
  variationName: string;
  providerName: string;
  dateFrom: string;
  dateTo: string;
}

const emptyFilters: Filters = {
  search: '', customerName: '', productName: '', variationName: '', providerName: '', dateFrom: '', dateTo: '',
};

const FILTERS_KEY = 'pcp_completed_os_filters';

function loadFilters(): Filters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    return raw ? { ...emptyFilters, ...JSON.parse(raw) } : emptyFilters;
  } catch {
    return emptyFilters;
  }
}

const hexToRgba = (hexcolor: string | undefined, alpha: number): string => {
  if (!hexcolor || hexcolor.length < 6) return `rgba(99, 102, 241, ${alpha})`;
  const cleanHex = hexcolor.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface CompletedServiceOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceOrders: ServiceOrder[];
  lots: ProductionLot[];
  sectors: Sector[];
  transactions: Transaction[];
  isDarkMode: boolean;
  onViewOS: (os: ServiceOrder) => void;
  onDeleteOS: (os: ServiceOrder) => void;
  onShareOS: (os: ServiceOrder) => void;
  onPrintOS: (os: ServiceOrder) => void;
  onPrintStudio: (os: ServiceOrder) => void;
  onOpenReminders: (os: ServiceOrder) => void;
  osBadgeBg: string;
  osBadgeText: string;
  osBadgeBold: boolean;
  osBadgeItalic: boolean;
  products: Product[];
  productionOrders: ProductionOrder[];
}

export default function CompletedServiceOrdersModal({
  isOpen, onClose, serviceOrders, lots, sectors, transactions, isDarkMode,
  onViewOS, onDeleteOS, onShareOS, onPrintOS, onPrintStudio, onOpenReminders,
  osBadgeBg, osBadgeText, osBadgeBold, osBadgeItalic,
  products, productionOrders,
}: CompletedServiceOrdersModalProps) {
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'jpg'>('pdf');
  const [exportMode, setExportMode] = useState<'none' | 'day' | 'week' | 'month' | 'custom'>('none');
  const [customRangeFrom, setCustomRangeFrom] = useState('');
  const [customRangeTo, setCustomRangeTo] = useState('');
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isOpeningPrintStudio, setIsOpeningPrintStudio] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filtros persistem entre aberturas da tela (não resetam ao fechar) — salvos como um
  // único objeto JSON, igual ao padrão já usado pra outras preferências do PCP.
  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  }, [filters]);

  const getOSCustomers = (os: ServiceOrder): string[] => {
    const osLotIds = os.lotIds || [os.lotId];
    const names = new Set<string>();
    osLotIds.forEach(lId => {
      const l = lots.find(lot => lot.id === lId);
      if (!l) return;
      if (l.customerName?.toUpperCase().trim() === 'ESTOQUE') {
        names.add('ESTOQUE');
        return;
      }
      // Se for grupo/agrupado, busca os clientes dos pedidos de origem
      if (l.customerName?.includes('Grupos') || l.customerName?.includes('Pedidos Agrupados')) {
        const sourceItems = l.metadata?.sourceItems || [];
        sourceItems.forEach(si => {
          const ord = productionOrders.find(o => o.id === si.orderId);
          if (ord?.customerName) {
            names.add(ord.customerName.toUpperCase().trim());
          }
        });
      } else if (l.customerName) {
        names.add(l.customerName.toUpperCase().trim());
      }
    });
    const result = Array.from(names);
    return result.length > 0 ? result : ['ESTOQUE'];
  };

  const getProductReference = (os: ServiceOrder): string => {
    const prod = products.find(p => p.id === os.productId);
    return prod?.reference || os.productName || '—';
  };

  // OS lançada como "Não Contábil" (toggle em ServiceOrderFormView) nunca recebe
  // transactionId — por isso essa ausência é o sinal de que ela não deve contar como
  // valor financeiro (nem Pago/Pendente, nem nos totais do relatório de exportação).
  const isNonAccounting = (os: ServiceOrder) => !os.transactionId;
  const getPaymentStatus = (os: ServiceOrder): 'PENDING' | 'COMPLETED' | 'NON_ACCOUNTING' => {
    if (isNonAccounting(os)) return 'NON_ACCOUNTING';
    return transactions.find(t => t.id === os.transactionId)?.status ?? os.status;
  };

  const completedOS = useMemo(() => serviceOrders.filter(os => os.status === 'COMPLETED'), [serviceOrders]);

  const filterOptions = useMemo(() => {
    const customers = new Set<string>();
    const productsSet = new Set<string>();
    const colorsSet = new Set<string>();
    const providers = new Set<string>();
    completedOS.forEach(os => {
      getOSCustomers(os).forEach(c => {
        if (c) customers.add(c);
      });
      const ref = getProductReference(os);
      if (ref) productsSet.add(ref);
      if (os.variationName) colorsSet.add(os.variationName);
      if (os.providerName) providers.add(os.providerName);
    });
    return {
      customers: Array.from(customers).sort(),
      products: Array.from(productsSet).sort(),
      colors: Array.from(colorsSet).sort(),
      providers: Array.from(providers).sort(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedOS, lots, products, productionOrders]);

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return completedOS.filter(os => {
      const osCustomers = getOSCustomers(os);
      if (filters.customerName && !osCustomers.includes(filters.customerName)) return false;
      const prodRef = getProductReference(os);
      if (filters.productName && prodRef !== filters.productName) return false;
      if (filters.variationName && os.variationName !== filters.variationName) return false;
      if (filters.providerName && os.providerName !== filters.providerName) return false;
      const refDate = os.finishedAt || os.createdAt;
      if (filters.dateFrom && refDate < new Date(`${filters.dateFrom}T00:00:00`).getTime()) return false;
      if (filters.dateTo && refDate > new Date(`${filters.dateTo}T23:59:59`).getTime()) return false;
      if (term) {
        const osCustomersStr = osCustomers.join(' ');
        const haystack = `${os.osNumber} ${prodRef} ${os.variationName} ${os.providerName} ${osCustomersStr}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    }).sort((a, b) => (b.finishedAt || b.createdAt) - (a.finishedAt || a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedOS, filters, lots, transactions, products, productionOrders]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Quando há OS marcadas via caixas de seleção, a exportação considera só elas —
  // caso contrário, segue valendo para todas as OS exibidas com os filtros atuais.
  const selectedFilteredOS = useMemo(() => {
    if (isSelectionMode && selectedIds.size > 0) {
      return filtered.filter(os => selectedIds.has(os.id));
    }
    return filtered;
  }, [filtered, isSelectionMode, selectedIds]);

  // "Resultado Financeiro" só faz sentido pra OS que de fato geram valor financeiro —
  // as marcadas como Não Contábil ficam de fora do relatório (e dos totais), embora
  // continuem aparecendo normalmente na lista da tela.
  const exportableOS = useMemo(() => selectedFilteredOS.filter(os => !isNonAccounting(os)), [selectedFilteredOS]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const buildExportData = () => {
    const items: CompletedOSExportItem[] = exportableOS.map(os => ({
      osNumber: os.osNumber,
      sectorName: os.sectorName,
      providerName: os.providerName,
      customerName: getOSCustomers(os).join(', ') || 'ESTOQUE',
      productName: getProductReference(os),
      variationName: os.variationName,
      quantity: os.quantity,
      valuePerPair: os.valuePerPair,
      totalValue: os.totalValue,
      finishedAt: os.finishedAt || os.createdAt,
      paymentStatus: getPaymentStatus(os) as 'PENDING' | 'COMPLETED',
    }));

    const periodLabel = exportMode === 'custom' && customRangeFrom && customRangeTo
      ? `${customRangeFrom.split('-').reverse().join('/')} – ${customRangeTo.split('-').reverse().join('/')}`
      : filters.dateFrom && filters.dateTo
        ? `${filters.dateFrom.split('-').reverse().join('/')} – ${filters.dateTo.split('-').reverse().join('/')}`
        : filters.dateFrom
          ? `A partir de ${filters.dateFrom.split('-').reverse().join('/')}`
          : filters.dateTo
            ? `Até ${filters.dateTo.split('-').reverse().join('/')}`
            : `${items.length} ordens de serviço`;

    const customRange = exportMode === 'custom' && customRangeFrom && customRangeTo
      ? { start: new Date(`${customRangeFrom}T00:00:00`).getTime(), end: new Date(`${customRangeTo}T23:59:59`).getTime() }
      : undefined;

    return { title: 'OS Concluídas — Resultado Financeiro', periodLabel, groupBy: exportMode, items, customRange };
  };

  const handlePreview = async () => {
    setIsPreviewLoading(true);
    try {
      const result = await exportCompletedServiceOrders(
        buildExportData(),
        exportFormat,
        `OS_Concluidas_${Date.now()}`,
        true,
      );
      if (Array.isArray(result) && result.length > 0) {
        setPreviewUrls(result);
      }
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleExport = async () => {
    const result = await exportCompletedServiceOrders(
      buildExportData(),
      exportFormat,
      `OS_Concluidas_${Date.now()}`,
    );
    if (result) {
      setIsExportOpen(false);
      setPreviewUrls([]);
    }
  };

  const handleOpenInPrintStudio = async () => {
    setIsOpeningPrintStudio(true);
    try {
      await sendCompletedOSToPrintStudio(buildExportData(), `OS_Concluidas_${Date.now()}`);
    } finally {
      setIsOpeningPrintStudio(false);
    }
  };

  return (
    <>
      {/* z-40000 — abaixo dos popups que ela mesma abre (Visualizar/Compartilhar/Imprimir/
          Lembretes ficam entre 50000-300000), senão eles renderizam "atrás" desta tela. */}
      <div className="fixed inset-0 z-[40000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-lg max-h-[90vh] flex flex-col rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
        >
          <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-500'}`}>
                <CheckSquare size={22} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className={`text-lg font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>OS Concluídas</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{filtered.length} de {completedOS.length} ordens</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" title="Fechar"
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}>
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          <div className="px-6 py-3 flex gap-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <button type="button" onClick={() => setIsFilterOpen(true)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Filter size={13} className="text-violet-500" /> Filtrar
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-500 text-white text-[8px] font-black flex items-center justify-center">{activeFilterCount}</span>
              )}
            </button>
            <button type="button" onClick={() => {
              setIsSelectionMode(prev => {
                const next = !prev;
                if (!next) setSelectedIds(new Set());
                return next;
              });
            }}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isSelectionMode ? 'bg-violet-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <ListChecks size={13} className={isSelectionMode ? 'text-white' : 'text-violet-500'} /> Selecionar
              {selectedIds.size > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[8px] font-black flex items-center justify-center">{selectedIds.size}</span>
              )}
            </button>
            <button type="button" onClick={() => setIsExportOpen(true)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Download size={13} className="text-emerald-500" /> Exportar
            </button>
          </div>

          {isSelectionMode && (
            <div className="px-6 py-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-violet-500">
                {selectedIds.size} selecionada{selectedIds.size === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setSelectedIds(new Set(filtered.map(os => os.id)))}
                  className="text-[9px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600">
                  Selecionar Todas
                </button>
                <button type="button" onClick={() => setSelectedIds(new Set())}
                  className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600">
                  Limpar
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 custom-scrollbar">
            {filtered.length === 0 && (
              <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-10">Nenhuma OS concluída encontrada.</p>
            )}
            {filtered.map(os => {
              const osCustomers = getOSCustomers(os).join(', ') || 'ESTOQUE';
              const prodRef = getProductReference(os);
              const paymentStatus = getPaymentStatus(os);
              const sectorColor = sectors.find(s => s.name === os.sectorName || s.id === os.sectorId)?.color || '#6366f1';
              const isSelected = selectedIds.has(os.id);
              return (
                <div key={os.id} className={`rounded-2xl border flex flex-col gap-2.5 px-3 py-3 ${isSelected ? 'border-violet-400 dark:border-violet-600 ring-2 ring-violet-400/30' : isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50/60 border-slate-200'} ${isSelected && isDarkMode ? 'bg-violet-950/30' : isSelected ? 'bg-violet-50/60' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      {isSelectionMode && (
                        <button type="button" onClick={() => toggleSelect(os.id)} aria-label="Selecionar OS" title="Selecionar"
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-violet-600 border-violet-600 text-white' : isDarkMode ? 'border-slate-600' : 'border-slate-300'}`}>
                          {isSelected && <Check size={12} strokeWidth={3.5} />}
                        </button>
                      )}
                      <div className="min-w-0">
                        <p className={`text-[11px] font-black truncate flex items-center gap-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                          <span>{os.providerName || '—'}</span>
                          <span
                            className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border"
                            style={{
                              backgroundColor: hexToRgba(sectorColor, isDarkMode ? 0.15 : 0.1),
                              borderColor: hexToRgba(sectorColor, isDarkMode ? 0.4 : 0.25),
                              color: sectorColor
                            }}
                          >
                            {os.sectorName}
                          </span>
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                          {prodRef} {os.variationName ? `• ${os.variationName}` : ''}{osCustomers ? ` • ${osCustomers}` : ''}
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-[10px] px-2.5 py-1 rounded-full uppercase shrink-0"
                      style={{
                        backgroundColor: osBadgeBg, color: osBadgeText, boxShadow: `0 1px 2px ${osBadgeBg}30`,
                        fontWeight: osBadgeBold ? 900 : 400, fontStyle: osBadgeItalic ? 'italic' : 'normal',
                      }}
                    >
                      {os.osNumber}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                      paymentStatus === 'NON_ACCOUNTING' ? (isDarkMode ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-100 text-slate-500')
                        : paymentStatus === 'COMPLETED' ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                          : (isDarkMode ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-600')
                    }`}>
                      {paymentStatus === 'NON_ACCOUNTING' ? 'Não Contábil' : paymentStatus === 'COMPLETED' ? 'Pago' : 'Pendente'}
                    </span>
                    <span className={`text-[12px] font-black ${paymentStatus === 'NON_ACCOUNTING' ? 'text-slate-400' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>R$ {formatCurrency(os.totalValue)}</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button type="button" title="Visualizar" onClick={() => onViewOS(os)}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        <Eye size={12} className="text-indigo-500" /> Visualizar
                      </button>
                      <button type="button" title="Excluir" onClick={() => onDeleteOS(os)}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        <Trash2 size={12} className="text-rose-500" /> Excluir
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button type="button" title="Compartilhar" onClick={() => onShareOS(os)}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        <Share2 size={12} className="text-orange-500" /> Compartilhar
                      </button>
                      <button type="button" title="Print Studio" onClick={() => onPrintStudio(os)}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        <Printer size={12} className="text-cyan-500" /> Print Studio
                      </button>
                    </div>
                    <button type="button" title="Imprimir Etiqueta / OS" onClick={() => onPrintOS(os)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      <Printer size={12} className="text-emerald-500" /> Imprimir Etiqueta / OS
                    </button>
                    <button type="button" onClick={() => onOpenReminders(os)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      <Bell size={12} className="text-amber-500" /> Lembretes
                      {(os.notes || os.reminderTitle || os.reminderAt) && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Popup de Filtros ── */}
      {isFilterOpen && createPortal(
        <div className="fixed inset-0 z-[40010] flex items-center justify-center p-4" onClick={() => setIsFilterOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className={`relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-[2rem] shadow-2xl border p-5 flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-violet-500" />
                <span className="text-[11px] font-black uppercase tracking-widest">Filtrar OS Concluídas</span>
              </div>
              <button type="button" title="Fechar" onClick={() => setIsFilterOpen(false)}
                className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                <X size={16} />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Buscar por OS, modelo, cor, prestador, cliente..."
                title="Buscar"
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-[11px] font-bold outline-none border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400'}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Período de</label>
                <DatePicker value={filters.dateFrom} onChange={(v) => setFilters(f => ({ ...f, dateFrom: v }))} placeholder="De" />
              </div>
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Até</label>
                <DatePicker value={filters.dateTo} onChange={(v) => setFilters(f => ({ ...f, dateTo: v }))} placeholder="Até" />
              </div>
            </div>

            {([
              ['Cliente', 'customerName', filterOptions.customers],
              ['Modelo', 'productName', filterOptions.products],
              ['Cor', 'variationName', filterOptions.colors],
              ['Prestador', 'providerName', filterOptions.providers],
            ] as [string, keyof Filters, string[]][]).map(([label, key, options]) => options.length > 0 && (
              <div key={key} className={`rounded-2xl border p-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {options.map(opt => (
                    <button type="button" key={opt}
                      onClick={() => setFilters(f => ({ ...f, [key]: f[key] === opt ? '' : opt }))}
                      className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${filters[key] === opt ? 'bg-violet-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2 pt-1">
              {activeFilterCount > 0 && (
                <button type="button" onClick={() => setFilters(emptyFilters)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-500 border-slate-300'}`}>
                  Limpar
                </button>
              )}
              <button type="button" onClick={() => setIsFilterOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-violet-600 hover:bg-violet-700">
                Aplicar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Central de Compartilhamento (Popup de Exportação) ── */}
      {isExportOpen && createPortal(
        <div className="fixed inset-0 z-[40010] flex items-center justify-center p-4" onClick={() => { setIsExportOpen(false); setPreviewUrls([]); }}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className={`relative w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-[2rem] shadow-2xl border p-5 flex flex-col gap-4 custom-scrollbar ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                  {exportFormat === 'pdf' ? <FileText size={20} strokeWidth={2.5} /> : <Send size={20} strokeWidth={2.5} className="rotate-45" />}
                </div>
                <div>
                  <span className="text-[12px] font-black uppercase tracking-widest block leading-none">Central de Compartilhamento</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1 block">Gerando arquivo em formato {exportFormat.toUpperCase()}</span>
                </div>
              </div>
              <button type="button" title="Fechar" onClick={() => { setIsExportOpen(false); setPreviewUrls([]); }}
                className={`p-1.5 rounded-lg shrink-0 ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                <X size={16} />
              </button>
            </div>

            <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
              {isSelectionMode && selectedIds.size > 0 ? (
                <>Considera as {exportableOS.length} OS com lançamento financeiro, dentre as {selectedFilteredOS.length} selecionadas
                {selectedFilteredOS.length !== exportableOS.length ? ` (${selectedFilteredOS.length - exportableOS.length} Não Contábil não entram no resultado financeiro)` : ''}.</>
              ) : (
                <>Considera as {exportableOS.length} OS com lançamento financeiro, dentre as {filtered.length} exibidas com os filtros atuais
                {filtered.length !== exportableOS.length ? ` (${filtered.length - exportableOS.length} Não Contábil não entram no resultado financeiro)` : ''}.</>
              )}
            </p>

            {/* Pré-visualização */}
            {previewUrls.length > 0 && (
              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl p-3 bg-white dark:bg-slate-800">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Pré-visualização</span>
                  <button type="button" onClick={() => setPreviewUrls([])} className="text-[9px] font-black uppercase tracking-widest text-white bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all px-3 py-1.5 rounded-full shadow-sm">Fechar Preview</button>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden shadow-inner max-h-[50vh] overflow-y-auto">
                  {exportFormat === 'pdf' ? (
                    <iframe title="Pré-visualização do PDF" src={previewUrls[0] + '#toolbar=0'} className="w-full h-[420px]" />
                  ) : (
                    <img src={previewUrls[0]} alt="Pré-visualização do JPG" className="w-full h-auto" />
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Formato</p>
              <div className="flex gap-1.5">
                {(['pdf', 'jpg'] as const).map(fmt => (
                  <button type="button" key={fmt} onClick={() => { setExportFormat(fmt); setPreviewUrls([]); }}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${exportFormat === fmt ? 'bg-emerald-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Modo</p>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => { setExportMode('none'); setPreviewUrls([]); }}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${exportMode === 'none' ? 'bg-emerald-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  Lista
                </button>
                <button type="button" onClick={() => { setExportMode(m => m === 'none' ? 'month' : m); setPreviewUrls([]); }}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${exportMode !== 'none' ? 'bg-emerald-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  Agrupado por Período
                </button>
              </div>
            </div>

            {exportMode !== 'none' && (
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Agrupar por</p>
                <div className="flex gap-1.5">
                  {([['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês'], ['custom', 'Entre Datas']] as const).map(([val, label]) => (
                    <button type="button" key={val} onClick={() => { setExportMode(val); setPreviewUrls([]); }}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${exportMode === val ? 'bg-violet-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {exportMode === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 mt-2.5">
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 block">De</label>
                      <DatePicker value={customRangeFrom} onChange={(v) => { setCustomRangeFrom(v); setPreviewUrls([]); }} placeholder="De" />
                    </div>
                    <div>
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Até</label>
                      <DatePicker value={customRangeTo} onChange={(v) => { setCustomRangeTo(v); setPreviewUrls([]); }} placeholder="Até" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Opções de Compartilhamento */}
            <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className={`flex items-center gap-2 px-3 py-3 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <Send size={13} className="text-cyan-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">Opções de Compartilhamento</span>
              </div>
              <div className={`p-3 flex flex-col gap-2.5 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                <div className="flex gap-1.5">
                  <button type="button" onClick={handlePreview} disabled={exportableOS.length === 0 || isPreviewLoading}
                    className="flex-1 py-3 text-white rounded-xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">
                    {isPreviewLoading ? 'Carregando...' : 'Visualizar Arquivo'}
                  </button>
                  <button type="button" onClick={handleOpenInPrintStudio} disabled={exportableOS.length === 0 || isOpeningPrintStudio}
                    className="flex-1 py-3 text-white rounded-xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed">
                    {isOpeningPrintStudio ? 'Abrindo...' : 'Print Studio'}
                  </button>
                </div>
                <button type="button" onClick={handleExport} disabled={exportableOS.length === 0}
                  className={`w-full py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${exportFormat === 'pdf' ? 'bg-rose-500 shadow-rose-500/20' : 'bg-emerald-600 shadow-emerald-500/20'} text-white`}>
                  <Download size={14} /> Gerar {exportFormat.toUpperCase()} ({exportableOS.length} OS)
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

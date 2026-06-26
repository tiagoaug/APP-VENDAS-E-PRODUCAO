import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Filter, Download, Eye, Trash2, Share2, Printer, Bell, CheckSquare, Search,
} from 'lucide-react';
import { ServiceOrder, ProductionLot, Sector, Transaction } from '../types';
import DatePicker from './DatePicker';
import { exportCompletedServiceOrders, CompletedOSExportItem } from '../utils/completedServiceOrderExport';
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
}

export default function CompletedServiceOrdersModal({
  isOpen, onClose, serviceOrders, lots, sectors, transactions, isDarkMode,
  onViewOS, onDeleteOS, onShareOS, onPrintOS, onPrintStudio, onOpenReminders,
  osBadgeBg, osBadgeText, osBadgeBold, osBadgeItalic,
}: CompletedServiceOrdersModalProps) {
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'jpg'>('pdf');
  const [exportMode, setExportMode] = useState<'none' | 'day' | 'week' | 'month'>('none');

  // Filtros persistem entre aberturas da tela (não resetam ao fechar) — salvos como um
  // único objeto JSON, igual ao padrão já usado pra outras preferências do PCP.
  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  }, [filters]);

  const getCustomerName = (os: ServiceOrder) => lots.find(l => l.id === (os.lotId || os.lotIds?.[0]))?.customerName || '';
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
    const products = new Set<string>();
    const colorsSet = new Set<string>();
    const providers = new Set<string>();
    completedOS.forEach(os => {
      const c = getCustomerName(os);
      if (c) customers.add(c);
      if (os.productName) products.add(os.productName);
      if (os.variationName) colorsSet.add(os.variationName);
      if (os.providerName) providers.add(os.providerName);
    });
    return {
      customers: Array.from(customers).sort(),
      products: Array.from(products).sort(),
      colors: Array.from(colorsSet).sort(),
      providers: Array.from(providers).sort(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedOS, lots]);

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return completedOS.filter(os => {
      const customerName = getCustomerName(os);
      if (filters.customerName && customerName !== filters.customerName) return false;
      if (filters.productName && os.productName !== filters.productName) return false;
      if (filters.variationName && os.variationName !== filters.variationName) return false;
      if (filters.providerName && os.providerName !== filters.providerName) return false;
      const refDate = os.finishedAt || os.createdAt;
      if (filters.dateFrom && refDate < new Date(`${filters.dateFrom}T00:00:00`).getTime()) return false;
      if (filters.dateTo && refDate > new Date(`${filters.dateTo}T23:59:59`).getTime()) return false;
      if (term) {
        const haystack = `${os.osNumber} ${os.productName} ${os.variationName} ${os.providerName} ${customerName}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    }).sort((a, b) => (b.finishedAt || b.createdAt) - (a.finishedAt || a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedOS, filters, lots, transactions]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // "Resultado Financeiro" só faz sentido pra OS que de fato geram valor financeiro —
  // as marcadas como Não Contábil ficam de fora do relatório (e dos totais), embora
  // continuem aparecendo normalmente na lista da tela.
  const exportableOS = useMemo(() => filtered.filter(os => !isNonAccounting(os)), [filtered]);

  if (!isOpen) return null;

  const handleExport = async () => {
    const items: CompletedOSExportItem[] = exportableOS.map(os => ({
      osNumber: os.osNumber,
      sectorName: os.sectorName,
      providerName: os.providerName,
      customerName: getCustomerName(os),
      productName: os.productName,
      variationName: os.variationName,
      quantity: os.quantity,
      valuePerPair: os.valuePerPair,
      totalValue: os.totalValue,
      finishedAt: os.finishedAt || os.createdAt,
      paymentStatus: getPaymentStatus(os) as 'PENDING' | 'COMPLETED',
    }));

    const periodLabel = filters.dateFrom && filters.dateTo
      ? `${filters.dateFrom.split('-').reverse().join('/')} – ${filters.dateTo.split('-').reverse().join('/')}`
      : filters.dateFrom
        ? `A partir de ${filters.dateFrom.split('-').reverse().join('/')}`
        : filters.dateTo
          ? `Até ${filters.dateTo.split('-').reverse().join('/')}`
          : `${items.length} ordens de serviço`;

    await exportCompletedServiceOrders(
      { title: 'OS Concluídas — Resultado Financeiro', periodLabel, groupBy: exportMode, items },
      exportFormat,
      `OS_Concluidas_${Date.now()}`,
    );
    setIsExportOpen(false);
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
            <button type="button" onClick={() => setIsExportOpen(true)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Download size={13} className="text-emerald-500" /> Exportar
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 custom-scrollbar">
            {filtered.length === 0 && (
              <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-10">Nenhuma OS concluída encontrada.</p>
            )}
            {filtered.map(os => {
              const customerName = getCustomerName(os);
              const paymentStatus = getPaymentStatus(os);
              return (
                <div key={os.id} className={`rounded-2xl border flex flex-col gap-2.5 px-3 py-3 ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50/60 border-slate-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-[11px] font-black truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{os.providerName || '—'}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
                        {os.productName} {os.variationName ? `• ${os.variationName}` : ''}{customerName ? ` • ${customerName}` : ''}
                      </p>
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

      {/* ── Popup de Exportação ── */}
      {isExportOpen && createPortal(
        <div className="fixed inset-0 z-[40010] flex items-center justify-center p-4" onClick={() => setIsExportOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className={`relative w-full max-w-sm rounded-[2rem] shadow-2xl border p-5 flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download size={14} className="text-emerald-500" />
                <span className="text-[11px] font-black uppercase tracking-widest">Exportar Resultado Financeiro</span>
              </div>
              <button type="button" title="Fechar" onClick={() => setIsExportOpen(false)}
                className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                <X size={16} />
              </button>
            </div>

            <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
              Considera as {exportableOS.length} OS com lançamento financeiro, dentre as {filtered.length} exibidas com os filtros atuais
              {filtered.length !== exportableOS.length ? ` (${filtered.length - exportableOS.length} Não Contábil não entram no resultado financeiro)` : ''}.
            </p>

            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Formato</p>
              <div className="flex gap-1.5">
                {(['pdf', 'jpg'] as const).map(fmt => (
                  <button type="button" key={fmt} onClick={() => setExportFormat(fmt)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${exportFormat === fmt ? 'bg-emerald-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Modo</p>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setExportMode('none')}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${exportMode === 'none' ? 'bg-emerald-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  Lista
                </button>
                <button type="button" onClick={() => setExportMode(m => m === 'none' ? 'month' : m)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${exportMode !== 'none' ? 'bg-emerald-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  Agrupado por Período
                </button>
              </div>
            </div>

            {exportMode !== 'none' && (
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Agrupar por</p>
                <div className="flex gap-1.5">
                  {([['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês']] as const).map(([val, label]) => (
                    <button type="button" key={val} onClick={() => setExportMode(val)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${exportMode === val ? 'bg-violet-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button type="button" onClick={handleExport} disabled={exportableOS.length === 0}
              className="w-full py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <Download size={14} /> Exportar {exportableOS.length} OS
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

import React, { useState, useMemo } from 'react';
import {
  ShoppingCart, X, Package, Layers, Clock,
  CheckCircle, Truck, Circle, ArrowUpRight, ChevronDown, ChevronUp,
  ClipboardList, AlertTriangle
} from 'lucide-react';
import { PurchaseRequest, PurchaseRequestStatus, ViewType } from '../types';
import { generateId } from '../utils/id';

interface PurchaseNeedsModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseRequests: PurchaseRequest[];
  onUpdateRequest: (req: PurchaseRequest) => Promise<void>;
  onNavigate: (view: ViewType, params?: any) => void;
  isDarkMode: boolean;
  userName?: string;
  soleStock?: any[];
  productionConfigs?: any[];
}

const STATUS_CONFIG: Record<PurchaseRequestStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  PENDING:     { label: 'Aguardando',   color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20',    border: 'border-amber-200 dark:border-amber-800',   icon: <Clock size={13} /> },
  IN_PROGRESS: { label: 'Em andamento', color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/20',      border: 'border-blue-200 dark:border-blue-800',     icon: <Circle size={13} className="fill-blue-500" /> },
  ORDERED:     { label: 'Pedido feito', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20',  border: 'border-indigo-200 dark:border-indigo-800', icon: <Truck size={13} /> },
  RECEIVED:    { label: 'Recebido',     color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', icon: <CheckCircle size={13} /> },
};

const NEXT_STATUS: Record<PurchaseRequestStatus, PurchaseRequestStatus | null> = {
  PENDING:     'IN_PROGRESS',
  IN_PROGRESS: 'ORDERED',
  ORDERED:     'RECEIVED',
  RECEIVED:    null,
};

const NEXT_LABEL: Record<PurchaseRequestStatus, string> = {
  PENDING:     'Iniciar',
  IN_PROGRESS: 'Marcar pedido',
  ORDERED:     'Confirmar recebimento',
  RECEIVED:    '',
};

export default function PurchaseNeedsModal({
  isOpen,
  onClose,
  purchaseRequests = [],
  onUpdateRequest,
  onNavigate,
  isDarkMode,
  userName,
  soleStock = [],
  productionConfigs = []
}: PurchaseNeedsModalProps) {
  const [activeFilter, setActiveFilter] = useState<PurchaseRequestStatus | 'ALL'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = activeFilter === 'ALL'
      ? purchaseRequests
      : purchaseRequests.filter(r => r.status === activeFilter);
    return [...list].sort((a, b) => b.requestedAt - a.requestedAt);
  }, [purchaseRequests, activeFilter]);

  const counts = useMemo(() => ({
    ALL:         purchaseRequests.length,
    PENDING:     purchaseRequests.filter(r => r.status === 'PENDING').length,
    IN_PROGRESS: purchaseRequests.filter(r => r.status === 'IN_PROGRESS').length,
    ORDERED:     purchaseRequests.filter(r => r.status === 'ORDERED').length,
    RECEIVED:    purchaseRequests.filter(r => r.status === 'RECEIVED').length,
  }), [purchaseRequests]);

  if (!isOpen) return null;

  const handleAdvance = async (req: PurchaseRequest) => {
    const next = NEXT_STATUS[req.status];
    if (!next) return;

    if (req.type === 'SOLE' && req.status === 'ORDERED') {
      handleOrder(req);
      return;
    }

    setLoadingId(req.id);
    try {
      await onUpdateRequest({ ...req, status: next, updatedAt: Date.now() });
    } finally {
      setLoadingId(null);
    }
  };

  const handleOrder = async (req: PurchaseRequest) => {
    if (req.status === 'PENDING') {
      try {
        await onUpdateRequest({
          ...req,
          status: 'IN_PROGRESS',
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.error("Erro ao alterar status da solicitação para Em Andamento:", err);
      }
    }

    if (req.type === 'SOLE') {
      const remainingGrid: Record<string, number> = {};
      if (req.sizeBreakdown) {
        Object.entries(req.sizeBreakdown).forEach(([size, qty]) => {
          const received = (req.receivedBreakdown || {})[size] || 0;
          const left = qty - received;
          if (left > 0) remainingGrid[size] = left;
        });
      }

      onNavigate(ViewType.PRODUCTION_SOLE_PURCHASE, {
        moldId: req.moldId,
        colorId: req.colorId,
        initialGrid: Object.keys(remainingGrid).length > 0 ? remainingGrid : req.sizeBreakdown,
        description: `Solicitação: ${req.name}`,
        requestId: req.id
      });
      onClose();
    } else {
      const remainingQty = req.requiredQty - (req.receivedQty || 0);
      onNavigate(ViewType.PURCHASE_FORM, {
        requestId: req.id,
        initialDescription: `Compra de ${req.name} para produção`,
        initialGeneralItems: [{
          id: generateId(),
          description: `${req.name} (${remainingQty} ${req.unit} restantes)`,
          value: 0,
        }],
      });
      onClose();
    }
  };


  const filters: Array<{ key: PurchaseRequestStatus | 'ALL'; label: string }> = [
    { key: 'ALL',         label: 'Todos' },
    { key: 'PENDING',     label: 'Aguardando' },
    { key: 'IN_PROGRESS', label: 'Em andamento' },
    { key: 'ORDERED',     label: 'Pedido feito' },
    { key: 'RECEIVED',    label: 'Recebido' },
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6 lg:p-10">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
        aria-hidden="true"
      />
      
      <div 
        className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 ${
          isDarkMode ? 'bg-slate-950 border border-slate-800 text-white' : 'bg-slate-50 border border-slate-100 text-slate-900'
        }`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Modal de necessidade de compras"
      >
        {/* Header */}
        <div className={`px-6 py-5 flex items-center justify-between border-b shrink-0 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <ShoppingCart size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Setor de compras</p>
              <h3 className="text-lg font-black tracking-tight leading-none">Necessidade de compras</h3>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <span className="text-[11px] font-black text-indigo-500">{counts.PENDING + counts.IN_PROGRESS} pendentes</span>
            </div>
            <button 
              onClick={onClose}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}
              aria-label="Fechar modal"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className={`px-6 py-4 border-b overflow-x-auto shrink-0 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white/50 border-slate-100'}`}>
          <div className="flex gap-2 w-max">
            {filters.map(f => {
              const count = counts[f.key];
              const isActive = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
                      : isDarkMode
                        ? 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 shadow-sm'
                  }`}
                  aria-pressed={isActive}
                >
                  {f.label}
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${isActive ? 'bg-white/20' : isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="grid grid-cols-1 gap-4 pb-4">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                <ClipboardList size={48} strokeWidth={1.5} />
                <p className="text-sm font-black uppercase tracking-widest">Nenhuma solicitação encontrada</p>
              </div>
            ) : (
              filtered.map(req => {
                const sc = STATUS_CONFIG[req.status];
                const next = NEXT_STATUS[req.status];
                const isExpanded = expandedId === req.id;
                const isLoading = loadingId === req.id;
                const hasSizes = req.type === 'SOLE' && req.sizeBreakdown && Object.keys(req.sizeBreakdown).length > 0;
                const requestDate = new Date(req.requestedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

                return (
                  <div
                    key={req.id}
                    className={`rounded-[2rem] border-2 overflow-hidden transition-all duration-300 ${
                      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'
                    }`}
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          req.type === 'SOLE' 
                            ? 'bg-indigo-100 text-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-400' 
                            : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {req.type === 'SOLE' ? <Layers size={20} strokeWidth={2.5} /> : <Package size={20} strokeWidth={2.5} />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1.5">
                            <h4 className="text-base font-black tracking-tight truncate leading-none">{req.name}</h4>
                            <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${sc.bg} ${sc.color} ${sc.border} flex items-center gap-1`}>
                              {sc.icon} {sc.label}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                              <ArrowUpRight size={14} className="text-indigo-500" />
                              {req.receivedQty || 0} de {req.requiredQty} {req.unit}
                            </span>
                            {req.contributingLots && req.contributingLots.length > 0 && (
                              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                                <ClipboardList size={14} className="text-slate-400" />
                                {req.contributingLots.length} {req.contributingLots.length === 1 ? 'mapa' : 'mapas'}
                              </span>
                            )}
                            <span className="text-[11px] font-bold text-slate-400">
                              Solicitado {requestDate}
                            </span>
                          </div>
                        </div>

                        {hasSizes && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : req.id)}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                              isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100 shadow-sm'
                            }`}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? "Recolher detalhes" : "Expandir detalhes"}
                          >
                            {isExpanded ? <ChevronUp size={20} className="text-indigo-500" /> : <ChevronDown size={20} className="text-slate-400" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Area */}
                    {isExpanded && req.type === 'SOLE' && (
                      <div className={`px-6 pb-6 animate-in slide-in-from-top-2 duration-300`}>
                        <div className={`rounded-2xl overflow-hidden border ${isDarkMode ? 'border-slate-800' : 'border-slate-100 shadow-inner bg-slate-50/50'}`}>
                          <div className={`grid grid-cols-4 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                            <span>Grade sola</span>
                            <span className="text-center">Estoque</span>
                            <span className="text-center">Recebido</span>
                            <span className="text-right">Falta</span>
                          </div>
                          {(() => {
                            const soleEntries = req.colorId
                              ? soleStock.filter(s => s.moldId === req.moldId && s.colorId === req.colorId)
                              : soleStock.filter(s => s.moldId === req.moldId);
                            
                            const gradeStock: Record<string, number> = {};
                            soleEntries.forEach(e => {
                              Object.entries(e.stock || {}).forEach(([k, v]) => {
                                const key = String(k).trim();
                                if (key === 'pesagem' || key === 'total') return;
                                gradeStock[key] = (gradeStock[key] || 0) + (Number(v) || 0);
                              });
                            });

                            const displayGrades = new Set([...Object.keys(req.sizeBreakdown || {}), ...Object.keys(gradeStock)]);
                            const sortedGrades = Array.from(displayGrades).sort((a, b) => parseFloat(a) - parseFloat(b));

                            return sortedGrades.map(grade => {
                              const stock = gradeStock[grade] || 0;
                              const needed = req.sizeBreakdown?.[grade] || 0;
                              const received = req.receivedBreakdown?.[grade] || 0;
                              const missing = Math.max(0, needed - received);
                              
                              if (stock === 0 && needed === 0 && received === 0) return null;

                              return (
                                <div key={grade} className={`grid grid-cols-4 px-4 py-3 border-t text-[13px] font-black ${isDarkMode ? 'border-slate-800' : 'border-slate-100 bg-white/40'}`}>
                                  <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>{grade}</span>
                                  <span className={`text-center ${stock > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>{stock}</span>
                                  <span className={`text-center ${received > 0 ? 'text-indigo-500' : 'text-slate-300'}`}>{received}</span>
                                  <span className={`text-right ${missing > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{missing > 0 ? `-${missing}` : '✓'}</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Actions Bar */}
                    <div className={`px-6 py-4 flex items-center gap-3 border-t ${isDarkMode ? 'bg-slate-800/20 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      {next && (
                        <button
                          onClick={() => handleAdvance(req)}
                          disabled={isLoading}
                          className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] flex items-center justify-center gap-2 transition-all ${
                            isLoading
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                              : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-[0.98]'
                          }`}
                        >
                          {isLoading ? 'Salvando...' : NEXT_LABEL[req.status]}
                        </button>
                      )}
                      {req.status !== 'RECEIVED' && (
                        <button
                          onClick={() => handleOrder(req)}
                          className={`flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] border-2 transition-all ${
                            isDarkMode 
                              ? 'border-slate-700 hover:bg-slate-800 text-slate-300' 
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-sm'
                          }`}
                        >
                          <ArrowUpRight size={16} strokeWidth={3} />
                          {req.type === 'SOLE' ? 'Comprar sola' : 'Gerar compra'}
                        </button>
                      )}
                      {req.status === 'RECEIVED' && (
                        <div className="flex-1 py-4 flex items-center justify-center gap-2 text-emerald-500 text-[11px] font-black uppercase tracking-widest">
                          <CheckCircle size={18} strokeWidth={3} />
                          Processo concluído
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

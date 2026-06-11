import React, { useState, useMemo } from 'react';
import {
  ShoppingCart, ChevronLeft, Package, Layers, Clock,
  CheckCircle, Truck, Circle, ArrowUpRight, ChevronDown, ChevronUp,
  ClipboardList, Filter, Search, X, Pencil, PackageCheck, Plus, Minus,
  Trash2, RotateCcw, CheckCircle2, ListChecks
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PurchaseRequest, PurchaseRequestStatus, PurchaseType, ViewType, Person } from '../types';
import { generateId } from '../utils/id';

interface PurchaseNeedsViewProps {
  purchaseRequests: PurchaseRequest[];
  onUpdateRequest: (req: PurchaseRequest) => Promise<void>;
  onDeleteRequest: (req: PurchaseRequest) => Promise<void>;
  onNavigate: (view: ViewType, params?: any) => void;
  onBack: () => void;
  isDarkMode: boolean;
  userName?: string;
  soleStock?: any[];
  productionConfigs?: any[];
  people?: Person[];
}

const STATUS_CONFIG: Record<PurchaseRequestStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  PENDING:     { label: 'Aguardando',   color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20',    border: 'border-amber-200 dark:border-amber-800',   icon: <Clock size={13} /> },
  IN_PROGRESS: { label: 'Em Andamento', color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/20',      border: 'border-blue-200 dark:border-blue-800',     icon: <Circle size={13} className="fill-blue-500" /> },
  ORDERED:     { label: 'Pedido Feito', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20',  border: 'border-indigo-200 dark:border-indigo-800', icon: <Truck size={13} /> },
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
  IN_PROGRESS: 'Marcar Pedido',
  ORDERED:     'Confirmar Recebimento',
  RECEIVED:    '',
};

export default function PurchaseNeedsView({
  purchaseRequests = [],
  onUpdateRequest,
  onDeleteRequest,
  onNavigate,
  onBack,
  isDarkMode,
  userName,
  soleStock = [],
  productionConfigs = [],
  people = []
}: PurchaseNeedsViewProps) {
  const [activeFilter, setActiveFilter] = useState<PurchaseRequestStatus | 'ALL'>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Seleção em lote por fornecedor
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Edit modal
  const [editingReq, setEditingReq] = useState<PurchaseRequest | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState(0);
  const [editBreakdown, setEditBreakdown] = useState<Record<string, number>>({});
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Receive modal
  const [receivingReq, setReceivingReq] = useState<PurchaseRequest | null>(null);
  const [receiveQty, setReceiveQty] = useState(0);
  const [receiveBreakdown, setReceiveBreakdown] = useState<Record<string, number>>({});
  const [isSavingReceive, setIsSavingReceive] = useState(false);

  // Delete modal
  const [deletingReq, setDeletingReq] = useState<PurchaseRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = useMemo(() => {
    let list = activeFilter === 'ALL'
      ? purchaseRequests
      : purchaseRequests.filter(r => r.status === activeFilter);
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => r.name.toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => b.requestedAt - a.requestedAt);
  }, [purchaseRequests, activeFilter, searchQuery]);

  const counts = useMemo(() => ({
    ALL:         purchaseRequests.length,
    PENDING:     purchaseRequests.filter(r => r.status === 'PENDING').length,
    IN_PROGRESS: purchaseRequests.filter(r => r.status === 'IN_PROGRESS').length,
    ORDERED:     purchaseRequests.filter(r => r.status === 'ORDERED').length,
    RECEIVED:    purchaseRequests.filter(r => r.status === 'RECEIVED').length,
  }), [purchaseRequests]);

  const handleAdvance = async (req: PurchaseRequest) => {
    const next = NEXT_STATUS[req.status];
    if (!next) return;

    if (req.status === 'ORDERED') {
      // Receipt happens in "Recebimento de Compras" screen
      return;
    }

    setLoadingId(req.id);
    try {
      await onUpdateRequest({ ...req, status: next, updatedAt: Date.now() });
    } finally {
      setLoadingId(null);
    }
  };

  const openEdit = (req: PurchaseRequest) => {
    setEditingReq(req);
    setEditName(req.name);
    setEditQty(req.requiredQty);
    setEditBreakdown(req.sizeBreakdown ? { ...req.sizeBreakdown } : {});
    setEditNotes(req.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingReq) return;
    setIsSavingEdit(true);
    try {
      const totalQty = editingReq.type === 'SOLE'
        ? Object.values(editBreakdown).reduce((s, v) => s + v, 0)
        : editQty;
      await onUpdateRequest({
        ...editingReq,
        name: editName,
        requiredQty: totalQty,
        sizeBreakdown: editingReq.type === 'SOLE' ? editBreakdown : editingReq.sizeBreakdown,
        notes: editNotes,
        updatedAt: Date.now(),
      });
      setEditingReq(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openReceive = (req: PurchaseRequest) => {
    setReceivingReq(req);
    setReceiveQty(0);
    if (req.type === 'SOLE' && req.sizeBreakdown) {
      const bd: Record<string, number> = {};
      Object.keys(req.sizeBreakdown).forEach(g => { bd[g] = 0; });
      setReceiveBreakdown(bd);
    } else {
      setReceiveBreakdown({});
    }
  };

  const handleSaveReceive = async () => {
    if (!receivingReq) return;
    setIsSavingReceive(true);
    try {
      let newReceivedQty: number;
      let newReceivedBreakdown: Record<string, number> | undefined;

      if (receivingReq.type === 'SOLE') {
        const prev = receivingReq.receivedBreakdown || {};
        newReceivedBreakdown = { ...prev };
        Object.entries(receiveBreakdown).forEach(([g, qty]) => {
          newReceivedBreakdown![g] = (newReceivedBreakdown![g] || 0) + qty;
        });
        newReceivedQty = Object.values(newReceivedBreakdown).reduce((s, v) => s + v, 0);
      } else {
        newReceivedQty = (receivingReq.receivedQty || 0) + receiveQty;
      }

      const fullyReceived = newReceivedQty >= receivingReq.requiredQty;
      const newStatus: PurchaseRequestStatus = fullyReceived
        ? 'RECEIVED'
        : receivingReq.status === 'PENDING' ? 'IN_PROGRESS' : receivingReq.status;

      await onUpdateRequest({
        ...receivingReq,
        receivedQty: newReceivedQty,
        receivedBreakdown: newReceivedBreakdown,
        status: newStatus,
        updatedAt: Date.now(),
      });
      setReceivingReq(null);
    } finally {
      setIsSavingReceive(false);
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

      onNavigate(ViewType.PURCHASE_FORM, {
        type: PurchaseType.SOLE,
        items: [{
          moldId: req.moldId,
          colorId: req.colorId,
          initialGrid: Object.keys(remainingGrid).length > 0 ? remainingGrid : req.sizeBreakdown,
        }],
        initialDescription: `Solicitação: ${req.name}`,
        requestId: req.id
      });
    } else {
      const remainingQty = req.requiredQty - (req.receivedQty || 0);
      onNavigate(ViewType.PURCHASE_FORM, {
        requestId: req.id,
        initialDescription: `Compra de ${req.name} para produção`,
        initialGeneralItems: [{
          id: generateId(),
          description: req.name,
          materialId: req.materialId,
          quantity: remainingQty,
          unit: req.unit,
          value: 0,
        }],
      });
    }
  };

  const handleDeleteBackToPCP = async (req: PurchaseRequest) => {
    setIsDeleting(true);
    try {
      await onDeleteRequest(req);
      setDeletingReq(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAndPurchaseManually = async (req: PurchaseRequest) => {
    setIsDeleting(true);
    try {
      await onDeleteRequest(req);
      setDeletingReq(null);

      if (req.type === 'SOLE') {
        const remainingGrid: Record<string, number> = {};
        if (req.sizeBreakdown) {
          Object.entries(req.sizeBreakdown).forEach(([size, qty]) => {
            const received = (req.receivedBreakdown || {})[size] || 0;
            const left = qty - received;
            if (left > 0) remainingGrid[size] = left;
          });
        }
        onNavigate(ViewType.PURCHASE_FORM, {
          type: PurchaseType.SOLE,
          items: [{
            moldId: req.moldId,
            colorId: req.colorId,
            initialGrid: Object.keys(remainingGrid).length > 0 ? remainingGrid : req.sizeBreakdown,
          }],
          initialDescription: `Compra manual: ${req.name}`,
        });
      } else {
        const remainingQty = req.requiredQty - (req.receivedQty || 0);
        onNavigate(ViewType.PURCHASE_FORM, {
          initialDescription: `Compra manual: ${req.name}`,
          initialGeneralItems: [{
            id: generateId(),
            description: req.name,
            materialId: req.materialId,
            quantity: remainingQty,
            unit: req.unit,
            value: 0,
          }],
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const filters: Array<{ key: PurchaseRequestStatus | 'ALL'; label: string }> = [
    { key: 'ALL',         label: 'Todos' },
    { key: 'PENDING',     label: 'Aguardando' },
    { key: 'IN_PROGRESS', label: 'Em Andamento' },
    { key: 'ORDERED',     label: 'Pedido Feito' },
    { key: 'RECEIVED',    label: 'Recebido' },
  ];

  return (
    <div className={`flex flex-col min-h-screen ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-20 px-4 pt-4 pb-3 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
        <div className="flex items-center gap-3">
          <button type="button" title="Voltar" onClick={onBack} className={`w-10 h-10 flex items-center justify-center rounded-2xl ${isDarkMode ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100 shadow-sm text-slate-500'}`}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Setor de Compras</p>
            <h2 className="text-base font-black tracking-tight leading-none">Necessidade de Compras</h2>
          </div>
        </div>
        
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className={`h-11 px-5 rounded-2xl flex items-center gap-3 transition-all duration-300 ${isDarkMode ? 'bg-slate-900 text-slate-400 hover:text-indigo-400' : 'bg-white text-slate-400 border border-slate-100 shadow-sm hover:text-indigo-500'}`}
        >
          <Filter size={18} strokeWidth={2.5} />
          <span className="text-[10px] font-black uppercase tracking-widest">Configurar</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-4 mt-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} strokeWidth={2.5} />
          <input 
            type="text"
            placeholder="Pesquisar material..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full h-14 pl-12 pr-4 rounded-2xl border text-[12px] font-bold tracking-widest transition-all outline-none focus:ring-2 focus:ring-indigo-600/20 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-100 text-slate-800 placeholder:text-slate-300'}`}
          />
          {searchQuery && (
            <button
              type="button"
              title="Limpar pesquisa"
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Popup with Framer Motion */}
      <AnimatePresence>
        {showFilters && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilters(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-sm rounded-[3rem] p-8 shadow-2xl flex flex-col gap-6 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-lg font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Filtrar Status</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Selecione uma categoria</p>
                </div>
                <button type="button" title="Fechar filtros" onClick={() => setShowFilters(false)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>

              <div className="flex flex-col gap-2.5">
                {filters.map(f => {
                  const isActive = activeFilter === f.key;
                  const count = (counts as any)[f.key];
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => { setActiveFilter(f.key); setShowFilters(false); }}
                      className={`w-full flex items-center justify-between px-6 py-5 rounded-[1.8rem] border-2 transition-all duration-300 ${
                        isActive
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-500/20 scale-[1.02]'
                          : isDarkMode
                            ? 'bg-slate-800/50 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                            : 'bg-slate-50 border-slate-50 text-slate-500 hover:border-slate-200 hover:bg-white'
                      }`}
                    >
                      <span className="text-[12px] font-black uppercase tracking-[0.1em]">{f.label}</span>
                      <span className={`text-[11px] font-black px-3 py-1 rounded-xl ${isActive ? 'bg-white/20' : isDarkMode ? 'bg-slate-900' : 'bg-white shadow-sm border border-slate-100'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lista */}
      <div className="flex-1 px-4 pb-8 flex flex-col gap-4 mt-4">
        {filtered.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col items-center justify-center py-20 gap-4 rounded-[3rem] ${isDarkMode ? 'bg-slate-900/50' : 'bg-white shadow-sm border border-slate-100'}`}
          >
            <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-700' : 'bg-slate-50 text-slate-200'}`}>
              <ClipboardList size={40} />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Nenhuma solicitação</p>
              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-1">Tente ajustar seus filtros</p>
            </div>
          </motion.div>
        ) : (
          filtered.map((req, index) => {
            const sc = STATUS_CONFIG[req.status];
            const next = NEXT_STATUS[req.status];
            const isExpanded = expandedId === req.id;
            const isLoading = loadingId === req.id;
            const hasSizes = req.type === 'SOLE' && req.sizeBreakdown && Object.keys(req.sizeBreakdown).length > 0;
            const requestDate = new Date(req.requestedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-[2.5rem] border-2 overflow-hidden transition-all duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'} ${isExpanded ? 'ring-2 ring-indigo-500/20 scale-[1.01]' : ''}`}
              >
                {/* Card header */}
                <div className="p-6 flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${req.type === 'SOLE' ? 'bg-indigo-100 text-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {req.type === 'SOLE' ? <Layers size={22} /> : <Package size={22} />}
                    </div>
                    <p className="flex-1 min-w-0 text-[15px] font-black uppercase tracking-tight leading-tight">{req.name}</p>
                    <div className="flex gap-2 flex-shrink-0">
                      {req.status !== 'RECEIVED' && (
                        <button
                          type="button"
                          title="Editar solicitação"
                          onClick={() => openEdit(req)}
                          className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-50 hover:bg-slate-100 text-slate-400'}`}
                        >
                          <Pencil size={16} strokeWidth={2.5} />
                        </button>
                      )}
                      {hasSizes && (
                        <button
                          type="button"
                          title={isExpanded ? 'Recolher grade' : 'Ver grade por tamanho'}
                          onClick={() => setExpandedId(isExpanded ? null : req.id)}
                          className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-50 hover:bg-slate-100 text-slate-400'}`}
                        >
                          {isExpanded ? <ChevronUp size={20} strokeWidth={2.5} /> : <ChevronDown size={20} strokeWidth={2.5} />}
                        </button>
                      )}
                      <button
                        type="button"
                        title="Excluir solicitação"
                        onClick={() => setDeletingReq(req)}
                        className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400' : 'bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500'}`}
                      >
                        <Trash2 size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  <span className={`self-start flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-xl border ${sc.bg} ${sc.color} ${sc.border} uppercase tracking-widest`}>
                    {sc.icon} {sc.label}
                  </span>

                  <div className={`grid gap-2 ${req.contributingLots && req.contributingLots.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Quantidade</p>
                      <p className="text-sm font-black">{parseFloat((req.receivedQty || 0).toFixed(2))} / {parseFloat(req.requiredQty.toFixed(2))} {req.unit}</p>
                    </div>
                    {req.contributingLots && req.contributingLots.length > 0 && (
                      <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Mapas</p>
                        <p className="text-sm font-black">{req.contributingLots.length} {req.contributingLots.length === 1 ? 'Mapa' : 'Mapas'}</p>
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solicitado: {requestDate}{req.requestedBy ? ` • ${req.requestedBy}` : ''}</p>
                </div>

                {/* Grade tamanhos (solas) */}
                <AnimatePresence>
                  {isExpanded && req.type === 'SOLE' && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className={`border-t overflow-hidden ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}
                    >
                      {(() => {
                        const mold = productionConfigs.find(m => m.id === req.moldId);
                        const exactEntries = req.colorId
                          ? soleStock.filter(s => s.moldId === req.moldId && s.colorId === req.colorId)
                          : [];
                        const soleEntries = exactEntries.length > 0
                          ? exactEntries
                          : soleStock.filter(s => s.moldId === req.moldId);

                        const sizeToGradeCache: Record<string, string> = {};
                        const getGradeForSize = (size: string) => {
                          if (sizeToGradeCache[size]) return sizeToGradeCache[size];
                          for (const entry of soleEntries) {
                            for (const k of Object.keys(entry.stock)) {
                              const key = String(k).trim();
                              if (key === 'pesagem' || key === 'total') continue;
                              const parts = key.split('-').map(p => Math.round(parseFloat(p.trim())));
                              if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                                const sizeNum = Math.round(parseFloat(size));
                                if (sizeNum >= parts[0] && sizeNum <= parts[1]) {
                                  sizeToGradeCache[size] = key;
                                  return key;
                                }
                              } else if (key === size) {
                                sizeToGradeCache[size] = key;
                                return key;
                              }
                            }
                          }
                          return size;
                        };

                        const gradeStock: Record<string, number> = {};
                        soleEntries.forEach(e => {
                          if (e.stock) {
                            Object.entries(e.stock).forEach(([k, v]) => {
                              const key = String(k).trim();
                              if (key === 'pesagem' || key === 'total') return;
                              gradeStock[key] = (gradeStock[key] || 0) + (Number(v) || 0);
                            });
                          }
                        });

                        const displayGrades = new Set<string>();
                        Object.keys(req.sizeBreakdown || {}).forEach(size => {
                          displayGrades.add(getGradeForSize(size));
                        });
                        Object.keys(gradeStock).forEach(grade => displayGrades.add(grade));

                        const sortedGrades = Array.from(displayGrades).sort((a, b) => parseFloat(a) - parseFloat(b));

                        return (
                          <div className="flex flex-col">
                            <div className={`grid grid-cols-4 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'bg-slate-800/40 text-slate-500' : 'bg-slate-50/50 text-slate-400'}`}>
                              <span>Grade Sola</span>
                              <span className="text-center">Estoque</span>
                              <span className="text-center">Recebido</span>
                              <span className="text-right">Falta</span>
                            </div>
                            {sortedGrades.map(grade => {
                              const stock = gradeStock[grade] || 0;
                              const needed = Object.entries(req.sizeBreakdown || {})
                                .filter(([size]) => getGradeForSize(size) === grade)
                                .reduce((sum, [_, qty]) => sum + qty, 0);
                              
                              const received = Object.entries(req.receivedBreakdown || {})
                                .filter(([size]) => getGradeForSize(size) === grade)
                                .reduce((sum, [_, qty]) => sum + qty, 0);

                              const missing = Math.max(0, needed - received);
                              
                              if (stock === 0 && needed === 0 && received === 0) return null;

                              return (
                                <div key={grade} className={`grid grid-cols-4 px-6 py-4 border-t text-[13px] font-black ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                                  <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>{grade}</span>
                                  <span className={`text-center ${stock > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>{stock}</span>
                                  <span className={`text-center ${received > 0 ? 'text-indigo-500' : 'text-slate-300'}`}>{received}</span>
                                  <span className={`text-right ${missing > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{missing > 0 ? `-${missing}` : '✓'}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Ações */}
                <div className={`px-6 py-5 flex flex-col gap-3 border-t ${isDarkMode ? 'bg-slate-800/20 border-slate-800' : 'bg-slate-50/30 border-slate-100'}`}>
                  {req.status !== 'RECEIVED' && (
                    <div className="flex items-center gap-3">
                      {next && (
                        <button
                          type="button"
                          onClick={() => handleAdvance(req)}
                          disabled={isLoading}
                          className={`flex-1 h-12 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                            isLoading
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                              : 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-700'
                          }`}
                        >
                          {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : NEXT_LABEL[req.status]}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOrder(req)}
                        className={`flex items-center justify-center gap-2 px-5 h-12 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] border-2 transition-all active:scale-[0.98] ${
                          isDarkMode
                            ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-sm'
                        }`}
                      >
                        <ArrowUpRight size={16} strokeWidth={3} />
                        {req.type === 'SOLE' ? 'Comprar' : 'Compra'}
                      </button>
                    </div>
                  )}
                  {false && req.status === 'ORDERED' && (
                    <button
                      type="button"
                      onClick={() => openReceive(req)}
                      className={`w-full h-12 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 border-2 transition-all active:scale-[0.98] ${
                        isDarkMode
                          ? 'border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/20'
                          : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                    >
                      <PackageCheck size={16} strokeWidth={2.5} />
                      Registrar Recebimento
                    </button>
                  )}
                  {req.status === 'RECEIVED' && (
                    <div className="h-12 flex items-center justify-center gap-3 text-emerald-500 text-[12px] font-black uppercase tracking-[0.2em]">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <CheckCircle size={18} strokeWidth={3} />
                      </div>
                      Concluído
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* ── Modal: Editar Solicitação ── */}
      <AnimatePresence>
        {editingReq && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setEditingReq(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative w-full max-w-lg rounded-[3rem] p-8 pb-10 flex flex-col gap-6 shadow-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Editar</p>
                  <h3 className="text-lg font-black tracking-tight">{editingReq.name}</h3>
                </div>
                <button type="button" title="Fechar" onClick={() => setEditingReq(null)}
                  className={`w-10 h-10 flex items-center justify-center rounded-2xl ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>

              {/* Nome */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome / Descrição</label>
                <input
                  type="text"
                  title="Nome da solicitação"
                  placeholder="Nome do material..."
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className={`w-full px-5 py-4 rounded-2xl border-2 text-sm font-bold outline-none transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500'}`}
                />
              </div>

              {/* Quantidade (MATERIAL) */}
              {editingReq.type === 'MATERIAL' && (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quantidade Necessária ({editingReq.unit})</label>
                  <input
                    type="number"
                    min={0}
                    title="Quantidade necessária"
                    placeholder="0"
                    value={editQty}
                    onChange={e => setEditQty(Number(e.target.value))}
                    className={`w-full px-5 py-4 rounded-2xl border-2 text-sm font-bold outline-none transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500'}`}
                  />
                </div>
              )}

              {/* Grade (SOLE) */}
              {editingReq.type === 'SOLE' && Object.keys(editBreakdown).length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grade de Tamanhos (PAR)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(editBreakdown).sort(([a], [b]) => parseFloat(a) - parseFloat(b)).map(([grade, qty]) => (
                      <div key={grade} className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-400 text-center">{grade}</span>
                        <input
                          type="number"
                          min={0}
                          title={`Grade ${grade}`}
                          placeholder="0"
                          value={qty}
                          onChange={e => setEditBreakdown(prev => ({ ...prev, [grade]: Number(e.target.value) }))}
                          className={`w-full px-2 py-2 rounded-xl border-2 text-[12px] font-black text-center outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observações */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observações</label>
                <textarea
                  title="Observações"
                  placeholder="Observações adicionais..."
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={2}
                  className={`w-full px-5 py-4 rounded-2xl border-2 text-sm font-bold outline-none resize-none transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500'}`}
                />
              </div>

              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className={`w-full h-14 rounded-2xl text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${isSavingEdit ? 'bg-slate-300 text-slate-400' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-700'}`}
              >
                {isSavingEdit ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar Alterações'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal: Registrar Recebimento ── (disabled — receipt handled in GeneralReceiptsView) */}
      {/* State declarations for receivingReq, receiveQty, receiveBreakdown, isSavingReceive are kept above to avoid compile errors */}
      <AnimatePresence>
        {receivingReq && null}
      </AnimatePresence>

      {/* ── Modal: Excluir Solicitação ── */}
      <AnimatePresence>
        {deletingReq && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => !isDeleting && setDeletingReq(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative w-full max-w-lg rounded-[3rem] p-8 pb-10 flex flex-col gap-5 shadow-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Excluir solicitação</p>
                  <h3 className="text-lg font-black tracking-tight uppercase">{deletingReq.name}</h3>
                </div>
                <button type="button" title="Fechar" disabled={isDeleting} onClick={() => setDeletingReq(null)}
                  className={`w-10 h-10 flex items-center justify-center rounded-2xl ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>

              <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                Escolha o que fazer com esta necessidade ao excluí-la:
              </p>

              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteBackToPCP(deletingReq)}
                className={`flex flex-col items-start gap-1.5 text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.99] ${isDarkMode ? 'border-slate-800 hover:border-indigo-700 hover:bg-indigo-950/20' : 'border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50'}`}
              >
                <span className="flex items-center gap-2 text-[12px] font-black uppercase tracking-widest text-indigo-500">
                  <RotateCcw size={16} strokeWidth={2.5} /> Excluir e voltar ao PCP
                </span>
                <span className="text-[10px] font-bold text-slate-400 normal-case leading-relaxed">
                  Remove esta solicitação e a marcação "Solicitado" — a necessidade volta a aparecer em Necessidades de Compra do PCP para ser solicitada novamente.
                </span>
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteAndPurchaseManually(deletingReq)}
                className={`flex flex-col items-start gap-1.5 text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.99] ${isDarkMode ? 'border-slate-800 hover:border-emerald-700 hover:bg-emerald-950/20' : 'border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50'}`}
              >
                <span className="flex items-center gap-2 text-[12px] font-black uppercase tracking-widest text-emerald-500">
                  <ArrowUpRight size={16} strokeWidth={2.5} /> Excluir e comprar manualmente
                </span>
                <span className="text-[10px] font-bold text-slate-400 normal-case leading-relaxed">
                  Marca esta necessidade como não sendo mais necessária e abre o formulário de compra correspondente para lançar o pedido manualmente.
                </span>
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingReq(null)}
                className="text-center text-[11px] font-black uppercase tracking-widest text-slate-400 py-2"
              >
                {isDeleting ? 'Excluindo...' : 'Cancelar'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

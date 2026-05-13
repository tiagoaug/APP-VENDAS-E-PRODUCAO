import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, ChevronRight, Filter, 
  Factory, LayoutDashboard, ListTodo, 
  History, MoreVertical, ArrowRight,
  CheckCircle2, AlertCircle, Clock,
  ArrowUpRight, ArrowDownRight,
  Settings2, Trash2, Edit3, ClipboardList,
  Save, X, Info, Layers, Tag, Package
} from 'lucide-react';
import {
  ProductionLot, Product, Sector,
  FlowTag, Variation, ColorValue, ProductionOrder
} from '../types';
import Modal from '../components/Modal';
import ComboBox from '../components/ComboBox';
import ScannerModal from '../components/ScannerModal';
import { Camera } from 'lucide-react';
import { labelService } from '../services/labelService';

interface PCPViewProps {
  lots: ProductionLot[];
  products: Product[];
  sectors: Sector[];
  flowTags: FlowTag[];
  colors: ColorValue[];
  productionOrders: ProductionOrder[];
  isDarkMode: boolean;
  onSaveLot: (lot: ProductionLot) => Promise<void>;
  onDeleteLot: (id: string) => Promise<void>;
  onBack: () => void;
  userName?: string;
}

export default function PCPView({
  lots, products, sectors, flowTags, colors,
  productionOrders,
  isDarkMode, onSaveLot, onDeleteLot, onBack, userName
}: PCPViewProps) {
  const [activeTab, setActiveTab] = useState<'monitor' | 'lots' | 'orders'>('monitor');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<ProductionLot | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Filtered and organized data
  const filteredLots = useMemo(() => {
    return lots.filter(l => {
      const product = products.find(p => p.id === l.productId);
      const searchStr = `${l.orderNumber} ${product?.name} ${product?.reference}`.toLowerCase();
      return searchStr.includes(searchTerm.toLowerCase());
    });
  }, [lots, products, searchTerm]);

  const activeLots = useMemo(() => filteredLots.filter(l => !l.finishedAt), [filteredLots]);

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

    activeLots.forEach(lot => {
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

        if (lot.priority === 'URGENT' || lot.priority === 'HIGH') {
          metrics[sectorId].urgentCount += 1;
        }
      }
    });

    return metrics;
  }, [activeLots, sectors]);

  // WIP calculation per sector
  const wipPerSector = useMemo(() => {
    const counts: Record<string, number> = {};
    activeLots.forEach(lot => {
      const sectorId = (lot.route && lot.route[lot.currentSectorIndex]) || 'UNKNOWN';
      counts[sectorId] = (counts[sectorId] || 0) + lot.quantity;
    });
    return counts;
  }, [activeLots]);

  // Lot Creation State
  const [newLot, setNewLot] = useState<Partial<ProductionLot>>({
    priority: 'NORMAL',
    quantity: 0
  });

  const handleCreateLot = async () => {
    if (!newLot.productId || !newLot.variationId || !newLot.quantity) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    const product = products.find(p => p.id === newLot.productId);
    if (!product) return;

    const lot: ProductionLot = {
      id: Math.random().toString(36).substr(2, 9),
      orderNumber: `Lote #${String(lots.length + 1).padStart(3, '0')}`,
      productId: newLot.productId,
      variationId: newLot.variationId,
      quantity: newLot.quantity,
      route: product.productionRoute || sectors.map(s => s.id),
      currentSectorIndex: 0,
      priority: newLot.priority || 'NORMAL',
      history: [{
        sectorId: (product.productionRoute || sectors.map(s => s.id))[0],
        statusId: '',
        timestamp: Date.now(),
        userName: userName,
        notes: newLot.productionOrderId ? `Criado via ${newLot.productionOrderId}` : 'Lote criado'
      }],
      createdAt: Date.now(),
      ...(newLot.saleId && { saleId: newLot.saleId }),
      ...(newLot.productionOrderId && { productionOrderId: newLot.productionOrderId }),
      ...(newLot.customerName && { customerName: newLot.customerName }),
      ...(newLot.deliveryDate && { deliveryDate: newLot.deliveryDate }),
      ...(newLot.saleOrderNumber && { saleOrderNumber: newLot.saleOrderNumber }),
    };

    await onSaveLot(lot);
    setIsCreateModalOpen(false);
    setNewLot({ priority: 'NORMAL', quantity: 0 });
  };

  const handleMoveLot = async (lot: ProductionLot, nextStatusId: string, notes: string) => {
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
    setIsDetailModalOpen(false);
    setSelectedLot(null);
  };

  const handleScanLotResult = async (result: any) => {
    if (result.type === 'LOT') {
      const lotId = result.lotId;
      const lot = lots.find(l => l.id === lotId);
      if (!lot) {
        alert('Lote não encontrado.');
        return;
      }

      if (lot.finishedAt) {
        alert('Este lote já foi finalizado.');
        return;
      }

      const currentSectorId = lot.route[lot.currentSectorIndex];
      const currentSector = sectors.find(s => s.id === currentSectorId);
      const nextSectorId = lot.route[lot.currentSectorIndex + 1];
      const nextSector = nextSectorId ? sectors.find(s => s.id === nextSectorId) : null;

      const message = nextSector 
        ? `Lote identificado: ${lot.orderNumber}\nSetor Atual: ${currentSector?.name}\n\nConfirma a movimentação para o próximo setor: ${nextSector.name}?`
        : `Lote identificado: ${lot.orderNumber}\n\nEste é o último setor (${currentSector?.name}). Confirma a finalização deste lote?`;

      if (confirm(message)) {
        await handleMoveLot(lot, '', 'Movimentação automática via Scanner');
        alert('Movimentação registrada com sucesso!');
      }
    }
  };

  const handlePrintLotLabel = (lot: ProductionLot) => {
    const product = products.find(p => p.id === lot.productId);
    const variation = product?.variations.find(v => v.id === lot.variationId);
    labelService.printLotLabel(lot, product?.name || 'Produto', variation?.colorName || 'Cor');
  };

  return (
    <div className={`flex flex-col gap-6 pb-32 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <header className="flex flex-col gap-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              title="Voltar ao Painel"
              aria-label="Voltar para a tela anterior"
              className={`p-3 rounded-2xl transition-all ${isDarkMode ? 'bg-slate-900 text-slate-400 hover:text-white' : 'bg-white text-slate-400 hover:text-slate-900 shadow-sm border border-slate-100'}`}
            >
              <ChevronRight className="rotate-180" size={20} />
            </button>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">PCP Central</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Planejamento e Controle de Produção</p>
            </div>
          </div>
           <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-2 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
            >
              <Camera size={16} strokeWidth={3} /> Escanear
            </button>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Plus size={16} strokeWidth={3} /> Iniciar Lote
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit self-center">
          <button
            onClick={() => { setActiveTab('monitor'); setSelectedSectorId(null); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'monitor' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
          >
            <LayoutDashboard size={14} /> Monitor WIP
          </button>
          <button
            onClick={() => { setActiveTab('lots'); setSelectedSectorId(null); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'lots' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
          >
            <ListTodo size={14} /> Lotes
          </button>
          <button
            onClick={() => { setActiveTab('orders'); setSelectedSectorId(null); }}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'orders' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
          >
            <ClipboardList size={14} /> Pedidos
            {productionOrders.filter(o => o.status === 'PENDING').length > 0 && (
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[8px] font-black flex items-center justify-center">
                {productionOrders.filter(o => o.status === 'PENDING').length}
              </span>
            )}
          </button>
        </div>
      </header>

      {activeTab === 'monitor' ? (
        <div className="flex flex-col gap-8">
          {/* WIP Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-6 rounded-[2rem] border flex flex-col gap-1 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total em Produção</span>
              <span className="text-3xl font-black text-indigo-600">{activeLots.reduce((acc, l) => acc + l.quantity, 0)} <span className="text-xs text-slate-400">Pares</span></span>
            </div>
            <div className={`p-6 rounded-[2rem] border flex flex-col gap-1 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lotes Ativos</span>
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
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lotes WIP</span>
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
              <div className="flex items-center justify-between px-2">
                <button 
                  onClick={() => setSelectedSectorId(null)}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:gap-3 transition-all"
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeLots.filter(l => l.route && l.route[l.currentSectorIndex] === selectedSectorId).map(lot => {
                  const product = products.find(p => p.id === lot.productId);
                  const variation = product?.variations.find(v => v.id === lot.variationId);
                  const status = flowTags.find(t => t.id === lot.currentStatusId);
                  const lastMove = (lot.history && lot.history.length > 0) 
                    ? lot.history[lot.history.length - 1]?.timestamp || lot.createdAt 
                    : lot.createdAt;
                  const isDelayed = Date.now() - lastMove > 24 * 60 * 60 * 1000;
                  
                  return (
                    <motion.div
                      layoutId={lot.id}
                      key={lot.id}
                      onClick={() => {
                        setSelectedLot(lot);
                        setIsDetailModalOpen(true);
                      }}
                      className={`group p-6 rounded-[2.5rem] border-2 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-95 transition-all ${
                        isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-100 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex flex-col gap-1.5">
                          <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest w-fit ${
                            lot.priority === 'URGENT' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' :
                            lot.priority === 'HIGH' ? 'bg-amber-500 text-white' :
                            isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {lot.priority}
                          </span>
                          {isDelayed && (
                            <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                              <Clock size={10} /> Atrasado há {Math.floor((Date.now() - lastMove) / (1000 * 60 * 60))}h
                            </span>
                          )}
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
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300">{lot.quantity} <span className="text-[9px] text-slate-400 font-bold">PARES</span></span>
                        </div>
                        
                        {status ? (
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isDarkMode ? 'bg-indigo-900/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                            <Clock size={12} />
                            <span className="text-[10px] font-black uppercase tracking-wider">{status.name}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400">
                            <History size={12} />
                            <span className="text-[10px] font-black uppercase tracking-wider">Aguardando</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                {activeLots.filter(l => l.route && l.route[l.currentSectorIndex] === selectedSectorId).length === 0 && (
                  <div className="col-span-full py-20 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem] flex flex-col items-center justify-center text-slate-300 dark:text-slate-700">
                    <div className="w-20 h-20 rounded-[2.5rem] bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-4">
                      <Clock size={40} className="opacity-20" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest">Sem lotes ativos neste setor</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2">Novos lotes aparecerão aqui conforme a produção avançar</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'orders' ? (
        <div className="flex flex-col gap-4">
          {productionOrders.length === 0 ? (
            <div className={`py-20 rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center gap-3 ${isDarkMode ? 'border-slate-800 text-slate-700' : 'border-slate-100 text-slate-300'}`}>
              <ClipboardList size={40} className="opacity-30" />
              <p className="text-xs font-black uppercase tracking-widest">Nenhum pedido de produção</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Gere um pelo módulo de Vendas</p>
            </div>
          ) : (
            productionOrders
              .sort((a, b) => a.deliveryDate - b.deliveryDate)
              .map(order => {
                const orderLots = lots.filter(l => l.productionOrderId === order.id);
                const isOverdue = order.deliveryDate < Date.now() && order.status !== 'COMPLETED';
                return (
                  <div key={order.id} className={`p-5 rounded-3xl border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-xl">{order.orderNumber}</span>
                          <span className="text-[9px] font-bold text-slate-400">Pedido #{order.saleOrderNumber}</span>
                        </div>
                        <p className={`text-base font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{order.customerName}</p>
                      </div>
                      <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${
                        order.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        order.status === 'IN_PRODUCTION' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
                        'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {order.status === 'COMPLETED' ? 'Concluído' : order.status === 'IN_PRODUCTION' ? 'Em Produção' : 'Pendente'}
                      </span>
                    </div>

                    {/* Dates */}
                    <div className="flex gap-3 mb-4">
                      <div className={`flex-1 p-3 rounded-xl flex items-center gap-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                        <Clock size={12} className="text-slate-400" />
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase">Pedido</p>
                          <p className={`text-[10px] font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{new Date(order.orderDate).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                      <div className={`flex-1 p-3 rounded-xl flex items-center gap-2 ${isOverdue ? 'bg-rose-50 dark:bg-rose-900/20' : isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                        <CheckCircle2 size={12} className={isOverdue ? 'text-rose-500' : 'text-emerald-500'} />
                        <div>
                          <p className={`text-[8px] font-black uppercase ${isOverdue ? 'text-rose-500' : 'text-slate-400'}`}>Entrega</p>
                          <p className={`text-[10px] font-black ${isOverdue ? 'text-rose-500' : isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{new Date(order.deliveryDate).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Items summary */}
                    <div className="flex flex-col gap-1.5 mb-4">
                      {order.items.map((item, i) => (
                        <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                          <div>
                            <span className={`text-[10px] font-black uppercase ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{item.productName}</span>
                            <span className="text-[9px] font-bold text-slate-400 ml-2">{item.variationName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {item.fromStockQty > 0 && <span className="text-[9px] font-black text-emerald-500">Estoque: {item.fromStockQty}</span>}
                            <span className="text-[9px] font-black text-indigo-500">Produzir: {item.toProductionQty}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Lots + action */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {orderLots.length} lote(s) vinculado(s)
                      </span>
                      {order.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => {
                            const firstItem = order.items[0];
                            if (firstItem) {
                              setNewLot({
                                priority: 'NORMAL',
                                quantity: firstItem.toProductionQty,
                                productId: firstItem.productId,
                                variationId: firstItem.variationId,
                                saleId: order.saleId,
                                productionOrderId: order.id,
                                customerName: order.customerName,
                                deliveryDate: order.deliveryDate,
                                saleOrderNumber: order.saleOrderNumber,
                              });
                              setIsCreateModalOpen(true);
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95"
                        >
                          <Plus size={12} strokeWidth={3} /> Iniciar Lote
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por lote, modelo ou referência..."
              className={`w-full pl-14 pr-6 py-5 rounded-[2rem] border-2 transition-all outline-none text-sm font-black uppercase tracking-wider ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-600 shadow-sm'}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
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
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                        {product?.name} • {variation?.colorName} • {lot.quantity} PARES
                        {lot.customerName && ` • ${lot.customerName}`}
                      </p>
                      {lot.deliveryDate && (
                        <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${lot.deliveryDate < Date.now() ? 'text-rose-500' : 'text-slate-400'}`}>
                          Entrega: {new Date(lot.deliveryDate).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">{sector?.name || 'FIM'}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(lot.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  <ChevronRight size={18} className="text-slate-300" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Criar Lote */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Iniciar Novo Lote de Produção"
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
              <div className="grid grid-cols-2 gap-2">
                {(['NORMAL', 'HIGH', 'URGENT'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setNewLot({ ...newLot, priority: p })}
                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border-2 ${newLot.priority === p ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-50 dark:bg-slate-800 border-transparent text-slate-500'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleCreateLot}
            className="w-full mt-4 py-5 bg-indigo-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Confirmar Abertura de Lote
          </button>
        </div>
      </Modal>

      {/* Modal Detalhe / Apontamento */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={selectedLot?.orderNumber || 'Detalhes do Lote'}
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
                    <button 
                      onClick={() => handlePrintLotLabel(selectedLot)}
                      className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all"
                      title="Imprimir Etiqueta"
                    >
                      <Tag size={14} strokeWidth={3} />
                    </button>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{product?.name} • {variation?.colorName}</p>
                  <div className="flex items-center justify-center sm:justify-start gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: variation?.color }} />
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300">{selectedLot.quantity} <span className="text-[9px] text-slate-400">Pares</span></span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">{selectedLot.priority}</span>
                  </div>
                </div>
              </div>

              {!isFinished && (
                <div className="flex flex-col gap-6">
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
                </div>
              )}

              {/* History Timeline */}
              <div className="flex flex-col gap-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Histórico de Movimentação</h4>
                <div className="flex flex-col gap-3">
                  {selectedLot.history.sort((a, b) => b.timestamp - a.timestamp).map((h, i) => {
                    const sector = sectors.find(s => s.id === h.sectorId);
                    const tag = flowTags.find(t => t.id === h.statusId);
                    return (
                      <div key={i} className={`p-4 rounded-2xl border flex items-center gap-4 ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${i === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                          {i === 0 ? <Clock size={16} /> : <History size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">{sector?.name || '---'}</span>
                            <span className="text-[8px] font-bold text-slate-400">{new Date(h.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{tag?.name || 'MIGRAÇÃO'}</span>
                            {h.notes && <span className="text-[9px] text-slate-400 font-bold italic truncate">• {h.notes}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delete Option */}
              <div className="mt-4 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={async () => {
                    if (confirm('Deseja excluir este lote permanentemente?')) {
                      await onDeleteLot(selectedLot.id);
                      setIsDetailModalOpen(false);
                      setSelectedLot(null);
                    }
                  }}
                  title="Excluir Lote Permanentemente"
                  aria-label="Excluir este lote de produção"
                  className="flex items-center gap-2 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                >
                  <Trash2 size={14} /> Excluir Lote
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
        title="Escanear Lote"
      />
    </div>
  );
}

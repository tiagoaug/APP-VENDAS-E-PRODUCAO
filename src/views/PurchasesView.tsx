import { useState, useMemo } from "react";
import { Purchase, Person, PurchaseType, PaymentStatus } from "../types";
import {
  ShoppingCart,
  Plus,
  Package,
  Calendar,
  History,
  Trash2,
  Edit2, // Added
  MessageSquare,
  X, // Added
  Search,
  Filter,
  Clipboard,
  Hash,
} from "lucide-react";
import { format, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import ConfirmDialog from "../components/ConfirmDialog";
import ChecksModal from "../components/ChecksModal";

interface PurchasesViewProps {
  purchases: Purchase[];
  suppliers: Person[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (purchase: Purchase) => void;
  isDarkMode: boolean;
  initialSearchQuery?: string;
}

export default function PurchasesView({
  purchases,
  suppliers,
  onAdd,
  onEdit,
  onDelete,
  onUpdate,
  isDarkMode,
  initialSearchQuery = '',
}: PurchasesViewProps) {
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [typeFilter, setTypeFilter] = useState<'ALL' | PurchaseType>('ALL');
  const [periodFilter, setPeriodFilter] = useState<string>(''); // YYYY-MM

  const [selectedPurchaseForChecks, setSelectedPurchaseForChecks] = useState<Purchase | null>(null);
  const [isChecksModalOpen, setIsChecksModalOpen] = useState(false);
  
  const filteredPurchases = useMemo(() => {
    return purchases.filter(purchase => {
      // Filter by type
      if (typeFilter !== 'ALL' && purchase.type !== typeFilter) return false;
      
      // Filter by period
      if (periodFilter) {
        const pDate = new Date(purchase.date);
        const filterStr = format(pDate, 'yyyy-MM');
        if (filterStr !== periodFilter) return false;
      }
      
      // Filter by supplier / search
      if (searchQuery.trim()) {
        const supplier = suppliers.find((s) => s.id === purchase.supplierId);
        const lowerSearch = searchQuery.toLowerCase();
        
        const supplierMatch = supplier?.name.toLowerCase().includes(lowerSearch);
        const noteMatch = purchase.notes?.toLowerCase().includes(lowerSearch);
        
        if (!supplierMatch && !noteMatch) return false;
      }
      
      return true;
    }).sort((a, b) => b.date - a.date);
  }, [purchases, suppliers, typeFilter, periodFilter, searchQuery]);

  // Generate available months from data
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    purchases.forEach(p => {
      months.add(format(p.date, 'yyyy-MM'));
    });
    return Array.from(months).sort().reverse(); // newest first
  }, [purchases]);

  return (
    <div className="flex flex-col gap-4 pb-24 px-4 bg-[#fafafa] dark:bg-slate-950 min-h-screen">
      <ConfirmDialog
        isOpen={!!itemToDelete}
        title="Excluir Compra?"
        message="Deseja realmente excluir esta compra e reverter os lançamentos financeiros/estoque? Esta ação não pode ser desfeita."
        confirmLabel="Sim, Excluir"
        cancelLabel="Agora não"
        onConfirm={() => {
          if (itemToDelete) {
            onDelete(itemToDelete);
            setItemToDelete(null);
          }
        }}
        onCancel={() => setItemToDelete(null)}
        isDanger={true}
      />

      {/* Note Modal */}
      {selectedNote && (
        <div className="fixed inset-0 z-[100] flex animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSelectedNote(null)}
          />
          <div className="relative m-auto w-[90%] max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white">Observação</h3>
              <button
                title="Fechar"
                aria-label="Fechar observação"
                onClick={() => setSelectedNote(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-sm whitespace-pre-line">
              {selectedNote}
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between pt-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Compras
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Histórico de entradas
          </p>
        </div>
        <button
          onClick={onAdd}
          title="Nova Compra"
          aria-label="Adicionar nova compra"
          className="bg-blue-600 text-white p-3 rounded-[1rem] shadow-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer hover:bg-blue-700"
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex flex-col gap-3 mt-2">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar fornecedor ou nota..."
            title="Pesquisar"
            className={`w-full pl-10 pr-4 py-3 rounded-2xl text-[13px] font-bold outline-none transition-all ${isDarkMode ? "bg-slate-900 text-white placeholder-slate-500 focus:ring-2 focus:ring-slate-700" : "bg-white text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-slate-200 shadow-sm border border-slate-100"}`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {/* Purchase Type Filter */}
          <div className={`flex flex-1 border p-1 rounded-2xl shadow-sm dark:shadow-none ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <button 
              onClick={() => setTypeFilter('ALL')}
              className={`flex-1 px-2 py-1.5 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest ${typeFilter === 'ALL' ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setTypeFilter(PurchaseType.REPLENISHMENT)}
              className={`flex-1 px-2 py-1.5 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest ${typeFilter === PurchaseType.REPLENISHMENT ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              Estoque
            </button>
            <button 
              onClick={() => setTypeFilter(PurchaseType.GENERAL)}
              className={`flex-1 px-2 py-1.5 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest ${typeFilter === PurchaseType.GENERAL ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
              Geral
            </button>
          </div>

          {/* Period Filter */}
          <select
            className={`min-w-[100px] px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none border shadow-sm dark:shadow-none ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-800"} focus:ring-2 focus:ring-indigo-500`}
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            title="Filtrar por Período"
          >
            <option value="">MESES</option>
            {availableMonths.map(month => {
               const [y, m] = month.split('-');
               const date = new Date(parseInt(y), parseInt(m)-1);
               return (
                 <option key={month} value={month}>
                   {format(date, 'MMM yy', { locale: ptBR })}
                 </option>
               )
            })}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-2">
        {filteredPurchases.map((purchase) => {
          const supplier = suppliers.find((s) => s.id === purchase.supplierId);
          const itemCount = purchase.type === PurchaseType.GENERAL 
            ? (purchase.generalItems?.length || 0)
            : (purchase.items?.length || 0);

          return (
            <div
              key={purchase.id}
              onClick={() => onEdit(purchase.id)}
              className={`p-5 rounded-[1.5rem] border flex flex-col gap-4 relative overflow-hidden group cursor-pointer ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
            >
              <div className="flex justify-between items-start z-10">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center justify-center transition-colors ${purchase.type === PurchaseType.REPLENISHMENT ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"}`}
                  >
                    {purchase.type === PurchaseType.REPLENISHMENT ? (
                      <Package size={32} strokeWidth={2.5} />
                    ) : (
                      <ShoppingCart size={32} strokeWidth={2.5} />
                    )}
                  </div>
                  <div>
                    <h3
                      className={`font-extrabold text-[13px] tracking-tight leading-none uppercase ${isDarkMode ? "text-white" : "text-slate-800"}`}
                    >
                      {supplier?.name || "Fornecedor"}
                    </h3>
                    <div className="flex flex-col gap-1.5 mt-1.5">
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                        <Calendar size={12} strokeWidth={3} />
                        {format(purchase.date, "dd MMM yyyy", { locale: ptBR })}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-indigo-500 dark:text-indigo-400 font-black uppercase tracking-widest">
                        <Hash size={12} strokeWidth={3} />
                        #{purchase.batchNumber || purchase.id.slice(-6).toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5">
                  <p
                    className="text-[15px] font-black tracking-tight leading-none text-rose-600 dark:text-rose-400"
                  >
                    R$ {purchase.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="flex flex-wrap justify-end gap-1">
                    <span
                      className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg leading-none inline-block tracking-widest ${purchase.type === PurchaseType.REPLENISHMENT ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}
                    >
                      {purchase.type === PurchaseType.REPLENISHMENT
                        ? "Estoque"
                        : "Geral"}
                    </span>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg leading-none inline-block tracking-widest ${
                      purchase.generateTransaction === false 
                        ? "bg-slate-400 text-white shadow-lg shadow-slate-400/20" 
                        : (purchase.paymentStatus === PaymentStatus.PAID 
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                            : 'bg-amber-500 text-white shadow-lg shadow-amber-500/20')
                    }`}>
                      {purchase.generateTransaction === false 
                        ? 'Não Contábil' 
                        : (purchase.paymentStatus === PaymentStatus.PAID ? 'Quitada' : 'Pendente')}
                    </span>
                    {purchase.checks && purchase.checks.length > 0 && (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPurchaseForChecks(purchase);
                          setIsChecksModalOpen(true);
                        }}
                        className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg leading-none inline-block tracking-widest bg-blue-500 text-white shadow-lg shadow-blue-500/20 cursor-pointer hover:scale-105 transition-all"
                      >
                        Com Cheques
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Checks Button (More visible highlight) */}
              {purchase.checks && purchase.checks.length > 0 && (
                <div className="px-4 pb-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPurchaseForChecks(purchase);
                      setIsChecksModalOpen(true);
                    }}
                    className={`w-full py-3 rounded-xl border flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] ${
                      isDarkMode 
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20' 
                        : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100'
                    }`}
                  >
                    <Clipboard size={14} className={isDarkMode ? "text-blue-400" : "text-blue-500"} strokeWidth={3} />
                    Ver Histórico de Cheques
                  </button>
                </div>
              )}

              <div className="pt-4 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {/* Items are no longer displayed as dots */}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(purchase.id);
                    }}
                    title="Editar Compra"
                    aria-label="Editar esta compra"
                    className="p-2 text-slate-300 dark:text-slate-600 hover:text-indigo-500 transition-colors transform active:scale-90"
                  >
                    <Edit2 size={20} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setItemToDelete(purchase.id);
                    }}
                    title="Excluir Compra"
                    aria-label="Excluir esta compra"
                    className="p-2 text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors transform active:scale-90"
                  >
                    <Trash2 size={20} strokeWidth={2.5} />
                  </button>
                  {purchase.notes && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNote(purchase.notes || null);
                      }}
                      className="p-2 text-amber-500 dark:text-amber-400 active:scale-90"
                      title="Ver Observações"
                      aria-label="Ver observações desta compra"
                    >
                      <MessageSquare size={18} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>


              {/* Subtle background decoration */}
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-10 text-slate-900 dark:text-white pointer-events-none group-hover:scale-110 transition-transform duration-500">
                <History size={80} strokeWidth={1} />
              </div>
            </div>
          );
        })}

        {filteredPurchases.length === 0 && (
          <div
            className={`flex flex-col items-center justify-center p-8 border rounded-[1rem] ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
          >
            <History size={40} className="mb-3 opacity-20 text-slate-400" />
            <p className="text-slate-500 text-sm">
              Nenhuma entrada encontrada.
            </p>
          </div>
        )}
      </div>

      {selectedPurchaseForChecks && (
        <ChecksModal 
          isOpen={isChecksModalOpen}
          onClose={() => {
            setIsChecksModalOpen(false);
            setSelectedPurchaseForChecks(null);
          }}
          purchase={selectedPurchaseForChecks}
          supplier={suppliers.find(p => p.id === selectedPurchaseForChecks.supplierId)}
          isDarkMode={isDarkMode}
          onUpdateCheque={(chequeId, newStatus) => {
            if (!selectedPurchaseForChecks.checks) return;
            
            const updatedChecks = selectedPurchaseForChecks.checks.map(c => 
              c.id === chequeId ? { ...c, status: newStatus } : c
            );
            
            const updatedPurchase = {
              ...selectedPurchaseForChecks,
              checks: updatedChecks
            };
            
            onUpdate(updatedPurchase);
            setSelectedPurchaseForChecks(updatedPurchase);
          }}
        />
      )}
    </div>
  );
}

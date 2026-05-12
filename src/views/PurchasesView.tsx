import { useState, useMemo } from "react";
import { Purchase, Person, PurchaseType, PaymentStatus, PaymentTerm } from "../types";
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
  Lightbulb,
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
      if (periodFilter && purchase.date) {
        const pDate = new Date(purchase.date);
        if (!isNaN(pDate.getTime())) {
          const filterStr = format(pDate, 'yyyy-MM');
          if (filterStr !== periodFilter) return false;
        } else {
          return false;
        }
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
      if (p.date) {
        const d = new Date(p.date);
        if (!isNaN(d.getTime())) {
          months.add(format(d, 'yyyy-MM'));
        }
      }
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
              className={`px-4 py-2 rounded-xl text-[10px] font-bold tracking-wider transition-all whitespace-nowrap ${typeFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setTypeFilter(PurchaseType.REPLENISHMENT)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold tracking-wider transition-all whitespace-nowrap ${typeFilter === PurchaseType.REPLENISHMENT ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Estoque
            </button>
            <button 
              onClick={() => setTypeFilter(PurchaseType.GENERAL)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold tracking-wider transition-all whitespace-nowrap ${typeFilter === PurchaseType.GENERAL ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              Geral
            </button>
          </div>

          {/* Period Filter */}
          <select
            className={`min-w-[100px] px-3 py-1.5 rounded-2xl text-[10px] font-bold tracking-wider outline-none border shadow-sm dark:shadow-none ${isDarkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-800"} focus:ring-2 focus:ring-indigo-500`}
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            title="Filtrar por Período"
          >
            <option value="">Meses</option>
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
          
          const isLate = purchase.dueDate && new Date(purchase.dueDate) < new Date() && purchase.paymentStatus !== PaymentStatus.PAID;

          return (
            <div
              key={purchase.id}
              onClick={() => onEdit(purchase.id)}
              className={`p-5 rounded-[1.5rem] border flex flex-col gap-4 relative overflow-hidden group cursor-pointer ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
            >
              <div className="flex justify-between items-start z-10 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${purchase.type === PurchaseType.REPLENISHMENT ? "bg-indigo-600 text-white shadow-indigo-200" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}
                  >
                    {purchase.type === PurchaseType.REPLENISHMENT ? (
                      <Package size={28} strokeWidth={2.5} />
                    ) : (
                      <ShoppingCart size={28} strokeWidth={2.5} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3
                      className={`font-black text-base tracking-tight leading-none truncate mb-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}
                    >
                      {supplier?.name || "Fornecedor"}
                    </h3>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        {purchase.sellerName && (
                          <span className="text-[7px] font-bold px-2 py-0.5 rounded-md leading-none tracking-wider bg-indigo-600 text-white shadow-sm">
                            {purchase.sellerName}
                          </span>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-bold text-slate-400 tracking-wider mt-0.5">
                          <Calendar size={12} strokeWidth={3} />
                          {purchase.date ? (
                          (() => {
                            const d = new Date(purchase.date);
                            return isNaN(d.getTime()) ? "Data Inválida" : format(d, "dd MMM yyyy", { locale: ptBR });
                          })()
                        ) : "Sem Data"}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-indigo-500 dark:text-indigo-400 font-bold tracking-wider">
                        <Hash size={12} strokeWidth={3} />
                        #{purchase.batchNumber || purchase.id.slice(-6).toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex flex-col gap-1.5 items-end">
                    {purchase.dueDate && purchase.paymentStatus === PaymentStatus.PENDING && (
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-bold tracking-wider ${isLate ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'}`}>
                        Venc: {purchase.dueDate ? format(new Date(purchase.dueDate), "dd/MM/yyyy") : 'Inválida'}
                      </span>
                    )}
                    {purchase.generateTransaction === false && <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[8px] font-bold tracking-wider">Não Contábil</span>}
                    {purchase.paymentTerm === PaymentTerm.CASH ? (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-500 text-[8px] font-bold tracking-wider">Compra • Quitada</span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-bold tracking-wider ${purchase.paymentStatus === PaymentStatus.PAID ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                        {purchase.paymentStatus === PaymentStatus.PAID ? 'Compra • Quitada' : 'Compra • Prazo'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Content Row: Summary & Large Price */}
              <div className="flex justify-between items-end z-10 gap-6 mt-1">
                <div className="flex-1 flex flex-col gap-2">
                   {/* Checks Button (More visible highlight) */}
                    {purchase.checks && purchase.checks.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPurchaseForChecks(purchase);
                            setIsChecksModalOpen(true);
                          }}
                          title="Ver Histórico de Cheques"
                          aria-label="Ver Histórico de Cheques"
                          className={`py-2 px-3 rounded-xl border flex items-center gap-2 text-[8px] font-black tracking-widest transition-all active:scale-[0.98] w-fit ${
                            isDarkMode 
                              ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20' 
                              : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100 shadow-sm'
                          }`}
                        >
                          <Clipboard size={14} strokeWidth={3} />
                          Histórico de Cheques
                        </button>
                    )}
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest leading-none">
                       {itemCount} {itemCount === 1 ? 'Lançamento' : 'Lançamentos'}
                    </span>
                </div>

                {/* Price Display (Right) */}
                <div className="flex flex-col items-end shrink-0 justify-end min-w-fit">
                   <h3 className={`font-black text-xs tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      R$ {purchase.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </h3>
                </div>
              </div>

              {/* Action Bar (Footer) */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800/50 z-10">
                <div className="flex items-center">
                  {/* Note Modal Toggle */}
                  {purchase.notes && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNote(purchase.notes || "");
                      }}
                      title="Ver Observações"
                      aria-label="Ver Observações"
                      className="w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-90 relative bg-[#fffbeb] text-rose-500 shadow-xl shadow-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:shadow-none"
                    >
                      <Lightbulb size={24} strokeWidth={2.5} className="animate-pulse-lamp" />
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 border-2 border-white dark:border-slate-900 rounded-full" />
                    </button>
                  )}
                </div>

                {/* Actions Group (Floating Island) */}
                <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-slate-50/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 shadow-sm backdrop-blur-md relative">
                  {/* Edit Button */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(purchase.id); }}
                    className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 text-blue-500 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>

                  {/* Delete Button */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); setItemToDelete(purchase.id); }}
                    className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 text-rose-500 rounded-full shadow-sm hover:shadow-md transition-all active:scale-90"
                    title="Excluir"
                    aria-label="Excluir compra"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Subtle background decoration */}
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] dark:opacity-10 text-slate-900 dark:text-white pointer-events-none group-hover:scale-110 transition-transform duration-500">
                <History size={120} strokeWidth={1} />
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


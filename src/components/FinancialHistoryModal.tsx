import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Search } from "lucide-react";
import { Person, Sale, Purchase, Transaction, SaleStatus } from "../types";

interface FinancialHistoryModalProps {
  person: Person;
  sales: Sale[];
  purchases: Purchase[];
  transactions: Transaction[];
  onClose: () => void;
  isDarkMode: boolean;
}

export default function FinancialHistoryModal({
  person,
  sales,
  purchases,
  transactions,
  onClose,
  isDarkMode,
}: FinancialHistoryModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("ALL");

  const personSales = sales.filter((s) => s.customerId === person.id && s.status === SaleStatus.SALE);
  const personPurchases = purchases.filter((p) => p.supplierId === person.id);
  const personTransactions = transactions.filter((t) => t.contactId === person.id);

  const history = [
    ...personSales.map((s) => ({ ...s, type: "SALE" as const, date: s.date, value: s.total })),
    ...personPurchases.map((p) => ({ ...p, type: "PURCHASE" as const, date: p.date, value: p.total })),
    ...personTransactions.map((t) => ({ ...t, type: "TRANSACTION" as const, date: t.date, value: t.amount })),
  ].sort((a, b) => b.date - a.date);

  const filteredHistory = history.filter((h) => {
    const matchesSearch = h.value.toString().includes(searchTerm) || (h.type === "SALE" && (h as Sale).orderNumber.includes(searchTerm));
    return matchesSearch;
  });

  const totalCredit = (person.credit || 0);
  const totalDebit = personTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className={`w-full max-w-lg flex flex-col max-h-[90vh] rounded-3xl p-6 shadow-2xl ${isDarkMode ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900"}`}>
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h2 className="text-lg font-black uppercase tracking-widest">Histórico: {person.name}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 shrink-0">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Saldo Crédito</p>
            <p className="text-xl font-black">R$ {totalCredit.toFixed(2)}</p>
          </div>
          <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-2xl">
            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Saldo Débito</p>
            <p className="text-xl font-black">R$ {totalDebit.toFixed(2)}</p>
          </div>
        </div>

        <div className="relative mb-6 shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
                type="text" 
                placeholder="Buscar por valor ou nota..."
                className={`w-full border rounded-xl py-3 pl-11 pr-4 text-[12px] font-medium ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 pb-4 custom-scrollbar">
          <div className="space-y-2">
            {filteredHistory.map((h, index) => (
              <div key={`${h.type}-${h.id}-${index}`} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <div>
                    <p className="text-[12px] font-bold uppercase">
                      {h.type === 'SALE' ? 'Venda' : h.type === 'PURCHASE' ? 'Compra' : 'Transação'}
                    </p>
                    <p className="text-[10px] text-slate-500">{new Date(h.date).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <p className={`font-black ${h.type === 'SALE' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {h.type === 'SALE' ? '+' : '-'} R$ {h.value.toFixed(2)}
                  </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

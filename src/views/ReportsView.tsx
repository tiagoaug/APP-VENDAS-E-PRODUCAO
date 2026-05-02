import { useState } from 'react';
import { BarChart3, TrendingUp, Users, Package, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react';
import { Sale, Transaction, SaleStatus, TransactionType } from '../types';

interface ReportsViewProps {
  isDarkMode: boolean;
  onSelectReport: (reportId: string) => void;
  sales: Sale[];
  transactions: Transaction[];
}

export default function ReportsView({ isDarkMode, onSelectReport, sales, transactions }: ReportsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');

  const totalRevenue = transactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  
  const completedSales = sales.filter(s => s.status === SaleStatus.SALE);
  const averageTicket = completedSales.length > 0 ? (completedSales.reduce((acc, s) => acc + s.total, 0) / completedSales.length) : 0;

  return (
    <div className="flex flex-col gap-8 pb-32 px-4 pt-4 h-full overflow-y-auto">
      <div className="flex flex-col gap-4">
        {/* Search and Filters */}
        <div className="flex flex-col gap-2">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    className={`w-full py-4 pl-12 pr-4 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} text-slate-900 dark:text-white`}
                    placeholder="Buscar por ID, Nome ou Tempo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className={`flex gap-2 p-2 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                {['ALL', 'PENDING', 'PAID'].map(type => (
                    <button 
                        key={type}
                        onClick={() => setFilterType(type as any)}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${filterType === type ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                    >
                        {type === 'ALL' ? 'Todos' : type === 'PENDING' ? 'Pendentes' : 'Quitados'}
                    </button>
                ))}
            </div>
        </div>
        

      </div>

      <div className="flex flex-col gap-4">
        <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Relatórios Disponíveis</h3>
        <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          {[
            { id: "ventas-periodo", label: "Vendas por Período", icon: <TrendingUp size={18} />, color: "text-indigo-500" },
            { id: "clientes-mais-compram", label: "Clientes que mais compram", icon: <Users size={18} />, color: "text-emerald-500" },
            { id: "produtos-curva-a", label: "Produtos Curva A", icon: <Package size={18} />, color: "text-amber-500" },
            { id: "desempenho-financeiro", label: "Desempenho Financeiro", icon: <BarChart3 size={18} />, color: "text-blue-500" },
            { id: "dividas-fornecedor", label: "Dívidas por Fornecedor", icon: <ArrowDownRight size={18} />, color: "text-rose-500" },
            { id: "informacao-estoque", label: "Informação de Estoques", icon: <Package size={18} />, color: "text-purple-500" },
          ].map((item, idx, list) => (
            <button
              key={item.id}
              onClick={() => onSelectReport(item.id)}
              className={`w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${idx !== list.length - 1 ? 'border-b border-slate-50 dark:border-slate-800' : ''}`}
            >
              <div className="flex items-center gap-4">
                <div className={item.color}>{item.icon}</div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-100">{item.label}</span>
              </div>
              <ArrowUpRight size={16} className="text-slate-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { Download, ArrowLeft, Calendar, Filter } from 'lucide-react';
import { Sale, Transaction, Product, Person, SaleStatus, TransactionType, Category } from '../types';
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ComboBox from '../components/ComboBox';

interface ReportDetailedViewProps {
  isDarkMode: boolean;
  onBack: () => void;
  reportId: string;
  sales: Sale[];
  purchases: any[];
  transactions: Transaction[];
  products: Product[];
  people: Person[];
  categories: Category[];
}

export default function ReportDetailedView({
  isDarkMode,
  onBack,
  reportId,
  sales,
  purchases,
  transactions,
  products,
  people,
  categories,
}: ReportDetailedViewProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [accountingFilter, setAccountingFilter] = useState<'ALL' | 'ACCOUNTING' | 'NON_ACCOUNTING'>('ALL');
  const [modelSearch, setModelSearch] = useState('');
  
  const suppliers = useMemo(() => people.filter(p => p.isSupplier), [people]);

  const filterByDateRange = (dateNum: number) => {
    if (!startDate && !endDate) return true;
    const date = new Date(dateNum);
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date(8640000000000000);
    end.setHours(23, 59, 59, 999);
    return isWithinInterval(date, { start, end });
  };

  const reportTitle = useMemo(() => {
    switch (reportId) {
      case 'ventas-periodo': return 'Vendas por Período';
      case 'clientes-mais-compram': return 'Clientes que mais compram';
      case 'produtos-curva-a': return 'Produtos Curva A';
      case 'desempenho-financeiro': return 'Desempenho Financeiro';
      case 'dividas-fornecedor': return 'Dívidas por Fornecedor';
      case 'informacao-estoque': return 'Informação de Estoques';
      default: return 'Relatório';
    }
  }, [reportId]);

  // Vendas por periodo logic
  const salesByPeriodData = useMemo(() => {
    if (reportId !== 'ventas-periodo') return [];
    const filtered = sales.filter(s => 
        s.status === SaleStatus.SALE && 
        filterByDateRange(s.date) &&
        (customerSearch === '' || (s.customerName || '').toLowerCase().includes(customerSearch.toLowerCase()))
    );
    
    const byMonth: Record<string, { total: number, count: number, pending: number }> = {};
    filtered.forEach(s => {
      const monthYear = format(s.date, 'MM/yyyy');
      if (!byMonth[monthYear]) byMonth[monthYear] = { total: 0, count: 0, pending: 0 };
      byMonth[monthYear].total += s.total;
      byMonth[monthYear].count += 1;
      const totalPaid = (s.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
      if (totalPaid < s.total) {
        byMonth[monthYear].pending += (s.total - totalPaid);
      }
    });

    return Object.entries(byMonth).map(([period, data]) => ({
      period,
      ...data
    })).sort((a, b) => b.period.localeCompare(a.period));
  }, [sales, reportId, startDate, endDate, customerSearch]);

  // Dívidas por fornecedor logic
  const dividasFornecedorData = useMemo(() => {
    if (reportId !== 'dividas-fornecedor') return [];
    // Assumindo que purchase tem supplierId, total, id, status, paymentHistory/balance
    return purchases
       .filter((p: any) => {
           return (supplierId === '' || p.supplierId === supplierId) &&
           (accountingFilter === 'ALL' || (accountingFilter === 'ACCOUNTING' ? p.generateTransaction === true : p.generateTransaction !== true)) &&
           (p.balance > 0 || (p.total - (p.paymentHistory || []).reduce((acc: number, pay: any) => acc + pay.amount, 0)) > 0)
       })
       .map((p: any) => ({
           id: p.id,
           displayId: p.batchNumber || p.id,
           supplierName: people.find(pe => pe.id === p.supplierId)?.name || 'Desconhecido',
           total: p.total,
           balance: p.balance || (p.total - (p.paymentHistory || []).reduce((acc: number, pay: any) => acc + pay.amount, 0)),
           isAccounting: !!p.generateTransaction
       }));
  }, [purchases, reportId, supplierId, people, accountingFilter]);

  // Clientes que mais compram logic
  const topCustomersData = useMemo(() => {
    if (reportId !== 'clientes-mais-compram') return [];
    const filtered = sales.filter(s => s.status === SaleStatus.SALE && filterByDateRange(s.date));
    
    const byCustomer: Record<string, { id: string, name: string, total: number, count: number }> = {};
    filtered.forEach(s => {
      const cid = s.customerId || 'unknown';
      if (!byCustomer[cid]) {
        byCustomer[cid] = { 
          id: cid, 
          name: s.customerName || (cid !== 'unknown' ? people.find(p => p.id === cid)?.name || 'Desconhecido' : 'Avulso'),
          total: 0, 
          count: 0 
        };
      }
      byCustomer[cid].total += s.total;
      byCustomer[cid].count += 1;
    });

    return Object.values(byCustomer).sort((a, b) => b.total - a.total);
  }, [sales, people, reportId, startDate, endDate]);

  // Produtos Curva A
  const curvaAData = useMemo(() => {
    if (reportId !== 'produtos-curva-a') return [];
    const filtered = sales.filter(s => s.status === SaleStatus.SALE && filterByDateRange(s.date));
    
    const byProduct: Record<string, { id: string, name: string, colorName: string, categoryName: string, quantity: number, total: number }> = {};
    filtered.forEach(s => {
      s.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const variation = prod?.variations.find(v => v.id === item.variationId);
        const categoryName = prod?.categoryId ? categories.find(c => c.id === prod.categoryId)?.name || 'Sem Categoria' : 'Sem Categoria';
        const key = `${item.productId}-${item.variationId}`;
        if (!byProduct[key]) {
          byProduct[key] = {
            id: key,
            name: prod?.name || '?',
            colorName: variation?.colorName || '?',
            categoryName: categoryName,
            quantity: 0,
            total: 0
          };
        }
        byProduct[key].quantity += item.quantity;
        byProduct[key].total += (item.quantity * item.price);
      });
    });

    let list = Object.values(byProduct).sort((a, b) => b.total - a.total);
    const overallTotal = list.reduce((acc, p) => acc + p.total, 0);
    
    let cumulated = 0;
    return list.map(item => {
      cumulated += item.total;
      const pct = overallTotal > 0 ? (cumulated / overallTotal) * 100 : 0;
      let classification = 'C';
      if (pct <= 80) classification = 'A';
      else if (pct <= 95) classification = 'B';
      
      return {
        ...item,
        pct: (item.total / overallTotal) * 100,
        cumulatedPct: pct,
        classification
      };
    });
  }, [sales, products, reportId, startDate, endDate, categories]);

  // Desempenho Financeiro
  const financialData = useMemo(() => {
    if (reportId !== 'desempenho-financeiro') return [];
    
    const filtered = transactions.filter(t => filterByDateRange(t.date));
    const byMonth: Record<string, { income: number, expense: number }> = {};
    
    filtered.forEach(t => {
      const monthYear = format(t.date, 'MM/yyyy');
      if (!byMonth[monthYear]) byMonth[monthYear] = { income: 0, expense: 0 };
      if (t.type === TransactionType.INCOME) byMonth[monthYear].income += t.amount;
      if (t.type === TransactionType.EXPENSE) byMonth[monthYear].expense += t.amount;
    });

    return Object.entries(byMonth).map(([period, data]) => ({
      period,
      ...data,
      balance: data.income - data.expense
    })).sort((a, b) => b.period.localeCompare(a.period));
  }, [transactions, reportId, startDate, endDate]);


  // Informação de Estoques
  const stockInfoData = useMemo(() => {
    if (reportId !== 'informacao-estoque') return [];
    
    const data: any[] = [];
    products.forEach(p => {
        if (modelSearch && !p.reference.toLowerCase().includes(modelSearch.toLowerCase())) return;
        p.variations.forEach(v => {
            const totalStock = Object.values(v.stock).reduce((acc, qty) => acc + qty, 0);
            if (totalStock > 0) {
              data.push({
                  reference: p.reference,
                  color: v.colorName,
                  quantity: totalStock,
                  costPrice: p.costPrice,
                  salePrice: p.salePrice,
                  totalCost: totalStock * p.costPrice,
                  totalSale: totalStock * p.salePrice
              });
            }
        });
    });
    return data;
  }, [products, reportId, modelSearch]);

  const stockInfoTotals = useMemo(() => {
    if (reportId !== 'informacao-estoque') return { cost: 0, sale: 0 };
    return stockInfoData.reduce((acc, item) => {
        acc.cost += item.totalCost;
        acc.sale += item.totalSale;
        return acc;
    }, { cost: 0, sale: 0 });
  }, [stockInfoData, reportId]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(reportTitle, 14, 22);
    
    let subTitle = 'Período: ';
    if (startDate && endDate) subTitle += `${format(new Date(startDate), 'dd/MM/yyyy')} a ${format(new Date(endDate), 'dd/MM/yyyy')}`;
    else if (startDate) subTitle += `A partir de ${format(new Date(startDate), 'dd/MM/yyyy')}`;
    else if (endDate) subTitle += `Até ${format(new Date(endDate), 'dd/MM/yyyy')}`;
    else subTitle += 'Todos os períodos';
    
    doc.setFontSize(10);
    doc.text(subTitle, 14, 30);

    doc.setFontSize(8);
    const dateStr = format(new Date(), 'dd/MM/yyyy HH:mm');
    doc.text(`Gerado em: ${dateStr}`, 14, 35);

    if (reportId === 'ventas-periodo') {
      const head = [['Período', 'Vendas', 'Total', 'Pendente']];
      const body = salesByPeriodData.map(r => [
        r.period,
        r.count.toString(),
        `R$ ${r.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `R$ ${r.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ]);
      autoTable(doc, { startY: 40, head, body, theme: 'grid' });
    } else if (reportId === 'clientes-mais-compram') {
      const head = [['#', 'Cliente', 'Qtd Compras', 'Total Gasto']];
      const body = topCustomersData.map((r, i) => [
        (i + 1).toString(),
        r.name,
        r.count.toString(),
        `R$ ${r.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ]);
      autoTable(doc, { startY: 40, head, body, theme: 'grid' });
    } else if (reportId === 'produtos-curva-a') {
      const head = [['#', 'Produto', 'Qtd Vendida', 'Receita Total', 'Curva']];
      const body = curvaAData.map((r, i) => [
        (i + 1).toString(),
        r.name,
        r.quantity.toString(),
        `R$ ${r.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        r.classification
      ]);
      autoTable(doc, { startY: 40, head, body, theme: 'grid' });
    } else if (reportId === 'desempenho-financeiro') {
      const head = [['Período', 'Receitas', 'Despesas', 'Saldo (Lucro Líquido)']];
      const body = financialData.map(r => [
        r.period,
        `R$ ${r.income.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `R$ ${r.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `R$ ${r.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ]);
      autoTable(doc, { startY: 40, head, body, theme: 'grid' });
    } else if (reportId === 'dividas-fornecedor') {
      const head = [['Fornecedor', 'ID', 'Status', 'Saldo']];
      const body = dividasFornecedorData.map(r => [
        r.supplierName,
        r.displayId,
        r.isAccounting ? 'Contábil' : 'Não Contábil',
        `R$ ${r.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ]);
      autoTable(doc, { startY: 40, head, body, theme: 'grid' });
    } else if (reportId === 'informacao-estoque') {
      const head = [['Referência', 'Cor', 'Qtd', 'V. Compra', 'Total']];
      const body = stockInfoData.map(r => [
        r.reference,
        r.color,
        r.quantity.toString(),
        `R$ ${r.costPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `R$ ${r.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ]);
      body.push(['', '', '', 'Total Compra:', `R$ ${stockInfoTotals.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
      body.push(['', '', '', 'Total Venda:', `R$ ${stockInfoTotals.sale.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
      autoTable(doc, { startY: 40, head, body, theme: 'grid' });
    }

    doc.save(`${reportId}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
  };

  return (
    <div className={`flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 pb-32 ${isDarkMode ? 'text-white' : 'text-slate-900'} overflow-y-auto`}>
      <div className="flex justify-between items-center px-4 pt-6 pb-2 sticky top-0 bg-[#f8f9fa] dark:bg-slate-950 z-10 w-full">
         <button
           onClick={onBack}
           title="Voltar"
           aria-label="Voltar para a tela anterior"
           className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500'} shadow-sm`}
         >
           <ArrowLeft size={20} />
         </button>
         <h1 className="text-xl font-black">{reportTitle}</h1>
         <button
           onClick={exportPDF}
           title="Exportar PDF"
           aria-label="Exportar relatório para PDF"
           className="p-2 rounded-full bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
         >
            <Download size={18} />
         </button>
      </div>
      
      <div className="flex flex-col gap-4 px-4 mt-4 flex-grow">
        {/* Date Filter */}
         <div className={`p-4 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                <Filter size={12} />
                Filtros
            </p>
            <div className="flex gap-2 items-center flex-wrap">
                <div className="relative flex-1 min-w-[140px]">
                    <input 
                        type="date" 
                        value={startDate}
                        title="Data Inicial"
                        placeholder="Data Inicial"
                        onChange={(e) => setStartDate(e.target.value)}
                        className={`w-full p-3 rounded-xl border text-xs font-bold ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                    <Calendar className={`absolute right-3 top-3.5 pointer-events-none ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} size={14} />
                </div>
                <span className="text-slate-400 text-xs font-bold">até</span>
                <div className="relative flex-1 min-w-[140px]">
                    <input 
                        type="date" 
                        value={endDate}
                        title="Data Final"
                        placeholder="Data Final"
                        onChange={(e) => setEndDate(e.target.value)}
                        className={`w-full p-3 rounded-xl border text-xs font-bold ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                    <Calendar className={`absolute right-3 top-3.5 pointer-events-none ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} size={14} />
                </div>
                {reportId === 'ventas-periodo' && (
                    <input 
                        type="text" 
                        placeholder="Buscar cliente..."
                        title="Buscar Cliente"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className={`flex-1 min-w-[200px] p-3 rounded-xl border text-xs font-bold ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                )}
                {reportId === 'informacao-estoque' && (
                    <input 
                        type="text" 
                        placeholder="Buscar modelo..."
                        title="Buscar Modelo"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        className={`flex-1 min-w-[200px] p-3 rounded-xl border text-xs font-bold ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                )}
                {reportId === 'dividas-fornecedor' && (
                    <>
                    <div className="flex-[2] min-w-[200px]">
                        <ComboBox 
                            options={suppliers}
                            value={supplierId}
                            onChange={(id) => setSupplierId(id)}
                            placeholder="Buscar fornecedor..."
                            isDarkMode={isDarkMode}
                        />
                    </div>
                    <select 
                        value={accountingFilter}
                        title="Filtrar por Tipo Contábil"
                        onChange={(e) => setAccountingFilter(e.target.value as any)}
                        className={`flex-1 min-w-[150px] p-3 rounded-2xl border text-xs font-bold ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    >
                        <option value="ALL">Contábil & Não Contábil</option>
                        <option value="ACCOUNTING">Contábil</option>
                        <option value="NON_ACCOUNTING">Não Contábil</option>
                    </select>
                    </>
                )}
            </div>
         </div>

        {/* Dynamic Content */}
        <div className={`p-1 rounded-[2rem] border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} mt-2`}>
            {reportId === 'informacao-estoque' && (
                 <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">Referência</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">Cor</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-right">Qtd</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-right">V. Compra</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stockInfoData.map((r, i) => (
                                <tr key={i} className={`border-b last:border-0 dark:border-slate-800 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                                    <td className="p-3 text-xs font-bold">{r.reference}</td>
                                    <td className="p-3 text-xs font-bold">{r.color}</td>
                                    <td className="p-3 text-xs text-right font-bold text-slate-500">{r.quantity}</td>
                                    <td className="p-3 text-xs text-right font-bold text-slate-500">R$ {r.costPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="p-3 text-xs text-right font-black text-indigo-500">R$ {r.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                            {stockInfoData.length > 0 && (
                                <tr className="border-t-2 dark:border-slate-700">
                                    <td colSpan={4} className="p-3 text-xs font-black text-right text-slate-500">Total Compra:</td>
                                    <td className="p-3 text-xs font-black text-right text-indigo-600">R$ {stockInfoTotals.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            )}
                               {stockInfoData.length > 0 && (
                                <tr className="border-t-2 dark:border-slate-700">
                                    <td colSpan={4} className="p-3 text-xs font-black text-right text-slate-500">Total Venda:</td>
                                    <td className="p-3 text-xs font-black text-right text-emerald-600">R$ {stockInfoTotals.sale.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            )}
                            {stockInfoData.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-6 text-center text-xs text-slate-400 font-bold">Nenhum dado encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            {reportId === 'dividas-fornecedor' && (
                 <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">Fornecedor</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">ID</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">Status</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dividasFornecedorData.map((r, i) => (
                                <tr key={r.id} className={`border-b last:border-0 dark:border-slate-800 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                                    <td className="p-3 text-xs font-bold">{r.supplierName}</td>
                                    <td className="p-3 text-[10px] font-bold text-slate-500">{r.displayId}</td>
                                    <td className="p-3 text-[10px] font-bold text-slate-500">{r.isAccounting ? 'Contábil' : 'Não Contábil'}</td>
                                    <td className="p-3 text-xs text-right font-black text-rose-500">R$ {r.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                            {dividasFornecedorData.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-6 text-center text-xs text-slate-400 font-bold">Nenhum dado encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            {reportId === 'ventas-periodo' && (
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">Período</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-right">Vendas</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-right">Total</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-right">Pendente</th>
                            </tr>
                        </thead>
                        <tbody>
                            {salesByPeriodData.map((r, i) => (
                                <tr key={i} className={`border-b last:border-0 dark:border-slate-800 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                                    <td className="p-3 text-xs font-bold">{r.period}</td>
                                    <td className="p-3 text-xs text-right font-bold text-slate-500">{r.count}</td>
                                    <td className="p-3 text-xs text-right font-black text-indigo-500">R$ {r.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="p-3 text-xs text-right font-bold text-rose-500">
                                        {r.pending > 0 ? `R$ ${r.pending.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                    </td>
                                </tr>
                            ))}
                            {salesByPeriodData.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-6 text-center text-xs text-slate-400 font-bold">Nenhum dado encontrado para o período.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {reportId === 'clientes-mais-compram' && (
                 <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">#</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">Cliente</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-right">Compras</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-right">Gasto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topCustomersData.map((r, i) => (
                                <tr key={i} className={`border-b last:border-0 dark:border-slate-800 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                                    <td className="p-3 text-xs font-bold text-slate-400">{i + 1}º</td>
                                    <td className="p-3 text-xs font-bold">{r.name}</td>
                                    <td className="p-3 text-xs text-right font-bold text-slate-500">{r.count}</td>
                                    <td className="p-3 text-xs text-right font-black text-emerald-500">R$ {r.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                            {topCustomersData.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-6 text-center text-xs text-slate-400 font-bold">Nenhum dado encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {reportId === 'produtos-curva-a' && (
                 <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">Produto</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">Cor</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">Categoria</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-right">Qtd</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-center">Curva</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {curvaAData.map((r, i) => (
                                <tr key={i} className={`border-b last:border-0 dark:border-slate-800 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                                    <td className="p-3 text-[10px] font-bold uppercase truncate max-w-[120px]">{r.name}</td>
                                    <td className="p-3 text-[10px] font-bold uppercase truncate max-w-[120px]">{r.colorName}</td>
                                    <td className="p-3 text-[10px] font-bold uppercase truncate max-w-[120px]">{r.categoryName}</td>
                                    <td className="p-3 text-xs text-right font-bold text-slate-500">{r.quantity}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                            r.classification === 'A' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' : 
                                            r.classification === 'B' ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 
                                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                            {r.classification}
                                        </span>
                                    </td>
                                    <td className="p-3 text-xs text-right font-black text-amber-500">R$ {r.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                            {curvaAData.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-6 text-center text-xs text-slate-400 font-bold">Nenhum dado encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {reportId === 'desempenho-financeiro' && (
                 <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800">Período</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-right">Receitas</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-right">Despesas</th>
                                <th className="p-3 text-[10px] font-black uppercase text-slate-400 border-b dark:border-slate-800 text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {financialData.map((r, i) => (
                                <tr key={i} className={`border-b last:border-0 dark:border-slate-800 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                                    <td className="p-3 text-xs font-bold">{r.period}</td>
                                    <td className="p-3 text-xs text-right font-bold text-emerald-500">R$ {r.income.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="p-3 text-xs text-right font-bold text-rose-500">R$ {r.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className={`p-3 text-xs text-right font-black ${r.balance >= 0 ? 'text-blue-500' : 'text-rose-600'}`}>R$ {r.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                            {financialData.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-6 text-center text-xs text-slate-400 font-bold">Nenhum dado encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

        </div>
      </div>
    </div>
  );
}

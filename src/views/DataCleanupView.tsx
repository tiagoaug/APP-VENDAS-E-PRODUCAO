import { useState } from 'react';
import { ArrowLeft, Archive, Search, CheckCircle2, AlertCircle, Loader2, Package, ShoppingBag, ShoppingCart, ClipboardList, Factory } from 'lucide-react';
import { Sale, Purchase, ProductionOrder, ProductionLot, ServiceOrder, Transaction, Product, Person, MonthlySnapshot, CleanupConfig } from '../types';
import { firebaseService } from '../services/firebaseService';
import { toast } from '../utils/toast';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  getCutoffMs, isSaleEligible, isPurchaseEligible, isProductionOrderEligible,
  isServiceOrderEligible, isProductionLotEligible, computeMonthlyContributions,
  accumulatorToSnapshotPatch, mergeIntoSnapshot, MonthAccumulator,
} from '../utils/archiveAggregates';

interface DataCleanupViewProps {
  isDarkMode: boolean;
  onBack: () => void;
  cleanupConfig: CleanupConfig | null;
  monthlySnapshots: MonthlySnapshot[];
  people: Person[];
  products: Product[];
}

interface PreviewResult {
  cutoffMs: number;
  sales: Sale[];
  purchases: Purchase[];
  productionOrders: ProductionOrder[];
  serviceOrders: ServiceOrder[];
  productionLots: ProductionLot[];
  transactionsInRange: Transaction[];
  contributions: Map<string, ReturnType<typeof computeMonthlyContributions> extends Map<string, infer V> ? V : never>;
}

export default function DataCleanupView({ isDarkMode, onBack, cleanupConfig, monthlySnapshots, people, products }: DataCleanupViewProps) {
  const [intervalMonths, setIntervalMonths] = useState(cleanupConfig?.intervalMonths ?? 12);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [lastResult, setLastResult] = useState<{ months: number; records: number } | null>(null);

  const handleSaveInterval = async () => {
    setIsSavingConfig(true);
    try {
      await firebaseService.saveDocument('cleanup_config', { id: 'main', intervalMonths, lastRunAt: cleanupConfig?.lastRunAt });
      toast.show('Intervalo salvo.');
    } catch (e) {
      toast.show('Erro ao salvar intervalo.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    setPreview(null);
    setLastResult(null);
    try {
      const cutoffMs = getCutoffMs(intervalMonths);
      const [allSales, allPurchases, allProductionOrders, allServiceOrders, allProductionLots, allTransactions] = await Promise.all([
        firebaseService.getCollection<Sale>('sales'),
        firebaseService.getCollection<Purchase>('purchases'),
        firebaseService.getCollection<ProductionOrder>('productionOrders'),
        firebaseService.getCollection<ServiceOrder>('serviceOrders'),
        firebaseService.getCollection<ProductionLot>('productionLots'),
        firebaseService.getCollection<Transaction>('transactions'),
      ]);

      const eligibleSales = allSales.filter(s => isSaleEligible(s, cutoffMs));
      const eligiblePurchases = allPurchases.filter(p => isPurchaseEligible(p, cutoffMs));
      const eligibleProductionOrders = allProductionOrders.filter(o => isProductionOrderEligible(o, cutoffMs));
      const eligibleServiceOrders = allServiceOrders.filter(os => isServiceOrderEligible(os, cutoffMs));
      const eligibleProductionLots = allProductionLots.filter(l => isProductionLotEligible(l, cutoffMs));

      // Balanço financeiro do mês usa as transações daquele período (não são arquivadas,
      // só lidas — a coleção de transações já se mantém enxuta sozinha por outra otimização).
      const affectedMonths = new Set<string>();
      eligibleSales.forEach(s => affectedMonths.add(new Date(s.date).toISOString().slice(0, 7)));
      eligiblePurchases.forEach(p => affectedMonths.add(new Date(p.date).toISOString().slice(0, 7)));
      eligibleProductionLots.forEach(l => affectedMonths.add(new Date(l.finishedAt || l.createdAt).toISOString().slice(0, 7)));
      const transactionsInRange = allTransactions.filter(t => affectedMonths.has(new Date(t.date).toISOString().slice(0, 7)));

      const contributions = computeMonthlyContributions({
        sales: eligibleSales,
        purchases: eligiblePurchases,
        lots: eligibleProductionLots,
        transactions: transactionsInRange,
        people,
        products,
      });

      setPreview({
        cutoffMs,
        sales: eligibleSales,
        purchases: eligiblePurchases,
        productionOrders: eligibleProductionOrders,
        serviceOrders: eligibleServiceOrders,
        productionLots: eligibleProductionLots,
        transactionsInRange,
        contributions,
      });
    } catch (e) {
      console.error(e);
      toast.show('Erro ao pré-visualizar arquivamento.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const totalEligible = preview
    ? preview.sales.length + preview.purchases.length + preview.productionOrders.length + preview.serviceOrders.length + preview.productionLots.length
    : 0;

  const handleExecute = async () => {
    if (!preview) return;
    setShowConfirm(false);
    setIsExecuting(true);
    try {
      await Promise.all([
        firebaseService.moveDocumentsBatch('sales', 'archived_sales', preview.sales.map(s => ({ id: s.id, data: s }))),
        firebaseService.moveDocumentsBatch('purchases', 'archived_purchases', preview.purchases.map(p => ({ id: p.id, data: p }))),
        firebaseService.moveDocumentsBatch('productionOrders', 'archived_productionOrders', preview.productionOrders.map(o => ({ id: o.id, data: o }))),
        firebaseService.moveDocumentsBatch('serviceOrders', 'archived_serviceOrders', preview.serviceOrders.map(os => ({ id: os.id, data: os }))),
        firebaseService.moveDocumentsBatch('productionLots', 'archived_productionLots', preview.productionLots.map(l => ({ id: l.id, data: l }))),
      ]);

      const months = Array.from(preview.contributions.keys());
      for (const month of months) {
        const acc = preview.contributions.get(month)!;
        const patch = accumulatorToSnapshotPatch(month, acc);
        const existing = monthlySnapshots.find(m => m.month === month);
        const merged = mergeIntoSnapshot(existing, patch);
        await firebaseService.saveDocument('monthly_snapshots', merged);
      }

      await firebaseService.saveDocument('cleanup_config', { id: 'main', intervalMonths, lastRunAt: Date.now() });

      setLastResult({ months: months.length, records: totalEligible });
      setPreview(null);
      toast.show('Arquivamento concluído com sucesso!');
    } catch (e) {
      console.error(e);
      toast.show('Erro ao executar arquivamento.');
    } finally {
      setIsExecuting(false);
    }
  };

  const cardClass = `p-5 rounded-[2rem] border shadow-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`;

  return (
    <div className="flex flex-col gap-5 pb-24 px-1">
      <div className="flex items-center gap-4">
        <button type="button" onClick={onBack} title="Voltar" aria-label="Voltar"
          className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${isDarkMode ? 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">Limpeza e Arquivamento</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Vendas, Compras e Produção antigas e já fechadas</p>
        </div>
      </div>

      <div className={cardClass}>
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
          Move para um arquivo separado os registros <strong>já pagos/concluídos</strong> e mais antigos que o intervalo
          definido — nada pendente é tocado, e nenhum cadastro (produtos, clientes, fornecedores, contas) é afetado.
          Antes de mover, salva permanentemente o resumo do mês (faturamento, clientes que mais compraram,
          produtos mais vendidos, total por fornecedor, pares produzidos).
        </p>

        <div className="flex items-end gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Arquivar tudo com mais de (meses)</label>
            <input
              type="number"
              min={1}
              value={intervalMonths}
              onChange={e => setIntervalMonths(Math.max(1, parseInt(e.target.value, 10) || 1))}
              title="Intervalo em meses"
              className={`w-full px-4 py-3 rounded-2xl border text-sm font-black outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
            />
          </div>
          <button type="button" onClick={handleSaveInterval} disabled={isSavingConfig}
            className="px-5 py-3 rounded-2xl bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-60">
            Salvar
          </button>
        </div>
        {cleanupConfig?.lastRunAt && (
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
            Última limpeza: {new Date(cleanupConfig.lastRunAt).toLocaleDateString('pt-BR')}
          </p>
        )}

        <button type="button" onClick={handlePreview} disabled={isPreviewing}
          className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
          {isPreviewing ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {isPreviewing ? 'Calculando...' : 'Pré-visualizar Arquivamento'}
        </button>
      </div>

      {lastResult && (
        <div className={`${cardClass} flex-row items-center gap-3`}>
          <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
          <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
            {lastResult.records} registros arquivados, {lastResult.months} mês(es) atualizado(s) no histórico.
          </p>
        </div>
      )}

      {preview && (
        <div className={cardClass}>
          <div className="flex items-center gap-2">
            <Archive size={18} className="text-indigo-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Resumo da Pré-visualização</h3>
          </div>

          {totalEligible === 0 ? (
            <div className="text-center py-8 flex flex-col items-center gap-2">
              <AlertCircle size={28} className="text-slate-300 dark:text-slate-700" />
              <p className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.2em] italic">
                Nada elegível para arquivar com esse intervalo
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: ShoppingBag, label: 'Vendas', count: preview.sales.length, color: 'text-indigo-500' },
                  { icon: ShoppingCart, label: 'Compras', count: preview.purchases.length, color: 'text-orange-500' },
                  { icon: Package, label: 'Pedidos de Produção', count: preview.productionOrders.length, color: 'text-violet-500' },
                  { icon: ClipboardList, label: 'Ordens de Serviço', count: preview.serviceOrders.length, color: 'text-rose-500' },
                  { icon: Factory, label: 'Mapas', count: preview.productionLots.length, color: 'text-emerald-500' },
                ].map(({ icon: Icon, label, count, color }) => (
                  <div key={label} className={`p-3 rounded-2xl border flex items-center gap-2.5 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <Icon size={16} className={`${color} shrink-0`} />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 dark:text-white leading-none">{count}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">{label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Por mês</p>
                {Array.from(preview.contributions.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, acc]) => (
                  <div key={month} className={`flex items-center justify-between px-3 py-2 rounded-xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300">{month}</span>
                    <span className="text-[10px] font-bold text-slate-400">
                      Vendas: R$ {acc.salesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Compras: R$ {acc.purchasesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · {acc.totalPairsProduced} pares
                    </span>
                  </div>
                ))}
              </div>

              <button type="button" onClick={() => setShowConfirm(true)} disabled={isExecuting}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
                {isExecuting ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
                {isExecuting ? 'Arquivando...' : 'Confirmar Arquivamento'}
              </button>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        title="Confirmar Arquivamento"
        message={`${totalEligible} registros serão movidos para o arquivo. Os totais do(s) mês(es) afetado(s) ficam salvos permanentemente no histórico mensal. Essa ação pode ser revertida manualmente, se necessário.`}
        confirmLabel="Arquivar Agora"
        isDanger={false}
        onConfirm={handleExecute}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay } from 'date-fns';
import { CheckSquare, Square, Printer, Share2, ExternalLink, FileDown, RefreshCw, Loader2, FileText } from 'lucide-react';
import { BlingOrder } from '../types';
import { subscribeToBlingOrders, refreshBlingInvoiceDetails } from '../services/blingService';
import { toast } from '../utils/toast';
import { printShippingLabels, buildShippingLabelsPdf, sharePDF, PrintShippingLabelOptions } from '../utils/pdfExport';

interface BlingInvoicesViewProps {
  isDarkMode: boolean;
}

type DateFilter = 'dia' | 'semana' | 'mes' | 'periodo';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  EMITIDA: { label: 'Autorizada', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  REJEITADA: { label: 'Rejeitada', color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  EMITINDO: { label: 'Processando', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
};

export default function BlingInvoicesView({ isDarkMode }: BlingInvoicesViewProps) {
  const [orders, setOrders] = useState<BlingOrder[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<DateFilter>('mes');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => subscribeToBlingOrders(setOrders), []);

  // "Notas fiscais" aqui = pedidos que já passaram por pelo menos uma tentativa de emissão
  // (tem notaFiscalId), independente do resultado — autorizada, rejeitada ou ainda processando.
  const invoices = useMemo(
    () => orders.filter((o) => !!o.notaFiscalId).sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)),
    [orders]
  );

  const filtered = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    if (dateFilter === 'dia') start = startOfDay(now);
    else if (dateFilter === 'semana') start = startOfWeek(now, { weekStartsOn: 1 });
    else if (dateFilter === 'mes') start = startOfMonth(now);
    else {
      start = periodoInicio ? startOfDay(new Date(periodoInicio)) : new Date(0);
      end = periodoFim ? endOfDay(new Date(periodoFim)) : now;
    }

    return invoices.filter((o) => {
      const ref = o.updatedAt || o.createdAt;
      return ref >= start.getTime() && ref <= end.getTime();
    });
  }, [invoices, dateFilter, periodoInicio, periodoFim]);

  // Só notas autorizadas têm garantidamente o endereço do destinatário (etiquetaTransporte) —
  // pedidos emitidos antes do campo existir no app também não têm até serem atualizados (botão
  // de refresh por linha, ou reabrindo a Emissão de Notas e emitindo de novo).
  const selectable = useMemo(() => filtered.filter((o) => o.status === 'EMITIDA' && o.etiquetaTransporte), [filtered]);
  const allChecked = selectable.length > 0 && selectable.every((o) => checked.has(o.id));

  const toggleAll = () => {
    setChecked(allChecked ? new Set() : new Set(selectable.map((o) => o.id)));
  };

  const toggleOne = (order: BlingOrder) => {
    if (order.status !== 'EMITIDA' || !order.etiquetaTransporte) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(order.id)) next.delete(order.id); else next.add(order.id);
      return next;
    });
  };

  const selectedLabels = (): PrintShippingLabelOptions[] =>
    filtered
      .filter((o) => checked.has(o.id) && o.etiquetaTransporte)
      .map((o) => ({ pedidoNumero: o.numero, notaNumero: o.notaNumero, etiqueta: o.etiquetaTransporte! }));

  const handlePrint = () => {
    const labels = selectedLabels();
    if (labels.length === 0) return;
    printShippingLabels(labels);
  };

  const handleSharePdf = async () => {
    const labels = selectedLabels();
    if (labels.length === 0) return;
    setSharing(true);
    try {
      const doc = buildShippingLabelsPdf(labels);
      await sharePDF(doc, `etiquetas-transporte-${format(new Date(), 'ddMMyyyy-HHmm')}.pdf`);
    } catch (e: any) {
      toast.show('Erro ao gerar PDF: ' + (e.message || e));
    } finally {
      setSharing(false);
    }
  };

  const handleRefresh = async (order: BlingOrder) => {
    setRefreshingId(order.id);
    try {
      const res = await refreshBlingInvoiceDetails(order.id);
      if (!res.ok && res.motivo) toast.show(res.motivo);
    } catch (e: any) {
      toast.show('Erro ao atualizar nota: ' + (e.message || e));
    } finally {
      setRefreshingId(null);
    }
  };

  const checkedCount = checked.size;

  return (
    <div className="flex flex-col gap-6 pb-32">
      <div className={`flex items-center gap-1 p-1 rounded-2xl overflow-x-auto ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
        {(['dia', 'semana', 'mes', 'periodo'] as DateFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={`flex-1 h-9 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${
              dateFilter === f
                ? (isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900 shadow-sm')
                : 'text-slate-400'
            }`}
          >
            {f === 'dia' ? 'Dia' : f === 'semana' ? 'Semana' : f === 'mes' ? 'Mês' : 'Período'}
          </button>
        ))}
      </div>

      {dateFilter === 'periodo' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
            className={`flex-1 h-11 px-3 rounded-2xl text-xs font-bold ${isDarkMode ? 'bg-slate-900 border border-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-900'}`}
          />
          <span className="text-[10px] font-black uppercase text-slate-400">até</span>
          <input
            type="date"
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.target.value)}
            className={`flex-1 h-11 px-3 rounded-2xl text-xs font-bold ${isDarkMode ? 'bg-slate-900 border border-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-900'}`}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={toggleAll}
          disabled={selectable.length === 0}
          className={`flex-1 h-11 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
        >
          {allChecked ? <CheckSquare size={15} /> : <Square size={15} />}
          {allChecked ? 'Desmarcar Todos' : `Selecionar Todos (${selectable.length})`}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handlePrint}
          disabled={checkedCount === 0}
          className="flex-1 h-11 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-40 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <Printer size={14} /> Imprimir ({checkedCount})
        </button>
        <button
          onClick={handleSharePdf}
          disabled={checkedCount === 0 || sharing}
          className="flex-1 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
        >
          {sharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
          {sharing ? 'Gerando...' : `Compartilhar PDF (${checkedCount})`}
        </button>
      </div>

      <p className="text-[10px] text-slate-400 font-bold leading-relaxed px-1">
        Etiqueta de Transporte 100x150 montada com o endereço do destinatário retornado pela nota fiscal. O DANFE em si (documento oficial autorizado pela SEFAZ) só pode ser aberto individualmente pelo link do Bling — a API deles não permite gerar isso em lote fora do site.
      </p>

      {filtered.length === 0 && (
        <div className={`p-10 rounded-[2.5rem] border-2 border-dashed text-center ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-300'}`}>
          <FileText size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs font-black uppercase tracking-widest">Nenhuma nota fiscal no período</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((order) => {
          const isChecked = checked.has(order.id);
          const isSelectable = order.status === 'EMITIDA' && !!order.etiquetaTransporte;
          const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.EMITINDO;
          const isRefreshing = refreshingId === order.id;
          const missingData = order.status === 'EMITIDA' && (!order.danfeUrl || !order.etiquetaTransporte);
          const dateLabel = format(new Date(order.updatedAt || order.createdAt), 'dd/MM/yyyy HH:mm');

          return (
            <div
              key={order.id}
              className={`p-4 rounded-[1.75rem] border-2 flex flex-col gap-3 transition-all ${
                isChecked
                  ? isDarkMode ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-emerald-50 border-emerald-300'
                  : isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <button onClick={() => toggleOne(order)} disabled={!isSelectable} className="shrink-0 disabled:opacity-20">
                  {isChecked ? <CheckSquare size={20} className="text-emerald-500" /> : <Square size={20} className="text-slate-300" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Pedido {order.numero}{order.notaNumero ? ` · NF-e ${order.notaNumero}` : ''}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">{order.cliente} · {dateLabel}</p>
                </div>
                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0 ${statusCfg.color} ${statusCfg.bg}`}>
                  {statusCfg.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                {order.danfeUrl && (
                  <a
                    href={order.danfeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest"
                  >
                    <ExternalLink size={12} /> DANFE
                  </a>
                )}
                {order.pdfUrl && (
                  <a
                    href={order.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest"
                  >
                    <FileDown size={12} /> PDF Simplificado
                  </a>
                )}
                {order.etiquetaTransporte && (
                  <button
                    onClick={() => printShippingLabels([{ pedidoNumero: order.numero, notaNumero: order.notaNumero, etiqueta: order.etiquetaTransporte! }])}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest"
                  >
                    <Printer size={12} /> Etiqueta
                  </button>
                )}
                {missingData && (
                  <button
                    onClick={() => handleRefresh(order)}
                    disabled={isRefreshing}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                  >
                    {isRefreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {isRefreshing ? 'Atualizando...' : 'Atualizar Dados'}
                  </button>
                )}
                {order.status === 'REJEITADA' && order.motivoRejeicao && (
                  <p className="text-[10px] font-bold text-rose-500 w-full">{order.motivoRejeicao}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

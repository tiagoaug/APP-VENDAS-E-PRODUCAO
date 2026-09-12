import { useEffect, useMemo, useState } from 'react';
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay } from 'date-fns';
import { FileDown, RefreshCw, Loader2, FileText, QrCode, Layers, Barcode } from 'lucide-react';
import { BlingOrder, CompanyProfile } from '../types';
import { subscribeToBlingOrders, refreshBlingInvoiceDetails, fetchBlingShippingLabel, mergeBlingShippingDocuments, fetchDanfeSimplificadoData } from '../services/blingService';
import { toast } from '../utils/toast';
import { sharePdfBase64 } from '../utils/pdfExport';

interface BlingInvoicesViewProps {
  isDarkMode: boolean;
  companyProfile?: CompanyProfile | null;
}

type DateFilter = 'dia' | 'semana' | 'mes' | 'periodo';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  EMITIDA: { label: 'Autorizada', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  CONCLUIDA: { label: 'Concluída', color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  REJEITADA: { label: 'Rejeitada', color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  EMITINDO: { label: 'Processando', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
};

const SELECTABLE_STATUSES = new Set(['EMITIDA', 'CONCLUIDA']);

export default function BlingInvoicesView({ isDarkMode, companyProfile = null }: BlingInvoicesViewProps) {
  const [orders, setOrders] = useState<BlingOrder[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('mes');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [fetchingLabelId, setFetchingLabelId] = useState<string | null>(null);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [generatingDanfeId, setGeneratingDanfeId] = useState<string | null>(null);

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

  const handleFetchShippingLabel = async (order: BlingOrder) => {
    setFetchingLabelId(order.id);
    try {
      const res = await fetchBlingShippingLabel(order.id);
      if (res.ok && res.etiquetaEnvioUrl) {
        window.open(res.etiquetaEnvioUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast.show(res.motivo || 'Não foi possível buscar a etiqueta de envio.');
      }
    } catch (e: any) {
      toast.show('Erro ao buscar etiqueta de envio: ' + (e.message || e));
    } finally {
      setFetchingLabelId(null);
    }
  };

  const handleMergeDocs = async (order: BlingOrder) => {
    setMergingId(order.id);
    try {
      const res = await mergeBlingShippingDocuments(order.id, companyProfile);
      if (res.ok && res.base64) {
        await sharePdfBase64(res.base64, `etiqueta-danfe-pedido-${order.numero}.pdf`);
      } else {
        toast.show(res.motivo || 'Não foi possível gerar o PDF combinado.');
      }
    } catch (e: any) {
      toast.show('Erro ao gerar PDF combinado: ' + (e.message || e));
    } finally {
      setMergingId(null);
    }
  };

  const handleGenerateDanfeSimplificado = async (order: BlingOrder) => {
    setGeneratingDanfeId(order.id);
    try {
      const res = await fetchDanfeSimplificadoData(order.id, companyProfile);
      if (res.ok && res.base64) {
        await sharePdfBase64(res.base64, `danfe-simplificado-pedido-${order.numero}.pdf`);
      } else {
        toast.show(res.motivo || 'Não foi possível gerar o DANFE Simplificado.');
      }
    } catch (e: any) {
      toast.show('Erro ao gerar DANFE Simplificado: ' + (e.message || e));
    } finally {
      setGeneratingDanfeId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-32">
      <div className={`p-2 rounded-[2rem] border shadow-sm flex flex-col gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className={`flex items-center gap-1 p-1 rounded-2xl ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
          {(['dia', 'semana', 'mes', 'periodo'] as DateFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              data-guide-anchor="blingInvoices.filtroData"
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
          <div className="flex items-center gap-2 px-1">
            <input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              className={`flex-1 h-11 px-3 rounded-2xl text-xs font-bold ${isDarkMode ? 'bg-slate-950 border border-slate-800 text-white' : 'bg-slate-50 border border-slate-200 text-slate-900'}`}
            />
            <span className="text-[10px] font-black uppercase text-slate-400">até</span>
            <input
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
              className={`flex-1 h-11 px-3 rounded-2xl text-xs font-bold ${isDarkMode ? 'bg-slate-950 border border-slate-800 text-white' : 'bg-slate-50 border border-slate-200 text-slate-900'}`}
            />
          </div>
        )}

      </div>

      <p className="text-[10px] text-slate-400 font-bold leading-relaxed px-1">
        DANFE e PDF Simplificado abrem direto pelo link do Bling. Pra pedidos de marketplace (Shopee, Mercado Livre etc.) com integração de logística, é possível buscar a etiqueta de envio real (com QR code/rastreio) e gerar um PDF único com ela + o DANFE Simplificado.
      </p>

      {filtered.length === 0 && (
        <div className={`p-10 rounded-[2.5rem] border-2 border-dashed text-center ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-300'}`}>
          <FileText size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs font-black uppercase tracking-widest">Nenhuma nota fiscal no período</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((order) => {
          const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.EMITINDO;
          const isRefreshing = refreshingId === order.id;
          const missingData = SELECTABLE_STATUSES.has(order.status) && !order.danfeUrl;
          const canMergeDocs = order.origem !== 'PROPRIO' && !!(order.pdfUrl || order.danfeUrl);
          const dateLabel = format(new Date(order.updatedAt || order.createdAt), 'dd/MM/yyyy HH:mm');

          return (
            <div
              key={order.id}
              className={`p-4 rounded-[1.75rem] border-2 flex flex-col gap-3 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            >
              <div className="flex items-center gap-3">
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
                {order.origem !== 'PROPRIO' && (
                  order.etiquetaEnvioUrl ? (
                    <a
                      href={order.etiquetaEnvioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-guide-anchor="blingInvoices.abrirEtiquetaEnvio"
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest"
                    >
                      <QrCode size={12} /> Etiqueta de Envio
                    </a>
                  ) : (
                    <button
                      onClick={() => handleFetchShippingLabel(order)}
                      disabled={fetchingLabelId === order.id}
                      data-guide-anchor="blingInvoices.buscarEtiquetaEnvio"
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                    >
                      {fetchingLabelId === order.id ? <Loader2 size={12} className="animate-spin" /> : <QrCode size={12} />}
                      {fetchingLabelId === order.id ? 'Buscando...' : 'Buscar Etiqueta de Envio'}
                    </button>
                  )
                )}
                {canMergeDocs && (
                  <button
                    onClick={() => handleMergeDocs(order)}
                    disabled={mergingId === order.id}
                    data-guide-anchor="blingInvoices.gerarEtiquetaMaisDanfe"
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                  >
                    {mergingId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />}
                    {mergingId === order.id ? 'Gerando...' : 'DANFE Simplificado + Transporte'}
                  </button>
                )}
                {SELECTABLE_STATUSES.has(order.status) && (
                  <button
                    onClick={() => handleGenerateDanfeSimplificado(order)}
                    disabled={generatingDanfeId === order.id}
                    data-guide-anchor="blingInvoices.gerarDanfeSimplificado100x150"
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                  >
                    {generatingDanfeId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Barcode size={12} />}
                    {generatingDanfeId === order.id ? 'Gerando...' : 'DANFE Simplificado 100x150'}
                  </button>
                )}
                {missingData && (
                  <button
                    onClick={() => handleRefresh(order)}
                    disabled={isRefreshing}
                    data-guide-anchor="blingInvoices.atualizar"
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

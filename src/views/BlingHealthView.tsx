import { useEffect, useMemo, useState } from 'react';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, format } from 'date-fns';
import { PackageCheck, PackageX, Percent, Ticket, Plus, Minus, Pencil, History, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { BlingSalesLedgerEntry, BlingDevolucao, BlingNotesCounter, BlingNoteAdjustment } from '../types';
import { subscribeToBlingSalesLedger, subscribeToBlingDevolucoes, subscribeToBlingNotesCounter, subscribeToBlingNoteAdjustments, adjustBlingNotes } from '../services/blingService';
import { toast } from '../utils/toast';

interface BlingHealthViewProps {
  isDarkMode: boolean;
}

type Period = 'dia' | 'semana' | 'mes' | 'ano';

const PERIOD_LABEL: Record<Period, string> = { dia: 'Dia', semana: 'Semana', mes: 'Mês', ano: 'Ano' };

function StatTile({ label, value, sub, icon, color, isDarkMode }: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string; isDarkMode: boolean }) {
  return (
    <div className={`p-4 rounded-[1.75rem] border shadow-sm flex flex-col gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-[10px] font-bold text-slate-400">{sub}</p>}
    </div>
  );
}

/** Modal de ajuste manual do saldo de notas de terceiros — soma/subtrai um delta, ou fixa um
 * valor absoluto (usado pro cadastro inicial do talão). */
function AdjustNotesModal({ current, isDarkMode, onClose }: { current: number; isDarkMode: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<'somar' | 'subtrair' | 'fixar'>('somar');
  const [qty, setQty] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedQty = Math.max(0, Math.floor(Number(qty) || 0));
  const resultingTotal = mode === 'fixar' ? parsedQty : mode === 'somar' ? current + parsedQty : current - parsedQty;

  const handleConfirm = async () => {
    if (qty === '') return;
    setSaving(true);
    try {
      await adjustBlingNotes(
        mode === 'fixar'
          ? { setTo: parsedQty, motivo: motivo || undefined }
          : { delta: mode === 'somar' ? parsedQty : -parsedQty, motivo: motivo || undefined }
      );
      toast.show('Saldo de notas atualizado.');
      onClose();
    } catch (e: any) {
      toast.show('Erro ao ajustar notas: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-sm rounded-[2rem] p-6 flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
        <div className="flex items-center justify-between">
          <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Ajustar Notas de Terceiros</p>
          <button onClick={onClose} className="p-1 text-slate-400"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
          <button onClick={() => setMode('somar')} className={`flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-1 ${mode === 'somar' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}><Plus size={13} /> Somar</button>
          <button onClick={() => setMode('subtrair')} className={`flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-1 ${mode === 'subtrair' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}><Minus size={13} /> Subtrair</button>
          <button onClick={() => setMode('fixar')} className={`flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-1 ${mode === 'fixar' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Pencil size={13} /> Fixar</button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">{mode === 'fixar' ? 'Novo total' : 'Quantidade'}</label>
          <input
            type="number" inputMode="numeric" min={0} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus placeholder="0"
            className={`w-full px-4 py-3 rounded-2xl text-lg font-black outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Motivo (opcional)</label>
          <input
            type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: comprei 500 notas"
            className={`w-full px-4 py-3 rounded-2xl text-xs font-bold outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
          />
        </div>

        <div className={`flex items-center justify-between px-4 py-3 rounded-2xl ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo atual → novo</span>
          <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{current} → {resultingTotal}</span>
        </div>

        <button
          onClick={handleConfirm}
          disabled={qty === '' || saving}
          className="w-full h-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-40 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {saving ? 'Salvando...' : 'Confirmar'}
        </button>
      </div>
    </div>
  );
}

const ADJUSTMENT_LABEL: Record<string, string> = {
  CADASTRO: 'Cadastro inicial',
  AJUSTE_MANUAL: 'Ajuste manual',
  CONSUMO_VENDA: 'Consumo por venda',
  DEVOLUCAO: 'Devolução',
};

export default function BlingHealthView({ isDarkMode }: BlingHealthViewProps) {
  const [ledger, setLedger] = useState<BlingSalesLedgerEntry[]>([]);
  const [devolucoes, setDevolucoes] = useState<BlingDevolucao[]>([]);
  const [counter, setCounter] = useState<BlingNotesCounter | null>(null);
  const [adjustments, setAdjustments] = useState<BlingNoteAdjustment[]>([]);
  const [period, setPeriod] = useState<Period>('mes');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => subscribeToBlingSalesLedger(setLedger), []);
  useEffect(() => subscribeToBlingDevolucoes(setDevolucoes), []);
  useEffect(() => subscribeToBlingNotesCounter(setCounter), []);
  useEffect(() => subscribeToBlingNoteAdjustments(setAdjustments), []);

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === 'dia') return startOfDay(now);
    if (period === 'semana') return startOfWeek(now, { weekStartsOn: 1 });
    if (period === 'mes') return startOfMonth(now);
    return startOfYear(now);
  }, [period]);

  // Fonte: livro de vendas (blingSalesLedger) — só pedidos com NF-e realmente autorizada/emitida
  // (ver functions/src/bling/sync.ts), independente de o pedido ainda estar "Em aberto" no
  // Bling. Filtra por `dataVenda` (data real do pedido no Bling), não por `createdAt` (que é só
  // quando o app percebeu/registrou a venda, útil pra auditoria mas não pro filtro de período).
  const paresVendidos = useMemo(() => {
    const startMs = periodStart.getTime();
    return ledger.filter((l) => l.dataVenda >= startMs).reduce((sum, l) => sum + l.totalPares, 0);
  }, [ledger, periodStart]);

  const paresDevolvidos = useMemo(() => {
    const startMs = periodStart.getTime();
    return devolucoes.filter((d) => d.createdAt >= startMs).reduce((sum, d) => sum + d.quantidade, 0);
  }, [devolucoes, periodStart]);

  const taxaDevolucao = paresVendidos > 0 ? (paresDevolvidos / paresVendidos) * 100 : 0;

  const taxaNotasConsumidas = counter && counter.totalCadastrado > 0 ? (counter.totalConsumido / counter.totalCadastrado) * 100 : 0;

  return (
    <div className="flex flex-col gap-6 pb-32">
      {adjustOpen && <AdjustNotesModal current={counter?.total ?? 0} isDarkMode={isDarkMode} onClose={() => setAdjustOpen(false)} />}

      <div className={`flex items-center gap-1 p-1 rounded-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
        {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
              period === p ? (isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-900 shadow-sm') : 'text-slate-400'
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label={`Pares Vendidos · ${PERIOD_LABEL[period]}`}
          value={String(paresVendidos)}
          icon={<PackageCheck size={18} className="text-white" />}
          color="bg-emerald-600"
          isDarkMode={isDarkMode}
        />
        <StatTile
          label={`Pares Devolvidos · ${PERIOD_LABEL[period]}`}
          value={String(paresDevolvidos)}
          icon={<PackageX size={18} className="text-white" />}
          color="bg-rose-600"
          isDarkMode={isDarkMode}
        />
        <StatTile
          label={`Taxa de Devolução · ${PERIOD_LABEL[period]}`}
          value={`${taxaDevolucao.toFixed(1)}%`}
          sub={`${paresDevolvidos} devolvidos de ${paresVendidos} vendidos no período`}
          icon={<Percent size={18} className="text-white" />}
          color="bg-indigo-600"
          isDarkMode={isDarkMode}
        />
        <StatTile
          label="Notas Consumidas"
          value={`${taxaNotasConsumidas.toFixed(1)}%`}
          sub="Do total cadastrado no talão"
          icon={<Ticket size={18} className="text-white" />}
          color="bg-amber-500"
          isDarkMode={isDarkMode}
        />
      </div>

      <div className={`p-5 rounded-[2rem] border shadow-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket size={18} className="text-amber-500" />
            <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Notas de Terceiros</p>
          </div>
          <button
            onClick={() => setAdjustOpen(true)}
            className="h-8 px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"
          >
            <Pencil size={12} /> Ajustar
          </button>
        </div>

        <div className={`p-4 rounded-2xl text-center ${counter && counter.total < 0 ? 'bg-rose-50 dark:bg-rose-900/20' : isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Saldo disponível</p>
          <p className={`text-4xl font-black tracking-tight ${counter && counter.total < 0 ? 'text-rose-600 dark:text-rose-400' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {counter?.total ?? 0}
          </p>
          {counter && counter.total < 0 && (
            <p className="text-[10px] font-bold text-rose-500 mt-1">Saldo negativo — o talão acabou, cadastre mais notas.</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className={`p-3 rounded-2xl text-center ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Cadastrado</p>
            <p className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{counter?.totalCadastrado ?? 0}</p>
          </div>
          <div className={`p-3 rounded-2xl text-center ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Consumido</p>
            <p className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{counter?.totalConsumido ?? 0}</p>
          </div>
          <div className={`p-3 rounded-2xl text-center ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Devolvido</p>
            <p className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{counter?.totalDevolvido ?? 0}</p>
          </div>
        </div>

        <button onClick={() => setHistoryOpen((v) => !v)} className="flex items-center justify-between px-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><History size={12} /> Histórico de ajustes</span>
          {historyOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </button>

        {historyOpen && (
          <div className="flex flex-col gap-1.5">
            {adjustments.length === 0 && <p className="text-center text-[11px] font-bold text-slate-400 py-4">Nenhum ajuste ainda.</p>}
            {adjustments.slice(0, 30).map((a) => (
              <div key={a.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-xl ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <div className="min-w-0">
                  <p className={`text-[11px] font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{ADJUSTMENT_LABEL[a.type] || a.type}</p>
                  <p className="text-[9px] text-slate-400 font-bold truncate">{a.motivo || format(new Date(a.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <span className={`text-xs font-black shrink-0 ${a.delta > 0 ? 'text-emerald-500' : a.delta < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                  {a.delta > 0 ? '+' : ''}{a.delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

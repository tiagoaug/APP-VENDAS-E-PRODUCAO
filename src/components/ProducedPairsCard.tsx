import { useState, useRef, useEffect, useMemo } from 'react';
import { ProductionLot } from '../types';
import { ChevronDown, Calendar, Factory, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPeriodRange, OverviewPeriodType, STATS_PERIOD_LABELS, computeProducedPairs } from '../utils/businessOverview';
import { OverviewComparisonMode } from '../services/businessOverviewService';
import { subscribeToProductionScheduleConfig } from '../services/productionScheduleService';
import { usePrivacyMode, PRIVACY_BLUR_CLASS } from '../contexts/PrivacyContext';

// Card "Análise de Produção" — pares finalizados (ProductionLot.finishedAt) num período
// escolhido, com a média por dia (total ÷ dias do período) e comparação opcional com outro
// período, além da média histórica (todo o período já produzido) por mês e por ano. Mesmo
// padrão de período/comparação do "Visualização do Meu Negócio" (BusinessOverviewCard.tsx),
// mas isolado num card próprio por ser uma métrica de produção, não financeira. Estado local
// (não persiste) — cada instância no Dashboard é independente.
interface ProducedPairsCardProps {
  isDarkMode: boolean;
  productionLots: ProductionLot[];
}

export default function ProducedPairsCard({ isDarkMode, productionLots }: ProducedPairsCardProps) {
  const hidePrivacy = usePrivacyMode();
  const [isExpanded, setIsExpanded] = useState(false);

  // Considerar só dias úteis (seg-sex) na Média por Dia, e se conta o período inteiro ou só os
  // dias já passados — configurável em Configuração de Fábrica; espelha o mesmo toggle usado
  // pela barra de estatísticas do PCP Monitor.
  const [excludeWeekends, setExcludeWeekends] = useState(true);
  const [averageMode, setAverageMode] = useState<'FULL_PERIOD' | 'ELAPSED'>('ELAPSED');
  useEffect(() => {
    const unsub = subscribeToProductionScheduleConfig(cfg => { setExcludeWeekends(cfg.excludeWeekends); setAverageMode(cfg.averageMode); });
    return () => unsub();
  }, []);
  const elapsedOnly = excludeWeekends && averageMode === 'ELAPSED';

  const [periodType, setPeriodType] = useState<OverviewPeriodType>('MONTH');
  const [periodDate, setPeriodDate] = useState(() => format(new Date(), 'yyyy-MM'));
  const dateInputRef = useRef<HTMLInputElement>(null);
  const openMonthPicker = () => {
    const el = dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el) return;
    try { el.showPicker ? el.showPicker() : el.focus(); } catch { el.focus(); }
  };

  const [comparisonMode, setComparisonMode] = useState<OverviewComparisonMode>('NONE');
  const [compPeriodType, setCompPeriodType] = useState<OverviewPeriodType>('MONTH');
  const [compPeriodDate, setCompPeriodDate] = useState(() => format(new Date(), 'yyyy-MM'));
  const compDateInputRef = useRef<HTMLInputElement>(null);
  const openCompMonthPicker = () => {
    const el = compDateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el) return;
    try { el.showPicker ? el.showPicker() : el.focus(); } catch { el.focus(); }
  };

  const { start, end } = getPeriodRange(periodType, periodDate);
  const produced = computeProducedPairs(productionLots, start, end, excludeWeekends, elapsedOnly);

  let comparison: { total: number; delta: number; label: string } | null = null;
  if (comparisonMode !== 'NONE') {
    let compStart: number, compEnd: number, label: string;
    if (comparisonMode === 'AUTO') {
      const duration = end - start;
      compStart = start - duration - 1000;
      compEnd = start - 1;
      label = 'Período anterior (automático)';
    } else {
      const r = getPeriodRange(compPeriodType, compPeriodDate);
      compStart = r.start;
      compEnd = r.end;
      label = format(new Date(compPeriodDate + '-01T12:00:00'), 'MMM/yy', { locale: ptBR });
    }
    const compProduced = computeProducedPairs(productionLots, compStart, compEnd, excludeWeekends, elapsedOnly);
    const delta = compProduced.total === 0
      ? (produced.total > 0 ? 100 : 0)
      : ((produced.total - compProduced.total) / compProduced.total) * 100;
    comparison = { total: compProduced.total, delta, label };
  }

  // Média histórica (todo o histórico de produção, não só o período escolhido acima) — desde o
  // primeiro Mapa finalizado até hoje, pra dar uma noção de ritmo médio "de sempre" por mês e
  // por ano, complementando a média por dia do período selecionado.
  const allTimeAverages = useMemo(() => {
    const finished = productionLots.filter(l => l.finishedAt);
    if (finished.length === 0) return { avgPerMonth: 0, avgPerYear: 0 };
    const total = finished.reduce((acc, l) => acc + (l.quantity || 0), 0);
    const earliest = Math.min(...finished.map(l => l.finishedAt!));
    const monthsSpan = Math.max(1, (Date.now() - earliest) / (1000 * 60 * 60 * 24 * 30.44));
    const avgPerMonth = total / monthsSpan;
    return { avgPerMonth, avgPerYear: avgPerMonth * 12 };
  }, [productionLots]);

  return (
    <div className={`rounded-[2.5rem] border shadow-sm p-6 flex flex-col gap-5 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(v => !v)}
        data-guide-anchor="dash.producedPairs.expandir"
        className="flex items-center justify-between gap-3 w-full"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-teal-500/15 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>
            <Factory size={20} />
          </div>
          <div className="text-left min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Análise de Produção</p>
            <p className={`text-2xl font-black tracking-tighter mt-0.5 transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
              {produced.total} <span className="text-xs font-bold text-slate-400 uppercase">pares</span>
            </p>
          </div>
        </div>
        <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-1.5 p-1 bg-slate-50 dark:bg-slate-950 rounded-2xl">
            {(Object.keys(STATS_PERIOD_LABELS) as OverviewPeriodType[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodType(p)}
                data-guide-anchor="dash.producedPairs.periodo"
                className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  periodType === p ? 'bg-white dark:bg-slate-800 shadow-sm text-teal-600 dark:text-teal-400' : 'text-slate-400'
                }`}
              >
                {STATS_PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <div
            onClick={openMonthPicker}
            data-guide-anchor="dash.producedPairs.mesEscolhido"
            className={`flex items-center gap-2 rounded-xl px-3 py-2 border-2 cursor-pointer ${isDarkMode ? 'bg-teal-900/20 border-teal-800/40' : 'bg-teal-50 border-teal-200'}`}
          >
            <Calendar size={13} className="text-teal-500 shrink-0" />
            <input
              ref={dateInputRef}
              type="month"
              value={periodDate}
              onChange={(e) => setPeriodDate(e.target.value)}
              className={`flex-1 border-none bg-transparent px-0 py-0 text-[10px] font-black outline-none pointer-events-none ${isDarkMode ? 'text-teal-400' : 'text-teal-700'}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50">
              <p className="text-[8px] font-black text-slate-400 tracking-widest uppercase">Total no período</p>
              <p className={`text-2xl font-black mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                {produced.total} <span className="text-xs text-slate-400 font-bold">pares</span>
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50">
              <p className="text-[8px] font-black text-slate-400 tracking-widest uppercase">{excludeWeekends ? 'Média por dia útil' : 'Média por dia'}</p>
              <p className={`text-2xl font-black mt-1 text-teal-600 dark:text-teal-400 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                {produced.dailyAverage.toFixed(1).replace('.', ',')} <span className="text-xs text-slate-400 font-bold">pares/dia</span>
              </p>
              <p className="text-[8px] font-bold text-slate-400 mt-1">
                {produced.workDays} {excludeWeekends ? 'dias úteis' : 'dias'} {elapsedOnly ? 'até agora' : 'no período'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50">
              <p className="text-[8px] font-black text-slate-400 tracking-widest uppercase">Média por Mês</p>
              <p className={`text-2xl font-black mt-1 text-teal-600 dark:text-teal-400 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                {allTimeAverages.avgPerMonth.toFixed(1).replace('.', ',')} <span className="text-xs text-slate-400 font-bold">pares/mês</span>
              </p>
              <p className="text-[8px] font-bold text-slate-400 mt-1">Histórico completo</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50">
              <p className="text-[8px] font-black text-slate-400 tracking-widest uppercase">Média por Ano</p>
              <p className={`text-2xl font-black mt-1 text-teal-600 dark:text-teal-400 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                {allTimeAverages.avgPerYear.toFixed(0)} <span className="text-xs text-slate-400 font-bold">pares/ano</span>
              </p>
              <p className="text-[8px] font-bold text-slate-400 mt-1">Histórico completo</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Comparar com</p>
            <div className="flex gap-1.5 p-1 bg-slate-50 dark:bg-slate-950 rounded-2xl">
              {([
                ['NONE', 'Sem comparação'],
                ['AUTO', 'Automático'],
                ['MANUAL', 'Período específico'],
              ] as [OverviewComparisonMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setComparisonMode(mode)}
                  data-guide-anchor="dash.producedPairs.modoComparacao"
                  className={`flex-1 py-2 rounded-xl text-[8.5px] font-black uppercase tracking-widest transition-all ${
                    comparisonMode === mode ? 'bg-white dark:bg-slate-800 shadow-sm text-teal-600 dark:text-teal-400' : 'text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {comparisonMode === 'MANUAL' && (
              <div className="flex gap-2">
                <select
                  title="Tipo do período de comparação"
                  value={compPeriodType}
                  onChange={(e) => setCompPeriodType(e.target.value as OverviewPeriodType)}
                  data-guide-anchor="dash.producedPairs.tipoComparacao"
                  className={`rounded-xl px-2 py-2.5 text-[9px] font-bold border-none outline-none ${isDarkMode ? 'bg-teal-900/30 text-teal-400' : 'bg-teal-50 text-teal-600'}`}
                >
                  {(Object.keys(STATS_PERIOD_LABELS) as OverviewPeriodType[]).map((p) => (
                    <option key={p} value={p}>{STATS_PERIOD_LABELS[p]}</option>
                  ))}
                </select>
                <div
                  onClick={openCompMonthPicker}
                  data-guide-anchor="dash.producedPairs.mesComparacao"
                  className={`flex-1 flex items-center rounded-xl cursor-pointer ${isDarkMode ? 'bg-teal-900/30' : 'bg-teal-50'}`}
                >
                  <input
                    ref={compDateInputRef}
                    type="month"
                    title="Mês/ano de referência da comparação"
                    value={compPeriodDate}
                    onChange={(e) => setCompPeriodDate(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2.5 text-[10px] font-bold border-none bg-transparent outline-none pointer-events-none ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`}
                  />
                </div>
              </div>
            )}
            {comparison && (
              <div className={`flex items-center justify-between gap-2 p-3 rounded-2xl ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
                <span className={`text-[9px] font-bold uppercase tracking-widest text-slate-400 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                  {comparison.label}: {comparison.total} pares
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 ${comparison.delta >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
                  {comparison.delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {Math.abs(comparison.delta).toFixed(1).replace('.', ',')}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Settings, RotateCcw, Save, Info } from 'lucide-react';
import { LaborSimParams, DEFAULT_LABOR_SIM_PARAMS } from '../utils/laborTermination';
import { toast } from '../utils/toast';

// Tela de parâmetros do Simulador de Rescisão — todo valor "base" usado nos cálculos
// (utils/laborTermination.ts) fica editável aqui, pra quando a lei mudar (nova tabela de
// INSS/IRRF, novo % de multa, etc.) sem precisar esperar uma atualização do app. Persistido
// em localStorage + Firestore (ver laborSimParams/saveLaborSimParams em App.tsx).
interface LaborSimParamsViewProps {
  isDarkMode: boolean;
  params: LaborSimParams;
  onSave: (params: LaborSimParams) => void;
}

const inputClass = (isDarkMode: boolean) =>
  `w-full px-3 py-2.5 rounded-xl border-2 text-sm font-bold outline-none focus:border-indigo-500 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`;

const labelClass = 'text-[10px] font-black uppercase tracking-widest text-slate-400 px-1';

export default function LaborSimParamsView({ isDarkMode, params, onSave }: LaborSimParamsViewProps) {
  const [draft, setDraft] = useState<LaborSimParams>(params);

  const updateInss = (index: number, field: 'limite' | 'aliquota', value: number) => {
    setDraft(d => ({
      ...d,
      inssFaixas: d.inssFaixas.map((f, i) => i === index ? { ...f, [field]: value } : f),
    }));
  };

  const updateIrrf = (index: number, field: 'limite' | 'aliquota' | 'deducao', value: number) => {
    setDraft(d => ({
      ...d,
      irrfFaixas: d.irrfFaixas.map((f, i) => i === index ? { ...f, [field]: value } : f),
    }));
  };

  const handleSave = () => {
    onSave(draft);
    toast.success('Parâmetros salvos!');
  };

  const handleReset = () => {
    setDraft(DEFAULT_LABOR_SIM_PARAMS);
    toast.show('Valores padrão carregados — toque em Salvar pra confirmar.');
  };

  const cardClass = `p-6 rounded-[2rem] border shadow-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`;

  return (
    <div className="flex flex-col gap-6 pb-24 max-w-3xl mx-auto">
      <header className="flex items-center gap-3">
        <div className="p-2 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
          <Settings size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Parâmetros do Simulador</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tabelas e valores base — CLT, INSS, IRRF, FGTS</p>
        </div>
      </header>

      <div className={`flex items-start gap-2 p-4 rounded-2xl text-[11px] font-semibold ${isDarkMode ? 'bg-slate-800/60 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
        <Info size={16} className="shrink-0 mt-0.5" />
        Esses valores alimentam os dois cálculos do Simulador de Rescisão. Ajuste aqui sempre que a lei, uma tabela do governo (INSS/IRRF) ou uma norma interna da empresa mudar — não é preciso atualizar o app.
      </div>

      <div className={cardClass} data-guide-anchor="laborParams.inssTabela">
        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Tabela INSS (progressiva)</h3>
        <p className="text-[10px] font-semibold text-slate-400">Cada faixa se aplica só à parte do valor dentro dela — "Até R$" é o teto da faixa.</p>
        {draft.inssFaixas.map((faixa, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <label className={labelClass}>Faixa {i + 1} — Até R$</label>
              <input type="number" inputMode="decimal" min={0} value={faixa.limite} onChange={e => updateInss(i, 'limite', Number(e.target.value))} className={inputClass(isDarkMode)} />
            </div>
            <div className="w-28 flex flex-col gap-1">
              <label className={labelClass}>Alíquota %</label>
              <input type="number" inputMode="decimal" min={0} step={0.1} value={(faixa.aliquota * 100).toFixed(2).replace(/\.?0+$/, '') || '0'} onChange={e => updateInss(i, 'aliquota', (Number(e.target.value) || 0) / 100)} className={inputClass(isDarkMode)} />
            </div>
          </div>
        ))}
      </div>

      <div className={cardClass} data-guide-anchor="laborParams.irrfTabela">
        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Tabela IRRF Mensal</h3>
        <p className="text-[10px] font-semibold text-slate-400">A última faixa cobre qualquer valor acima do limite dela (sem teto).</p>
        {draft.irrfFaixas.map((faixa, i) => {
          const isLast = i === draft.irrfFaixas.length - 1;
          return (
            <div key={i} className="flex items-end gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <label className={labelClass}>{isLast ? 'Acima de R$ (sem teto)' : 'Faixa até R$'}</label>
                {isLast ? (
                  <div className={`${inputClass(isDarkMode)} opacity-50`}>{draft.irrfFaixas[i - 1]?.limite.toLocaleString('pt-BR')}</div>
                ) : (
                  <input type="number" inputMode="decimal" min={0} value={faixa.limite} onChange={e => updateIrrf(i, 'limite', Number(e.target.value))} className={inputClass(isDarkMode)} />
                )}
              </div>
              <div className="w-24 flex flex-col gap-1">
                <label className={labelClass}>Alíquota %</label>
                <input type="number" inputMode="decimal" min={0} step={0.1} value={(faixa.aliquota * 100).toFixed(2).replace(/\.?0+$/, '') || '0'} onChange={e => updateIrrf(i, 'aliquota', (Number(e.target.value) || 0) / 100)} className={inputClass(isDarkMode)} />
              </div>
              <div className="w-28 flex flex-col gap-1">
                <label className={labelClass}>Deduzir R$</label>
                <input type="number" inputMode="decimal" min={0} step={0.01} value={faixa.deducao} onChange={e => updateIrrf(i, 'deducao', Number(e.target.value))} className={inputClass(isDarkMode)} />
              </div>
            </div>
          );
        })}
      </div>

      <div className={cardClass} data-guide-anchor="laborParams.outrosValores">
        <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Outros Valores Base</h3>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Dedução por Dependente (IRRF) — R$</label>
            <input type="number" inputMode="decimal" min={0} step={0.01} value={draft.dependenteIrrf} onChange={e => setDraft(d => ({ ...d, dependenteIrrf: Number(e.target.value) || 0 }))} className={inputClass(isDarkMode)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>FGTS Mensal Estimado (% do salário)</label>
            <input type="number" inputMode="decimal" min={0} step={0.1} value={(draft.fgtsPercentMensal * 100).toFixed(2).replace(/\.?0+$/, '') || '0'} onChange={e => setDraft(d => ({ ...d, fgtsPercentMensal: (Number(e.target.value) || 0) / 100 }))} className={inputClass(isDarkMode)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Multa FGTS — Sem Justa Causa (%)</label>
            <input type="number" inputMode="decimal" min={0} step={1} value={(draft.multaFgtsSemJustaCausa * 100).toFixed(2).replace(/\.?0+$/, '') || '0'} onChange={e => setDraft(d => ({ ...d, multaFgtsSemJustaCausa: (Number(e.target.value) || 0) / 100 }))} className={inputClass(isDarkMode)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Multa FGTS — Acordo Mútuo (%)</label>
            <input type="number" inputMode="decimal" min={0} step={1} value={(draft.multaFgtsAcordoMutuo * 100).toFixed(2).replace(/\.?0+$/, '') || '0'} onChange={e => setDraft(d => ({ ...d, multaFgtsAcordoMutuo: (Number(e.target.value) || 0) / 100 }))} className={inputClass(isDarkMode)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Aviso Prévio — Dias Base</label>
            <input type="number" inputMode="numeric" min={0} value={draft.avisoPrevioBaseDias} onChange={e => setDraft(d => ({ ...d, avisoPrevioBaseDias: Number(e.target.value) || 0 }))} className={inputClass(isDarkMode)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Aviso Prévio — Dias Adicionais por Ano de Casa</label>
            <input type="number" inputMode="numeric" min={0} value={draft.avisoPrevioDiasPorAno} onChange={e => setDraft(d => ({ ...d, avisoPrevioDiasPorAno: Number(e.target.value) || 0 }))} className={inputClass(isDarkMode)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>Aviso Prévio — Máximo de Dias</label>
            <input type="number" inputMode="numeric" min={0} value={draft.avisoPrevioMaxDias} onChange={e => setDraft(d => ({ ...d, avisoPrevioMaxDias: Number(e.target.value) || 0 }))} className={inputClass(isDarkMode)} />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleReset}
          data-guide-anchor="laborParams.restaurarPadroes"
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          <RotateCcw size={14} /> Restaurar Padrões
        </button>
        <button
          type="button"
          onClick={handleSave}
          data-guide-anchor="laborParams.salvar"
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
        >
          <Save size={14} /> Salvar
        </button>
      </div>
    </div>
  );
}

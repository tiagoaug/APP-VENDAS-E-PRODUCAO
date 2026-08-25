import { useMemo, useState } from 'react';
import { ArrowLeft, Calculator, ChevronUp, ChevronDown, Plus, Trash2, Sparkles, X, Check, Image as ImageIcon, Loader2, HelpCircle } from 'lucide-react';
import { ProductionConfigItem } from '../types';
import { shareImages } from '../utils/pdfExport';
import { toast } from '../utils/toast';
import CalculatorModal from '../components/CalculatorModal';

interface RuleOfThreeViewProps {
  onBack: () => void;
  isDarkMode: boolean;
  // Unidades de medida já cadastradas na conta (Configuração de Fábrica > Unidades) — oferecidas
  // no popup de escolha, mas o campo aceita qualquer texto digitado (contas de Vendas sem
  // módulo de Produção podem não ter nenhuma unidade cadastrada).
  units: ProductionConfigItem[];
}

function formatResult(n: number): string {
  if (!isFinite(n)) return '—';
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

// Mesmo padrão já usado em "Valores de Serviço por Setor" (PCP): setinhas pra ajuste rápido de
// 1 em 1, e um ícone de calculadora pra quem precisa somar/multiplicar antes de inserir o
// valor (ex.: "3 caixas de 12" sem precisar fazer a conta de cabeça).
function NumberField({ value, onChange, isDarkMode, placeholder }: { value: number; onChange: (v: number) => void; isDarkMode: boolean; placeholder?: string }) {
  const [calcOpen, setCalcOpen] = useState(false);
  return (
    <>
      <div className={`flex items-stretch rounded-xl border-2 overflow-hidden shrink-0 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
        <input
          type="number"
          inputMode="decimal"
          value={value === 0 ? '' : value}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          placeholder={placeholder || '0'}
          className={`w-16 px-2 py-2 bg-transparent outline-none text-sm font-black text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
        />
        <div className={`flex flex-col border-l ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <button type="button" onClick={() => onChange(Math.max(0, value + 1))} className={`px-1.5 flex-1 flex items-center justify-center ${isDarkMode ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-indigo-600'}`}>
            <ChevronUp size={11} />
          </button>
          <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className={`px-1.5 flex-1 flex items-center justify-center border-t ${isDarkMode ? 'border-slate-800 text-slate-500 hover:text-white' : 'border-slate-200 text-slate-400 hover:text-indigo-600'}`}>
            <ChevronDown size={11} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCalcOpen(true)}
          title="Abrir calculadora"
          aria-label="Abrir calculadora pra este campo"
          data-guide-anchor="ruleOfThree.calculadoraInsercao"
          className={`px-2 flex items-center justify-center border-l ${isDarkMode ? 'border-slate-800 text-slate-500 hover:text-white' : 'border-slate-200 text-slate-400 hover:text-indigo-600'}`}
        >
          <Calculator size={13} />
        </button>
      </div>
      <CalculatorModal
        isOpen={calcOpen}
        onClose={() => setCalcOpen(false)}
        onResult={(r) => onChange(Math.max(0, r))}
        isDarkMode={isDarkMode}
        initialValue={value || undefined}
        zIndex={320000}
      />
    </>
  );
}

// Campo de unidade: digita direto (texto livre) OU toca na setinha pra escolher de um popup
// com as unidades já cadastradas (ver UnitPickerModal) — as duas formas mexem no mesmo valor.
function UnitButton({ value, onChange, onOpen, isDarkMode, placeholder }: { value: string; onChange: (v: string) => void; onOpen: () => void; isDarkMode: boolean; placeholder: string }) {
  return (
    <div className={`flex-1 min-w-0 flex items-center gap-1 rounded-xl border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 min-w-0 px-3 py-2.5 bg-transparent outline-none text-xs font-black uppercase tracking-wide ${isDarkMode ? 'text-white placeholder:text-slate-600' : 'text-slate-900 placeholder:text-slate-400'}`}
      />
      <button
        type="button"
        onClick={onOpen}
        title="Escolher de uma lista"
        aria-label="Escolher unidade de uma lista"
        className={`shrink-0 pr-2.5 pl-1 py-2.5 ${isDarkMode ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-indigo-600'}`}
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}

interface CompoundRow {
  id: string;
  label: string;
  unit: string;
  val1: number;
  val2: number;
  // O que está acontecendo em cada situação (ex.: "com máquina nova", "sem ajudante") — anotação
  // livre, não entra na conta, só ajuda a lembrar depois o que cada número representava.
  desc1: string;
  desc2: string;
  direction: 'direct' | 'inverse';
}

export default function RuleOfThreeView({ onBack, isDarkMode, units }: RuleOfThreeViewProps) {
  const [mode, setMode] = useState<'simple' | 'compound'>('simple');
  const [helpOpen, setHelpOpen] = useState(false);

  // Popup único de escolha de unidade, compartilhado por todos os campos de unidade da tela —
  // guarda o valor atual e o "onSelect" de quem abriu, pra devolver a escolha certa.
  const [unitPicker, setUnitPicker] = useState<{ current: string; onSelect: (v: string) => void } | null>(null);
  const [unitPickerDraft, setUnitPickerDraft] = useState('');
  const openUnitPicker = (current: string, onSelect: (v: string) => void) => {
    setUnitPickerDraft(current);
    setUnitPicker({ current, onSelect });
  };
  const confirmUnitPicker = (value: string) => {
    if (unitPicker) unitPicker.onSelect(value);
    setUnitPicker(null);
  };

  // ── Regra de Três Simples ──────────────────────────────────────────────────────────────────
  const [unitA, setUnitA] = useState('');
  const [unitB, setUnitB] = useState('');
  const [a1, setA1] = useState(0);
  const [b1, setB1] = useState(0);
  const [direction, setDirection] = useState<'direct' | 'inverse'>('direct');
  const [a2, setA2] = useState(0);

  const simpleResult = useMemo(() => {
    if (!a1 || !b1 || !a2) return null;
    return direction === 'direct' ? (a2 * b1) / a1 : (a1 * b1) / a2;
  }, [a1, b1, a2, direction]);

  // ── Regra de Três Composta ─────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<CompoundRow[]>([
    { id: '1', label: '', unit: '', val1: 0, val2: 0, desc1: '', desc2: '', direction: 'direct' },
    { id: '2', label: '', unit: '', val1: 0, val2: 0, desc1: '', desc2: '', direction: 'direct' },
  ]);
  const [resultLabel, setResultLabel] = useState('');
  const [resultUnit, setResultUnit] = useState('');
  const [resultVal1, setResultVal1] = useState(0);
  const [resultDesc1, setResultDesc1] = useState('');

  const updateRow = (id: string, patch: Partial<CompoundRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const addRow = () => {
    if (rows.length >= 5) return;
    setRows((prev) => [...prev, { id: `${Date.now()}`, label: '', unit: '', val1: 0, val2: 0, desc1: '', desc2: '', direction: 'direct' }]);
  };
  const removeRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const compoundResult = useMemo(() => {
    if (!resultVal1) return null;
    let factor = 1;
    for (const row of rows) {
      if (!row.val1 || !row.val2) return null;
      factor *= row.direction === 'direct' ? row.val2 / row.val1 : row.val1 / row.val2;
    }
    return resultVal1 * factor;
  }, [rows, resultVal1]);

  // ── Exportar em JPG ────────────────────────────────────────────────────────────────────────
  // Desenha um resuminho da conta (perguntas + resposta) num canvas, igual ao mecanismo já
  // usado no resto do app pra exportar nota/etiqueta em JPG — não existe html2canvas aqui, é
  // tudo desenhado manualmente.
  const [exportingJpg, setExportingJpg] = useState(false);

  const buildResultImage = (): string | null => {
    if (mode === 'simple' && simpleResult === null) return null;
    if (mode === 'compound' && compoundResult === null) return null;

    const W = 640;
    const S = 2;
    const pad = 32;
    const lineH = 32;

    const lines: { text: string; size: number; weight: string; color: string; gapAfter?: number }[] = [
      { text: mode === 'simple' ? 'Regra de Três — Simples' : 'Regra de Três — Composta', size: 20, weight: '900', color: '#0f172a', gapAfter: 16 },
    ];

    if (mode === 'simple') {
      lines.push({ text: `Se com ${formatResult(a1)} ${unitA || '?'} eu consigo ${formatResult(b1)} ${unitB || '?'}`, size: 15, weight: '700', color: '#334155' });
      lines.push({ text: direction === 'direct' ? 'As duas coisas aumentam juntas' : 'Uma aumenta, a outra diminui', size: 12, weight: '600', color: '#64748b', gapAfter: 8 });
      lines.push({ text: `Com ${formatResult(a2)} ${unitA || '?'}, quanto dá de ${unitB || '?'}?`, size: 15, weight: '700', color: '#334155' });
    } else {
      rows.forEach((row, i) => {
        const d1 = row.desc1 ? ` (${row.desc1})` : '';
        const d2 = row.desc2 ? ` (${row.desc2})` : '';
        lines.push({
          text: `${row.label || `Grandeza ${i + 1}`}: ${formatResult(row.val1)}${d1} → ${formatResult(row.val2)}${d2} ${row.unit} (${row.direction === 'direct' ? 'aumenta junto' : 'diminui'})`,
          size: 13, weight: '700', color: '#334155',
        });
      });
      const resD1 = resultDesc1 ? ` (${resultDesc1})` : '';
      lines.push({ text: `${resultLabel || 'Resultado'}: ${formatResult(resultVal1)}${resD1} ${resultUnit} na Situação 1`, size: 13, weight: '700', color: '#334155', gapAfter: 8 });
    }

    const RESULT_BOX_H = 100;
    const H = pad * 2 + lines.reduce((acc, l) => acc + lineH + (l.gapAfter || 0), 0) + RESULT_BOX_H + 20;

    const canvas = document.createElement('canvas');
    canvas.width = W * S;
    canvas.height = H * S;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(S, S);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'top';

    let cy = pad;
    lines.forEach((l) => {
      ctx.fillStyle = l.color;
      ctx.font = `${l.weight} ${l.size}px sans-serif`;
      ctx.fillText(l.text, pad, cy, W - pad * 2);
      cy += lineH + (l.gapAfter || 0);
    });

    const resultText = mode === 'simple'
      ? `${formatResult(simpleResult as number)} ${unitB || ''}`
      : `${formatResult(compoundResult as number)} ${resultUnit || ''}`;

    cy += 10;
    ctx.fillStyle = '#ecfdf5';
    if (typeof (ctx as any).roundRect === 'function') {
      ctx.beginPath();
      (ctx as any).roundRect(pad, cy, W - pad * 2, RESULT_BOX_H, 18);
      ctx.fill();
    } else {
      ctx.fillRect(pad, cy, W - pad * 2, RESULT_BOX_H);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#059669';
    ctx.font = '900 12px sans-serif';
    ctx.fillText('RESPOSTA', W / 2, cy + 20);
    ctx.fillStyle = '#047857';
    ctx.font = '900 30px sans-serif';
    ctx.fillText(resultText, W / 2, cy + 44);
    ctx.textAlign = 'left';

    return canvas.toDataURL('image/jpeg', 0.92);
  };

  const handleExportJpg = async () => {
    const dataUrl = buildResultImage();
    if (!dataUrl) return;
    setExportingJpg(true);
    try {
      await shareImages([dataUrl], 'regra_de_tres');
    } catch (err: any) {
      toast.show('Erro ao exportar: ' + (err?.message || err));
    } finally {
      setExportingJpg(false);
    }
  };

  const textCls = isDarkMode ? 'text-white' : 'text-slate-900';
  const cardCls = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm';
  const labelCls = 'text-[9px] font-black uppercase tracking-widest text-slate-400';

  return (
    <div className={`flex flex-col h-full pb-32 px-1 overflow-y-auto overflow-x-hidden force-scrollbar ${textCls}`}>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-indigo-500" />
            <h2 className={`text-[13px] font-black uppercase tracking-tight ${textCls}`}>Regra de Três</h2>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            Descubra proporções sem complicação
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex gap-2" data-guide-anchor="ruleOfThree.abas">
          <button
            type="button"
            onClick={() => setMode('simple')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              mode === 'simple' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}
          >
            Simples
          </button>
          <button
            type="button"
            onClick={() => setMode('compound')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              mode === 'compound' ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}
          >
            Composta
          </button>
        </div>

        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          data-guide-anchor="ruleOfThree.comoFunciona"
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-indigo-900/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}
        >
          <HelpCircle size={14} /> Como Funciona? Ver Exemplo
        </button>

        {mode === 'simple' ? (
          <div className={`p-5 rounded-[2rem] border flex flex-col gap-5 ${cardCls}`}>
            <div className={`p-3 rounded-2xl flex items-start gap-2 ${isDarkMode ? 'bg-indigo-900/10' : 'bg-indigo-50/60'}`}>
              <Sparkles size={14} className="text-indigo-500 mt-0.5 shrink-0" />
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                Use quando <span className="font-black">só duas coisas</span> mudam juntas — ex.:
                "com tantos pares, gasto tanto de material".
              </p>
            </div>

            <div className="flex flex-col gap-3" data-guide-anchor="ruleOfThree.simplesConhecido">
              <p className={labelCls}>1. O que você já sabe</p>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold">Se com</span>
                <div className="flex gap-2">
                  <NumberField value={a1} onChange={setA1} isDarkMode={isDarkMode} />
                  <UnitButton value={unitA} onChange={setUnitA} onOpen={() => openUnitPicker(unitA, setUnitA)} isDarkMode={isDarkMode} placeholder="ex: pares" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold">eu consigo</span>
                <div className="flex gap-2">
                  <NumberField value={b1} onChange={setB1} isDarkMode={isDarkMode} />
                  <UnitButton value={unitB} onChange={setUnitB} onOpen={() => openUnitPicker(unitB, setUnitB)} isDarkMode={isDarkMode} placeholder="ex: metros" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2" data-guide-anchor="ruleOfThree.simplesDirecao">
              <p className={labelCls}>2. Quando uma aumenta, a outra...</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('direct')}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    direction === 'direct' ? 'bg-emerald-500 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  Também aumenta junto
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('inverse')}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    direction === 'inverse' ? 'bg-amber-500 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  Diminui
                </button>
              </div>
              <p className="text-[9px] text-slate-400 italic leading-relaxed">
                Ex.: mais pares de sapato pedem mais metros de tecido (aumenta junto). Mais gente
                ajudando faz o trabalho acabar mais rápido (diminui).
              </p>
            </div>

            <div className="flex flex-col gap-1.5" data-guide-anchor="ruleOfThree.simplesPergunta">
              <p className={labelCls}>3. O que você quer descobrir</p>
              <span className="text-sm font-bold">Agora, com</span>
              <div className="flex items-center gap-2">
                <NumberField value={a2} onChange={setA2} isDarkMode={isDarkMode} />
                <span className="text-sm font-bold leading-snug">
                  {unitA || 'dessa 1ª coisa'}, quanto vai dar de {unitB || '2ª coisa'}?
                </span>
              </div>
            </div>

            {simpleResult !== null && (
              <div className="flex flex-col gap-3">
                <div className={`rounded-2xl p-5 text-center ${isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50'}`} data-guide-anchor="ruleOfThree.resultado">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Resposta</p>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                    {formatResult(simpleResult)} {unitB}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportJpg}
                  disabled={exportingJpg}
                  data-guide-anchor="ruleOfThree.exportarJpg"
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                >
                  {exportingJpg ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} Exportar em JPG
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={`p-5 rounded-[2rem] border flex flex-col gap-5 ${cardCls}`}>
            <div className={`p-3 rounded-2xl flex items-start gap-2 ${isDarkMode ? 'bg-indigo-900/10' : 'bg-indigo-50/60'}`}>
              <Sparkles size={14} className="text-indigo-500 mt-0.5 shrink-0" />
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                Use quando <span className="font-black">mais de duas coisas</span> mudam ao mesmo
                tempo — ex.: "tantos operários, trabalhando tantos dias, fazem tantas peças".
                Pra cada coisa que muda, diga o valor na Situação 1 (o que você já sabe) e na
                Situação 2 (o que mudou), e se isso faz o resultado aumentar junto ou diminuir.
              </p>
            </div>

            <div className="flex flex-col gap-3" data-guide-anchor="ruleOfThree.compostaGrandeza">
              {rows.map((row, idx) => (
                <div key={row.id} className={`p-4 rounded-2xl border flex flex-col gap-3 ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/70 border-slate-100'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => updateRow(row.id, { label: e.target.value })}
                      placeholder={`Grandeza ${idx + 1} (ex: operários)`}
                      className={`flex-1 min-w-0 px-3 py-2 rounded-xl border-2 outline-none text-xs font-black uppercase tracking-wide ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
                    />
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(row.id)} className="shrink-0 text-slate-400 hover:text-rose-500 p-1" title="Remover" aria-label={`Remover grandeza ${idx + 1}`}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5" data-guide-anchor="ruleOfThree.compostaDescricao">
                    <span className="text-[8px] font-black uppercase text-slate-400">Situação 1</span>
                    <div className="flex gap-2">
                      <NumberField value={row.val1} onChange={(v) => updateRow(row.id, { val1: v })} isDarkMode={isDarkMode} />
                      <input
                        type="text"
                        value={row.desc1}
                        onChange={(e) => updateRow(row.id, { desc1: e.target.value })}
                        placeholder="o que está acontecendo aqui (opcional)"
                        className={`flex-1 min-w-0 px-3 py-2 rounded-xl border-2 outline-none text-xs font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-100 text-slate-900 placeholder:text-slate-400'}`}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[8px] font-black uppercase text-slate-400">Situação 2</span>
                    <div className="flex gap-2">
                      <NumberField value={row.val2} onChange={(v) => updateRow(row.id, { val2: v })} isDarkMode={isDarkMode} />
                      <input
                        type="text"
                        value={row.desc2}
                        onChange={(e) => updateRow(row.id, { desc2: e.target.value })}
                        placeholder="o que está acontecendo aqui (opcional)"
                        className={`flex-1 min-w-0 px-3 py-2 rounded-xl border-2 outline-none text-xs font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-100 text-slate-900 placeholder:text-slate-400'}`}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[8px] font-black uppercase text-slate-400">Unidade</span>
                    <UnitButton value={row.unit} onChange={(v) => updateRow(row.id, { unit: v })} onOpen={() => openUnitPicker(row.unit, (v) => updateRow(row.id, { unit: v }))} isDarkMode={isDarkMode} placeholder="escolher ou digitar" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateRow(row.id, { direction: 'direct' })}
                      className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        row.direction === 'direct' ? 'bg-emerald-500 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      Resultado aumenta junto
                    </button>
                    <button
                      type="button"
                      onClick={() => updateRow(row.id, { direction: 'inverse' })}
                      className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        row.direction === 'inverse' ? 'bg-amber-500 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      Resultado diminui
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addRow}
                disabled={rows.length >= 5}
                data-guide-anchor="ruleOfThree.compostaAdicionar"
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                <Plus size={14} /> Adicionar Outra Grandeza
              </button>
            </div>

            <div className={`p-4 rounded-2xl border flex flex-col gap-3 ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/30' : 'bg-indigo-50/50 border-indigo-100'}`} data-guide-anchor="ruleOfThree.compostaResultado">
              <input
                type="text"
                value={resultLabel}
                onChange={(e) => setResultLabel(e.target.value)}
                placeholder="O que você quer descobrir (ex: peças produzidas)"
                className={`px-3 py-2 rounded-xl border-2 outline-none text-xs font-black uppercase tracking-wide ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-[8px] font-black uppercase text-slate-400">Situação 1 (você sabe)</span>
                <div className="flex gap-2">
                  <NumberField value={resultVal1} onChange={setResultVal1} isDarkMode={isDarkMode} />
                  <input
                    type="text"
                    value={resultDesc1}
                    onChange={(e) => setResultDesc1(e.target.value)}
                    placeholder="o que está acontecendo aqui (opcional)"
                    className={`flex-1 min-w-0 px-3 py-2 rounded-xl border-2 outline-none text-xs font-bold ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-100 text-slate-900 placeholder:text-slate-400'}`}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[8px] font-black uppercase text-slate-400">Unidade</span>
                <UnitButton value={resultUnit} onChange={setResultUnit} onOpen={() => openUnitPicker(resultUnit, setResultUnit)} isDarkMode={isDarkMode} placeholder="escolher ou digitar" />
              </div>
            </div>

            {compoundResult !== null && (
              <div className="flex flex-col gap-3">
                <div className={`rounded-2xl p-5 text-center ${isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50'}`} data-guide-anchor="ruleOfThree.resultado">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    {resultLabel ? `Resposta — ${resultLabel}` : 'Resposta'}
                  </p>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                    {formatResult(compoundResult)} {resultUnit}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportJpg}
                  disabled={exportingJpg}
                  data-guide-anchor="ruleOfThree.exportarJpg"
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                >
                  {exportingJpg ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} Exportar em JPG
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Popup de escolha de unidade — compartilhado por todo campo de unidade da tela */}
      {unitPicker && (
        <div className="fixed inset-0 z-[310000] flex items-center justify-center bg-black/50 p-4" onClick={() => setUnitPicker(null)}>
          <div
            className={`w-full sm:max-w-sm rounded-[2rem] p-5 flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-black uppercase tracking-tight ${textCls}`}>Escolher Unidade</h3>
              <button type="button" onClick={() => setUnitPicker(null)} className="text-slate-400 hover:text-rose-500" aria-label="Fechar">
                <X size={20} />
              </button>
            </div>

            <input
              type="text"
              autoFocus
              value={unitPickerDraft}
              onChange={(e) => setUnitPickerDraft(e.target.value)}
              placeholder="Digite uma unidade (ex: pares, metros, kg...)"
              className={`px-4 py-3 rounded-xl border-2 outline-none text-sm font-black uppercase tracking-wide ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
            />

            {units.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Unidades já cadastradas</p>
                <div className="flex flex-wrap gap-2">
                  {units.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => confirmUnitPicker(u.name)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => confirmUnitPicker(unitPickerDraft)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white active:scale-95 transition-all"
            >
              <Check size={14} /> Usar Essa Unidade
            </button>
          </div>
        </div>
      )}

      {/* Popup de explicação — "Como Funciona? Ver Exemplo" (topo da tela, sempre disponível) */}
      {helpOpen && (
        <div className="fixed inset-0 z-[310000] flex items-center justify-center bg-black/50 p-4" onClick={() => setHelpOpen(false)}>
          <div
            className={`w-full sm:max-w-md max-h-[85vh] rounded-[2rem] p-5 flex flex-col gap-4 overflow-y-auto force-scrollbar ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-black uppercase tracking-tight ${textCls}`}>Como Funciona a Regra de Três</h3>
              <button type="button" onClick={() => setHelpOpen(false)} className="text-slate-400 hover:text-rose-500 shrink-0" aria-label="Fechar">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Simples</p>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                É pra quando <span className="font-black">só duas coisas</span> mudam juntas.
              </p>
              <div className={`p-3 rounded-2xl text-[11px] font-bold leading-relaxed ${isDarkMode ? 'bg-slate-950/50 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                Se <span className="font-black">10 pares</span> de sapato gastam <span className="font-black">15 metros</span> de tecido,
                quantos metros gastam <span className="font-black">25 pares</span>?
                <br />Só duas coisas mudam (pares e metros) — dá pra resolver com uma continha só.
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Composta</p>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                É pra quando <span className="font-black">três ou mais coisas</span> mudam ao mesmo tempo.
              </p>
              <div className={`p-3 rounded-2xl text-[11px] font-bold leading-relaxed ${isDarkMode ? 'bg-slate-950/50 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                <span className="font-black">3 pespontadeiras</span>, trabalhando <span className="font-black">8 horas</span> por dia,
                produzem <span className="font-black">240 pares</span> por dia. Com <span className="font-black">5 pespontadeiras</span> trabalhando <span className="font-black">6 horas</span> por dia, quantos pares?
              </div>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                Pra cada coisa que muda ("grandeza"), pergunte: <span className="font-black">se eu só aumentar essa coisa, o resultado aumenta ou diminui?</span>
              </p>
              <ul className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed list-disc pl-4 flex flex-col gap-1">
                <li>Pespontadeiras: mais gente = mais pares → <span className="text-emerald-600 dark:text-emerald-400 font-black">aumenta junto</span></li>
                <li>Horas por dia: mais horas = mais pares → <span className="text-emerald-600 dark:text-emerald-400 font-black">aumenta junto</span></li>
              </ul>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed italic">
                Exemplo de "diminui" (inversa): quanto mais gente ajudando um serviço, menos
                tempo ele leva — aumenta uma, a outra cai.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white active:scale-95 transition-all"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

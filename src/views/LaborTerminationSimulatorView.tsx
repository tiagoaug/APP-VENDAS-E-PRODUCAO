import { useMemo, useState } from 'react';
import { Scissors, User, Calendar, DollarSign, Info, Copy, Check, Settings, FileDown, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Collaborator } from '../types';
import { calculateRescisao, calculateAcertoSimplificado, RescisaoTipo, RESCISAO_TIPO_LABELS, LaborSimParams } from '../utils/laborTermination';
import { exportLaborSim } from '../utils/laborSimExport';
import { toast } from '../utils/toast';

// Simulador de Acerto Trabalhista (RH) — duas calculadoras:
// 1) "Rescisão Completa": estimativa cheia de rescisão CLT (aviso prévio, INSS/IRRF, tipo de
//    rescisão) — ver calculateRescisao em utils/laborTermination.ts.
// 2) "Acerto Simplificado": fechamento leve de período (sem impostos, sem tipo de rescisão),
//    pra colaborador que recebe quinzenal como adiantamento — cada verba (férias, 1/3 férias,
//    13º, FGTS, 1/3 FGTS) é um toggle independente, e o adiantamento já recebido é descontado
//    do total apurado. Ver calculateAcertoSimplificado no mesmo arquivo de utils.
// Em ambos os modos, os dados de origem (colaborador cadastrado x valores manuais) são
// compartilhados — só a data de rescisão/fechamento e o restante dos campos mudam de acordo
// com o modo escolhido.
interface LaborTerminationSimulatorViewProps {
  isDarkMode: boolean;
  collaborators: Collaborator[];
  laborSimParams: LaborSimParams;
  onOpenParams: () => void;
}

const inputClass = (isDarkMode: boolean) =>
  `w-full px-4 py-3 rounded-2xl border-2 text-sm font-bold outline-none focus:border-indigo-500 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`;

const labelClass = 'text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-1';

export default function LaborTerminationSimulatorView({ isDarkMode, collaborators, laborSimParams, onOpenParams }: LaborTerminationSimulatorViewProps) {
  const [calcMode, setCalcMode] = useState<'completo' | 'simplificado'>('completo');

  const [mode, setMode] = useState<'collaborator' | 'manual'>(collaborators.length > 0 ? 'collaborator' : 'manual');
  const [collaboratorId, setCollaboratorId] = useState<string>('');
  const [manualSalary, setManualSalary] = useState('');
  const [manualAdmission, setManualAdmission] = useState('');
  const [terminationDate, setTerminationDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Rescisão Completa
  const [tipo, setTipo] = useState<RescisaoTipo>('SEM_JUSTA_CAUSA');
  const [avisoTrabalhado, setAvisoTrabalhado] = useState(false);
  const [feriasVencidasPeriodos, setFeriasVencidasPeriodos] = useState(0);
  const [dependentesIRRF, setDependentesIRRF] = useState(0);
  const [fgtsSaldoInformado, setFgtsSaldoInformado] = useState('');
  const [incluirFerias, setIncluirFerias] = useState(true);
  const [incluirDecimoTerceiro, setIncluirDecimoTerceiro] = useState(true);
  const [incluirFgts, setIncluirFgts] = useState(true);

  // Acerto Simplificado
  const [receivingDate, setReceivingDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [jaRecebeuProporcional, setJaRecebeuProporcional] = useState(false);
  const [recebeQuinzenal, setRecebeQuinzenal] = useState(false);
  const [adiantamentoQuinzenal, setAdiantamentoQuinzenal] = useState('');
  const [simpFgtsSaldoInformado, setSimpFgtsSaldoInformado] = useState('');
  const [simpFeriasVencidasPeriodos, setSimpFeriasVencidasPeriodos] = useState(0);
  const [simpIncluirFerias, setSimpIncluirFerias] = useState(true);
  const [simpIncluirTercoFerias, setSimpIncluirTercoFerias] = useState(true);
  const [simpIncluirDecimoTerceiro, setSimpIncluirDecimoTerceiro] = useState(true);
  const [simpIncluirFgts, setSimpIncluirFgts] = useState(true);
  const [simpIncluirTercoFgts, setSimpIncluirTercoFgts] = useState(false);

  const [copied, setCopied] = useState(false);

  const sellers = useMemo(() => collaborators.filter(c => c.admissionDate && c.salary), [collaborators]);
  const selectedCollaborator = collaborators.find(c => c.id === collaboratorId);

  const salary = mode === 'collaborator' ? (selectedCollaborator?.salary || 0) : (parseFloat(manualSalary) || 0);
  const admissionDateStr = mode === 'collaborator'
    ? (selectedCollaborator?.admissionDate ? format(selectedCollaborator.admissionDate, 'yyyy-MM-dd') : '')
    : manualAdmission;

  const resultadoCompleto = useMemo(() => {
    if (calcMode !== 'completo' || !salary || !admissionDateStr || !terminationDate) return null;
    const admissionTs = new Date(admissionDateStr + 'T12:00:00').getTime();
    const terminationTs = new Date(terminationDate + 'T12:00:00').getTime();
    if (terminationTs <= admissionTs) return null;
    return calculateRescisao({
      salary,
      admissionDate: admissionTs,
      terminationDate: terminationTs,
      tipo,
      avisoTrabalhado,
      feriasVencidasPeriodos,
      dependentesIRRF,
      fgtsSaldoInformado: parseFloat(fgtsSaldoInformado) || undefined,
      incluirFerias,
      incluirDecimoTerceiro,
      incluirFgts,
    }, laborSimParams);
  }, [calcMode, salary, admissionDateStr, terminationDate, tipo, avisoTrabalhado, feriasVencidasPeriodos, dependentesIRRF, fgtsSaldoInformado, incluirFerias, incluirDecimoTerceiro, incluirFgts, laborSimParams]);

  const resultadoSimplificado = useMemo(() => {
    if (calcMode !== 'simplificado' || !salary || !admissionDateStr || !terminationDate) return null;
    const admissionTs = new Date(admissionDateStr + 'T12:00:00').getTime();
    const closingTs = new Date(terminationDate + 'T12:00:00').getTime();
    if (closingTs <= admissionTs) return null;
    return calculateAcertoSimplificado({
      salary,
      admissionDate: admissionTs,
      closingDate: closingTs,
      jaRecebeuProporcional,
      adiantamentoQuinzenal: recebeQuinzenal ? (parseFloat(adiantamentoQuinzenal) || 0) : 0,
      feriasVencidasPeriodos: simpFeriasVencidasPeriodos,
      incluirFerias: simpIncluirFerias,
      incluirTercoFerias: simpIncluirTercoFerias,
      incluirDecimoTerceiro: simpIncluirDecimoTerceiro,
      incluirFgts: simpIncluirFgts,
      incluirTercoFgts: simpIncluirTercoFgts,
      fgtsSaldoInformado: parseFloat(simpFgtsSaldoInformado) || undefined,
    }, laborSimParams);
  }, [calcMode, salary, admissionDateStr, terminationDate, jaRecebeuProporcional, recebeQuinzenal, adiantamentoQuinzenal, simpFeriasVencidasPeriodos, simpIncluirFerias, simpIncluirTercoFerias, simpIncluirDecimoTerceiro, simpIncluirFgts, simpIncluirTercoFgts, simpFgtsSaldoInformado, laborSimParams]);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleCopy = () => {
    const nome = mode === 'collaborator' ? (selectedCollaborator?.name || 'Colaborador') : 'Simulação';
    let lines: string[] = [];
    if (calcMode === 'completo' && resultadoCompleto) {
      lines = [
        `Simulação de Rescisão — ${nome}`,
        `Tipo: ${RESCISAO_TIPO_LABELS[tipo]}`,
        `Tempo de serviço: ${resultadoCompleto.tempoServicoMeses} meses`,
        '',
        ...resultadoCompleto.itens.map(i => `${i.label}: ${i.tipo === 'desconto' ? '-' : ''}${fmt(i.value)}`),
        '',
        `Total Bruto: ${fmt(resultadoCompleto.totalProventos)}`,
        `Total Descontos: ${fmt(resultadoCompleto.totalDescontos)}`,
        `Total Líquido: ${fmt(resultadoCompleto.totalLiquido)}`,
      ];
    } else if (calcMode === 'simplificado' && resultadoSimplificado) {
      lines = [
        `Acerto Simplificado — ${nome}`,
        `Data de Recebimento: ${receivingDate ? format(new Date(receivingDate + 'T12:00:00'), 'dd/MM/yyyy') : '-'}`,
        '',
        ...resultadoSimplificado.itens.map(i => `${i.label}: ${i.tipo === 'desconto' ? '-' : ''}${fmt(i.value)}`),
        '',
        `Total Bruto: ${fmt(resultadoSimplificado.totalBruto)}`,
        `Total Líquido: ${fmt(resultadoSimplificado.totalLiquido)}`,
      ];
    } else {
      return;
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    toast.success('Resumo copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (formatType: 'pdf' | 'jpg') => {
    const nome = mode === 'collaborator' ? (selectedCollaborator?.name || 'Colaborador') : 'Simulação';
    if (calcMode === 'completo' && resultadoCompleto) {
      exportLaborSim({
        title: 'Simulação de Rescisão',
        subtitle: `${nome} · ${RESCISAO_TIPO_LABELS[tipo]}`,
        itens: resultadoCompleto.itens,
        totalBrutoLabel: 'Total Bruto',
        totalBruto: resultadoCompleto.totalProventos,
        totalDescontosLabel: 'Total de Descontos',
        totalDescontos: resultadoCompleto.totalDescontos,
        totalLiquidoLabel: 'Total Líquido',
        totalLiquido: resultadoCompleto.totalLiquido,
      }, formatType);
    } else if (calcMode === 'simplificado' && resultadoSimplificado) {
      const periodo = receivingDate ? format(new Date(receivingDate + 'T12:00:00'), 'dd/MM/yyyy') : '';
      exportLaborSim({
        title: 'Acerto Simplificado',
        subtitle: periodo ? `${nome} · Recebimento em ${periodo}` : nome,
        itens: resultadoSimplificado.itens,
        totalBrutoLabel: 'Total Bruto',
        totalBruto: resultadoSimplificado.totalBruto,
        totalLiquidoLabel: 'Total Líquido a Pagar',
        totalLiquido: resultadoSimplificado.totalLiquido,
      }, formatType);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-10 max-w-3xl mx-auto">
      <header className="flex items-center gap-3">
        <div className="p-2 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400">
          <Scissors size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Simulador de Rescisão</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Estimativa de acerto trabalhista CLT</p>
        </div>
      </header>

      <button
        type="button"
        onClick={onOpenParams}
        data-guide-anchor="laborSim.abrirParametros"
        className={`self-end flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
      >
        <Settings size={14} /> Configurações
      </button>

      <div className={`flex gap-2 p-2 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <button
          type="button"
          onClick={() => setCalcMode('completo')}
          data-guide-anchor="laborSim.calcModeCompleto"
          className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors ${calcMode === 'completo' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
        >
          Rescisão Completa
        </button>
        <button
          type="button"
          onClick={() => setCalcMode('simplificado')}
          data-guide-anchor="laborSim.calcModeSimplificado"
          className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors ${calcMode === 'simplificado' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
        >
          Acerto Simplificado
        </button>
      </div>

      <div className={`flex gap-2 p-2 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <button
          type="button"
          onClick={() => setMode('collaborator')}
          data-guide-anchor="laborSim.origemColaborador"
          className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors ${mode === 'collaborator' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
        >
          Colaborador Cadastrado
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          data-guide-anchor="laborSim.origemManual"
          className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors ${mode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
        >
          Valores Manuais
        </button>
      </div>

      <div className={`p-6 rounded-[2rem] border shadow-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        {mode === 'collaborator' ? (
          <div className="flex flex-col gap-2">
            <label className={labelClass}><User size={11} /> Colaborador</label>
            <select value={collaboratorId} onChange={e => setCollaboratorId(e.target.value)} data-guide-anchor="laborSim.colaboradorSelect" className={inputClass(isDarkMode)}>
              <option value="">Selecione...</option>
              {sellers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {sellers.length === 0 && (
              <p className="text-[10px] font-bold text-amber-500 px-1">Nenhum colaborador tem Salário/Data de Admissão cadastrados ainda (RH → Colaboradores → aba Financeira).</p>
            )}
            {selectedCollaborator && (
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase text-slate-400">Salário Base</span>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">{fmt(salary)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase text-slate-400">Admissão</span>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">{admissionDateStr ? format(new Date(admissionDateStr + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className={labelClass}><DollarSign size={11} /> Salário Bruto (R$)</label>
              <input type="number" inputMode="decimal" min={0} placeholder="Ex: 3000" value={manualSalary} onChange={e => setManualSalary(e.target.value)} data-guide-anchor="laborSim.manualSalario" className={inputClass(isDarkMode)} />
            </div>
            <div className="flex flex-col gap-2">
              <label className={labelClass}><Calendar size={11} /> Data de Admissão</label>
              <input type="date" value={manualAdmission} onChange={e => setManualAdmission(e.target.value)} data-guide-anchor="laborSim.manualAdmissao" className={inputClass(isDarkMode)} />
            </div>
          </div>
        )}

        {calcMode === 'completo' ? (
          <>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className={labelClass}><Calendar size={11} /> Data de Rescisão</label>
                <input type="date" value={terminationDate} onChange={e => setTerminationDate(e.target.value)} data-guide-anchor="laborSim.dataRescisaoCompleto" className={inputClass(isDarkMode)} />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Tipo de Rescisão</label>
                <select value={tipo} onChange={e => setTipo(e.target.value as RescisaoTipo)} data-guide-anchor="laborSim.tipoRescisao" className={inputClass(isDarkMode)}>
                  {(Object.keys(RESCISAO_TIPO_LABELS) as RescisaoTipo[]).map(t => (
                    <option key={t} value={t}>{RESCISAO_TIPO_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Aviso Prévio Trabalhado?</label>
                <select value={avisoTrabalhado ? '1' : '0'} onChange={e => setAvisoTrabalhado(e.target.value === '1')} data-guide-anchor="laborSim.avisoPrevio" className={inputClass(isDarkMode)}>
                  <option value="0">Não (indenizado pelo empregador)</option>
                  <option value="1">Sim (trabalhado pelo colaborador)</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Férias Vencidas (períodos não gozados)</label>
                <select value={feriasVencidasPeriodos} onChange={e => setFeriasVencidasPeriodos(Number(e.target.value))} data-guide-anchor="laborSim.feriasVencidas" className={inputClass(isDarkMode)}>
                  <option value={0}>Nenhum período</option>
                  <option value={1}>1 período</option>
                  <option value={2}>2 períodos</option>
                  <option value={3}>3 períodos</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Dependentes para IRRF (-R$ 189,59/dep.)</label>
                <input type="number" inputMode="numeric" min={0} value={dependentesIRRF} onChange={e => setDependentesIRRF(Math.max(0, Number(e.target.value)))} data-guide-anchor="laborSim.dependentesIrrf" className={inputClass(isDarkMode)} />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>Saldo FGTS na Caixa (R$) <span className="normal-case font-semibold text-slate-400">— opcional</span></label>
                <input type="number" inputMode="decimal" min={0} placeholder="Deixe em branco p/ estimar" value={fgtsSaldoInformado} onChange={e => setFgtsSaldoInformado(e.target.value)} data-guide-anchor="laborSim.fgtsSaldoInformado" className={inputClass(isDarkMode)} />
              </div>
            </div>

            <div className={`flex items-start gap-2 p-3 rounded-2xl text-[11px] font-semibold ${isDarkMode ? 'bg-slate-800/60 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
              <Info size={14} className="shrink-0 mt-0.5" />
              Sem saldo real informado, usamos estimativa (8% × salário × meses) — pode subestimar o FGTS/multa se houve saques ou rendimentos anteriores.
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { key: 'incluirFerias', anchor: 'laborSim.chipFerias', label: 'Férias + 1/3', value: incluirFerias, set: setIncluirFerias },
                { key: 'incluirDecimoTerceiro', anchor: 'laborSim.chip13', label: '13º Salário', value: incluirDecimoTerceiro, set: setIncluirDecimoTerceiro },
                { key: 'incluirFgts', anchor: 'laborSim.chipFgts', label: 'FGTS + Multa', value: incluirFgts, set: setIncluirFgts },
              ].map(chip => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => chip.set(!chip.value)}
                  data-guide-anchor={chip.anchor}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${chip.value ? 'bg-indigo-600 border-indigo-600 text-white' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-400')}`}
                >
                  {chip.value ? '✓ ' : ''}{chip.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className={labelClass}><Calendar size={11} /> Data de Rescisão/Fechamento</label>
                <input type="date" value={terminationDate} onChange={e => setTerminationDate(e.target.value)} data-guide-anchor="laborSim.dataFechamentoSimplificado" className={inputClass(isDarkMode)} />
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}><Calendar size={11} /> Data de Recebimento</label>
                <input type="date" value={receivingDate} onChange={e => setReceivingDate(e.target.value)} data-guide-anchor="laborSim.dataRecebimento" className={inputClass(isDarkMode)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setJaRecebeuProporcional(!jaRecebeuProporcional)}
                data-guide-anchor="laborSim.jaRecebeuProporcional"
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${jaRecebeuProporcional ? 'bg-indigo-600 border-indigo-600 text-white' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-400')}`}
              >
                {jaRecebeuProporcional ? '✓ ' : ''}Já recebeu o proporcional de dias trabalhados
              </button>
              <button
                type="button"
                onClick={() => setRecebeQuinzenal(!recebeQuinzenal)}
                data-guide-anchor="laborSim.recebeQuinzenal"
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${recebeQuinzenal ? 'bg-indigo-600 border-indigo-600 text-white' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-400')}`}
              >
                {recebeQuinzenal ? '✓ ' : ''}Recebe quinzenal como adiantamento
              </button>
            </div>

            {recebeQuinzenal && (
              <div className="flex flex-col gap-2">
                <label className={labelClass}><DollarSign size={11} /> Valor do Adiantamento Quinzenal já Recebido (R$)</label>
                <input type="number" inputMode="decimal" min={0} placeholder="Ex: 750" value={adiantamentoQuinzenal} onChange={e => setAdiantamentoQuinzenal(e.target.value)} data-guide-anchor="laborSim.adiantamentoValor" className={inputClass(isDarkMode)} />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className={labelClass}>Férias Vencidas (períodos completos ainda não gozados)</label>
              <select value={simpFeriasVencidasPeriodos} onChange={e => setSimpFeriasVencidasPeriodos(Number(e.target.value))} data-guide-anchor="laborSim.simpFeriasVencidas" className={inputClass(isDarkMode)}>
                <option value={0}>Nenhum período</option>
                <option value={1}>1 período</option>
                <option value={2}>2 períodos</option>
                <option value={3}>3 períodos</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className={labelClass}>Saldo FGTS na Caixa (R$) <span className="normal-case font-semibold text-slate-400">— opcional</span></label>
              <input type="number" inputMode="decimal" min={0} placeholder="Deixe em branco p/ estimar" value={simpFgtsSaldoInformado} onChange={e => setSimpFgtsSaldoInformado(e.target.value)} data-guide-anchor="laborSim.fgtsSaldoInformadoSimp" className={inputClass(isDarkMode)} />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { key: 'simpIncluirFerias', anchor: 'laborSim.simpChipFerias', label: 'Férias', value: simpIncluirFerias, set: setSimpIncluirFerias },
                { key: 'simpIncluirTercoFerias', anchor: 'laborSim.simpChipTercoFerias', label: '1/3 de Férias', value: simpIncluirTercoFerias, set: setSimpIncluirTercoFerias },
                { key: 'simpIncluirDecimoTerceiro', anchor: 'laborSim.simpChip13', label: '13º Salário', value: simpIncluirDecimoTerceiro, set: setSimpIncluirDecimoTerceiro },
                { key: 'simpIncluirFgts', anchor: 'laborSim.simpChipFgts', label: 'Fundo de Garantia', value: simpIncluirFgts, set: setSimpIncluirFgts },
                { key: 'simpIncluirTercoFgts', anchor: 'laborSim.simpChipTercoFgts', label: '1/3 do FGTS', value: simpIncluirTercoFgts, set: setSimpIncluirTercoFgts },
              ].map(chip => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => chip.set(!chip.value)}
                  data-guide-anchor={chip.anchor}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${chip.value ? 'bg-indigo-600 border-indigo-600 text-white' : (isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-400')}`}
                >
                  {chip.value ? '✓ ' : ''}{chip.label}
                </button>
              ))}
            </div>

            <div className={`flex items-start gap-2 p-3 rounded-2xl text-[11px] font-semibold ${isDarkMode ? 'bg-slate-800/60 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
              <Info size={14} className="shrink-0 mt-0.5" />
              "1/3 do FGTS" não é uma verba prevista em lei (o 1/3 constitucional é só sobre férias) — deixe marcado apenas se o seu acordo interno prevê esse valor extra.
            </div>
          </>
        )}
      </div>

      {calcMode === 'completo' ? (
        resultadoCompleto ? (
          <div className={`p-6 rounded-[2rem] border shadow-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Resultado da Simulação</h3>
              <button type="button" onClick={handleCopy} data-guide-anchor="laborSim.copiarResultado" className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {resultadoCompleto.itens.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{item.label}</span>
                  <span className={`text-sm font-black ${item.tipo === 'desconto' ? 'text-rose-500' : item.tipo === 'info' ? 'text-slate-400' : 'text-emerald-500'}`}>
                    {item.tipo === 'desconto' ? '- ' : ''}{fmt(item.value)}
                  </span>
                </div>
              ))}
            </div>

            <div className={`grid grid-cols-3 gap-3 pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase text-slate-400">Bruto</span>
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{fmt(resultadoCompleto.totalProventos)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase text-slate-400">Descontos</span>
                <span className="text-sm font-black text-rose-500">{fmt(resultadoCompleto.totalDescontos)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase text-slate-400">Líquido</span>
                <span className="text-lg font-black text-emerald-500">{fmt(resultadoCompleto.totalLiquido)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                data-guide-anchor="laborSim.exportarPdf"
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <FileDown size={13} /> Exportar PDF
              </button>
              <button
                type="button"
                onClick={() => handleExport('jpg')}
                data-guide-anchor="laborSim.exportarJpg"
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <ImageIcon size={13} /> Exportar JPG
              </button>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-2xl text-[10px] font-bold leading-relaxed bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              Somente para consulta — esta estimativa não é o TRCT oficial nem tem valor fiscal. Confirme sempre os dados e valores com sua contabilidade/RH antes de qualquer pagamento.
            </div>
          </div>
        ) : (
          <div className={`p-6 rounded-[2rem] border shadow-sm text-center text-xs font-bold text-slate-400 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            Preencha salário, admissão e data de rescisão para ver o resultado.
          </div>
        )
      ) : (
        resultadoSimplificado ? (
          <div className={`p-6 rounded-[2rem] border shadow-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Resultado do Acerto</h3>
              <button type="button" onClick={handleCopy} data-guide-anchor="laborSim.copiarResultado" className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            {resultadoSimplificado.itens.length === 0 ? (
              <p className="text-center text-xs font-bold text-slate-400 py-4">Nenhuma verba selecionada.</p>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {resultadoSimplificado.itens.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{item.label}</span>
                    <span className={`text-sm font-black ${item.tipo === 'desconto' ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {item.tipo === 'desconto' ? '- ' : ''}{fmt(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className={`grid grid-cols-2 gap-3 pt-3 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase text-slate-400">Bruto</span>
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{fmt(resultadoSimplificado.totalBruto)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase text-slate-400">Líquido a Pagar</span>
                <span className="text-lg font-black text-emerald-500">{fmt(resultadoSimplificado.totalLiquido)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                data-guide-anchor="laborSim.exportarPdf"
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <FileDown size={13} /> Exportar PDF
              </button>
              <button
                type="button"
                onClick={() => handleExport('jpg')}
                data-guide-anchor="laborSim.exportarJpg"
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <ImageIcon size={13} /> Exportar JPG
              </button>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-2xl text-[10px] font-bold leading-relaxed bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              Somente para consulta — este fechamento não é o TRCT oficial nem tem valor fiscal. Confirme sempre os dados e valores com sua contabilidade/RH antes de qualquer pagamento.
            </div>
          </div>
        ) : (
          <div className={`p-6 rounded-[2rem] border shadow-sm text-center text-xs font-bold text-slate-400 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            Preencha salário, admissão e data de rescisão/fechamento para ver o resultado.
          </div>
        )
      )}
    </div>
  );
}

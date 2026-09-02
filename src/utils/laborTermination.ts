import { differenceInCalendarMonths, differenceInCalendarDays, addMonths, addDays, getDate } from 'date-fns';

// Simulador de rescisão trabalhista CLT — valores são ESTIMATIVAS (mesmo aviso que calculadoras
// públicas equivalentes dão), não substituem o cálculo oficial do RH/contador nem o homologado
// em sindicato quando exigido por lei. Ver LaborTerminationSimulatorView.tsx pro formulário e
// LaborSimParamsView.tsx pra tela de parâmetros (tabelas de INSS/IRRF, %FGTS, etc. — todos
// editáveis, pra quando a lei ou os valores base mudarem sem precisar mexer no código).

export type InssFaixa = { limite: number; aliquota: number };
export type IrrfFaixa = { limite: number; aliquota: number; deducao: number };

// Todo valor "base" ou "norma" usado nos cálculos abaixo vive aqui — editável em
// RH → Simulador de Rescisão → Parâmetros (ver LaborSimParamsView.tsx), persistido em
// localStorage + Firestore (doc 'main_labor_sim_params', coleção app_labor_sim_params).
export type LaborSimParams = {
  inssFaixas: InssFaixa[];
  // A última faixa cobre qualquer base acima do limite dela (não tem teto).
  irrfFaixas: IrrfFaixa[];
  dependenteIrrf: number;
  fgtsPercentMensal: number;
  multaFgtsSemJustaCausa: number;
  multaFgtsAcordoMutuo: number;
  avisoPrevioBaseDias: number;
  avisoPrevioDiasPorAno: number;
  avisoPrevioMaxDias: number;
};

export const DEFAULT_LABOR_SIM_PARAMS: LaborSimParams = {
  inssFaixas: [
    { limite: 1412.00, aliquota: 0.075 },
    { limite: 2666.68, aliquota: 0.09 },
    { limite: 4000.03, aliquota: 0.12 },
    { limite: 7786.02, aliquota: 0.14 },
  ],
  irrfFaixas: [
    { limite: 2259.20, aliquota: 0, deducao: 0 },
    { limite: 2826.65, aliquota: 0.075, deducao: 169.44 },
    { limite: 3751.05, aliquota: 0.15, deducao: 381.44 },
    { limite: 4664.68, aliquota: 0.225, deducao: 662.77 },
    // "Sem teto" — um número bem alto em vez de Infinity, que JSON.stringify vira null e
    // quebraria a persistência em localStorage/Firestore.
    { limite: 999999999, aliquota: 0.275, deducao: 896.00 },
  ],
  dependenteIrrf: 189.59,
  fgtsPercentMensal: 0.08,
  multaFgtsSemJustaCausa: 0.40,
  multaFgtsAcordoMutuo: 0.20,
  avisoPrevioBaseDias: 30,
  avisoPrevioDiasPorAno: 3,
  avisoPrevioMaxDias: 90,
};

export type RescisaoTipo =
  | 'SEM_JUSTA_CAUSA'
  | 'PEDIDO_DEMISSAO'
  | 'COM_JUSTA_CAUSA'
  | 'ACORDO_MUTUO'
  | 'TERMINO_EXPERIENCIA';

export const RESCISAO_TIPO_LABELS: Record<RescisaoTipo, string> = {
  SEM_JUSTA_CAUSA: 'Sem justa causa (demissão pelo empregador)',
  PEDIDO_DEMISSAO: 'Pedido de demissão (pelo colaborador)',
  COM_JUSTA_CAUSA: 'Com justa causa',
  ACORDO_MUTUO: 'Acordo mútuo (distrato, Art. 484-A)',
  TERMINO_EXPERIENCIA: 'Término de contrato de experiência',
};

export type RescisaoInput = {
  salary: number;
  admissionDate: number;
  terminationDate: number;
  tipo: RescisaoTipo;
  // Aviso prévio trabalhado pelo colaborador (não gera indenização extra) vs indenizado
  // (empregador paga sem exigir trabalho, e o período conta pra projeção de 13º/férias — Súmula 371/TST).
  avisoTrabalhado: boolean;
  // Períodos completos de férias vencidas (não gozadas) além do período aquisitivo em curso.
  feriasVencidasPeriodos: number;
  dependentesIRRF: number;
  // Saldo FGTS informado pelo usuário (extrato da Caixa) — se ausente, usamos estimativa 8% × salário × meses.
  fgtsSaldoInformado?: number;
  // Toggles do que entra na simulação (todos default true; usuário pode desmarcar pra simular cenários parciais).
  incluirFerias: boolean;
  incluirDecimoTerceiro: boolean;
  incluirFgts: boolean;
};

export type RescisaoItem = { label: string; value: number; tipo: 'provento' | 'desconto' | 'info' };

export type RescisaoResultado = {
  tempoServicoMeses: number;
  saldoSalario: number;
  avisoPrevioDias: number;
  avisoPrevioIndenizado: number;
  feriasVencidas: number;
  feriasProporcionais: number;
  decimoTerceiroProporcional: number;
  fgtsSaldoEstimado: number;
  multaFgts: number;
  inssSaldoSalario: number;
  inss13: number;
  irrfSaldoSalario: number;
  irrf13: number;
  totalProventos: number;
  totalDescontos: number;
  totalLiquido: number;
  itens: RescisaoItem[];
};

function countFullMonths(start: Date, end: Date): number {
  if (end <= start) return 0;
  let months = differenceInCalendarMonths(end, start);
  const remainderStart = addMonths(start, months);
  const remainderDays = differenceInCalendarDays(end, remainderStart);
  if (remainderDays >= 15) months += 1;
  return Math.min(Math.max(months, 0), 12);
}

// Tabela INSS progressiva por faixa.
function calcInss(base: number, faixas: InssFaixa[]): number {
  if (base <= 0) return 0;
  let inss = 0;
  let anterior = 0;
  for (const faixa of faixas) {
    if (base > anterior) {
      const baseFaixa = Math.min(base, faixa.limite) - anterior;
      inss += baseFaixa * faixa.aliquota;
      anterior = faixa.limite;
    }
  }
  return inss;
}

// Tabela IRRF mensal, com dedução por dependente. A última faixa cobre valores acima do
// limite dela (sem teto).
function calcIrrf(baseAntesDependentes: number, dependentes: number, faixas: IrrfFaixa[], dependenteValor: number): number {
  const base = baseAntesDependentes - dependentes * dependenteValor;
  for (const faixa of faixas) {
    if (base <= faixa.limite) {
      return Math.max(0, base * faixa.aliquota - faixa.deducao);
    }
  }
  const ultima = faixas[faixas.length - 1];
  return ultima ? Math.max(0, base * ultima.aliquota - ultima.deducao) : 0;
}

export function calculateRescisao(input: RescisaoInput, params: LaborSimParams = DEFAULT_LABOR_SIM_PARAMS): RescisaoResultado {
  const {
    salary, tipo, avisoTrabalhado, feriasVencidasPeriodos, dependentesIRRF,
    fgtsSaldoInformado, incluirFerias, incluirDecimoTerceiro, incluirFgts,
  } = input;

  const admissionDate = new Date(input.admissionDate);
  const terminationDate = new Date(input.terminationDate);
  // Meses completos de serviço (sem arredondar pra cima) — usado pro aviso prévio adicional (3 dias/ano) e estimativa de FGTS.
  const mesesCompletosServico = Math.max(0, differenceInCalendarMonths(terminationDate, admissionDate));
  const anosCompletos = Math.floor(mesesCompletosServico / 12);

  const temAvisoPrevio = tipo === 'SEM_JUSTA_CAUSA' || tipo === 'ACORDO_MUTUO';
  const avisoPrevioDiasBase = Math.min(params.avisoPrevioBaseDias + params.avisoPrevioDiasPorAno * anosCompletos, params.avisoPrevioMaxDias);
  const avisoPrevioDias = temAvisoPrevio ? (tipo === 'ACORDO_MUTUO' ? Math.round(avisoPrevioDiasBase / 2) : avisoPrevioDiasBase) : 0;
  const avisoPrevioIndenizado = temAvisoPrevio && !avisoTrabalhado ? (salary / 30) * avisoPrevioDias : 0;

  // Data efetiva pra contagem de 13º/férias proporcionais — projeta o aviso indenizado (Súmula 371/TST).
  const effectiveEnd = (temAvisoPrevio && !avisoTrabalhado) ? addDays(terminationDate, avisoPrevioDias) : terminationDate;

  const saldoSalario = (salary / 30) * getDate(terminationDate);

  const temDireitoFeriasProp = tipo !== 'COM_JUSTA_CAUSA';
  const temDireito13 = tipo !== 'COM_JUSTA_CAUSA';

  // Férias proporcionais: meses desde o último aniversário do período aquisitivo até a data efetiva.
  let feriasProporcionais = 0;
  if (incluirFerias && temDireitoFeriasProp) {
    const mesesDesdeAdmissao = Math.max(0, differenceInCalendarMonths(effectiveEnd, admissionDate));
    const aniversariosCompletos = Math.floor(mesesDesdeAdmissao / 12);
    const inicioPeriodoAquisitivo = addMonths(admissionDate, aniversariosCompletos * 12);
    const mesesProporcionais = countFullMonths(inicioPeriodoAquisitivo, effectiveEnd);
    feriasProporcionais = (salary / 12) * mesesProporcionais * (4 / 3);
  }

  const feriasVencidas = incluirFerias ? feriasVencidasPeriodos * (salary + salary / 3) : 0;

  // 13º proporcional: meses trabalhados dentro do ano civil da data efetiva.
  let decimoTerceiroProporcional = 0;
  if (incluirDecimoTerceiro && temDireito13) {
    const anoBase = effectiveEnd.getFullYear();
    const inicioAno = new Date(anoBase, 0, 1);
    const inicio13 = admissionDate > inicioAno ? admissionDate : inicioAno;
    const meses13 = countFullMonths(inicio13, effectiveEnd);
    decimoTerceiroProporcional = (salary / 12) * meses13;
  }

  const fgtsSaldoEstimado = incluirFgts ? (fgtsSaldoInformado && fgtsSaldoInformado > 0 ? fgtsSaldoInformado : params.fgtsPercentMensal * salary * mesesCompletosServico) : 0;
  const multaFgtsPercent = tipo === 'SEM_JUSTA_CAUSA' ? params.multaFgtsSemJustaCausa : tipo === 'ACORDO_MUTUO' ? params.multaFgtsAcordoMutuo : 0;
  const multaFgts = incluirFgts ? fgtsSaldoEstimado * multaFgtsPercent : 0;

  const inssSaldoSalario = calcInss(saldoSalario, params.inssFaixas);
  const irrfSaldoSalario = calcIrrf(saldoSalario - inssSaldoSalario, dependentesIRRF, params.irrfFaixas, params.dependenteIrrf);
  const inss13 = decimoTerceiroProporcional > 0 ? calcInss(decimoTerceiroProporcional, params.inssFaixas) : 0;
  const irrf13 = decimoTerceiroProporcional > 0 ? calcIrrf(decimoTerceiroProporcional - inss13, dependentesIRRF, params.irrfFaixas, params.dependenteIrrf) : 0;

  const itens: RescisaoItem[] = [
    { label: 'Saldo de Salário', value: saldoSalario, tipo: 'provento' },
  ];
  if (avisoPrevioIndenizado > 0) itens.push({ label: `Aviso Prévio Indenizado (${avisoPrevioDias} dias)`, value: avisoPrevioIndenizado, tipo: 'provento' });
  if (feriasVencidas > 0) itens.push({ label: `Férias Vencidas + 1/3 (${feriasVencidasPeriodos}x)`, value: feriasVencidas, tipo: 'provento' });
  if (feriasProporcionais > 0) itens.push({ label: 'Férias Proporcionais + 1/3', value: feriasProporcionais, tipo: 'provento' });
  if (decimoTerceiroProporcional > 0) itens.push({ label: '13º Salário Proporcional', value: decimoTerceiroProporcional, tipo: 'provento' });
  if (multaFgts > 0) itens.push({ label: `Multa FGTS (${Math.round(multaFgtsPercent * 100)}%)`, value: multaFgts, tipo: 'provento' });
  if (inssSaldoSalario > 0) itens.push({ label: 'INSS sobre Saldo de Salário', value: inssSaldoSalario, tipo: 'desconto' });
  if (irrfSaldoSalario > 0) itens.push({ label: 'IRRF sobre Saldo de Salário', value: irrfSaldoSalario, tipo: 'desconto' });
  if (inss13 > 0) itens.push({ label: 'INSS sobre 13º Proporcional', value: inss13, tipo: 'desconto' });
  if (irrf13 > 0) itens.push({ label: 'IRRF sobre 13º Proporcional', value: irrf13, tipo: 'desconto' });
  if (incluirFgts && fgtsSaldoEstimado > 0) itens.push({ label: 'Saldo FGTS a sacar (não entra no líquido da rescisão)', value: fgtsSaldoEstimado, tipo: 'info' });

  const totalProventos = saldoSalario + avisoPrevioIndenizado + feriasVencidas + feriasProporcionais + decimoTerceiroProporcional + multaFgts;
  const totalDescontos = inssSaldoSalario + irrfSaldoSalario + inss13 + irrf13;
  const totalLiquido = totalProventos - totalDescontos;

  return {
    tempoServicoMeses: mesesCompletosServico,
    saldoSalario,
    avisoPrevioDias,
    avisoPrevioIndenizado,
    feriasVencidas,
    feriasProporcionais,
    decimoTerceiroProporcional,
    fgtsSaldoEstimado,
    multaFgts,
    inssSaldoSalario,
    inss13,
    irrfSaldoSalario,
    irrf13,
    totalProventos,
    totalDescontos,
    totalLiquido,
    itens,
  };
}

// ── Acerto Simplificado ───────────────────────────────────────────────────
// Versão leve pra fechamento de período (não necessariamente uma rescisão formal): sem
// tipo de rescisão, sem aviso prévio, sem INSS/IRRF — cada verba é um toggle independente
// (ao contrário do simulador completo acima, onde férias e seu 1/3 sempre andam juntos).
// Cobre o caso de colaborador que recebe quinzenal como adiantamento: o valor já recebido
// entra como desconto do total apurado no fechamento.
export type AcertoSimplificadoInput = {
  salary: number;
  admissionDate: number;
  closingDate: number;
  // Se true, o saldo de salário proporcional aos dias do mês já foi pago (ex.: já entrou na
  // quinzena/adiantamento) e não deve ser calculado de novo.
  jaRecebeuProporcional: boolean;
  adiantamentoQuinzenal: number;
  // Períodos aquisitivos completos (12 meses) já vencidos e ainda não gozados nem pagos —
  // o app não guarda histórico de férias já tiradas, então isso fica a critério de quem
  // preenche (mesmo campo e mesma limitação da Rescisão Completa).
  feriasVencidasPeriodos: number;
  incluirFerias: boolean;
  incluirTercoFerias: boolean;
  incluirDecimoTerceiro: boolean;
  incluirFgts: boolean;
  incluirTercoFgts: boolean;
  fgtsSaldoInformado?: number;
};

export type AcertoSimplificadoResultado = {
  saldoSalario: number;
  feriasVencidas: number;
  feriasProporcionais: number;
  tercoFerias: number;
  decimoTerceiroProporcional: number;
  fgtsEstimado: number;
  tercoFgts: number;
  adiantamentoQuinzenal: number;
  totalBruto: number;
  totalLiquido: number;
  itens: RescisaoItem[];
};

export function calculateAcertoSimplificado(input: AcertoSimplificadoInput, params: LaborSimParams = DEFAULT_LABOR_SIM_PARAMS): AcertoSimplificadoResultado {
  const admissionDate = new Date(input.admissionDate);
  const closingDate = new Date(input.closingDate);
  const mesesCompletosServico = Math.max(0, differenceInCalendarMonths(closingDate, admissionDate));

  const saldoSalario = input.jaRecebeuProporcional ? 0 : (input.salary / 30) * getDate(closingDate);

  const feriasVencidas = input.incluirFerias ? input.feriasVencidasPeriodos * (input.salary + input.salary / 3) : 0;

  let feriasProporcionais = 0;
  let tercoFerias = 0;
  if (input.incluirFerias || input.incluirTercoFerias) {
    const mesesDesdeAdmissao = Math.max(0, differenceInCalendarMonths(closingDate, admissionDate));
    const aniversariosCompletos = Math.floor(mesesDesdeAdmissao / 12);
    const inicioPeriodoAquisitivo = addMonths(admissionDate, aniversariosCompletos * 12);
    const mesesProporcionais = countFullMonths(inicioPeriodoAquisitivo, closingDate);
    const baseFerias = (input.salary / 12) * mesesProporcionais;
    if (input.incluirFerias) feriasProporcionais = baseFerias;
    if (input.incluirTercoFerias) tercoFerias = baseFerias / 3;
  }

  let decimoTerceiroProporcional = 0;
  if (input.incluirDecimoTerceiro) {
    const anoBase = closingDate.getFullYear();
    const inicioAno = new Date(anoBase, 0, 1);
    const inicio13 = admissionDate > inicioAno ? admissionDate : inicioAno;
    const meses13 = countFullMonths(inicio13, closingDate);
    decimoTerceiroProporcional = (input.salary / 12) * meses13;
  }

  let fgtsEstimado = 0;
  let tercoFgts = 0;
  if (input.incluirFgts || input.incluirTercoFgts) {
    const base = input.fgtsSaldoInformado && input.fgtsSaldoInformado > 0 ? input.fgtsSaldoInformado : params.fgtsPercentMensal * input.salary * mesesCompletosServico;
    if (input.incluirFgts) fgtsEstimado = base;
    if (input.incluirTercoFgts) tercoFgts = base / 3;
  }

  const itens: RescisaoItem[] = [];
  if (saldoSalario > 0) itens.push({ label: 'Saldo de Salário (dias trabalhados)', value: saldoSalario, tipo: 'provento' });
  if (feriasVencidas > 0) itens.push({ label: `Férias Vencidas + 1/3 (${input.feriasVencidasPeriodos}x)`, value: feriasVencidas, tipo: 'provento' });
  if (feriasProporcionais > 0) itens.push({ label: 'Férias Proporcionais', value: feriasProporcionais, tipo: 'provento' });
  if (tercoFerias > 0) itens.push({ label: '1/3 de Férias', value: tercoFerias, tipo: 'provento' });
  if (decimoTerceiroProporcional > 0) itens.push({ label: '13º Salário Proporcional', value: decimoTerceiroProporcional, tipo: 'provento' });
  if (fgtsEstimado > 0) itens.push({ label: 'FGTS do Período', value: fgtsEstimado, tipo: 'provento' });
  if (tercoFgts > 0) itens.push({ label: '1/3 do FGTS', value: tercoFgts, tipo: 'provento' });
  if (input.adiantamentoQuinzenal > 0) itens.push({ label: 'Adiantamento Quinzenal já Recebido', value: input.adiantamentoQuinzenal, tipo: 'desconto' });

  const totalBruto = saldoSalario + feriasVencidas + feriasProporcionais + tercoFerias + decimoTerceiroProporcional + fgtsEstimado + tercoFgts;
  const totalLiquido = totalBruto - input.adiantamentoQuinzenal;

  return {
    saldoSalario, feriasVencidas, feriasProporcionais, tercoFerias, decimoTerceiroProporcional,
    fgtsEstimado, tercoFgts, adiantamentoQuinzenal: input.adiantamentoQuinzenal,
    totalBruto, totalLiquido, itens,
  };
}

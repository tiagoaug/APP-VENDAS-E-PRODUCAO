import { useState, useMemo, useRef } from 'react';
import { Collaborator, Person, Sale, SaleStatus, PaymentStatus, CompanyProfile, CollaboratorLoan, LoanPayment } from '../types';
import { ChevronDown, Calendar, Clipboard, Send, FileDown, Image as ImageIcon, Check, HandCoins } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPeriodRange, OverviewPeriodType, STATS_PERIOD_LABELS } from '../utils/businessOverview';
import { exportCommission } from '../utils/commissionExport';
import { exportPayrollPeriod } from '../utils/payrollExport';
import { generateId } from '../utils/id';
import { toast } from '../utils/toast';
import { usePrivacyMode, PRIVACY_BLUR_CLASS } from '../contexts/PrivacyContext';

// Card "Folha de Pagamento" — era só "Comissão a Vendedores" (extraído de FinancialView.tsx pra
// ser reutilizado também no Dashboard, ver ProviderServiceOrdersCard.tsx, extraído junto no
// mesmo pedido), agora generalizado pra somar Salário + Comissão de QUALQUER colaborador (não só
// vendedor) e virar o lugar único de gerar o pagamento — ver Collaborator.salary/
// paymentFrequency em types.ts e a aba "Financeira" de Colaboradores (RhView), que só mostra o
// cálculo individual de referência; a transação de pagamento em si nasce daqui. Cada instância
// monta seu próprio estado (expandido/período/colaborador selecionado) — abrir esse card no
// Dashboard não afeta a instância de Financeiro, e vice-versa.
interface CommissionToSellersCardProps {
  isDarkMode: boolean;
  sales: Sale[];
  collaborators: Collaborator[];
  people: Person[];
  companyProfile?: CompanyProfile | null;
  onPayCommission?: (params: {
    supplierId?: string;
    initialGeneralItems: { id: string; description: string; quantity: number; value: number; kind: 'general' }[];
    initialDescription: string;
  }) => void;
  onOpenSale?: (id: string) => void;
  // % do salário/pró-labore pago no Adiantamento (RH → Configurações Globais,
  // RhGlobalConfig.advancePercent) — usado pra dividir o botão de pagamento em dois quando o
  // colaborador tem "Recebe Adiantamento Quinzenal?" ligado. Ausente = 50 (meio a meio).
  advancePercent?: number;
  // Empréstimos da empresa a colaboradores (RH → Empréstimos) — o desconto mensal de um
  // empréstimo ativo é abatido do Fechamento (nunca do Adiantamento) e, ao lançar o pagamento,
  // um LoanPayment tipo 'payroll' é registrado automaticamente reduzindo o Restante.
  loans?: CollaboratorLoan[];
  onSaveLoan?: (loan: CollaboratorLoan) => void | Promise<void>;
}

export default function CommissionToSellersCard({
  isDarkMode, sales, collaborators, people, companyProfile, onPayCommission, onOpenSale,
  advancePercent = 50, loans = [], onSaveLoan,
}: CommissionToSellersCardProps) {
  const hidePrivacy = usePrivacyMode();

  // Comissão a Vendedores — soma Sale.commissionAmount (já "assado" na venda, ver SaleFormView)
  // por colaborador-vendedor, dentro do período escolhido abaixo. Só conta vendas de verdade
  // (não orçamento nem cancelada), igual ao resto das métricas de vendas desta tela.
  const [isCommissionExpanded, setIsCommissionExpanded] = useState(false);
  const [commissionPeriodType, setCommissionPeriodType] = useState<OverviewPeriodType>('MONTH');
  const [commissionPeriodDate, setCommissionPeriodDate] = useState(() => format(new Date(), 'yyyy-MM'));
  const commissionDateInputRef = useRef<HTMLInputElement>(null);
  const openCommissionMonthPicker = () => {
    const el = commissionDateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el) return;
    try { el.showPicker ? el.showPicker() : el.focus(); } catch { el.focus(); }
  };
  // Desligado = só conta comissão de pedidos já recebidos (paymentStatus PAID) no "total a
  // pagar" — ligado, soma junto o que ainda está pendente de recebimento do cliente.
  const [includeUnpaidCommission, setIncludeUnpaidCommission] = useState(false);
  const [expandedCommissionSellerId, setExpandedCommissionSellerId] = useState<string | null>(null);

  // Entra na Folha de Pagamento quem é Vendedor (comissão), tem Salário cadastrado, ou é
  // Diretor (Pró-labore, sem salário) — cobre quem recebe só comissão, só salário fixo, só
  // pró-labore, ou qualquer combinação.
  const payrollCollaborators = useMemo(
    () => collaborators.filter(c => c.isSeller || (c.salary || 0) > 0 || c.cargo === 'diretor'),
    [collaborators]
  );

  // Marca visualmente qual pagamento já foi lançado nesta sessão (chave inclui o período —
  // trocar de mês/ano é um novo pagamento, então libera sozinho). Só um indicativo: o botão
  // continua clicável mesmo "lançado", pra abrir a Compra de novo e editar caso tenha errado
  // algo (a Compra em si é editável/excluível normalmente em Financeiro/Compras).
  const [executedActions, setExecutedActions] = useState<Set<string>>(new Set());
  const actionKey = (collaboratorId: string, portion: string) =>
    `${collaboratorId}:${portion}:${commissionPeriodType}:${commissionPeriodDate}`;
  const markExecuted = (key: string) => setExecutedActions(prev => new Set(prev).add(key));

  // Empréstimo ativo (Restante > 0) de cada colaborador — só considera o primeiro encontrado;
  // ter dois empréstimos ativos ao mesmo tempo pro mesmo colaborador é caso raro, não suportado.
  const activeLoanFor = (collaboratorId: string) => {
    const collabLoans = loans.filter(l => l.collaboratorId === collaboratorId);
    return collabLoans.find(l => l.totalValue - l.payments.reduce((acc, p) => acc + p.amount, 0) > 0.01);
  };
  const loanRemaining = (loan: CollaboratorLoan) => Math.max(0, loan.totalValue - loan.payments.reduce((acc, p) => acc + p.amount, 0));

  const sellerCommissions = useMemo(() => {
    if (payrollCollaborators.length === 0) return [];
    const { start, end } = getPeriodRange(commissionPeriodType, commissionPeriodDate);
    const realSales = sales.filter(s => s.status !== SaleStatus.QUOTE && s.status !== SaleStatus.CANCELLED && s.isAccounting !== false && s.date >= start && s.date <= end);
    return payrollCollaborators
      .map(c => {
        const collabSales = c.isSeller
          ? realSales
            .filter(s => s.sellerId === c.id)
            .map(s => ({
              sale: s,
              paid: s.paymentStatus === PaymentStatus.PAID,
              commission: s.commissionAmount || 0,
            }))
            .sort((a, b) => b.sale.date - a.sale.date)
          : [];
        const totalSales = collabSales.reduce((acc, s) => acc + s.sale.total, 0);
        const receivedCommission = collabSales.filter(s => s.paid).reduce((acc, s) => acc + s.commission, 0);
        const pendingCommission = collabSales.filter(s => !s.paid).reduce((acc, s) => acc + s.commission, 0);
        const loan = activeLoanFor(c.id);
        const loanDeduction = loan ? Math.min(loan.monthlyDeduction, loanRemaining(loan)) : 0;
        return {
          collaborator: c,
          salary: c.cargo === 'diretor' ? 0 : (c.salary || 0),
          proLabore: c.cargo === 'diretor' ? (c.proLaboreValue || 0) : 0,
          salesCount: collabSales.length,
          totalSales,
          receivedCommission,
          pendingCommission,
          totalCommission: receivedCommission + pendingCommission,
          sales: collabSales,
          loan,
          loanDeduction,
        };
      })
      .sort((a, b) => (b.salary + b.proLabore + b.totalCommission) - (a.salary + a.proLabore + a.totalCommission));
  }, [payrollCollaborators, sales, commissionPeriodType, commissionPeriodDate, loans]);
  const hasSellerCollaborators = payrollCollaborators.length > 0;

  // Total "a pagar" — Salário + Pró-labore (sempre) + Comissão, que segue o toggle acima: com
  // ele desligado, só a comissão já recebida do cliente entra na conta; ligado, soma também a
  // pendente.
  const totalCommissionOwed = sellerCommissions.reduce(
    (acc, s) => acc + s.salary + s.proLabore + s.receivedCommission + (includeUnpaidCommission ? s.pendingCommission : 0) - s.loanDeduction,
    0,
  );

  const commissionPeriodLabel = useMemo(
    () => format(new Date(commissionPeriodDate + '-01T12:00:00'), 'MMMM/yyyy', { locale: ptBR }),
    [commissionPeriodDate],
  );

  const handleCopyCommission = (sellerLabel: string, value: number) => {
    navigator.clipboard.writeText(`Folha de Pagamento — ${sellerLabel} (${commissionPeriodLabel})\nR$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    toast.show('Valor copiado!');
  };

  type Portion = 'full' | 'advance' | 'closing';

  // Colaborador com "Recebe Adiantamento Quinzenal?" ligado (paymentFrequency BIWEEKLY) divide
  // salário/pró-labore entre Adiantamento e Fechamento pelo % global (advancePercent) — comissão
  // de vendas nunca é antecipada, sempre entra no Fechamento. Sem BIWEEKLY, tudo sai junto (full).
  // Desconto de Empréstimo (se houver) também nunca sai do Adiantamento, só do Fechamento/Total.
  const splitPayment = (sc: (typeof sellerCommissions)[number]) => {
    const commission = sc.receivedCommission + (includeUnpaidCommission ? sc.pendingCommission : 0);
    const baseAmount = sc.salary + sc.proLabore;
    const full = baseAmount + commission - sc.loanDeduction;
    if (sc.collaborator.paymentFrequency === 'BIWEEKLY') {
      const ratio = advancePercent / 100;
      return { advance: baseAmount * ratio, closing: baseAmount * (1 - ratio) + commission - sc.loanDeduction, full, isSplit: true };
    }
    return { advance: 0, closing: full, full, isSplit: false };
  };

  const handlePayCommission = (sc: (typeof sellerCommissions)[number], portion: Portion = 'full') => {
    const { advance, closing, full } = splitPayment(sc);
    const value = portion === 'advance' ? advance : portion === 'closing' ? closing : full;
    if (value <= 0) {
      toast.show('Nenhum valor a pagar nesse período.');
      return;
    }
    if (!onPayCommission) return;
    const portionLabel = portion === 'advance' ? ' — Adiantamento' : portion === 'closing' ? ' — Fechamento' : '';
    const description = `Folha de Pagamento — ${sc.collaborator.name} (${commissionPeriodLabel})${portionLabel}`;
    // Tenta achar um Fornecedor já cadastrado com o mesmo nome do colaborador — Purchase exige
    // um supplierId (Pessoa), e Collaborator não tem esse vínculo direto. Sem achar, deixa em
    // branco: o próprio formulário de Compra pede pra escolher/cadastrar.
    const matchedSupplier = people.find(p => p.isSupplier && p.name.trim().toLowerCase() === sc.collaborator.name.trim().toLowerCase());
    const commission = sc.receivedCommission + (includeUnpaidCommission ? sc.pendingCommission : 0);
    // Itemizado (Salário / Pró-labore / Comissão) só faz sentido pagando tudo junto (full); no
    // Adiantamento/Fechamento parcial, um item só com o valor daquela parte já é claro o
    // suficiente pra Compra gerada.
    const items: { id: string; description: string; quantity: number; value: number; kind: 'general' }[] = [];
    if (portion === 'full') {
      if (sc.salary > 0) items.push({ id: generateId(), description: `Salário — ${sc.collaborator.name}`, quantity: 1, value: sc.salary, kind: 'general' });
      if (sc.proLabore > 0) items.push({ id: generateId(), description: `Pró-labore — ${sc.collaborator.name}`, quantity: 1, value: sc.proLabore, kind: 'general' });
      if (commission > 0) items.push({ id: generateId(), description: `Comissão — ${sc.collaborator.name}`, quantity: 1, value: commission, kind: 'general' });
      if (sc.loanDeduction > 0) items.push({ id: generateId(), description: `Desconto Empréstimo — ${sc.collaborator.name}`, quantity: 1, value: -sc.loanDeduction, kind: 'general' });
    } else {
      items.push({ id: generateId(), description: `${portion === 'advance' ? 'Adiantamento' : 'Fechamento'} — ${sc.collaborator.name}`, quantity: 1, value, kind: 'general' });
    }
    onPayCommission({
      supplierId: matchedSupplier?.id,
      initialGeneralItems: items,
      initialDescription: description,
    });
    markExecuted(actionKey(sc.collaborator.id, portion));
    // Portion 'advance' nunca inclui o desconto de empréstimo (ver splitPayment) — só registra
    // o abatimento no Empréstimo quando a parte paga é 'closing' ou 'full'.
    if (portion !== 'advance' && sc.loan && sc.loanDeduction > 0 && onSaveLoan) {
      const payment: LoanPayment = { id: generateId(), date: Date.now(), amount: sc.loanDeduction, type: 'payroll' };
      onSaveLoan({ ...sc.loan, payments: [...sc.loan.payments, payment] });
    }
    if (!matchedSupplier) {
      toast.show('Não achei um fornecedor cadastrado com esse nome — escolha ou cadastre um na tela de Compra que abriu.');
    }
  };

  const handleExportCommission = (sc: (typeof sellerCommissions)[number], type: 'pdf' | 'jpg') => {
    exportCommission({
      sellerName: sc.collaborator.name,
      commissionPercent: sc.collaborator.commissionPercent,
      periodLabel: commissionPeriodLabel,
      sales: sc.sales.map(({ sale, paid, commission }) => ({
        orderNumber: sale.orderNumber,
        customerName: sale.customerName || 'Sem cliente',
        date: sale.date,
        total: sale.total,
        commission,
        paid,
      })),
      receivedCommission: sc.receivedCommission,
      pendingCommission: sc.pendingCommission,
      includeUnpaid: includeUnpaidCommission,
      companyProfile,
    }, type);
  };

  // Exporta a Folha inteira do período (todos os colaboradores de uma vez), diferente de
  // handleExportCommission acima (detalhe de vendas de UM vendedor só).
  const handleExportPayrollPeriod = (type: 'pdf' | 'jpg') => {
    exportPayrollPeriod({
      periodLabel: commissionPeriodLabel,
      rows: sellerCommissions.map(sc => ({
        name: sc.collaborator.name,
        cargo: sc.collaborator.cargo === 'diretor' ? 'Diretor' : sc.collaborator.cargo === 'gerente' ? 'Gerente' : (sc.collaborator.roleTitle || 'Colaborador'),
        salary: sc.salary,
        proLabore: sc.proLabore,
        commission: sc.receivedCommission + (includeUnpaidCommission ? sc.pendingCommission : 0),
        loanDeduction: sc.loanDeduction,
        net: sc.salary + sc.proLabore + sc.receivedCommission + (includeUnpaidCommission ? sc.pendingCommission : 0) - sc.loanDeduction,
      })),
      companyProfile,
    }, type);
  };

  if (!hasSellerCollaborators) return null;

  return (
    <div className={`rounded-[2.5rem] border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
      <button
        type="button"
        onClick={() => setIsCommissionExpanded(v => !v)}
        data-guide-anchor="dash.commission.expandir"
        className="w-full flex items-center justify-between gap-3 p-6"
      >
        <div className="text-left min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Folha de Pagamento</p>
          <p className={`text-2xl font-black tracking-tighter mt-1 transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
            R$ {totalCommissionOwed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${isCommissionExpanded ? 'rotate-180' : ''}`} />
      </button>
      {isCommissionExpanded && (
        <div className={`flex flex-col gap-4 px-6 pb-6 border-t pt-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          {/* Período — controla quais vendas entram na comissão abaixo */}
          <div className="flex flex-col gap-1.5">
            <div className={`flex gap-0.5 p-0.5 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
              {(Object.keys(STATS_PERIOD_LABELS) as OverviewPeriodType[]).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => setCommissionPeriodType(pt)}
                  data-guide-anchor="dash.commission.periodo"
                  className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                    commissionPeriodType === pt ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  {STATS_PERIOD_LABELS[pt]}
                </button>
              ))}
            </div>
            <div
              onClick={openCommissionMonthPicker}
              data-guide-anchor="dash.commission.mesEscolhido"
              className={`w-full flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
            >
              <Calendar size={12} className="text-indigo-500 shrink-0" />
              <input
                ref={commissionDateInputRef}
                type="month"
                value={commissionPeriodDate}
                onChange={(e) => setCommissionPeriodDate(e.target.value)}
                className={`flex-1 min-w-0 border-none bg-transparent px-0 py-0 text-[10px] font-black outline-none pointer-events-none ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}
              />
            </div>
          </div>

          {/* Toggle — some ou não a comissão de pedidos ainda não recebidos do cliente
              no "total a pagar" (por padrão, só conta o que já é dinheiro na mão). */}
          <button
            type="button"
            onClick={() => setIncludeUnpaidCommission(v => !v)}
            data-guide-anchor="dash.commission.incluirPendentes"
            className={`flex items-center justify-between gap-3 p-3 rounded-2xl text-left ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}
          >
            <div className="min-w-0">
              <p className={`text-[11px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Incluir pedidos não recebidos</p>
              <p className="text-[9px] font-bold text-slate-400 mt-0.5">Soma comissão de vendas ainda pendentes de pagamento do cliente no total a pagar</p>
            </div>
            <div className={`w-11 h-6 rounded-full relative transition-colors duration-300 shrink-0 ${includeUnpaidCommission ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${includeUnpaidCommission ? 'left-6' : 'left-1'}`} />
            </div>
          </button>

          {/* Exporta a Folha inteira do período (todos os colaboradores de uma vez), com todas
              as transações financeiras (salário/pró-labore/comissão/empréstimo) daquele mês. */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleExportPayrollPeriod('pdf')}
              data-guide-anchor="dash.commission.exportarFolha"
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              <FileDown size={12} /> Exportar Folha PDF
            </button>
            <button
              type="button"
              onClick={() => handleExportPayrollPeriod('jpg')}
              data-guide-anchor="dash.commission.exportarFolha"
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              <ImageIcon size={12} /> Exportar Folha JPG
            </button>
          </div>

          {sellerCommissions.every(s => s.salesCount === 0 && s.salary === 0 && s.proLabore === 0) && (
            <p className="text-[10px] font-bold text-slate-400 text-center py-4">Nenhum salário, pró-labore ou venda com comissão nesse período.</p>
          )}

          {sellerCommissions.map((sc) => {
            const { collaborator, salary, proLabore, salesCount, totalSales, receivedCommission, pendingCommission, loan, loanDeduction } = sc;
            const commissionValue = receivedCommission + (includeUnpaidCommission ? pendingCommission : 0);
            const payableValue = salary + proLabore + commissionValue - loanDeduction;
            const isSellerExpanded = expandedCommissionSellerId === collaborator.id;
            return (
              <div key={collaborator.id} className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <button
                  type="button"
                  onClick={() => setExpandedCommissionSellerId(v => v === collaborator.id ? null : collaborator.id)}
                  data-guide-anchor="dash.commission.vendedorItem"
                  className="w-full flex items-center justify-between gap-3 p-3.5 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {collaborator.photoUrl ? (
                      <img src={collaborator.photoUrl} alt={collaborator.name} className="w-9 h-9 rounded-xl shrink-0 object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white font-black text-xs" style={{ backgroundColor: collaborator.colorHex }}>
                        {collaborator.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{collaborator.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {collaborator.cargo === 'diretor' && <>Diretor</>}
                        {collaborator.cargo === 'gerente' && <>Gerente</>}
                        {(!collaborator.cargo || collaborator.cargo === 'colaborador') && collaborator.roleTitle && <>{collaborator.roleTitle}</>}
                        {(collaborator.cargo || collaborator.roleTitle) && (salary > 0 || proLabore > 0 || collaborator.isSeller) && ' · '}
                        {salary > 0 && <>Salário <span className={hidePrivacy ? PRIVACY_BLUR_CLASS : ''}>R$ {salary.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></>}
                        {salary > 0 && proLabore > 0 && ' · '}
                        {proLabore > 0 && <>Pró-labore <span className={hidePrivacy ? PRIVACY_BLUR_CLASS : ''}>R$ {proLabore.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></>}
                        {(salary > 0 || proLabore > 0) && collaborator.isSeller && ' · '}
                        {collaborator.isSeller && <>{salesCount} {salesCount === 1 ? 'venda' : 'vendas'} · {collaborator.commissionPercent ?? 0}% · <span className={hidePrivacy ? PRIVACY_BLUR_CLASS : ''}>R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> vendido</>}
                      </p>
                      {loan && (
                        <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                          <HandCoins size={10} /> Empréstimo -R$ {loanDeduction.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · restante R$ {(loan.totalValue - loan.payments.reduce((acc, p) => acc + p.amount, 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className={`text-sm font-black transition-all ${isDarkMode ? 'text-amber-400' : 'text-amber-600'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                      R$ {payableValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isSellerExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {isSellerExpanded && (
                  <div className="flex flex-col gap-2 px-3.5 pb-3.5">
                    {!collaborator.isSeller && (
                      <p className="text-[10px] font-bold text-slate-400 px-1">Salário fixo — sem comissão de vendas.</p>
                    )}
                    <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-0.5 custom-scrollbar">
                      {sc.sales.map(({ sale, paid, commission }) => (
                        <button
                          key={sale.id}
                          type="button"
                          onClick={() => onOpenSale?.(sale.id)}
                          data-guide-anchor="dash.commission.abrirVenda"
                          className={`flex items-center justify-between gap-2 p-2.5 rounded-xl text-left ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
                        >
                          <div className="min-w-0">
                            <p className={`text-[10px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>#{sale.orderNumber} · {sale.customerName || 'Sem cliente'}</p>
                            <p className={`text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>{format(sale.date, 'dd/MM/yyyy')} · venda R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-[11px] font-black ${paid ? 'text-rose-500' : (isDarkMode ? 'text-slate-300' : 'text-slate-600')} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                              R$ {commission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className={`text-[7px] font-black uppercase tracking-widest ${paid ? 'text-rose-500' : 'text-slate-400'}`}>{paid ? 'Recebido' : 'Pendente'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopyCommission(collaborator.name, payableValue)}
                        data-guide-anchor="dash.commission.copiar"
                        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                      >
                        <Clipboard size={12} /> Copiar
                      </button>
                    </div>
                    {onPayCommission && (() => {
                      const { advance, closing, full, isSplit } = splitPayment(sc);
                      const doneClass = isDarkMode ? 'bg-slate-700 text-slate-400 border-2 border-slate-600' : 'bg-slate-100 text-slate-500 border-2 border-slate-300';
                      const portions: { key: Portion; label: string; value: number; outline?: boolean }[] = isSplit
                        ? [
                            { key: 'advance', label: 'Adiant.', value: advance },
                            { key: 'closing', label: 'Fecham.', value: closing },
                            { key: 'full', label: 'Total', value: full, outline: true },
                          ]
                        : [{ key: 'full', label: 'Lançar nos Gastos', value: full }];
                      return (
                        <div className="flex flex-col gap-1.5">
                          {isSplit && <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 px-1">Lançar nos Gastos</p>}
                          <div className={isSplit ? 'grid grid-cols-3 gap-1.5' : ''}>
                            {portions.map(p => {
                              const key = actionKey(sc.collaborator.id, p.key);
                              const done = executedActions.has(key);
                              return (
                                <button
                                  key={p.key}
                                  type="button"
                                  onClick={() => handlePayCommission(sc, p.key)}
                                  title={done ? 'Já lançado — toque pra abrir a Compra de novo e editar' : undefined}
                                  data-guide-anchor="dash.commission.pagar"
                                  className={`flex ${isSplit ? 'flex-col' : 'flex-row'} items-center justify-center gap-0.5 ${isSplit ? 'py-2 text-[8px]' : 'py-2.5 text-[9px]'} rounded-xl font-black uppercase tracking-wide ${
                                    done ? doneClass : p.outline ? `border-2 border-indigo-600 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}` : 'bg-indigo-600 text-white'
                                  }`}
                                >
                                  {done ? <><Check size={isSplit ? 10 : 12} /> Editar</> : (
                                    isSplit ? <>{p.label}<span className="text-[9px]">R$ {p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></> : <><Send size={12} /> {p.label}</>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    {collaborator.isSeller && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleExportCommission(sc, 'pdf')}
                        data-guide-anchor="dash.commission.exportar"
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                      >
                        <FileDown size={12} /> Exportar PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportCommission(sc, 'jpg')}
                        data-guide-anchor="dash.commission.exportar"
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                      >
                        <ImageIcon size={12} /> Exportar JPG
                      </button>
                    </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useRef } from 'react';
import { Collaborator, Person, Sale, SaleStatus, PaymentStatus, CompanyProfile } from '../types';
import { ChevronDown, Calendar, Clipboard, Send, FileDown, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPeriodRange, OverviewPeriodType, STATS_PERIOD_LABELS } from '../utils/businessOverview';
import { exportCommission } from '../utils/commissionExport';
import { generateId } from '../utils/id';
import { toast } from '../utils/toast';
import { usePrivacyMode, PRIVACY_BLUR_CLASS } from '../contexts/PrivacyContext';

// Card "Comissão a Vendedores" — extraído de FinancialView.tsx pra ser reutilizado também no
// Dashboard (ver ProviderServiceOrdersCard.tsx, extraído junto no mesmo pedido). Cada instância
// monta seu próprio estado (expandido/período/vendedor selecionado) — abrir esse card no
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
}

export default function CommissionToSellersCard({
  isDarkMode, sales, collaborators, people, companyProfile, onPayCommission, onOpenSale,
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

  const sellerCommissions = useMemo(() => {
    const sellerCollaborators = collaborators.filter(c => c.isSeller);
    if (sellerCollaborators.length === 0) return [];
    const { start, end } = getPeriodRange(commissionPeriodType, commissionPeriodDate);
    const realSales = sales.filter(s => s.status !== SaleStatus.QUOTE && s.status !== SaleStatus.CANCELLED && s.isAccounting !== false && s.date >= start && s.date <= end);
    return sellerCollaborators
      .map(c => {
        const collabSales = realSales
          .filter(s => s.sellerId === c.id)
          .map(s => ({
            sale: s,
            paid: s.paymentStatus === PaymentStatus.PAID,
            commission: s.commissionAmount || 0,
          }))
          .sort((a, b) => b.sale.date - a.sale.date);
        const totalSales = collabSales.reduce((acc, s) => acc + s.sale.total, 0);
        const receivedCommission = collabSales.filter(s => s.paid).reduce((acc, s) => acc + s.commission, 0);
        const pendingCommission = collabSales.filter(s => !s.paid).reduce((acc, s) => acc + s.commission, 0);
        return {
          collaborator: c,
          salesCount: collabSales.length,
          totalSales,
          receivedCommission,
          pendingCommission,
          totalCommission: receivedCommission + pendingCommission,
          sales: collabSales,
        };
      })
      .sort((a, b) => b.totalCommission - a.totalCommission);
  }, [collaborators, sales, commissionPeriodType, commissionPeriodDate]);
  const hasSellerCollaborators = useMemo(() => collaborators.some(c => c.isSeller), [collaborators]);

  // Total "a pagar" — segue o toggle acima: com ele desligado, só o que já foi recebido do
  // cliente entra na conta (comissão certa); ligado, soma também o que ainda está pendente.
  const totalCommissionOwed = sellerCommissions.reduce(
    (acc, s) => acc + s.receivedCommission + (includeUnpaidCommission ? s.pendingCommission : 0),
    0,
  );

  const commissionPeriodLabel = useMemo(
    () => format(new Date(commissionPeriodDate + '-01T12:00:00'), 'MMMM/yyyy', { locale: ptBR }),
    [commissionPeriodDate],
  );

  const handleCopyCommission = (sellerLabel: string, value: number) => {
    navigator.clipboard.writeText(`Comissão de ${sellerLabel} — ${commissionPeriodLabel}\nR$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    toast.show('Valor copiado!');
  };

  const handlePayCommission = (sc: (typeof sellerCommissions)[number]) => {
    const value = sc.receivedCommission + (includeUnpaidCommission ? sc.pendingCommission : 0);
    if (value <= 0) {
      toast.show('Nenhum valor de comissão a pagar nesse período.');
      return;
    }
    if (!onPayCommission) return;
    const description = `Comissão de Vendas — ${sc.collaborator.name} (${commissionPeriodLabel})`;
    // Tenta achar um Fornecedor já cadastrado com o mesmo nome do colaborador-vendedor —
    // Purchase exige um supplierId (Pessoa), e Collaborator não tem esse vínculo direto. Sem
    // achar, deixa em branco: o próprio formulário de Compra pede pra escolher/cadastrar.
    const matchedSupplier = people.find(p => p.isSupplier && p.name.trim().toLowerCase() === sc.collaborator.name.trim().toLowerCase());
    onPayCommission({
      supplierId: matchedSupplier?.id,
      initialGeneralItems: [{ id: generateId(), description, quantity: 1, value, kind: 'general' }],
      initialDescription: description,
    });
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

  if (!hasSellerCollaborators) return null;

  return (
    <div className={`rounded-[2.5rem] border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
      <button
        type="button"
        onClick={() => setIsCommissionExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 p-6"
      >
        <div className="text-left min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comissão a Vendedores</p>
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

          {sellerCommissions.every(s => s.salesCount === 0) && (
            <p className="text-[10px] font-bold text-slate-400 text-center py-4">Nenhuma venda com comissão nesse período.</p>
          )}

          {sellerCommissions.map((sc) => {
            const { collaborator, salesCount, totalSales, receivedCommission, pendingCommission } = sc;
            const payableValue = receivedCommission + (includeUnpaidCommission ? pendingCommission : 0);
            const isSellerExpanded = expandedCommissionSellerId === collaborator.id;
            return (
              <div key={collaborator.id} className={`rounded-2xl overflow-hidden ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <button
                  type="button"
                  onClick={() => setExpandedCommissionSellerId(v => v === collaborator.id ? null : collaborator.id)}
                  className="w-full flex items-center justify-between gap-3 p-3.5 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl shrink-0" style={{ backgroundColor: collaborator.colorHex }} />
                    <div className="min-w-0">
                      <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{collaborator.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {salesCount} {salesCount === 1 ? 'venda' : 'vendas'} · {collaborator.commissionPercent ?? 0}% · <span className={hidePrivacy ? PRIVACY_BLUR_CLASS : ''}>R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> vendido
                      </p>
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
                    <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-0.5 custom-scrollbar">
                      {sc.sales.map(({ sale, paid, commission }) => (
                        <button
                          key={sale.id}
                          type="button"
                          onClick={() => onOpenSale?.(sale.id)}
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
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopyCommission(collaborator.name, payableValue)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                      >
                        <Clipboard size={12} /> Copiar
                      </button>
                      {onPayCommission && (
                        <button
                          type="button"
                          onClick={() => handlePayCommission(sc)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white"
                        >
                          <Send size={12} /> Pagar Comissão
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleExportCommission(sc, 'pdf')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                      >
                        <FileDown size={12} /> Exportar PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportCommission(sc, 'jpg')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                      >
                        <ImageIcon size={12} /> Exportar JPG
                      </button>
                    </div>
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

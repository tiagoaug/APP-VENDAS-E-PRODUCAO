import { useMemo, useState } from 'react';
import { ServiceOrder, Transaction, Person, Product, GeneralPurchaseItem } from '../types';
import { ArrowLeft, Factory, ChevronRight, CheckCircle2, Clock, Hammer, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';
import { generateId } from '../utils/id';
import { usePrivacyMode, PRIVACY_BLUR_CLASS } from '../contexts/PrivacyContext';
import Modal from '../components/Modal';

interface FornecedoresViewProps {
  isDarkMode: boolean;
  serviceOrders: ServiceOrder[];
  transactions: Transaction[];
  people: Person[];
  products: Product[];
  onBack: () => void;
  onPayProviderServiceOrders?: (params: {
    supplierId?: string;
    initialGeneralItems: GeneralPurchaseItem[];
    initialDescription: string;
  }) => void;
}

type FornecedorGroup = {
  key: string;
  providerName: string;
  providerId?: string;
  completedOrders: ServiceOrder[];
  completedUnpaidOrders: ServiceOrder[];
  completedUnpaidTotal: number;
  pendingOrders: ServiceOrder[];
  pendingUnpaidTotal: number;
};

export default function FornecedoresView({
  isDarkMode, serviceOrders, transactions, people, products, onBack, onPayProviderServiceOrders,
}: FornecedoresViewProps) {
  const hidePrivacy = usePrivacyMode();

  // Mesma checagem de "já foi paga" usada em ProviderServiceOrdersCard.tsx — reaproveitada
  // aqui pra não abrir uma segunda forma de considerar uma OS paga (ver memória
  // "OS-to-Purchase reconciliation"). Não depende do status — uma OS ainda "A Concluir" já
  // pode estar paga (ver "Marcar para pagamento" abaixo, que grava transactionId/paidNaoContabil
  // numa OS PENDING antes dela ser concluída no PCP), e continua paga depois que o PCP muda
  // o status pra COMPLETED (updateDocument lá é merge parcial, nunca apaga esses campos).
  const isOsPaid = (os: ServiceOrder) =>
    (!!os.transactionId && transactions.find(t => t.id === os.transactionId)?.status === 'COMPLETED') || !!os.paidNaoContabil;

  const groups = useMemo<FornecedorGroup[]>(() => {
    const map = new Map<string, FornecedorGroup>();
    for (const os of serviceOrders) {
      const key = (os.providerName || '').trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) {
        const matchedPerson = os.providerId
          ? people.find(p => p.id === os.providerId)
          : people.find(p => (p.isServiceProvider || p.isSupplier) && p.name.trim().toLowerCase() === key);
        map.set(key, {
          key, providerName: os.providerName, providerId: os.providerId || matchedPerson?.id,
          completedOrders: [], completedUnpaidOrders: [], completedUnpaidTotal: 0, pendingOrders: [], pendingUnpaidTotal: 0,
        });
      }
      const g = map.get(key)!;
      if (os.status === 'COMPLETED') {
        g.completedOrders.push(os);
        if (!isOsPaid(os)) {
          g.completedUnpaidOrders.push(os);
          g.completedUnpaidTotal += Number(os.totalValue) || 0;
        }
      } else {
        g.pendingOrders.push(os);
        // Uma OS "a concluir" pode já ter sido paga adiantado (ver handlePaySelected) — não
        // entra no total "a pagar" nem pode ser marcada de novo, só aparece na lista com a
        // tag "Pago".
        if (!isOsPaid(os)) g.pendingUnpaidTotal += Number(os.totalValue) || 0;
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.completedUnpaidTotal + b.pendingUnpaidTotal) - (a.completedUnpaidTotal + a.pendingUnpaidTotal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceOrders, transactions, people]);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [tab, setTab] = useState<'completed' | 'pending'>('completed');
  // Filtro por status de pagamento dentro da aba atual — sem isso, a lista misturava OS pagas
  // e não pagas sob um total do topo que só somava as não pagas (confuso: um total "ainda não
  // pago" em cima de uma lista cheia de "PAGO"). Começa em "unpaid" pra bater com o total
  // padrão de cada aba (Concluídas a pagar / A concluir a pagar).
  const [paymentFilter, setPaymentFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  // Seleção manual pra pagamento — atravessa as duas abas (dá pra marcar OS concluídas E OS
  // ainda em produção na mesma leva), guardada por id de OS. Zerada ao trocar de fornecedor
  // ou fechar o popup (ver openProvider/closeModal).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const openProvider = (key: string) => {
    setExpandedKey(key);
    setTab('completed');
    setPaymentFilter('unpaid');
    setSelectMode(false);
    setSelectedIds(new Set());
  };
  const closeModal = () => {
    setExpandedKey(null);
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const describeServiceOrderItem = (os: ServiceOrder): string => {
    const reference = products.find(p => p.id === os.productId)?.reference;
    const productLabel = `${reference ? `${reference} ` : ''}${os.productName}${os.variationName ? ` (${os.variationName})` : ''}`;
    const parts = [os.osNumber, productLabel, `${os.quantity} par${os.quantity === 1 ? '' : 'es'}`, os.sectorName];
    const suffix = os.status !== 'COMPLETED' ? ' [OS a concluir — pago adiantado]' : '';
    return parts.filter(Boolean).join(' — ') + suffix;
  };

  const buildGeneralItems = (orders: ServiceOrder[]): GeneralPurchaseItem[] => orders.map(os => ({
    id: generateId(),
    description: describeServiceOrderItem(os),
    quantity: 1,
    value: Number(os.totalValue) || 0,
    kind: 'general',
    serviceOrderId: os.id,
  }));

  const handlePay = (group: FornecedorGroup) => {
    if (group.completedUnpaidOrders.length === 0 || !onPayProviderServiceOrders) return;
    closeModal();
    onPayProviderServiceOrders({
      supplierId: group.providerId,
      initialGeneralItems: buildGeneralItems(group.completedUnpaidOrders),
      initialDescription: `Pagamento a Fornecedor — ${group.providerName} (${group.completedUnpaidOrders.length} OS)`,
    });
  };

  const toggleSelected = (osId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(osId)) next.delete(osId); else next.add(osId);
      return next;
    });
  };

  const handlePaySelected = (group: FornecedorGroup) => {
    if (selectedIds.size === 0 || !onPayProviderServiceOrders) return;
    const allOrders = [...group.completedOrders, ...group.pendingOrders];
    const selectedOrders = allOrders.filter(os => selectedIds.has(os.id));
    if (selectedOrders.length === 0) return;
    const pendingCount = selectedOrders.filter(os => os.status !== 'COMPLETED').length;
    closeModal();
    onPayProviderServiceOrders({
      supplierId: group.providerId,
      initialGeneralItems: buildGeneralItems(selectedOrders),
      initialDescription: `Pagamento a Fornecedor — ${group.providerName} (${selectedOrders.length} OS${pendingCount > 0 ? `, ${pendingCount} ainda a concluir` : ''})`,
    });
  };

  const selectedGroup = groups.find(g => g.key === expandedKey) || null;
  const tabOrders = selectedGroup ? (tab === 'completed' ? selectedGroup.completedOrders : selectedGroup.pendingOrders) : [];
  const detailList = paymentFilter === 'all' ? tabOrders : tabOrders.filter(os => isOsPaid(os) === (paymentFilter === 'paid'));
  // Total do topo sempre soma exatamente o que a lista filtrada abaixo mostra — nunca mais um
  // total "a pagar" em cima de uma lista cheia de "Pago" (ver paymentFilter acima).
  const filteredTotal = detailList.reduce((s, os) => s + (Number(os.totalValue) || 0), 0);
  const selectedTotal = useMemo(() => {
    if (!selectedGroup) return 0;
    const allOrders = [...selectedGroup.completedOrders, ...selectedGroup.pendingOrders];
    return allOrders.filter(os => selectedIds.has(os.id)).reduce((s, os) => s + (Number(os.totalValue) || 0), 0);
  }, [selectedGroup, selectedIds]);

  return (
    <div className="flex flex-col gap-6 pb-32">
      <div className="flex items-center gap-4">
        <button onClick={onBack} data-guide-anchor="fornecedores.voltar" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors text-slate-400" title="Voltar" aria-label="Voltar">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Fornecedores</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ordens de Serviço por fornecedor</p>
        </div>
      </div>

      {groups.length === 0 && (
        <p className="text-center text-xs font-bold text-slate-400 py-10">Nenhuma Ordem de Serviço a Fornecedor ainda.</p>
      )}

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <button
            key={group.key}
            type="button"
            onClick={() => openProvider(group.key)}
            data-guide-anchor="fornecedores.cardFornecedor"
            className={`w-full text-left rounded-[2rem] p-5 border-b-[3px] transition-shadow ${isDarkMode ? 'bg-gradient-to-b from-slate-800 to-slate-800/80 border-slate-950 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.5)]' : 'bg-gradient-to-b from-white to-slate-50 border-slate-200 shadow-[0_6px_16px_-6px_rgba(15,23,42,0.18)]'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center ${isDarkMode ? 'bg-slate-700 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
                <Factory size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{group.providerName}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {group.completedOrders.length} concluídas · {group.pendingOrders.length} a concluir
                </p>
              </div>
              <ChevronRight size={16} className="text-slate-400 shrink-0" />
            </div>
            <div className="flex gap-2 mt-4">
              <div className={`flex-1 rounded-xl p-2.5 ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1"><CheckCircle2 size={10} /> Concluídas a pagar</p>
                <p className={`text-sm font-black text-emerald-600 mt-0.5 transition-all ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                  R$ {group.completedUnpaidTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className={`flex-1 rounded-xl p-2.5 ${isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                <p className="text-[8px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1"><Clock size={10} /> A concluir</p>
                <p className={`text-sm font-black text-amber-600 mt-0.5 transition-all ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                  R$ {group.pendingUnpaidTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Modal isOpen={!!expandedKey} onClose={closeModal} title={selectedGroup?.providerName || ''} icon={<Factory size={20} />} maxWidth="max-w-lg" zIndex={96500}>
        {selectedGroup && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className={`flex gap-0.5 p-0.5 rounded-xl w-fit ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                <button
                  type="button"
                  onClick={() => setTab('completed')}
                  data-guide-anchor="fornecedores.aba"
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${tab === 'completed' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                >
                  OS Concluídas ({selectedGroup.completedOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab('pending')}
                  data-guide-anchor="fornecedores.aba"
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${tab === 'pending' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}
                >
                  OS a Concluir ({selectedGroup.pendingOrders.length})
                </button>
              </div>
            </div>

            {/* Toggle "Selecionar para pagamento" — liga o modo de marcação manual, que funciona
                nas DUAS abas (dá pra marcar uma OS Concluída e uma A Concluir na mesma leva).
                Feito como switch de linha inteira (não um ícone pequeno) pra ficar óbvio que
                existe essa opção. */}
            {onPayProviderServiceOrders && (
              <button
                type="button"
                onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()); }}
                data-guide-anchor="fornecedores.selecionarToggle"
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-colors ${selectMode ? (isDarkMode ? 'bg-indigo-950/50 border-indigo-500' : 'bg-indigo-50 border-indigo-300') : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200')}`}
              >
                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${selectMode ? 'text-indigo-600' : isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <CheckSquare size={13} /> Selecionar OS para pagamento
                </span>
                <span className={`w-9 h-5 rounded-full relative shrink-0 transition-colors ${selectMode ? 'bg-indigo-600' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${selectMode ? 'translate-x-4' : ''}`} />
                </span>
              </button>
            )}

            {/* Filtro por status de pagamento — evita a lista mostrar "PAGO" em tudo por baixo
                de um total que só soma o que ainda falta pagar (ver paymentFilter acima). */}
            <div className={`flex gap-0.5 p-0.5 rounded-xl w-fit ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
              <button
                type="button"
                onClick={() => setPaymentFilter('unpaid')}
                data-guide-anchor="fornecedores.filtroPagamento"
                className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${paymentFilter === 'unpaid' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                A Pagar
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter('paid')}
                data-guide-anchor="fornecedores.filtroPagamento"
                className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${paymentFilter === 'paid' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                Pagas
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter('all')}
                data-guide-anchor="fornecedores.filtroPagamento"
                className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${paymentFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                Todas
              </button>
            </div>

            {!selectMode && (
              <>
                <p className={`text-2xl font-black tracking-tighter transition-all ${tab === 'completed' ? 'text-emerald-600' : 'text-amber-600'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                  R$ {filteredTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest -mt-2">
                  {paymentFilter === 'unpaid' && (tab === 'completed' ? 'Total concluído a pagar (ainda não pago)' : 'Total não concluído a pagar (estimado, ainda não pago)')}
                  {paymentFilter === 'paid' && 'Total já pago nesta aba'}
                  {paymentFilter === 'all' && 'Total de todas as OS nesta aba (pagas e não pagas)'}
                </p>
              </>
            )}
            {selectMode && (
              <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">
                Marque as OS (concluídas ou a concluir) que vão entrar nesse pagamento.
              </p>
            )}

            <div className="flex flex-col gap-1.5 max-h-[45vh] overflow-y-auto pr-0.5 custom-scrollbar">
              {detailList.length === 0 && (
                <p className="text-[9px] font-bold text-slate-400 text-center py-3">Nenhuma OS aqui.</p>
              )}
              {detailList.map((os) => {
                const paid = isOsPaid(os);
                const reference = products.find(p => p.id === os.productId)?.reference;
                const checked = selectedIds.has(os.id);
                const Row = selectMode && !paid ? 'button' : 'div';
                return (
                  <Row
                    key={os.id}
                    type={selectMode && !paid ? 'button' : undefined}
                    onClick={selectMode && !paid ? () => toggleSelected(os.id) : undefined}
                    data-guide-anchor={selectMode && !paid ? 'fornecedores.osItemSelecionar' : undefined}
                    className={`w-full flex items-center gap-2 p-2.5 rounded-xl text-left ${selectMode && !paid ? 'active:scale-[0.98] transition-transform' : ''} ${checked ? (isDarkMode ? 'bg-indigo-950/60 ring-1 ring-indigo-500' : 'bg-indigo-50 ring-1 ring-indigo-300') : (isDarkMode ? 'bg-slate-900' : 'bg-slate-50')}`}
                  >
                    {selectMode && (
                      paid
                        ? <span className="shrink-0 text-slate-300 dark:text-slate-700"><Square size={16} /></span>
                        : <span className="shrink-0 text-indigo-500">{checked ? <CheckSquare size={16} /> : <Square size={16} />}</span>
                    )}
                    <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-[10px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          {reference ? `${reference} ` : ''}{os.productName}
                        </p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {os.osNumber} · Cor: {os.variationName || '—'} · {os.finishedAt ? format(os.finishedAt, 'dd/MM/yyyy') : format(os.createdAt, 'dd/MM/yyyy')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[11px] font-black transition-all ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''} ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                          R$ {(Number(os.totalValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className={`text-[7px] font-black uppercase tracking-widest ${os.status !== 'COMPLETED' ? (paid ? 'text-emerald-500' : 'text-amber-500') : paid ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {os.status !== 'COMPLETED' ? (paid ? 'Pago adiantado' : 'A concluir') : paid ? 'Pago' : 'Em aberto'}
                        </p>
                      </div>
                    </div>
                  </Row>
                );
              })}
            </div>

            {onPayProviderServiceOrders && !selectMode && (
              <button
                type="button"
                onClick={() => handlePay(selectedGroup)}
                disabled={selectedGroup.completedUnpaidOrders.length === 0}
                data-guide-anchor="fornecedores.pagar"
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
              >
                <Hammer size={12} /> Pagar Fornecedor
              </button>
            )}
            {onPayProviderServiceOrders && selectMode && (
              <button
                type="button"
                onClick={() => handlePaySelected(selectedGroup)}
                disabled={selectedIds.size === 0}
                data-guide-anchor="fornecedores.pagarSelecionadas"
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
              >
                <Hammer size={12} /> Pagar {selectedIds.size} selecionada{selectedIds.size === 1 ? '' : 's'}
                {selectedIds.size > 0 ? ` — R$ ${selectedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

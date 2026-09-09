import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ServiceOrder, Transaction, Person, Product, GeneralPurchaseItem } from '../types';
import { ArrowLeft, Factory, ChevronRight, CheckCircle2, Clock, Hammer, CheckSquare, Square, Download, X, FileText, Send } from 'lucide-react';
import { format } from 'date-fns';
import { generateId } from '../utils/id';
import { usePrivacyMode, PRIVACY_BLUR_CLASS } from '../contexts/PrivacyContext';
import Modal from '../components/Modal';
import { exportCompletedServiceOrders, CompletedOSExportItem } from '../utils/completedServiceOrderExport';

interface FornecedoresViewProps {
  isDarkMode: boolean;
  serviceOrders: ServiceOrder[];
  transactions: Transaction[];
  people: Person[];
  products: Product[];
  // Ausente/false = tela cheia de sempre (com "←" e onBack obrigatório). true = incorporado
  // dentro de outra tela (Financeiro, Dashboard) — some o cabeçalho de página, quem chama
  // fornece o título/contexto ao redor. Substituiu o antigo ProviderServiceOrdersCard.tsx
  // (removido), que duplicava esse mesmo agrupamento por fornecedor com números diferentes;
  // agora só existe esta implementação, embutida ou não.
  embedded?: boolean;
  onBack?: () => void;
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
  isDarkMode, serviceOrders, transactions, people, products, embedded = false, onBack, onPayProviderServiceOrders,
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
  // Agrupamento da listagem (fora do modo seleção, ver abaixo) — "model" soma todas as cores de
  // um mesmo modelo numa linha só; "modelColor" mantém as cores separadas, mas ainda soma OS
  // repetidas do mesmo modelo+cor (ex.: várias entregas do mesmo par ao longo do tempo).
  const [listGroupBy, setListGroupBy] = useState<'model' | 'modelColor'>('model');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Exportar OS deste fornecedor (PDF/JPG) — considera as selecionadas (se houver alguma
  // marcada) ou, senão, a lista visível na aba/filtro atual, mesmo padrão de precedência já
  // usado em "Pagar Selecionadas" acima.
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'jpg'>('pdf');
  const [exportGroupBy, setExportGroupBy] = useState<'none' | 'model' | 'modelColor'>('none');
  const [exportPreviewUrls, setExportPreviewUrls] = useState<string[]>([]);
  const [isExportPreviewLoading, setIsExportPreviewLoading] = useState(false);

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
    setExportOpen(false);
    setExportPreviewUrls([]);
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
  const applyPaymentFilter = (list: ServiceOrder[]) => paymentFilter === 'all' ? list : list.filter(os => isOsPaid(os) === (paymentFilter === 'paid'));
  const detailList = applyPaymentFilter(tabOrders);
  // Total do topo sempre soma exatamente o que a lista filtrada abaixo mostra — nunca mais um
  // total "a pagar" em cima de uma lista cheia de "Pago" (ver paymentFilter acima).
  const filteredTotal = detailList.reduce((s, os) => s + (Number(os.totalValue) || 0), 0);
  const selectedTotal = useMemo(() => {
    if (!selectedGroup) return 0;
    const allOrders = [...selectedGroup.completedOrders, ...selectedGroup.pendingOrders];
    return allOrders.filter(os => selectedIds.has(os.id)).reduce((s, os) => s + (Number(os.totalValue) || 0), 0);
  }, [selectedGroup, selectedIds]);

  // Mesma precedência de "Pagar"/"Pagar Selecionadas": se há algo marcado, exporta só isso;
  // senão, exporta o que está visível na aba/filtro atual.
  const exportOrders = useMemo(() => {
    if (!selectedGroup) return [];
    if (selectMode && selectedIds.size > 0) {
      const allOrders = [...selectedGroup.completedOrders, ...selectedGroup.pendingOrders];
      return allOrders.filter(os => selectedIds.has(os.id));
    }
    return detailList;
  }, [selectedGroup, selectMode, selectedIds, detailList]);

  const buildExportItems = (orders: ServiceOrder[]): CompletedOSExportItem[] => orders.map(os => ({
    osNumber: os.osNumber,
    sectorName: os.sectorName,
    providerName: os.providerName,
    customerName: '—',
    productName: `${products.find(p => p.id === os.productId)?.reference ? `${products.find(p => p.id === os.productId)?.reference} ` : ''}${os.productName}`,
    variationName: os.variationName,
    quantity: os.quantity,
    valuePerPair: os.valuePerPair,
    totalValue: os.totalValue,
    finishedAt: os.finishedAt || os.createdAt,
    paymentStatus: isOsPaid(os) ? 'COMPLETED' : 'PENDING',
  }));

  const handleExportPreview = async () => {
    if (!selectedGroup) return;
    setIsExportPreviewLoading(true);
    try {
      const result = await exportCompletedServiceOrders(
        { title: `OS — ${selectedGroup.providerName}`, periodLabel: `${exportOrders.length} ordens de serviço`, groupBy: exportGroupBy, items: buildExportItems(exportOrders) },
        exportFormat,
        `OS_${selectedGroup.providerName}_${Date.now()}`,
        true,
      );
      if (Array.isArray(result) && result.length > 0) setExportPreviewUrls(result);
    } finally {
      setIsExportPreviewLoading(false);
    }
  };

  const handleExportGenerate = async () => {
    if (!selectedGroup) return;
    const result = await exportCompletedServiceOrders(
      { title: `OS — ${selectedGroup.providerName}`, periodLabel: `${exportOrders.length} ordens de serviço`, groupBy: exportGroupBy, items: buildExportItems(exportOrders) },
      exportFormat,
      `OS_${selectedGroup.providerName}_${Date.now()}`,
    );
    if (result) {
      setExportOpen(false);
      setExportPreviewUrls([]);
    }
  };

  // Linha de uma OS na lista — extraída porque agora renderiza em dois lugares: a lista de
  // uma aba só (navegação normal) e as duas seções lado a lado (modo seleção, ver abaixo).
  const renderOsRow = (os: ServiceOrder) => {
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
  };

  // Junta OS repetidas do mesmo modelo (ou modelo+cor) numa linha só, somando quantidade e
  // valor — só usado fora do modo seleção (lá cada OS precisa continuar individual, é ela que
  // é marcada/paga). "Pago"/"Em aberto" na linha some quando o grupo mistura os dois status,
  // pra não passar a falsa impressão de que está tudo com o mesmo status.
  type OsGroupRow = {
    key: string;
    reference?: string;
    productName: string;
    variationName?: string;
    quantity: number;
    totalValue: number;
    count: number;
    allPaid: boolean;
    allOpen: boolean;
  };
  const groupDetailList = (list: ServiceOrder[]): OsGroupRow[] => {
    const map = new Map<string, OsGroupRow>();
    for (const os of list) {
      const reference = products.find(p => p.id === os.productId)?.reference;
      const key = listGroupBy === 'model' ? os.productId || os.productName : `${os.productId || os.productName}::${os.variationName || ''}`;
      const paid = isOsPaid(os);
      if (!map.has(key)) {
        map.set(key, {
          key, reference, productName: os.productName,
          variationName: listGroupBy === 'modelColor' ? os.variationName : undefined,
          quantity: 0, totalValue: 0, count: 0, allPaid: true, allOpen: true,
        });
      }
      const g = map.get(key)!;
      g.quantity += Number(os.quantity) || 0;
      g.totalValue += Number(os.totalValue) || 0;
      g.count += 1;
      if (!paid) g.allPaid = false;
      if (paid) g.allOpen = false;
    }
    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  };

  const renderOsGroupRow = (g: OsGroupRow) => (
    <div key={g.key} className={`w-full flex items-center gap-2 p-2.5 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-[10px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {g.reference ? `${g.reference} ` : ''}{g.productName}
          </p>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {g.variationName ? `Cor: ${g.variationName} · ` : ''}{g.count} {g.count === 1 ? 'OS' : 'OS'} · {g.quantity} {g.quantity === 1 ? 'par' : 'pares'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-[11px] font-black transition-all ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''} ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            R$ {g.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {(g.allPaid || g.allOpen) && (
            <p className={`text-[7px] font-black uppercase tracking-widest ${g.allPaid ? 'text-emerald-500' : 'text-rose-500'}`}>
              {g.allPaid ? 'Pago' : 'Em aberto'}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={embedded ? 'flex flex-col gap-6' : 'flex flex-col gap-6 pb-32'}>
      {embedded ? (
        <div>
          <h2 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Fornecedores</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ordens de Serviço por fornecedor</p>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <button onClick={onBack} data-guide-anchor="fornecedores.voltar" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors text-slate-400" title="Voltar" aria-label="Voltar">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Fornecedores</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ordens de Serviço por fornecedor</p>
          </div>
        </div>
      )}

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
            {/* Card agrupando os controles da tela (abas, exportar, seleção pra pagamento,
                agrupamento da lista e filtro de status) — antes ficavam soltos direto no corpo
                do modal, sem nenhuma separação visual do resto do conteúdo. */}
            <div className={`flex flex-col gap-3 p-3 rounded-2xl border ${isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
            <div className="flex items-center justify-between gap-2">
              {selectMode ? (
                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500">
                  Concluídas ({selectedGroup.completedOrders.length}) e a Concluir ({selectedGroup.pendingOrders.length}) juntas
                </p>
              ) : (
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
              )}
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                data-guide-anchor="fornecedores.exportar"
                title="Exportar"
                aria-label="Exportar"
                className={`p-2 rounded-xl shrink-0 transition-colors ${isDarkMode ? 'bg-slate-900 text-slate-300 hover:bg-slate-800' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                <Download size={14} className="text-emerald-500" />
              </button>
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

            {/* Toggle de agrupamento da lista — só faz sentido fora do modo seleção (lá cada OS
                precisa ficar individual, é ela que é marcada/paga). "Por Modelo" soma todas as
                cores de um modelo numa linha; "Por Modelo e Cor" mantém as cores separadas, só
                juntando OS repetidas do mesmo par. */}
            {!selectMode && (
              <button
                type="button"
                onClick={() => setListGroupBy(v => v === 'model' ? 'modelColor' : 'model')}
                data-guide-anchor="fornecedores.agruparToggle"
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}
              >
                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <Factory size={13} /> Agrupar por {listGroupBy === 'model' ? 'Modelo' : 'Modelo e Cor'}
                </span>
                <span className={`w-9 h-5 rounded-full relative shrink-0 transition-colors ${listGroupBy === 'modelColor' ? 'bg-indigo-600' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${listGroupBy === 'modelColor' ? 'translate-x-4' : ''}`} />
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

            <div className="flex flex-col gap-3 max-h-[45vh] overflow-y-auto pr-0.5 custom-scrollbar">
              {selectMode ? (
                // Modo seleção: os dois grupos aparecem juntos, cada um com seu próprio
                // cabeçalho — dá pra marcar OS Concluída e OS a Concluir na mesma leva sem
                // precisar trocar de aba (ver comentário no estado `selectMode` acima).
                ([
                  { key: 'completed', label: 'OS Concluídas', accent: 'text-emerald-500', list: applyPaymentFilter(selectedGroup.completedOrders) },
                  { key: 'pending', label: 'OS a Concluir', accent: 'text-amber-500', list: applyPaymentFilter(selectedGroup.pendingOrders) },
                ] as const).map(section => section.list.length > 0 && (
                  <div key={section.key} className="flex flex-col gap-1.5">
                    <p className={`text-[9px] font-black uppercase tracking-widest px-1 ${section.accent}`}>{section.label} ({section.list.length})</p>
                    {section.list.map(os => renderOsRow(os))}
                  </div>
                ))
              ) : (
                groupDetailList(detailList).map(g => renderOsGroupRow(g))
              )}
              {selectMode
                ? applyPaymentFilter(selectedGroup.completedOrders).length === 0 && applyPaymentFilter(selectedGroup.pendingOrders).length === 0 && (
                  <p className="text-[9px] font-bold text-slate-400 text-center py-3">Nenhuma OS aqui.</p>
                )
                : detailList.length === 0 && (
                  <p className="text-[9px] font-bold text-slate-400 text-center py-3">Nenhuma OS aqui.</p>
                )}
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

      {exportOpen && selectedGroup && createPortal(
        <div className="fixed inset-0 z-[96600] flex items-center justify-center p-4" onClick={() => { setExportOpen(false); setExportPreviewUrls([]); }}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className={`relative w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-[2rem] shadow-2xl border p-5 flex flex-col gap-4 custom-scrollbar ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                  {exportFormat === 'pdf' ? <FileText size={20} strokeWidth={2.5} /> : <Send size={20} strokeWidth={2.5} className="rotate-45" />}
                </div>
                <div>
                  <span className="text-[12px] font-black uppercase tracking-widest block leading-none">Exportar OS</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1 block">{selectedGroup.providerName}</span>
                </div>
              </div>
              <button type="button" title="Fechar" onClick={() => { setExportOpen(false); setExportPreviewUrls([]); }}
                data-guide-anchor="fornecedores.exportarFechar"
                className={`p-1.5 rounded-lg shrink-0 ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                <X size={16} />
              </button>
            </div>

            <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
              {selectMode && selectedIds.size > 0
                ? `Considera as ${exportOrders.length} OS selecionadas.`
                : `Considera as ${exportOrders.length} OS visíveis na aba/filtro atual.`}
            </p>

            {exportPreviewUrls.length > 0 && (
              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl p-3 bg-white dark:bg-slate-800">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Pré-visualização</span>
                  <button type="button" onClick={() => setExportPreviewUrls([])} className="text-[9px] font-black uppercase tracking-widest text-white bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all px-3 py-1.5 rounded-full shadow-sm">Fechar Preview</button>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden shadow-inner max-h-[50vh] overflow-y-auto">
                  {exportFormat === 'pdf' ? (
                    <iframe title="Pré-visualização do PDF" src={exportPreviewUrls[0] + '#toolbar=0'} className="w-full h-[420px]" />
                  ) : (
                    <img src={exportPreviewUrls[0]} alt="Pré-visualização do JPG" className="w-full h-auto" />
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Formato</p>
              <div className="flex gap-1.5">
                {(['pdf', 'jpg'] as const).map(fmt => (
                  <button type="button" key={fmt} onClick={() => { setExportFormat(fmt); setExportPreviewUrls([]); }}
                    data-guide-anchor="fornecedores.exportarFormato"
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${exportFormat === fmt ? 'bg-emerald-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Modo</p>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => { setExportGroupBy('none'); setExportPreviewUrls([]); }}
                  data-guide-anchor="fornecedores.exportarModo"
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${exportGroupBy === 'none' ? 'bg-emerald-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  Lista
                </button>
                <button type="button" onClick={() => { setExportGroupBy('model'); setExportPreviewUrls([]); }}
                  data-guide-anchor="fornecedores.exportarModo"
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${exportGroupBy === 'model' ? 'bg-emerald-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  Por Modelo
                </button>
                <button type="button" onClick={() => { setExportGroupBy('modelColor'); setExportPreviewUrls([]); }}
                  data-guide-anchor="fornecedores.exportarModo"
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${exportGroupBy === 'modelColor' ? 'bg-emerald-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  Modelo e Cor
                </button>
              </div>
              {exportGroupBy === 'model' && (
                <p className="text-[9px] font-bold text-slate-400 mt-1.5 leading-relaxed">Agrupa por modelo, somando todas as cores numa linha só.</p>
              )}
              {exportGroupBy === 'modelColor' && (
                <p className="text-[9px] font-bold text-slate-400 mt-1.5 leading-relaxed">Agrupa por modelo e cor separadamente, somando quantidade e valor de cada um.</p>
              )}
            </div>

            <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className={`flex items-center gap-2 px-3 py-3 ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <Send size={13} className="text-cyan-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">Opções de Compartilhamento</span>
              </div>
              <div className={`p-3 flex flex-col gap-2.5 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                <button type="button" onClick={handleExportPreview} disabled={exportOrders.length === 0 || isExportPreviewLoading}
                  data-guide-anchor="fornecedores.exportarVisualizar"
                  className="w-full py-3 text-white rounded-xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">
                  {isExportPreviewLoading ? 'Carregando...' : 'Visualizar Arquivo'}
                </button>
                <button type="button" onClick={handleExportGenerate} disabled={exportOrders.length === 0}
                  data-guide-anchor="fornecedores.exportarGerar"
                  className={`w-full py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${exportFormat === 'pdf' ? 'bg-rose-500 shadow-rose-500/20' : 'bg-emerald-600 shadow-emerald-500/20'} text-white`}>
                  <Download size={14} /> Gerar {exportFormat.toUpperCase()} ({exportOrders.length} OS)
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

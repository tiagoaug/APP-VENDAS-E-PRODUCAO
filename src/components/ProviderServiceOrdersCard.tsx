import { useState, useMemo, useRef } from 'react';
import { ServiceOrder, Transaction, Person, Product, CompanyProfile, GeneralPurchaseItem } from '../types';
import {
  ChevronDown, ChevronRight, Search, X, Calendar, Hash, Layers, Factory, Clipboard, Hammer,
  Upload, FileDown, Image as ImageIcon, Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPeriodRange, OverviewPeriodType, STATS_PERIOD_LABELS } from '../utils/businessOverview';
import { exportProviderOS } from '../utils/serviceOrderProviderExport';
import { generateId } from '../utils/id';
import { isGallerySaverPlatform } from '../lib/gallerySaver';
import { toast } from '../utils/toast';
import { usePrivacyMode, PRIVACY_BLUR_CLASS } from '../contexts/PrivacyContext';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { firebaseService } from '../services/firebaseService';

// Card "Ordens de Serviço a Fornecedores" — extraído de FinancialView.tsx pra ser reutilizado
// também no Dashboard (ver CommissionToSellersCard.tsx, extraído junto no mesmo pedido). Cada
// instância monta seu próprio estado (expandido/período/fornecedor selecionado/popups) — abrir
// esse card no Dashboard não afeta a instância de Financeiro, e vice-versa.
interface ProviderServiceOrdersCardProps {
  isDarkMode: boolean;
  serviceOrders: ServiceOrder[];
  transactions: Transaction[];
  people: Person[];
  products: Product[];
  companyProfile?: CompanyProfile | null;
  onPayProviderServiceOrders?: (params: {
    supplierId?: string;
    initialGeneralItems: GeneralPurchaseItem[];
    initialDescription: string;
  }) => void;
}

type ProviderOSGroup = {
  key: string;
  providerName: string;
  providerId?: string;
  openBalance: number;
  openOrders: ServiceOrder[];
  completedInPeriod: ServiceOrder[];
  completedInPeriodTotal: number;
  pendingCount: number;
};

type ModeloGroup = {
  key: string;
  reference?: string;
  productName: string;
  osNumbers: string[];
  colorTotals: { color: string; qty: number }[];
  totalQuantity: number;
  totalValue: number;
};

export default function ProviderServiceOrdersCard({
  isDarkMode, serviceOrders, transactions, people, products, companyProfile, onPayProviderServiceOrders,
}: ProviderServiceOrdersCardProps) {
  const hidePrivacy = usePrivacyMode();

  // Ordens de Serviço a Fornecedores — agrupa TODA ServiceOrder por providerName (mesmo estilo
  // do card de Comissão a Vendedores), mas com uma diferença importante: o Total em Aberto de
  // cada fornecedor é SEMPRE o acumulado de toda OS concluída ainda sem pagamento (usa o vínculo
  // real ServiceOrder.transactionId → Transaction.status, ver isOsPaid), não fica preso ao
  // período selecionado — o período aqui só filtra a lista "concluídas no período" pra
  // conferência, igual o resto da tela já faz com outras métricas. Ao contrário da Comissão (sem
  // trava contra pagar a mesma venda duas vezes), aqui cada item enviado pra Compras carrega o
  // id da OS de origem (ver handlePayProvider/GeneralPurchaseItem.serviceOrderId abaixo) — assim
  // que a Compra é totalmente paga, o saldo fecha sozinho.
  // `paidNaoContabil` cobre a Compra "Não Contábil" (generateTransaction === false) — nunca gera
  // Transaction (não entra no fluxo de contas a pagar), então não tem transactionId pra checar;
  // ver a gravação em App.tsx (branch else do salvamento de Compra).
  const isOsPaid = (os: ServiceOrder) =>
    (!!os.transactionId && transactions.find(t => t.id === os.transactionId)?.status === 'COMPLETED') || !!os.paidNaoContabil;

  const [isProviderOSExpanded, setIsProviderOSExpanded] = useState(false);
  const [providerOSPeriodType, setProviderOSPeriodType] = useState<OverviewPeriodType>('MONTH');
  const [providerOSPeriodDate, setProviderOSPeriodDate] = useState(() => format(new Date(), 'yyyy-MM'));
  const providerOSDateInputRef = useRef<HTMLInputElement>(null);
  const openProviderOSMonthPicker = () => {
    const el = providerOSDateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el) return;
    try { el.showPicker ? el.showPicker() : el.focus(); } catch { el.focus(); }
  };
  const [expandedProviderKey, setExpandedProviderKey] = useState<string | null>(null);
  const [providerOSSearch, setProviderOSSearch] = useState('');
  const [providerDetailTab, setProviderDetailTab] = useState<Record<string, 'open' | 'period'>>({});
  // "Por OS" (lista de sempre) vs "Por Modelo" (agrupa a mesma lista por referência/produto,
  // somando cor×quantidade e valor — ver groupServiceOrdersByModelo). Global (não por
  // fornecedor) — mostrado uma vez, abaixo do seletor de período.
  const [providerDetailGroupMode, setProviderDetailGroupMode] = useState<'os' | 'modelo'>('os');
  // Popup pequeno (âncora no botão "Copiar") oferecendo as 2 variantes de texto — ver
  // handleCopyProviderOSWithNumbers/handleCopyProviderOSGrouped.
  const [copyPopupKey, setCopyPopupKey] = useState<string | null>(null);
  // Popup de exportação (formato PDF/JPG, divisão de página só no JPG, observações, salvar na
  // galeria) — abre com handleOpenExportPopup, confirma com handleConfirmExport.
  const [exportPopupGroup, setExportPopupGroup] = useState<ProviderOSGroup | null>(null);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'jpg'>('pdf');
  // "Por OS" (uma linha por OS, como sempre) vs "Por Modelo" (agrupa por referência, somando
  // cor×quantidade e valor — mesma lógica de groupServiceOrdersByModelo/providerDetailGroupMode).
  const [exportGroupMode, setExportGroupMode] = useState<'os' | 'modelo'>('os');
  const [exportOsPerPage, setExportOsPerPage] = useState(0); // 0 = tudo numa página só
  const [exportObservations, setExportObservations] = useState('');
  const [exportSaveGallery, setExportSaveGallery] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // Clicar numa OS ainda em aberto (dentro do popup de detalhe) abre esta confirmação — marca
  // ela como fechada sem passar pela Compra/Financeiro (mesmo campo paidNaoContabil já usado
  // pra Compra "Não Contábil", ver App.tsx). Útil pra OS de valor zerado ou trabalho que não
  // vai gerar pagamento nenhum, sem precisar criar uma Compra só pra isso.
  const [osToSettle, setOsToSettle] = useState<ServiceOrder | null>(null);
  const [isSettlingOs, setIsSettlingOs] = useState(false);

  const handleConfirmSettleOs = async () => {
    if (!osToSettle || isSettlingOs) return;
    setIsSettlingOs(true);
    try {
      await firebaseService.updateDocument('serviceOrders', osToSettle.id, { paidNaoContabil: true, updatedAt: Date.now() });
      toast.show('OS marcada como concluída!');
      setOsToSettle(null);
    } catch (err: any) {
      toast.show('Erro ao marcar OS: ' + (err?.message || err));
    } finally {
      setIsSettlingOs(false);
    }
  };

  const providerOSGroups = useMemo<ProviderOSGroup[]>(() => {
    if (serviceOrders.length === 0) return [];
    const { start, end } = getPeriodRange(providerOSPeriodType, providerOSPeriodDate);
    const map = new Map<string, ProviderOSGroup>();
    for (const os of serviceOrders) {
      const key = (os.providerName || '').trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) {
        const matchedPerson = os.providerId
          ? people.find(p => p.id === os.providerId)
          : people.find(p => (p.isServiceProvider || p.isSupplier) && p.name.trim().toLowerCase() === key);
        map.set(key, {
          key, providerName: os.providerName, providerId: os.providerId || matchedPerson?.id,
          openBalance: 0, openOrders: [], completedInPeriod: [], completedInPeriodTotal: 0, pendingCount: 0,
        });
      }
      const group = map.get(key)!;
      if (os.status === 'COMPLETED') {
        if (!isOsPaid(os)) {
          group.openBalance += Number(os.totalValue) || 0;
          group.openOrders.push(os);
        }
        if (os.finishedAt && os.finishedAt >= start && os.finishedAt <= end) {
          group.completedInPeriod.push(os);
          group.completedInPeriodTotal += Number(os.totalValue) || 0;
        }
      } else {
        group.pendingCount++;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.openBalance - a.openBalance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceOrders, transactions, people, providerOSPeriodType, providerOSPeriodDate]);

  const totalProviderOSOpenBalance = providerOSGroups.reduce((s, g) => s + g.openBalance, 0);
  const providerOSPeriodLabel = useMemo(
    () => format(new Date(providerOSPeriodDate + '-01T12:00:00'), 'MMMM/yyyy', { locale: ptBR }),
    [providerOSPeriodDate],
  );

  // Monta a descrição de uma OS pro item da Compra — sempre com o que foi feito (referência,
  // produto, cor, quantidade, setor, observações), mesmo pras "não contábeis" (valor zerado): o
  // fornecedor precisa ver o trabalho listado, não só um valor sem explicação.
  const describeServiceOrderItem = (os: ServiceOrder): string => {
    const reference = products.find(p => p.id === os.productId)?.reference;
    const productLabel = `${reference ? `${reference} ` : ''}${os.productName}${os.variationName ? ` (${os.variationName})` : ''}`;
    const parts = [os.osNumber, productLabel, `${os.quantity} par${os.quantity === 1 ? '' : 'es'}`, os.sectorName];
    const desc = parts.filter(Boolean).join(' — ');
    return os.notes ? `${desc}: ${os.notes}` : desc;
  };

  const handlePayProvider = (group: ProviderOSGroup) => {
    if (group.openOrders.length === 0) { toast.show('Nenhuma OS em aberto pra esse fornecedor.'); return; }
    if (!onPayProviderServiceOrders) return;
    // Todas as OS em aberto viram item — inclusive as de valor zerado ("não contábeis"), que
    // aparecem como R$ 0,00 mas sempre com a descrição do que foi feito (ver
    // describeServiceOrderItem acima).
    const initialGeneralItems: GeneralPurchaseItem[] = group.openOrders.map(os => ({
      id: generateId(),
      description: describeServiceOrderItem(os),
      quantity: 1,
      value: Number(os.totalValue) || 0,
      kind: 'general',
      serviceOrderId: os.id,
    }));
    const initialDescription = `Pagamento a Fornecedor — ${group.providerName} (${group.openOrders.length} OS)`;
    const matchedSupplier = group.providerId
      ? people.find(p => p.id === group.providerId)
      : people.find(p => (p.isServiceProvider || p.isSupplier) && p.name.trim().toLowerCase() === group.providerName.trim().toLowerCase());
    // Fecha o popup de detalhe ANTES de navegar — senão o Modal (portal fixo, z-index alto)
    // continua renderizado por cima da tela de Compra que abre em seguida.
    setExpandedProviderKey(null);
    onPayProviderServiceOrders({ supplierId: matchedSupplier?.id, initialGeneralItems, initialDescription });
    if (!matchedSupplier) {
      toast.show('Não achei um fornecedor cadastrado com esse nome — escolha ou cadastre um na tela de Compra que abriu.');
    }
  };

  // Agrupa uma lista de OS por referência/produto — soma quantidade por cor e valor total. Usado
  // tanto na visão "Por Modelo" do detalhe do fornecedor quanto na variante agrupada de Copiar.
  const groupServiceOrdersByModelo = (orders: ServiceOrder[]): ModeloGroup[] => {
    const map = new Map<string, ModeloGroup>();
    orders.forEach(os => {
      const reference = products.find(p => p.id === os.productId)?.reference;
      const key = (reference || os.productName || os.productId || os.id).trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, { key, reference, productName: os.productName, osNumbers: [], colorTotals: [], totalQuantity: 0, totalValue: 0 });
      }
      const g = map.get(key)!;
      g.osNumbers.push(os.osNumber);
      g.totalQuantity += Number(os.quantity) || 0;
      g.totalValue += Number(os.totalValue) || 0;
      const color = os.variationName || '—';
      const existingColor = g.colorTotals.find(c => c.color === color);
      if (existingColor) existingColor.qty += Number(os.quantity) || 0;
      else g.colorTotals.push({ color, qty: Number(os.quantity) || 0 });
    });
    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  };

  // Variante 1 de Copiar — uma linha por OS, enxuta (referência, cor, quantidade, valor), com o
  // número da OS. Copia sempre as OS em aberto (mesmo escopo de handlePayProvider), independente
  // da aba "No período" que só serve pra conferência visual.
  const handleCopyProviderOSWithNumbers = (group: ProviderOSGroup) => {
    const lines = [
      `Ordens de Serviço — ${group.providerName} (${providerOSPeriodLabel})`,
      ...group.openOrders.map(os => {
        const reference = products.find(p => p.id === os.productId)?.reference;
        const ref = reference ? `${reference} ` : '';
        return `${os.osNumber} · ${ref}${os.productName} · ${os.variationName || '—'} · ${os.quantity} par${os.quantity === 1 ? '' : 'es'} — R$ ${(Number(os.totalValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      }),
      `Total em Aberto: R$ ${group.openBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast.show('Lista copiada!');
    setCopyPopupKey(null);
  };

  // Variante 2 de Copiar — sem número de OS, agrupada por referência+cor (ver
  // groupServiceOrdersByModelo), mostrando o total de pares e o valor somado de cada modelo.
  const handleCopyProviderOSGrouped = (group: ProviderOSGroup) => {
    const modelos = groupServiceOrdersByModelo(group.openOrders);
    const lines = [
      `Ordens de Serviço — ${group.providerName} (${providerOSPeriodLabel})`,
      ...modelos.map(m => {
        const ref = m.reference ? `${m.reference} ` : '';
        const colors = m.colorTotals.map(c => `${c.color}: ${c.qty}`).join(' · ');
        return `${ref}${m.productName} — ${colors} — ${m.totalQuantity} par${m.totalQuantity === 1 ? '' : 'es'} — R$ ${m.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      }),
      `Total em Aberto: R$ ${group.openBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast.show('Lista copiada!');
    setCopyPopupKey(null);
  };

  const handleOpenExportPopup = (group: ProviderOSGroup) => {
    setExportFormat('pdf');
    // Abre já com o mesmo modo de agrupamento usado no filtro global (ver
    // providerDetailGroupMode), mas continua ajustável aqui dentro sem afetar o filtro.
    setExportGroupMode(providerDetailGroupMode);
    setExportOsPerPage(0);
    setExportObservations('');
    setExportSaveGallery(false);
    setExportPopupGroup(group);
  };

  const handleConfirmExport = async () => {
    if (!exportPopupGroup) return;
    setIsExporting(true);
    try {
      const modelos = exportGroupMode === 'modelo' ? groupServiceOrdersByModelo(exportPopupGroup.openOrders) : [];
      await exportProviderOS({
        providerName: exportPopupGroup.providerName,
        periodLabel: providerOSPeriodLabel,
        orders: exportPopupGroup.openOrders.map(os => ({
          osNumber: os.osNumber,
          reference: products.find(p => p.id === os.productId)?.reference,
          productName: os.productName,
          variationName: os.variationName,
          quantity: os.quantity,
          total: Number(os.totalValue) || 0,
          paid: false,
        })),
        groupBy: exportGroupMode,
        groupedRows: exportGroupMode === 'modelo' ? modelos.map(m => ({
          reference: m.reference,
          productName: m.productName,
          colorSummary: m.colorTotals.map(c => `${c.color}: ${c.qty}`).join(' · '),
          totalQuantity: m.totalQuantity,
          total: m.totalValue,
          osNumbers: m.osNumbers,
        })) : undefined,
        openBalance: exportPopupGroup.openBalance,
        companyProfile,
        observations: exportObservations.trim() || undefined,
      }, exportFormat, exportFormat === 'jpg' ? { osPerPage: exportOsPerPage, saveToGallery: exportSaveGallery } : undefined);
      setExportPopupGroup(null);
    } finally {
      setIsExporting(false);
    }
  };

  if (providerOSGroups.length === 0) return null;

  return (
    <>
      <div className={`rounded-[2.5rem] border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <button
          type="button"
          onClick={() => setIsProviderOSExpanded(v => !v)}
          className="w-full flex items-center justify-between gap-3 p-6"
        >
          <div className="text-left min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ordens de Serviço a Fornecedores</p>
            <p className={`text-2xl font-black tracking-tighter mt-1 transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
              R$ {totalProviderOSOpenBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${isProviderOSExpanded ? 'rotate-180' : ''}`} />
        </button>
        {isProviderOSExpanded && (
          <div className={`flex flex-col gap-4 px-6 pb-6 border-t pt-4 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            {/* Busca por fornecedor/prestador — filtra só a lista de fornecedores abaixo,
                não muda nenhum total. */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={providerOSSearch}
                onChange={(e) => setProviderOSSearch(e.target.value)}
                placeholder="Buscar fornecedor/prestador..."
                className={`flex-1 min-w-0 border-none bg-transparent outline-none text-xs font-bold ${isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'}`}
              />
              {providerOSSearch && (
                <button type="button" onClick={() => setProviderOSSearch('')} className="text-slate-400 hover:text-slate-600 shrink-0">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Período — só filtra a lista "concluídas no período" abaixo, não mexe no
                Total em Aberto (esse é sempre acumulado, ver providerOSGroups). */}
            <div className="flex flex-col gap-1.5">
              <div className={`flex gap-0.5 p-0.5 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                {(Object.keys(STATS_PERIOD_LABELS) as OverviewPeriodType[]).map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setProviderOSPeriodType(pt)}
                    className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                      providerOSPeriodType === pt ? 'bg-indigo-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    {STATS_PERIOD_LABELS[pt]}
                  </button>
                ))}
              </div>
              <div
                onClick={openProviderOSMonthPicker}
                className={`w-full flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              >
                <Calendar size={12} className="text-indigo-500 shrink-0" />
                <input
                  ref={providerOSDateInputRef}
                  type="month"
                  value={providerOSPeriodDate}
                  onChange={(e) => setProviderOSPeriodDate(e.target.value)}
                  className={`flex-1 min-w-0 border-none bg-transparent px-0 py-0 text-[10px] font-black outline-none pointer-events-none ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}
                />
              </div>
            </div>

            {/* "Por OS" (lista de sempre) vs "Por Modelo" (agrupa por referência, somando
                cor×quantidade e valor — ver groupServiceOrdersByModelo). Global — o mesmo
                controle também aparece dentro do popup de cada fornecedor, sempre em sincronia. */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">Agrupar</span>
              <div className={`flex gap-0.5 p-0.5 rounded-lg ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                <button
                  type="button"
                  onClick={() => setProviderDetailGroupMode('os')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${providerDetailGroupMode === 'os' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                >
                  <Hash size={10} /> Por OS
                </button>
                <button
                  type="button"
                  onClick={() => setProviderDetailGroupMode('modelo')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${providerDetailGroupMode === 'modelo' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                >
                  <Layers size={10} /> Por Modelo
                </button>
              </div>
            </div>

            {(() => {
              const filteredProviderOSGroups = providerOSGroups.filter(g => g.providerName.toLowerCase().includes(providerOSSearch.trim().toLowerCase()));
              if (filteredProviderOSGroups.length === 0) {
                return <p className="text-[10px] font-bold text-slate-400 text-center py-4">Nenhum fornecedor encontrado.</p>;
              }
              // Espaçamento maior entre cards de fornecedor (gap-6, separado do gap-4 dos
              // controles acima) + efeito "3D" (sombra elevada + borda inferior grossa,
              // mesmo recurso de miniCardCls em LabelPrintStudioView.tsx) pra cada card se
              // destacar como um bloco próprio, em vez de se misturar com o de baixo.
              return (
                <div className="flex flex-col gap-6">
                {filteredProviderOSGroups.map((group) => (
                <div key={group.key} className={`rounded-2xl overflow-hidden border-b-[3px] transition-shadow ${isDarkMode ? 'bg-gradient-to-b from-slate-800 to-slate-800/80 border-slate-950 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.5)]' : 'bg-gradient-to-b from-white to-slate-50 border-slate-200 shadow-[0_6px_16px_-6px_rgba(15,23,42,0.18)]'}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedProviderKey(group.key)}
                    className="w-full flex items-center justify-between gap-3 p-3.5 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${isDarkMode ? 'bg-slate-700 text-indigo-400' : 'bg-white text-indigo-500'}`}>
                        <Factory size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{group.providerName}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {group.completedInPeriod.length} conc. no período · {group.pendingCount} a concluir
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className={`text-sm font-black transition-all ${isDarkMode ? 'text-amber-400' : 'text-amber-600'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                        R$ {group.openBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <ChevronRight size={14} className="text-slate-400" />
                    </div>
                  </button>
                </div>
                ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Popup centralizado com o detalhe de um fornecedor/prestador — abre ao clicar no card
          da lista (em vez de expandir inline), pra ter mais espaço/melhor visualização. */}
      {(() => {
        const selectedGroup = providerOSGroups.find(g => g.key === expandedProviderKey) || null;
        if (!selectedGroup) return null;
        const detailTab = providerDetailTab[selectedGroup.key] || 'open';
        const detailList = detailTab === 'open' ? selectedGroup.openOrders : selectedGroup.completedInPeriod;
        const modeloGroups = providerDetailGroupMode === 'modelo' ? groupServiceOrdersByModelo(detailList) : [];
        return (
          <Modal isOpen={!!expandedProviderKey} onClose={() => setExpandedProviderKey(null)} title={selectedGroup.providerName} icon={<Factory size={20} />} maxWidth="max-w-lg" zIndex={96500}>
            <div className="flex flex-col gap-3">
              <p className={`text-2xl font-black tracking-tighter transition-all ${isDarkMode ? 'text-white' : 'text-slate-900'} ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''}`}>
                R$ {selectedGroup.openBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest -mt-2">
                {selectedGroup.completedInPeriod.length} conc. no período · {selectedGroup.pendingCount} a concluir
              </p>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className={`flex gap-0.5 p-0.5 rounded-xl w-fit ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                  <button
                    type="button"
                    onClick={() => setProviderDetailTab(prev => ({ ...prev, [selectedGroup.key]: 'open' }))}
                    className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${detailTab === 'open' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                  >
                    Em aberto ({selectedGroup.openOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setProviderDetailTab(prev => ({ ...prev, [selectedGroup.key]: 'period' }))}
                    className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${detailTab === 'period' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                  >
                    No período ({selectedGroup.completedInPeriod.length})
                  </button>
                </div>
                {/* Mesmo controle "Por OS / Por Modelo" que aparece fora do popup, na área de
                    filtros — global, os dois lugares sempre ficam em sincronia. */}
                <div className={`flex gap-0.5 p-0.5 rounded-xl w-fit ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                  <button
                    type="button"
                    title="Por OS"
                    onClick={() => setProviderDetailGroupMode('os')}
                    className={`p-1.5 rounded-lg transition-all ${providerDetailGroupMode === 'os' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                  >
                    <Hash size={11} />
                  </button>
                  <button
                    type="button"
                    title="Por Modelo"
                    onClick={() => setProviderDetailGroupMode('modelo')}
                    className={`p-1.5 rounded-lg transition-all ${providerDetailGroupMode === 'modelo' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                  >
                    <Layers size={11} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 max-h-[45vh] overflow-y-auto pr-0.5 custom-scrollbar">
                {providerDetailGroupMode === 'os' ? (
                  <>
                    {detailList.length === 0 && (
                      <p className="text-[9px] font-bold text-slate-400 text-center py-3">Nenhuma OS aqui.</p>
                    )}
                    {detailList.map((os) => {
                      const paid = isOsPaid(os);
                      const reference = products.find(p => p.id === os.productId)?.reference;
                      // Só faz sentido "marcar como concluído/fechar sem pagamento" numa OS que
                      // já terminou a produção e ainda está em aberto — as outras (a concluir,
                      // ou já pagas) ficam só como exibição.
                      const canSettle = os.status === 'COMPLETED' && !paid;
                      const Row = canSettle ? 'button' : 'div';
                      return (
                        <Row
                          key={os.id}
                          type={canSettle ? 'button' : undefined}
                          onClick={canSettle ? () => setOsToSettle(os) : undefined}
                          className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl text-left ${canSettle ? 'active:scale-[0.98] transition-transform' : ''} ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}
                        >
                          <div className="min-w-0">
                            <p className={`text-[10px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {os.osNumber} · {reference ? `${reference} ` : ''}{os.productName}
                            </p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                              {os.sectorName} · Cor: {os.variationName || '—'} · Qtd: {os.quantity} · {os.finishedAt ? format(os.finishedAt, 'dd/MM/yyyy') : 'em produção'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">Total</p>
                            <p className={`text-[11px] font-black ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''} ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                              R$ {(Number(os.totalValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className={`text-[7px] font-black uppercase tracking-widest ${os.status !== 'COMPLETED' ? 'text-amber-500' : paid ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {os.status !== 'COMPLETED' ? 'A concluir' : paid ? 'Pago' : 'Em aberto'}
                            </p>
                          </div>
                        </Row>
                      );
                    })}
                  </>
                ) : (
                  <>
                    {modeloGroups.length === 0 && (
                      <p className="text-[9px] font-bold text-slate-400 text-center py-3">Nenhuma OS aqui.</p>
                    )}
                    {modeloGroups.map((m) => (
                      <div key={m.key} className={`flex flex-col gap-1 p-2.5 rounded-xl text-left ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-[10px] font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {m.reference ? `${m.reference} ` : ''}{m.productName}
                          </p>
                          <p className={`text-[11px] font-black shrink-0 ${hidePrivacy ? PRIVACY_BLUR_CLASS : ''} ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                            R$ {m.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                          {m.colorTotals.map(c => `${c.color}: ${c.qty}`).join(' · ')} · Total: {m.totalQuantity} par{m.totalQuantity === 1 ? '' : 'es'}
                        </p>
                        <p className="text-[8px] font-bold text-slate-400 truncate">
                          OS: {m.osNumbers.join(', ')}
                        </p>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => setCopyPopupKey(v => v === selectedGroup.key ? null : selectedGroup.key)}
                    className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                  >
                    <Clipboard size={12} /> Copiar
                  </button>
                  {copyPopupKey === selectedGroup.key && (
                    <>
                      <div className="fixed inset-0 z-[97998]" onClick={() => setCopyPopupKey(null)} />
                      <div className={`absolute z-[97999] bottom-full mb-1.5 left-0 right-0 rounded-xl border shadow-xl overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <button
                          type="button"
                          onClick={() => handleCopyProviderOSWithNumbers(selectedGroup)}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                          <Hash size={12} className="text-indigo-500 shrink-0" /> Com número de OS
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyProviderOSGrouped(selectedGroup)}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-[9px] font-black uppercase tracking-widest border-t ${isDarkMode ? 'text-slate-200 hover:bg-slate-700 border-slate-700' : 'text-slate-700 hover:bg-slate-50 border-slate-100'}`}
                        >
                          <Layers size={12} className="text-violet-500 shrink-0" /> Sem OS, por cor/referência
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {onPayProviderServiceOrders && (
                  <button
                    type="button"
                    onClick={() => handlePayProvider(selectedGroup)}
                    disabled={selectedGroup.openOrders.length === 0}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
                  >
                    <Hammer size={12} /> Pagar Fornecedor
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleOpenExportPopup(selectedGroup)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
              >
                <Upload size={12} /> Exportar
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* Popup de exportação de Ordens de Serviço a Fornecedores — formato PDF/JPG, divisor de
          página (só JPG), observações e salvar na galeria (só JPG). */}
      <Modal isOpen={!!exportPopupGroup} onClose={() => setExportPopupGroup(null)} title="Exportar Ordens de Serviço" icon={<Upload size={20} />} maxWidth="max-w-sm" zIndex={97000}>
        {exportPopupGroup && (() => {
          const exportModelos = exportGroupMode === 'modelo' ? groupServiceOrdersByModelo(exportPopupGroup.openOrders) : [];
          const exportRowCount = exportGroupMode === 'modelo' ? exportModelos.length : exportPopupGroup.openOrders.length;
          return (
          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest -mt-2">
              {exportPopupGroup.providerName} · {exportPopupGroup.openOrders.length} OS em aberto
            </p>

            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Formato</span>
              <div className={`flex gap-0.5 p-0.5 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                <button
                  type="button"
                  onClick={() => setExportFormat('pdf')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${exportFormat === 'pdf' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                >
                  <FileDown size={13} /> PDF
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('jpg')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${exportFormat === 'jpg' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                >
                  <ImageIcon size={13} /> JPG
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Agrupar (PDF e JPG)</span>
              <div className={`flex gap-0.5 p-0.5 rounded-xl ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                <button
                  type="button"
                  onClick={() => setExportGroupMode('os')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${exportGroupMode === 'os' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                >
                  <Hash size={13} /> Por OS
                </button>
                <button
                  type="button"
                  onClick={() => setExportGroupMode('modelo')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${exportGroupMode === 'modelo' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                >
                  <Layers size={13} /> Por Modelo
                </button>
              </div>
            </div>

            {exportFormat === 'jpg' && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  {exportGroupMode === 'modelo' ? 'Modelos' : 'OS'} por página (0 = tudo numa imagem só)
                </span>
                <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <button
                    type="button"
                    onClick={() => setExportOsPerPage(v => Math.max(0, v - 1))}
                    className={`p-1.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 shadow-sm'}`}
                  >
                    <ChevronDown size={12} className="rotate-90" />
                  </button>
                  <span className="text-xs font-black w-16 text-center">{exportOsPerPage === 0 ? 'Tudo' : exportOsPerPage}</span>
                  <button
                    type="button"
                    onClick={() => setExportOsPerPage(v => Math.min(exportRowCount, v + 1))}
                    className={`p-1.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-600 shadow-sm'}`}
                  >
                    <ChevronDown size={12} className="-rotate-90" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Observações (opcional)</span>
              <textarea
                value={exportObservations}
                onChange={(e) => setExportObservations(e.target.value)}
                rows={3}
                placeholder="Alguma observação pro documento..."
                className={`w-full px-3 py-2.5 rounded-xl border text-xs font-bold outline-none resize-none ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
              />
            </div>

            {exportFormat === 'jpg' && isGallerySaverPlatform() && (
              <label className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-bold cursor-pointer ${isDarkMode ? 'bg-slate-900 text-slate-300 border border-slate-800' : 'bg-white text-slate-600 border border-slate-100 shadow-sm'}`}>
                <input type="checkbox" checked={exportSaveGallery} onChange={(e) => setExportSaveGallery(e.target.checked)} className="w-4 h-4" />
                <Download size={13} className="shrink-0" /> Salvar na galeria (em vez de compartilhar)
              </label>
            )}

            <button
              type="button"
              onClick={handleConfirmExport}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white disabled:opacity-40"
            >
              <Upload size={16} /> {isExporting ? 'Gerando...' : 'Exportar'}
            </button>
          </div>
          );
        })()}
      </Modal>

      {/* Fecha uma OS individual sem passar pela Compra/Financeiro (mesmo campo
          paidNaoContabil da Compra "Não Contábil") — pra trabalho que não vai gerar
          pagamento nenhum, sem precisar criar uma Compra só pra isso. */}
      <ConfirmDialog
        isOpen={!!osToSettle}
        zIndex={98000}
        title="Marcar OS como concluída?"
        message={osToSettle ? (
          <>
            <strong>{osToSettle.osNumber}</strong> — {osToSettle.productName}{osToSettle.variationName ? ` (${osToSettle.variationName})` : ''}, {osToSettle.quantity} par{osToSettle.quantity === 1 ? '' : 'es'}
            {Number(osToSettle.totalValue) > 0 ? (
              <> no valor de <strong>R$ {Number(osToSettle.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></>
            ) : null}.
            <br /><br />
            Isso marca a OS como fechada <strong>sem gerar nenhuma Compra ou lançamento financeiro</strong> —
            ela some do "Em Aberto" e não é mais contabilizada. Use só quando esse trabalho não vai
            gerar pagamento nenhum ao fornecedor. Essa ação não pode ser desfeita por aqui.
          </>
        ) : ''}
        confirmLabel={isSettlingOs ? 'Marcando...' : 'Marcar como Concluída'}
        cancelLabel="Cancelar"
        isDanger
        onConfirm={handleConfirmSettleOs}
        onCancel={() => setOsToSettle(null)}
      />
    </>
  );
}

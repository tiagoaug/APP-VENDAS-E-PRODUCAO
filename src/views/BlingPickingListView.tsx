import { useEffect, useMemo, useState } from 'react';
import { Download, Printer, Share2, PackageMinus, ImageOff, AlertTriangle, CheckSquare, Square, Loader2, ChevronDown, ChevronUp, Footprints, X, ChevronRight } from 'lucide-react';
import { Product, BlingOrder, BlingProductMapping, SaleType } from '../types';
import { subscribeToBlingOrders, subscribeToBlingMappings, abaterEstoqueBling, BlingAbaterEstoqueItem, saveBlingMapping, ignoreBlingProduct, subscribeToBlingIgnored, BlingRemoteProduct } from '../services/blingService';
import { getMappingComponents } from '../utils/blingMappingComponents';
import { toast } from '../utils/toast';
import ConfirmDialog from '../components/ConfirmDialog';
import BlingPickingExportModal from '../components/BlingPickingExportModal';
import { isAblemarkPlatform } from '../lib/ablemarkPrinter';
// Reaproveita o MESMO card de busca/vínculo (com suporte a kit) usado em "Vincular Produtos" —
// ver comentário em cima de PendingCard sobre por que um item pode ficar "sem vínculo" aqui sem
// nunca aparecer como pendente lá (produto sumiu do catálogo do Bling, só o pedido ainda lembra).
import { PendingCard } from './BlingProductMappingView';

interface BlingPickingListViewProps {
  isDarkMode: boolean;
  products: Product[];
}

export interface PickingGroup {
  key: string;
  productId: string;
  variationId: string;
  size?: string;
  saleType: SaleType;
  reference: string;
  productName: string;
  variationName: string;
  photoUrl?: string;
  totalQty: number;
  // `quantidade` é a quantidade de PARES pra separar/mostrar (já multiplicada pela quantidade
  // do componente do kit, ver getMappingComponents) — `quantidadeOriginalPedido` é a quantidade
  // BRUTA do item do pedido no Bling, sem multiplicar, usada só na hora de montar o pedido de
  // abater estoque (ver handleAbaterEstoque): um kit vira vários PickingGroup diferentes (um por
  // produto do kit) que compartilham o MESMO (blingOrderId, blingProdutoId) — sem essa distinção,
  // marcar mais de um desses grupos pra abater mandaria a MESMA linha do pedido mais de uma vez
  // pro servidor, que já expande o kit inteiro sozinho a partir de um único envio.
  contributions: { blingOrderId: string; blingProdutoId: string; quantidade: number; quantidadeOriginalPedido: number; orderNumero: string; clienteNome: string }[];
}

export interface PickingFlatRow {
  reference: string;
  productName: string;
  variationName: string;
  size?: string;
  photoUrl?: string;
  quantidade: number;
  orderNumero: string;
}

function Thumb({ src, isDarkMode }: { src?: string; isDarkMode: boolean }) {
  if (!src) {
    return (
      <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-300'}`}>
        <ImageOff size={18} />
      </div>
    );
  }
  return <img src={src} className="w-11 h-11 shrink-0 rounded-xl object-cover border border-black/5" alt="" />;
}

export default function BlingPickingListView({ isDarkMode, products }: BlingPickingListViewProps) {
  const [orders, setOrders] = useState<BlingOrder[]>([]);
  const [mappings, setMappings] = useState<BlingProductMapping[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [abating, setAbating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [printDirectOpen, setPrintDirectOpen] = useState(false);
  // Some da lista de "sem vínculo" na hora que o usuário toca em Ignorar, sem esperar a
  // subscription do Firestore ecoar de volta — ver onIgnore do PendingCard mais abaixo.
  const [locallyIgnoredIds, setLocallyIgnoredIds] = useState<Set<string>>(new Set());
  // Escolha entre Imprimir e Compartilhar — o card único abaixo de "Abater Estoque" abre esse
  // popup primeiro, em vez de já pular direto pro fluxo de impressão como fazia antes.
  const [printOrShareOpen, setPrintOrShareOpen] = useState(false);
  const [ignored, setIgnored] = useState<{ id: string }[]>([]);

  useEffect(() => subscribeToBlingOrders(setOrders), []);
  useEffect(() => subscribeToBlingMappings(setMappings), []);
  useEffect(() => subscribeToBlingIgnored(setIgnored), []);

  const { groups, flatRows, unmappedCount, unmappedItems } = useMemo(() => {
    const mappingByBlingId = new Map(mappings.map((m) => [m.blingProdutoId, m]));
    const ignoredIds = new Set(ignored.map((i) => i.id));
    const map = new Map<string, PickingGroup>();
    const flat: PickingFlatRow[] = [];
    let unmapped = 0;
    // Deduplicado por blingProdutoId — pra oferecer "Vincular" direto aqui quando o produto já
    // sumiu do catálogo do Bling (não aparece mais em fetchBlingProducts, logo nunca vira um
    // card em "Vincular Produtos" > Pendentes), mas um pedido antigo ainda referencia ele.
    const unmappedMap = new Map<string, { blingProdutoId: string; descricao: string }>();

    for (const order of orders) {
      if (order.status === 'REJEITADA') continue;
      for (const item of order.itens) {
        if (item.separado) continue;
        if (ignoredIds.has(item.blingProdutoId)) continue;
        const mapping = mappingByBlingId.get(item.blingProdutoId);
        if (!mapping) {
          unmapped++;
          if (!unmappedMap.has(item.blingProdutoId)) {
            unmappedMap.set(item.blingProdutoId, { blingProdutoId: item.blingProdutoId, descricao: item.descricao });
          }
          continue;
        }
        // Vínculo simples = 1 componente (o próprio mapping); kit = vira vários, um por
        // produto do kit — cada um gera sua PRÓPRIA linha/grupo de separação, multiplicando a
        // quantidade do pedido pela quantidade daquele componente específico (ver
        // BlingMappingComponent.quantidade).
        for (const component of getMappingComponents(mapping)) {
          const product = products.find((p) => p.id === component.productId);
          const variation = product?.variations.find((v) => v.id === component.variationId);
          const reference = product?.reference || '—';
          const productName = product?.name || component.productName || '—';
          const variationName = variation?.colorName || component.variationName || '—';
          const photoUrl = variation?.photoUrl || product?.photoUrl;
          const qty = item.quantidade * component.quantidade;

          flat.push({
            reference,
            productName,
            variationName,
            size: component.size,
            photoUrl,
            quantidade: qty,
            orderNumero: order.numero,
          });

          const key = `${component.productId}|${component.variationId}|${component.size || 'ATACADO'}`;
          const contribution = { blingOrderId: order.id, blingProdutoId: item.blingProdutoId, quantidade: qty, quantidadeOriginalPedido: item.quantidade, orderNumero: order.numero, clienteNome: order.cliente };
          const existing = map.get(key);
          if (existing) {
            existing.totalQty += qty;
            existing.contributions.push(contribution);
          } else {
            map.set(key, {
              key,
              productId: component.productId,
              variationId: component.variationId,
              size: component.size,
              saleType: mapping.saleType,
              reference,
              productName,
              variationName,
              photoUrl,
              totalQty: qty,
              contributions: [contribution],
            });
          }
        }
      }
    }

    const list = Array.from(map.values()).sort(
      (a, b) => a.reference.localeCompare(b.reference) || a.variationName.localeCompare(b.variationName) || (a.size || '').localeCompare(b.size || '')
    );
    return { groups: list, flatRows: flat, unmappedCount: unmapped, unmappedItems: Array.from(unmappedMap.values()) };
  }, [orders, mappings, products, ignored]);

  // Total de pares da lista inteira (soma de totalQty de todos os grupos, não só os marcados)
  // — mostrado abaixo de "Abater Estoque" pra dar uma ideia do tamanho da separação de uma vez.
  const totalPares = useMemo(() => groups.reduce((sum, g) => sum + g.totalQty, 0), [groups]);

  const allChecked = groups.length > 0 && groups.every((g) => checked.has(g.key));

  const toggleAll = () => {
    setChecked(allChecked ? new Set() : new Set(groups.map((g) => g.key)));
  };

  const toggleOne = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleAbaterEstoque = async () => {
    setConfirmOpen(false);
    // Dedupe por (pedido, item do Bling): um kit vira vários PickingGroup (um por produto do
    // kit) que compartilham a MESMA linha de pedido — se o usuário marcar mais de um desses
    // grupos, sem isso a mesma linha seria enviada mais de uma vez, e o servidor (que já expande
    // o kit inteiro sozinho a partir de UM envio, ver functions/src/bling/picking.ts) abateria
    // em dobro. Usa quantidadeOriginalPedido (bruta, sem multiplicar pelo componente do kit).
    const seen = new Set<string>();
    const items: BlingAbaterEstoqueItem[] = [];
    for (const g of groups.filter((gr) => checked.has(gr.key))) {
      for (const c of g.contributions) {
        const dedupeKey = `${c.blingOrderId}|${c.blingProdutoId}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        items.push({ blingOrderId: c.blingOrderId, blingProdutoId: c.blingProdutoId, quantidade: c.quantidadeOriginalPedido });
      }
    }
    if (items.length === 0) return;

    setAbating(true);
    try {
      const res = await abaterEstoqueBling(items);
      toast.show(res.message);
      setChecked(new Set());
    } catch (e: any) {
      toast.show('Erro ao abater estoque: ' + (e.message || e));
    } finally {
      setAbating(false);
    }
  };

  const checkedCount = checked.size;

  return (
    <div className="flex flex-col gap-6 pb-32">
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Abater Estoque?"
        message={
          <>
            {`Vai descontar do estoque a quantidade de ${checkedCount} referência(s) selecionada(s) e marcar os itens correspondentes como separados. Confirma?`}
            {' '}
            <span className="text-rose-500">(Após abater o estoque, faça a emissão de notas imediatamente, para evitar separar o produto mais de uma vez)</span>
          </>
        }
        confirmLabel="Sim, Abater"
        cancelLabel="Cancelar"
        onConfirm={handleAbaterEstoque}
        onCancel={() => setConfirmOpen(false)}
        isDanger={false}
      />

      <BlingPickingExportModal
        isOpen={exportOpen || printDirectOpen}
        onClose={() => { setExportOpen(false); setPrintDirectOpen(false); }}
        isDarkMode={isDarkMode}
        groups={groups}
        flatRows={flatRows}
        checkedKeys={checked}
        startInPrintChoice={printDirectOpen}
      />

      {unmappedCount > 0 && (() => {
        const visibleUnmappedItems = unmappedItems.filter((u) => !locallyIgnoredIds.has(u.blingProdutoId));
        return (
        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle size={15} className="shrink-0" />
            <p className="text-[11px] font-bold leading-snug">
              {unmappedCount} item(ns) sem vínculo de produto não entraram na lista.
              {visibleUnmappedItems.length > 0 && ' Pode não aparecer em "Vincular Produtos" se o produto já saiu do catálogo do Bling — vincule direto aqui:'}
            </p>
          </div>
          {visibleUnmappedItems.length > 0 && (
            <div className="flex flex-col gap-2">
              {visibleUnmappedItems.map((u) => (
                <PendingCard
                  key={u.blingProdutoId}
                  bp={{ id: u.blingProdutoId, nome: u.descricao } as BlingRemoteProduct}
                  entry={null}
                  origin="NENHUM"
                  isDarkMode={isDarkMode}
                  products={products}
                  onConfirm={async (mapping) => {
                    try {
                      await saveBlingMapping(mapping);
                      toast.show('Produto vinculado.');
                    } catch (e: any) {
                      toast.show('Erro ao salvar vínculo: ' + (e.message || e));
                    }
                  }}
                  onIgnore={async () => {
                    // Some da tela na hora, sem esperar a subscription do Firestore ecoar de
                    // volta (evita a sensação de "não funcionou" se a rede demorar um pouco).
                    setLocallyIgnoredIds((prev) => new Set(prev).add(u.blingProdutoId));
                    try {
                      await ignoreBlingProduct({ id: u.blingProdutoId, blingNome: u.descricao, ignoredAt: Date.now() });
                      toast.show('Ignorado — só aparece de novo em "Vincular Produtos" se você desfizer lá.');
                    } catch (e: any) {
                      // Reverte o otimismo: já que a gravação falhou de verdade, mantém visível
                      // pra não "sumir" um item que na prática continua sem vínculo nenhum.
                      setLocallyIgnoredIds((prev) => { const next = new Set(prev); next.delete(u.blingProdutoId); return next; });
                      toast.show('Erro ao ignorar: ' + (e.message || e));
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
        );
      })()}

      <div className="flex items-center gap-2">
        <button
          onClick={toggleAll}
          className={`flex-1 h-11 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 ${isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
        >
          {allChecked ? <CheckSquare size={15} /> : <Square size={15} />}
          {allChecked ? 'Desmarcar Todos' : 'Selecionar Todos'}
        </button>
        <button
          onClick={() => setExportOpen(true)}
          disabled={groups.length === 0}
          title="Exportar"
          aria-label="Exportar"
          className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 bg-indigo-600 text-white disabled:opacity-40"
        >
          <Download size={16} />
        </button>
      </div>

      <button
        onClick={() => setConfirmOpen(true)}
        disabled={checkedCount === 0 || abating}
        className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
      >
        {abating ? <Loader2 size={16} className="animate-spin" /> : <PackageMinus size={16} />}
        {abating ? 'Abatendo...' : `Abater Estoque (${checkedCount})`}
      </button>

      {groups.length > 0 && (
        <div className={`flex items-center justify-center gap-2 -mt-2 py-1 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          <Footprints size={13} />
          {totalPares} {totalPares === 1 ? 'par' : 'pares'} no total da lista
        </div>
      )}

      <button
        onClick={() => setPrintOrShareOpen(true)}
        disabled={groups.length === 0}
        data-guide-anchor="blingPicking.imprimirOuCompartilharAbrir"
        className={`w-full p-4 rounded-2xl flex items-center gap-3 text-left transition-all ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'} disabled:opacity-40`}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-slate-900 dark:bg-white text-white dark:text-slate-900">
          <Printer size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Imprimir ou Compartilhar Lista de Separação</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{isAblemarkPlatform() ? 'Impressão nativa, Ablemark ou compartilhar' : 'Impressão nativa ou compartilhar'}</p>
        </div>
        <ChevronRight size={16} className="text-slate-400 shrink-0" />
      </button>

      {printOrShareOpen && (
        <div className="fixed inset-0 z-[90000] flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm" onClick={() => setPrintOrShareOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-[2rem] p-5 flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
          >
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-black uppercase tracking-widest">Lista de Separação</p>
              <button onClick={() => setPrintOrShareOpen(false)} aria-label="Fechar"><X size={18} className="text-slate-400" /></button>
            </div>
            <button
              onClick={() => { setPrintOrShareOpen(false); setPrintDirectOpen(true); }}
              data-guide-anchor="blingPicking.escolherImprimir"
              className={`flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                <Printer size={18} className="text-indigo-500" />
                <div className="text-left">
                  <p className="text-xs font-black">Imprimir</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Impressão nativa{isAblemarkPlatform() ? ' ou térmica Ablemark' : ''}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
            <button
              onClick={() => { setPrintOrShareOpen(false); setExportOpen(true); }}
              data-guide-anchor="blingPicking.escolherCompartilhar"
              className={`flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                <Share2 size={18} className="text-indigo-500" />
                <div className="text-left">
                  <p className="text-xs font-black">Compartilhar</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">JPG ou PDF, com opções de atributos</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 && (
        <div className={`p-10 rounded-[2.5rem] border-2 border-dashed text-center ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-300'}`}>
          <p className="text-xs font-black uppercase tracking-widest">Nenhum item pendente de separação</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {groups.map((g) => {
          const isChecked = checked.has(g.key);
          const isExpanded = expanded.has(g.key);
          const orderNumbers = Array.from(new Set(g.contributions.map((c) => c.orderNumero)));
          return (
            <div
              key={g.key}
              className={`rounded-[1.75rem] border-2 overflow-hidden transition-all ${
                isChecked
                  ? isDarkMode ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-emerald-50 border-emerald-300'
                  : isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}
            >
              <div className="flex items-center gap-3 p-4">
                <button onClick={() => toggleOne(g.key)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  {isChecked ? <CheckSquare size={20} className="text-emerald-500 shrink-0" /> : <Square size={20} className="text-slate-300 shrink-0" />}
                  <Thumb src={g.photoUrl} isDarkMode={isDarkMode} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {g.reference} · {g.variationName}{g.size ? ` · ${g.size}` : ' · Atacado'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
                      {g.productName} · Pedidos {orderNumbers.join(', ')}
                    </p>
                  </div>
                </button>
                <div className={`shrink-0 px-3 py-1.5 rounded-xl text-sm font-black ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-900'}`}>
                  {g.totalQty}
                </div>
                <button onClick={() => toggleExpand(g.key)} className="p-1.5 text-slate-400 shrink-0">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {isExpanded && (
                <div className={`flex flex-col gap-1.5 px-4 pb-4 pt-1 border-t border-dashed ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                  {g.contributions.map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-xs pt-1.5">
                      <div className="min-w-0">
                        <p className={`font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Pedido {c.orderNumero}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">{c.clienteNome}</p>
                      </div>
                      <span className={`font-black shrink-0 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{c.quantidade}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

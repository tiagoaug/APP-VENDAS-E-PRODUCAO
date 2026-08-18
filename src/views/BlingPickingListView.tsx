import { useEffect, useMemo, useState } from 'react';
import { Download, Printer, PackageMinus, ImageOff, AlertTriangle, CheckSquare, Square, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Product, BlingOrder, BlingProductMapping, SaleType } from '../types';
import { subscribeToBlingOrders, subscribeToBlingMappings, abaterEstoqueBling, BlingAbaterEstoqueItem } from '../services/blingService';
import { toast } from '../utils/toast';
import ConfirmDialog from '../components/ConfirmDialog';
import BlingPickingExportModal from '../components/BlingPickingExportModal';
import { isAblemarkPlatform } from '../lib/ablemarkPrinter';

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
  contributions: { blingOrderId: string; blingProdutoId: string; quantidade: number; orderNumero: string; clienteNome: string }[];
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

  useEffect(() => subscribeToBlingOrders(setOrders), []);
  useEffect(() => subscribeToBlingMappings(setMappings), []);

  const { groups, flatRows, unmappedCount } = useMemo(() => {
    const mappingByBlingId = new Map(mappings.map((m) => [m.blingProdutoId, m]));
    const map = new Map<string, PickingGroup>();
    const flat: PickingFlatRow[] = [];
    let unmapped = 0;

    for (const order of orders) {
      if (order.status === 'REJEITADA') continue;
      for (const item of order.itens) {
        if (item.separado) continue;
        const mapping = mappingByBlingId.get(item.blingProdutoId);
        if (!mapping) {
          unmapped++;
          continue;
        }
        const product = products.find((p) => p.id === mapping.productId);
        const variation = product?.variations.find((v) => v.id === mapping.variationId);
        const reference = product?.reference || '—';
        const productName = product?.name || mapping.productName || '—';
        const variationName = variation?.colorName || mapping.variationName || '—';
        const photoUrl = variation?.photoUrl || product?.photoUrl;

        flat.push({
          reference,
          productName,
          variationName,
          size: mapping.size,
          photoUrl,
          quantidade: item.quantidade,
          orderNumero: order.numero,
        });

        const key = `${mapping.productId}|${mapping.variationId}|${mapping.size || 'ATACADO'}`;
        const contribution = { blingOrderId: order.id, blingProdutoId: item.blingProdutoId, quantidade: item.quantidade, orderNumero: order.numero, clienteNome: order.cliente };
        const existing = map.get(key);
        if (existing) {
          existing.totalQty += item.quantidade;
          existing.contributions.push(contribution);
        } else {
          map.set(key, {
            key,
            productId: mapping.productId,
            variationId: mapping.variationId,
            size: mapping.size,
            saleType: mapping.saleType,
            reference,
            productName,
            variationName,
            photoUrl,
            totalQty: item.quantidade,
            contributions: [contribution],
          });
        }
      }
    }

    const list = Array.from(map.values()).sort(
      (a, b) => a.reference.localeCompare(b.reference) || a.variationName.localeCompare(b.variationName) || (a.size || '').localeCompare(b.size || '')
    );
    return { groups: list, flatRows: flat, unmappedCount: unmapped };
  }, [orders, mappings, products]);

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
    const items: BlingAbaterEstoqueItem[] = groups
      .filter((g) => checked.has(g.key))
      .flatMap((g) => g.contributions.map((c) => ({ blingOrderId: c.blingOrderId, blingProdutoId: c.blingProdutoId, quantidade: c.quantidade })));
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

      {unmappedCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
          <AlertTriangle size={15} className="shrink-0" />
          <p className="text-[11px] font-bold leading-snug">{unmappedCount} item(ns) sem vínculo de produto não entraram na lista — vincule em "Vincular Produtos" primeiro.</p>
        </div>
      )}

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

      <button
        onClick={() => setPrintDirectOpen(true)}
        disabled={groups.length === 0}
        className={`w-full p-4 rounded-2xl flex items-center gap-3 text-left transition-all ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'} disabled:opacity-40`}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-slate-900 dark:bg-white text-white dark:text-slate-900">
          <Printer size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Imprimir Lista de Separação</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{isAblemarkPlatform() ? 'Impressão nativa ou etiquetas na Ablemark' : 'Impressão nativa'}</p>
        </div>
      </button>

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

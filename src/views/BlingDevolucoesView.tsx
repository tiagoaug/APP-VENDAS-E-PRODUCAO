import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Search, ImageOff, PackageX, Ticket, Boxes, Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Product, Variation, SaleType, BlingDevolucao, BlingProductMapping } from '../types';
import { subscribeToBlingDevolucoes, subscribeToBlingMappings, registerBlingDevolucao, registerNotesOnlyReturn } from '../services/blingService';
import { productHasSaleType } from '../utils/stockPools';
import { toast } from '../utils/toast';

interface BlingDevolucoesViewProps {
  isDarkMode: boolean;
  products: Product[];
}

type ReturnChoice = 'somente_nota' | 'produto_e_nota';

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

/** Popup centralizado — primeira coisa que aparece ao entrar na tela, pra decidir se a
 * devolução envolve produto (vai pro estoque) ou é só a nota voltando pro saldo do talão. */
function ChoicePopup({ isDarkMode, onChoose }: { isDarkMode: boolean; onChoose: (choice: ReturnChoice) => void }) {
  return (
    <div className="fixed inset-0 z-[90000] flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-sm rounded-[2rem] p-5 flex flex-col gap-3 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
        <p className="px-1 text-sm font-black uppercase tracking-widest">O que vai devolver?</p>

        <button onClick={() => onChoose('produto_e_nota')} className={`flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <Boxes size={18} className="text-rose-500 shrink-0" />
            <div className="text-left">
              <p className="text-xs font-black">Produto e Nota</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Volta pro estoque e devolve a nota</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-400 shrink-0" />
        </button>

        <button onClick={() => onChoose('somente_nota')} className={`flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <Ticket size={18} className="text-amber-500 shrink-0" />
            <div className="text-left">
              <p className="text-xs font-black">Somente Nota</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Só soma no saldo, sem mexer no estoque</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-400 shrink-0" />
        </button>
      </div>
    </div>
  );
}

/** Fluxo "Somente Nota" — sem produto/estoque, só devolve a quantidade pro saldo de notas. */
function NotesOnlyForm({ isDarkMode, onBack }: { isDarkMode: boolean; onBack: () => void }) {
  const [qty, setQty] = useState('');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const parsedQty = Math.max(0, Math.floor(Number(qty) || 0));

  const handleConfirm = async () => {
    if (parsedQty === 0) return;
    setSaving(true);
    try {
      await registerNotesOnlyReturn({ quantidade: parsedQty, motivo: motivo || undefined });
      toast.show(`${parsedQty} nota(s) devolvida(s) ao saldo.`);
      setQty('');
      setMotivo('');
    } catch (e: any) {
      toast.show('Erro ao registrar devolução: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-fit">
        <ChevronLeft size={14} /> Alterar Tipo de Devolução
      </button>

      <div className={`p-4 rounded-[1.75rem] border shadow-sm flex items-center gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
          <Ticket size={18} />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Devolução Somente Nota</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Não mexe no estoque de produtos</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Quantidade de notas</label>
        <input
          type="number" inputMode="numeric" min={0} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" autoFocus
          className={`w-full px-4 py-3 rounded-2xl text-lg font-black outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo (opcional)</label>
        <input
          type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: nota emitida errada"
          className={`w-full px-4 py-3 rounded-2xl text-xs font-bold outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
        />
      </div>

      <button
        onClick={handleConfirm}
        disabled={parsedQty === 0 || saving}
        className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
        {saving ? 'Registrando...' : 'Registrar Devolução de Nota'}
      </button>
    </div>
  );
}

export default function BlingDevolucoesView({ isDarkMode, products }: BlingDevolucoesViewProps) {
  const [mappings, setMappings] = useState<BlingProductMapping[]>([]);
  const [devolucoes, setDevolucoes] = useState<BlingDevolucao[]>([]);
  const [choice, setChoice] = useState<ReturnChoice | null>(null);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeToBlingMappings(setMappings), []);
  useEffect(() => subscribeToBlingDevolucoes(setDevolucoes), []);

  // Só modelos de varejo vinculados ao Bling — mesmo filtro já usado em Estoque Bling.
  const linkedRetailProducts = useMemo(() => {
    const linkedIds = new Set(mappings.map((m) => m.productId));
    return products.filter((p) => linkedIds.has(p.id) && productHasSaleType(p, SaleType.RETAIL));
  }, [products, mappings]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return linkedRetailProducts;
    return linkedRetailProducts.filter((p) => p.reference.toLowerCase().includes(term) || p.name.toLowerCase().includes(term));
  }, [linkedRetailProducts, search]);

  const sizesForVariation = useMemo(() => {
    if (!selectedVariation) return [];
    return Object.keys(selectedVariation.stock).filter((s) => s !== 'WHOLESALE');
  }, [selectedVariation]);

  const parsedQty = Math.max(0, Math.floor(Number(qty) || 0));

  const resetSelection = () => {
    setSelectedProduct(null);
    setSelectedVariation(null);
    setSize(null);
    setQty('');
  };

  const backToChoice = () => {
    resetSelection();
    setSearch('');
    setChoice(null);
  };

  const handleConfirm = async () => {
    if (!selectedProduct || !selectedVariation || parsedQty === 0) return;
    setSaving(true);
    try {
      const res = await registerBlingDevolucao({
        productId: selectedProduct.id,
        variationId: selectedVariation.id,
        size: size || undefined,
        quantidade: parsedQty,
      });
      toast.show(res.message);
      resetSelection();
    } catch (e: any) {
      toast.show('Erro ao registrar devolução: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const recentList = devolucoes.length > 0 && (
    <div className="flex flex-col gap-3 mt-2">
      <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Devoluções Recentes</h3>
      {devolucoes.slice(0, 20).map((d) => (
        <div key={d.id} className={`p-3 rounded-2xl flex items-center justify-between gap-2 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}>
          <div className="min-w-0">
            <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
              {d.productReference} · {d.variationName}{d.size ? ` · ${d.size}` : ' · Atacado'}
            </p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{format(new Date(d.createdAt), 'dd/MM/yyyy HH:mm')}</p>
          </div>
          <span className="text-sm font-black text-rose-500 shrink-0">+{d.quantidade}</span>
        </div>
      ))}
    </div>
  );

  if (choice === null) {
    return (
      <div className="flex flex-col gap-6 pb-32">
        <ChoicePopup isDarkMode={isDarkMode} onChoose={setChoice} />
        {recentList}
      </div>
    );
  }

  if (choice === 'somente_nota') {
    return (
      <div className="flex flex-col gap-6 pb-32">
        <NotesOnlyForm isDarkMode={isDarkMode} onBack={backToChoice} />
        {recentList}
      </div>
    );
  }

  if (selectedProduct) {
    return (
      <div className="flex flex-col gap-6 pb-32">
        <button onClick={resetSelection} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-fit">
          <ChevronLeft size={14} /> Trocar Modelo
        </button>

        <div className={`p-4 rounded-[1.75rem] border shadow-sm flex items-center gap-3 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <Thumb src={selectedVariation?.photoUrl || selectedProduct.photoUrl} isDarkMode={isDarkMode} />
          <div className="min-w-0">
            <p className={`text-sm font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedProduct.reference} — {selectedProduct.name}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">{selectedVariation?.colorName || 'Selecione a cor'}</p>
          </div>
        </div>

        {!selectedVariation ? (
          <div className="flex flex-col gap-2">
            <p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Cor</p>
            <div className="flex flex-wrap gap-2">
              {selectedProduct.variations.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariation(v)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${isDarkMode ? 'bg-slate-900 border border-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-900'}`}
                >
                  {v.photoUrl && <img src={v.photoUrl} className="w-6 h-6 rounded-md object-cover" alt="" />}
                  {v.colorName}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Tamanho</p>
              <div className="flex flex-wrap gap-2">
                {sizesForVariation.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`min-w-[52px] h-11 px-3 rounded-xl text-xs font-black ${
                      size === s ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-900 border border-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-900'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Quantidade</label>
              <input
                type="number" inputMode="numeric" min={0} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0"
                className={`w-full px-4 py-3 rounded-2xl text-lg font-black outline-none border-2 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
              />
            </div>

            <button
              onClick={handleConfirm}
              disabled={!size || parsedQty === 0 || saving}
              className="w-full h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <PackageX size={16} />}
              {saving ? 'Registrando...' : 'Registrar Devolução'}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-32">
      <div className="flex items-center justify-between">
        <button onClick={backToChoice} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <ChevronLeft size={14} /> Alterar Tipo de Devolução
        </button>
        <button onClick={backToChoice} className="p-1 text-slate-400"><X size={16} /></button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por referência ou nome..."
          className={`w-full h-12 pl-11 pr-4 rounded-2xl text-xs font-bold outline-none border-2 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-slate-100 text-slate-900 placeholder:text-slate-400'}`}
        />
      </div>

      <div className="flex flex-col gap-2">
        {filteredProducts.length === 0 && (
          <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-10">Nenhum modelo de varejo vinculado ao Bling encontrado.</p>
        )}
        {filteredProducts.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedProduct(p)}
            className={`p-4 rounded-[1.75rem] border shadow-sm flex items-center gap-3 text-left ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
          >
            <Thumb src={p.photoUrl} isDarkMode={isDarkMode} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{p.reference} — {p.name}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{p.variations.length} cor(es)</p>
            </div>
          </button>
        ))}
      </div>

      {recentList}
    </div>
  );
}

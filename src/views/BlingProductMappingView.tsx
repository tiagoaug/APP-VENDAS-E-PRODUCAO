import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, Link2, Search, Unlink, Sparkles, ImageOff, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Product, SaleType } from '../types';
import {
  fetchBlingProducts,
  BlingRemoteProduct,
  subscribeToBlingMappings,
  saveBlingMapping,
  deleteBlingMapping,
  subscribeToBlingIgnored,
  ignoreBlingProduct,
  unignoreBlingProduct,
} from '../services/blingService';
import { BlingProductMapping, BlingIgnoredProduct } from '../types';
import { buildLocalSkuIndex, suggestMatch, LocalSkuEntry } from '../utils/blingReconciliation';
import { generateId } from '../utils/id';
import { toast } from '../utils/toast';

interface BlingProductMappingViewProps {
  isDarkMode: boolean;
  products: Product[];
}

/** Extrai cor/tamanho do nome do produto no Bling quando segue o padrão
 * "...COR:BRANCO;TAMANHO:41" (visto nas variações reais sincronizadas) — usado só pra
 * pré-preencher os selects, nunca pra vincular sozinho: o usuário sempre confirma. */
function parseColorSizeFromBlingName(nome: string): { color?: string; size?: string } {
  const colorMatch = nome.match(/COR\s*:\s*([^;]+)/i);
  const sizeMatch = nome.match(/TAMANHO\s*:\s*([^;]+)/i);
  return {
    color: colorMatch?.[1]?.trim(),
    size: sizeMatch?.[1]?.trim(),
  };
}

const normalizeText = (s: string) => s.trim().toLowerCase();

function Thumb({ src, size = 44, isDarkMode }: { src?: string; size?: number; isDarkMode: boolean }) {
  if (!src) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-300'}`}
      >
        <ImageOff size={size * 0.4} />
      </div>
    );
  }
  return (
    <img
      src={src}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-xl object-cover border border-black/5"
      alt=""
    />
  );
}

function PendingCard({
  bp,
  entry,
  origin,
  distance,
  isDarkMode,
  products,
  onConfirm,
  onIgnore,
  defaultProductId,
}: {
  bp: BlingRemoteProduct;
  entry: LocalSkuEntry | null;
  origin: 'AUTOMATICO_SKU' | 'SIMILAR' | 'NENHUM';
  distance?: number;
  isDarkMode: boolean;
  products: Product[];
  onConfirm: (mapping: BlingProductMapping) => void;
  onIgnore: () => void;
  defaultProductId?: string; // modelo já escolhido no "Produto Pai" do grupo — pré-preenche a variação
}) {
  const [searchOpen, setSearchOpen] = useState(!!defaultProductId);
  const [query, setQuery] = useState('');
  const [pickedProductId, setPickedProductId] = useState(defaultProductId || '');
  const [pickedVariationId, setPickedVariationId] = useState('');
  const [pickedSaleType, setPickedSaleType] = useState<SaleType>(SaleType.RETAIL);
  const [pickedSize, setPickedSize] = useState('');

  // O modelo do grupo pode ser escolhido DEPOIS que essa variação já montou (usuário abre o
  // "Produto Pai" antes de expandir as variações) — sincroniza sem sobrescrever uma escolha
  // manual que o usuário já tenha feito pra essa variação específica.
  useEffect(() => {
    if (defaultProductId && !pickedProductId) {
      setPickedProductId(defaultProductId);
      setSearchOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultProductId]);

  const pickedProduct = useMemo(() => products.find((p) => p.id === pickedProductId) || null, [products, pickedProductId]);
  const pickedVariation = useMemo(() => pickedProduct?.variations.find((v) => v.id === pickedVariationId) || null, [pickedProduct, pickedVariationId]);
  const isHybrid = !!pickedProduct?.saleTypes && pickedProduct.saleTypes.length > 1;
  const availableSaleTypes = pickedProduct ? (isHybrid ? pickedProduct.saleTypes! : [pickedProduct.type]) : [];

  // Assim que o modelo é escolhido (manual ou pré-preenchido pelo grupo), tenta ler cor e
  // tamanho direto do nome do produto no Bling ("...COR:BRANCO;TAMANHO:41") e já deixa os
  // selects prontos — sem sobrescrever se o usuário já tiver escolhido manualmente. Nunca
  // salva sozinho: só arruma pro usuário conferir e apertar "Vincular".
  useEffect(() => {
    if (!pickedProduct || pickedVariationId) return;
    const { color, size } = parseColorSizeFromBlingName(bp.nome);
    if (!color) return;
    const matchedVariation = pickedProduct.variations.find((v) => normalizeText(v.colorName) === normalizeText(color));
    if (!matchedVariation) return;
    setPickedVariationId(matchedVariation.id);
    if (size) {
      const matchedSize = Object.keys(matchedVariation.stock).find((s) => normalizeText(s) === normalizeText(size));
      if (matchedSize) setPickedSize(matchedSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedProduct]);

  const readyToConfirm = !!pickedVariation && (pickedSaleType !== SaleType.RETAIL || !!pickedSize);

  const filteredProducts = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return products.filter((p) => p.reference.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [products, query]);

  const confirmSuggestion = () => {
    if (!entry) return;
    const mapping: BlingProductMapping = {
      id: generateId(),
      blingProdutoId: bp.id,
      blingSku: bp.codigo,
      blingNome: bp.nome,
      productId: entry.product.id,
      productName: entry.product.name,
      variationId: entry.variation.id,
      variationName: entry.variation.colorName,
      size: entry.size,
      saleType: entry.saleType,
      origem: origin === 'AUTOMATICO_SKU' ? 'AUTOMATICO_SKU' : 'MANUAL',
      createdAt: Date.now(),
    };
    onConfirm(mapping);
  };

  const confirmManual = () => {
    if (!pickedProduct || !pickedVariation) return;
    if (pickedSaleType === SaleType.RETAIL && !pickedSize) {
      toast.show('Selecione o tamanho.');
      return;
    }
    const mapping: BlingProductMapping = {
      id: generateId(),
      blingProdutoId: bp.id,
      blingSku: bp.codigo,
      blingNome: bp.nome,
      productId: pickedProduct.id,
      productName: pickedProduct.name,
      variationId: pickedVariation.id,
      variationName: pickedVariation.colorName,
      size: pickedSaleType === SaleType.RETAIL ? pickedSize : undefined,
      saleType: pickedSaleType,
      origem: 'MANUAL',
      createdAt: Date.now(),
    };
    onConfirm(mapping);
  };

  return (
    <div className={`p-5 rounded-[2rem] border shadow-sm flex flex-col gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
      <div className="flex items-center gap-3 min-w-0">
        {/* Prioriza a foto do PRÓPRIO cadastro (quando já existe sugestão de vínculo) sobre a
            foto que vem do Bling — é a mesma foto que o usuário já reconhece do seu catálogo. */}
        <Thumb src={(entry && (entry.variation.photoUrl || entry.product.photoUrl)) || bp.imagemUrl} isDarkMode={isDarkMode} />
        <div className="min-w-0">
          <p className={`text-sm font-black tracking-tight break-words ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{bp.nome}</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
            {bp.codigo ? `SKU ${bp.codigo}` : 'Sem SKU'}{bp.gtin ? ` · GTIN ${bp.gtin}` : ''}
          </p>
        </div>
      </div>

      {entry && origin !== 'NENHUM' && (
        <div className={`p-3 rounded-2xl flex items-center gap-3 ${origin === 'AUTOMATICO_SKU' ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
          <Thumb src={entry.variation.photoUrl || entry.product.photoUrl} size={36} isDarkMode={isDarkMode} />
          <div className="min-w-0 flex-1">
            <p className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${origin === 'AUTOMATICO_SKU' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              <Sparkles size={11} /> {origin === 'AUTOMATICO_SKU' ? 'SKU idêntico' : `Sugestão similar (distância ${distance})`}
            </p>
            <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {entry.product.reference} · {entry.product.name} · {entry.variation.colorName}{entry.size ? ` · ${entry.size}` : ' · Atacado'}
            </p>
          </div>
          <button
            onClick={confirmSuggestion}
            data-guide-anchor="blingMapping.confirmar"
            className="shrink-0 h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5"
          >
            <CheckCircle2 size={14} /> Confirmar
          </button>
        </div>
      )}

      {!searchOpen ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className={`flex-1 h-10 rounded-xl border-2 border-dashed font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 ${isDarkMode ? 'bg-sky-900/20 border-sky-700/40 text-sky-400' : 'bg-sky-50 border-sky-200 text-sky-600'}`}
          >
            <Search size={13} /> Buscar produto
          </button>
          <button
            onClick={onIgnore}
            title="Ignorar"
            aria-label="Ignorar produto"
            className="h-10 w-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-rose-500 shrink-0"
          >
            <XCircle size={18} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPickedProductId(''); setPickedVariationId(''); setPickedSize(''); }}
            placeholder="Referência ou nome do produto..."
            className={`w-full h-11 px-3 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
          />

          <div className="flex items-center gap-2">
            <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">ou selecione</span>
            <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
          </div>

          <select
            value={pickedProductId}
            onChange={(e) => { setPickedProductId(e.target.value); setPickedVariationId(''); setPickedSize(''); setQuery(''); }}
            className={`w-full h-11 px-3 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
          >
            <option value="">Modelo cadastrado...</option>
            {[...products].sort((a, b) => a.reference.localeCompare(b.reference)).map((p) => (
              <option key={p.id} value={p.id}>{p.reference} · {p.name}</option>
            ))}
          </select>

          {filteredProducts.length > 0 && !pickedProductId && (
            <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPickedProductId(p.id); setQuery(`${p.reference} · ${p.name}`); }}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-xs font-bold ${isDarkMode ? 'hover:bg-slate-800 text-white' : 'hover:bg-slate-50 text-slate-900'}`}
                >
                  <Thumb src={p.photoUrl} size={28} isDarkMode={isDarkMode} />
                  {p.reference} · {p.name}
                </button>
              ))}
            </div>
          )}

          {pickedProduct && (
            <select
              value={pickedVariationId}
              onChange={(e) => { setPickedVariationId(e.target.value); setPickedSize(''); }}
              className={`w-full h-11 px-3 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
            >
              <option value="">Selecione a cor...</option>
              {pickedProduct.variations.map((v) => <option key={v.id} value={v.id}>{v.colorName}</option>)}
            </select>
          )}

          {pickedVariation && (
            <div className="flex items-center gap-2.5">
              <Thumb src={pickedVariation.photoUrl || pickedProduct?.photoUrl} size={36} isDarkMode={isDarkMode} />
              <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{pickedVariation.colorName}</p>
            </div>
          )}

          {pickedProduct && isHybrid && (
            <select
              value={pickedSaleType}
              onChange={(e) => { setPickedSaleType(e.target.value as SaleType); setPickedSize(''); }}
              className={`w-full h-11 px-3 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
            >
              {availableSaleTypes.map((st) => <option key={st} value={st}>{st === SaleType.RETAIL ? 'Varejo (par)' : 'Atacado (caixa)'}</option>)}
            </select>
          )}

          {pickedVariation && pickedSaleType === SaleType.RETAIL && (
            <select
              value={pickedSize}
              onChange={(e) => setPickedSize(e.target.value)}
              className={`w-full h-11 px-3 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
            >
              <option value="">Selecione o tamanho...</option>
              {Object.keys(pickedVariation.stock).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {readyToConfirm && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 animate-pulse">
              <Sparkles size={13} className="shrink-0" />
              <p className="text-[10px] font-black uppercase tracking-widest">Preenchido — confira e confirme pra salvar</p>
            </div>
          )}

          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => { setSearchOpen(false); setQuery(''); setPickedProductId(''); }}
              className="flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400"
            >
              Cancelar
            </button>
            <button
              onClick={confirmManual}
              disabled={!pickedVariation}
              className={`flex-1 h-10 rounded-xl bg-indigo-600 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 ${readyToConfirm ? 'ring-4 ring-amber-300/60 dark:ring-amber-500/40' : ''}`}
            >
              <Link2 size={13} /> Vincular
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Linha compacta com feedback visual verde pra um item já vinculado — usada tanto dentro de um
 * grupo de Pendentes (pra não sumir da lista assim que vinculado, o que reflui/confunde no meio
 * de várias variações) quanto na lista de Vinculados agrupada por produto pai. Prioriza a foto
 * do PRÓPRIO cadastro sobre a do Bling, mesma regra usada no resto da tela. */
function LinkedRow({
  label,
  imagemUrl,
  mapping,
  products,
  isDarkMode,
  onUnlink,
}: {
  label: string;
  imagemUrl?: string;
  mapping: BlingProductMapping;
  products: Product[];
  isDarkMode: boolean;
  onUnlink: () => void;
}) {
  const linkedProduct = products.find((p) => p.id === mapping.productId);
  const linkedVariation = linkedProduct?.variations.find((v) => v.id === mapping.variationId);
  const thumb = linkedVariation?.photoUrl || linkedProduct?.photoUrl || imagemUrl;

  return (
    <div className={`p-4 rounded-[1.5rem] border-2 flex items-center gap-3 ${isDarkMode ? 'bg-emerald-900/10 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'}`}>
      <div className="relative shrink-0">
        <Thumb src={thumb} size={40} isDarkMode={isDarkMode} />
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white dark:border-slate-900">
          <CheckCircle2 size={11} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-black tracking-tight break-words ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{label}</p>
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider break-words">
          → {mapping.productName} · {mapping.variationName}{mapping.size ? ` · ${mapping.size}` : ' · Atacado'}
        </p>
      </div>
      <button onClick={onUnlink} className="p-2 text-emerald-400 hover:text-rose-500 shrink-0" title="Desvincular" aria-label="Desvincular">
        <Unlink size={16} />
      </button>
    </div>
  );
}

/** Vínculo do "Produto Pai" do grupo — só modelo + imagem, sem cor nem numeração (o produto pai
 * em si não é um SKU vendável, é só o agrupador das variações no Bling). Ao confirmar, define o
 * modelo padrão do grupo (pré-preenche as variações) e marca o produto pai como ignorado, já
 * que ele não vira um BlingProductMapping de verdade (não tem variação/tamanho pra vincular). */
function ParentModelPicker({
  bp,
  isDarkMode,
  products,
  onLinkModel,
  onIgnore,
}: {
  bp: BlingRemoteProduct;
  isDarkMode: boolean;
  products: Product[];
  onLinkModel: (productId: string) => void;
  onIgnore: () => void;
}) {
  const [query, setQuery] = useState('');
  const [pickedProductId, setPickedProductId] = useState('');

  const pickedProduct = useMemo(() => products.find((p) => p.id === pickedProductId) || null, [products, pickedProductId]);
  const filteredProducts = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return products.filter((p) => p.reference.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [products, query]);

  return (
    <div className={`p-5 rounded-[2rem] border-2 shadow-sm flex flex-col gap-4 ${isDarkMode ? 'bg-amber-900/20 border-amber-700/40' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <Thumb src={pickedProduct?.photoUrl || bp.imagemUrl} isDarkMode={isDarkMode} />
        <div className="min-w-0">
          <p className={`text-sm font-black tracking-tight break-words ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{bp.nome}</p>
          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider truncate">
            {bp.codigo ? `SKU ${bp.codigo}` : 'Sem SKU'} · só modelo, sem cor/numeração
          </p>
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setPickedProductId(''); }}
        placeholder="Referência ou nome do produto..."
        className={`w-full h-11 px-3 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
      />

      <div className="flex items-center gap-2">
        <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">ou selecione</span>
        <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
      </div>

      <select
        value={pickedProductId}
        onChange={(e) => { setPickedProductId(e.target.value); setQuery(''); }}
        className={`w-full h-11 px-3 rounded-xl text-sm font-bold outline-none border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
      >
        <option value="">Modelo cadastrado...</option>
        {[...products].sort((a, b) => a.reference.localeCompare(b.reference)).map((p) => (
          <option key={p.id} value={p.id}>{p.reference} · {p.name}</option>
        ))}
      </select>

      {filteredProducts.length > 0 && !pickedProductId && (
        <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => { setPickedProductId(p.id); setQuery(`${p.reference} · ${p.name}`); }}
              className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-xs font-bold ${isDarkMode ? 'hover:bg-slate-800 text-white' : 'hover:bg-slate-50 text-slate-900'}`}
            >
              <Thumb src={p.photoUrl} size={28} isDarkMode={isDarkMode} />
              {p.reference} · {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onIgnore}
          className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"
        >
          <XCircle size={14} /> Ignorar
        </button>
        <button
          onClick={() => pickedProductId && onLinkModel(pickedProductId)}
          disabled={!pickedProductId}
          className="flex-1 h-10 rounded-xl bg-indigo-600 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
        >
          <Link2 size={13} /> Vincular Modelo ao Grupo
        </button>
      </div>
    </div>
  );
}

export default function BlingProductMappingView({ isDarkMode, products }: BlingProductMappingViewProps) {
  const [tab, setTab] = useState<'pendentes' | 'vinculados'>('pendentes');
  const [blingProducts, setBlingProducts] = useState<BlingRemoteProduct[]>([]);
  const [mappings, setMappings] = useState<BlingProductMapping[]>([]);
  const [ignored, setIgnored] = useState<BlingIgnoredProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => subscribeToBlingMappings(setMappings), []);
  useEffect(() => subscribeToBlingIgnored(setIgnored), []);
  useEffect(() => { loadBlingProducts(); }, []);

  const loadBlingProducts = async () => {
    if (loading) return; // evita duas buscas simultâneas (ex: toque duplo no botão de refresh)
    setLoading(true);
    try {
      const list = await fetchBlingProducts();
      setBlingProducts(list);
    } catch (e: any) {
      toast.show('Erro ao buscar produtos do Bling: ' + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const localIndex = useMemo(() => buildLocalSkuIndex(products), [products]);

  const mappedIds = useMemo(() => new Set(mappings.map((m) => m.blingProdutoId)), [mappings]);
  const mappingByBlingId = useMemo(() => new Map(mappings.map((m) => [m.blingProdutoId, m])), [mappings]);
  const blingProductById = useMemo(() => new Map(blingProducts.map((bp) => [bp.id, bp])), [blingProducts]);
  const ignoredIds = useMemo(() => new Set(ignored.map((i) => i.id)), [ignored]);

  const pendingProducts = useMemo(
    () => blingProducts.filter((bp) => !mappedIds.has(bp.id) && !ignoredIds.has(bp.id)),
    [blingProducts, mappedIds, ignoredIds]
  );

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Modelo local escolhido pra cada grupo (via "Produto Pai") — pré-preenche as variações do
  // grupo, mesmo depois que o produto pai some da lista (foi ignorado, ver ParentModelPicker).
  const [groupModelId, setGroupModelId] = useState<Record<string, string>>({});

  // Agrupa produtos (variação = mesmo produtoPaiId no Bling) ignorando só os já IGNORADOS —
  // itens já VINCULADOS continuam aparecendo dentro do grupo (com feedback verde, ver
  // LinkedRow) em vez de sumir da lista, pra não confundir no meio de um grupo com várias
  // variações. Fora de grupo (singles), só os realmente pendentes aparecem.
  const { groups: pendingGroups, singles: pendingSingles } = useMemo(() => {
    const visible = blingProducts.filter((bp) => !ignoredIds.has(bp.id));
    const byId = new Map(visible.map((bp) => [bp.id, bp]));
    const childrenByParent = new Map<string, BlingRemoteProduct[]>();
    for (const bp of visible) {
      if (!bp.produtoPaiId) continue;
      const arr = childrenByParent.get(bp.produtoPaiId) || [];
      arr.push(bp);
      childrenByParent.set(bp.produtoPaiId, arr);
    }
    const childIds = new Set(Array.from(childrenByParent.values()).flat().map((c) => c.id));

    const groups: { parentId: string; parent: BlingRemoteProduct | null; children: BlingRemoteProduct[] }[] = [];
    const singles: BlingRemoteProduct[] = [];
    const seenParents = new Set<string>();

    for (const bp of visible) {
      if (childIds.has(bp.id)) continue; // renderizado dentro do grupo do pai
      const children = childrenByParent.get(bp.id);
      if (children?.length) {
        groups.push({ parentId: bp.id, parent: bp, children });
        seenParents.add(bp.id);
      } else if (!bp.produtoPaiId && !mappedIds.has(bp.id)) {
        singles.push(bp);
      }
    }
    for (const [parentId, children] of childrenByParent.entries()) {
      if (!seenParents.has(parentId)) {
        groups.push({ parentId, parent: byId.get(parentId) || null, children });
      }
    }

    return { groups, singles };
  }, [blingProducts, ignoredIds, mappedIds]);

  const [expandedLinkedGroups, setExpandedLinkedGroups] = useState<Set<string>>(new Set());
  const toggleLinkedGroup = (id: string) => {
    setExpandedLinkedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Foto de referência de um mapping: prioriza a foto do PRÓPRIO cadastro (variação > produto),
  // mesma regra usada em LinkedRow — só cai pra foto do Bling se o cadastro local não tiver.
  const localThumbForMapping = (m: BlingProductMapping): string | undefined => {
    const p = products.find((pr) => pr.id === m.productId);
    const v = p?.variations.find((vr) => vr.id === m.variationId);
    return v?.photoUrl || p?.photoUrl;
  };

  // Mesmo agrupamento por produto pai, mas pro lado dos VINCULADOS: cada mapping é cruzado com
  // o catálogo do Bling (blingProducts) só pra descobrir o produtoPaiId — precisa ter buscado o
  // catálogo nesta sessão (mesma lista já usada nos Pendentes) pra funcionar.
  const { groups: linkedGroups, singles: linkedSingles } = useMemo(() => {
    const blingById = new Map(blingProducts.map((bp) => [bp.id, bp]));
    const childrenByParent = new Map<string, BlingProductMapping[]>();
    for (const m of mappings) {
      const parentId = blingById.get(m.blingProdutoId)?.produtoPaiId;
      if (!parentId) continue;
      const arr = childrenByParent.get(parentId) || [];
      arr.push(m);
      childrenByParent.set(parentId, arr);
    }
    const childIds = new Set(Array.from(childrenByParent.values()).flat().map((m) => m.blingProdutoId));

    const groups: { parentId: string; parentBp: BlingRemoteProduct | null; parentMapping: BlingProductMapping | null; children: BlingProductMapping[]; headerThumb?: string }[] = [];
    const singles: BlingProductMapping[] = [];

    const headerThumbFor = (parentMapping: BlingProductMapping | null, children: BlingProductMapping[]) =>
      (parentMapping && localThumbForMapping(parentMapping)) || children.map(localThumbForMapping).find(Boolean);

    for (const m of mappings) {
      if (childIds.has(m.blingProdutoId)) continue; // renderizado dentro do grupo do pai
      const children = childrenByParent.get(m.blingProdutoId);
      if (children?.length) {
        groups.push({ parentId: m.blingProdutoId, parentBp: blingById.get(m.blingProdutoId) || null, parentMapping: m, children, headerThumb: headerThumbFor(m, children) });
        childrenByParent.delete(m.blingProdutoId);
      } else if (!blingById.get(m.blingProdutoId)?.produtoPaiId) {
        singles.push(m);
      }
    }
    // Produto pai ainda no meio das variações mas ele mesmo NÃO foi vinculado (foi só ignorado,
    // fluxo normal do "Vincular Modelo ao Grupo") — grupo sem parentMapping.
    for (const [parentId, children] of childrenByParent.entries()) {
      groups.push({ parentId, parentBp: blingById.get(parentId) || null, parentMapping: null, children, headerThumb: headerThumbFor(null, children) });
    }

    return { groups, singles };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappings, blingProducts, products]);

  const handleConfirm = async (mapping: BlingProductMapping) => {
    try {
      await saveBlingMapping(mapping);
      toast.show('Produto vinculado.');
    } catch (e: any) {
      toast.show('Erro ao salvar vínculo: ' + (e.message || e));
    }
  };

  const handleIgnore = async (bp: BlingRemoteProduct) => {
    try {
      await ignoreBlingProduct({ id: bp.id, blingNome: bp.nome, ignoredAt: Date.now() });
    } catch (e: any) {
      toast.show('Erro ao ignorar produto: ' + (e.message || e));
    }
  };

  const handleUnlink = async (mapping: BlingProductMapping) => {
    try {
      await deleteBlingMapping(mapping.id);
      toast.show('Vínculo removido.');
    } catch (e: any) {
      toast.show('Erro ao remover vínculo: ' + (e.message || e));
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-32">
      <div className="flex items-center gap-2">
        <div className={`flex-1 grid grid-cols-2 gap-1 p-1 rounded-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
          <button
            onClick={() => setTab('pendentes')}
            className={`h-10 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors ${tab === 'pendentes' ? 'bg-amber-500 text-white shadow' : 'text-slate-400'}`}
          >
            Pendentes ({pendingProducts.length})
          </button>
          <button
            onClick={() => setTab('vinculados')}
            className={`h-10 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors ${tab === 'vinculados' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400'}`}
          >
            Vinculados ({mappings.length})
          </button>
        </div>
        <button
          onClick={loadBlingProducts}
          disabled={loading}
          title="Buscar catálogo do Bling"
          aria-label="Buscar catálogo do Bling"
          className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {tab === 'pendentes' ? (
        <div className="flex flex-col gap-3">
          {pendingProducts.length === 0 && !loading && (
            <div className={`p-8 rounded-[2.5rem] border-2 border-dashed text-center ${isDarkMode ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
              <p className="text-xs font-bold">Nenhum produto pendente de vinculação.</p>
            </div>
          )}

          {pendingGroups.map((group) => {
            const isOpen = expandedGroups.has(group.parentId);
            const headerLabel = group.parent?.nome || `Produto pai (SKU ${group.parent?.codigo || group.parentId})`;
            const headerCodigo = group.parent?.codigo;
            const linkedCount = group.children.filter((c) => mappingByBlingId.has(c.id)).length;
            const allLinked = linkedCount === group.children.length;
            return (
              <div key={group.parentId} className={`rounded-[2rem] border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <button
                  onClick={() => toggleGroup(group.parentId)}
                  className="w-full p-5 flex items-center gap-3 text-left"
                >
                  <Thumb src={group.parent?.imagemUrl} size={40} isDarkMode={isDarkMode} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{headerLabel}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
                      {headerCodigo ? `SKU ${headerCodigo} · ` : ''}{linkedCount}/{group.children.length} vinculada(s)
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[9px] font-black ${allLinked ? 'bg-emerald-500 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
                    {linkedCount}/{group.children.length}
                  </span>
                  {isOpen ? <ChevronUp size={18} className="text-slate-400 shrink-0" /> : <ChevronDown size={18} className="text-slate-400 shrink-0" />}
                </button>

                {isOpen && (
                  <div className={`flex flex-col gap-3 p-4 pt-0 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                    {group.parent && (
                      <div className="pt-4">
                        <p className="px-1 pb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">Produto Pai (só modelo, sem cor/numeração)</p>
                        {mappingByBlingId.has(group.parent.id) ? (
                          <LinkedRow
                            label={group.parent.nome}
                            imagemUrl={group.parent.imagemUrl}
                            mapping={mappingByBlingId.get(group.parent.id)!}
                            products={products}
                            isDarkMode={isDarkMode}
                            onUnlink={() => handleUnlink(mappingByBlingId.get(group.parent!.id)!)}
                          />
                        ) : (
                          <ParentModelPicker
                            bp={group.parent}
                            isDarkMode={isDarkMode}
                            products={products}
                            onLinkModel={(productId) => {
                              setGroupModelId((prev) => ({ ...prev, [group.parentId]: productId }));
                              handleIgnore(group.parent!);
                            }}
                            onIgnore={() => handleIgnore(group.parent!)}
                          />
                        )}
                      </div>
                    )}
                    <div className="pt-2">
                      <p className="px-1 pb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">Variações</p>
                      {!groupModelId[group.parentId] && !allLinked && (
                        <div className="mb-3 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                          <AlertTriangle size={14} className="shrink-0" />
                          <p className="text-[10px] font-bold leading-snug">Preencha o modelo no <span className="font-black">Produto Pai</span> acima primeiro — as variações abaixo já vêm com cor/tamanho pré-preenchidos automaticamente.</p>
                        </div>
                      )}
                      <div className="flex flex-col gap-3">
                        {group.children.map((bp) => {
                          const mapping = mappingByBlingId.get(bp.id);
                          if (mapping) {
                            return (
                              <LinkedRow
                                key={bp.id}
                                label={bp.nome}
                                imagemUrl={bp.imagemUrl}
                                mapping={mapping}
                                products={products}
                                isDarkMode={isDarkMode}
                                onUnlink={() => handleUnlink(mapping)}
                              />
                            );
                          }
                          const suggestion = suggestMatch(bp, localIndex);
                          return (
                            <PendingCard
                              key={bp.id}
                              bp={bp}
                              entry={suggestion.entry}
                              origin={suggestion.origin}
                              distance={suggestion.distance}
                              isDarkMode={isDarkMode}
                              products={products}
                              onConfirm={handleConfirm}
                              onIgnore={() => handleIgnore(bp)}
                              defaultProductId={groupModelId[group.parentId]}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {pendingSingles.map((bp) => {
            const suggestion = suggestMatch(bp, localIndex);
            return (
              <PendingCard
                key={bp.id}
                bp={bp}
                entry={suggestion.entry}
                origin={suggestion.origin}
                distance={suggestion.distance}
                isDarkMode={isDarkMode}
                products={products}
                onConfirm={handleConfirm}
                onIgnore={() => handleIgnore(bp)}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {mappings.length === 0 && (
            <div className={`p-8 rounded-[2.5rem] border-2 border-dashed text-center ${isDarkMode ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
              <p className="text-xs font-bold">Nenhum produto vinculado ainda.</p>
            </div>
          )}
          {blingProducts.length === 0 && mappings.length > 0 && (
            <div className={`p-3 rounded-xl text-[10px] font-bold flex items-center gap-2 ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <AlertTriangle size={13} className="shrink-0" /> Busque o catálogo do Bling (botão de atualizar acima) pra agrupar por produto pai.
            </div>
          )}

          {linkedGroups.map((group) => {
            const isOpen = expandedLinkedGroups.has(group.parentId);
            const headerLabel = group.parentBp?.nome || group.parentMapping?.blingNome || `Produto pai (SKU ${group.parentId})`;
            const headerCodigo = group.parentBp?.codigo;
            return (
              <div key={group.parentId} className={`rounded-[2rem] border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <button
                  onClick={() => toggleLinkedGroup(group.parentId)}
                  className="w-full p-5 flex items-center gap-3 text-left"
                >
                  <Thumb src={group.headerThumb || group.parentBp?.imagemUrl} size={40} isDarkMode={isDarkMode} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{headerLabel}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider truncate">
                      {headerCodigo ? `SKU ${headerCodigo} · ` : ''}{group.children.length} vinculada(s)
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded-lg text-[9px] font-black bg-emerald-500 text-white">
                    {group.children.length}
                  </span>
                  {isOpen ? <ChevronUp size={18} className="text-slate-400 shrink-0" /> : <ChevronDown size={18} className="text-slate-400 shrink-0" />}
                </button>

                {isOpen && (
                  <div className={`flex flex-col gap-3 p-4 pt-0 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                    {group.parentMapping && (
                      <div className="pt-4">
                        <p className="px-1 pb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">Produto Pai</p>
                        <LinkedRow
                          label={headerLabel}
                          imagemUrl={group.parentBp?.imagemUrl}
                          mapping={group.parentMapping}
                          products={products}
                          isDarkMode={isDarkMode}
                          onUnlink={() => handleUnlink(group.parentMapping!)}
                        />
                      </div>
                    )}
                    <div className="pt-2 flex flex-col gap-3">
                      {group.children.map((m) => (
                        <LinkedRow
                          key={m.id}
                          label={blingProductById.get(m.blingProdutoId)?.nome || m.blingNome || ''}
                          imagemUrl={blingProductById.get(m.blingProdutoId)?.imagemUrl}
                          mapping={m}
                          products={products}
                          isDarkMode={isDarkMode}
                          onUnlink={() => handleUnlink(m)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {linkedSingles.map((m) => (
            <LinkedRow
              key={m.id}
              label={blingProductById.get(m.blingProdutoId)?.nome || m.blingNome || ''}
              imagemUrl={blingProductById.get(m.blingProdutoId)?.imagemUrl}
              mapping={m}
              products={products}
              isDarkMode={isDarkMode}
              onUnlink={() => handleUnlink(m)}
            />
          ))}
        </div>
      )}

      {ignored.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          <h3 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ignorados</h3>
          <div className={`flex flex-wrap gap-2 p-3 rounded-2xl ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
            {ignored.map((i) => (
              <button
                key={i.id}
                onClick={() => unignoreBlingProduct(i.id)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-500'}`}
              >
                {i.blingNome || i.id} <XCircle size={11} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

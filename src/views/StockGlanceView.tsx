import { useState, useMemo, useEffect } from 'react';
import { Product, Grid, ProductionLot, AppModulesConfig } from '../types';
import { SaleType } from '../types';
import { ArrowLeft, Search, Boxes, Package, Filter, X, MessageSquare, MessageSquarePlus, Settings2, Grid3X3, CheckCircle2, Trash2, ClipboardList, Factory } from 'lucide-react';
import { getWholesaleBoxes, getRetailPairs, productHasSaleType } from '../utils/stockPools';
import { getOrderEffectiveSector, ORDER_FINALIZED } from '../utils/productionRoute';
import { toast } from '../utils/toast';

// Aba extra além de Atacado/Varejo — reaproveita a listagem de caixas prontas (Atacado)
// e soma o que ainda está em produção (PCP) por produto+cor, pra planejar reposição.
const REPOSICAO_TAB = 'REPOSICAO' as const;
type GlanceTab = SaleType | typeof REPOSICAO_TAB;

interface StockGlanceViewProps {
  products: Product[];
  isDarkMode: boolean;
  onBack: () => void;
  /** Observação livre por cor — única "edição" permitida nesta tela, que é só-leitura
   * pra estoque/balanço. */
  onUpdateVariationNote?: (productId: string, variationId: string, note: string) => Promise<void>;
  /** Usado só pra resolver a grade de tamanhos (defaultGridId) do modelo, no atalho
   * "Grade" do popup de observação — não exibida em mais nada nesta tela. */
  grids?: Grid[];
  /** Usado só na aba "Reposição" — soma pares ainda em produção (não finalizados) por
   * produto+cor, sem quebrar por setor. */
  lots?: ProductionLot[];
  /** Aba "Reposição" depende de dados de produção — some do seletor quando o módulo
   * Produção não está ativo (Vendas sozinho não tem "produzindo" pra mostrar). */
  modulesConfig?: AppModulesConfig;
}

type RetailSizeRow = { size: string; ready: number };
type ProductRow = { variationId: string; colorName: string; ready: number; unit: string; note?: string; sizeRows?: RetailSizeRow[]; producing?: number };
type ProductCard = { product: Product; rows: ProductRow[] };

// Mensagens rápidas pra observação por cor — mesmo padrão de "Textos Rápidos" do
// ExportNoteModal (lista configurável, persistida em localStorage).
const QUICK_MESSAGES_KEY = 'stock_note_quick_messages_v1';
const DEFAULT_QUICK_MESSAGES = ['CAIXA ABERTA FALTANDO PARES'];

function loadQuickMessages(): string[] {
  try {
    const raw = localStorage.getItem(QUICK_MESSAGES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(t => typeof t === 'string');
    }
  } catch { /* ignore */ }
  return DEFAULT_QUICK_MESSAGES;
}

function persistQuickMessages(list: string[]) {
  try { localStorage.setItem(QUICK_MESSAGES_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

/** Visão de estoque 100% somente leitura — sem opção de editar/balanço em nenhum lugar
 * desta tela, e sem informação de produção: mostra só o estoque real (Variation.stock).
 * Única exceção: observação livre por cor (não altera estoque, só anotação). */
export default function StockGlanceView({ products, isDarkMode, onBack, onUpdateVariationNote, grids = [], lots = [], modulesConfig }: StockGlanceViewProps) {
  const [activeTab, setActiveTab] = useState<GlanceTab>(SaleType.WHOLESALE);
  const showReposicaoTab = !modulesConfig || modulesConfig.production;
  // Reposição reaproveita a mesma listagem/agrupamento do Atacado (caixas prontas) — só
  // acrescenta a coluna de "produzindo" e some com a caixa de mensagens.
  const isReposicao = activeTab === REPOSICAO_TAB;
  const effectiveSaleType: SaleType = isReposicao ? SaleType.WHOLESALE : activeTab;
  const [search, setSearch] = useState('');
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [notesProductId, setNotesProductId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [gradeOpenRowId, setGradeOpenRowId] = useState<string | null>(null);
  const [gradeQty, setGradeQty] = useState<Record<string, number>>({});
  const [quickMessages, setQuickMessages] = useState<string[]>(() => loadQuickMessages());
  const [isManagingMessages, setIsManagingMessages] = useState(false);
  const [newMessageDraft, setNewMessageDraft] = useState('');
  const [viewNoteRow, setViewNoteRow] = useState<{ productId: string; variationId: string; colorName: string; note: string } | null>(null);

  const colorOptions = useMemo(() => {
    const set = new Set<string>();
    products.filter(p => productHasSaleType(p, effectiveSaleType)).forEach(p => {
      p.variations.forEach(v => { if (v.colorName) set.add(v.colorName); });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products, effectiveSaleType]);

  // Soma pares ainda em produção (sourceItems cujo item ainda não foi finalizado/creditado
  // ao estoque) por produto+cor, sem quebrar por setor — só o total, pra planejamento de
  // reposição. Um Mapa com `finishedAt` está concluído por definição, mesmo que a marcação
  // por item (`metadata.orderSectors`) tenha ficado inconsistente em algum item pontual
  // (dados antigos, de antes das correções desta conversa) — por isso o Mapa inteiro é
  // pulado aqui ANTES de olhar item por item, em vez de confiar só em orderSectors.
  const producingByVariation = useMemo(() => {
    const map = new Map<string, number>();
    const add = (productId: string | undefined, variationId: string | undefined, qty: number) => {
      if (!productId || !variationId || qty <= 0) return;
      const key = `${productId}::${variationId}`;
      map.set(key, (map.get(key) || 0) + qty);
    };
    lots.forEach(lot => {
      if (lot.finishedAt) return;
      const sourceItems: any[] = (lot as any).metadata?.sourceItems || [];
      if (sourceItems.length > 0) {
        sourceItems.forEach((si: any) => {
          if (getOrderEffectiveSector(lot, si.orderId, si) === ORDER_FINALIZED) return;
          add(si.productId, si.variationId, si.qty || 0);
        });
      } else {
        add(lot.productId, lot.variationId, lot.quantity || 0);
      }
    });
    return map;
  }, [lots]);

  const cards = useMemo((): ProductCard[] => {
    const term = search.trim().toLowerCase();
    return products
      // Reposição junta Atacado e Varejo — mostra qualquer produto que venda em um dos dois,
      // em vez de restringir a um tipo só como as outras abas.
      .filter(p => isReposicao
        ? (productHasSaleType(p, SaleType.WHOLESALE) || productHasSaleType(p, SaleType.RETAIL))
        : productHasSaleType(p, effectiveSaleType))
      .filter(p => !term || p.reference.toLowerCase().includes(term) || p.name.toLowerCase().includes(term))
      .map((product): ProductCard => {
        const includeWholesale = isReposicao ? productHasSaleType(product, SaleType.WHOLESALE) : effectiveSaleType === SaleType.WHOLESALE;
        const includeRetail = isReposicao ? productHasSaleType(product, SaleType.RETAIL) : effectiveSaleType === SaleType.RETAIL;

        const rows: ProductRow[] = product.variations
          .filter(v => !colorFilter || v.colorName === colorFilter)
          .flatMap((variation): ProductRow[] => {
            const producing = producingByVariation.get(`${product.id}::${variation.id}`) || 0;
            const variationRows: ProductRow[] = [];

            if (includeWholesale) {
              variationRows.push({
                variationId: variation.id,
                colorName: variation.colorName,
                ready: getWholesaleBoxes(product, variation),
                unit: 'cx',
                note: variation.stockNote,
                producing,
              });
            }
            if (includeRetail) {
              const readyBySize = variation.stock || {};
              const sizes = Object.keys(readyBySize)
                .filter(s => s !== 'WHOLESALE' && (readyBySize[s] || 0) > 0)
                .sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));
              variationRows.push({
                variationId: variation.id,
                colorName: variation.colorName,
                ready: getRetailPairs(product, variation),
                unit: 'pr',
                note: variation.stockNote,
                sizeRows: sizes.map(size => ({ size, ready: readyBySize[size] || 0 })),
                producing,
              });
            }
            return variationRows;
          })
          .filter(row => row.ready > 0 || (isReposicao && (row.producing || 0) > 0));
        return { product, rows };
      })
      .filter(card => card.rows.length > 0)
      .sort((a, b) => (a.product.reference || a.product.name).localeCompare(b.product.reference || b.product.name));
  }, [products, effectiveSaleType, isReposicao, search, colorFilter, producingByVariation]);
  const activeFilterCount = (search.trim() ? 1 : 0) + (colorFilter ? 1 : 0);

  const notesCard = useMemo(
    () => (notesProductId ? cards.find(c => c.product.id === notesProductId) || null : null),
    [notesProductId, cards]
  );

  const gridSizes = useMemo(() => {
    if (!notesCard) return [];
    const grid = grids.find(g => g.id === notesCard.product.defaultGridId);
    return grid?.sizes || [];
  }, [notesCard, grids]);

  // Inicializa os rascunhos de observação a cada vez que o popup abre pra um produto
  // diferente — edição fica só local até "Concluído" salvar de fato.
  useEffect(() => {
    if (!notesCard) { setNoteDrafts({}); setGradeOpenRowId(null); setGradeQty({}); return; }
    const drafts: Record<string, string> = {};
    notesCard.rows.forEach(r => { drafts[r.variationId] = r.note || ''; });
    setNoteDrafts(drafts);
    setGradeOpenRowId(null);
    setGradeQty({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesProductId]);

  const insertMessageIntoRow = (variationId: string, text: string) => {
    setNoteDrafts(prev => {
      const current = prev[variationId] || '';
      if (current.includes(text)) return prev;
      return { ...prev, [variationId]: current ? `${current}\n${text}` : text };
    });
  };

  const insertGradeIntoRow = (variationId: string) => {
    const parts = Object.entries(gradeQty)
      .filter(([, qty]) => qty > 0)
      .map(([size, qty]) => `${size} (${qty} ${qty === 1 ? 'par' : 'pares'})`);
    if (parts.length > 0) {
      const snippet = `Faltam: ${parts.join(', ')}`;
      setNoteDrafts(prev => {
        const current = prev[variationId] || '';
        return { ...prev, [variationId]: current ? `${current}\n${snippet}` : snippet };
      });
    }
    setGradeOpenRowId(null);
    setGradeQty({});
  };

  const addQuickMessage = () => {
    const text = newMessageDraft.trim().toUpperCase();
    if (!text || quickMessages.includes(text)) { setNewMessageDraft(''); return; }
    const next = [...quickMessages, text];
    setQuickMessages(next);
    persistQuickMessages(next);
    setNewMessageDraft('');
  };

  const removeQuickMessage = (idx: number) => {
    const next = quickMessages.filter((_, i) => i !== idx);
    setQuickMessages(next);
    persistQuickMessages(next);
  };

  const handleCloseNotesModal = async () => {
    if (notesCard && onUpdateVariationNote) {
      for (const row of notesCard.rows) {
        const draft = (noteDrafts[row.variationId] ?? '').trim();
        if (draft !== (row.note || '')) {
          await onUpdateVariationNote(notesCard.product.id, row.variationId, draft);
        }
      }
    }
    setNotesProductId(null);
  };

  const handleResolveViewedNote = async () => {
    if (!viewNoteRow || !onUpdateVariationNote) return;
    await onUpdateVariationNote(viewNoteRow.productId, viewNoteRow.variationId, '');
    toast.show('Observação concluída.');
    setViewNoteRow(null);
  };

  const handleDeleteViewedNote = async () => {
    if (!viewNoteRow || !onUpdateVariationNote) return;
    await onUpdateVariationNote(viewNoteRow.productId, viewNoteRow.variationId, '');
    toast.show('Observação excluída.');
    setViewNoteRow(null);
  };

  return (
    <div className="flex flex-col gap-4 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500 shadow-sm'}`}
          title="Voltar"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className={`text-base font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Disponível em Estoque</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">Somente visualização — estoque real</p>
        </div>
        <button
          type="button"
          onClick={() => setShowFilterModal(true)}
          title="Filtrar"
          aria-label="Filtrar"
          className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${activeFilterCount > 0 ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500 shadow-sm'}`}
        >
          <Filter size={16} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Abas Atacado / Varejo / Reposição */}
      <div className={`flex p-1.5 rounded-2xl border gap-1 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
        <button
          type="button"
          onClick={() => { setActiveTab(SaleType.WHOLESALE); setColorFilter(null); }}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === SaleType.WHOLESALE ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}
        >
          <Boxes size={14} /> Atacado
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab(SaleType.RETAIL); setColorFilter(null); }}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === SaleType.RETAIL ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}
        >
          <Package size={14} /> Varejo
        </button>
        {showReposicaoTab && (
          <button
            type="button"
            onClick={() => { setActiveTab(REPOSICAO_TAB); setColorFilter(null); }}
            title="Planejamento de Reposição de Estoque"
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isReposicao ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}
          >
            <ClipboardList size={14} /> Reposição
          </button>
        )}
      </div>

      {/* Cards por referência — sem acordeão, tudo sempre visível */}
      <div className="flex flex-col gap-3">
        {cards.length === 0 && (
          <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-10">Nenhum produto com estoque nesta aba.</p>
        )}
        {cards.map(card => (
          <div
            key={card.product.id}
            className={`p-4 rounded-[2rem] border shadow-sm bg-gradient-to-br ${isDarkMode ? 'from-slate-900 to-slate-900/80 border-slate-800' : 'from-white to-slate-50 border-slate-100'}`}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className={`text-[13px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {card.product.reference ? `${card.product.reference} — ` : ''}{card.product.name}
              </h3>
              {isReposicao && (() => {
                const hasWholesale = card.rows.some(r => r.unit === 'cx');
                const hasRetail = card.rows.some(r => r.unit === 'pr');
                const label = hasWholesale && hasRetail ? 'Atacado + Varejo' : hasWholesale ? 'Atacado' : 'Varejo';
                return (
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                    hasWholesale && !hasRetail
                      ? (isDarkMode ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-700')
                      : !hasWholesale && hasRetail
                        ? (isDarkMode ? 'bg-sky-500/15 text-sky-400' : 'bg-sky-100 text-sky-700')
                        : (isDarkMode ? 'bg-violet-500/15 text-violet-400' : 'bg-violet-100 text-violet-700')
                  }`}>
                    {label}
                  </span>
                );
              })()}
              {onUpdateVariationNote && !isReposicao && (
                <button
                  type="button"
                  onClick={() => setNotesProductId(card.product.id)}
                  title="Adicionar observação por cor"
                  aria-label="Adicionar observação por cor"
                  className={`shrink-0 p-1.5 rounded-lg transition-all ${card.rows.some(r => r.note) ? (isDarkMode ? 'text-amber-400 bg-amber-500/10' : 'text-amber-500 bg-amber-50') : isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <MessageSquarePlus size={16} />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {card.rows.map(row => (
                <div key={`${row.variationId}-${row.unit}`} className={`flex flex-col gap-1.5 p-2.5 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50/80'}`}>
                  {/* Quantidade sempre na frente da cor — observação fica na outra extremidade */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[13px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{row.ready} {row.unit}</span>
                      <span className={`text-[11px] font-bold uppercase tracking-tight truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{row.colorName}</span>
                    </div>
                    {!isReposicao && row.note && (
                      <button
                        type="button"
                        onClick={() => setViewNoteRow({ productId: card.product.id, variationId: row.variationId, colorName: row.colorName, note: row.note! })}
                        title={row.note}
                        aria-label={`Observação de ${row.colorName}: ${row.note}`}
                        className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-full animate-pulse-amber-ring ${isDarkMode ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-600'}`}
                      >
                        <MessageSquare size={14} className={isDarkMode ? 'fill-amber-500/20' : 'fill-amber-200'} />
                      </button>
                    )}
                  </div>

                  {isReposicao && (
                    <div className="flex items-center gap-1.5">
                      <Factory size={12} className="text-indigo-400 shrink-0" />
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-indigo-300' : 'text-indigo-600'}`}>
                        Produzindo: {row.producing || 0} pares
                      </span>
                    </div>
                  )}

                  {row.unit === 'pr' && (
                    <div className="flex flex-wrap gap-1.5">
                      {(row.sizeRows || []).map(sr => (
                        <div
                          key={sr.size}
                          className={`flex flex-col items-center justify-center min-w-[42px] px-2 py-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}
                        >
                          <span className={`text-[12px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{sr.ready}</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase">{sr.size}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Popup de filtros — centralizado, evita o aperto de busca+chips direto na tela */}
      {showFilterModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setShowFilterModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-[2rem] shadow-2xl flex flex-col max-h-[80vh] ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className="p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Filtrar Produtos</h3>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                title="Fechar"
                aria-label="Fechar"
                className={`w-8 h-8 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Referência</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Buscar por referência..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    title="Buscar por referência"
                    aria-label="Buscar por referência"
                    autoFocus
                    className={`w-full py-3 pl-11 pr-4 rounded-2xl border text-[11px] font-bold uppercase tracking-tight outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-800 placeholder:text-slate-300'}`}
                  />
                </div>
              </div>

              {colorOptions.length > 0 && (
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Cor</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setColorFilter(null)}
                      className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${!colorFilter ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
                    >
                      Todas as cores
                    </button>
                    {colorOptions.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setColorFilter(prev => prev === color ? null : color)}
                        className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${colorFilter === color ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 pt-2 shrink-0 flex gap-2">
              <button
                type="button"
                onClick={() => { setSearch(''); setColorFilter(null); }}
                className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup — Observação por cor (única "edição" permitida nesta tela) */}
      {notesCard && onUpdateVariationNote && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={handleCloseNotesModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm max-h-[85vh] flex flex-col rounded-[2rem] shadow-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className="p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="min-w-0">
                <h3 className={`text-sm font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Observações por Cor</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5 truncate">
                  {notesCard.product.reference ? `${notesCard.product.reference} — ` : ''}{notesCard.product.name}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseNotesModal}
                title="Fechar"
                aria-label="Fechar"
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5 overflow-y-auto">
              {notesCard.rows.map(row => {
                const draft = noteDrafts[row.variationId] ?? '';
                const isGradeOpen = gradeOpenRowId === row.variationId;
                return (
                  <div key={row.variationId} className="flex flex-col gap-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">{row.colorName}</label>
                    <textarea
                      value={draft}
                      onChange={(e) => setNoteDrafts(prev => ({ ...prev, [row.variationId]: e.target.value }))}
                      placeholder="Adicionar observação sobre esta cor..."
                      title={`Observação — ${row.colorName}`}
                      className={`w-full px-3 py-2.5 rounded-xl text-[12px] font-bold outline-none border resize-none h-16 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-700 placeholder:text-slate-400'}`}
                    />

                    {/* Mensagens rápidas + atalho de Grade */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {quickMessages.map((msg, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => insertMessageIntoRow(row.variationId, msg)}
                          title={msg}
                          className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest truncate max-w-[140px] transition-all ${isDarkMode ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600' : 'bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300'}`}
                        >
                          {msg}
                        </button>
                      ))}
                      {activeTab === SaleType.WHOLESALE && (
                        <button
                          type="button"
                          onClick={() => {
                            setGradeOpenRowId(isGradeOpen ? null : row.variationId);
                            setGradeQty({});
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${isGradeOpen ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}
                        >
                          <Grid3X3 size={14} /> Grade
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsManagingMessages(true)}
                        title="Configurar mensagens rápidas"
                        aria-label="Configurar mensagens rápidas"
                        className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                      >
                        <Settings2 size={14} />
                      </button>
                    </div>

                    {/* Atalho de Grade — escolhe quantos pares faltam por tamanho (ex.: caixa aberta) */}
                    {isGradeOpen && (
                      <div className={`p-3 rounded-xl border flex flex-col gap-2.5 ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        {gridSizes.length === 0 ? (
                          <p className="text-[10px] font-bold text-slate-400">Nenhuma grade de tamanhos cadastrada para este modelo.</p>
                        ) : (
                          <>
                            <div className="flex flex-wrap gap-2">
                              {gridSizes.map(size => (
                                <div key={size} className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                  <span className="text-[9px] font-black text-slate-400 uppercase">{size}</span>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    value={gradeQty[size] || ''}
                                    onChange={(e) => setGradeQty(prev => ({ ...prev, [size]: Math.max(0, Number(e.target.value) || 0) }))}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="0"
                                    title={`Pares faltando no tamanho ${size}`}
                                    aria-label={`Pares faltando no tamanho ${size}`}
                                    className={`w-9 text-center text-[12px] font-black outline-none bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                                  />
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => insertGradeIntoRow(row.variationId)}
                              className="py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white active:scale-95 transition-all"
                            >
                              Inserir na Observação
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-5 pt-2 shrink-0">
              <button
                type="button"
                onClick={handleCloseNotesModal}
                className="w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup — Configurar mensagens rápidas */}
      {isManagingMessages && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setIsManagingMessages(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-xs flex flex-col max-h-[70vh] rounded-[2rem] shadow-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h4 className={`text-xs font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Mensagens Rápidas</h4>
              <button
                type="button"
                onClick={() => setIsManagingMessages(false)}
                title="Fechar"
                aria-label="Fechar"
                className={`w-7 h-7 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2 overflow-y-auto">
              {quickMessages.map((msg, i) => (
                <div key={i} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-tight truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{msg}</span>
                  <button
                    type="button"
                    onClick={() => removeQuickMessage(i)}
                    title="Remover"
                    aria-label={`Remover mensagem ${msg}`}
                    className="text-rose-500 shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {quickMessages.length === 0 && (
                <p className="text-[10px] font-bold text-slate-400 text-center py-2">Nenhuma mensagem configurada.</p>
              )}
            </div>
            <div className="p-4 pt-2 shrink-0 flex gap-2">
              <input
                type="text"
                value={newMessageDraft}
                onChange={(e) => setNewMessageDraft(e.target.value)}
                placeholder="Nova mensagem..."
                title="Nova mensagem rápida"
                aria-label="Nova mensagem rápida"
                onKeyDown={(e) => { if (e.key === 'Enter') addQuickMessage(); }}
                className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold outline-none border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-700 placeholder:text-slate-400'}`}
              />
              <button
                type="button"
                onClick={addQuickMessage}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white shrink-0"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup — Observação de uma cor (atalho do ícone pulsante) */}
      {viewNoteRow && onUpdateVariationNote && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setViewNoteRow(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-xs rounded-[2rem] shadow-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
          >
            <div className="p-5 flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                  <MessageSquare size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Observação</p>
                  <p className={`text-sm font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{viewNoteRow.colorName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewNoteRow(null)}
                title="Fechar"
                aria-label="Fechar"
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              <p className={`text-[13px] font-bold whitespace-pre-wrap leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{viewNoteRow.note}</p>
            </div>

            <div className="p-5 pt-0 flex gap-2">
              <button
                type="button"
                onClick={handleDeleteViewedNote}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
              >
                <Trash2 size={14} /> Excluir
              </button>
              <button
                type="button"
                onClick={handleResolveViewedNote}
                className="flex-[1.3] flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all hover:bg-emerald-700"
              >
                <CheckCircle2 size={14} /> Concluído
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

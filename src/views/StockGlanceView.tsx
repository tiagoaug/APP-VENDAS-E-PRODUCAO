import { useState, useMemo } from 'react';
import { Product } from '../types';
import { SaleType } from '../types';
import { ArrowLeft, Search, Boxes, Package, Filter, X } from 'lucide-react';
import { getWholesaleBoxes, getRetailPairs, productHasSaleType } from '../utils/stockPools';

interface StockGlanceViewProps {
  products: Product[];
  isDarkMode: boolean;
  onBack: () => void;
}

type RetailSizeRow = { size: string; ready: number };
type ProductRow = { variationId: string; colorName: string; ready: number; sizeRows?: RetailSizeRow[] };
type ProductCard = { product: Product; rows: ProductRow[] };

/** Visão de estoque 100% somente leitura — sem opção de editar/balanço em nenhum lugar
 * desta tela, e sem informação de produção: mostra só o estoque real (Variation.stock). */
export default function StockGlanceView({ products, isDarkMode, onBack }: StockGlanceViewProps) {
  const [activeTab, setActiveTab] = useState<SaleType>(SaleType.WHOLESALE);
  const [search, setSearch] = useState('');
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const colorOptions = useMemo(() => {
    const set = new Set<string>();
    products.filter(p => productHasSaleType(p, activeTab)).forEach(p => {
      p.variations.forEach(v => { if (v.colorName) set.add(v.colorName); });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products, activeTab]);

  const cards = useMemo((): ProductCard[] => {
    const term = search.trim().toLowerCase();
    return products
      .filter(p => productHasSaleType(p, activeTab))
      .filter(p => !term || p.reference.toLowerCase().includes(term) || p.name.toLowerCase().includes(term))
      .map((product): ProductCard => {
        const rows: ProductRow[] = product.variations
          .filter(v => !colorFilter || v.colorName === colorFilter)
          .map((variation): ProductRow => {
            if (activeTab === SaleType.WHOLESALE) {
              return {
                variationId: variation.id,
                colorName: variation.colorName,
                ready: getWholesaleBoxes(product, variation),
              };
            }
            const readyBySize = variation.stock || {};
            const sizes = Object.keys(readyBySize)
              .filter(s => s !== 'WHOLESALE' && (readyBySize[s] || 0) > 0)
              .sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));
            return {
              variationId: variation.id,
              colorName: variation.colorName,
              ready: getRetailPairs(product, variation),
              sizeRows: sizes.map(size => ({ size, ready: readyBySize[size] || 0 })),
            };
          })
          .filter(row => row.ready > 0);
        return { product, rows };
      })
      .filter(card => card.rows.length > 0)
      .sort((a, b) => (a.product.reference || a.product.name).localeCompare(b.product.reference || b.product.name));
  }, [products, activeTab, search, colorFilter]);

  const unit = activeTab === SaleType.WHOLESALE ? 'cx' : 'pr';
  const activeFilterCount = (search.trim() ? 1 : 0) + (colorFilter ? 1 : 0);

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

      {/* Abas Atacado / Varejo */}
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
            <h3 className={`text-[13px] font-black uppercase tracking-tight mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {card.product.reference ? `${card.product.reference} — ` : ''}{card.product.name}
            </h3>

            <div className="flex flex-col gap-2">
              {card.rows.map(row => (
                <div key={row.variationId} className={`flex flex-col gap-1.5 p-2.5 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50/80'}`}>
                  {/* Quantidade sempre na frente da cor */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{row.ready} {unit}</span>
                    <span className={`text-[11px] font-bold uppercase tracking-tight ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{row.colorName}</span>
                  </div>

                  {activeTab === SaleType.RETAIL && (
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
    </div>
  );
}

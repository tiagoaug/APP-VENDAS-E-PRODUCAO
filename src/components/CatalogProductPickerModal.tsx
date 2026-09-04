import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Product, ProductStatus, Category, CatalogProfile, Brand } from '../types';
import { X, Search, Check, Bookmark, Trash2, Save } from 'lucide-react';

interface CatalogProductPickerModalProps {
  onClose: () => void;
  products: Product[];
  categories: Category[];
  brands?: Brand[];
  profiles: CatalogProfile[];
  // Vazio = "Catálogo completo" (todos os produtos ativos, sem restrição).
  initialSelectedIds: string[];
  // true = o catálogo enviado por esse link não mostra preço nenhum dos produtos.
  initialHidePrices?: boolean;
  isDarkMode: boolean;
  onConfirm: (productIds: string[], hidePrices: boolean) => void;
  onSaveProfile: (name: string, productIds: string[]) => Promise<void>;
  onDeleteProfile: (profileId: string) => Promise<void>;
}

export default function CatalogProductPickerModal({
  onClose,
  products,
  categories,
  brands = [],
  profiles,
  initialSelectedIds,
  initialHidePrices = false,
  isDarkMode,
  onConfirm,
  onSaveProfile,
  onDeleteProfile,
}: CatalogProductPickerModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedIds));
  const [allSelectedMode, setAllSelectedMode] = useState(initialSelectedIds.length === 0);
  const [hidePrices, setHidePrices] = useState(initialHidePrices);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [profileNameInput, setProfileNameInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);

  const activeProducts = useMemo(() => products.filter(p => p.status === ProductStatus.ACTIVE), [products]);

  const categoryOptions = useMemo(() => {
    const usedIds = new Set(activeProducts.map(p => p.categoryId).filter(Boolean));
    return categories.filter(c => usedIds.has(c.id));
  }, [activeProducts, categories]);

  const brandName = (brandId?: string) => brands.find(b => b.id === brandId)?.name || '';

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activeProducts.filter(p => {
      if (categoryFilter !== 'ALL' && p.categoryId !== categoryFilter) return false;
      if (term && !p.name.toLowerCase().includes(term) && !p.reference.toLowerCase().includes(term) && !brandName(p.brandId).toLowerCase().includes(term)) return false;
      return true;
    });
  }, [activeProducts, search, categoryFilter, brands]);

  const isChecked = (productId: string) => allSelectedMode || selected.has(productId);

  const toggleProduct = (productId: string) => {
    if (allSelectedMode) {
      // Sair do "catálogo completo" pra seleção manual: começa com todos marcados, exceto
      // o que acabou de ser desmarcado.
      setAllSelectedMode(false);
      setSelected(new Set(activeProducts.filter(p => p.id !== productId).map(p => p.id)));
      return;
    }
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleApplyProfile = (profile: CatalogProfile) => {
    setAllSelectedMode(false);
    setSelected(new Set(profile.productIds));
  };

  const handleConfirm = () => {
    onConfirm(allSelectedMode ? [] : Array.from(selected), hidePrices);
    onClose();
  };

  const handleSaveProfile = async () => {
    const name = profileNameInput.trim();
    if (!name || savingProfile) return;
    const productIds = allSelectedMode ? activeProducts.map(p => p.id) : Array.from(selected);
    if (productIds.length === 0) return;
    setSavingProfile(true);
    try {
      await onSaveProfile(name, productIds);
      setProfileNameInput('');
    } finally {
      setSavingProfile(false);
    }
  };

  const selectedCount = allSelectedMode ? activeProducts.length : selected.size;

  return createPortal(
    <div className="fixed inset-0 z-[70000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md max-h-[88vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
      >
        <div className={`flex items-center justify-between px-6 py-5 border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div>
            <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Produtos do Catálogo</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{selectedCount} de {activeProducts.length} selecionados</p>
          </div>
          <button type="button" onClick={onClose} className={`p-2 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`} aria-label="Fechar">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4 pb-2 shrink-0">
          <button
            type="button"
            onClick={() => { setAllSelectedMode(true); setSelected(new Set()); }}
            className={`flex items-center justify-between gap-2 p-3 rounded-xl text-left transition-all active:scale-[0.98] ${allSelectedMode ? 'bg-indigo-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'}`}
          >
            <span className="text-[11px] font-black uppercase tracking-widest">Catálogo Completo (todos os produtos)</span>
            {allSelectedMode && <Check size={16} strokeWidth={3} />}
          </button>

          <div className={`flex items-center justify-between gap-3 p-3 rounded-xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
            <div className="min-w-0">
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Enviar sem valores</p>
              <p className="text-[9px] font-bold text-slate-400 mt-0.5">Cliente escolhe modelo/cor/quantidade sem ver preço</p>
            </div>
            <button
              type="button"
              onClick={() => setHidePrices(prev => !prev)}
              className={`w-12 h-6 rounded-full relative shrink-0 transition-colors ${hidePrices ? 'bg-indigo-600' : isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}
              aria-label={hidePrices ? "Mostrar preços" : "Ocultar preços"}
              title={hidePrices ? "Mostrar preços" : "Ocultar preços"}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${hidePrices ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {profiles.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Perfis Salvos</label>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {profiles.map(profile => (
                  <div key={profile.id} className="shrink-0 flex items-center">
                    <button
                      type="button"
                      onClick={() => handleApplyProfile(profile)}
                      className={`flex items-center gap-1.5 pl-3 pr-2 py-2 rounded-l-xl rounded-r-none text-[10px] font-black uppercase tracking-wide ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                      title={`Usar seleção do perfil "${profile.name}"`}
                    >
                      <Bookmark size={12} /> {profile.name}
                    </button>
                    <button
                      type="button"
                      disabled={deletingProfileId === profile.id}
                      onClick={async () => {
                        if (!confirm(`Excluir o perfil "${profile.name}"? Não afeta links já enviados.`)) return;
                        setDeletingProfileId(profile.id);
                        try { await onDeleteProfile(profile.id); } finally { setDeletingProfileId(null); }
                      }}
                      className={`p-2 rounded-r-xl disabled:opacity-50 ${isDarkMode ? 'bg-slate-800 text-rose-400' : 'bg-slate-100 text-rose-500'}`}
                      title="Excluir perfil"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome, referência ou marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`}
            />
          </div>

          {categoryOptions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Categoria</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ALL')}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide ${categoryFilter === 'ALL' ? 'bg-slate-900 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                >Todas Categorias</button>
                {categoryOptions.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryFilter(c.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide ${categoryFilter === c.id ? 'bg-slate-900 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                  >{c.name}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 p-4 pt-2 overflow-y-auto">
          {filteredProducts.map(product => (
            <button
              key={product.id}
              type="button"
              onClick={() => toggleProduct(product.id)}
              className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all active:scale-[0.98] ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
            >
              {product.photoUrl ? (
                <img src={product.photoUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover shrink-0 bg-slate-100" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{product.reference} {product.name}</p>
                {!!brandName(product.brandId) && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{brandName(product.brandId)}</p>}
              </div>
              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-2 ${isChecked(product.id) ? 'bg-indigo-600 border-indigo-600' : isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                {isChecked(product.id) && <Check size={12} strokeWidth={3.5} className="text-white" />}
              </div>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <p className="text-[10px] text-slate-400 font-bold text-center py-6 uppercase tracking-widest">Nenhum produto encontrado</p>
          )}
        </div>

        <div className={`flex flex-col gap-2 p-4 border-t shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          {!allSelectedMode && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Salvar seleção como perfil..."
                value={profileNameInput}
                onChange={(e) => setProfileNameInput(e.target.value)}
                className={`flex-1 min-w-0 px-3 py-2.5 rounded-xl text-xs font-bold outline-none ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`}
              />
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={!profileNameInput.trim() || selectedCount === 0 || savingProfile}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                <Save size={14} /> Salvar
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="w-full py-3 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
          >
            Confirmar ({selectedCount})
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

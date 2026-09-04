import { useEffect, useMemo, useState } from 'react';
import { getPublicCatalogRequest, submitCatalogRequestCall } from './firebaseClient';

type CatalogVariation = {
  variationId: string;
  colorName: string;
  photoUrl?: string;
  photoAlbum?: string[];
  saleType: 'RETAIL' | 'WHOLESALE';
  sizes: { size?: string; available: number }[];
};

type CatalogProduct = {
  productId: string;
  reference: string;
  name: string;
  photoUrl?: string;
  brandName?: string;
  categoryId?: string;
  categoryName?: string;
  pricePerPair?: number;
  pricePerBox?: number;
  variations: CatalogVariation[];
};

function readTokenFromUrl(): string {
  const path = window.location.pathname;
  const match = path.match(/\/pedido\/([^/]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return new URLSearchParams(window.location.search).get('token') || '';
}

function cartKey(productId: string, variationId: string, size?: string) {
  return `${productId}::${variationId}::${size || ''}`;
}

function formatPrice(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PublicCatalogApp() {
  const [status, setStatus] = useState<'loading' | 'error' | 'browsing' | 'submitting' | 'success'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerNote, setCustomerNote] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [brandFilter, setBrandFilter] = useState<string>('ALL');
  const token = useMemo(readTokenFromUrl, []);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) if (p.categoryId && p.categoryName) map.set(p.categoryId, p.categoryName);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [products]);

  const brandOptions = useMemo(() => {
    return Array.from(new Set(products.map(p => p.brandName).filter((b): b is string => !!b))).sort();
  }, [products]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'ALL' && p.categoryId !== categoryFilter) return false;
      if (brandFilter !== 'ALL' && p.brandName !== brandFilter) return false;
      if (term && !p.name.toLowerCase().includes(term) && !p.reference.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [products, search, categoryFilter, brandFilter]);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Link inválido — verifique se copiou o endereço completo.');
      return;
    }
    getPublicCatalogRequest({ token })
      .then((res) => {
        setProducts(res.data.products || []);
        setStatus('browsing');
      })
      .catch(() => {
        setStatus('error');
        setErrorMessage('Este link é inválido ou já expirou. Peça um novo link.');
      });
  }, [token]);

  const setQty = (productId: string, variationId: string, size: string | undefined, available: number, value: number) => {
    const clamped = Math.max(0, Math.min(available, Math.floor(value) || 0));
    setCart((prev) => {
      const next = { ...prev };
      const key = cartKey(productId, variationId, size);
      if (clamped === 0) delete next[key];
      else next[key] = clamped;
      return next;
    });
  };

  const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  // Preço unitário de cada linha do carrinho: caixa (sem tamanho) usa pricePerBox, par (com
  // tamanho) usa pricePerPair. Ausente em qualquer um dos dois quando o link está com "sem
  // valores" — nesse caso hasAnyPrice fica false e o Total nem aparece.
  let totalValue = 0;
  let hasAnyPrice = false;
  for (const product of products) {
    for (const variation of product.variations) {
      for (const s of variation.sizes) {
        const key = cartKey(product.productId, variation.variationId, s.size);
        const qty = cart[key];
        if (!qty) continue;
        const unitPrice = s.size ? product.pricePerPair : product.pricePerBox;
        if (unitPrice !== undefined) {
          hasAnyPrice = true;
          totalValue += unitPrice * qty;
        }
      }
    }
  }

  const handleSubmit = async () => {
    const itemsByProductType = new Map<string, { productId: string; saleType: 'RETAIL' | 'WHOLESALE'; variations: { variationId: string; size?: string; quantity: number }[] }>();

    for (const product of products) {
      for (const variation of product.variations) {
        for (const s of variation.sizes) {
          const key = cartKey(product.productId, variation.variationId, s.size);
          const qty = cart[key];
          if (!qty) continue;
          const mapKey = `${product.productId}::${variation.saleType}`;
          if (!itemsByProductType.has(mapKey)) {
            itemsByProductType.set(mapKey, { productId: product.productId, saleType: variation.saleType, variations: [] });
          }
          itemsByProductType.get(mapKey)!.variations.push({
            variationId: variation.variationId,
            ...(s.size ? { size: s.size } : {}),
            quantity: qty,
          });
        }
      }
    }

    const items = Array.from(itemsByProductType.values());
    if (items.length === 0) return;

    setStatus('submitting');
    try {
      await submitCatalogRequestCall({ token, items, customerNote: customerNote.trim() || undefined });
      setStatus('success');
    } catch {
      setStatus('browsing');
      setErrorMessage('Não foi possível enviar o pedido agora. Tente novamente em instantes.');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 border-[3px] border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
          <span className="absolute text-xl animate-pulse" role="img" aria-label="Carregando">🕐</span>
        </div>
        <p className="text-xs font-bold text-slate-400 max-w-[220px] leading-relaxed">
          Pode demorar um pouco pra abrir, enquanto o catálogo carrega...
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
        <p className="text-sm font-bold text-slate-500">{errorMessage}</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center gap-3">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl">✓</div>
        <h1 className="text-lg font-black text-slate-900">Pedido enviado!</h1>
        <p className="text-sm text-slate-500 font-medium max-w-xs">Recebemos sua escolha e vamos confirmar com você em breve.</p>
      </div>
    );
  }

  return (
    // h-screen + overflow-y-auto (não min-h-screen) — o próprio div vira o container de rolagem,
    // em vez de depender do <body> rolar sozinho (que não estava funcionando em algumas
    // combinações de navegador/CSS herdado do bundle principal do app).
    <div className="h-screen overflow-y-auto bg-slate-50 pb-32">
      <header className="bg-white border-b border-slate-100 px-4 py-5 sticky top-0 z-10 flex flex-col gap-3">
        <div>
          <h1 className="text-base font-black uppercase tracking-tight text-slate-900">Catálogo</h1>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Escolha os produtos e quantidades</p>
        </div>
        {products.length > 0 && (
          <>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou referência..."
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-400"
            />
            {categoryOptions.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ALL')}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide ${categoryFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
                >Todas Categorias</button>
                {categoryOptions.map(([id, name]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategoryFilter(id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide ${categoryFilter === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}
                  >{name}</button>
                ))}
              </div>
            )}
            {brandOptions.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
                <button
                  type="button"
                  onClick={() => setBrandFilter('ALL')}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide ${brandFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-500'}`}
                >Todas Marcas</button>
                {brandOptions.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrandFilter(b)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide ${brandFilter === b ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-500'}`}
                  >{b}</button>
                ))}
              </div>
            )}
          </>
        )}
      </header>

      {errorMessage && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold">{errorMessage}</div>
      )}

      <div className="p-4 flex flex-col gap-4">
        {products.length === 0 && (
          <p className="text-center text-sm text-slate-400 font-bold py-16">Nenhum produto disponível no momento.</p>
        )}
        {products.length > 0 && visibleProducts.length === 0 && (
          <p className="text-center text-sm text-slate-400 font-bold py-16">Nenhum produto encontrado com esse filtro.</p>
        )}
        {visibleProducts.map((product) => (
          <div key={product.productId} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              {product.photoUrl ? (
                <img src={product.photoUrl} alt={product.name} className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-100 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{product.reference}</p>
                <p className="text-sm font-black text-slate-900 truncate">{product.name}</p>
                {product.pricePerPair !== undefined && (
                  <p className="text-sm font-black text-emerald-600 mt-0.5">{formatPrice(product.pricePerPair)} <span className="text-[10px] font-bold text-slate-400 uppercase">/par</span></p>
                )}
                {product.pricePerBox !== undefined && (
                  <p className="text-sm font-black text-emerald-600 mt-0.5">{formatPrice(product.pricePerBox)} <span className="text-[10px] font-bold text-slate-400 uppercase">/caixa</span></p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 px-4 pb-4">
              {product.variations.map((variation) => (
                <div key={variation.variationId} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {variation.photoUrl && <img src={variation.photoUrl} alt={variation.colorName} className="w-8 h-8 rounded-lg object-cover" />}
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-600">{variation.colorName}</p>
                  </div>
                  {variation.photoAlbum && variation.photoAlbum.length > 0 && (
                    <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar">
                      {variation.photoAlbum.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`${variation.colorName} — foto ${idx + 1}`}
                          onClick={() => setLightboxUrl(url)}
                          className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-200 cursor-pointer active:scale-95 transition-all"
                        />
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {variation.sizes.map((s) => {
                      const key = cartKey(product.productId, variation.variationId, s.size);
                      const qty = cart[key] || 0;
                      return (
                        <div key={key} className="flex items-center justify-between gap-1.5 bg-white rounded-lg border border-slate-200 px-2 py-1.5">
                          <span className="text-[11px] font-bold text-slate-500 shrink-0">{s.size || 'Cx'}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setQty(product.productId, variation.variationId, s.size, s.available, qty - 1)}
                              className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 font-black text-sm active:scale-90 shrink-0"
                            >-</button>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={qty || ''}
                              onChange={(e) => setQty(product.productId, variation.variationId, s.size, s.available, Number(e.target.value))}
                              className="w-8 text-center text-sm font-black outline-none"
                              placeholder="0"
                            />
                            <button
                              type="button"
                              onClick={() => setQty(product.productId, variation.variationId, s.size, s.available, qty + 1)}
                              className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 font-black text-sm active:scale-90 shrink-0"
                            >+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {products.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observação (opcional)</label>
            <textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value.slice(0, 500))}
              rows={3}
              className="w-full mt-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm outline-none"
              placeholder="Alguma informação extra sobre o pedido..."
            />
          </div>
        )}
      </div>

      {totalItems > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-20 flex flex-col gap-2">
          {hasAnyPrice && (
            <div className="flex items-center justify-between px-5 py-2.5 rounded-2xl bg-white border border-slate-100 shadow-xl">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total do Pedido</span>
              <span className="text-base font-black text-emerald-600">{formatPrice(totalValue)}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={status === 'submitting'}
            className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest text-sm shadow-2xl active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {status === 'submitting' ? 'Enviando...' : `Enviar Pedido (${totalItems})`}
          </button>
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-30 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="Foto ampliada" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}

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

function formatCountdown(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export default function PublicCatalogApp() {
  const [status, setStatus] = useState<'loading' | 'error' | 'browsing' | 'submitting' | 'success' | 'expired'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerNote, setCustomerNote] = useState('');
  // Observação POR PRODUTO (ex.: "pedido no saquinho, embalagem desmontada") — diferente da
  // observação geral do pedido acima; ambas viajam junto no envio (ver handleSubmit).
  const [productNotes, setProductNotes] = useState<Record<string, string>>({});
  // true = Link de Grupo — sem cliente vinculado, precisa perguntar o nome antes de enviar.
  const [isGeneric, setIsGeneric] = useState(false);
  const [customerName, setCustomerName] = useState('');
  // Contador regressivo do topo — null = link sem expiração (não mostra nada). A validação de
  // verdade continua sempre no servidor (resolveCatalogLink); isso é só UX pra travar a página
  // sozinha quando o tempo acaba, em vez do cliente só descobrir no erro do envio.
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Lightbox — guarda a galeria inteira (não só a foto tocada) pra dar pra avançar/voltar entre
  // as fotos da mesma cor sem fechar e reabrir. openLightbox acha o índice de partida a partir
  // da URL tocada, então funciona igual clicando no ícone da cor ou em qualquer miniatura do álbum.
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const openLightbox = (images: string[], startUrl: string) => {
    const filtered = images.filter(Boolean);
    if (filtered.length === 0) return;
    const index = Math.max(0, filtered.indexOf(startUrl));
    setLightbox({ images: filtered, index });
  };
  // Link configurado pra mostrar quanto tem em estoque, só como referência (o cliente escolhe
  // livremente a quantidade, sempre a partir de zero — nunca pré-marcado como se fosse levar
  // tudo). Ver CatalogLink.useStockQuantities.
  const [showStockQuantities, setShowStockQuantities] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [brandFilter, setBrandFilter] = useState<string>('ALL');
  // Categorias/Marcas começam fechadas — em tela pequena esses chips tomavam metade da tela
  // logo de cara; só abre quando alguém realmente quer filtrar.
  const [categoriesSectionOpen, setCategoriesSectionOpen] = useState(false);
  // Botão "Atualizar Catálogo" — a página só busca preço/estoque uma vez, no carregamento (ver
  // loadCatalog abaixo); se ficar aberta um tempo, precisa recarregar manualmente pra ver mudança
  // feita pelo vendedor nesse meio tempo (nunca fica ouvindo mudança em tempo real).
  const [refreshing, setRefreshing] = useState(false);
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

  const loadCatalog = (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setStatus('loading');
    getPublicCatalogRequest({ token })
      .then((res) => {
        setProducts(res.data.products || []);
        // Mostra quanto tem em estoque, só como referência — o cliente sempre começa do zero
        // e escolhe livremente a quantidade (o clamp em setQty já limita ao disponível).
        setShowStockQuantities(!!res.data.useStockQuantities);
        setIsGeneric(!!res.data.isGeneric);
        setExpiresAt(res.data.expiresAt ?? null);
        setErrorMessage('');
        // Se o link já venceu bem no instante do carregamento (raro, mas possível), trava direto
        // em vez de abrir o catálogo por uma fração de segundo antes do efeito de contagem agir.
        setStatus(res.data.expiresAt && res.data.expiresAt <= Date.now() ? 'expired' : 'browsing');
      })
      .catch(() => {
        if (isRefresh) {
          setErrorMessage('Não foi possível atualizar agora. Tente de novo em instantes.');
        } else {
          setStatus('error');
          setErrorMessage('Este link é inválido ou já expirou. Peça um novo link.');
        }
      })
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Link inválido — verifique se copiou o endereço completo.');
      return;
    }
    loadCatalog(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Contador regressivo + trava automática — só liga o intervalo quando o link tem expiração e
  // a página está em uso (não faz sentido continuar contando na tela de sucesso, por exemplo).
  useEffect(() => {
    if (!expiresAt || (status !== 'browsing' && status !== 'submitting')) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt, status]);

  useEffect(() => {
    if (expiresAt && now >= expiresAt && (status === 'browsing' || status === 'submitting')) {
      setStatus('expired');
    }
  }, [now, expiresAt, status]);

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
    const itemsByProductType = new Map<string, { productId: string; saleType: 'RETAIL' | 'WHOLESALE'; variations: { variationId: string; size?: string; quantity: number }[]; note?: string }>();

    for (const product of products) {
      for (const variation of product.variations) {
        for (const s of variation.sizes) {
          const key = cartKey(product.productId, variation.variationId, s.size);
          const qty = cart[key];
          if (!qty) continue;
          const mapKey = `${product.productId}::${variation.saleType}`;
          if (!itemsByProductType.has(mapKey)) {
            const note = productNotes[product.productId]?.trim();
            itemsByProductType.set(mapKey, { productId: product.productId, saleType: variation.saleType, variations: [], ...(note ? { note } : {}) });
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
    if (isGeneric && !customerName.trim()) {
      setErrorMessage('Informe seu nome antes de enviar o pedido.');
      return;
    }

    setStatus('submitting');
    try {
      await submitCatalogRequestCall({
        token,
        items,
        customerNote: customerNote.trim() || undefined,
        ...(isGeneric ? { customerName: customerName.trim() } : {}),
      });
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

  if (status === 'expired') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-3xl">⏱</div>
        <h1 className="text-lg font-black text-slate-900">Catálogo expirado</h1>
        <p className="text-sm text-slate-500 font-medium max-w-xs">
          Este link não vale mais. Entre em contato com quem te enviou e peça um novo link.
        </p>
      </div>
    );
  }

  if (status === 'success') {
    // `cart`/`products` continuam com o que foi enviado (não são limpos após o envio) — dá
    // pra remontar o resumo do pedido aqui sem guardar nada a mais.
    const summaryLines: { key: string; label: string; sizeLabel: string; qty: number; unitPrice?: number }[] = [];
    for (const product of products) {
      for (const variation of product.variations) {
        for (const s of variation.sizes) {
          const key = cartKey(product.productId, variation.variationId, s.size);
          const qty = cart[key];
          if (!qty) continue;
          summaryLines.push({
            key,
            label: `${product.reference} ${product.name} · ${variation.colorName}`,
            sizeLabel: s.size ? `Tam. ${s.size}` : 'Caixa',
            qty,
            unitPrice: s.size ? product.pricePerPair : product.pricePerBox,
          });
        }
      }
    }
    const summaryHasAnyPrice = summaryLines.some((l) => l.unitPrice !== undefined);
    const summaryTotal = summaryLines.reduce((sum, l) => sum + (l.unitPrice !== undefined ? l.unitPrice * l.qty : 0), 0);

    return (
      <div className="min-h-screen flex flex-col items-center bg-slate-50 p-6 text-center gap-3">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mt-16">✓</div>
        <h1 className="text-lg font-black text-slate-900">Pedido enviado!</h1>
        <p className="text-sm text-slate-500 font-medium max-w-xs">Recebemos sua escolha e vamos confirmar com você em breve.</p>

        {summaryLines.length > 0 && (
          <button
            type="button"
            onClick={() => setShowOrderSummary((v) => !v)}
            className="text-xs font-black uppercase tracking-widest text-indigo-600 mt-2"
          >
            {showOrderSummary ? 'Esconder pedido' : 'Ver pedido enviado'}
          </button>
        )}

        {showOrderSummary && (
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mt-2 text-left flex flex-col gap-2">
            {summaryLines.map((line) => (
              <div key={line.key} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{line.label}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{line.sizeLabel}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-slate-900">{line.qty}x</p>
                  {line.unitPrice !== undefined && (
                    <p className="text-[10px] font-bold text-emerald-600">{formatPrice(line.unitPrice * line.qty)}</p>
                  )}
                </div>
              </div>
            ))}
            {summaryHasAnyPrice && (
              <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-slate-100">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Total</span>
                <span className="text-sm font-black text-emerald-600">{formatPrice(summaryTotal)}</span>
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] font-black text-rose-500 max-w-xs mt-4">
          Dica: tire um print desta tela pra ter o pedido salvo, caso precise conferir depois.
        </p>
        <p className="text-[11px] text-slate-400 font-medium max-w-xs mt-2">
          Caso precise refazer o pedido, comunique o vendedor e peça para desconsiderar esse pedido — depois é só fazer outro pelo mesmo link.
        </p>
        <p className="text-[11px] text-slate-400 font-medium max-w-xs mt-2">
          O pedido demora cerca de 1 a 2 minutos para ser processado para o vendedor.
        </p>
      </div>
    );
  }

  return (
    // h-screen + overflow-y-auto (não min-h-screen) — o próprio div vira o container de rolagem,
    // em vez de depender do <body> rolar sozinho (que não estava funcionando em algumas
    // combinações de navegador/CSS herdado do bundle principal do app).
    <div className="h-screen overflow-y-auto bg-slate-50 pb-32">
      <header className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-10 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-black uppercase tracking-tight text-slate-900">Catálogo</h1>
          {expiresAt && (
            <span className="shrink-0 text-[10px] font-black text-slate-500 tabular-nums">
              Expira em {formatCountdown(expiresAt - now)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 bg-amber-50 rounded-xl pl-3 pr-1.5 py-1.5">
          <p className="min-w-0 flex-1 text-[9px] font-bold text-amber-600 whitespace-nowrap overflow-hidden text-ellipsis">
            Recarregue antes de pedir p/ ver o estoque atual.
          </p>
          <button
            type="button"
            onClick={() => loadCatalog(true)}
            disabled={refreshing}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-amber-700 text-[9px] font-black uppercase tracking-wide active:scale-95 transition-all disabled:opacity-50"
          >
            <span className={refreshing ? 'inline-block animate-spin' : ''}>↻</span> Atualizar
          </button>
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
            {(categoryOptions.length > 0 || brandOptions.length > 0) && (
              <button
                type="button"
                onClick={() => setCategoriesSectionOpen(v => !v)}
                className="flex items-center justify-between gap-2 px-1"
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Categorias e Marcas
                  {(categoryFilter !== 'ALL' || brandFilter !== 'ALL') && <span className="text-indigo-500"> · filtro ativo</span>}
                </span>
                <span className={`text-slate-400 transition-transform ${categoriesSectionOpen ? 'rotate-180' : ''}`}>⌄</span>
              </button>
            )}
            {categoriesSectionOpen && categoryOptions.length > 0 && (
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
            {categoriesSectionOpen && brandOptions.length > 0 && (
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
                <img
                  src={product.photoUrl}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  onClick={() => openLightbox([product.photoUrl!], product.photoUrl!)}
                  className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100 cursor-pointer active:scale-95 transition-all"
                />
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
              {product.variations.map((variation) => {
                const variationGallery = [variation.photoUrl, ...(variation.photoAlbum || [])].filter(Boolean) as string[];
                return (
                <div key={variation.variationId} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {variation.photoUrl && (
                      <img
                        src={variation.photoUrl}
                        alt={variation.colorName}
                        loading="lazy"
                        decoding="async"
                        onClick={() => openLightbox(variationGallery, variation.photoUrl!)}
                        className="w-8 h-8 rounded-lg object-cover cursor-pointer active:scale-90 transition-all"
                      />
                    )}
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-600">{variation.colorName}</p>
                  </div>
                  {variation.photoAlbum && variation.photoAlbum.length > 0 && (
                    <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar">
                      {variation.photoAlbum.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`${variation.colorName} — foto ${idx + 1}`}
                          loading="lazy"
                          decoding="async"
                          onClick={() => openLightbox(variationGallery, url)}
                          className="w-14 h-14 rounded-xl object-cover shrink-0 border border-slate-200 cursor-pointer active:scale-95 transition-all"
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {variation.sizes.map((s) => {
                      const key = cartKey(product.productId, variation.variationId, s.size);
                      const qty = cart[key] || 0;
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2"
                        >
                          <div className="flex flex-col shrink-0 leading-tight">
                            <span className="text-xs font-bold text-slate-500">{s.size || 'Cx'}</span>
                            {showStockQuantities && (
                              <span className="text-[9px] font-bold text-blue-600">{s.available} em estoque</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setQty(product.productId, variation.variationId, s.size, s.available, qty - 1)}
                              className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 font-black text-base active:scale-90 shrink-0"
                            >-</button>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={qty || ''}
                              onChange={(e) => setQty(product.productId, variation.variationId, s.size, s.available, Number(e.target.value))}
                              className="w-12 text-center text-base font-black outline-none"
                              placeholder="0"
                            />
                            <button
                              type="button"
                              onClick={() => setQty(product.productId, variation.variationId, s.size, s.available, qty + 1)}
                              className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 font-black text-base active:scale-90 shrink-0"
                            >+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
            <div className="px-4 pb-4">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Observação deste produto (opcional)</label>
              <textarea
                value={productNotes[product.productId] || ''}
                onChange={(e) => setProductNotes((prev) => ({ ...prev, [product.productId]: e.target.value.slice(0, 200) }))}
                rows={2}
                className="w-full mt-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs outline-none"
                placeholder="Ex: pedido no saquinho, com embalagem desmontada"
              />
            </div>
          </div>
        ))}

        {products.length > 0 && isGeneric && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seu nome</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value.slice(0, 80))}
              className="w-full mt-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm outline-none"
              placeholder="Como podemos te chamar?"
            />
            {!customerName.trim() && (
              <p className="text-[10px] font-bold text-rose-500 mt-1.5">É necessário informar seu nome para enviar o pedido.</p>
            )}
          </div>
        )}

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

        {products.length > 0 && (
          <p className="text-center text-[10px] font-bold text-slate-400 leading-relaxed px-6 pt-2">
            {isGeneric
              ? 'Este é um catálogo de grupo — cada pessoa faz o próprio pedido informando o nome.'
              : 'Este link é individual, já vinculado ao seu cadastro — não compartilhe com outras pessoas.'}
          </p>
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
            disabled={status === 'submitting' || (isGeneric && !customerName.trim())}
            className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest text-sm shadow-2xl active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {status === 'submitting' ? 'Enviando...' : `Enviar Pedido (${totalItems})`}
          </button>
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-30 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            aria-label="Fechar"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center active:scale-90 transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>

          {lightbox.images.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox(prev => prev ? { ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length } : prev); }}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center active:scale-90 transition-all"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}

          <img src={lightbox.images[lightbox.index]} alt="Foto ampliada" onClick={(e) => e.stopPropagation()} className="max-w-full max-h-full rounded-xl object-contain" />

          {lightbox.images.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox(prev => prev ? { ...prev, index: (prev.index + 1) % prev.images.length } : prev); }}
              aria-label="Próxima foto"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center active:scale-90 transition-all"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          )}

          {lightbox.images.length > 1 && (
            <span className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-bold">
              {lightbox.index + 1} / {lightbox.images.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

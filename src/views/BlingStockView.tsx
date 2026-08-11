import { useEffect, useMemo, useState } from 'react';
import { Product, BlingOrder, BlingProductMapping, SaleType } from '../types';
import { subscribeToBlingOrders, subscribeToBlingMappings } from '../services/blingService';
import { productHasSaleType } from '../utils/stockPools';

interface BlingStockViewProps {
  isDarkMode: boolean;
  products: Product[];
}

export default function BlingStockView({ isDarkMode, products }: BlingStockViewProps) {
  const [orders, setOrders] = useState<BlingOrder[]>([]);
  const [mappings, setMappings] = useState<BlingProductMapping[]>([]);

  useEffect(() => subscribeToBlingOrders(setOrders), []);
  useEffect(() => subscribeToBlingMappings(setMappings), []);

  // Quanto de cada produto/variação/tamanho ainda está pendente de separação — mesma chave da
  // Lista de Separação, pra destacar em azul aqui.
  const pendingByKey = useMemo(() => {
    const map = new Map<string, number>();
    const mappingByBlingId = new Map(mappings.map((m) => [m.blingProdutoId, m]));
    for (const order of orders) {
      if (order.status === 'REJEITADA') continue;
      for (const item of order.itens) {
        if (item.separado) continue;
        const mapping = mappingByBlingId.get(item.blingProdutoId);
        if (!mapping) continue;
        const key = `${mapping.productId}|${mapping.variationId}|${mapping.size || 'ATACADO'}`;
        map.set(key, (map.get(key) || 0) + item.quantidade);
      }
    }
    return map;
  }, [orders, mappings]);

  // Modelos (produtos) de VAREJO que têm PELO MENOS uma variação/tamanho vinculado ao Bling —
  // mostra o estoque completo desses modelos (todas as cores/tamanhos), igual à aba "Varejo"
  // de "Disponível em Estoque", só que com a quantidade pendente de separação em azul.
  const linkedProducts = useMemo(() => {
    const linkedIds = new Set(mappings.map((m) => m.productId));
    return products
      .filter((p) => linkedIds.has(p.id) && productHasSaleType(p, SaleType.RETAIL))
      .sort((a, b) => a.reference.localeCompare(b.reference));
  }, [products, mappings]);

  return (
    <div className="flex flex-col gap-6 pb-32">
      <div className="flex items-center gap-2 px-1">
        <div className="w-3 h-3 rounded-full bg-sky-500 shrink-0" />
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Azul = tem quantidade pendente de separação de pedidos</p>
      </div>

      <div className="flex flex-col gap-3">
        {linkedProducts.length === 0 && (
          <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-10">Nenhum modelo vinculado ao Bling ainda.</p>
        )}
        {linkedProducts.map((product) => (
          <div
            key={product.id}
            className={`p-4 rounded-[2rem] border shadow-sm bg-gradient-to-br ${isDarkMode ? 'from-slate-900 to-slate-900/80 border-slate-800' : 'from-white to-slate-50 border-slate-100'}`}
          >
            <h3 className={`text-[13px] font-black uppercase tracking-tight truncate mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {product.reference ? `${product.reference} — ` : ''}{product.name}
            </h3>

            <div className="flex flex-col gap-2">
              {product.variations.map((variation) => {
                const sizeEntries = Object.entries(variation.stock).filter(([size]) => size !== 'WHOLESALE');
                const wholesaleQty = variation.stock['WHOLESALE'];
                const totalRetail = sizeEntries.reduce((s, [, qty]) => s + qty, 0);

                return (
                  <div key={variation.id} className={`flex flex-col gap-1.5 p-2.5 rounded-2xl ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50/80'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[13px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{totalRetail} pr</span>
                      <span className={`text-[11px] font-bold uppercase tracking-tight truncate ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{variation.colorName}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {sizeEntries.map(([size, qty]) => {
                        const pending = pendingByKey.get(`${product.id}|${variation.id}|${size}`) || 0;
                        const isPending = pending > 0;
                        return (
                          <div
                            key={size}
                            className={`flex flex-col items-center justify-center min-w-[42px] px-2 py-1.5 rounded-lg border ${
                              isPending
                                ? isDarkMode ? 'bg-sky-900/30 border-sky-600' : 'bg-sky-100 border-sky-400'
                                : isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'
                            }`}
                          >
                            <span className={`text-[8px] font-black uppercase ${isPending ? 'text-sky-600 dark:text-sky-300' : 'text-slate-400'}`}>{size}</span>
                            <span className={`text-[12px] font-black ${isPending ? 'text-sky-700 dark:text-sky-200' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>{qty}</span>
                            {isPending && <span className="text-[7px] font-black text-sky-500">-{pending}</span>}
                          </div>
                        );
                      })}

                      {wholesaleQty !== undefined && (() => {
                        const pending = pendingByKey.get(`${product.id}|${variation.id}|ATACADO`) || 0;
                        const isPending = pending > 0;
                        return (
                          <div
                            className={`flex flex-col items-center justify-center min-w-[52px] px-2 py-1.5 rounded-lg border ${
                              isPending
                                ? isDarkMode ? 'bg-sky-900/30 border-sky-600' : 'bg-sky-100 border-sky-400'
                                : isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'
                            }`}
                          >
                            <span className={`text-[8px] font-black uppercase ${isPending ? 'text-sky-600 dark:text-sky-300' : 'text-slate-400'}`}>Atacado</span>
                            <span className={`text-[12px] font-black ${isPending ? 'text-sky-700 dark:text-sky-200' : isDarkMode ? 'text-white' : 'text-slate-900'}`}>{wholesaleQty}</span>
                            {isPending && <span className="text-[7px] font-black text-sky-500">-{pending}</span>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

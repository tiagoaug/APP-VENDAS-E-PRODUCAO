import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix the Mapas Layout
mapas_old = """                                {/* Linha 1: Referência + Nome */}
                                <p className="text-[11px] font-black uppercase truncate text-slate-800 dark:text-slate-200 leading-none">
                                  {productRef ? `${productRef} ${productName}` : productName}
                                </p>
                                {/* Linha 2: Cor + Pedido */}
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {colorName && (
                                    <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{colorName}</span>
                                  )}
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {order?.saleOrderNumber || selectedLot.saleOrderNumber}</span>
                                  {hasOS && (
                                    <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">• {orderOS!.osNumber}</span>
                                  )}
                                </div>
                                {/* Linha 3: Origem do pedido - Cliente ou Estoque */}
                                {(() => {
                                  const custName = (order?.customerName || selectedLot.customerName || '').trim();
                                  if (!custName) return null;
                                  const isStock = custName.toUpperCase() === 'ESTOQUE';
                                  return (
                                    <p className="text-[8px] font-black text-slate-900 dark:text-white uppercase tracking-widest mt-0.5 truncate">
                                      {isStock ? 'Estoque' : `Cliente: ${custName}`}
                                    </p>
                                  );
                                })()}"""

mapas_new = """                                {/* Linha 1: Referência + Nome */}
                                <p className="text-[11px] font-black uppercase truncate text-slate-800 dark:text-slate-200 leading-none">
                                  {productRef ? `${productRef} ${productName}` : productName}
                                </p>
                                {/* Linha 2: Cor */}
                                {colorName && (
                                  <div className="flex items-center mt-1">
                                    <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{colorName}</span>
                                  </div>
                                )}
                                {/* Linha 3: Pedido */}
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {order?.saleOrderNumber || selectedLot.saleOrderNumber}</span>
                                  {hasOS && (
                                    <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">• {orderOS!.osNumber}</span>
                                  )}
                                </div>
                                {/* Linha 4: Origem do pedido - Cliente ou Estoque */}
                                {(() => {
                                  const custName = (order?.customerName || selectedLot.customerName || '').trim();
                                  if (!custName) return null;
                                  const isStock = custName.toUpperCase() === 'ESTOQUE';
                                  return (
                                    <p className="text-[8px] font-black text-slate-900 dark:text-white uppercase tracking-widest mt-0.5 truncate">
                                      {isStock ? 'Estoque' : `Cliente: ${custName}`}
                                    </p>
                                  );
                                })()}
                                {/* Linha 5: Quantidade */}
                                <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-0.5">
                                  {si.qty} PARES
                                </p>"""

content = content.replace(mapas_old, mapas_new)


# 2. Fix the Setores Layout
setores_old = """                                    <p className="text-[11px] font-black uppercase truncate text-slate-800 dark:text-slate-200 leading-none">
                                      {productRef ? `${productRef} ${productName}` : productName}
                                    </p>
                                    <div className="flex flex-col mt-0.5">
                                      {colorName && (
                                        <div className="flex items-center">
                                          <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{colorName}</span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {f.order?.saleOrderNumber || f.lot.saleOrderNumber}</span>
                                        {hasOS && (
                                          <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">• {f.coveringOS!.osNumber}</span>
                                        )}
                                      </div>
                                    </div>
                                    {(() => {
                                      const custName = (f.order?.customerName || f.lot.customerName || '').trim();
                                      if (!custName) return null;
                                      const isStock = custName.toUpperCase() === 'ESTOQUE';
                                      return (
                                        <p className="text-[8px] font-black text-slate-900 dark:text-white uppercase tracking-widest mt-0.5 truncate">
                                          {isStock ? 'Estoque' : `Cliente: ${custName}`}
                                        </p>
                                      );
                                    })()}"""

setores_new = """                                    <p className="text-[11px] font-black uppercase truncate text-slate-800 dark:text-slate-200 leading-none">
                                      {productRef ? `${productRef} ${productName}` : productName}
                                    </p>
                                    <div className="flex flex-col mt-0.5">
                                      {colorName && (
                                        <div className="flex items-center mt-0.5">
                                          <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{colorName}</span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {f.order?.saleOrderNumber || f.lot.saleOrderNumber}</span>
                                        {hasOS && (
                                          <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">• {f.coveringOS!.osNumber}</span>
                                        )}
                                      </div>
                                    </div>
                                    {(() => {
                                      const custName = (f.order?.customerName || f.lot.customerName || '').trim();
                                      if (!custName) return null;
                                      const isStock = custName.toUpperCase() === 'ESTOQUE';
                                      return (
                                        <p className="text-[8px] font-black text-slate-900 dark:text-white uppercase tracking-widest mt-0.5 truncate">
                                          {isStock ? 'Estoque' : `Cliente: ${custName}`}
                                        </p>
                                      );
                                    })()}
                                    <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-0.5">
                                      {f.si.qty} PARES
                                    </p>"""

content = content.replace(setores_old, setores_new)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

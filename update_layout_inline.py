import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Setores Layout
setores_old = """                                    <p className="text-[11px] font-black uppercase truncate text-slate-800 dark:text-slate-200 leading-none">
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
                                    </div>"""

setores_new = """                                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                      <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 leading-none">
                                        {productRef ? `${productRef} ${productName}` : productName}
                                      </p>
                                      {colorName && (
                                        <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 leading-none">{colorName}</span>
                                      )}
                                    </div>
                                    <div className="flex flex-col mt-0.5">
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {f.order?.saleOrderNumber || f.lot.saleOrderNumber}</span>
                                        {hasOS && (
                                          <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">• {f.coveringOS!.osNumber}</span>
                                        )}
                                      </div>
                                    </div>"""

content = content.replace(setores_old, setores_new)

# 2. Update Mapas Layout
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
                                </div>"""

mapas_new = """                                {/* Linha 1: Referência + Nome + Cor */}
                                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                  <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 leading-none">
                                    {productRef ? `${productRef} ${productName}` : productName}
                                  </p>
                                  {colorName && (
                                    <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 leading-none">{colorName}</span>
                                  )}
                                </div>
                                {/* Linha 2: Pedido */}
                                <div className="flex flex-col mt-0.5">
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {order?.saleOrderNumber || selectedLot.saleOrderNumber}</span>
                                    {hasOS && (
                                      <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">• {orderOS!.osNumber}</span>
                                    )}
                                  </div>
                                </div>"""

content = content.replace(mapas_old, mapas_new)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the new component to show inside the modal header
new_section = """
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50 flex flex-col gap-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Itens para Conferência</p>
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {targetLots.flatMap(l => {
                          const allSourceItems = (l as any).metadata?.sourceItems || [];
                          
                          // Se tem pedidos selecionados (hasSelectedOrders), filtra. Senão, mostra todos os itens do mapa.
                          const itemsToShow = hasSelectedOrders
                            ? allSourceItems.filter((si: any, idx: number) => 
                                pendingOsSourceOrderIds.includes(si.orderId) || 
                                pendingOsSourceOrderIds.includes(`${si.orderId}::${si.itemIdx !== undefined ? si.itemIdx : idx}`)
                              )
                            : allSourceItems;

                          if (itemsToShow.length > 0) {
                            return itemsToShow.map((si: any, idx: number) => {
                              const order = productionOrders.find(o => o.id === si.orderId);
                              const ordItem = si.itemIdx !== undefined 
                                ? order?.items[si.itemIdx] 
                                : order?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
                              
                              if (!ordItem) return null;
                              const prod = products.find(p => p.id === (ordItem.productId || si.productId));
                              const vari = prod?.variations.find((v: any) => v.id === (ordItem.variationId || si.variationId));
                              
                              const sizes = Object.entries(ordItem.sizes || {})
                                .map(([sz, sData]: [string, any]) => ({ size: sz, qty: Number(sData.toProduction) || 0 }))
                                .filter(s => s.qty > 0)
                                .sort((a, b) => parseFloat(a.size) - parseFloat(b.size));

                              const totalQty = sizes.reduce((acc, s) => acc + s.qty, 0);

                              return (
                                <div key={`${l.id}-${si.orderId}-${si.itemIdx ?? idx}`} className={`flex flex-col gap-2 p-3 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                                        Ped. {order?.saleOrderNumber || si.orderId.substring(0,6)}
                                      </span>
                                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                                        {prod?.name || 'Produto'} {vari?.colorName ? ` - ${vari.colorName}` : ''}
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase">{totalQty}P</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                                    {sizes.map(s => (
                                      <div key={s.size} className={`flex flex-col items-center justify-center min-w-[28px] px-1 py-1 rounded-lg border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                        <span className="text-[8px] font-black text-slate-400 mb-0.5 leading-none">{s.size}</span>
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-none">{s.qty}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            });
                          }

                          // Fallback para mapas legados que não possuem sourceItems detalhados
                          const legacySizes = Object.entries(l.pairs || {})
                            .map(([sz, q]) => ({ size: sz, qty: Number(q) || 0 }))
                            .filter(s => s.qty > 0)
                            .sort((a, b) => parseFloat(a.size) - parseFloat(b.size));
                            
                          const totalLegacy = legacySizes.reduce((acc, s) => acc + s.qty, 0);
                          
                          if (legacySizes.length > 0) {
                            return (
                              <div key={l.id} className={`flex flex-col gap-2 p-3 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">Mapa #{l.orderNumber}</span>
                                  <span className="text-[10px] font-black text-slate-500 uppercase">{totalLegacy}P</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-0.5">
                                  {legacySizes.map(s => (
                                    <div key={s.size} className={`flex flex-col items-center justify-center min-w-[28px] px-1 py-1 rounded-lg border shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                      <span className="text-[8px] font-black text-slate-400 mb-0.5 leading-none">{s.size}</span>
                                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-none">{s.qty}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          
                          return null;
                        })}
                      </div>
                    </div>
"""

# Find where to inject this:
#                     {isAdvancedOS && (
#                       <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-1">
#                         Mapa atualmente em: {sectors.find(s => s.id === (firstLot.route && firstLot.route[firstLot.currentSectorIndex]))?.name || '---'}
#                       </p>
#                     )}
#                   </>

target_pattern = r"                    \{isAdvancedOS && \(\n                      <p className=\"text-\[9px\] font-bold text-amber-500 uppercase tracking-widest mt-1\">\n                        Mapa atualmente em: \{sectors\.find\(s => s\.id === \(firstLot\.route && firstLot\.route\[firstLot\.currentSectorIndex\]\)\)\?\.name \|\| '---\'\}\n                      </p>\n                    \)\}"

replacement = """                    {isAdvancedOS && (
                      <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-1">
                        Mapa atualmente em: {sectors.find(s => s.id === (firstLot.route && firstLot.route[firstLot.currentSectorIndex]))?.name || '---'}
                      </p>
                    )}""" + new_section

content = re.sub(target_pattern, replacement, content)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added detailed size grid for OS modal")

import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# I will define exactly the layout the user wants for the Setores tab cards.
# Inside the filteredFichas loop, we have `f` which is { lot, si, siIdx, orderItem, product, variation, coveringOS }
# The target is the entire `return (` block inside `filteredFichas.map((f) => {`

target_start = "                            return ("
target_end = """                                  </div>
                                </div>
                              </div>
                            );
                          })}"""

start_idx = content.find("return (", content.find("filteredFichas.map((f) => {"))
end_idx = content.find(");", start_idx) + 2 # finds the end of the return statement
# wait, the return statement inside the map spans many lines. 
# let's find the closing of the map
end_idx = content.find("                         })\n                        </div>", start_idx)

new_card_code = """
                            const orderItem = f.orderItem;
                            const product = f.product;
                            const variation = f.variation;
                            const productName = product?.name || orderItem?.productName || '-';
                            const productRef = product?.reference || '';
                            const colorName = variation?.colorName || orderItem?.variationName || '';
                            const completedOS = completedOSForOrder(f.si.orderId);
                            const hasCompletedOS = !!completedOS;

                            return (
                              <div key={itemKey} id={`pedido-card-${itemKey}`} className={`rounded-2xl border overflow-hidden transition-all ${
                                hasOS
                                  ? (isDarkMode ? 'bg-amber-950/20 border-amber-700/40' : 'bg-amber-50 border-amber-200')
                                  : hasCompletedOS
                                    ? (isDarkMode ? 'bg-emerald-950/20 border-emerald-700/40' : 'bg-emerald-50/60 border-emerald-200')
                                    : isChecked
                                      ? (isDarkMode ? 'bg-indigo-950/30 border-indigo-700' : 'bg-indigo-50 border-indigo-200')
                                      : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')
                              }`}>
                                {/* Cabeçalho */}
                                <div className="p-3 flex items-center gap-3">
                                  {hasOS ? (
                                    <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center shrink-0" title="OS pendente">
                                      <div className="w-2 h-2 rounded-full bg-white" />
                                    </div>
                                  ) : hasCompletedOS ? (
                                    <input
                                      type="checkbox"
                                      title="Selecionar para mover de setor"
                                      checked={isChecked}
                                      onChange={() => {
                                        const n = new Set(fichaSelection);
                                        isChecked ? n.delete(itemKey) : n.add(itemKey);
                                        setFichaSelection(n);
                                      }}
                                      className="w-4 h-4 accent-emerald-500 cursor-pointer shrink-0"
                                    />
                                  ) : (
                                    <input
                                      type="checkbox"
                                      title="Selecionar para mover de setor"
                                      checked={isChecked}
                                      onChange={() => {
                                        const n = new Set(fichaSelection);
                                        isChecked ? n.delete(itemKey) : n.add(itemKey);
                                        setFichaSelection(n);
                                      }}
                                      className="w-4 h-4 accent-indigo-600 cursor-pointer shrink-0"
                                    />
                                  )}
                                  
                                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => { const n = new Set(fichaItemExpanded); gradeOpen ? n.delete(gradeKey) : n.add(gradeKey); setFichaItemExpanded(n); }}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-[11px] font-black uppercase truncate text-slate-700 dark:text-slate-200 leading-none">
                                        {productRef ? `${productRef} ${productName}` : productName}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {colorName && (
                                        <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{colorName}</span>
                                      )}
                                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                        PED. {f.lot.orderNumber}
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">
                                        {f.order?.customerName || 'ESTOQUE'}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/20 px-2 py-0.5 rounded-full uppercase truncate max-w-[120px]">
                                      {sectors.find(s => s.id === f.lot.route?.[f.lot.currentSectorIndex])?.name || 'DESCONHECIDO'}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-violet-600 text-white tracking-widest">
                                        MAPA{f.lot.orderNumber}
                                      </span>
                                      <div className="flex items-center gap-1 cursor-pointer" onClick={() => { const n = new Set(fichaItemExpanded); gradeOpen ? n.delete(gradeKey) : n.add(gradeKey); setFichaItemExpanded(n); }}>
                                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{f.si.qty}P</span>
                                        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${gradeOpen ? 'rotate-180' : ''}`} />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Corpo (expandido) */}
                                {gradeOpen && (
                                  <div className={`p-4 border-t flex flex-col gap-4 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
                                    {/* Grade */}
                                    {szEntries.length > 0 && (
                                      <div className="flex flex-col gap-2">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Grade de Produção</p>
                                        <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start px-2 py-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                          {szEntries.map(([sz, s]) => (
                                            <div key={sz} className={`flex flex-col items-center justify-center min-w-[32px] sm:min-w-[40px] px-2 py-1.5 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                                              <span className="text-[9px] font-black text-slate-400 mb-0.5 leading-none">{sz}</span>
                                              <span className="text-sm font-black text-slate-800 dark:text-white leading-none">{s?.toProduction ?? s}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Infos do Pedido */}
                                    <div className="grid grid-cols-3 gap-4 px-2">
                                      <div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Cliente</p>
                                        <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase truncate">{f.order?.customerName || 'Estoque'}</p>
                                      </div>
                                      <div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Entrega</p>
                                        <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase">
                                          {f.order?.deliveryDate ? new Date(f.order.deliveryDate).toLocaleDateString('pt-BR') : '-'}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">{f.si.qty} pares</p>
                                      </div>
                                    </div>

                                    {/* Instruções */}
                                    {variation?.sectorNotes && Object.keys(variation.sectorNotes).length > 0 && (
                                      <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-indigo-50/50 border-indigo-100'}`}>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500/70 dark:text-indigo-400/70 mb-3 px-1">
                                          Instruções por Setor
                                        </p>
                                        <div className="flex flex-col gap-3">
                                          {Object.entries(variation.sectorNotes)
                                            .filter(([sid, notes]) => Array.isArray(notes) && notes.some((n: any) => n.text?.trim()))
                                            .map(([sid, notes]) => {
                                              const sn = sectors.find(s => s.id === sid);
                                              return (
                                                <div key={sid} className="flex flex-col">
                                                  <div className="flex items-center gap-1.5 mb-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                                    <span className="text-[9px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest">{sn?.name || 'Setor'}</span>
                                                  </div>
                                                  <div className="pl-3 ml-[3px] border-l-2 border-indigo-200 dark:border-indigo-800 flex flex-col gap-2">
                                                    {(notes as any[]).filter(n => n.text?.trim()).map((n, nidx) => (
                                                      <div key={nidx} className="flex flex-col">
                                                        <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">
                                                          {n.label || `${sn?.name} ${productRef} ${colorName}`}
                                                        </span>
                                                        <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 leading-snug">
                                                          {n.text}
                                                        </span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    <hr className={`border-dashed ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`} />

                                    {/* Ações */}
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Etiqueta Deste Pedido</span>
                                        <div className="flex items-center gap-2">
                                          <button type="button"
                                            onClick={() => {
                                              const resolvedProductId = f.si.productId || f.orderItem?.productId;
                                              const resolvedVariationId = f.si.variationId || f.orderItem?.variationId;
                                              const itemProduct = products.find(p => p.id === resolvedProductId);
                                              const itemVariation = itemProduct?.variations.find(v => v.id === resolvedVariationId);
                                              if (itemProduct && itemVariation && f.orderItem?.sizes) {
                                                const szStr = Object.entries(f.orderItem.sizes as Record<string, { toProduction: number }>)
                                                    .filter(([, s]) => s.toProduction > 0)
                                                    .sort(([a], [b]) => Number(a) - Number(b))
                                                    .map(([sz, s]) => `${sz}x${s.toProduction}`)
                                                    .join('-');
                                                
                                                if (szStr) {
                                                  labelService.print({
                                                    orderNumber: f.lot.orderNumber || '---',
                                                    productReference: itemProduct.reference || '',
                                                    productName: itemProduct.name,
                                                    colorName: itemVariation.colorName,
                                                    sizeGrid: szStr,
                                                    totalPairs: f.si.qty,
                                                    customerName: f.order?.customerName || 'Estoque',
                                                    deliveryDate: f.order?.deliveryDate,
                                                    sectorName: sectors.find(s => s.id === f.lot.route?.[f.lot.currentSectorIndex])?.name || ''
                                                  });
                                                }
                                              }
                                            }}
                                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                            Imprimir / Compartilhar
                                          </button>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ficha do Pedido</span>
                                        <button type="button"
                                          onClick={() => setShareModal({ isOpen: true, format: 'pdf', selectedItems: [f] })}
                                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-600 text-white hover:bg-slate-700'}`}
                                        >
                                          <Share2 size={14} /> Compartilhar Ficha
                                        </button>
                                      </div>

                                    </div>
                                  </div>
                                )}
                              </div>
                            );
"""

import sys

idx1 = content.find("return (", content.find("filteredFichas.map((f) => {"))
if idx1 == -1:
    print("Could not find start block")
    sys.exit(1)

# To find the end safely:
end_pattern = r"(\s+)\);\n(\s*)}\)"
match = re.search(end_pattern, content[idx1:])
if match:
    idx2 = idx1 + match.end() - 2 # point right at the end of `);`
else:
    print("Could not find end block")
    sys.exit(1)

new_content = content[:idx1] + new_card_code.strip() + "\n" + content[idx2:]

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as file:
    file.write(new_content)

print("Updated filteredFichas to look exactly like Mapas orders, and restored ExportNoteModal for single share!")

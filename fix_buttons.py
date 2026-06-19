import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix "Imprimir / Compartilhar" button inside Setores (filteredFichas)
old_label_click = """                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const szStr = Array.from(sizeEntries)
                                                .filter(([_, q]) => q > 0)
                                                .map(([s, q]) => `${s}x${q}`)
                                                .join('-');
                                            
                                            if (szStr) {
                                              setLabelModalBatchItems([{ product: itemProduct, variation: itemVariation, sizeGrid: szStr, lotId: f.lot.id, orderId: f.si.orderId, itemIdx: f.siIdx }]);
                                            }
                                          }}"""

new_label_click = """                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const szStr = Array.from(sizeEntries)
                                                .filter(([_, q]) => q > 0)
                                                .map(([s, q]) => `${s}x${q}`)
                                                .join('-');
                                            
                                            if (szStr) {
                                              setLabelModalProduct(itemProduct);
                                              setLabelModalLot(f.lot);
                                              setLabelModalSizeGrid(szStr);
                                              setLabelModalBatchItems([{ product: itemProduct, variation: itemVariation, sizeGrid: szStr, lotId: f.lot.id, orderId: f.si.orderId, itemIdx: f.siIdx }]);
                                            }
                                          }}"""

content = content.replace(old_label_click, new_label_click)

# Fix "Compartilhar Ficha" to use sharePedidoPopupKey and the same behavior as Mapas
old_share_button = """                                        <div className={`relative flex items-center justify-between gap-2 pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ficha do Pedido</p>
                                          <button type="button"
                                            onClick={() => setShareModal({ isOpen: true, format: 'pdf', selectedItems: [f] })}
                                            className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all active:scale-95 disabled:opacity-50 ${isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-600 text-white hover:bg-slate-700'}`}
                                          >
                                            <Share2 size={11} />
                                            Compartilhar Ficha
                                          </button>
                                        </div>"""

new_share_button = """                                        <div className={`relative flex items-center justify-between gap-2 pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ficha do Pedido</p>
                                          <button
                                            type="button"
                                            disabled={isPedidoShareExporting}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSharePedidoPopupKey(sharePedidoPopupKey === gradeKey ? null : gradeKey);
                                            }}
                                            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-slate-600 text-white hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
                                          >
                                            {isPedidoShareExporting && sharePedidoPopupKey === gradeKey
                                              ? <span className="animate-spin text-xs leading-none"></span>
                                              : <Share2 size={11} />}
                                            Compartilhar Ficha
                                          </button>
                                          {sharePedidoPopupKey === gradeKey && (
                                            <>
                                              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setSharePedidoPopupKey(null); }} />
                                              <div className={`absolute bottom-full right-0 mb-2 w-48 rounded-2xl shadow-xl border overflow-hidden z-50 flex flex-col ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                                                <button
                                                  type="button"
                                                  onClick={(e) => { e.stopPropagation(); setSharePedidoPopupKey(null); handleSharePedidoSheet(f.lot, itemProduct, itemVariation, f.order, sizeEntries, f.si.qty || 0, 'pdf'); }}
                                                  className={`px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                  <FileText size={14} /> PDF - Impressão
                                                </button>
                                                <div className={`h-px w-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`} />
                                                <button
                                                  type="button"
                                                  onClick={(e) => { e.stopPropagation(); setSharePedidoPopupKey(null); handleSharePedidoSheet(f.lot, itemProduct, itemVariation, f.order, sizeEntries, f.si.qty || 0, 'jpg'); }}
                                                  className={`px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                  <Camera size={14} /> JPG - Imagem
                                                </button>
                                              </div>
                                            </>
                                          )}
                                        </div>"""

content = content.replace(old_share_button, new_share_button)

# Also fix the card header to have Pedido on a new line!
old_header = """                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      {colorName && (
                                        <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{colorName}</span>
                                      )}
                                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {f.order?.saleOrderNumber || f.lot.saleOrderNumber}</span>
                                      {hasOS && (
                                        <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">• {f.coveringOS!.osNumber}</span>
                                      )}
                                    </div>"""

new_header = """                                    <div className="flex flex-col mt-0.5">
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
                                    </div>"""

content = content.replace(old_header, new_header)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

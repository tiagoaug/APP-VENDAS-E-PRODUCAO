import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We want to replace the `filteredFichas.map` block.
# Let's find the start of the return statement in the map:
start_pattern = r"                            return \(\n                              <div key=\{itemKey\} className=\{`rounded-2xl border overflow-hidden transition-all \$\{\n"
end_pattern = r"                              </div>\n                            \);\n                          \}\)\}\n                        </div>\n\n                        \{\/\* Emitir OS \- Multi\-Mapa \*\/\}"

match = re.search(start_pattern + r"(.*?)" + end_pattern, content, re.DOTALL)
if not match:
    print("Could not find the block to replace")
else:
    print("Found block!")

    # The new block:
    new_block = r"""                            const orderOS = f.coveringOS;
                            const order = f.order;
                            const productRef = f.product?.reference;
                            const productName = f.product?.name || f.orderItem?.productName;
                            const colorName = f.variation?.colorName || f.orderItem?.variationName;
                            const completedOS = completedOSForOrder(f.si.orderId);
                            const hasCompletedOS = !!completedOS;
                            const product = f.product;
                            const variation = f.variation;
                            const si = f.si;
                            const selectedLot = f.lot;

                            return (
                              <div key={itemKey} id={`pedido-card-${itemKey}`} className={`rounded-[1.5rem] border-2 overflow-hidden transition-all ${
                                hasOS
                                  ? (isDarkMode ? 'bg-amber-950/20 border-amber-700/40' : 'bg-amber-50 border-amber-200')
                                  : hasCompletedOS
                                    ? (isDarkMode ? 'bg-emerald-950/20 border-emerald-700/40' : 'bg-emerald-50/60 border-emerald-200')
                                    : isChecked
                                      ? (isDarkMode ? 'bg-indigo-950/30 border-indigo-700' : 'bg-indigo-50 border-indigo-200')
                                      : (isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')
                              }`}>
                                {/* ── Cabeçalho (sempre visível) ── */}
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
                                      className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                                    />
                                  ) : (
                                    <input
                                      type="checkbox"
                                      title="Selecionar pedido"
                                      checked={isChecked}
                                      onChange={() => {
                                        const n = new Set(fichaSelection);
                                        isChecked ? n.delete(itemKey) : n.add(itemKey);
                                        setFichaSelection(n);
                                      }}
                                      className="w-4 h-4 accent-indigo-600 cursor-pointer shrink-0"
                                    />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    {/* Linha 1: Referência + Nome */}
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
                                        <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">· {orderOS!.osNumber}</span>
                                      )}
                                    </div>
                                    {/* Linha 3: Origem do pedido — Cliente ou Estoque */}
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
                                    {/* Indicador de vínculo quebrado: a venda deste pedido não referencia mais esta OP */}
                                    {(() => {
                                      if (!order?.saleId) return null;
                                      const linkedSale = sales.find(s => s.id === order.saleId);
                                      if (!linkedSale || linkedSale.productionOrderId === order.id) return null;
                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRepairSaleLink(order);
                                          }}
                                          className="mt-1 flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-all"
                                          title="A venda perdeu a referência para esta Ordem de Produção. Toque para reparar o vínculo."
                                        >
                                          <AlertTriangle size={9} />
                                          Reparar Vínculo com a Venda
                                        </button>
                                      );
                                    })()}
                                    {/* Indicador de roteiro divergente: este modelo segue um caminho diferente do mapa */}
                                    {(() => {
                                      if (!hasCompletedOS) return null;
                                      const lotRoute = selectedLot.route || [];
                                      const currentLotSectorId = lotRoute[selectedLot.currentSectorIndex] || '';
                                      const resolved = resolveCorrectSectorForProduct(currentLotSectorId, product, sectors);
                                      const correctSectorId = resolved.isFinished ? '' : resolved.sectorId;
                                      const correctSectorName = resolved.isFinished ? 'CONCLUÍDO' : (sectors.find(s => s.id === correctSectorId)?.name || correctSectorId);
                                      const genericNextSectorId = lotRoute[selectedLot.currentSectorIndex + 1] || '';
                                      const assignedSectorId = getOrderEffectiveSector(selectedLot, si.orderId, si);
                                      if (!correctSectorId || correctSectorId === genericNextSectorId || assignedSectorId === correctSectorId) return null;
                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRouteOrderToCorrectSector(selectedLot, si, correctSectorId, correctSectorName, productName || '');
                                          }}
                                          className="mt-1 flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all"
                                          title={`Este modelo segue um roteiro de produção diferente — direcionar para "${correctSectorName}"`}
                                        >
                                          <ArrowLeftRight size={9} />
                                          Direcionar p/ {correctSectorName}
                                        </button>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                                    {(() => {
                                      const effSec = getOrderEffectiveSector(selectedLot, si.orderId, si);
                                      const secName = effSec === ORDER_FINALIZED
                                        ? 'Finalizado'
                                        : (sectors.find(s => s.id === effSec)?.name || effSec || '—');
                                      return (
                                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-rose-500 text-white tracking-widest shadow-sm shadow-rose-500/20">
                                          {secName}
                                        </span>
                                      );
                                    })()}
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase text-white tracking-widest shadow-sm shadow-black/20 ${getMapColorClass(selectedLot)}`}>
                                      MAPA{selectedLot.orderNumber}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{si.qty}P</span>
                                      <button
                                        type="button"
                                        title={isExpanded ? 'Recolher' : 'Expandir grade'}
                                        aria-label={isExpanded ? 'Recolher pedido' : 'Expandir pedido'}
                                        onClick={() => {
                                          const next = new Set(fichaItemExpanded);
                                          isExpanded ? next.delete(gradeKey) : next.add(gradeKey);
                                          setFichaItemExpanded(next);
                                        }}
                                        className={`p-1 rounded-lg transition-all ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-300 hover:text-slate-600'}`}
                                      >
                                        <ChevronDown size={13} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* ── Expanded: grade + info completa ── */}
                                {isExpanded && (
                                  <div className={`px-3 pb-3 pt-1 border-t flex flex-col gap-3 ${isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/60'}`}>
                                    {szEntries.length > 0 && (
                                      <div>
                                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Grade de Produção</p>
                                        <div className="flex flex-wrap gap-2 justify-center">
                                          {szEntries.map(([size, s]) => (
                                            <div key={size} className={`flex flex-col items-center min-w-[38px] py-1.5 px-2 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                              <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 leading-none">{size}</p>
                                              <p className="text-[16px] font-black text-slate-900 dark:text-white leading-none mt-0.5">{s?.toProduction ?? s}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                      {order?.customerName && (
                                        <div>
                                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cliente</p>
                                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase">{order.customerName}</p>
                                        </div>
                                      )}
                                      {order?.deliveryDate && (
                                        <div>
                                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Entrega</p>
                                          <p className="text-[10px] font-black text-slate-700 dark:text-slate-300">{new Date(order.deliveryDate).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                      )}
                                      <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{si.qty} pares</p>
                                      </div>
                                      {hasOS && (
                                        <div>
                                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">OS</p>
                                          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">{orderOS!.osNumber} · {orderOS!.providerName}</p>
                                        </div>
                                      )}
                                    </div>
                                    {order?.notes && (
                                      <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl ${isDarkMode ? 'bg-amber-900/20 border border-amber-700/30' : 'bg-amber-50 border border-amber-200'}`}>
                                        <MessageSquare size={12} className="text-amber-500 shrink-0 mt-0.5" />
                                        <div>
                                          <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-0.5">Observação do Pedido</p>
                                          <p className={`text-[11px] font-bold leading-snug ${isDarkMode ? 'text-amber-200' : 'text-amber-800'}`}>{order.notes}</p>
                                        </div>
                                      </div>
                                    )}

                                    {/* Botoes de Acao Manuais */}
                                    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                                      <div className="flex flex-wrap gap-2">
                                        <button type="button"
                                          onClick={() => handleOpenOSModalForOrder(f.lot, [f.si.orderId])}
                                          className={`flex-1 min-w-[80px] py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${isDarkMode ? 'bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                                        >
                                          <Hammer size={10} /> Gerar OS
                                        </button>
                                        <button type="button"
                                          onClick={() => setManualSectorPicker({ lot: f.lot })}
                                          className={`flex-1 min-w-[80px] py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                          <ArrowRight size={10} /> Mudar Setor
                                        </button>
                                      </div>

                                      {product && (
                                        <div className="flex items-center gap-2">
                                          <button type="button"
                                            onClick={() => {
                                              if (f.product) {
                                                setLabelModalProduct(f.product);
                                                setLabelModalLot(f.lot);
                                                const itemSizeGrid = Object.entries(f.si.sizes || {})
                                                  .filter(([_, s]: any) => Number(s?.toProduction ?? s) > 0)
                                                  .map(([sz, s]: any) => `${sz}=${Number(s?.toProduction ?? s)}`)
                                                  .join(';');
                                                setLabelModalSizeGrid(itemSizeGrid);
                                                setLabelModalBatchItems([{ product: f.product, variation: f.variation, sizeGrid: itemSizeGrid, lotId: f.lot.id, orderId: f.si.orderId, itemIdx: f.siIdx }]);
                                              } else {
                                                toast.show('Produto não encontrado.');
                                              }
                                            }}
                                            className="flex-1 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all bg-indigo-600 hover:bg-indigo-700 text-white"
                                          >
                                            <Printer size={10} /> Imprimir / Compartilhar
                                          </button>
                                        </div>
                                      )}
                                      
                                      {product && (
                                        <div className={`relative flex items-center justify-between gap-2 pt-1 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ficha do Pedido</p>
                                          <button
                                            type="button"
                                            disabled={isPedidoShareExporting}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSharePedidoPopupKey(sharePedidoPopupKey === itemKey ? null : itemKey);
                                            }}
                                            className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-slate-600 text-white hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
                                          >
                                            {isPedidoShareExporting && sharePedidoPopupKey === itemKey
                                              ? <span className="animate-spin text-xs leading-none">⏳</span>
                                              : <Share2 size={10} />}
                                            Compartilhar Ficha
                                          </button>
                                          {sharePedidoPopupKey === itemKey && (
                                            <>
                                              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setSharePedidoPopupKey(null); }} />
                                              <div className={`absolute bottom-full right-0 mb-1.5 rounded-2xl shadow-2xl border z-50 p-2 flex flex-col gap-1 min-w-[190px] ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                <p className={`text-[8px] font-black uppercase tracking-widest px-2 pb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Ficha do Pedido</p>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setSharePedidoPopupKey(null); handleSharePedidoSheet(selectedLot, product, variation, order, szEntries.map(([sz, s]) => [sz, s?.toProduction ?? s] as [string, number]), si.qty, 'pdf'); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 text-left ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}>
                                                  <Share2 size={11} className="shrink-0" /> PDF — Impressão
                                                </button>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setSharePedidoPopupKey(null); handleSharePedidoSheet(selectedLot, product, variation, order, szEntries.map(([sz, s]) => [sz, s?.toProduction ?? s] as [string, number]), si.qty, 'image'); }} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 text-left ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}>
                                                  <Image size={11} className="shrink-0" /> Imagem — WhatsApp
                                                </button>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Emitir OS - Multi-Mapa */}"""

    full_pattern_to_replace = r"                            return \(\n                              <div key=\{itemKey\} className=\{`rounded-2xl border overflow-hidden transition-all \$\{\n" + "(.*?)" + r"                              </div>\n                            \);\n                          \}\)\}\n                        </div>\n\n                        \{\/\* Emitir OS \- Multi\-Mapa \*\/\}"
    new_content = re.sub(full_pattern_to_replace, new_block, content, flags=re.DOTALL)
    
    with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Replaced successfully!")

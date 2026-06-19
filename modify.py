import sys

def modify_file():
    with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    old_block_1 = '''                        {/* Emitir OS - Multi-Mapa */}
                        {selected.length > 0 && (
                          <div className="flex flex-col gap-2">
                            {(() => {
                              const uniqueLotsMap = new Map<string, ProductionLot>();
                              let totalQty = 0;
                              selected.forEach(f => {
                                uniqueLotsMap.set(f.lot.id, f.lot);
                                totalQty += (f.si.qty || 0);
                              });
                              const uniqueLots = Array.from(uniqueLotsMap.values());
                              const uniqueItemKeys = Array.from(new Set(selected.map(f => \::\)));

                              return (
                                <>
                                <button type="button"
                                  onClick={() => {
                                    // Limpar seleo
                                    setFichaSelection(new Set());
                                    // Setor override
                                    // Check se todos tem redirect
                                    const redirectedFichas = selected.filter(f => {
                                      const cur = f.lot.route?.[f.lot.currentSectorIndex];
                                      return cur !== selectedSectorId;
                                    });
                                    const isRedirected = redirectedFichas.length === selected.length;
                                    const sectorOvr = isRedirected ? selectedSectorId : undefined;
                                    const qtyOvr = isRedirected ? totalQty : undefined;
                                    
                                    handleOpenOSModalForOrder(uniqueLots, uniqueItemKeys, undefined, sectorOvr, qtyOvr);
                                  }}
                                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shadow-sky-500/30"
                                >
                                  <Hammer size={13} /> Emitir OS - {selected.length} {selected.length === 1 ? 'Pedido' : 'Pedidos'} ({totalQty}P) {uniqueLots.length > 1 ?  \ MAPAS :  MAPA\}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShareModal({ isOpen: true, format: 'pdf', selectedItems: selected })}
                                  className={w-full py-2.5 mt-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 \}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                                  Compartilhar Ficha
                                </button>
                                </>
                              );
                            })()}
                          </div>
                        )}'''

    new_block_1 = '''                        {/* Ações em Massa - Multi-Mapa */}
                        {selected.length > 0 && (
                          <div className={mt-2 p-4 rounded-[2rem] border-2 flex flex-col gap-3 }>
                            {(() => {
                              const uniqueLotsMap = new Map<string, ProductionLot>();
                              let totalQty = 0;
                              selected.forEach(f => {
                                uniqueLotsMap.set(f.lot.id, f.lot);
                                totalQty += (f.si.qty || 0);
                              });
                              const uniqueLots = Array.from(uniqueLotsMap.values());
                              const uniqueItemKeys = Array.from(new Set(selected.map(f => ${f.si.orderId}::)));
                              const toMoveItem = (si: any) => ({ orderId: si.orderId, itemIdx: si.itemIdx, productId: si.productId, variationId: si.variationId });

                              return (
                                <>
                                <div>
                                  <h4 className="text-[11px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400 mb-0.5">Ações em Massa</h4>
                                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-snug">Selecione uma ação para aplicar aos {selected.length} pedidos ({totalQty}P) selecionados.</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <button type="button"
                                    onClick={() => {
                                      // Limpar seleção
                                      setFichaSelection(new Set());
                                      // Setor override
                                      // Check se todos tem redirect
                                      const redirectedFichas = selected.filter(f => {
                                        const cur = f.lot.route?.[f.lot.currentSectorIndex];
                                        return cur !== selectedSectorId;
                                      });
                                      const isRedirected = redirectedFichas.length === selected.length;
                                      const sectorOvr = isRedirected ? selectedSectorId : undefined;
                                      const qtyOvr = isRedirected ? totalQty : undefined;
                                      
                                      handleOpenOSModalForOrder(uniqueLots, uniqueItemKeys, undefined, sectorOvr, qtyOvr);
                                    }}
                                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shadow-sky-500/30"
                                  >
                                    <Hammer size={13} /> Emitir OS Conjunta
                                  </button>

                                  {selected.length > 1 && (
                                    <button
                                      type="button"
                                      title={uniqueLots.length > 1 ? "Para mudar o setor manualmente, selecione pedidos de apenas um MAPA" : "Escolher livremente o setor de destino dos pedidos selecionados"}
                                      onClick={() => {
                                        if (uniqueLots.length > 1) {
                                          alert("Para mudar o setor manualmente, selecione pedidos do mesmo MAPA.");
                                          return;
                                        }
                                        setMoveSectorModal({
                                          lotId: uniqueLots[0].id,
                                          items: selected.map(f => toMoveItem(f.si)),
                                          qty: totalQty,
                                          manual: true,
                                        });
                                        setMoveSectorTarget('');
                                      }}
                                      className={w-full py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 }
                                    >
                                      <ArrowLeftRight size={13} strokeWidth={2.5} /> Mudar Setor Manualmente
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => setShareModal({ isOpen: true, format: 'pdf', selectedItems: selected })}
                                    className={w-full py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 }
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                                    Compartilhar Fichas
                                  </button>
                                </div>
                                </>
                              );
                            })()}
                          </div>
                        )}'''
    
    # We must be careful because of the "" characters in the read content.
    # We'll use a regex or string replacement that ignores the exact text of "",
    # or just replace line-by-line or with partial matching to avoid encoding mismatch.

    # Let's read the file line by line and find the start and end of block 1
    lines = content.splitlines(True)
    start_idx = -1
    end_idx = -1
    for i, line in enumerate(lines):
        if "{/* Emitir OS - Multi-Mapa */}" in line:
            start_idx = i
        if start_idx != -1 and i > start_idx and "Compartilhar Ficha" in line:
            # find the end of the block
            for j in range(i, i+15):
                if "})()}" in lines[j] and "</div>" in lines[j+1] and ")}  " in lines[j+2] or ")}" in lines[j+2]:
                    end_idx = j+2
                    break
            if end_idx != -1:
                break
    
    if start_idx != -1 and end_idx != -1:
        new_lines = lines[:start_idx] + [new_block_1 + '\n'] + lines[end_idx+1:]
        content = "".join(new_lines)
        print("Replaced Block 1 successfully.")
    else:
        print("Could not find Block 1.")
        
    old_block_2 = '''                                {product && variation && (
                                  <div className={lex items-center justify-between gap-2 pt-2 border-t }>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Etiqueta deste Pedido</p>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const itemSizeGrid = sizeEntries.map(([sz, s]) => ${sz}x).join('-');
                                        setLabelModalProduct(product);
                                        setLabelModalLot(selectedLot);
                                        setLabelModalSizeGrid(itemSizeGrid);
                                        setLabelModalBatchItems([{ product, variation, sizeGrid: itemSizeGrid, lotId: selectedLot.id, orderId: si.orderId, itemIdx: si.itemIdx }]);
                                      }}
                                      className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-all active:scale-95"
                                    >
                                      <Printer size={11} />
                                      Imprimir / Compartilhar
                                    </button>
                                  </div>
                                )}'''

    new_block_2 = '''                                {product && variation && (
                                  <div className={lex items-center justify-between gap-2 pt-2 border-t }>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Etiqueta deste Pedido</p>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const itemSizeGrid = sizeEntries.map(([sz, s]) => ${sz}x).join('-');
                                        setLabelModalProduct(product);
                                        setLabelModalLot(selectedLot);
                                        setLabelModalSizeGrid(itemSizeGrid);
                                        setLabelModalBatchItems([{ product, variation, sizeGrid: itemSizeGrid, lotId: selectedLot.id, orderId: si.orderId, itemIdx: si.itemIdx }]);
                                      }}
                                      className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-all active:scale-95"
                                    >
                                      <Printer size={11} />
                                      Imprimir / Compartilhar
                                    </button>
                                  </div>
                                )}
                                <div className={lex items-center justify-between gap-2 pt-2 border-t }>
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ação Manual</p>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMoveSectorModal({
                                        lotId: selectedLot.id,
                                        items: [{ orderId: si.orderId, itemIdx: si.itemIdx, productId: si.productId, variationId: si.variationId }],
                                        qty: si.qty,
                                        manual: true,
                                      });
                                      setMoveSectorTarget('');
                                    }}
                                    className={lex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all active:scale-95 }
                                  >
                                    <ArrowLeftRight size={11} strokeWidth={2.5} />
                                    Mudar Setor Manualmente
                                  </button>
                                </div>'''
    
    # We will search for old_block_2 in the lines and replace it
    start_idx_2 = -1
    end_idx_2 = -1
    for i, line in enumerate(lines):
        if "Etiqueta deste Pedido" in line:
            # backtrack to the start of {product && variation &&
            for j in range(i, i-5, -1):
                if "{product && variation && (" in lines[j]:
                    start_idx_2 = j
                    break
            # advance to end of block
            for j in range(i, i+20):
                if ")}  " in lines[j] or ")}" in lines[j]:
                    # check if the next line is "                                {product && (" -> wait, the next block is {product && (
                    if j+1 < len(lines) and "{product && (" in lines[j+1]:
                        end_idx_2 = j
                        break
            if start_idx_2 != -1 and end_idx_2 != -1:
                break
    
    if start_idx_2 != -1 and end_idx_2 != -1:
        new_lines_2 = lines[:start_idx_2] + [new_block_2 + '\n'] + lines[end_idx_2+1:]
        content = "".join(new_lines_2)
        print("Replaced Block 2 successfully.")
    else:
        print("Could not find Block 2.")

    with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

modify_file()

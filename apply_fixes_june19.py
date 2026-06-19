import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# --- 4. Setores bottom selection bar (OS + Share buttons) ---
target4 = """                            {selected.length > 0 && (
                              <div className="flex flex-col gap-2">
                                {Array.from(selByLot.entries()).map(([lotId, lotSelected]) => {
                                  const lot = allFichas.find(f => f.lot.id === lotId)?.lot;
                                  if (!lot) return null;
                                  const nextSId = lot.route?.[lot.currentSectorIndex + 1] || '';
                                  const nextSName = sectors.find(s => s.id === nextSId)?.name || 'CONCLUÍDO';
                                  const qty = lotSelected.reduce((s, f) => s + (f.si.qty || 0), 0);
                                  return (
                                    <button type="button" key={lotId}
                                      onClick={() => {
                                        const orderIds = lotSelected.map(f => f.si.orderId);
                                        const n = new Set(fichaSelection);
                                        lotSelected.forEach(f => n.delete(`${lotId}::${f.si.orderId}::${f.siIdx}`));
                                        setFichaSelection(n);
                                        // Pedidos deste mapa cujo setor efetivo difere do setor de origem (route[currentSectorIndex])
                                        const lotCurrentSector = lot.route?.[lot.currentSectorIndex];
                                        const isRedirected = lotCurrentSector !== selectedSectorId;
                                        const sectorOvr = isRedirected ? selectedSectorId : undefined;
                                        const qtyOvr = isRedirected ? qty : undefined;
                                        handleOpenOSModalForOrder(lot, orderIds, undefined, sectorOvr, qtyOvr);
                                      }}
                                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shadow-sky-500/30"
                                    >
                                      <Hammer size={13} /> Emitir OS — {lotSelected.length} {lotSelected.length === 1 ? 'Pedido' : 'Pedidos'} ({qty}P) · MAPA{lot.orderNumber}
                                    </button>
                                  );
                                })}
                              </div>
                            )}"""

replacement4 = """                            {selected.length > 0 && (
                              <div className="flex flex-col gap-2">
                                <button type="button"
                                  onClick={() => {
                                    const selectedFichasData = filteredFichas.filter(f => fichaSelection.has(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));
                                    setShareModal({ isOpen: true, format: 'pdf', selectedItems: selectedFichasData });
                                  }}
                                  className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm shadow-orange-500/20"
                                >
                                  <Share2 size={13} /> Compartilhar {selected.length} {selected.length === 1 ? 'Pedido' : 'Pedidos'} ({selectedQty}P)
                                </button>

                                {selByLot.size > 1 && (
                                  <button type="button"
                                    onClick={() => {
                                      const uniqueLots = Array.from(selByLot.keys()).map(id => allFichas.find(f => f.lot.id === id)?.lot).filter(Boolean) as ProductionLot[];
                                      const orderIds = selected.map(f => `${f.lot.id}::${f.si.orderId}::${f.siIdx}`);
                                      
                                      const n = new Set(fichaSelection);
                                      selected.forEach(f => n.delete(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));
                                      setFichaSelection(n);

                                      const firstLot = uniqueLots[0];
                                      const lotCurrentSector = firstLot.route?.[firstLot.currentSectorIndex];
                                      const isRedirected = lotCurrentSector !== selectedSectorId;
                                      const sectorOvr = isRedirected ? selectedSectorId : undefined;
                                      const qtyOvr = isRedirected ? selectedQty : undefined;

                                      handleOpenOSModalForOrder(uniqueLots, orderIds, undefined, sectorOvr, qtyOvr);
                                    }}
                                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shadow-emerald-500/30"
                                  >
                                    <Hammer size={13} /> Emitir OS Unificada — {selected.length} Pedidos ({selectedQty}P)
                                  </button>
                                )}

                                {Array.from(selByLot.entries()).map(([lotId, lotSelected]) => {
                                  const lot = allFichas.find(f => f.lot.id === lotId)?.lot;
                                  if (!lot) return null;
                                  const qty = lotSelected.reduce((s, f) => s + (f.si.qty || 0), 0);
                                  return (
                                    <button type="button" key={lotId}
                                      onClick={() => {
                                        const orderIds = lotSelected.map(f => `${f.lot.id}::${f.si.orderId}::${f.siIdx}`);
                                        const n = new Set(fichaSelection);
                                        lotSelected.forEach(f => n.delete(`${lotId}::${f.si.orderId}::${f.siIdx}`));
                                        setFichaSelection(n);
                                        const lotCurrentSector = lot.route?.[lot.currentSectorIndex];
                                        const isRedirected = lotCurrentSector !== selectedSectorId;
                                        const sectorOvr = isRedirected ? selectedSectorId : undefined;
                                        const qtyOvr = isRedirected ? qty : undefined;
                                        handleOpenOSModalForOrder(lot, orderIds, undefined, sectorOvr, qtyOvr);
                                      }}
                                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shadow-sky-500/30"
                                    >
                                      <Hammer size={13} /> Emitir OS — {lotSelected.length} {lotSelected.length === 1 ? 'Pedido' : 'Pedidos'} ({qty}P) · MAPA{lot.orderNumber}
                                    </button>
                                  );
                                })}
                              </div>
                            )}"""

print("Applying Target 4...")
if target4 in content:
    content = content.replace(target4, replacement4)
    print("Target 4 applied successfully!")
else:
    print("Target 4 NOT found!")

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

import os

filepath = r"c:\Users\SISTEMAS-PC\Desktop\PROJETOS ANTIGRAVIT\APP VENDAS E PRODUCAO\src\views\PCPView.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize newlines
content_normalized = content.replace('\r\n', '\n')

target_block = """                                <button type="button"
                                  onClick={() => {
                                    const selectedFichasData = filteredFichas.filter(f => fichaSelection.has(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));
                                    setManualSectorPicker({ fichas: selectedFichasData });
                                  }}
                                  className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm shadow-violet-500/20"
                                >
                                  <ArrowLeftRight size={13} /> Mudar Setor — {selected.length} {selected.length === 1 ? 'Pedido' : 'Pedidos'}
                                </button>"""

replacement_block = """                                <button type="button"
                                  onClick={() => {
                                    const selectedFichasData = filteredFichas.filter(f => fichaSelection.has(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));
                                    setManualSectorPicker({ fichas: selectedFichasData });
                                  }}
                                  className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm shadow-violet-500/20"
                                >
                                  <ArrowLeftRight size={13} /> Mudar Setor — {selected.length} {selected.length === 1 ? 'Pedido' : 'Pedidos'}
                                </button>

                                {(() => {
                                  const isEndCycle = !!sectors.find(s => s.id === selectedSectorId)?.isProductionCycleEnd || 
                                    selectedSectorId?.toUpperCase().includes('EXPEDIÇÃO') || 
                                    selectedSectorId?.toUpperCase().includes('EXPEDICAO');
                                  
                                  if (!isEndCycle) return null;

                                  return (
                                    <button type="button"
                                      onClick={() => {
                                        const selectedFichasData = filteredFichas.filter(f => fichaSelection.has(`${f.lot.id}::${f.si.orderId}::${f.siIdx}`));
                                        
                                        const resolved: LotAdvanceItem[] = selectedFichasData.map((f: any, idx: number) => {
                                          const resolvedProductId = f.si.productId || f.orderItem?.productId;
                                          const itemProduct = products.find(p => p.id === resolvedProductId);
                                          const effSector = getOrderEffectiveSector(f.lot, f.si.orderId, f.si);
                                          const resolved = resolveCorrectSectorForProduct(effSector, itemProduct, sectors);
                                          const chosenSectorId = resolved.isFinished ? '' : resolved.sectorId;
                                          return {
                                            key: `${f.si.orderId}-${idx}`,
                                            orderId: f.si.orderId,
                                            itemIdx: f.si.itemIdx,
                                            variationId: f.si.variationId,
                                            productId: resolvedProductId,
                                            productName: itemProduct?.name || f.orderItem?.productName || '—',
                                            colorName: '',
                                            qty: f.si.qty || 0,
                                            suggestedSectorId: chosenSectorId,
                                            suggestedSectorName: resolved.isFinished ? 'CONCLUÍDO' : (sectors.find(s => s.id === resolved.sectorId)?.name || ''),
                                            skippedSectorNames: resolved.skippedSectorNames,
                                            chosenSectorId,
                                          };
                                        });

                                        const toFinalize = resolved.filter(it => it.chosenSectorId === '');
                                        const lines: string[] = [`Avançar/finalizar ${resolved.length} pedido(s) selecionado(s)?`];
                                        const stockInfo: Record<string, { destino: string; currentQty: number; addQty: number; projectedQty: number; unit: string }> = {};
                                        const soleInfo: { moldName: string; colorName: string; rows: { size: string; before: number; after: number }[] }[] = [];
                                        
                                        if (toFinalize.length > 0) {
                                          const { customerItems, stockItems } = classifyExpedicaoOrders(toFinalize.map(it => ({ orderId: it.orderId, itemIdx: it.itemIdx })));
                                          lines.push('');
                                          if (customerItems.length > 0) lines.push(`📦 ${customerItems.length} pedido(s) → RESERVA PARA O CLIENTE (aguardando baixa manual na Venda)`);
                                          if (stockItems.length > 0) lines.push(`🏭 ${stockItems.length} pedido(s) → ENTRADA EM ESTOQUE (+ baixa de solados)`);
                                          
                                          resolved.forEach(it => {
                                            const isStock = stockItems.some(si => si.orderId === it.orderId && si.itemIdx === it.itemIdx);
                                            const fichaItem = selectedFichasData.find(f => f.si.orderId === it.orderId && f.siIdx === it.itemIdx);
                                            const customerName = fichaItem?.order?.customerName || fichaItem?.lot.customerName;
                                            const info = computeStockProjection(it, { isStock, customerName });
                                            if (info) stockInfo[it.key] = info;
                                          });

                                          // Sole consumption preview
                                          const consumptionByKey = new Map<string, { moldId: string; colorId: string; gradeQuantities: Record<string, number> }>();
                                          toFinalize.forEach(it => {
                                            const fichaItem = selectedFichasData.find(f => f.si.orderId === it.orderId && f.siIdx === it.itemIdx);
                                            if (!fichaItem) return;
                                            const { product: prod, variation: vari, si, orderItem } = fichaItem;
                                            const pairs = orderItem?.sizes ? Object.entries(orderItem.sizes).reduce((acc, [sz, data]: [string, any]) => ({ ...acc, [sz]: data.toProduction || 0 }), {}) : {};
                                            const consumption = resolveSoleConsumption(prod, vari, pairs, it.qty, soleStock);
                                            if (!consumption) return;
                                            const key = `${consumption.moldId}_${consumption.colorId || 'default'}`;
                                            const existing = consumptionByKey.get(key);
                                            if (!existing) {
                                              consumptionByKey.set(key, { moldId: consumption.moldId, colorId: consumption.colorId, gradeQuantities: { ...consumption.gradeQuantities } });
                                            } else {
                                              Object.entries(consumption.gradeQuantities).forEach(([gradeKey, qty]) => {
                                                existing.gradeQuantities[gradeKey] = (existing.gradeQuantities[gradeKey] || 0) + qty;
                                              });
                                            }
                                          });

                                          consumptionByKey.forEach(({ moldId, colorId, gradeQuantities }) => {
                                            const entry = soleStock.find(s => String(s.moldId).trim() === moldId && String(s.colorId || '').trim() === colorId);
                                            if (!entry) return;
                                            const rows = Object.entries(gradeQuantities)
                                              .filter(([k]) => k !== 'pesagem' && k !== 'total')
                                              .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                                              .map(([size, qty]) => ({ size, before: entry.stock[size] || 0, after: Math.max(0, (entry.stock[size] || 0) - (Number(qty) || 0)) }));
                                            soleInfo.push({ moldName: entry.moldName, colorName: entry.colorName, rows });
                                          });
                                        }

                                        const uniqueLotsList = Array.from(new Set(selectedFichasData.map(f => f.lot.id)))
                                          .map(id => lots.find(l => l.id === id))
                                          .filter(Boolean) as ProductionLot[];

                                        if (uniqueLotsList.length > 0) {
                                          setFinalizeSelectedConfirm({
                                            lot: uniqueLotsList[0],
                                            items: resolved,
                                            lines,
                                            stockInfo,
                                            soleInfo
                                          });
                                          setFichaSelection(new Set());
                                        }
                                      }}
                                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm shadow-emerald-500/20"
                                    >
                                      <CheckCircle2 size={13} /> Concluir / Dar Baixa {selected.length} Pedido(s) ({selectedQty} {selectedQty === 1 ? 'par' : 'pares'})
                                    </button>
                                  );
                                })()}"""

target_normalized = target_block.replace('\r\n', '\n')
replacement_normalized = replacement_block.replace('\r\n', '\n')

if target_normalized in content_normalized:
    new_content = content_normalized.replace(target_normalized, replacement_normalized)
    with open(filepath, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(new_content)
    print("SUCCESS: Concluir / Dar Baixa batch button added to Kanban sector view.")
else:
    print("ERROR: Target block not found in content!")

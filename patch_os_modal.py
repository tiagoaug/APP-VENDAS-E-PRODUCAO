import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: handleOpenOSModal setSelectedLot(null) -> setSelectedLot(list[0])
content = content.replace("setSelectedLot(null);", "setSelectedLot(list[0]);")

# Fix 2: OS Header Info block rewrite
header_pattern = r"\{/\* OS Header Info \*/\}.*?\{/\* OS Form \*/\}"
new_header = """{/* OS Header Info */}
          {(selectedLot || selectedLots.length > 0) && (
            <div className={`p-4 rounded-2xl flex flex-col gap-2 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
              {(() => {
                const targetLots = selectedLots.length > 0 ? selectedLots : (selectedLot ? [selectedLot] : []);
                const firstLot = targetLots[0];
                const hasSelectedOrders = pendingOsSourceOrderIds.length > 0;
                const isAdvancedOS = !!pendingOsSectorOverride && hasSelectedOrders;
                
                const effectiveSector = pendingOsSectorOverride
                  ? sectors.find(s => s.id === pendingOsSectorOverride)?.name
                  : sectors.find(s => s.id === (firstLot.route && firstLot.route[firstLot.currentSectorIndex]))?.name;

                // Produtos e cores dos pedidos selecionados across ALL targetLots
                const selectedOrderProducts = hasSelectedOrders ? Array.from(new Set(
                  pendingOsSourceOrderIds.flatMap(oid => {
                    for (const l of targetLots) {
                      const si = ((l as any).metadata?.sourceItems || []).find((s: any) => s.orderId === oid);
                      if (si) {
                        const prod = products.find(p => p.id === si.productId);
                        const vari = prod?.variations.find((v: any) => v.id === si?.variationId);
                        return prod ? `${prod.name}${vari?.colorName ? ' · ' + vari.colorName : ''}` : null;
                      }
                    }
                    return null;
                  }).filter(Boolean)
                )) : [];

                // Quantidade total dos pedidos selecionados across ALL targetLots
                const totalLotQty = targetLots.reduce((sum, l) => sum + (l.quantity || 0), 0);
                const effectiveQty = pendingOsQuantityOverride ?? totalLotQty;

                const selectedOrderQty = hasSelectedOrders
                  ? targetLots.reduce((accLot, l) => {
                      const lotItemsQty = ((l as any).metadata?.sourceItems || [])
                        .filter((si: any) => pendingOsSourceOrderIds.includes(si.orderId))
                        .reduce((accSi: number, si: any) => accSi + (si.qty || 0), 0);
                      return accLot + lotItemsQty;
                    }, 0)
                  : effectiveQty;

                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {isAdvancedOS ? 'Pedidos Adiantados — Mapa' : (targetLots.length > 1 ? 'Múltiplos Mapas' : 'Mapa de Produção')}
                      </span>
                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">
                        Qtd: {hasSelectedOrders ? selectedOrderQty : effectiveQty} Pares
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 leading-snug">
                      {selectedOrderProducts.length > 0
                        ? selectedOrderProducts.slice(0, 3).join(', ') + (selectedOrderProducts.length > 3 ? ` +${selectedOrderProducts.length - 3}` : '')
                        : (firstLot.customerName || 'Lote sem cliente')
                      }
                      {targetLots.length === 1 ? ` — #${firstLot.orderNumber}` : ` — Vários Mapas (${targetLots.length})`}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      {hasSelectedOrders ? `${pendingOsSourceOrderIds.length} pedido(s) selecionado(s)` : `Ref: ${products.find(p => p.id === firstLot.productId)?.reference || '---'}`} • Setor: {effectiveSector || '---'}
                    </p>
                    {isAdvancedOS && (
                      <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-1">
                        Mapa atualmente em: {sectors.find(s => s.id === (firstLot.route && firstLot.route[firstLot.currentSectorIndex]))?.name || '---'}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* OS Form */}"""

content = re.sub(header_pattern, new_header.replace('\\', '\\\\'), content, flags=re.DOTALL)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied")

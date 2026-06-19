import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Change the conference items layout:
# Before:
# <div className="flex items-center gap-2">
#   <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
#     Ped. {order?.saleOrderNumber || si.orderId.substring(0,6)}
#   </span>
#   <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
#     {prod?.reference || prod?.name || 'Produto'} {vari?.colorName ? vari.colorName : ''}
#   </span>
# </div>
# <span className="text-[10px] font-black text-slate-500 uppercase">{totalQty}P</span>
# 
# After:
# <div className="w-full flex flex-col gap-1">
#   <div className="flex items-center justify-between">
#     <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
#       Ped. {order?.saleOrderNumber || si.orderId.substring(0,6)}
#     </span>
#     <span className="text-[10px] font-black text-slate-500 uppercase">{totalQty}P</span>
#   </div>
#   <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">
#     {prod?.reference || prod?.name || 'Produto'} {vari?.colorName ? vari.colorName : ''}
#   </span>
# </div>

target_card_layout = """                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                                        Ped. {order?.saleOrderNumber || si.orderId.substring(0,6)}
                                      </span>
                                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                                        {prod?.reference || prod?.name || 'Produto'} {vari?.colorName ? vari.colorName : ''}
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase">{totalQty}P</span>
                                  </div>"""

replacement_card_layout = """                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                                        Ped. {order?.saleOrderNumber || si.orderId.substring(0,6)}
                                      </span>
                                      <span className="text-[10px] font-black text-slate-500 uppercase">{totalQty}P</span>
                                    </div>
                                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-200">
                                      {prod?.reference || prod?.name || 'Produto'} {vari?.colorName ? vari.colorName : ''}
                                    </span>
                                  </div>"""

content = content.replace(target_card_layout, replacement_card_layout)

# 2. Change `selectedOrderProducts` generation
# Before:
# return prod ? `${prod.name}${vari?.colorName ? ' - ' + vari.colorName : ''}` : null;
# After:
# return prod ? `${prod.reference || prod.name} ${vari?.colorName ? vari.colorName : ''}`.trim() : null;

target_selected_products = "return prod ? `${prod.name}${vari?.colorName ? ' - ' + vari.colorName : ''}` : null;"
replacement_selected_products = "return prod ? `${prod.reference || prod.name} ${vari?.colorName ? vari.colorName : ''}`.trim() : null;"

content = content.replace(target_selected_products, replacement_selected_products)

# We also need to check the case when `!hasSelectedOrders` (meaning they just open the OS for the map).
# For map OS, the header shows `firstLot.customerName`.
# If they want the reference and color there too, we can map `firstLot.metadata.sourceItems`.
# Wait, if `hasSelectedOrders` is false, `selectedOrderProducts` is empty list, so it falls back to:
# `{selectedOrderProducts.length > 0 ? ... : (firstLot.customerName || 'Lote sem cliente')}`
# Let's change `selectedOrderProducts` generation to ALWAYS compute from the first lot if it's empty?
# The user said: "onde esta escrito mapa de producao tambem coloque referencia e cor em cada produto"
# If `hasSelectedOrders` is false, I should compute the product list from `firstLot.metadata.sourceItems`!

target_selected_products_block = """                const selectedOrderProducts = hasSelectedOrders ? Array.from(new Set(
                  pendingOsSourceOrderIds.flatMap(oid => {
                    const [realOrderId, itemIdxStr] = oid.split('::');
                    for (const l of targetLots) {
                      const sourceItems = (l as any).metadata?.sourceItems || [];
                      const si = sourceItems.find((s: any, idx: number) => 
                        s.orderId === oid || 
                        s.orderId === realOrderId && (itemIdxStr ? String(s.itemIdx !== undefined ? s.itemIdx : idx) === itemIdxStr : true)
                      );
                      if (si) {
                        const prod = products.find(p => p.id === si.productId);
                        const vari = prod?.variations.find((v: any) => v.id === si?.variationId);
                        return prod ? `${prod.reference || prod.name} ${vari?.colorName ? vari.colorName : ''}`.trim() : null;
                      }
                    }
                    return null;
                  }).filter(Boolean)
                )) : [];"""

replacement_selected_products_block = """                const computeProductsFromItems = (items: any[]) => {
                  return Array.from(new Set(
                    items.map(si => {
                      const prod = products.find(p => p.id === si.productId);
                      const vari = prod?.variations.find((v: any) => v.id === si?.variationId);
                      return prod ? `${prod.reference || prod.name} ${vari?.colorName ? vari.colorName : ''}`.trim() : null;
                    }).filter(Boolean)
                  ));
                };

                const selectedOrderProducts = hasSelectedOrders ? Array.from(new Set(
                  pendingOsSourceOrderIds.flatMap(oid => {
                    const [realOrderId, itemIdxStr] = oid.split('::');
                    for (const l of targetLots) {
                      const sourceItems = (l as any).metadata?.sourceItems || [];
                      const si = sourceItems.find((s: any, idx: number) => 
                        s.orderId === oid || 
                        s.orderId === realOrderId && (itemIdxStr ? String(s.itemIdx !== undefined ? s.itemIdx : idx) === itemIdxStr : true)
                      );
                      if (si) {
                        const prod = products.find(p => p.id === si.productId);
                        const vari = prod?.variations.find((v: any) => v.id === si?.variationId);
                        return prod ? `${prod.reference || prod.name} ${vari?.colorName ? vari.colorName : ''}`.trim() : null;
                      }
                    }
                    return null;
                  }).filter(Boolean)
                )) : computeProductsFromItems((firstLot as any).metadata?.sourceItems || []);"""

content = content.replace(target_selected_products_block, replacement_selected_products_block)

# One more thing: For legacy maps that don't have `sourceItems`, `selectedOrderProducts` might be empty.
# In that case, we should fallback to `firstLot.customerName`.
# The current fallback is:
# `{selectedOrderProducts.length > 0 ? ... : (firstLot.customerName || 'Lote sem cliente')}`
# This fallback is already in place! So if `computeProductsFromItems` returns an empty array, it will fall back to `firstLot.customerName`.
# Which is perfect.

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied layout and formatting changes!")

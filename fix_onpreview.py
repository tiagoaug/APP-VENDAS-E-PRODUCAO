import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

correct_logic = """
          const { selectedItems } = shareModal;
          
          const uniqueLots = Array.from(new Set(selectedItems.map(f => f.lot.id)))
            .map(id => filteredActiveLots.find(l => l.id === id))
            .filter(Boolean) as any[];

          const items: PCPShareItem[] = selectedItems.map(f => {
            const order = productionOrders.find(o => o.id === f.si.orderId);
            const ordItem = f.siIdx !== undefined 
              ? order?.items[f.siIdx] 
              : order?.items.find((i: any) => i.productId === f.si.productId && i.variationId === f.si.variationId);
            
            const prod = products.find(p => p.id === (ordItem?.productId || f.si.productId));
            const vari = prod?.variations.find((v: any) => v.id === (ordItem?.variationId || f.si.variationId));
            
            const sizes = Object.entries(ordItem?.sizes || {})
              .map(([sz, sData]: [string, any]) => ({ size: sz, qty: Number(sData.toProduction) || 0 }))
              .filter(s => s.qty > 0)
              .sort((a, b) => parseFloat(a.size) - parseFloat(b.size));

            const totalQty = sizes.reduce((acc, s) => acc + s.qty, 0);
            
            const secEntries = Object.entries(vari?.sectorNotes || {})
               .map(([sid, notes]) => ({ sid, notes: (notes as any[]).filter(n => n.text).map(n => n.text) }))
               .filter(({ notes }) => notes.length > 0)
               .map(({ sid, notes }) => {
                 const sectorName = sectors.find(s => s.id === sid)?.name || 'Setor Desconhecido';
                 return { sectorName, notes };
               });

            return {
              orderNumber: order?.saleOrderNumber || f.si.orderId.substring(0, 6),
              reference: prod?.reference || prod?.name || '---',
              color: vari?.colorName || '---',
              totalPairs: totalQty,
              sizeGrid: sizes,
              sectorNotes: secEntries
            };
          });


          const lotNumbers = uniqueLots.map((l: any) => l.orderNumber).filter(Boolean).join(', ');

          let finalItems = items;

          if (grouped) {
            const groupedMap = new Map<string, PCPShareItem>();
            for (const item of items) {
               const key = `${item.reference}::${item.color}`;
               if (groupedMap.has(key)) {
                   const existing = groupedMap.get(key)!;
                   existing.totalPairs += item.totalPairs;
                   existing.orderNumber = existing.orderNumber.includes(',') ? existing.orderNumber : `${existing.orderNumber}, ${item.orderNumber}`;
                   
                   const sizeMap = new Map<string, number>();
                   for (const s of existing.sizeGrid) sizeMap.set(s.size, s.qty);
                   for (const s of item.sizeGrid) sizeMap.set(s.size, (sizeMap.get(s.size) || 0) + s.qty);
                   existing.sizeGrid = Array.from(sizeMap.entries()).map(([size, qty]) => ({ size, qty })).sort((a,b) => parseFloat(a.size) - parseFloat(b.size));
               } else {
                   groupedMap.set(key, { ...item });
               }
            }
            finalItems = Array.from(groupedMap.values());
            for (const fi of finalItems) {
               if (fi.orderNumber.includes(',')) fi.orderNumber = 'Vários';
            }
          }

          const res = await generatePCPShareExport({
            lotNumber: lotNumbers || 'Vários',
            items: finalItems,
            additionalNote: note,
            isDarkMode,
            showTotalGrid,
            showMaterials,
            showItemGrid,
            showSectorNotes,
            showOrderList
          }, format, true);
          return res;
"""

# I need to find the onPreview block inside PCPView.tsx and replace its content with correct_logic
start_pattern = r"onPreview=\{async \(note, format, showVals, grouped, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList\) => \{"
end_pattern = r"return res;\n\s*\}\}\n"

match = re.search(start_pattern + r"(.*?)" + end_pattern, content, re.DOTALL)
if match:
    new_code = "onPreview={async (note, format, showVals, grouped, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList) => {" + correct_logic + "        }}\n"
    content = content[:match.start()] + new_code + content[match.end():]
    with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed onPreview in PCPView.tsx!")
else:
    print("Regex match failed for onPreview!")

import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add onPreview to ExportNoteModal
on_preview_code = """
        onPreview={async (note, format, showVals, grouped, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList) => {
          const items = selected.map(id => f.osList.find(o => o.id === id)).filter(Boolean) as ServiceOrder[];
          if (!items.length) return false;

          let noteText = '';
          if (note) {
            noteText = predefinedNotes.includes(note) ? note : note;
          }

          const rawItems = items.map(os => {
            const vari = os.items[0]?.variation;
            const prod = vari?.product;
            const sizes = vari?.sizes || [];
            const totalQty = sizes.reduce((acc, s) => acc + s.qty, 0);
            
            const secEntries = Object.entries(vari?.sectorNotes || {})
               .map(([sid, notes]) => ({ sid, notes: (notes as any[]).filter(n => n.text).map(n => n.text) }))
               .filter(({ notes }) => notes.length > 0)
               .map(({ sid, notes }) => {
                 const sectorName = sectors.find(s => s.id === sid)?.name || 'Setor Desconhecido';
                 return { sectorName, notes };
               });

            return {
              orderNumber: os.saleOrderNumber || os.id.substring(0, 6),
              reference: prod?.reference || prod?.name || '---',
              color: vari?.colorName || '---',
              totalPairs: totalQty,
              sizeGrid: sizes,
              sectorNotes: secEntries
            };
          });

          const uniqueLots = Array.from(new Map(rawItems.map(item => [item.orderNumber, item])).values());
          const lotNumbers = uniqueLots.map(l => l.orderNumber).filter(Boolean).join(', ');

          let finalItems = rawItems;
          if (grouped) {
            const groupedMap = new Map<string, PCPShareItem>();
            for (const item of rawItems) {
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
            additionalNote: noteText,
            isDarkMode,
            showTotalGrid,
            showMaterials,
            showItemGrid,
            showSectorNotes,
            showOrderList
          }, format, true);
          return res;
        }}
"""

target = "        showOrderListToggle={true}"
content = content.replace(target, target + "\n" + on_preview_code)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("PCPView updated with onPreview!")

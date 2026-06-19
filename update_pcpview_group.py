import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Update onConfirm signature
content = content.replace(
    "onConfirm={async (note, format, showVals, grouped, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList) => {",
    "onConfirm={async (note, format, showVals, groupMode, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList) => {"
)

# Update onConfirm logic
logic_old = """
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
"""
logic_new = """
          if (groupMode !== 'none') {
            const groupedMap = new Map<string, PCPShareItem>();
            for (const item of items) {
               const key = groupMode === 'ref' ? item.reference : `${item.reference}::${item.color}`;
               if (groupedMap.has(key)) {
                   const existing = groupedMap.get(key)!;
                   existing.totalPairs += item.totalPairs;
                   if (groupMode === 'ref') {
                       if (existing.color !== 'Várias' && existing.color !== item.color) {
                           existing.color = 'Várias';
                       }
                   }
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
"""
content = content.replace(logic_old.strip(), logic_new.strip())

# Update onPreview signature
content = content.replace(
    "onPreview={async (note, format, showVals, grouped, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList) => {",
    "onPreview={async (note, format, showVals, groupMode, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList) => {"
)

content = content.replace(logic_old.strip(), logic_new.strip())

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("PCPView group logic updated!")

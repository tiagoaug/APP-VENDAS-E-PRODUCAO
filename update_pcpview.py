import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Modify ExportNoteModal
pattern = r"<ExportNoteModal\s+isOpen=\{shareModal\.isOpen\}[\s\S]*?title=\"Central de Compartilhamento - PCP\"\n\s*/>"

def replacer(match):
    original = match.group(0)
    # Add props
    new_str = original.replace("title=\"Central de Compartilhamento - PCP\"", "title=\"Central de Compartilhamento - PCP\"\n        showGroupingToggle={true}\n        showPCPTotalGridToggle={true}")
    
    # Change onConfirm signature
    new_str = new_str.replace("onConfirm={async (note, format, showVals, grouped) => {", "onConfirm={async (note, format, showVals, grouped, showTotalGrid) => {")
    
    # Add grouping logic
    logic = """
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

          const success = await generatePCPShareExport({
            lotNumber: lotNumbers || 'Vários',
            items: finalItems,
            additionalNote: note,
            isDarkMode,
            showTotalGrid
          }, format);
"""
    new_str = re.sub(r"const lotNumbers = uniqueLots.*?\}, format\);", logic.strip(), new_str, flags=re.DOTALL)
    
    return new_str

content = re.sub(pattern, replacer, content)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("PCPView updated with grouping logic!")

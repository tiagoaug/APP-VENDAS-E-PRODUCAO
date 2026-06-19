import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports
if "import ExportNoteModal from '../components/ExportNoteModal';" not in content:
    content = content.replace(
        "import { getMaterialStockForColor } from '../utils/materialStock';",
        "import { getMaterialStockForColor } from '../utils/materialStock';\nimport ExportNoteModal from '../components/ExportNoteModal';\nimport { generatePCPShareExport, PCPShareItem } from '../utils/pcpShareExport';"
    )

# 2. Add state
if "const [shareModal, setShareModal]" not in content:
    content = content.replace(
        "const [isPCPShareModalOpen, setIsPCPShareModalOpen] = useState(false);",
        "const [isPCPShareModalOpen, setIsPCPShareModalOpen] = useState(false);\n  const [shareModal, setShareModal] = useState<{ isOpen: boolean; format: 'pdf' | 'jpg'; selectedItems: any[] }>({ isOpen: false, format: 'pdf', selectedItems: [] });"
    )

# 3. Inject ExportNoteModal
modal_code = """
      <ExportNoteModal
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={async (note, format, showVals, groupMode, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList) => {
          const { selectedItems } = shareModal;
          
          const uniqueLots = Array.from(new Set(selectedItems.map((f: any) => f.lot.id)))
            .map((id: any) => lots.find((l: any) => l.id === id))
            .filter(Boolean) as any[];

          const items: PCPShareItem[] = selectedItems.map((f: any) => {
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

          let finalItems = items;
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

          const lotNumbers = uniqueLots.map(l => l.orderNumber).filter(Boolean).join(', ');

          const success = await generatePCPShareExport({
            lotNumber: lotNumbers || 'Vários',
            items: finalItems,
            additionalNote: note,
            isDarkMode,
            showTotalGrid,
            showMaterials,
            showItemGrid,
            showSectorNotes,
            showOrderList
          }, format);

          if (success) {
            setShareModal(prev => ({ ...prev, isOpen: false }));
          }
        }}
        isDarkMode={isDarkMode}
        initialFormat={shareModal.format}
        title="Central de Compartilhamento - PCP"
      />
"""

if "<ExportNoteModal" not in content:
    last_div_pos = content.rfind("</div>")
    if last_div_pos != -1:
        content = content[:last_div_pos] + modal_code + content[last_div_pos:]

# 4. Change multiple selection share button back to use shareModal
if "setIsPCPShareModalOpen(true)" in content:
    content = content.replace(
        "setIsPCPShareModalOpen(true)",
        "setShareModal({ isOpen: true, format: 'pdf', selectedItems: selected })",
        1 # Only the first one, which is the multi-selection bar
    )

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Restoration complete")

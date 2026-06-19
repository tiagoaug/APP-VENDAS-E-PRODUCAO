import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the broken ExportNoteModal block
broken_modal_pattern = r"      <ExportNoteModal[\s\S]*?title=\"Central de Compartilhamento - PCP\"\n      />\n"
content = re.sub(broken_modal_pattern, "", content)

# 2. Add ExportNoteModal at the very end before the last closing div.
# First, let's find the last </div>
last_div_pos = content.rfind("</div>")

correct_modal = """
      <ExportNoteModal
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={async (note, format, showVals, grouped) => {
          const { selectedItems } = shareModal;
          
          const uniqueLots = Array.from(new Set(selectedItems.map(f => f.lot.id)))
            .map(id => productionLots.find(l => l.id === id))
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

          const lotNumbers = uniqueLots.map(l => l.orderNumber).filter(Boolean).join(', ');

          const success = await generatePCPShareExport({
            lotNumber: lotNumbers || 'Vários',
            items,
            additionalNote: note,
            isDarkMode
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

content = content[:last_div_pos] + correct_modal + content[last_div_pos:]

# 3. Fix the state definition
state_pattern = r"const \[shareModal, setShareModal\] = useState<\{ isOpen: boolean; format: 'pdf' \| 'jpg' \}>\(\{ isOpen: false, format: 'pdf' \}\);"
new_state = "const [shareModal, setShareModal] = useState<{ isOpen: boolean; format: 'pdf' | 'jpg'; selectedItems: any[] }>({ isOpen: false, format: 'pdf', selectedItems: [] });"
content = re.sub(state_pattern, new_state, content)

# 4. Fix the button click handler to pass selected
button_pattern = r"onClick=\{.*?setShareModal\(\{ isOpen: true, format: 'pdf' \}\)\}"
new_button = "onClick={() => setShareModal({ isOpen: true, format: 'pdf', selectedItems: selected })}"
content = re.sub(button_pattern, new_button, content)

# 5. Fix pcpShareExport.ts parameter error
# Error: src/utils/pcpShareExport.ts(35,44): error TS2554: Expected 1 arguments, but got 2.
# await sharePDF(doc, filename) was complaining because sharePDF takes 1 argument.
# Wait, pdfExport.ts sharePDF might take just `doc` and open in new tab?
# Let's check pdfExport.ts!

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("PCPView fixed!")

import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports
import_statement = """import ExportNoteModal from '../components/ExportNoteModal';
import { generatePCPShareExport, PCPShareItem } from '../utils/pcpShareExport';"""

if "import ExportNoteModal" not in content:
    # Find the last import
    last_import_pos = content.rfind("import ")
    end_of_last_import = content.find(";\n", last_import_pos)
    if end_of_last_import != -1:
        content = content[:end_of_last_import+2] + import_statement + "\n" + content[end_of_last_import+2:]

# 2. Add State inside PCPView
state_statement = """
  const [shareModal, setShareModal] = useState<{ isOpen: boolean; format: 'pdf' | 'jpg' }>({ isOpen: false, format: 'pdf' });
"""

if "const [shareModal, setShareModal]" not in content:
    # Add it after `const [isPrintModalOpen, setIsPrintModalOpen]` or any other state
    state_pattern = r"const \[isPrintModalOpen, setIsPrintModalOpen\] = useState\(false\);"
    content = re.sub(state_pattern, "const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);" + state_statement, content)

# 3. Render the ExportNoteModal at the end of PCPView
modal_statement = """
      <ExportNoteModal
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={async (note, format, showVals, grouped) => {
          // Compute PCPShareItem list
          const selectedItemsList = Array.from(fichaSelection.values());
          
          const uniqueLots = Array.from(new Set(selectedItemsList.map(f => f.lot.id)))
            .map(id => filteredActiveLots.find(l => l.id === id))
            .filter(Boolean) as ProductionLot[];

          const items: PCPShareItem[] = selectedItemsList.map(f => {
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

          // Compute lot numbers string
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

if "title=\"Central de Compartilhamento - PCP\"" not in content:
    # Insert before last `</>`
    last_closing = content.rfind("</>")
    if last_closing != -1:
        content = content[:last_closing] + modal_statement + content[last_closing:]

# 4. Add the Share Button in the floating action bar
# In line 4499:
# <Hammer size={13} /> Emitir OS - {selected.length} {selected.length === 1 ? 'Pedido' : 'Pedidos'} ({totalQty}P) {uniqueLots.length > 1 ? `• ${uniqueLots.length} MAPAS` : `• MAPA${uniqueLots[0].orderNumber}`}
# </button>

button_statement = """                                  <Hammer size={13} /> Emitir OS - {selected.length} {selected.length === 1 ? 'Pedido' : 'Pedidos'} ({totalQty}P) {uniqueLots.length > 1 ? `• ${uniqueLots.length} MAPAS` : `• MAPA${uniqueLots[0].orderNumber}`}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShareModal({ isOpen: true, format: 'pdf' })}
                                  className={`w-full py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                                  Compartilhar Ficha
                                </button>"""

target_button = """                                  <Hammer size={13} /> Emitir OS - {selected.length} {selected.length === 1 ? 'Pedido' : 'Pedidos'} ({totalQty}P) {uniqueLots.length > 1 ? `• ${uniqueLots.length} MAPAS` : `• MAPA${uniqueLots[0].orderNumber}`}
                                </button>"""

content = content.replace(target_button, button_statement)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("PCPView modified!")

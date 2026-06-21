import os

filepath = r"c:\Users\SISTEMAS-PC\Desktop\PROJETOS ANTIGRAVIT\APP VENDAS E PRODUCAO\src\views\PCPView.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Let's target the exact block containing computeOSAdvanceOutcome
target_block = """                                  <button type="button" onClick={() => {
                                    const printNextSectorName = selectedLot ? computeOSAdvanceOutcome(os, selectedLot, products, sectors).nextSectorName : 'CONCLUÍDO';
                                    setPrintOSData({ os, nextSectorName: printNextSectorName });
                                    setIsPrintOSModalOpen(true);
                                  }} className="flex-1 text-[11px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 py-2.5 rounded-xl transition-all text-center">Imprimir</button>"""

# Replace all potential CRLF/LF line endings in both content and target_block to ensure matching
content_normalized = content.replace('\r\n', '\n')
target_normalized = target_block.replace('\r\n', '\n')

replacement_block = """                                  <button type="button" onClick={() => {
                                    const osLotIds = os.lotIds || [os.lotId];
                                    const osSourceOrderIds = os.sourceOrderIds || [];
                                    const osSourceItemKeys = os.sourceItemKeys || [];
                                    
                                    const mappedFichas: any[] = [];
                                    osLotIds.forEach(lId => {
                                      const l = lots.find(lot => lot.id === lId);
                                      if (!l) return;
                                      const sourceItems: any[] = (l as any).metadata?.sourceItems || [];
                                      sourceItems.forEach((si, siIdx) => {
                                        const itemKey = `${l.id}::${si.orderId}::${siIdx}`;
                                        const isIncluded = osSourceItemKeys.includes(itemKey) || 
                                          (osSourceItemKeys.length === 0 && osSourceOrderIds.includes(si.orderId));
                                        
                                        if (isIncluded) {
                                          const prod = products.find(p => p.id === si.productId);
                                          const vari = prod?.variations.find((v: any) => v.id === si.variationId);
                                          const ord = productionOrders.find(o => o.id === si.orderId);
                                          const ordItem: any = si.itemIdx !== undefined ? ord?.items[si.itemIdx] : ord?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
                                          
                                          mappedFichas.push({
                                            lot: l,
                                            si,
                                            siIdx,
                                            product: prod,
                                            variation: vari,
                                            orderItem: ordItem,
                                            order: ord,
                                            coveringOS: os
                                          });
                                        }
                                      });
                                    });
                                    setShareModal({ isOpen: true, format: 'pdf', selectedItems: mappedFichas });
                                  }} className="flex-1 text-[11px] font-black uppercase text-orange-600 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 py-2.5 rounded-xl transition-all text-center">Compartilhar</button>
                                  <button type="button" onClick={() => {
                                    const printNextSectorName = selectedLot ? computeOSAdvanceOutcome(os, selectedLot, products, sectors).nextSectorName : 'CONCLUÍDO';
                                    setPrintOSData({ os, nextSectorName: printNextSectorName });
                                    setIsPrintOSModalOpen(true);
                                  }} className="flex-1 text-[11px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 py-2.5 rounded-xl transition-all text-center">Imprimir</button>"""

replacement_normalized = replacement_block.replace('\r\n', '\n')

if target_normalized in content_normalized:
    new_content = content_normalized.replace(target_normalized, replacement_normalized)
    # Write back with original CRLF line endings
    with open(filepath, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(new_content)
    print("SUCCESS: Patched PCPView.tsx successfully.")
else:
    # Try finding with flexible whitespace/newlines
    print("ERROR: Target block not found in content. Let's look for subset.")
    if "computeOSAdvanceOutcome(os, selectedLot, products, sectors)" in content_normalized:
        print("INFO: Found computeOSAdvanceOutcome. Attempting line-based replacement.")
        lines = content_normalized.split('\n')
        found_idx = -1
        for idx, line in enumerate(lines):
            if "computeOSAdvanceOutcome(os, selectedLot, products, sectors)" in line:
                found_idx = idx
                break
        if found_idx != -1:
            # Let's inspect the lines around found_idx
            print(f"Lines around found_idx ({found_idx}):")
            for i in range(max(0, found_idx-5), min(len(lines), found_idx+5)):
                print(f"{i}: {repr(lines[i])}")
    else:
        print("ERROR: computeOSAdvanceOutcome not found at all in content.")

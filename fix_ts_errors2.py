import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: selectedItems: selected -> selectedItems: filteredActiveLots
content = content.replace("selectedItems: selected", "selectedItems: filteredActiveLots")

# Fix 2: completedOSForOrder
content = content.replace("completedOSForOrder(f.si.orderId)", "serviceOrders.find((so: any) => so.sourceOrderIds?.includes(f.si.orderId) && so.status === 'COMPLETED')")

# Fix 3: labelService.print
old_print = """                                                    if (szStr) {
                                                      labelService.print({
                                                        orderNumber: f.lot.orderNumber || '---',
                                                        productReference: itemProduct.reference || '',
                                                        productName: itemProduct.name,
                                                        colorName: itemVariation.colorName,
                                                        sizeGrid: szStr,
                                                        totalPairs: f.si.qty,
                                                        customerName: f.order?.customerName || 'Estoque',
                                                        deliveryDate: f.order?.deliveryDate,
                                                        sectorName: sectors.find(s => s.id === f.lot.route?.[f.lot.currentSectorIndex])?.name || ''
                                                      });
                                                    }"""
new_print = """                                                    if (szStr) {
                                                      setLabelModalBatchItems([{ product: itemProduct, variation: itemVariation, sizeGrid: szStr, lotId: f.lot.id, orderId: f.si.orderId, itemIdx: f.siIdx }]);
                                                    }"""

if old_print in content:
    content = content.replace(old_print, new_print)
else:
    print("WARNING: labelService.print block not found exactly as expected!")

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("TS fixes applied.")

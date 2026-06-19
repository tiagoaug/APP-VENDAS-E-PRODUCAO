import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the `computeProductsFromItems` logic to make sure we extract reference and color.
# We will just replace the entire selectedOrderProducts block safely.
# I will use a regex to capture everything from `const selectedOrderProducts =` to `)) : [];`

pattern = r"const selectedOrderProducts = hasSelectedOrders \? Array\.from\(new Set\(\n\s*pendingOsSourceOrderIds\.flatMap\(oid => \{\n.*?\n\s*\}\)\.filter\(Boolean\)\n\s*\)\) : \[\];"

replacement = """const computeProductsFromItems = (items: any[]) => {
                  return Array.from(new Set(
                    items.map(si => {
                      const order = productionOrders.find(o => o.id === si.orderId);
                      const ordItem = si.itemIdx !== undefined 
                        ? order?.items[si.itemIdx] 
                        : order?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
                      const prod = products.find(p => p.id === (ordItem?.productId || si.productId));
                      const vari = prod?.variations.find((v: any) => v.id === (ordItem?.variationId || si?.variationId));
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
                        const order = productionOrders.find(o => o.id === si.orderId);
                        const ordItem = si.itemIdx !== undefined 
                          ? order?.items[si.itemIdx] 
                          : order?.items.find((i: any) => i.productId === si.productId && i.variationId === si.variationId);
                        const prod = products.find(p => p.id === (ordItem?.productId || si.productId));
                        const vari = prod?.variations.find((v: any) => v.id === (ordItem?.variationId || si?.variationId));
                        return prod ? `${prod.reference || prod.name} ${vari?.colorName ? vari.colorName : ''}`.trim() : null;
                      }
                    }
                    return null;
                  }).filter(Boolean)
                )) : computeProductsFromItems((firstLot as any).metadata?.sourceItems || []);"""

content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated selectedOrderProducts block successfully.")

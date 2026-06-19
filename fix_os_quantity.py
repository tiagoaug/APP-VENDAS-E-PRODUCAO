import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Change handleOpenOSModalForOrder call in Setores (line 4495)
# Before:
# const uniqueOrderIds = Array.from(new Set(selected.map(f => f.si.orderId)));
# handleOpenOSModalForOrder(uniqueLots, uniqueOrderIds, undefined, sectorOvr, qtyOvr);
# After:
# const uniqueItemKeys = Array.from(new Set(selected.map(f => `${f.si.orderId}::${f.siIdx}`)));
# handleOpenOSModalForOrder(uniqueLots, uniqueItemKeys, undefined, sectorOvr, qtyOvr);

content = content.replace(
    "const uniqueOrderIds = Array.from(new Set(selected.map(f => f.si.orderId)));",
    "const uniqueItemKeys = Array.from(new Set(selected.map(f => `${f.si.orderId}::${f.siIdx}`)));"
)
content = content.replace(
    "handleOpenOSModalForOrder(uniqueLots, uniqueOrderIds, undefined, sectorOvr, qtyOvr);",
    "handleOpenOSModalForOrder(uniqueLots, uniqueItemKeys, undefined, sectorOvr, qtyOvr);"
)

# 2. Change Setores Emitir OS botão para Mapas tab (line 7909)
# Before:
# setPendingOsSourceOrderIds(selectedItemsList.map((si: any) => si.orderId));
# After:
# setPendingOsSourceOrderIds(selectedItemsList.map((si: any, idx: number) => `${si.orderId}::${si.itemIdx !== undefined ? si.itemIdx : idx}`));

content = content.replace(
    "setPendingOsSourceOrderIds(selectedItemsList.map((si: any) => si.orderId));",
    "setPendingOsSourceOrderIds(selectedItemsList.map((si: any, idx: number) => `${si.orderId}::${si.itemIdx !== undefined ? si.itemIdx : idx}`));"
)

# 3. Update all places that check pendingOsSourceOrderIds.includes(si.orderId)
# Instead of a regex for all, I'll update the specific lines in the OS Modal header:

# Line 8830: const si = ((l as any).metadata?.sourceItems || []).find((s: any) => s.orderId === oid);
# Wait, `oid` is now `${orderId}::${itemIdx}`! So we need to split it or check accordingly.
# Let's change `oid` usage:

header_find_replacement = """                  pendingOsSourceOrderIds.flatMap(oid => {
                    const [realOrderId, itemIdxStr] = oid.split('::');
                    for (const l of targetLots) {
                      const sourceItems = (l as any).metadata?.sourceItems || [];
                      const si = sourceItems.find((s: any, idx: number) => 
                        s.orderId === oid || 
                        s.orderId === realOrderId && (itemIdxStr ? String(s.itemIdx !== undefined ? s.itemIdx : idx) === itemIdxStr : true)
                      );"""
content = re.sub(
    r"                  pendingOsSourceOrderIds\.flatMap\(oid => \{\n                    for \(const l of targetLots\) \{\n                      const si = \(\(l as any\)\.metadata\?\.sourceItems \|\| \[\]\)\.find\(\(s: any\) => s\.orderId === oid\);",
    header_find_replacement,
    content
)

# Line 8848: .filter((si: any) => pendingOsSourceOrderIds.includes(si.orderId))
# Update to:
# .filter((si: any, idx: number) => pendingOsSourceOrderIds.includes(si.orderId) || pendingOsSourceOrderIds.includes(`${si.orderId}::${si.itemIdx !== undefined ? si.itemIdx : idx}`))
content = content.replace(
    ".filter((si: any) => pendingOsSourceOrderIds.includes(si.orderId))",
    ".filter((si: any, idx: number) => pendingOsSourceOrderIds.includes(si.orderId) || pendingOsSourceOrderIds.includes(`${si.orderId}::${si.itemIdx !== undefined ? si.itemIdx : idx}`))"
)

# Line 9007: .filter((si: any) => pendingOsSourceOrderIds.includes(si.orderId))
content = content.replace(
    ".filter((si: any) => pendingOsSourceOrderIds.includes(si.orderId))\n                          .reduce",
    ".filter((si: any, idx: number) => pendingOsSourceOrderIds.includes(si.orderId) || pendingOsSourceOrderIds.includes(`${si.orderId}::${si.itemIdx !== undefined ? si.itemIdx : idx}`))\n                          .reduce"
)

# 4. Update the DB save and checks in getOrderOS etc.
# Wait, if we save `pendingOsSourceOrderIds` to DB, it will store the `::` keys.
# Then `os.sourceOrderIds` will contain `["06565::0"]`.
# We need to ensure `getOrderOS` and `completedOSForOrder` can match this!

# In `getOrderOS` (line 7217):
# so.sourceOrderIds.includes(orderId)
# We must change it to check if ANY of the sourceOrderIds starts with `orderId::` OR equals `orderId`.
content = content.replace(
    "so.sourceOrderIds.includes(orderId)",
    "so.sourceOrderIds.some(id => id === orderId || id.startsWith(`${orderId}::`))"
)

# Wait, `completedOSForOrder` inside Setores (line 4160):
# const completedOSForOrder = (oid: string) => serviceOrders.find(so => so.sourceOrderIds && so.sourceOrderIds.includes(oid) && so.status === 'COMPLETED' && so.lotIds?.includes(f.lot.id));
# Change `so.sourceOrderIds.includes(oid)` to `.some(id => id === oid || id.startsWith(`${oid}::`))`
content = content.replace(
    "so.sourceOrderIds.includes(oid)",
    "so.sourceOrderIds.some(id => id === oid || id.startsWith(`${oid}::`))"
)

# Wait, `completedOSForOrder` inside Mapas (line 7240):
# so.sourceOrderIds.includes(orderId) -> I already replaced this above! Because I used a generic replace. Let's check how many times I replaced it.
# Wait, I already did: content = content.replace("so.sourceOrderIds.includes(orderId)", "so.sourceOrderIds.some(id => id === orderId || id.startsWith(`${orderId}::`))")

# Also, there's a check in line 4047:
# os.sourceOrderIds && os.sourceOrderIds.includes(si.orderId)
content = content.replace(
    "os.sourceOrderIds.includes(si.orderId)",
    "os.sourceOrderIds.some(id => id === si.orderId || id.startsWith(`${si.orderId}::`))"
)

# Let's write back
with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated sourceOrderIds logic to handle itemIdx!")

import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: missing orderOS and isExpanded, and completedOSForOrder
pattern_local_vars = r"                            const completedOS = completedOSForOrder\(si\.orderId\);\n                            const hasCompletedOS = \!\!completedOS;"

new_vars = """                            const orderOS = f.coveringOS;
                            const isExpanded = fichaItemExpanded.has(itemKey);
                            const completedOSForOrder = (oid: string) => serviceOrders.find(so => so.sourceOrderIds && so.sourceOrderIds.includes(oid) && so.status === 'COMPLETED' && so.lotIds?.includes(f.lot.id));
                            const completedOS = completedOSForOrder(si.orderId);
                            const hasCompletedOS = !!completedOS;"""

content = re.sub(pattern_local_vars, new_vars, content)

# Fix 2: key -> itemKey
# Let's just find any `key` that wasn't replaced correctly inside `allFichas` block.
# Specifically on line 4454... let's just replace `key` with `itemKey` where appropriate.
# I will do a regex to replace ` === key ` or ` !== key ` or `(key)` or `? key :` inside allFichas map block.

start_pattern_allfichas = r"                \{filteredFichas\.map\(\(f, fIdx\) => \{"
end_pattern_allfichas = r"                \}\)\}\n              </div>\n            \)\}\n          </div>\n        \)\}\n\n        \{/\* FOOTER"

match = re.search(start_pattern_allfichas + r"(.*?)" + end_pattern_allfichas, content, re.DOTALL)
if match:
    block = match.group(0)
    # Replace any leftover key usages
    block = re.sub(r"\bkey\b(?! *:)", "itemKey", block)
    content = content.replace(match.group(0), block)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed TS errors in PCPView.tsx")

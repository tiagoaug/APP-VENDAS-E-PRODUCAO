import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Extract the Mapas block
# Lines roughly from:
# const sizeEntries = orderItem
# ... to
# );
# })}
# </div>

start_pattern_mapas = r"                        const sizeEntries = orderItem\n                          \? Object\.entries\(orderItem\.sizes"
end_pattern_mapas = r"                                \)\}\n                              </div>\n                            \)\}\n                          </div>\n                        \);\n                      \}\)\}\n                    </div>"

match_mapas = re.search(start_pattern_mapas + r"(.*?)" + end_pattern_mapas, content, re.DOTALL)
if not match_mapas:
    print("Could not extract Mapas block")
    exit()

mapas_block = match_mapas.group(0)

# Clean up the trailing `})}` and `</div>` because we only need the `return ( ... );`
# We'll just split at the last `);`
mapas_return = "                        const sizeEntries =" + mapas_block.split("                        const sizeEntries =")[1]
mapas_return = mapas_return[:mapas_return.rfind(");") + 2]

# 2. Extract the Setores block to replace
start_pattern_setores = r"                            const szEntries = \(f\.orderItem\?\.sizes\)\n                              \? Object\.entries\(f\.orderItem\.sizes as Record<string, any>\)\n                                  \.filter\(\(\[, s\]\) => \(s\?\.toProduction \|\| 0\) > 0\)\n                                  \.sort\(\(\[a\], \[b\]\) => parseFloat\(a\) - parseFloat\(b\)\)\n                              : \[\];\n                            return \(\n                              <div key=\{itemKey\} className=\{`rounded-2xl border"
end_pattern_setores = r"                                  </button>\n                                </div>\n                              </div>\n                            \);"

match_setores = re.search(start_pattern_setores + r"(.*?)" + end_pattern_setores, content, re.DOTALL)
if not match_setores:
    print("Could not extract Setores block")
    exit()

# 3. Adapt Mapas block to Setores variables
adapted_block = mapas_return
# Replacements for variables:
adapted_block = adapted_block.replace("key={idx}", "key={itemKey}")
adapted_block = adapted_block.replace("id={`pedido-card-${key}`}", "id={`pedido-card-${itemKey}`}")
adapted_block = adapted_block.replace("selectedSourceItemKeys", "fichaSelection")
adapted_block = adapted_block.replace("setSelectedSourceItemKeys", "setFichaSelection")
adapted_block = adapted_block.replace("expandedSourceItems", "fichaItemExpanded")
adapted_block = adapted_block.replace("setExpandedSourceItems", "setFichaItemExpanded")
adapted_block = adapted_block.replace("key)", "itemKey)")
adapted_block = adapted_block.replace("key ?", "itemKey ?")
adapted_block = adapted_block.replace("key :", "itemKey :")
adapted_block = adapted_block.replace("=== key", "=== itemKey")
adapted_block = adapted_block.replace("!== key", "!== itemKey")
adapted_block = adapted_block.replace("setSharePedidoPopupKey(key)", "setSharePedidoPopupKey(itemKey)")

# Wait, `key` as a variable in Mapas was: `const key = \`${si.orderId}-${idx}\`;`
# But in Setores we have `itemKey`. So `itemKey` replaces `key`. But we also have `key={sz}` and `key={note.id}` which are fine because we used boundaries.
adapted_block = re.sub(r"\bkey\b(?! *:)", "itemKey", adapted_block) # replace variable name `key` with `itemKey`, avoiding `key={...}`
# wait, negative lookahead for ` :` or `={`. `\bkey\b` will match `key={idx}` too.
# Let's do it safer:
adapted_block = mapas_return
adapted_block = adapted_block.replace("key={idx}", "key={itemKey}")
adapted_block = adapted_block.replace("id={`pedido-card-${key}`}", "id={`pedido-card-${itemKey}`}")
adapted_block = adapted_block.replace("selectedSourceItemKeys.has(key)", "fichaSelection.has(itemKey)")
adapted_block = adapted_block.replace("next.delete(key)", "next.delete(itemKey)")
adapted_block = adapted_block.replace("next.add(key)", "next.add(itemKey)")
adapted_block = adapted_block.replace("setSelectedSourceItemKeys", "setFichaSelection")
adapted_block = adapted_block.replace("expandedSourceItems.has(key)", "fichaItemExpanded.has(itemKey)")
adapted_block = adapted_block.replace("setExpandedSourceItems", "setFichaItemExpanded")
adapted_block = adapted_block.replace("sharePedidoPopupKey === key", "sharePedidoPopupKey === itemKey")
adapted_block = adapted_block.replace("sharePedidoPopupKey === key ? null : key", "sharePedidoPopupKey === itemKey ? null : itemKey")

# Map variables:
# In Setores, the variables are properties of `f`:
#   f.lot
#   f.si
#   f.product
#   f.variation
#   f.order
#   f.orderItem
#   f.coveringOS

# We can just define the local variables before `const sizeEntries = ...`
local_vars = """                            const selectedLot = f.lot;
                            const si = f.si;
                            const product = f.product;
                            const variation = f.variation;
                            const order = f.order;
                            const orderItem = f.orderItem;
                            const productName = product?.name || orderItem?.productName || '-';
                            const productRef = product?.reference || '';
                            const colorName = variation?.colorName || orderItem?.variationName || '';
                            const completedOS = completedOSForOrder(si.orderId);
                            const hasCompletedOS = !!completedOS;
"""

adapted_block = local_vars + adapted_block

# 4. Do the final replace
full_pattern_to_replace = start_pattern_setores + r"(.*?)" + end_pattern_setores
new_content = re.sub(full_pattern_to_replace, adapted_block.replace('\\', '\\\\'), content, flags=re.DOTALL)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Replaced Setores visual with Mapas visual successfully!")

import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Revert the global replacement
content = content.replace("setSelectedLot(list[0]);", "setSelectedLot(null);")

# Only replace inside handleOpenOSModal
# We find handleOpenOSModal
pattern = r"(const handleOpenOSModal = .*?\n.*?setSelectedLots\(list\);\n\n    if \(\!Array\.isArray\(lotsToProcess\)\) \{\n      setSelectedLot\(lotsToProcess\);\n    \} else \{\n      )setSelectedLot\(null\);"
content = re.sub(pattern, r"\g<1>setSelectedLot(list[0]);", content, flags=re.DOTALL)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed replacements")

import re

with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("setGroupItems", "setGroupMode")
content = content.replace("groupItems", "groupMode")

with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

with open('src/views/PurchasesView.tsx', 'r', encoding='utf-8') as f:
    purchases = f.read()

purchases = purchases.replace(
    "onConfirm={async (note, format, showVals, grouped) => {",
    "onConfirm={async (note, format, showVals, groupMode) => {"
)
purchases = purchases.replace(
    "grouped: grouped",
    "grouped: groupMode !== 'none'"
)

with open('src/views/PurchasesView.tsx', 'w', encoding='utf-8') as f:
    f.write(purchases)

print("Fixed grouping errors!")

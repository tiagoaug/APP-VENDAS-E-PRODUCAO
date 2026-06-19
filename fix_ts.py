import re

# 1. Fix ExportNoteModal.tsx
with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("onConfirm(note, selectedFormat, showFinancialValues, groupItems)", "onConfirm(note, selectedFormat, showFinancialValues, groupItems, pcpTotalGrid)")

with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# 2. Fix PCPView.tsx lotNumbers missing
with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add lotNumbers calculation right before finalItems
fix_logic = """
          const lotNumbers = uniqueLots.map((l: any) => l.orderNumber).filter(Boolean).join(', ');

          let finalItems = items;
"""
content = content.replace("          let finalItems = items;", fix_logic)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed both files!")

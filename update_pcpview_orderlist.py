import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Modify ExportNoteModal
content = content.replace("showSectorNotesToggle={true}", "showSectorNotesToggle={true}\n        showOrderListToggle={true}")

# Change onConfirm signature
content = content.replace("onConfirm={async (note, format, showVals, grouped, showTotalGrid, showMaterials, showItemGrid, showSectorNotes) => {", "onConfirm={async (note, format, showVals, grouped, showTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList) => {")

# Add showOrderList to generatePCPShareExport
content = content.replace(
    "            showItemGrid,\n            showSectorNotes\n          }, format);",
    "            showItemGrid,\n            showSectorNotes,\n            showOrderList\n          }, format);"
)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("PCPView updated with order list logic!")

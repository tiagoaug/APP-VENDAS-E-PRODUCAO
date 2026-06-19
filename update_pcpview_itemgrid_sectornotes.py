import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Modify ExportNoteModal
content = content.replace("showMaterialsToggle={true}", "showMaterialsToggle={true}\n        showItemGridToggle={true}\n        showSectorNotesToggle={true}")

# Change onConfirm signature
content = content.replace("onConfirm={async (note, format, showVals, grouped, showTotalGrid, showMaterials) => {", "onConfirm={async (note, format, showVals, grouped, showTotalGrid, showMaterials, showItemGrid, showSectorNotes) => {")

# Add showItemGrid and showSectorNotes to generatePCPShareExport
content = content.replace(
    "            isDarkMode,\n            showTotalGrid,\n            showMaterials\n          }, format);",
    "            isDarkMode,\n            showTotalGrid,\n            showMaterials,\n            showItemGrid,\n            showSectorNotes\n          }, format);"
)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("PCPView updated with item grid and sector notes logic!")

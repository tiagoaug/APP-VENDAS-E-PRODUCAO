import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Modify ExportNoteModal
content = content.replace("showPCPTotalGridToggle={true}", "showPCPTotalGridToggle={true}\n        showMaterialsToggle={true}")

# Change onConfirm signature
content = content.replace("onConfirm={async (note, format, showVals, grouped, showTotalGrid) => {", "onConfirm={async (note, format, showVals, grouped, showTotalGrid, showMaterials) => {")

# Add showMaterials to generatePCPShareExport
content = content.replace(
    "            isDarkMode,\n            showTotalGrid\n          }, format);",
    "            isDarkMode,\n            showTotalGrid,\n            showMaterials\n          }, format);"
)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("PCPView updated with materials logic!")

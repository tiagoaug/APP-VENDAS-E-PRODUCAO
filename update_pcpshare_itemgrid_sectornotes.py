import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update PCPShareData
content = content.replace(
    "  showMaterials?: boolean;", 
    "  showMaterials?: boolean;\n  showItemGrid?: boolean;\n  showSectorNotes?: boolean;"
)

# 2. Update generatePDF signature
content = content.replace(
    "const { lotNumber, items, additionalNote, showTotalGrid, showMaterials } = data;", 
    "const { lotNumber, items, additionalNote, showTotalGrid, showMaterials, showItemGrid, showSectorNotes } = data;"
)

# 3. Update generateJPG signature
content = content.replace(
    "const { lotNumber, items, additionalNote, showTotalGrid, showMaterials } = data;", 
    "const { lotNumber, items, additionalNote, showTotalGrid, showMaterials, showItemGrid, showSectorNotes } = data;"
)

# 4. Update generateJPG height measurement
content = content.replace(
    "    if (item.sizeGrid && item.sizeGrid.length > 0) {\n      currentY += 80; // Grade base size\n    }",
    "    if (showItemGrid !== false && item.sizeGrid && item.sizeGrid.length > 0) {\n      currentY += 80; // Grade base size\n    }"
)

content = content.replace(
    "    if (item.sectorNotes && item.sectorNotes.length > 0) {\n      currentY += 30;",
    "    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {\n      currentY += 30;"
)

# 5. Update generatePDF grid logic
content = content.replace(
    "    // Grade\n    if (item.sizeGrid && item.sizeGrid.length > 0) {",
    "    // Grade\n    if (showItemGrid !== false && item.sizeGrid && item.sizeGrid.length > 0) {"
)

# 6. Update generatePDF sector notes logic
content = content.replace(
    "    // Sector Notes\n    if (item.sectorNotes && item.sectorNotes.length > 0) {",
    "    // Sector Notes\n    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {"
)

# 7. Update generateJPG grid logic
content = content.replace(
    "    // Grade\n    if (item.sizeGrid && item.sizeGrid.length > 0) {",
    "    // Grade\n    if (showItemGrid !== false && item.sizeGrid && item.sizeGrid.length > 0) {"
)

# 8. Update generateJPG sector notes logic
content = content.replace(
    "    // Sector Notes\n    if (item.sectorNotes && item.sectorNotes.length > 0) {",
    "    // Sector Notes\n    if (showSectorNotes !== false && item.sectorNotes && item.sectorNotes.length > 0) {"
)

with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("pcpShareExport updated with showItemGrid and showSectorNotes!")

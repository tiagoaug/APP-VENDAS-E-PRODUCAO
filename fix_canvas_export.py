import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("await shareImage(canvas, filename);", "await shareImage(canvas.toDataURL('image/jpeg', 0.9), filename);")

with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
    f.write(content)

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("productionLots.find", "filteredActiveLots.find")

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed canvas toDataUrl and productionLots to filteredActiveLots")

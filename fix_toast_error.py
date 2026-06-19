import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("toast.show('Erro ao gerar exportação', 'error');", "toast.error('Erro ao gerar exportação');")

with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed toast error in pcpShareExport.ts")

import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "async function generatePDF(data: PCPShareData, filename: string, previewOnly: boolean = false) {",
    "async function generatePDF(data: PCPShareData, filename: string, previewOnly: boolean = false): Promise<boolean | string> {"
)

content = content.replace(
    "async function generateJPG(data: PCPShareData, filename: string, previewOnly: boolean = false) {",
    "async function generateJPG(data: PCPShareData, filename: string, previewOnly: boolean = false): Promise<boolean | string> {"
)

with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed return types!")

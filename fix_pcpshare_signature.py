import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix generatePCPShareExport signature
content = content.replace(
    "export async function generatePCPShareExport(data: PCPShareData, formatType: 'pdf' | 'jpg') {",
    "export async function generatePCPShareExport(data: PCPShareData, formatType: 'pdf' | 'jpg', previewOnly: boolean = false): Promise<boolean | string> {"
)

# Fix generatePCPShareExport body
content = content.replace(
    "    if (formatType === 'pdf') {\n      await generatePDF(data, filename);\n    } else {\n      await generateJPG(data, filename);\n    }\n    return true;",
    "    if (formatType === 'pdf') {\n      return await generatePDF(data, filename, previewOnly);\n    } else {\n      return await generateJPG(data, filename, previewOnly);\n    }"
)

with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed generatePCPShareExport signature!")

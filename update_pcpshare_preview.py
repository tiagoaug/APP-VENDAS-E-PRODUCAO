import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update export signatures
content = content.replace(
    "export async function generatePCPShareExport(data: PCPShareData, format: 'pdf' | 'jpg') {",
    "export async function generatePCPShareExport(data: PCPShareData, format: 'pdf' | 'jpg', previewOnly: boolean = false): Promise<boolean | string> {"
)

content = content.replace(
    "    if (format === 'pdf') {\n      await generatePDF(data, filename);\n    } else {\n      await generateJPG(data, filename);\n    }\n    return true;",
    "    if (format === 'pdf') {\n      return await generatePDF(data, filename, previewOnly);\n    } else {\n      return await generateJPG(data, filename, previewOnly);\n    }"
)

# 2. Update generatePDF
content = content.replace(
    "async function generatePDF(data: PCPShareData, filename: string) {",
    "async function generatePDF(data: PCPShareData, filename: string, previewOnly: boolean = false) {"
)

pdf_end = """    if (Capacitor.isNativePlatform()) {
      await sharePDF(doc, filename);
    } else {
      doc.save(`${filename}.pdf`);
    }
    return true;"""

pdf_end_new = """    if (previewOnly) {
      return doc.output('datauristring');
    }
    if (Capacitor.isNativePlatform()) {
      await sharePDF(doc, filename);
    } else {
      doc.save(`${filename}.pdf`);
    }
    return true;"""

content = content.replace(pdf_end, pdf_end_new)

# 3. Update generateJPG
content = content.replace(
    "async function generateJPG(data: PCPShareData, filename: string) {",
    "async function generateJPG(data: PCPShareData, filename: string, previewOnly: boolean = false) {"
)

jpg_end = "  await shareImage(canvas.toDataURL('image/jpeg', 0.9), filename);"
jpg_end_new = """  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  if (previewOnly) return dataUrl;
  await shareImage(dataUrl, filename);
  return true;"""

content = content.replace(jpg_end, jpg_end_new)

with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("pcpShareExport updated to support previewOnly!")

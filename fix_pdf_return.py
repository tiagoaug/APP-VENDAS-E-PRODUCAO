import re

with open('src/utils/pcpShareExport.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix generatePDF return
old_pdf_return = "  await sharePDF(doc, filename);\n}"
new_pdf_return = """  if (previewOnly) {
    return doc.output('datauristring');
  }
  await sharePDF(doc, filename);
  return true;
}"""
content = content.replace(old_pdf_return, new_pdf_return)

with open('src/utils/pcpShareExport.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed generatePDF return!")

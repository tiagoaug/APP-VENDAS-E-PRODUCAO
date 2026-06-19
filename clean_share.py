import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove ExportNoteModal import
content = re.sub(r"import ExportNoteModal from '\.\./components/ExportNoteModal';\n", "", content)
content = re.sub(r"import \{ generatePCPShareExport, PCPShareItem \} from '\.\./utils/pcpShareExport';\n", "", content)

# 2. Remove shareModal state
content = re.sub(r"  const \[shareModal, setShareModal\] = useState<\{ isOpen: boolean; format: 'pdf' \| 'jpg'; selectedItems: any\[\] \}>\(\{ isOpen: false, format: 'pdf', selectedItems: \[\] \}\);\n", "", content)

# 3. Replace the multiple selection share button
content = content.replace(
    "setShareModal({ isOpen: true, format: 'pdf', selectedItems: selected })",
    "setIsPCPShareModalOpen(true)"
)

# 4. Remove the ExportNoteModal at the end of the file
# We'll use regex to remove from <ExportNoteModal up to the end of the modal.
export_modal_pattern = r"\s*<ExportNoteModal[\s\S]*?</ExportNoteModal>"
content = re.sub(export_modal_pattern, "", content)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Cleanup successful")

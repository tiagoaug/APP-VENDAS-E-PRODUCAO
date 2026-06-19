import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's insert the state definition right after `const [isPCPShareModalOpen, setIsPCPShareModalOpen] = useState(false);`
state_pattern = r"const \[isPCPShareModalOpen, setIsPCPShareModalOpen\] = useState\(false\);"
new_state = "const [isPCPShareModalOpen, setIsPCPShareModalOpen] = useState(false);\n  const [shareModal, setShareModal] = useState<{ isOpen: boolean; format: 'pdf' | 'jpg'; selectedItems: any[] }>({ isOpen: false, format: 'pdf', selectedItems: [] });"

if "const [shareModal, setShareModal]" not in content:
    content = re.sub(state_pattern, new_state, content)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected state!")

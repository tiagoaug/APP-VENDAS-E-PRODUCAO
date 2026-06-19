import re

with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Modify ExportNoteModalProps
content = content.replace(
    "showMaterialsToggle?: boolean;\n}",
    "showMaterialsToggle?: boolean;\n  showItemGridToggle?: boolean;\n}"
)

# Modify the signature of onConfirm
content = content.replace(
    "onConfirm: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupItems: boolean, pcpTotalGrid: boolean, showMaterials: boolean) => void;",
    "onConfirm: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupItems: boolean, pcpTotalGrid: boolean, showMaterials: boolean, showItemGrid: boolean) => void;"
)

# Modify arguments
content = content.replace(
    "  showMaterialsToggle = false\n}: ExportNoteModalProps",
    "  showMaterialsToggle = false,\n  showItemGridToggle = false\n}: ExportNoteModalProps"
)

# Add state
content = content.replace(
    "  const [showMaterials, setShowMaterials] = useState(true);",
    "  const [showMaterials, setShowMaterials] = useState(true);\n  const [showItemGrid, setShowItemGrid] = useState(true);"
)

# Add reset state
content = content.replace(
    "setShowMaterials(true);",
    "setShowMaterials(true);\n      setShowItemGrid(true);"
)

# Pass it to onConfirm
content = content.replace(
    "onConfirm(note, selectedFormat, showFinancialValues, groupItems, pcpTotalGrid, showMaterials)",
    "onConfirm(note, selectedFormat, showFinancialValues, groupItems, pcpTotalGrid, showMaterials, showItemGrid)"
)

# Add the UI for Item Grid toggle right below Materials toggle.
toggle_ui = """
          {/* Item Grid Toggle */}
          {showItemGridToggle && (
            <div>
              <button
                type="button"
                onClick={() => setShowItemGrid(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.99] mt-2 ${
                  isDarkMode
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    showItemGrid
                      ? 'bg-indigo-500 text-white'
                      : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {showItemGrid ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line></svg>}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Exibir grade do pedido</div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Mostra a grade detalhada individual de cada pedido listado
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}
"""

pattern = r"(\{\/\*\s*Materials Toggle\s*\*\/\}.*?\n\s*\})"

match = re.search(pattern, content, re.DOTALL)
if match:
    end_idx = match.end()
    content = content[:end_idx] + "\n" + toggle_ui + content[end_idx:]
    with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Injected item grid toggle successfully!")
else:
    print("Materials Toggle not found!")

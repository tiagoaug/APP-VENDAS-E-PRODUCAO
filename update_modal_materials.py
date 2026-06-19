import re

# 1. Update ExportNoteModal.tsx
with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Modify ExportNoteModalProps
content = content.replace(
    "showPCPTotalGridToggle?: boolean;\n}",
    "showPCPTotalGridToggle?: boolean;\n  showMaterialsToggle?: boolean;\n}"
)

# Modify the signature of onConfirm
content = content.replace(
    "onConfirm: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupItems: boolean, pcpTotalGrid: boolean) => void;",
    "onConfirm: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupItems: boolean, pcpTotalGrid: boolean, showMaterials: boolean) => void;"
)

# Modify arguments
content = content.replace(
    "  showPCPTotalGridToggle = false\n}: ExportNoteModalProps",
    "  showPCPTotalGridToggle = false,\n  showMaterialsToggle = false\n}: ExportNoteModalProps"
)

# Add state
content = content.replace(
    "  const [pcpTotalGrid, setPcpTotalGrid] = useState(true);",
    "  const [pcpTotalGrid, setPcpTotalGrid] = useState(true);\n  const [showMaterials, setShowMaterials] = useState(true);"
)

# Add reset state
content = content.replace(
    "setPcpTotalGrid(true);",
    "setPcpTotalGrid(true);\n      setShowMaterials(true);"
)

# Pass it to onConfirm
content = content.replace(
    "onConfirm(note, selectedFormat, showFinancialValues, groupItems, pcpTotalGrid)",
    "onConfirm(note, selectedFormat, showFinancialValues, groupItems, pcpTotalGrid, showMaterials)"
)

# Add the UI for Materials toggle right below PCP Total Grid toggle. Wait, the user drew it below the grouping toggle!
toggle_ui = """
          {/* Materials Toggle */}
          {showMaterialsToggle && (
            <div>
              <button
                type="button"
                onClick={() => setShowMaterials(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.99] mt-2 ${
                  isDarkMode
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    showMaterials
                      ? 'bg-emerald-500 text-white'
                      : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {showMaterials ? <Check size={16} strokeWidth={3} /> : <EyeOff size={16} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Exibir materiais</div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Mostra a tabela de requisição consolidada de materiais
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}
"""

content = content.replace(
    "          {/* Grouping Toggle */}",
    toggle_ui + "\n          {/* Grouping Toggle */}"
)

with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("ExportNoteModal updated!")

import re

with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update ExportNoteModalProps
content = content.replace(
    "onConfirm: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupItems: boolean) => void;",
    "onConfirm: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupItems: boolean, pcpTotalGrid: boolean) => void;"
)

content = content.replace(
    "  showGroupingToggle?: boolean;",
    "  showGroupingToggle?: boolean;\n  showPCPTotalGridToggle?: boolean;"
)

# 2. Update Component Args
content = content.replace(
    "  showGroupingToggle = false\n}: ExportNoteModalProps",
    "  showGroupingToggle = false,\n  showPCPTotalGridToggle = false\n}: ExportNoteModalProps"
)

# 3. Add state
content = content.replace(
    "  const [groupItems, setGroupItems] = useState(false);",
    "  const [groupItems, setGroupItems] = useState(false);\n  const [pcpTotalGrid, setPcpTotalGrid] = useState(true);"
)

content = content.replace(
    "setGroupItems(false);",
    "setGroupItems(false);\n      setPcpTotalGrid(true);"
)

# 4. Update onConfirm call
content = content.replace(
    "onConfirm(note, selectedFormat, showFinancialValues, groupItems);",
    "onConfirm(note, selectedFormat, showFinancialValues, groupItems, pcpTotalGrid);"
)

# 5. Render new toggle
toggle_tsx = """

          {/* PCP Total Grid Toggle */}
          {showPCPTotalGridToggle && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Layers size={12} className="text-amber-500" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">Resumo da Grade</span>
              </div>
              <button
                type="button"
                onClick={() => setPcpTotalGrid(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.99] ${
                  isDarkMode
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    pcpTotalGrid
                      ? 'bg-amber-500 text-white'
                      : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {pcpTotalGrid ? <Check size={16} strokeWidth={3} /> : <EyeOff size={16} strokeWidth={2.5} />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Exibir grade total consolidada</div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Mostra uma tabela extra somando todos os pedidos do documento
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}
"""

content = content.replace(
    "          {/* Grouping Toggle */}",
    toggle_tsx + "\n          {/* Grouping Toggle */}"
)

# 6. Change grouping toggle text to be more PCP friendly if showPCPTotalGridToggle is true
# Actually we can just keep the text generic or we can do a ternary.
# We will just leave it.

with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("ExportNoteModal updated!")

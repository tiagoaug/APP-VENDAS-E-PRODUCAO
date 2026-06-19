import re

with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Props
props_old = """  showSectorNotesToggle?: boolean;
}"""
props_new = """  showSectorNotesToggle?: boolean;
  showOrderListToggle?: boolean;
}"""
content = content.replace(props_old, props_new)

# 2. Update onConfirm Signature
sig_old = "onConfirm: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupItems: boolean, pcpTotalGrid: boolean, showMaterials: boolean, showItemGrid: boolean, showSectorNotes: boolean) => void;"
sig_new = "onConfirm: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupItems: boolean, pcpTotalGrid: boolean, showMaterials: boolean, showItemGrid: boolean, showSectorNotes: boolean, showOrderList: boolean) => void;"
content = content.replace(sig_old, sig_new)

# 3. Update Component arguments
args_old = """  showSectorNotesToggle = false
}: ExportNoteModalProps)"""
args_new = """  showSectorNotesToggle = false,
  showOrderListToggle = false
}: ExportNoteModalProps)"""
content = content.replace(args_old, args_new)

# 4. Update State
state_old = """  const [showSectorNotes, setShowSectorNotes] = useState(true);"""
state_new = """  const [showSectorNotes, setShowSectorNotes] = useState(true);
  const [showOrderList, setShowOrderList] = useState(true);"""
content = content.replace(state_old, state_new)

# 5. Update State Reset
reset_old = """setShowSectorNotes(true);"""
reset_new = """setShowSectorNotes(true);
      setShowOrderList(true);"""
content = content.replace(reset_old, reset_new)

# 6. Update onConfirm call
call_old = "onConfirm(note, selectedFormat, showFinancialValues, groupItems, pcpTotalGrid, showMaterials, showItemGrid, showSectorNotes)"
call_new = "onConfirm(note, selectedFormat, showFinancialValues, groupItems, pcpTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList)"
content = content.replace(call_old, call_new)

# 7. Inject Toggle UI
toggles_ui = """
          {/* Order List Toggle */}
          {showOrderListToggle && (
            <div>
              <button
                type="button"
                onClick={() => setShowOrderList(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.99] mt-2 ${
                  isDarkMode
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    showOrderList
                      ? 'bg-cyan-500 text-white'
                      : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {showOrderList ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line></svg>}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Exibir lista de pedidos</div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Mostra uma relação destacada de todos os pedidos no documento
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}
"""

target = "          {/* Sector Notes Toggle */}"
idx = content.find(target)
if idx != -1:
    content = content[:idx] + toggles_ui + "\n" + content[idx:]
    with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Injected Order List toggle successfully!")
else:
    print("Target not found!")

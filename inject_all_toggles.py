import re

with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Props
props_old = """  showGroupingToggle?: boolean;
}"""
props_new = """  showGroupingToggle?: boolean;
  showPCPTotalGridToggle?: boolean;
  showMaterialsToggle?: boolean;
  showItemGridToggle?: boolean;
  showSectorNotesToggle?: boolean;
}"""
content = content.replace(props_old, props_new)

# 2. Update onConfirm Signature
sig_old = "onConfirm: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupItems: boolean) => void;"
sig_new = "onConfirm: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupItems: boolean, pcpTotalGrid: boolean, showMaterials: boolean, showItemGrid: boolean, showSectorNotes: boolean) => void;"
content = content.replace(sig_old, sig_new)

# 3. Update Component arguments
args_old = "  showGroupingToggle = false\n}: ExportNoteModalProps)"
args_new = """  showGroupingToggle = false,
  showPCPTotalGridToggle = false,
  showMaterialsToggle = false,
  showItemGridToggle = false,
  showSectorNotesToggle = false
}: ExportNoteModalProps)"""
content = content.replace(args_old, args_new)

# 4. Update State
state_old = "  const [groupItems, setGroupItems] = useState(false);"
state_new = """  const [groupItems, setGroupItems] = useState(false);
  const [pcpTotalGrid, setPcpTotalGrid] = useState(true);
  const [showMaterials, setShowMaterials] = useState(true);
  const [showItemGrid, setShowItemGrid] = useState(true);
  const [showSectorNotes, setShowSectorNotes] = useState(true);"""
content = content.replace(state_old, state_new)

# 5. Update State Reset
reset_old = "setGroupItems(false);"
reset_new = """setGroupItems(false);
      setPcpTotalGrid(true);
      setShowMaterials(true);
      setShowItemGrid(true);
      setShowSectorNotes(true);"""
content = content.replace(reset_old, reset_new)

# 6. Update onConfirm call
call_old = "onConfirm(note, selectedFormat, showFinancialValues, groupItems)"
call_new = "onConfirm(note, selectedFormat, showFinancialValues, groupItems, pcpTotalGrid, showMaterials, showItemGrid, showSectorNotes)"
content = content.replace(call_old, call_new)

# 7. Inject Toggles UI
toggles_ui = """
          {/* PCP Total Grid Toggle */}
          {showPCPTotalGridToggle && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1 mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
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
                    {pcpTotalGrid ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line></svg>}
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
                    {showMaterials ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line></svg>}
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

          {/* Sector Notes Toggle */}
          {showSectorNotesToggle && (
            <div>
              <button
                type="button"
                onClick={() => setShowSectorNotes(prev => !prev)}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.99] mt-2 ${
                  isDarkMode
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    showSectorNotes
                      ? 'bg-rose-500 text-white'
                      : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {showSectorNotes ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line></svg>}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Exibir instruções por setor</div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Mostra as observações e instruções cadastradas por setor
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}
"""

target = "          {/* Grouping Toggle "
idx = content.find(target)
if idx != -1:
    content = content[:idx] + toggles_ui + "\n" + content[idx:]
    with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Injected all 4 toggles perfectly!")
else:
    print("Target not found!")

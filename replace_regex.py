import re

with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r"\{\/\*\s*Grouping Toggle.*?\{\/\*\s*Footer Actions\s*\*\/\}"

ui_new = """{/* Grouping Toggle */}
          {showGroupingToggle && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <Layers size={12} className="text-indigo-500" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">Agrupamento de Itens</span>
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => setGroupMode('none')} className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${groupMode === 'none' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-transparent opacity-60'}`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Não agrupar</span>
                  <span className="text-[10px] text-slate-500 font-medium">Cada item aparece individualmente</span>
                </button>
                <button type="button" onClick={() => setGroupMode('ref_color')} className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${groupMode === 'ref_color' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-transparent opacity-60'}`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Agrupar por Modelo e Cor</span>
                  <span className="text-[10px] text-slate-500 font-medium">Soma as grades de mesma referência E cor</span>
                </button>
                <button type="button" onClick={() => setGroupMode('ref')} className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${groupMode === 'ref' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-transparent opacity-60'}`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Agrupar apenas por Referência</span>
                  <span className="text-[10px] text-slate-500 font-medium">Soma as cores do mesmo modelo juntas</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}"""

match = re.search(pattern, content, re.DOTALL)
if match:
    content = content[:match.start()] + ui_new + content[match.end():]
    with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: Replaced grouping toggle with regex")
else:
    print("FAILED to find pattern")

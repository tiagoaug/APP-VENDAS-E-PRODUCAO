import re

with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = "{/* Grouping Toggle - agrupa itens de mesma referência e cor, somando quantidades */}"

# Check if target exists
if target not in content:
    print("TARGET NOT FOUND!")
else:
    print("Found target!")

toggles_ui = """
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

# Insert toggles before target
content = content.replace(target, toggles_ui + target)

with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected toggles successfully!")

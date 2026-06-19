import re

with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Props
content = content.replace(
    "groupItems: boolean,",
    "groupMode: 'none' | 'ref_color' | 'ref',"
)

# 2. Update State
content = content.replace(
    "const [groupItems, setGroupItems] = useState(false);",
    "const [groupMode, setGroupMode] = useState<'none' | 'ref_color' | 'ref'>('none');"
)

# 3. Update Reset
content = content.replace(
    "setGroupItems(false);",
    "setGroupMode('none');"
)

# 4. Update callbacks
content = content.replace(
    "showFinancialValues, groupItems, pcpTotalGrid",
    "showFinancialValues, groupMode, pcpTotalGrid"
)

# 5. Update UI
ui_old = """
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {groupItems ? 'AGRUPAR ITENS' : 'NÃO AGRUPAR'}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                    {groupItems 
                      ? 'Itens com a mesma cor/modelo são somados' 
                      : 'Cada item aparece em sua própria linha'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGroupItems(!groupItems)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
                    groupItems ? 'bg-indigo-500' : isDarkMode ? 'bg-slate-600' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    groupItems ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
"""

ui_new = """
              <div className="flex flex-col gap-2 mt-2">
                <button type="button" onClick={() => setGroupMode('none')} className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${groupMode === 'none' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-transparent opacity-60'}`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Não agrupar</span>
                  <span className="text-[10px] text-slate-500 font-medium">Cada item aparece individualmente</span>
                </button>
                <button type="button" onClick={() => setGroupMode('ref_color')} className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${groupMode === 'ref_color' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-transparent opacity-60'}`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Agrupar por Modelo e Cor</span>
                  <span className="text-[10px] text-slate-500 font-medium">Soma as grades de pedidos de mesma referência E mesma cor</span>
                </button>
                <button type="button" onClick={() => setGroupMode('ref')} className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${groupMode === 'ref' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-transparent opacity-60'}`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Agrupar apenas por Referência</span>
                  <span className="text-[10px] text-slate-500 font-medium">Soma as grades de TODAS as cores do mesmo modelo juntas</span>
                </button>
              </div>
"""

content = content.replace(ui_old.strip(), ui_new.strip())

with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("ExportNoteModal grouping UI updated!")

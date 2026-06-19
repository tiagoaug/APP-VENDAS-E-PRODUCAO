import re

with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix ExportNoteModal Grouping UI
# The previous replace failed. Let's find the exact block using regex.
pattern = r"\{showGroupingToggle && \(\s*<div className=\{`p-4 rounded-3xl border transition-all \$\{\s*isDarkMode \? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'\s*\}\`\}>\s*<div className=\"flex items-center gap-2 mb-3\">.*?<span className=\"text-\[10px\] font-black uppercase tracking-\[0\.2em\] text-slate-700 dark:text-slate-300\">Agrupamento de itens</span>\s*</div>.*?</div>\s*</div>\s*\)\}"

ui_new = """{showGroupingToggle && (
            <div className={`p-4 rounded-3xl border transition-all ${
              isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M12 2l-5.5 3.5v7L12 16l5.5-3.5v-7L12 2z"></path><path d="M12 22l-5.5-3.5v-7L12 15l5.5-3.5v-7"></path></svg>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">Agrupamento de itens</span>
              </div>
              
              <div className="flex flex-col gap-2 mt-2">
                <button type="button" onClick={() => setGroupMode('none')} className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${groupMode === 'none' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-transparent opacity-60'}`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Não agrupar</span>
                  <span className="text-[10px] text-slate-500 font-medium">Cada item aparece individualmente</span>
                </button>
                <button type="button" onClick={() => setGroupMode('ref_color')} className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${groupMode === 'ref_color' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-transparent opacity-60'}`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Agrupar por Modelo e Cor</span>
                  <span className="text-[10px] text-slate-500 font-medium">Soma grades de mesma ref. e cor</span>
                </button>
                <button type="button" onClick={() => setGroupMode('ref')} className={`p-2.5 rounded-xl border text-left flex flex-col transition-all ${groupMode === 'ref' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-transparent opacity-60'}`}>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Agrupar apenas por Referência</span>
                  <span className="text-[10px] text-slate-500 font-medium">Soma as cores do mesmo modelo</span>
                </button>
              </div>
            </div>
          )}"""

match = re.search(pattern, content, re.DOTALL)
if match:
    content = content[:match.start()] + ui_new + content[match.end():]
else:
    print("Could not match grouping toggle block via regex in ExportNoteModal.tsx")
    # Let's try simpler replacement
    idx1 = content.find("{showGroupingToggle && (")
    if idx1 != -1:
        idx2 = content.find("          {/* PCP Total Grid Toggle */}", idx1)
        if idx2 != -1:
            content = content[:idx1] + ui_new + "\n" + content[idx2:]

with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Fix PurchasesView.tsx
with open('src/views/PurchasesView.tsx', 'r', encoding='utf-8') as f:
    purchases = f.read()

purchases = purchases.replace(
    "const handleConfirmExport = async (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupItems: boolean) => {",
    "const handleConfirmExport = async (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupMode: 'none' | 'ref_color' | 'ref') => {"
)
purchases = purchases.replace(
    "groupItems: groupItems",
    "groupItems: groupMode !== 'none'"
)
purchases = purchases.replace(
    "grouped: groupItems",
    "grouped: groupMode !== 'none'"
)

with open('src/views/PurchasesView.tsx', 'w', encoding='utf-8') as f:
    f.write(purchases)

print("Grouping fixes applied!")

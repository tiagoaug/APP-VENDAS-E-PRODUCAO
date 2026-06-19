import re

with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove Visualizar from Header
# Searching for: {onPreview && ( \n <button ... Visualizar ... </button> )} before the X close button
pattern_header_btn = r"\{\s*onPreview &&\s*\(\s*<button.*?Visualizar.*?<\/button>\s*\)\s*\}"
content = re.sub(pattern_header_btn, "", content, flags=re.DOTALL)

# 2. Rewrite Footer
start_footer = "{/* Footer Actions */}"
idx_footer = content.find(start_footer)

footer_new = """        {/* Footer Actions */}
        <div className={`p-4 flex flex-col gap-3 shrink-0 ${isDarkMode ? 'bg-slate-800/30' : 'bg-slate-50/50'}`}>
          {/* Preview Section */}
          {previewUrl && (
            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl p-3 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">Pré-visualização</span>
                <button type="button" onClick={() => setPreviewUrl(null)} className="text-xs font-bold text-rose-500">Fechar Preview</button>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden shadow-inner max-h-[60vh] overflow-y-auto">
                {selectedFormat === 'pdf' ? (
                  <iframe src={previewUrl + "#toolbar=0"} className="w-full h-[500px]" />
                ) : (
                  <img src={previewUrl} className="w-full h-auto" />
                )}
              </div>
            </div>
          )}

          {/* Cards Actions */}
          <div className="flex flex-col gap-2">
            {/* Visualizar */}
            {onPreview && (
              <div className={`p-1.5 rounded-[20px] shadow-sm flex ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 border'}`}>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isPreviewLoading}
                  className={`w-full py-3 text-white rounded-xl text-[12px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 bg-slate-800 shadow-slate-800/20`}
                >
                  {isPreviewLoading ? 'Carregando...' : 'Visualizar Arquivo'}
                </button>
              </div>
            )}

            {/* Cancel / Generate */}
            <div className={`p-1.5 rounded-[20px] shadow-sm flex gap-1.5 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 border'}`}>
              <button
                onClick={onClose}
                className={`flex-1 py-3 rounded-xl text-[12px] font-black uppercase tracking-widest transition-all ${
                  isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-50 text-slate-700'
                }`}
              >
                Cancelar
              </button>
              <button 
                onClick={() => onConfirm(note, selectedFormat, showFinancialValues, groupMode, pcpTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList)}
                className={`flex-[1.5] py-3 text-white rounded-xl text-[12px] font-black uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                  selectedFormat === 'pdf' ? 'bg-rose-500' : 'bg-indigo-600'
                }`}
              >
                {selectedFormat === 'pdf' ? <FileText size={16} /> : <Send size={16} className="rotate-45" />}
                Gerar {selectedFormat.toUpperCase()}
              </button>
            </div>

            {/* Format Toggles */}
            <div className={`p-1.5 rounded-[20px] shadow-sm flex gap-1.5 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 border'}`}>
              <button
                onClick={() => setSelectedFormat('pdf')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedFormat === 'pdf' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Formato PDF
              </button>
              <button
                onClick={() => setSelectedFormat('jpg')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedFormat === 'jpg' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Formato JPG
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Notes Sidebar... */"""

if idx_footer != -1:
    idx_sidebar = content.find("{/* Quick Notes Sidebar", idx_footer)
    if idx_sidebar != -1:
        content = content[:idx_footer] + footer_new + "\n      " + content[idx_sidebar:]

with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Footer correctly rebuilt into cards!")

import re

with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject Preview Section
preview_ui = """
          {/* Preview Section */}
          {previewUrl && (
            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">Pré-visualização</span>
                <button type="button" onClick={() => setPreviewUrl(null)} className="text-xs font-bold text-rose-500">Fechar Preview</button>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-hidden shadow-inner max-h-[60vh] overflow-y-auto">
                {selectedFormat === 'pdf' ? (
                  <iframe src={previewUrl + "#toolbar=0"} className="w-full h-[500px]" />
                ) : (
                  <img src={previewUrl} className="w-full h-auto" />
                )}
              </div>
            </div>
          )}
"""

target_buttons = "          <div className=\"flex items-center gap-3 pt-6 mt-6\">"
if target_buttons in content:
    content = content.replace(target_buttons, preview_ui + "\n" + target_buttons)
else:
    # Let's search for "Cancelar" button and find its parent div
    idx = content.find("Cancelar\n            </button>")
    if idx != -1:
        parent_div_start = content.rfind("<div className=", 0, idx)
        if parent_div_start != -1:
            content = content[:parent_div_start] + preview_ui + "\n          " + content[parent_div_start:]


# 2. Inject Visualizar button
preview_btn = """
            {onPreview && (
              <button
                type="button"
                onClick={handlePreview}
                disabled={isPreviewLoading}
                className={`flex-[1.5] py-4 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 bg-slate-800 shadow-slate-800/20`}
              >
                {isPreviewLoading ? 'Carregando...' : 'Visualizar'}
              </button>
            )}
"""
cancel_idx = content.find("onClick={onClose}")
if cancel_idx != -1:
    btn_start = content.rfind("<button", 0, cancel_idx)
    if btn_start != -1:
        content = content[:btn_start] + preview_btn.strip() + "\n            " + content[btn_start:]

with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected Preview UI properly!")

import re

with open('src/components/ExportNoteModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Props
props_old = """  showOrderListToggle?: boolean;
}"""
props_new = """  showOrderListToggle?: boolean;
  onPreview?: (note: string, format: 'pdf' | 'jpg', showFinancialValues: boolean, groupItems: boolean, pcpTotalGrid: boolean, showMaterials: boolean, showItemGrid: boolean, showSectorNotes: boolean, showOrderList: boolean) => Promise<string | boolean>;
}"""
content = content.replace(props_old, props_new)

# 2. Update Component arguments
args_old = """  showOrderListToggle = false
}: ExportNoteModalProps)"""
args_new = """  showOrderListToggle = false,
  onPreview
}: ExportNoteModalProps)"""
content = content.replace(args_old, args_new)

# 3. Add Preview States
state_old = "  const [showOrderList, setShowOrderList] = useState(true);"
state_new = """  const [showOrderList, setShowOrderList] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);"""
content = content.replace(state_old, state_new)

# 4. Add Preview Reset
reset_old = """      setShowOrderList(true);"""
reset_new = """      setShowOrderList(true);
      setPreviewUrl(null);
      setIsPreviewLoading(false);"""
content = content.replace(reset_old, reset_new)

# 5. Add handlePreview function
handle_preview = """
  const handlePreview = async () => {
    if (!onPreview) return;
    setIsPreviewLoading(true);
    try {
      const url = await onPreview(note, selectedFormat, showFinancialValues, groupItems, pcpTotalGrid, showMaterials, showItemGrid, showSectorNotes, showOrderList);
      if (typeof url === 'string') {
        setPreviewUrl(url);
      }
    } catch (e) {
      console.error("Preview failed", e);
    } finally {
      setIsPreviewLoading(false);
    }
  };
"""

target_func = "  const removeChip = (idx: number) => {"
content = content.replace(target_func, handle_preview + "\n" + target_func)

# 6. Render Preview UI
preview_ui = """
          {/* Preview Section */}
          {previewUrl && (
            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">Pr-visualizao</span>
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

target_buttons = "          <div className=\"flex items-center gap-3 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800\">"
content = content.replace(target_buttons, preview_ui + "\n" + target_buttons)

# 7. Add Visualizar Button
preview_btn = """
            {onPreview && (
              <button
                type="button"
                onClick={handlePreview}
                disabled={isPreviewLoading}
                className={`flex-1 py-4 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 bg-slate-800 shadow-slate-800/20`}
              >
                {isPreviewLoading ? 'Carregando...' : 'Visualizar'}
              </button>
            )}
"""

target_cancel = "            <button\n              type=\"button\"\n              onClick={onClose}"
content = content.replace(target_cancel, preview_btn.strip() + "\n            " + target_cancel)

with open('src/components/ExportNoteModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("ExportNoteModal updated with preview functionality!")

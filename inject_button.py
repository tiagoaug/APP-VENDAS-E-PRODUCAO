import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# I will find the Emitir OS button by searching for:
# <Hammer size={13} /> Emitir OS - {selected.length} {selected.length === 1 ? 'Pedido' : 'Pedidos'}
pattern = r"(<Hammer size=\{13\} /> Emitir OS - \{selected\.length\}.*?\n.*?</button>)"

button_statement = r"""\1
                                <button
                                  type="button"
                                  onClick={() => setShareModal({ isOpen: true, format: 'pdf', selectedItems: selected })}
                                  className={`w-full py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                                  Compartilhar Ficha
                                </button>"""

if "Compartilhar Ficha" not in re.search(pattern, content).group(1) + "\n":
    content = re.sub(pattern, button_statement, content)
    with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Button injected!")
else:
    print("Button already injected")

import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove `{f.si.qty}P` and style the chevron in Setores
setores_qty_old = """                                      <div className="flex items-center gap-1">
                                        <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">{f.si.qty}P</span>
                                        <button
                                          type="button"
                                          title={gradeOpen ? 'Recolher' : 'Expandir grade'}
                                          aria-label={gradeOpen ? 'Recolher pedido' : 'Expandir pedido'}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const next = new Set(expandedSourceItems);
                                            gradeOpen ? next.delete(gradeKey) : next.add(gradeKey);
                                            setExpandedSourceItems(next);
                                          }}
                                          className={`p-1 rounded-lg transition-all ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-300 hover:text-slate-600'}`}
                                        >"""

setores_qty_new = """                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          title={gradeOpen ? 'Recolher' : 'Expandir grade'}
                                          aria-label={gradeOpen ? 'Recolher pedido' : 'Expandir pedido'}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const next = new Set(expandedSourceItems);
                                            gradeOpen ? next.delete(gradeKey) : next.add(gradeKey);
                                            setExpandedSourceItems(next);
                                          }}
                                          className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-all active:scale-95"
                                        >"""

content = content.replace(setores_qty_old, setores_qty_new)

# 2. Remove `{si.qty}P` and style the chevron in Mapas (Not Completed OS)
mapas_qty_old = """                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{si.qty}P</span>
                                  <button
                                    type="button"
                                    title={isExpanded ? 'Recolher' : 'Expandir grade'}
                                    aria-label={isExpanded ? 'Recolher pedido' : 'Expandir pedido'}
                                    onClick={() => {
                                      const next = new Set(expandedSourceItems);
                                      isExpanded ? next.delete(key) : next.add(key);
                                      setExpandedSourceItems(next);
                                    }}
                                    className={`p-1 rounded-lg transition-all ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-300 hover:text-slate-600'}`}
                                  >"""

mapas_qty_new = """                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    title={isExpanded ? 'Recolher' : 'Expandir grade'}
                                    aria-label={isExpanded ? 'Recolher pedido' : 'Expandir pedido'}
                                    onClick={() => {
                                      const next = new Set(expandedSourceItems);
                                      isExpanded ? next.delete(key) : next.add(key);
                                      setExpandedSourceItems(next);
                                    }}
                                    className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-all active:scale-95"
                                  >"""

content = content.replace(mapas_qty_old, mapas_qty_new)

# 3. Remove `{si.qty}P` in Mapas (Completed OS)
mapas_qty_completed_old = """                                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{si.qty}P</span>
                                  <button
                                    type="button"
                                    title="Mudar o setor deste pedido"
                                    onClick={() => {"""

mapas_qty_completed_new = """                                  <button
                                    type="button"
                                    title="Mudar o setor deste pedido"
                                    onClick={() => {"""

content = content.replace(mapas_qty_completed_old, mapas_qty_completed_new)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

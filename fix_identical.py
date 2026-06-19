import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the inner block of the header for `filteredFichas`
start_target = """                                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => { const n = new Set(fichaItemExpanded); gradeOpen ? n.delete(gradeKey) : n.add(gradeKey); setFichaItemExpanded(n); }}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="text-[11px] font-black uppercase truncate text-slate-700 dark:text-slate-200 leading-none">
                                        {productRef ? `${productRef} ${productName}` : productName}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {colorName && (
                                        <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{colorName}</span>
                                      )}
                                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                        PED. {f.lot.orderNumber}
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1">
                                        {f.order?.customerName || 'ESTOQUE'}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/20 px-2 py-0.5 rounded-full uppercase truncate max-w-[120px]">
                                      {sectors.find(s => s.id === f.lot.route?.[f.lot.currentSectorIndex])?.name || 'DESCONHECIDO'}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-violet-600 text-white tracking-widest">
                                        MAPA{f.lot.orderNumber}
                                      </span>
                                      <div className="flex items-center gap-1 cursor-pointer" onClick={() => { const n = new Set(fichaItemExpanded); gradeOpen ? n.delete(gradeKey) : n.add(gradeKey); setFichaItemExpanded(n); }}>
                                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{f.si.qty}P</span>
                                        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${gradeOpen ? 'rotate-180' : ''}`} />
                                      </div>
                                    </div>
                                  </div>"""

replacement = """                                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => { const n = new Set(fichaItemExpanded); gradeOpen ? n.delete(gradeKey) : n.add(gradeKey); setFichaItemExpanded(n); }}>
                                    <p className="text-[11px] font-black uppercase truncate text-slate-800 dark:text-slate-200 leading-none">
                                      {productRef ? `${productRef} ${productName}` : productName}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      {colorName && (
                                        <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{colorName}</span>
                                      )}
                                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {f.order?.saleOrderNumber || f.lot.saleOrderNumber}</span>
                                      {hasOS && (
                                        <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">• {f.coveringOS!.osNumber}</span>
                                      )}
                                    </div>
                                    {(() => {
                                      const custName = (f.order?.customerName || f.lot.customerName || '').trim();
                                      if (!custName) return null;
                                      const isStock = custName.toUpperCase() === 'ESTOQUE';
                                      return (
                                        <p className="text-[8px] font-black text-slate-900 dark:text-white uppercase tracking-widest mt-0.5 truncate">
                                          {isStock ? 'Estoque' : `Cliente: ${custName}`}
                                        </p>
                                      );
                                    })()}
                                  </div>
                                  
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className="text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-sm">
                                      {sectors.find(s => s.id === f.lot.route?.[f.lot.currentSectorIndex])?.name || 'DESCONHECIDO'}
                                    </span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-violet-600 text-white tracking-widest shadow-sm">
                                        MAPA{f.lot.orderNumber}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">{f.si.qty}P</span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const n = new Set(fichaItemExpanded);
                                            gradeOpen ? n.delete(gradeKey) : n.add(gradeKey);
                                            setFichaItemExpanded(n);
                                          }}
                                          className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                          {gradeOpen ? <Minus size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                        </button>
                                      </div>
                                    </div>
                                  </div>"""

content = content.replace(start_target, replacement)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

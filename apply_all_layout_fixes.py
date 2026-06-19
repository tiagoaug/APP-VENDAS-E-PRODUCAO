import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# --- TARGET 1: Setores Fichas Card ---
target1 = """                                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => { const n = new Set(fichaItemExpanded); gradeOpen ? n.delete(gradeKey) : n.add(gradeKey); setFichaItemExpanded(n); }}>
                                        <div className="flex items-center gap-2 mb-1">
                                          <p className="text-[11px] font-black uppercase truncate text-slate-700 dark:text-slate-200 leading-none">
                                            {productRef || productName}
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

replacement1 = """                                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => { const n = new Set(fichaItemExpanded); gradeOpen ? n.delete(gradeKey) : n.add(gradeKey); setFichaItemExpanded(n); }}>
                                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                          <p className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 leading-none">
                                            {productRef || productName}
                                          </p>
                                          {colorName && (
                                            <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 leading-none">{colorName}</span>
                                          )}
                                          {(() => {
                                            const effSec = getOrderEffectiveSector(f.lot, f.si.orderId, f.si);
                                            const secName = effSec === ORDER_FINALIZED
                                              ? 'Finalizado'
                                              : (sectors.find(s => s.id === effSec)?.name || effSec || '—');
                                            return (
                                              <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-rose-500 text-white tracking-widest shadow-sm shadow-rose-500/20 leading-none">
                                                {secName}
                                              </span>
                                            );
                                          })()}
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                            PED. {f.lot.orderNumber}
                                          </span>
                                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                            {f.order?.customerName || 'ESTOQUE'}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex flex-col items-end gap-1 shrink-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-violet-600 text-white tracking-widest">
                                            MAPA{f.lot.orderNumber}
                                          </span>
                                          <button
                                            type="button"
                                            title={gradeOpen ? 'Recolher' : 'Expandir grade'}
                                            aria-label={gradeOpen ? 'Recolher pedido' : 'Expandir pedido'}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const n = new Set(fichaItemExpanded);
                                              gradeOpen ? n.delete(gradeKey) : n.add(gradeKey);
                                              setFichaItemExpanded(n);
                                            }}
                                            className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-all active:scale-95 shrink-0"
                                          >
                                            <ChevronDown size={13} className={`transition-transform duration-200 ${gradeOpen ? 'rotate-180' : ''}`} />
                                          </button>
                                        </div>
                                      </div>"""

# --- TARGET 2: Mapas Pedidos no Setor (Not Completed OS) ---
target2 = """                              <div className="min-w-0 flex-1">
                                {/* Linha 1: Referência + Nome */}
                                <p className="text-[11px] font-black uppercase truncate text-slate-800 dark:text-slate-200 leading-none">
                                  {productRef || productName}
                                </p>
                                {/* Linha 2: Cor + Pedido */}
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {colorName && (
                                    <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{colorName}</span>
                                  )}
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {order?.saleOrderNumber || selectedLot.saleOrderNumber}</span>
                                  {hasOS && (
                                    <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">· {orderOS!.osNumber}</span>
                                  )}
                                </div>"""

replacement2 = """                              <div className="min-w-0 flex-1">
                                {/* Linha 1: Referência + Nome + Cor + Setor */}
                                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                  <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 leading-none">
                                    {productRef || productName}
                                  </p>
                                  {colorName && (
                                    <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 leading-none">{colorName}</span>
                                  )}
                                  {(() => {
                                    const effSec = getOrderEffectiveSector(selectedLot, si.orderId, si);
                                    const secName = effSec === ORDER_FINALIZED
                                      ? 'Finalizado'
                                      : (sectors.find(s => s.id === effSec)?.name || effSec || '—');
                                    return (
                                      <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-rose-500 text-white tracking-widest shadow-sm shadow-rose-500/20 leading-none">
                                        {secName}
                                      </span>
                                    );
                                  })()}
                                </div>
                                {/* Linha 2: Pedido */}
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {order?.saleOrderNumber || selectedLot.saleOrderNumber}</span>
                                  {hasOS && (
                                    <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">· {orderOS!.osNumber}</span>
                                  )}
                                </div>"""

target2_right = """                              <div className="flex flex-col items-end gap-0.5 shrink-0">
                                {(() => {
                                  // Setor onde ESTE pedido está (cápsula vermelha) — a informação
                                  // de setor vive no pedido, não no mapa.
                                  const effSec = getOrderEffectiveSector(selectedLot, si.orderId, si);
                                  const secName = effSec === ORDER_FINALIZED
                                    ? 'Finalizado'
                                    : (sectors.find(s => s.id === effSec)?.name || effSec || '—');
                                  return (
                                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-rose-500 text-white tracking-widest shadow-sm shadow-rose-500/20">
                                      {secName}
                                    </span>
                                  );
                                })()}
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-violet-600 text-white tracking-widest shadow-sm shadow-violet-500/30">
                                  MAPA{selectedLot.orderNumber}
                                </span>"""

replacement2_right = """                              <div className="flex flex-col items-end gap-0.5 shrink-0">
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-violet-600 text-white tracking-widest shadow-sm shadow-violet-500/30">
                                  MAPA{selectedLot.orderNumber}
                                </span>"""

# --- TARGET 3: Mapas Pedidos em Outros Setores ---
target3 = """                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-black uppercase truncate text-slate-700 dark:text-slate-200 leading-none">
                                    {productRef || productName}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {colorName && (
                                      <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{colorName}</span>
                                    )}
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {order?.saleOrderNumber || selectedLot.saleOrderNumber}</span>
                                  </div>
                                </div>"""

replacement3 = """                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                    <p className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 leading-none">
                                      {productRef || productName}
                                    </p>
                                    {colorName && (
                                      <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 leading-none">{colorName}</span>
                                    )}
                                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-rose-500 text-white tracking-widest shadow-sm shadow-rose-500/20 leading-none">
                                      {secName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {order?.saleOrderNumber || selectedLot.saleOrderNumber}</span>
                                  </div>
                                </div>"""

# Apply Replacements
print("Applying Target 1...")
if target1 in content:
    content = content.replace(target1, replacement1)
    print("Target 1 applied!")
else:
    print("Target 1 NOT found!")

print("Applying Target 2...")
if target2 in content:
    content = content.replace(target2, replacement2)
    print("Target 2 applied!")
else:
    print("Target 2 NOT found!")

print("Applying Target 2 Right...")
if target2_right in content:
    content = content.replace(target2_right, replacement2_right)
    print("Target 2 Right applied!")
else:
    print("Target 2 Right NOT found!")

print("Applying Target 3...")
if target3 in content:
    content = content.replace(target3, replacement3)
    print("Target 3 applied!")
else:
    print("Target 3 NOT found!")

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("All layout fixes successfully executed!")

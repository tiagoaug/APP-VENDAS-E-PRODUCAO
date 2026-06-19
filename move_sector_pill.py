import re

with open('src/views/PCPView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# --- SETORES ---

# 1. Add sector pill to the left side in Setores
setores_left_old = """                                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                      <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 leading-none">
                                        {productRef ? `${productRef} ${productName}` : productName}
                                      </p>
                                      {colorName && (
                                        <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 leading-none">{colorName}</span>
                                      )}
                                    </div>"""

setores_left_new = """                                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                      <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 leading-none">
                                        {productRef || productName}
                                      </p>
                                      {colorName && (
                                        <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 leading-none">{colorName}</span>
                                      )}
                                      {(() => {
                                        const effSec = getOrderEffectiveSector(f.lot, f.si.orderId, f.si);
                                        const secName = effSec === ORDER_FINALIZED
                                          ? 'Finalizado'
                                          : (sectors.find(s => s.id === effSec)?.name || effSec || '--');
                                        return (
                                          <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-rose-500 text-white tracking-widest shadow-sm shadow-rose-500/20 leading-none">
                                            {secName}
                                          </span>
                                        );
                                      })()}
                                    </div>"""

# Ensure I apply the change (and fix `{productRef || productName}` since it was missed or already replaced!)
# Wait! I already replaced `{productRef || productName}` previously.
# Let me use regex to match it just in case!

# Let's just use string replacement and match what is CURRENTLY in the file!
# The previous script successfully replaced it with `{productRef || productName}`. So I use that!
content = content.replace(setores_left_old.replace('{productRef ? `${productRef} ${productName}` : productName}', '{productRef || productName}'), setores_left_new)

# 2. Remove sector pill from the right side in Setores
setores_right_old = """                                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                                    {(() => {
                                      const effSec = getOrderEffectiveSector(f.lot, f.si.orderId, f.si);
                                      const secName = effSec === ORDER_FINALIZED
                                        ? 'Finalizado'
                                        : (sectors.find(s => s.id === effSec)?.name || effSec || '--');
                                      return (
                                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-rose-500 text-white tracking-widest shadow-sm shadow-rose-500/20">
                                          {secName}
                                        </span>
                                      );
                                    })()}
                                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-violet-600 text-white tracking-widest shadow-sm shadow-violet-500/30">
                                      MAPA{f.lot.orderNumber}
                                    </span>"""

setores_right_new = """                                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-violet-600 text-white tracking-widest shadow-sm shadow-violet-500/30">
                                      MAPA{f.lot.orderNumber}
                                    </span>"""

content = content.replace(setores_right_old, setores_right_new)


# --- MAPAS (Not Completed OS) ---

# 1. Add sector pill to the left side in Mapas
mapas_left_old = """                                {/* Linha 1: Referência + Nome + Cor */}
                                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                  <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 leading-none">
                                    {productRef || productName}
                                  </p>
                                  {colorName && (
                                    <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 leading-none">{colorName}</span>
                                  )}
                                </div>"""

mapas_left_new = """                                {/* Linha 1: Referência + Nome + Cor + Setor */}
                                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
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
                                      : (sectors.find(s => s.id === effSec)?.name || effSec || '--');
                                    return (
                                      <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-rose-500 text-white tracking-widest shadow-sm shadow-rose-500/20 leading-none">
                                        {secName}
                                      </span>
                                    );
                                  })()}
                                </div>"""

content = content.replace(mapas_left_old, mapas_left_new)

# 2. Remove sector pill from the right side in Mapas
mapas_right_old = """                              <div className="flex flex-col items-end gap-0.5 shrink-0">
                                {(() => {
                                  // Setor onde ESTE pedido está (cápsula vermelha) - a informação
                                  // de setor vive no pedido, não no mapa.
                                  const effSec = getOrderEffectiveSector(selectedLot, si.orderId, si);
                                  const secName = effSec === ORDER_FINALIZED
                                    ? 'Finalizado'
                                    : (sectors.find(s => s.id === effSec)?.name || effSec || '--');
                                  return (
                                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-rose-500 text-white tracking-widest shadow-sm shadow-rose-500/20">
                                      {secName}
                                    </span>
                                  );
                                })()}
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-violet-600 text-white tracking-widest shadow-sm shadow-violet-500/30">
                                  MAPA{selectedLot.orderNumber}
                                </span>"""

mapas_right_new = """                              <div className="flex flex-col items-end gap-0.5 shrink-0">
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-violet-600 text-white tracking-widest shadow-sm shadow-violet-500/30">
                                  MAPA{selectedLot.orderNumber}
                                </span>"""

content = content.replace(mapas_right_old, mapas_right_new)


# --- MAPAS (Completed OS) ---

mapas_comp_left_old = """                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-black uppercase truncate text-slate-800 dark:text-slate-200 leading-none">
                                  {productRef || productName}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {colorName && (
                                    <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{colorName}</span>
                                  )}
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ped. {order?.saleOrderNumber || selectedLot.saleOrderNumber}</span>
                                </div>"""

mapas_comp_left_new = """                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                  <p className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 leading-none">
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
                                </div>"""

content = content.replace(mapas_comp_left_old, mapas_comp_left_new)

mapas_comp_right_old = """                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <span className="text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    {secName}
                                  </span>
                                  <button"""

mapas_comp_right_new = """                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <button"""

content = content.replace(mapas_comp_right_old, mapas_comp_right_new)

with open('src/views/PCPView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

import os

filepath = r"c:\Users\SISTEMAS-PC\Desktop\PROJETOS ANTIGRAVIT\APP VENDAS E PRODUCAO\src\views\PCPView.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Normalize newlines
content_normalized = content.replace('\r\n', '\n')

# Locate target block in finalizeSelectedConfirm modal
target_block = """                {finalizeSelectedConfirm.items.map((it, i) => {
                  const info = finalizeSelectedConfirm.stockInfo?.[it.key];
                  return (
                    <div key={i} className="flex flex-col gap-0.5">
                      <p className={`text-[11px] font-bold text-left uppercase ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        {describeMoveItem(finalizeSelectedConfirm.lot, it)}
                      </p>
                      {info && (
                        <p className={`text-[10px] font-bold text-left normal-case ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          → {info.destino} · Estoque atual: <strong>{info.currentQty} {info.unit}</strong>
                          {info.projectedQty !== info.currentQty && <> · Ficará com: <strong className="text-emerald-600 dark:text-emerald-400">{info.projectedQty} {info.unit}</strong></>}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>"""

replacement_block = """                {finalizeSelectedConfirm.items.map((it, i) => {
                  const info = finalizeSelectedConfirm.stockInfo?.[it.key];
                  return (
                    <div key={i} className="flex flex-col gap-0.5">
                      <p className={`text-[11px] font-bold text-left uppercase ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                        {describeMoveItem(finalizeSelectedConfirm.lot, it)}
                      </p>
                      {info && (
                        <p className={`text-[10px] font-bold text-left normal-case ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          → {info.destino} · Estoque atual: <strong>{info.currentQty} {info.unit}</strong>
                          {info.projectedQty !== info.currentQty && <> · Ficará com: <strong className="text-emerald-600 dark:text-emerald-400">{info.projectedQty} {info.unit}</strong></>}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resumo Geral de Baixas e Estoque de Caixas Somadas */}
              {(() => {
                let totalSolesDeducted = 0;
                finalizeSelectedConfirm.soleInfo?.forEach(group => {
                  group.rows.forEach(row => {
                    totalSolesDeducted += (row.before - row.after);
                  });
                });

                let totalCurrentBoxes = 0;
                let totalAddedBoxes = 0;
                let totalProjectedBoxes = 0;
                let hasBoxes = False;

                let totalCurrentPairs = 0;
                let totalAddedPairs = 0;
                let totalProjectedPairs = 0;
                let hasPairs = False;

                Object.values(finalizeSelectedConfirm.stockInfo || {}).forEach(info => {
                  if (info.destino === 'Estoque') {
                    if (info.unit === 'caixas') {
                      totalCurrentBoxes += info.currentQty;
                      totalAddedBoxes += info.addQty;
                      totalProjectedBoxes += info.projectedQty;
                      hasBoxes = true;
                    } else if (info.unit === 'pares') {
                      totalCurrentPairs += info.currentQty;
                      totalAddedPairs += info.addQty;
                      totalProjectedPairs += info.projectedQty;
                      hasPairs = true;
                    }
                  }
                });

                if (totalSolesDeducted === 0 && !hasBoxes && !hasPairs) return null;

                return (
                  <div className={`w-full px-4 py-3 rounded-2xl flex flex-col gap-2.5 ${isDarkMode ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-indigo-50/50 border border-indigo-100/55'}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 text-left">
                      Resumo Geral de Baixas
                    </p>
                    
                    {totalSolesDeducted > 0 && (
                      <div className="flex justify-between items-center text-[11px] font-bold text-left">
                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Total Solas Abatidas:</span>
                        <span className="text-rose-600 dark:text-rose-400 font-black">-{totalSolesDeducted} pares</span>
                      </div>
                    )}

                    {hasBoxes && (
                      <div className="flex flex-col gap-1 text-[11px] font-bold text-left border-t border-slate-200/50 dark:border-slate-700/50 pt-2">
                        <div className="flex justify-between items-center">
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Estoque Caixas (Somado):</span>
                          <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{totalCurrentBoxes} cx</span>
                        </div>
                        <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                          <span>Entrada Produção:</span>
                          <span className="font-black">+{totalAddedBoxes} cx</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-dashed border-slate-200/50 dark:border-slate-700/50 pt-1">
                          <span>Projeção Final:</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-black">{totalProjectedBoxes} cx</span>
                        </div>
                      </div>
                    )}

                    {hasPairs && (
                      <div className="flex flex-col gap-1 text-[11px] font-bold text-left border-t border-slate-200/50 dark:border-slate-700/50 pt-2">
                        <div className="flex justify-between items-center">
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Estoque Pares (Somado):</span>
                          <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{totalCurrentPairs} prs</span>
                        </div>
                        <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                          <span>Entrada Produção:</span>
                          <span className="font-black">+{totalAddedPairs} prs</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-dashed border-slate-200/50 dark:border-slate-700/50 pt-1">
                          <span>Projeção Final:</span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-black">{totalProjectedPairs} prs</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}"""

# We need to make sure 'False' in python is converted to 'false' in typescript!
# In the python string replacement_block, we have "hasBoxes = False;" and "hasPairs = False;"
# Let's fix that to "hasBoxes = false;" and "hasPairs = false;"
replacement_block = replacement_block.replace("False", "false")

target_normalized = target_block.replace('\r\n', '\n')
replacement_normalized = replacement_block.replace('\r\n', '\n')

if target_normalized in content_normalized:
    new_content = content_normalized.replace(target_normalized, replacement_normalized)
    with open(filepath, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(new_content)
    print("SUCCESS: FinalizeSelectedConfirm modal updated with summary totals.")
else:
    print("ERROR: Target block not found in content!")

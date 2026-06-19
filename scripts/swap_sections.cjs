const fs = require('fs');

const file = 'c:\\Users\\SISTEMAS-PC\\Desktop\\PROJETOS ANTIGRAVIT\\APP VENDAS E PRODUCAO\\src\\views\\PCPView.tsx';
let content = fs.readFileSync(file, 'utf8');

const mapGridStartToken = `              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;
const mapGridStartIdx = content.indexOf(mapGridStartToken);
if (mapGridStartIdx === -1) throw new Error("Could not find map grid start");

// Use regex to find the end robustly
const mapGridEndRegex = /              <\/div>\r?\n\r?\n              \{\/\* ── Pedidos Vinculados/;
const mapGridEndMatch = content.match(mapGridEndRegex);
if (!mapGridEndMatch) throw new Error("Could not find map grid end");

const mapGridEndIdx = mapGridEndMatch.index + `              </div>`.length;
const fichasStartIdx = mapGridEndMatch.index + `              </div>\r\n\r\n`.length;

const fichasEndRegex = /                  <\/div>\r?\n                \);\r?\n              \}\)\(\)\}/;
const fichasEndMatch = content.match(fichasEndRegex);
if (!fichasEndMatch) throw new Error("Could not find fichas end");
const fichasEndIdx = fichasEndMatch.index + fichasEndMatch[0].length;

const beforeMaps = content.slice(0, mapGridStartIdx);
const mapsBlock = content.slice(mapGridStartIdx, mapGridEndIdx);
const fichasBlock = content.slice(fichasStartIdx, fichasEndIdx);
const afterFichas = content.slice(fichasEndIdx);

// Transform the maps block into an accordion
const mapsAccordionCode = `              {/* ── Mapas no Setor (Acordeão) ── */}
              {(() => {
                const lotsInSector = filteredActiveLots.filter(l => l.route && getLotPendingSectorGroups(l).has(selectedSectorId!));
                if (lotsInSector.length === 0) return null;
                const mapKey = \`__maplots__\${selectedSectorId}\`;
                const isMapOpen = fichaListOpen.has(mapKey);
                return (
                  <div className={\`mt-4 rounded-3xl border overflow-hidden \${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/80 border-slate-200 shadow-sm'}\`}>
                    <button type="button"
                      onClick={() => { const n = new Set(fichaListOpen); isMapOpen ? n.delete(mapKey) : n.add(mapKey); setFichaListOpen(n); }}
                      className={\`w-full flex items-center justify-between p-4 transition-colors \${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-100/60'}\`}
                    >
                      <div className="flex items-center gap-2">
                        <ListTodo size={13} className="text-emerald-500 shrink-0" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Mapas no Setor</h3>
                        <span className={\`text-[9px] font-black px-2 py-0.5 rounded-full \${isDarkMode ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}\`}>
                          {lotsInSector.length}
                        </span>
                      </div>
                      <ChevronDown size={15} className={\`text-slate-400 transition-transform duration-200 \${isMapOpen ? 'rotate-180' : ''}\`} />
                    </button>
                    {!isMapOpen && (
                      <div className={\`px-4 pb-3 border-t text-[9px] text-slate-400 font-bold uppercase \${isDarkMode ? 'border-slate-800' : 'border-slate-100'}\`}>
                        <p className="mt-1">Expandir para ver e gerenciar mapas neste setor</p>
                      </div>
                    )}
                    {isMapOpen && (
                      <div className="p-4 pt-2 flex flex-col gap-4">
` + mapsBlock.replace(/<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">/, '<div className="grid grid-cols-1 md:grid-cols-2 gap-4">') + `
                      </div>
                    )}
                  </div>
                );
              })()}`;

// Replace mt-4 with empty if needed, or just let it have mt-4
const newFichasBlock = fichasBlock.replace(/mt-4/, '');

// We want the final order to be: beforeMaps + fichasBlock + \n\n + mapsAccordionCode + afterFichas
const newContent = beforeMaps + newFichasBlock + '\n\n' + mapsAccordionCode + afterFichas;

fs.writeFileSync(file, newContent, 'utf8');
console.log("Successfully swapped sections and created Mapas accordion.");

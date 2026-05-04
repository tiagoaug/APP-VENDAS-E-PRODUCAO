const fs = require('fs');
const path = 'c:\\Users\\SISTEMAS-PC\\Desktop\\PROJETOS ANTIGRAVIT\\APP VENDAS E PRODUCAO\\src\\views\\ProductionConfigView.tsx';
let content = fs.readFileSync(path, 'utf8').split('\n');

const newForm = `          <form onSubmit={handleSave} className="flex flex-col gap-6">
            {type === 'MOLD' ? (
               // Specialized Form for Matrizes de Solado
               <div className="flex flex-col gap-6">
                 {/* Reference and Name */}
                 <div className="grid grid-cols-3 gap-4">
                   <div className="flex flex-col gap-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Referência *</label>
                     <input 
                       type="text"
                       value={editingItem?.metadata?.moldReference || ''}
                       onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, moldReference: e.target.value.toUpperCase() } } : null)}
                       required
                       className={\`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 \${
                         isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'
                       }\`}
                     />
                   </div>
                   <div className="col-span-2 flex flex-col gap-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome da Matriz *</label>
                     <input 
                       type="text"
                       value={editingItem?.name || ''}
                       onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value.toUpperCase() } : null)}
                       required
                       className={\`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 \${
                         isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'
                       }\`}
                     />
                   </div>
                 </div>

                 {/* Category and Price */}
                 <div className="grid grid-cols-2 gap-4">
                   <div className="flex flex-col gap-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Categoria</label>
                     <select 
                       title="Categoria da Matriz"
                       aria-label="Selecionar categoria da matriz"
                       value={editingItem?.metadata?.category || ''}
                       onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, category: e.target.value } } : null)}
                       className={\`w-full px-4 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest outline-none transition-all border-2 \${
                         isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'
                       }\`}
                     >
                       <option value="">GERAL</option>
                       <option value="SOLADO">SOLADO</option>
                       <option value="SALTO">SALTO</option>
                       <option value="PALMILHA">PALMILHA</option>
                     </select>
                   </div>
                   <div className="flex flex-col gap-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Preço (R$)</label>
                     <input 
                       type="number"
                       step="0.01"
                       value={editingItem?.metadata?.price || ''}
                       onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, price: parseFloat(e.target.value) } } : null)}
                       className={\`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 \${
                         isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'
                       }\`}
                     />
                   </div>
                 </div>

                 {/* Flow Tag Selection */}
                 <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-500 ml-2">Estágio do Fluxo / Setor</label>
                   <div className="relative">
                      <select 
                        title="Estágio do Fluxo"
                        value={editingItem?.metadata?.flowTagId || ''}
                        onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, flowTagId: e.target.value } } : null)}
                        className={\`w-full px-5 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] outline-none border-2 transition-all appearance-none cursor-pointer \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'}\`}
                      >
                        <option value="">SELECIONE O ESTÁGIO...</option>
                        {flowTags.map(tag => (
                          <option key={tag.id} value={tag.id}>{tag.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                 </div>

                 {/* Size Weight Grid */}
                 <div className={\`p-6 rounded-[2rem] border-2 \${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}\`}>
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Scale size={18} className="text-indigo-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Pesos por Tamanho (GR)</span>
                      </div>
                      <select 
                        title="Selecionar Grade"
                        aria-label="Selecionar grade de tamanhos para pesos"
                        onChange={(e) => {
                           const gridId = e.target.value;
                           const grid = (grids || []).find(g => g.id === gridId);
                           if (grid) {
                             const weights: Record<string, number> = {};
                             grid.sizes.forEach(s => {
                               weights[s] = editingItem?.metadata?.sizeWeights?.[s] || 0;
                             });
                             setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, sizeWeights: weights, sizes: grid.sizes } } : null);
                           }
                        }}
                        className={\`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none border-2 \${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-600'}\`}
                      >
                        <option value="">PUXAR GRADE...</option>
                        {(grids || []).filter(g => g.type === GridType.SOLADO || !g.type).map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                   </div>

                   <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                      {Object.entries(editingItem?.metadata?.sizeWeights || {}).map(([size, weight]) => (
                        <div key={size} className="flex flex-col gap-1">
                           <span className="text-[9px] font-black text-slate-600 dark:text-slate-400 ml-1">{size}</span>
                           <input 
                             type="number"
                             value={weight || ''}
                             onChange={(e) => {
                               const val = parseFloat(e.target.value);
                               setEditingItem(prev => {
                                 if (!prev) return null;
                                 const newWeights = { ...(prev.metadata?.sizeWeights || {}) };
                                 newWeights[size] = val;
                                 return { ...prev, metadata: { ...prev.metadata, sizeWeights: newWeights } };
                               });
                             }}
                             className={\`w-full px-2 py-3 rounded-xl font-black text-[10px] text-center outline-none border-2 \${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-50'}\`}
                           />
                        </div>
                      ))}
                   </div>

                   {/* Weight and Yield Summary Row */}
                   <div className="flex items-center justify-between mt-6 pt-6 border-t-2 border-dashed border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col gap-1">
                         <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Peso Médio (GR)</label>
                         <div className="relative">
                            <input 
                              type="number"
                              step="0.01"
                              value={editingItem?.metadata?.averageWeight || ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, averageWeight: val } } : null);
                              }}
                              className={\`w-40 px-4 py-3 rounded-xl font-black text-xs outline-none border-2 \${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-600'}\`}
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                const weights = Object.values(editingItem?.metadata?.sizeWeights || {}) as number[];
                                const activeWeights = weights.filter(w => w > 0);
                                if (activeWeights.length > 0) {
                                  const avg = activeWeights.reduce((a, b) => a + b, 0) / activeWeights.length;
                                  setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, averageWeight: Number(avg.toFixed(2)) } } : null);
                                }
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:scale-105 active:scale-95 transition-all"
                              title="Calcular média da grade"
                            >
                               <Scale size={14} />
                            </button>
                         </div>
                      </div>

                      <div className="text-right">
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Rendimento Médio</p>
                         <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                               {editingItem?.metadata?.averageWeight ? (1000 / editingItem.metadata.averageWeight).toFixed(2) : '0.00'}
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase">PRS / KG</span>
                         </div>
                      </div>
                   </div>
                 </div>

                 {/* Material Composition Card */}
                 <div className={\`p-6 rounded-[2rem] border-2 \${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}\`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Layers size={18} className="text-indigo-500" />
                          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Composição de Materiais</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Defina o consumo de insumos para este solado</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const currentComposition = editingItem?.metadata?.composition || [];
                          setEditingItem(prev => prev ? {
                            ...prev,
                            metadata: {
                              ...prev.metadata,
                              composition: [...currentComposition, { materialId: '', quantity: 0, type: 'weight' }]
                            }
                          } : null);
                        }}
                        className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <div className="flex flex-col gap-3">
                      {(editingItem?.metadata?.composition || []).map((item, index) => (
                        <div key={index} className={\`grid grid-cols-12 gap-3 p-4 rounded-2xl border-2 \${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}\`}>
                          <div className="col-span-6 flex flex-col gap-1">
                            <label className="text-[8px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 ml-1">Insumo / Material</label>
                            <select
                              title="Selecionar Material"
                              value={item.materialId}
                              onChange={(e) => {
                                const newComp = [...(editingItem?.metadata?.composition || [])];
                                newComp[index] = { ...newComp[index], materialId: e.target.value };
                                setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null);
                              }}
                              className={\`w-full px-3 py-3 rounded-xl font-bold text-[10px] uppercase outline-none border-2 transition-all \\\${
                                isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-indigo-100'
                              }\`}
                            >
                              <option value="">SELECIONE...</option>
                              {productionConfigs.filter(c => c.type === 'MATERIAL').map(mat => (
                                <option key={mat.id} value={mat.id}>{mat.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-3 flex flex-col gap-1">
                            <label className="text-[8px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 ml-1">Quant / %</label>
                            <input
                              type="number"
                              step="0.001"
                              value={item.quantity || ''}
                              onChange={(e) => {
                                const newComp = [...(editingItem?.metadata?.composition || [])];
                                newComp[index] = { ...newComp[index], quantity: parseFloat(e.target.value) };
                                setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null);
                              }}
                              className={\`w-full px-3 py-3 rounded-xl font-black text-[10px] text-center outline-none border-2 \${
                                isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-50'
                              }\`}
                            />
                          </div>

                          <div className="col-span-2 flex flex-col gap-1">
                            <label className="text-[8px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 ml-1">Tipo</label>
                            <button
                              type="button"
                              onClick={() => {
                                const newComp = [...(editingItem?.metadata?.composition || [])];
                                newComp[index] = { ...newComp[index], type: item.type === 'weight' ? 'percentage' : 'weight' };
                                setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null);
                              }}
                              className={\`w-full py-3 rounded-xl font-black text-[8px] uppercase tracking-widest border-2 transition-all \${
                                item.type === 'percentage' 
                                  ? 'bg-amber-500 border-amber-600 text-white' 
                                  : 'bg-indigo-500 border-indigo-600 text-white'
                              }\`}
                            >
                              {item.type === 'percentage' ? '%' : 'GR'}
                            </button>
                          </div>

                          <div className="col-span-1 flex items-end pb-1">
                            <button
                              type="button"
                              onClick={() => {
                                const newComp = (editingItem?.metadata?.composition || []).filter((_, i) => i !== index);
                                setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, composition: newComp } } : null);
                              }}
                              className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {(editingItem?.metadata?.composition || []).length === 0 && (
                        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhum material adicionado</p>
                        </div>
                      )}
                    </div>
                 </div>

                 {/* Aggregated Services Card */}
                 <div className={\`p-6 rounded-[2rem] border-2 \${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}\`}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Hammer size={18} className="text-emerald-500" />
                          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Serviços Agregados</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Mão de obra ou processos terceirizados para esta matriz</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const currentServices = editingItem?.metadata?.extraServices || [];
                          setEditingItem(prev => prev ? {
                            ...prev,
                            metadata: {
                              ...prev.metadata,
                              extraServices: [...currentServices, { name: '', cost: 0 }]
                            }
                          } : null);
                        }}
                        className="p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <div className="flex flex-col gap-3">
                      {(editingItem?.metadata?.extraServices || []).map((service, index) => (
                        <div key={index} className={\`grid grid-cols-12 gap-3 p-4 rounded-2xl border-2 \${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}\`}>
                          <div className="col-span-7 flex flex-col gap-1">
                            <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome do Serviço</label>
                            <input 
                              type="text"
                              value={service.name}
                              onChange={(e) => {
                                const newServices = [...(editingItem?.metadata?.extraServices || [])];
                                newServices[index] = { ...newServices[index], name: e.target.value.toUpperCase() };
                                setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: newServices } } : null);
                              }}
                              placeholder="EX: PINTURA"
                              className={\`w-full px-4 py-3 rounded-xl font-bold text-[10px] uppercase outline-none border-2 transition-all \${
                                isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-50 text-slate-900 focus:border-emerald-600'
                              }\`}
                            />
                          </div>
                          <div className="col-span-4 flex flex-col gap-1">
                            <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Valor (R$)</label>
                            <input 
                              type="number"
                              step="0.01"
                              value={service.cost || ''}
                              onChange={(e) => {
                                const newServices = [...(editingItem?.metadata?.extraServices || [])];
                                newServices[index] = { ...newServices[index], cost: parseFloat(e.target.value) };
                                setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: newServices } } : null);
                              }}
                              placeholder="0,00"
                              className={\`w-full px-4 py-3 rounded-xl font-black text-[10px] text-center outline-none border-2 \${
                                isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-50'
                              }\`}
                            />
                          </div>
                          <div className="col-span-1 flex items-end pb-1">
                            <button
                              type="button"
                              onClick={() => {
                                const newServices = (editingItem?.metadata?.extraServices || []).filter((_, i) => i !== index);
                                setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, extraServices: newServices } } : null);
                              }}
                              className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {(editingItem?.metadata?.extraServices || []).length === 0 && (
                        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhum serviço agregado</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Color Variations and Sub-Ref */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                       <Palette size={18} className="text-indigo-500" />
                       <span className="text-xs font-black uppercase tracking-widest text-slate-500">Cores Disponíveis e Sub-Ref</span>
                    </div>
                    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                       {(colors || []).map(color => {
                          const variation = (editingItem?.metadata?.colorVariations || []).find((cv) => cv.colorId === color.id);
                          const isSelected = !!variation;

                          return (
                            <div key={color.id} className={\`p-3 rounded-2xl border-2 flex items-center justify-between transition-all \${isSelected ? 'border-indigo-500/30 bg-indigo-500/5' : isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-50 bg-slate-50/50'}\`}>
                               <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-xl shadow-sm border border-black/10" style={{ backgroundColor: color.hex }} />
                                 <span className={\`text-[10px] font-black uppercase tracking-widest \${isDarkMode ? 'text-white' : 'text-slate-900'}\`}>{color.name}</span>
                               </div>
                               <div className="flex items-center gap-2">
                                  {isSelected && (
                                    <input 
                                      type="text"
                                      placeholder="SUB-REF"
                                      value={variation.subRef || ''}
                                      onChange={(e) => {
                                        const subRef = e.target.value.toUpperCase();
                                        setEditingItem(prev => {
                                          if (!prev) return null;
                                          const variations = [...(prev.metadata?.colorVariations || [])];
                                          const idx = variations.findIndex((cv) => cv.colorId === color.id);
                                          variations[idx] = { ...variations[idx], subRef };
                                          return { ...prev, metadata: { ...prev.metadata, colorVariations: variations } };
                                        });
                                      }}
                                      className={\`w-24 px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest outline-none border-2 \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-100'}\`}
                                    />
                                  )}
                                  <button 
                                    type="button"
                                    title={isSelected ? "Desmarcar Cor" : "Selecionar Cor"}
                                    aria-label={isSelected ? \`Remover cor \${color.name}\` : \`Adicionar cor \${color.name}\`}
                                    onClick={() => {
                                      setEditingItem(prev => {
                                        if (!prev) return null;
                                        const variations = [...(prev.metadata?.colorVariations || [])];
                                        const idx = variations.findIndex((cv) => cv.colorId === color.id);
                                        if (idx >= 0) variations.splice(idx, 1);
                                        else variations.push({ colorId: color.id, subRef: '' });
                                        return { ...prev, metadata: { ...prev.metadata, colorVariations: variations } };
                                      });
                                    }}
                                    className={\`p-2 rounded-xl transition-all \${isSelected ? 'text-indigo-500' : 'text-slate-300'}\`}
                                  >
                                    {isSelected ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                  </button>
                               </div>
                            </div>
                          );
                       })}
                    </div>
                  </div>
               </div>
            ) : type === 'MATERIAL' ? (
               // Specialized Form for Insumos
               <div className="flex flex-col gap-6">
                 {/* Top Row: Master Category & Reference */}
                 <div className="grid grid-cols-2 gap-4">
                   <div className="flex flex-col gap-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Categoria Mestre *</label>
                     <select 
                       title="Categoria Mestre"
                       aria-label="Selecionar categoria mestre do insumo"
                       value={editingItem?.metadata?.masterCategory || ''}
                       onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, masterCategory: e.target.value } } : null)}
                       required
                       className={\`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 \${
                         isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'
                       }\`}
                     >
                       <option value="">SELECIONAR...</option>
                       {supplyCategoryNames.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                     </select>
                   </div>
                   <div className="flex flex-col gap-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Referência / Código</label>
                     <input 
                       type="text"
                       value={editingItem?.metadata?.reference || ''}
                       onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, reference: e.target.value.toUpperCase() } } : null)}
                       className={\`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 \${
                         isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'
                       }\`}
                     />
                   </div>
                 </div>

                 {/* Material Name */}
                 <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Nome do Material / Descrição *</label>
                   <input 
                     type="text"
                     value={editingItem?.name || ''}
                     onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value.toUpperCase() } : null)}
                     required
                     className={\`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 \${
                       isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'
                     }\`}
                   />
                 </div>

                 {/* Flow Tag & Supplier */}
                 <div className="grid grid-cols-2 gap-4">
                   <div className="flex flex-col gap-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Flow Tag (Estágio)</label>
                     <select 
                       title="Flow Tag"
                       aria-label="Selecionar estágio do fluxo"
                       value={editingItem?.metadata?.flowTagId || ''}
                       onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, flowTagId: e.target.value } } : null)}
                       className={\`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 \${
                         isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'
                       }\`}
                     >
                       <option value="">NENHUMA...</option>
                       {flowTags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                     </select>
                   </div>
                   <div className="flex flex-col gap-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Fornecedor Principal</label>
                     <select 
                       title="Fornecedor"
                       aria-label="Selecionar fornecedor principal"
                       value={editingItem?.metadata?.supplierId || ''}
                       onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, supplierId: e.target.value } } : null)}
                       className={\`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 \${
                         isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'
                       }\`}
                     >
                       <option value="">NENHUM...</option>
                       {suppliers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                     </select>
                   </div>
                 </div>

                 {/* Unit & Base Cost */}
                 <div className="grid grid-cols-2 gap-4">
                   <div className="flex flex-col gap-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Unidade *</label>
                     <select 
                       title="Unidade de Medida"
                       aria-label="Selecionar unidade de medida"
                       value={editingItem?.metadata?.unitId || ''}
                       onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, unitId: e.target.value } } : null)}
                       required
                       className={\`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 \${
                         isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'
                       }\`}
                     >
                       <option value="">SELECIONAR...</option>
                       {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                     </select>
                   </div>
                   <div className="flex flex-col gap-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 ml-2">Custo Base (Média)</label>
                     <input 
                       type="number"
                       step="0.01"
                       value={editingItem?.metadata?.baseCost || ''}
                       onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, baseCost: Number(e.target.value) } } : null)}
                       placeholder="0,00"
                       className={\`w-full px-6 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest outline-none transition-all border-2 \${
                         isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-100'
                       }\`}
                     />
                   </div>
                 </div>

                 {/* Colors Integration */}
                 <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Cores Disponíveis</label>
                    <div className={\`p-4 rounded-2xl border-2 flex flex-wrap gap-2 \${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}\`}>
                       {colors.map(color => {
                         const isSelected = (editingItem?.metadata?.colorIds || []).includes(color.id);
                         return (
                           <button
                             key={color.id}
                             type="button"
                             title={isSelected ? "Remover Cor" : "Adicionar Cor"}
                             aria-label={isSelected ? \`Remover cor \${color.name}\` : \`Adicionar cor \${color.name}\`}
                             onClick={() => {
                               const currentIds = editingItem?.metadata?.colorIds || [];
                               const newIds = isSelected ? currentIds.filter(id => id !== color.id) : [...currentIds, color.id];
                               setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, colorIds: newIds } } : null);
                             }}
                             className={\`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all \${
                               isSelected 
                                 ? 'bg-indigo-600 text-white' 
                                 : isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-400 border border-slate-100'
                             }\`}
                           >
                             {color.name}
                           </button>
                         );
                       })}
                       {colors.length === 0 && <p className="text-[8px] text-slate-400 font-bold uppercase py-2">Nenhuma cor cadastrada no catálogo</p>}
                    </div>
                 </div>
               </div>
            ) : type === 'TOOL' ? (
               // Specialized Form for Facas
               <div className="flex flex-col gap-6">
                 {/* Image Upload Area */}
                 <div className="flex flex-col items-center gap-4">
                   <div className={\`relative w-32 h-32 rounded-[2.5rem] border-2 border-dashed overflow-hidden flex items-center justify-center \${isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-slate-50'}\`}>
                     {editingItem?.imageUrl ? (
                       <>
                         <img src={editingItem.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                         <button 
                           type="button"
                           onClick={() => setEditingItem(prev => prev ? { ...prev, imageUrl: '' } : null)}
                           className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg"
                         >
                           <X size={12} />
                         </button>
                       </>
                     ) : (
                       <button 
                         type="button"
                         onClick={() => fileInputRef.current?.click()}
                         className="flex flex-col items-center gap-2 text-slate-400"
                       >
                         <Camera size={24} />
                         <span className="text-[9px] font-bold uppercase tracking-widest">Adicionar Foto</span>
                       </button>
                     )}
                   </div>
                   <input 
                     type="file"
                     ref={fileInputRef}
                     onChange={handleImageUpload}
                     accept="image/*"
                     className="hidden"
                   />
                 </div>

                 <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Referência da Faca *</label>
                   <input 
                     type="text"
                     value={editingItem?.name || ''}
                     onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                     placeholder="Ex: F-TENIS-CYBER"
                     className={\`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'} border-2\`}
                     required
                   />
                 </div>

                 <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Conjugação (Pares/Batida) *</label>
                   <input 
                     type="number"
                     value={editingItem?.metadata?.conjugation || ''}
                     onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, conjugation: Number(e.target.value) } } : null)}
                     placeholder="1"
                     className={\`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'} border-2\`}
                     required
                   />
                 </div>

                 {/* Numerations Config */}
                 <div className="flex flex-col gap-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Configurar Numerações da Faca</label>
                    <div className="flex gap-2">
                       <input 
                         type="text"
                         value={newSize}
                         onChange={(e) => setNewSize(e.target.value)}
                         placeholder="Ex: 37"
                         className={\`flex-1 px-6 py-4 rounded-2xl font-bold outline-none transition-all border-2 \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}\`}
                         onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())}
                       />
                       <button 
                         type="button"
                         onClick={addSize}
                         className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 flex items-center justify-center border border-slate-200 dark:border-slate-700"
                       >
                         <Plus size={24} />
                       </button>
                    </div>

                    <div className="p-6 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                       {(editingItem?.metadata?.sizes || []).map(size => (
                         <div key={size} className={\`px-4 py-2 rounded-xl flex items-center gap-2 border shadow-sm \${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}\`}>
                           <span className="text-xs font-black">{size}</span>
                           <button 
                             type="button"
                             onClick={() => removeSize(size)}
                             className="text-slate-300 hover:text-red-500 transition-colors"
                           >
                             <X size={14} />
                           </button>
                         </div>
                       ))}
                       {(editingItem?.metadata?.sizes || []).length === 0 && (
                         <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mx-auto py-2">Nenhuma numeração</p>
                       )}
                    </div>
                 </div>

                 {/* Area Matrix */}
                 {(editingItem?.metadata?.sizes || []).length > 0 && (
                   <div className={\`p-6 rounded-[2.5rem] flex flex-col gap-6 \${isDarkMode ? 'bg-slate-800/40' : 'bg-slate-50/50'}\`}>
                     <div className="flex items-center gap-3 px-2">
                       <Target size={18} className="text-slate-400" />
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Matriz de Área (M²)</h4>
                     </div>
                     
                     <div className="grid grid-cols-4 gap-4">
                        {editingItem?.metadata?.sizes.map(size => (
                          <div key={size} className="flex flex-col gap-2 items-center">
                             <span className="text-[9px] font-black text-slate-400 uppercase">{size}</span>
                             <input 
                               type="number"
                               step="0.01"
                               value={editingItem.metadata.sizeAreas?.[size] || ''}
                               onChange={(e) => updateArea(size, Number(e.target.value))}
                               placeholder="0,00"
                               className={\`w-full px-2 py-3 rounded-xl font-bold text-xs text-center outline-none border-2 transition-all \${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}\`}
                             />
                          </div>
                        ))}
                     </div>
                   </div>
                 )}
               </div>
            ) : type === 'INFESTO' ? (
               // Specialized Form for Infesto
               <div className="flex flex-col gap-6">
                 <div className="flex flex-col gap-2 text-center">
                   <div className={\`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 \${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}\`}>
                     <Layers size={32} />
                   </div>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                     Configuração de Camadas para<br/>Corte e Produção
                   </p>
                 </div>

                 <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Infesto *</label>
                   <input 
                     type="text"
                     value={editingItem?.name || ''}
                     onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                     placeholder="Ex: COURO PADRÃO"
                     className={\`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2\`}
                     required
                   />
                 </div>

                 <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Quantidade de Camadas *</label>
                   <input 
                     type="number"
                     value={editingItem?.metadata?.layers || ''}
                     onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, layers: Number(e.target.value) } } : null)}
                     placeholder="Ex: 4"
                     className={\`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2\`}
                     required
                   />
                 </div>
               </div>
            ) : type === 'DEADLINE' ? (
               // Specialized Form for Deadline
               <div className="flex flex-col gap-6">
                 <div className="flex flex-col gap-2 text-center">
                   <div className={\`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 \${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}\`}>
                     <CalendarClock size={32} />
                   </div>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                     Definição de Prazos e SLA<br/>para Ordens de Produção
                   </p>
                 </div>

                 <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Prazo *</label>
                   <input 
                     type="text"
                     value={editingItem?.name || ''}
                     onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                     placeholder="Ex: URGENTE, PADRÃO..."
                     className={\`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2\`}
                     required
                   />
                 </div>

                 <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Prazo em Dias *</label>
                   <input 
                     type="number"
                     value={editingItem?.metadata?.days || ''}
                     onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, days: Number(e.target.value) } } : null)}
                     placeholder="Ex: 7"
                     className={\`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2\`}
                     required
                   />
                 </div>
               </div>
            ) : type === 'PACKAGING' ? (
               // Specialized Form for Packaging/Grades
               <div className="flex flex-col gap-6">
                 <div className="flex flex-col gap-2 text-center">
                   <div className={\`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 \${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}\`}>
                     <Grid3X3 size={32} />
                   </div>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                     Configuração de Grades e<br/>Tamanhos para Embalagens
                   </p>
                 </div>

                 <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome do Padrão *</label>
                   <input 
                     type="text"
                     value={editingItem?.name || ''}
                     onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                     placeholder="Ex: FEMININO 33-40"
                     className={\`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2\`}
                     required
                   />
                 </div>

                 <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Tipo de Grade</label>
                   <div className={\`flex gap-2 p-1.5 rounded-2xl border-2 transition-all \${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}\`}>
                     <button 
                       type="button"
                       onClick={() => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, mode: 'FIXED' } } : null)}
                       className={\`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all \${(!editingItem?.metadata?.mode || editingItem?.metadata?.mode === 'FIXED') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-500'}\`}
                     >
                       Grade Fixa
                     </button>
                     <button 
                       type="button"
                       onClick={() => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, mode: 'FREE' } } : null)}
                       className={\`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all \${editingItem?.metadata?.mode === 'FREE' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-500'}\`}
                     >
                       Grade Livre
                     </button>
                   </div>
                 </div>

                 <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Capacidade Total (Pares) *</label>
                   <input 
                     type="number"
                     value={editingItem?.metadata?.capacity || ''}
                     onChange={(e) => setEditingItem(prev => prev ? { ...prev, metadata: { ...prev.metadata, capacity: Number(e.target.value) } } : null)}
                     placeholder="Ex: 12"
                     className={\`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2\`}
                     required
                   />
                 </div>

                 {editingItem?.metadata?.mode === 'FREE' ? null : (
                   /* Grade Fixa mode */
                   <div className="flex flex-col gap-6">
                     <div className="flex flex-col gap-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Adicionar Numerações</label>
                        <div className="flex gap-2">
                           <input 
                             type="text"
                             value={newSize}
                             onChange={(e) => setNewSize(e.target.value)}
                             placeholder="Ex: 37"
                             className={\`flex-1 px-6 py-4 rounded-2xl font-bold outline-none transition-all border-2 \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}\`}
                             onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())}
                           />
                           <button 
                             type="button"
                             onClick={addSize}
                             className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                           >
                             <Plus size={24} strokeWidth={3} />
                           </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                           {(editingItem?.metadata?.sizes || []).map(size => (
                             <div key={size} className={\`px-4 py-2 rounded-xl flex items-center gap-2 border shadow-sm \${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}\`}>
                               <span className="text-xs font-black">{size}</span>
                               <button 
                                 type="button"
                                 onClick={() => removeSize(size)}
                                 className="text-slate-300 hover:text-red-500 transition-colors"
                               >
                                 <X size={14} />
                               </button>
                             </div>
                           ))}
                           {(editingItem?.metadata?.sizes || []).length === 0 && (
                             <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mx-auto py-2">Nenhuma numeração</p>
                           )}
                        </div>
                     </div>

                     {/* Quantity Matrix */}
                     {(editingItem?.metadata?.sizes || []).length > 0 && (
                       <div className={\`p-6 rounded-[2.5rem] flex flex-col gap-6 \${isDarkMode ? 'bg-slate-800/40' : 'bg-slate-50/50'}\`}>
                          <div className="flex items-center justify-between px-2">
                             <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Distribuição da Grade</h4>
                             <span className={\`text-[10px] font-black uppercase tracking-widest \${
                               Object.values(editingItem?.metadata?.sizeQuantities || {}).reduce((a, b) => a + (Number(b) || 0), 0) === (editingItem?.metadata?.capacity || 0)
                                 ? 'text-emerald-500'
                                 : 'text-red-500'
                             }\`}>
                                Total: {Object.values(editingItem?.metadata?.sizeQuantities || {}).reduce((a, b) => a + (Number(b) || 0), 0)} / {editingItem?.metadata?.capacity || 0}
                             </span>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-4">
                             {editingItem?.metadata?.sizes.map(size => (
                               <div key={size} className="flex flex-col gap-2 items-center">
                                 <span className="text-[9px] font-black text-slate-400 uppercase">{size}</span>
                                 <input 
                                   type="number"
                                   value={editingItem?.metadata?.sizeQuantities?.[size] || ''}
                                   onChange={(e) => {
                                     const qty = Number(e.target.value);
                                     setEditingItem(prev => ({
                                       ...prev!,
                                       metadata: {
                                         ...prev!.metadata,
                                         sizeQuantities: { ...prev!.metadata!.sizeQuantities, [size]: qty }
                                       }
                                     }));
                                   }}
                                   placeholder="0"
                                   className={\`w-full px-2 py-3 rounded-xl font-bold text-xs text-center outline-none border-2 transition-all \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-600'}\`}
                                 />
                               </div>
                             ))}
                          </div>
                       </div>
                     )}
                   </div>
                 )}
               </div>
            ) : (
               // Generic Form for other types
               <div className="flex flex-col gap-6">
                 <div className="flex flex-col gap-2 text-center">
                   <div className={\`w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center mb-2 \${isDarkMode ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}\`}>
                     {icon}
                   </div>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                     Preencha os dados abaixo para<br/>registrar em {label}
                   </p>
                 </div>

                 <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome / Sigla</label>
                   <input 
                     type="text"
                     value={editingItem?.name || ''}
                     onChange={(e) => setEditingItem(prev => prev ? { ...prev, name: e.target.value } : null)}
                     placeholder="Ex: UN, KG, MT..."
                     className={\`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2\`}
                     required
                   />
                 </div>
                 <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Descrição Completa</label>
                   <input 
                     type="text"
                     value={editingItem?.description || ''}
                     onChange={(e) => setEditingItem(prev => prev ? { ...prev, description: e.target.value } : null)}
                     placeholder="Ex: Unidade, Quilograma, Metro..."
                     className={\`w-full px-6 py-4 rounded-2xl font-bold transition-all outline-none text-center \${isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-600'} border-2\`}
                   />
                 </div>
               </div>
            )}
            
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-5 rounded-[2rem] bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  SALVANDO...
                </>
              ) : (
                <>
                  <Check size={18} strokeWidth={3} />
                  {editingItem?.id ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                </>
              )}
            </button>
          </form>\`;

const startLine = content.findIndex(l => l.includes('<form onSubmit={handleSave}'));
const endLine = content.findIndex(l => l.includes('</Modal>'));

if (startLine !== -1 && endLine !== -1) {
  content.splice(startLine, endLine - startLine, newForm);
  fs.writeFileSync(path, content.join('\\n'));
  console.log('SUCCESS');
} else {
  console.log('FAILURE', startLine, endLine);
}


              {/* Mapeamento de Grade de Solados — Card dedicado */}
              <div className={`mt-6 rounded-[2rem] border-2 overflow-hidden ${isDarkMode ? 'border-emerald-500/20' : 'border-emerald-100'}`}>
                {/* Header clicável */}
                <button
                  type="button"
                  onClick={() => setShowSoleMapping(!showSoleMapping)}
                  className={`w-full flex items-center justify-between px-6 py-4 text-left transition-colors ${showSoleMapping ? (isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50') : (isDarkMode ? 'bg-slate-800/20' : 'bg-emerald-50/30')}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${showSoleMapping ? 'bg-emerald-500 text-white shadow-lg' : isDarkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                      <Footprints size={18} />
                    </div>
                    <div>
                      <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        Mapeamento de Solados por Numeração
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {Object.values(soleMapping).some(v => v)
                          ? `${Object.keys(soleMapping).filter(k => soleMapping[k]).length} numerações mapeadas · toque para editar`
                          : 'Vincule cada tamanho cabedal ao número da sola'}
                      </p>
                    </div>
                  </div>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${showSoleMapping ? 'bg-emerald-500 text-white' : isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                    <ChevronRight size={14} className={`transition-transform ${showSoleMapping ? 'rotate-[270deg]' : 'rotate-90'}`} />
                  </div>
                </button>

                {/* Conteúdo expandido */}
                {showSoleMapping && (
                  <div className={`px-6 pb-6 pt-4 border-t-2 animate-in fade-in slide-in-from-top-2 duration-200 ${isDarkMode ? 'border-emerald-500/10 bg-slate-900/30' : 'border-emerald-100 bg-white/50'}`}>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-5 leading-relaxed">
                      Para cada tamanho de cabedal, informe o número equivalente de sola/forma usado na produção.
                      <span className="text-emerald-600 dark:text-emerald-400 font-black"> Ex: cabedais 33 e 34 usam a sola 33/34.</span>
                    </p>

                    {grids.find(g => g.id === productionGridId)?.sizes?.length ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {grids.find(g => g.id === productionGridId)!.sizes.map(cabedalSize => (
                          <div key={cabedalSize} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${isDarkMode ? 'bg-slate-900 border-slate-800 focus-within:border-emerald-500' : 'bg-white border-slate-100 shadow-sm focus-within:border-emerald-400'}`}>
                            <div className="text-center">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Cabedal</span>
                              <span className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{cabedalSize}</span>
                            </div>
                            <div className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600">
                              <ArrowUpDown size={13} />
                            </div>
                            <div className={`w-full flex items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 focus-within:border-emerald-500' : 'bg-emerald-50 border-emerald-100 focus-within:border-emerald-400'}`}>
                              <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest shrink-0">Sola</span>
                              <input
                                type="text"
                                value={soleMapping[cabedalSize] || ''}
                                onChange={(e) => setSoleMapping({ ...soleMapping, [cabedalSize]: e.target.value })}
                                className="w-full bg-transparent border-none text-right text-xs font-black text-slate-900 dark:text-white outline-none p-0"
                                placeholder="Num."
                                title={`Numeração da sola para o cabedal ${cabedalSize}`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                        Selecione uma Grade de Produção acima para mapear as numerações.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

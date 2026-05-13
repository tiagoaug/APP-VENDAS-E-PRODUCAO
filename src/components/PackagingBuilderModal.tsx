import { useState, useMemo } from 'react';
import { X, Package, CheckCircle2, AlertCircle, Warehouse, Layers } from 'lucide-react';
import { ProductionConfigItem, Grid } from '../types';

interface PackagingBuilderResult {
  pkgId: string;
  breakdown: Record<string, number>;   // pares por tamanho por embalagem
  fromStock: Record<string, number>;    // pares a abater do estoque
}

interface PackagingBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: PackagingBuilderResult) => void;
  productName: string;
  variationName: string;
  packagingItems: ProductionConfigItem[];
  productGrid: Grid | null;               // grade FORMA do produto (para as numerações)
  stockPerSize: Record<string, number>;   // estoque disponível por tamanho (varejo)
  stockGrades?: number;                  // estoque de grades completas (atacado)
  orderQuantity?: number;                // qtd de grades pedidas (para limitar abate)
  initialPkgId?: string;
  initialBreakdown?: Record<string, number>;
  initialFromStock?: Record<string, number>;
  isDarkMode: boolean;
}

export default function PackagingBuilderModal({
  isOpen, onClose, onConfirm,
  productName, variationName,
  packagingItems, productGrid,
  stockPerSize,
  stockGrades = 0,
  orderQuantity,
  initialPkgId = '', initialBreakdown = {}, initialFromStock = {},
  isDarkMode
}: PackagingBuilderModalProps) {
  const [selectedPkgId, setSelectedPkgId] = useState(initialPkgId);
  const [breakdown, setBreakdown] = useState<Record<string, number>>(initialBreakdown);
  const [fromStock, setFromStock] = useState<Record<string, number>>(initialFromStock);

  // Para atacado: input único de grades a abater
  const initialGradesToAbate = useMemo(() => {
    if (stockGrades <= 0 || !initialFromStock || !initialBreakdown) return 0;
    // Detecta quantas grades foram inicialmente alocadas (usa o primeiro tamanho com breakdown > 0)
    const firstSize = Object.keys(initialBreakdown).find(s => (initialBreakdown[s] || 0) > 0);
    if (!firstSize) return 0;
    const bdQty = initialBreakdown[firstSize] || 0;
    if (bdQty === 0) return 0;
    const stockQty = initialFromStock[firstSize] || 0;
    return Math.round(stockQty / bdQty);
  }, [stockGrades, initialFromStock, initialBreakdown]);
  const [gradesToAbate, setGradesToAbate] = useState(initialGradesToAbate);

  const isWholesaleStock = stockGrades > 0;

  const selectedPkg = useMemo(
    () => packagingItems.find(p => p.id === selectedPkgId),
    [packagingItems, selectedPkgId]
  );

  const isFixed = selectedPkg?.metadata?.mode !== 'FREE';
  const capacity: number = selectedPkg?.metadata?.capacity || 0;

    // Sizes: from packaging if defined, plus product grid, plus any sizes present in current breakdown or stock
    const sizes = useMemo(() => {
      const sSet = new Set<string>();
      
      // 1. Tamanhos do padrão de embalagem selecionado (Metadados e Quantidades)
      if (selectedPkg?.metadata?.sizes?.length) {
        (selectedPkg.metadata.sizes as string[]).forEach(sz => sSet.add(String(sz).trim()));
      }
      if (selectedPkg?.metadata?.sizeQuantities) {
        Object.keys(selectedPkg.metadata.sizeQuantities).forEach(sz => sSet.add(String(sz).trim()));
      }

      // 2. Grade do produto (Crucial para mostrar a grade completa 38-43)
      if (productGrid?.sizes?.length) {
        productGrid.sizes.forEach(sz => sSet.add(String(sz).trim()));
      }

      // 3. Todos os tamanhos presentes nos estados de trabalho (breakdown e fromStock)
      Object.keys(breakdown).forEach(sz => sSet.add(String(sz).trim()));
      Object.keys(fromStock).forEach(sz => sSet.add(String(sz).trim()));

      // 4. Tamanhos com estoque disponível
      Object.keys(stockPerSize).forEach(sz => sSet.add(String(sz).trim()));

      return Array.from(sSet).sort((a, b) => {
        const na = parseFloat(a.replace(',', '.'));
        const nb = parseFloat(b.replace(',', '.'));
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b), undefined, { numeric: true });
      });
    }, [selectedPkg, productGrid, breakdown, stockPerSize, fromStock]);

  const totalBreakdown = useMemo(
    () => Object.values(breakdown).reduce((a, b) => a + b, 0),
    [breakdown]
  );

  // Para atacado: fromStock calculado por grade × breakdown por tamanho
  const fromStockEffective = useMemo(() => {
    if (!isWholesaleStock) return fromStock;
    const computed: Record<string, number> = {};
    sizes.forEach(size => { 
      const s = String(size).trim();
      computed[s] = (breakdown[s] || 0) * gradesToAbate; 
    });
    return computed;
  }, [isWholesaleStock, gradesToAbate, breakdown, sizes, fromStock]);

  const totalFromStock = useMemo(
    () => Object.values(fromStockEffective).reduce((a, b) => a + b, 0),
    [fromStockEffective]
  );

  const maxGradesToAbate = useMemo(() => {
    const maxByStock = stockGrades;
    if (orderQuantity !== undefined) return Math.min(maxByStock, orderQuantity);
    return maxByStock;
  }, [stockGrades, orderQuantity]);

  const handleSelectPkg = (pkgId: string) => {
    setSelectedPkgId(pkgId);
    setFromStock({});
    setGradesToAbate(0);
    const pkg = packagingItems.find(p => p.id === pkgId);
    if (!pkg) { setBreakdown({}); return; }
    const fixed = pkg.metadata?.mode !== 'FREE';
    const sizeQtys: Record<string, number> = pkg.metadata?.sizeQtys || pkg.metadata?.sizeQuantities || {};
    
    // Coleta todos os tamanhos relevantes para inicializar o breakdown
    const sSet = new Set<string>();
    if (pkg.metadata?.sizes?.length) {
      (pkg.metadata.sizes as string[]).forEach(sz => sSet.add(String(sz).trim()));
    }
    if (productGrid?.sizes?.length) {
      productGrid.sizes.forEach(sz => sSet.add(String(sz).trim()));
    }
    // Adiciona tamanhos que estão nas quantidades do padrão mas talvez não na lista de tamanhos
    Object.keys(sizeQtys).forEach(sz => sSet.add(String(sz).trim()));

    const bd: Record<string, number> = {};
    sSet.forEach(s => { 
      // Busca no original (pode ter espaço) ou no trimmed
      const originalKey = Object.keys(sizeQtys).find(k => k.trim() === s) || s;
      bd[s] = fixed ? (sizeQtys[originalKey] || 0) : 0; 
    });
    setBreakdown(bd);
  };

  const setBreakdownSize = (size: string, val: number) => {
    const s = String(size).trim();
    const capped = capacity > 0 ? Math.min(val, capacity - totalBreakdown + (breakdown[s] || 0)) : val;
    const safeVal = Math.max(0, capped);
    setBreakdown(prev => ({ ...prev, [s]: safeVal }));
    setFromStock(prev => ({ ...prev, [s]: Math.min(prev[s] || 0, safeVal) }));
  };

  const setFromStockSize = (size: string, val: number) => {
    const s = String(size).trim();
    const maxAlloc = Math.min(breakdown[s] || 0, stockPerSize[s] || 0);
    setFromStock(prev => ({ ...prev, [s]: Math.max(0, Math.min(val, maxAlloc)) }));
  };

  const canConfirm = selectedPkgId && totalBreakdown > 0 && (capacity === 0 || totalBreakdown <= capacity);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>

        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
              <Package size={17} className="text-white" />
            </div>
            <div>
              <p className={`text-xs font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                Configurar Embalagem
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {productName} — {variationName}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} title="Fechar" aria-label="Fechar" className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          {/* Seletor de padrão */}
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">Padrão de Embalagem</label>
            <select
              value={selectedPkgId}
              onChange={e => handleSelectPkg(e.target.value)}
              title="Padrão de embalagem"
              aria-label="Padrão de embalagem"
              className={`w-full px-4 py-3 rounded-xl font-black text-[11px] outline-none border-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
            >
              <option value="">Selecione o padrão…</option>
              {packagingItems.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.metadata?.capacity || 0} pares {p.metadata?.mode === 'FREE' ? '(Livre)' : '(Fixo)'}
                </option>
              ))}
            </select>
          </div>

          {/* Estoque de grades disponíveis (atacado) */}
          {isWholesaleStock && selectedPkg && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isDarkMode ? 'bg-emerald-900/20 border border-emerald-800/40' : 'bg-emerald-50 border border-emerald-200'}`}>
              <Warehouse size={16} className="text-emerald-500 shrink-0" />
              <div>
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Estoque disponível</p>
                <p className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {stockGrades} {stockGrades === 1 ? 'grade' : 'grades'} completas
                  {orderQuantity !== undefined && (
                    <span className="text-[9px] font-bold text-slate-400 ml-2">
                      (pedido: {orderQuantity} {orderQuantity === 1 ? 'grade' : 'grades'})
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {selectedPkg && sizes.length > 0 && (
            <>
              {/* Indicador modo */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                isFixed
                  ? isDarkMode ? 'bg-emerald-900/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                  : isDarkMode ? 'bg-amber-900/20 text-amber-400' : 'bg-amber-50 text-amber-600'
              }`}>
                {isFixed ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                {isFixed ? 'Padrão fixo — distribuição pré-definida' : `Padrão livre — preencha até ${capacity} pares`}
              </div>

              {/* Tabela de tamanhos */}
              <div className={`rounded-2xl border ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                {/* Header da tabela */}
                <div className={`grid gap-px px-3 py-2 border-b ${isWholesaleStock ? 'grid-cols-3' : 'grid-cols-4'} ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                  <span className="text-[8px] font-black text-slate-400 uppercase">Tamanho</span>
                  <span className="text-[8px] font-black text-slate-400 uppercase text-center">Pares na Emb.</span>
                  {!isWholesaleStock && (
                    <span className="text-[8px] font-black text-emerald-500 uppercase text-center flex items-center justify-center gap-1">
                      <Warehouse size={10} /> Estoque
                    </span>
                  )}
                  <span className={`text-[8px] font-black uppercase text-center ${isWholesaleStock ? 'text-emerald-500' : 'text-sky-500'}`}>
                    {isWholesaleStock ? 'Abater Grade' : 'Usar Estoque'}
                  </span>
                </div>

                {/* Linhas por tamanho */}
                {sizes.map(size => {
                  const inBreakdown = breakdown[size] || 0;
                  const stock = stockPerSize[size] || 0;
                  const alloc = isWholesaleStock ? (fromStockEffective[size] || 0) : (fromStock[size] || 0);
                  const toProd = inBreakdown - alloc;

                  return (
                    <div key={size} className={`grid gap-2 px-3 py-1.5 items-center border-t ${isWholesaleStock ? 'grid-cols-3' : 'grid-cols-4'} ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-50 bg-white'}`}>
                      {/* Tamanho */}
                      <span className={`text-[11px] font-black ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{size}</span>

                      {/* Pares na embalagem */}
                      <div className="flex justify-center">
                        {isFixed ? (
                          <span className="text-sm font-black text-violet-600 dark:text-violet-400">{inBreakdown}</span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            value={inBreakdown || ''}
                            placeholder="0"
                            title={`Pares tamanho ${size}`}
                            aria-label={`Pares tamanho ${size}`}
                            onChange={e => setBreakdownSize(size, parseInt(e.target.value) || 0)}
                            className={`w-14 text-center font-black text-sm rounded-lg px-1 py-1 outline-none border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-violet-50 border-violet-200 text-violet-800'}`}
                          />
                        )}
                      </div>

                      {/* Estoque disponível (varejo apenas) */}
                      {!isWholesaleStock && (
                        <span className={`text-[11px] font-black text-center ${stock > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>{stock}</span>
                      )}

                      {/* Abater do estoque */}
                      <div className="flex justify-center">
                        {isWholesaleStock ? (
                          /* Atacado: valor calculado readonly */
                          <span className={`text-[12px] font-black text-center ${alloc > 0 ? 'text-emerald-500' : isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>
                            {alloc > 0 ? alloc : '—'}
                          </span>
                        ) : stock > 0 && inBreakdown > 0 ? (
                          <input
                            type="number"
                            min={0}
                            max={Math.min(inBreakdown, stock)}
                            value={alloc || ''}
                            placeholder="0"
                            title={`Abater tamanho ${size} do estoque`}
                            aria-label={`Abater ${size} do estoque`}
                            onChange={e => setFromStockSize(size, parseInt(e.target.value) || 0)}
                            className={`w-14 text-center font-black text-sm rounded-lg px-1 py-1 outline-none border ${isDarkMode ? 'bg-sky-900/30 border-sky-700 text-sky-400' : 'bg-sky-50 border-sky-200 text-sky-700'}`}
                          />
                        ) : (
                          <span className="text-[10px] text-slate-300 font-black">—</span>
                        )}
                      </div>

                      {/* Indicador produção */}
                      {inBreakdown > 0 && (
                        <div className={`col-span-${isWholesaleStock ? 3 : 4} flex items-center gap-3 px-1`}>
                          {alloc > 0 && <span className="text-[8px] font-black text-emerald-500">Estoque: {alloc}</span>}
                          {toProd > 0 && <span className="text-[8px] font-black text-indigo-500">Produzir: {toProd}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Input de grades a abater (atacado) */}
              {isWholesaleStock && isFixed && totalBreakdown > 0 && (
                <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Layers size={11} />
                    Abater grades completas do estoque
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setGradesToAbate(g => Math.max(0, g - 1))}
                        className={`w-9 h-9 rounded-xl font-black text-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
                        aria-label="Diminuir grades"
                      >−</button>
                      <input
                        type="number"
                        min={0}
                        max={maxGradesToAbate}
                        value={gradesToAbate}
                        title="Grades a abater do estoque"
                        aria-label="Grades a abater"
                        onChange={e => setGradesToAbate(Math.max(0, Math.min(maxGradesToAbate, parseInt(e.target.value) || 0)))}
                        className={`w-16 text-center font-black text-lg rounded-xl py-2 outline-none border-2 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-emerald-200 text-emerald-700'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setGradesToAbate(g => Math.min(maxGradesToAbate, g + 1))}
                        className={`w-9 h-9 rounded-xl font-black text-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
                        aria-label="Aumentar grades"
                      >+</button>
                    </div>
                    <div>
                      <p className={`text-[10px] font-black ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
                        {gradesToAbate} de {stockGrades} grades disponíveis
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold">
                        = {totalFromStock} pares abatidos
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Totalizador */}
              <div className="grid grid-cols-3 gap-3">
                <div className={`p-3 rounded-2xl text-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total por Emb.</p>
                  <p className={`text-xl font-black ${capacity > 0 && totalBreakdown > capacity ? 'text-rose-500' : 'text-violet-600 dark:text-violet-400'}`}>{totalBreakdown}</p>
                  {capacity > 0 && <p className="text-[8px] text-slate-400 font-bold">Capacidade: {capacity}</p>}
                </div>
                <div className={`p-3 rounded-2xl text-center ${isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-50'}`}>
                  <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">
                    {isWholesaleStock ? 'Grades do Estoque' : 'Pares do Estoque'}
                  </p>
                  <p className="text-xl font-black text-emerald-500">
                    {isWholesaleStock ? gradesToAbate : totalFromStock}
                  </p>
                  {isWholesaleStock && gradesToAbate > 0 && (
                    <p className="text-[8px] text-emerald-400 font-bold">{totalFromStock} pares</p>
                  )}
                </div>
                <div className={`p-3 rounded-2xl text-center ${isDarkMode ? 'bg-indigo-900/20' : 'bg-indigo-50'}`}>
                  <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1">A Produzir</p>
                  <p className="text-xl font-black text-indigo-600">{Math.max(0, totalBreakdown - totalFromStock)}</p>
                  <p className="text-[8px] text-indigo-400 font-bold">pares p/ unit.</p>
                </div>
              </div>

              {capacity > 0 && totalBreakdown > capacity && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800">
                  <AlertCircle size={14} className="text-rose-500 shrink-0" />
                  <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                    Total excede a capacidade da embalagem ({capacity} pares). Ajuste as quantidades.
                  </p>
                </div>
              )}
            </>
          )}

          {packagingItems.length === 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                Nenhum padrão de embalagem cadastrado. Acesse Produção → Configurações → Padrão Embalagens.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <button
            type="button"
            onClick={() => {
              if (!canConfirm) return;
              onConfirm({ pkgId: selectedPkgId, breakdown, fromStock: fromStockEffective });
            }}
            disabled={!canConfirm}
            className={`w-full py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              canConfirm
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20 hover:bg-violet-700 active:scale-[0.99]'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 size={15} />
            Confirmar — {totalBreakdown} pares
            {isWholesaleStock && gradesToAbate > 0 && ` (${gradesToAbate} grades do estoque)`}
            {!isWholesaleStock && totalFromStock > 0 && ` (${totalFromStock} do estoque)`}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Product, Grid, Person, Variation, Category, CategoryType, SaleType, ProductStatus, ColorValue } from '../types';
import { Save, Plus, Trash2, Camera, ChevronRight, ChevronLeft, Package, User, ToggleLeft as Toggle, Calendar, DollarSign, Tag, Calculator, Info } from 'lucide-react';
import CalculatorModal from '../components/CalculatorModal';
import ComboBox from '../components/ComboBox';
import { SIZES } from '../constants';

interface ProductFormViewProps {
  productId: string | null;
  products: Product[];
  grids: Grid[];
  suppliers: Person[];
  categories: Category[];
  colors: ColorValue[];
  onSave: (product: Product) => void;
  onCancel: () => void;
  isDarkMode: boolean;
}

export default function ProductFormView({ productId, products, grids, suppliers, categories, colors, onSave, onCancel, isDarkMode }: ProductFormViewProps) {
  const existingProduct = useMemo(() => products.find(p => p.id === productId), [productId, products]);
  const productCategories = useMemo(() => categories.filter(c => c.type === CategoryType.PRODUCT), [categories]);

  const [name, setName] = useState(existingProduct?.name || '');
  const [reference, setReference] = useState(existingProduct?.reference || '');
  const [supplierId, setSupplierId] = useState(existingProduct?.supplierId || suppliers[0]?.id || '');
  const [categoryId, setCategoryId] = useState(existingProduct?.categoryId || productCategories[0]?.id || '');
  const [defaultGridId, setDefaultGridId] = useState(existingProduct?.defaultGridId || grids[0]?.id || '');
  const [type, setType] = useState<SaleType>(existingProduct?.type || SaleType.WHOLESALE);
  const [status, setStatus] = useState<ProductStatus>(existingProduct?.status || ProductStatus.ACTIVE);
  const [costPrice, setCostPrice] = useState<number | string>(existingProduct?.costPrice ?? 0);
  const [salePrice, setSalePrice] = useState<number | string>(existingProduct?.salePrice ?? 0);
  const [minStockInBoxes, setMinStockInBoxes] = useState<number | string>(existingProduct?.minStockInBoxes ?? 0);
  const [adjustmentDate, setAdjustmentDate] = useState(existingProduct?.priceAdjustmentDate ? new Date(existingProduct.priceAdjustmentDate).toISOString().split('T')[0] : '');
  const [costPriceAdjustmentAmount, setCostPriceAdjustmentAmount] = useState<number | string>(existingProduct?.costPriceAdjustmentAmount ?? 0);
  const [salePriceAdjustmentAmount, setSalePriceAdjustmentAmount] = useState<number | string>(existingProduct?.salePriceAdjustmentAmount ?? 0);
  const [variations, setVariations] = useState<Variation[]>(existingProduct?.variations || []);

  const [activeVariationIndex, setActiveVariationIndex] = useState<number | null>(null);
  const [calcModal, setCalcModal] = useState<{ isOpen: boolean; field: string; value: number } | null>(null);

  const addVariation = () => {
    let selectedColor = colors.find(c => !variations.some(v => v.colorName === c.name));
    if (!selectedColor) {
        selectedColor = colors[0] || { id: 'default', name: 'Nova Cor', hex: '#000000' } as ColorValue;
    }
    const newVar: Variation = {
      id: Math.random().toString(36).substr(2, 9),
      color: selectedColor.hex,
      colorName: selectedColor.name,
      minStock: 5,
      stock: {}
    };
    setVariations([...variations, newVar]);
    setActiveVariationIndex(variations.length);
  };

  const updateVariation = (index: number, updates: Partial<Variation>) => {
    const newVars = [...variations];
    newVars[index] = { ...newVars[index], ...updates };
    setVariations(newVars);
  };

  const deleteVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
    if (activeVariationIndex === index) setActiveVariationIndex(null);
  };

  const handleSave = () => {
    if (!name || !reference) {
      alert('Por favor preencha nome e referência.');
      return;
    }
    
    const productData: Product = {
      id: existingProduct?.id || Math.random().toString(36).substr(2, 9),
      name,
      reference,
      supplierId,
      categoryId,
      defaultGridId,
      type,
      status,
      costPrice: parseFloat(costPrice as string) || 0,
      salePrice: parseFloat(salePrice as string) || 0,
      minStockInBoxes: parseInt(minStockInBoxes as string) || 0,
      priceAdjustmentDate: adjustmentDate ? new Date(adjustmentDate).getTime() : undefined,
      costPriceAdjustmentAmount: parseFloat(costPriceAdjustmentAmount as string) || 0,
      salePriceAdjustmentAmount: parseFloat(salePriceAdjustmentAmount as string) || 0,
      variations,
      createdAt: existingProduct?.createdAt || Date.now()
    };

    onSave(productData);
  };

  if (activeVariationIndex !== null) {
    const v = variations[activeVariationIndex];
    const selectedGrid = grids.find(g => g.id === defaultGridId);
    const availableSizes = selectedGrid?.sizes || [];

    return (
      <div className="flex flex-col gap-6 pb-60 pt-4 min-h-screen animate-in slide-in-from-right duration-300">
        <button 
          onClick={() => setActiveVariationIndex(null)} 
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 mb-2"
          aria-label="Voltar para a edição do produto"
          title="Voltar para o Produto"
        >
          <ChevronLeft size={16} /> Voltar para o Produto
        </button>

        <h2 className="text-lg font-bold uppercase tracking-tight">Editar Variação</h2>

        <div className={`p-5 rounded-2xl border flex flex-col gap-6 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="flex gap-4 items-center">
             <div className="w-16 h-16 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-800 shadow-sm">
                <Package size={24} className="text-indigo-500" />
             </div>
             <div className="flex-1 flex flex-col gap-2">
                <select 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500/10 text-slate-800 dark:text-slate-100"
                  value={v.colorName}
                  aria-label="Selecionar cor da variação"
                  title="Selecionar Cor"
                  onChange={(e) => {
                    const selectedColor = colors.find(c => c.name === e.target.value);
                    if (selectedColor) {
                      updateVariation(activeVariationIndex, { colorName: selectedColor.name, color: selectedColor.hex });
                    }
                  }}
                >
                  {colors.map(c => {
                    const isUsed = variations.some((variation, idx) => idx !== activeVariationIndex && variation.colorName === c.name);
                    return (
                      <option key={c.id} value={c.name} disabled={isUsed}>
                        {c.name} {isUsed ? '✓ (Já adicionada)' : ''}
                      </option>
                    );
                  })}
                </select>
                
             </div>
             
             <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-4 w-28">
               <label className="text-[7px] uppercase font-bold text-slate-400 dark:text-slate-500 px-1 mb-1 block">Est. Min.</label>
               <input 
                 type="number"
                 className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-2 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500/10 text-slate-800 dark:text-slate-100 text-center"
                 value={v.minStock || 0}
                 aria-label="Estoque mínimo da variação"
                 title="Estoque Mínimo"
                 onChange={(e) => {
                   updateVariation(activeVariationIndex, { minStock: parseInt(e.target.value) || 0 });
                 }}
               />
             </div>
          </div>

          <div>
             <div className="flex items-center justify-between mb-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="text-[11px] uppercase font-black text-slate-900 dark:text-slate-100 px-1 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                  {type === SaleType.RETAIL ? 'ESTOQUE E PREÇOS POR TAMANHO' : 'ESTOQUE TOTAL'}
                </label>
             </div>

             {type === SaleType.RETAIL ? (
               availableSizes.length > 0 ? (
                 <div className="flex flex-col gap-3">
                    {availableSizes.map(size => (
                       <div key={size} className="grid grid-cols-4 gap-2 items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                          <span className="text-[11px] font-black text-slate-900 dark:text-white">{size}</span>
                          <div>
                            <p className="text-[7px] font-bold text-slate-400 uppercase mb-0.5">Estoque (Pares)</p>
                            <input 
                              type="number"
                              className="w-full bg-white dark:bg-slate-900 border-none rounded-md p-1.5 text-center text-[10px] font-bold"
                              value={v.stock[size] !== undefined ? v.stock[size] : ''}
                              title={`Estoque para tamanho ${size}`}
                              placeholder="0"
                              onChange={(e) => {
                                const val = e.target.value;
                                const newStock = { ...v.stock, [size]: val === '' ? '' as any : parseInt(val, 10) };
                                updateVariation(activeVariationIndex, { stock: newStock });
                              }}
                            />
                          </div>
                          <div>
                            <p className="text-[7px] font-bold text-slate-400 uppercase mb-0.5">Custo (Par)</p>
                            <input 
                              type="number"
                              step="0.01"
                              className="w-full bg-white dark:bg-slate-900 border-none rounded-md p-1.5 text-center text-[10px] font-bold"
                              value={v.sizePrices?.[size]?.cost ?? costPrice}
                              title={`Preço de custo para tamanho ${size}`}
                              placeholder="0.00"
                              onChange={(e) => {
                                const newPrices = { ...v.sizePrices };
                                newPrices[size] = { 
                                  cost: parseFloat(e.target.value) || 0, 
                                  sale: v.sizePrices?.[size]?.sale ?? salePrice 
                                };
                                updateVariation(activeVariationIndex, { sizePrices: newPrices });
                              }}
                            />
                          </div>
                          <div>
                            <p className="text-[7px] font-bold text-slate-400 uppercase mb-0.5">Venda (Par)</p>
                            <input 
                              type="number"
                              step="0.01"
                              className="w-full bg-white dark:bg-slate-900 border-none rounded-md p-1.5 text-center text-[10px] font-bold text-indigo-600"
                              value={v.sizePrices?.[size]?.sale ?? salePrice}
                              title={`Preço de venda para tamanho ${size}`}
                              placeholder="0.00"
                              onChange={(e) => {
                                const newPrices = { ...v.sizePrices };
                                newPrices[size] = { 
                                  cost: v.sizePrices?.[size]?.cost ?? costPrice, 
                                  sale: parseFloat(e.target.value) || 0 
                                };
                                updateVariation(activeVariationIndex, { sizePrices: newPrices });
                              }}
                            />
                          </div>
                       </div>
                    ))}
                 </div>
               ) : (
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center py-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                   Selecione uma grade padrão primeiro
                 </p>
               )
             ) : (
               <div className="flex flex-col gap-4 p-5 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[10px] uppercase font-black text-amber-600 dark:text-amber-400 block mb-1">Estoque Físico</label>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none">Controle em Grades / Caixas</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Valor em Estoque</p>
                      <span className="text-[11px] font-black text-slate-900 dark:text-white">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          (typeof v.stock['WHOLESALE'] === 'number' ? v.stock['WHOLESALE'] : 0) * (parseFloat(costPrice.toString()) || 0)
                        )}
                      </span>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <input 
                      type="number"
                      placeholder="Estoque Total"
                      title="Estoque Total"
                      className="w-full bg-white dark:bg-slate-900 border-2 border-amber-100 dark:border-amber-900/30 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 dark:text-white shadow-inner focus:border-amber-500 focus:ring-0 transition-all"
                      value={v.stock['WHOLESALE'] !== undefined ? v.stock['WHOLESALE'] : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateVariation(activeVariationIndex, { stock: { 'WHOLESALE': val === '' ? '' as any : parseInt(val, 10) } });
                      }}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                      GRADES
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-amber-600/60 dark:text-amber-400/40 p-2 border border-dashed border-amber-200 dark:border-amber-900/30 rounded-xl">
                    <Info size={14} />
                    <p className="text-[8px] font-bold uppercase tracking-widest leading-tight">No atacado o estoque é gerenciado de forma simplificada por grade completa.</p>
                  </div>
               </div>
             )}
          </div>
        </div>

        <button 
          onClick={() => {
            const nextIndex = activeVariationIndex + 1;
            if (nextIndex < variations.length) {
                setActiveVariationIndex(nextIndex);
            } else {
                setActiveVariationIndex(null);
            }
          }}
          className={`bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-2 ${isDarkMode ? 'shadow-none' : 'shadow-indigo-200'}`}
          aria-label="Confirmar esta variação e passar para a próxima"
          title="Próxima Variação"
        >
          Confirmar e Próxima Variação <ChevronRight size={16}/>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-60 px-4 pt-4 min-h-screen">
      <div className={`p-6 rounded-[2rem] border flex flex-col gap-6 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl">
           <button 
             onClick={() => setType(SaleType.WHOLESALE)}
             className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === SaleType.WHOLESALE ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
           >
             <Package size={14} /> Atacado
           </button>
           <button 
             onClick={() => setType(SaleType.RETAIL)}
             className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === SaleType.RETAIL ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
           >
             <Tag size={14} /> Varejo
           </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
           <div className="flex items-center gap-3">
             <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status === ProductStatus.ACTIVE ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
               <Toggle className={status === ProductStatus.ACTIVE ? '' : 'rotate-180'} size={20} />
             </div>
             <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">{status === ProductStatus.ACTIVE ? 'Em Uso' : 'Inativo'}</p>
               <p className="text-[9px] text-slate-400 dark:text-slate-500">Bloqueia compra/venda se inativo</p>
             </div>
           </div>
           <button 
             type="button"
             onClick={() => setStatus(status === ProductStatus.ACTIVE ? ProductStatus.INACTIVE : ProductStatus.ACTIVE)}
             className={`w-12 h-6 rounded-full relative transition-colors ${status === ProductStatus.ACTIVE ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
             aria-label={status === ProductStatus.ACTIVE ? "Inativar produto" : "Ativar produto"}
             title={status === ProductStatus.ACTIVE ? "Inativar" : "Ativar"}
           >
             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${status === ProductStatus.ACTIVE ? 'left-7' : 'left-1'}`} />
           </button>
        </div>

         <div className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-1 mb-1.5 block tracking-wider">Referência Interna</label>
               <input 
                 type="text" 
                 placeholder="Ex: SNK-102"
                 className={`w-full border rounded-2xl px-5 py-4 text-xs font-bold transition-all outline-none focus:ring-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50 text-white focus:ring-indigo-500/10' : 'bg-slate-50 border-slate-100 text-slate-900 focus:ring-indigo-500/5'}`}
                 value={reference}
                 onChange={(e) => setReference(e.target.value)}
               />
             </div>

             <div>
               <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-1 mb-1.5 block tracking-wider">Nome do Modelo</label>
               <input 
                 type="text" 
                 placeholder="Ex: Tênis Runner Air"
                 className={`w-full border rounded-2xl px-5 py-4 text-xs font-bold transition-all outline-none focus:ring-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700/50 text-white focus:ring-indigo-500/10' : 'bg-slate-50 border-slate-100 text-slate-900 focus:ring-indigo-500/5'}`}
                 value={name}
                 onChange={(e) => setName(e.target.value)}
               />
             </div>
           </div>

           <div className={`p-8 rounded-[2.5rem] border shadow-sm transition-all duration-500 ${type === SaleType.WHOLESALE ? 'bg-amber-50/40 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/20 shadow-amber-100/20' : 'bg-indigo-50/40 border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/20 shadow-indigo-100/20'}`}>
             <div className="flex items-center gap-4 mb-8">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform duration-500 ${type === SaleType.WHOLESALE ? 'bg-amber-500 rotate-3 text-white' : 'bg-indigo-500 -rotate-3 text-white'}`}>
                  {type === SaleType.WHOLESALE ? <Package size={24} strokeWidth={2.5} /> : <Tag size={24} strokeWidth={2.5} />}
                </div>
                <div>
                   <h4 className={`text-[11px] font-black uppercase tracking-[0.2em] ${type === SaleType.WHOLESALE ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                     Configurações de {type === SaleType.WHOLESALE ? 'Atacado' : 'Varejo'}
                   </h4>
                   <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
                     {type === SaleType.WHOLESALE ? 'Precificação por grade fechada' : 'Precificação por par individual'}
                   </p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               <div className="group">
                 <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-1 mb-2 block tracking-widest leading-none group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                   {type === SaleType.WHOLESALE ? 'Custo por Caixa (R$)' : 'Custo Unitário (R$)'}
                 </label>
                 <div className="relative">
                   <input 
                     type="number" 
                     step="0.01"
                     className={`w-full border-2 rounded-2xl px-6 py-4.5 pl-12 text-sm font-black transition-all outline-none focus:ring-0 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-500'}`}
                     value={costPrice}
                     aria-label="Preço de custo"
                     title="Preço de Custo"
                     onChange={(e) => setCostPrice(e.target.value)}
                   />
                   <DollarSign size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                   <button 
                     type="button" 
                     onClick={() => setCalcModal({ isOpen: true, field: 'costPrice', value: parseFloat(costPrice as string) || 0 })} 
                     className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all"
                     aria-label="Abrir calculadora para o preço de custo"
                     title="Calculadora"
                   >
                     <Calculator size={16} />
                   </button>
                 </div>
               </div>

               <div className="group">
                 <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-1 mb-2 block tracking-widest leading-none group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                   {type === SaleType.WHOLESALE ? 'Venda por Caixa (R$)' : 'Venda Unitária (R$)'}
                 </label>
                 <div className="relative">
                   <input 
                     type="number" 
                     step="0.01"
                     className={`w-full border-2 rounded-2xl px-6 py-4.5 pl-12 text-sm font-black transition-all outline-none focus:ring-0 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-indigo-400 focus:border-indigo-500 text-lg' : 'bg-white border-slate-100 text-indigo-600 focus:border-indigo-500 text-lg'}`}
                     value={salePrice}
                     aria-label="Preço de venda"
                     title="Preço de Venda"
                     onChange={(e) => setSalePrice(e.target.value)}
                   />
                   <DollarSign size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-400" />
                   <button 
                     type="button" 
                     onClick={() => setCalcModal({ isOpen: true, field: 'salePrice', value: parseFloat(salePrice as string) || 0 })} 
                     className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all"
                     aria-label="Abrir calculadora para o preço de venda"
                     title="Calculadora"
                   >
                     <Calculator size={16} />
                   </button>
                 </div>
               </div>

               {type === SaleType.RETAIL && (
                 <div className="col-span-1 sm:col-span-2 p-5 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex items-center gap-3 mb-4">
                       <Info size={16} className="text-indigo-400" />
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Configuração de Volume (Varejo)</p>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-1 mb-2 block tracking-widest">Grade de Tamanhos Padrão</label>
                      <div className="relative">
                        <select 
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-xs font-black appearance-none cursor-pointer text-slate-700 dark:text-slate-300 pr-10"
                          value={defaultGridId}
                          title="Selecionar grade de tamanhos padrão"
                          onChange={(e) => setDefaultGridId(e.target.value)}
                        >
                          {grids.map(g => <option key={g.id} value={g.id} className="dark:bg-slate-900">{g.name} ({g.sizes.join('/')})</option>)}
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 rotate-90" size={18} />
                      </div>
                    </div>
                 </div>
               )}

               <div className={type === SaleType.WHOLESALE ? "col-span-1 sm:col-span-2" : "col-span-1"}>
                 <label className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500 px-1 mb-2 block tracking-widest leading-none">
                   {type === SaleType.WHOLESALE ? 'Estoque Mínimo (Caixas)' : 'Estoque Mín. Global'}
                 </label>
                 <div className="relative">
                    <input 
                      type="number" 
                      className={`w-full border-2 rounded-2xl px-6 py-4.5 pl-12 text-sm font-black transition-all outline-none focus:ring-0 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-500'}`}
                      value={minStockInBoxes}
                      aria-label="Estoque mínimo global"
                      title="Estoque Mínimo"
                      onChange={(e) => setMinStockInBoxes(e.target.value)}
                    />
                    <Package size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                 </div>
               </div>
             </div>
           </div>
         </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 px-1 mb-1 block tracking-wider">Fornecedor</label>
            <ComboBox
              options={suppliers.map(s => ({ id: s.id, name: s.name }))}
              value={supplierId}
              onChange={setSupplierId}
              placeholder="Selecionar fornecedor..."
              isDarkMode={isDarkMode}
            />
          </div>
          <div>
            <label className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 px-1 mb-1 block tracking-wider">Categoria</label>
            <ComboBox
              options={[{ id: '', name: 'Nenhum' }, ...productCategories.map(c => ({ id: c.id, name: c.name }))]}
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Selecionar categoria..."
              isDarkMode={isDarkMode}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {type === SaleType.RETAIL && (
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 px-1 mb-1 block tracking-wider">Grade Padrão</label>
              <select 
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-3.5 text-[10px] font-bold appearance-none cursor-pointer text-slate-700 dark:text-slate-300"
                value={defaultGridId}
                title="Selecionar grade padrão"
                onChange={(e) => setDefaultGridId(e.target.value)}
              >
                {grids.map(g => <option key={g.id} value={g.id} className="dark:bg-slate-900">{g.name}</option>)}
              </select>
            </div>
          )}
          <div className={type === SaleType.WHOLESALE ? "col-span-2" : ""}>
            <label className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 px-1 mb-1 block tracking-wider">Est. Mín (Caixas)</label>
            <input 
              type="number" 
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/10"
              value={minStockInBoxes}
              title="Estoque mínimo em caixas"
              placeholder="0"
              onChange={(e) => setMinStockInBoxes(e.target.value)}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-50 dark:border-slate-800">
           <label className="text-[10px] uppercase font-black text-slate-900 dark:text-white mb-4 block tracking-widest flex items-center gap-2">
             <Calendar size={14} className="text-indigo-500" /> Agendar Reajuste de Preço
           </label>
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                 <label className="text-[8px] uppercase font-bold text-slate-400 dark:text-slate-500 px-1 mb-1 block">A partir de</label>
                 <input 
                   type="date"
                   className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-3 text-[10px] font-bold text-slate-900 dark:text-slate-100"
                   value={adjustmentDate}
                   title="Data de reajuste"
                   onChange={(e) => setAdjustmentDate(e.target.value)}
                 />
              </div>
              <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[8px] uppercase font-bold text-slate-400 dark:text-slate-500 px-1 mb-1 block">Reajuste Custo (R$)</label>
                    <div className="relative">
                        <input 
                        type="number"
                        step="0.01"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-3 text-[10px] font-bold text-slate-900 dark:text-slate-100 pl-8"
                        value={costPriceAdjustmentAmount}
                        onChange={(e) => setCostPriceAdjustmentAmount(e.target.value)}
                        placeholder="0.00"
                        />
                        <DollarSign size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <button 
                          type="button" 
                          onClick={() => setCalcModal({ isOpen: true, field: 'costPriceAdjustmentAmount', value: parseFloat(costPriceAdjustmentAmount as string) || 0 })} 
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
                          title="Calculadora"
                          aria-label="Abrir calculadora para reajuste de custo"
                        >
                          <Calculator size={12} />
                        </button>
                    </div>
                </div>
                <div>
                    <label className="text-[8px] uppercase font-bold text-slate-400 dark:text-slate-500 px-1 mb-1 block">Reajuste Venda (R$)</label>
                    <div className="relative">
                        <input 
                        type="number"
                        step="0.01"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-3 text-[10px] font-bold text-slate-900 dark:text-slate-100 pl-8"
                        value={salePriceAdjustmentAmount}
                        onChange={(e) => setSalePriceAdjustmentAmount(e.target.value)}
                        placeholder="0.00"
                        />
                        <DollarSign size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                        <button 
                          type="button" 
                          onClick={() => setCalcModal({ isOpen: true, field: 'salePriceAdjustmentAmount', value: parseFloat(salePriceAdjustmentAmount as string) || 0 })} 
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
                          title="Calculadora"
                          aria-label="Abrir calculadora para reajuste de venda"
                        >
                          <Calculator size={12} />
                        </button>
                    </div>
                </div>
              </div>
           </div>
        </div>
      </div>

      <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-900 dark:text-slate-100">Cores e Variações</h3>
            <button 
              onClick={addVariation} 
              className="flex items-center gap-2 text-[10px] bg-indigo-600 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-700 shadow-sm transition-all"
              aria-label="Adicionar nova variação de cor"
              title="Adicionar Cor"
            >
              <Plus size={14} strokeWidth={3} /> Adicionar Cor
            </button>
          </div>

          <div className="space-y-2">
            {variations.map((v, i) => (
              <div key={v.id} className={`p-3 rounded-xl border flex items-center justify-between shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-slate-800 shadow-sm ring-2 ring-slate-50 dark:ring-slate-800">
                    <Package size={20} className="text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-slate-900 dark:text-white tracking-tight">{v.colorName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setActiveVariationIndex(i)} 
                    className="p-2 text-slate-400 dark:text-slate-600 hover:text-indigo-600 transition-colors"
                    aria-label={`Editar variação ${v.colorName}`}
                    title="Editar Variação"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button 
                    onClick={() => deleteVariation(i)} 
                    className="p-2 text-rose-300 dark:text-rose-700 hover:text-rose-500 transition-colors"
                    aria-label={`Excluir variação ${v.colorName}`}
                    title="Excluir Variação"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {variations.length === 0 && (
              <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-300 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest italic">
                Nenhuma variação adicionada.
              </div>
            )}
          </div>
      </section>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <button 
          onClick={onCancel}
          className="py-3.5 rounded-xl font-bold uppercase tracking-widest text-[10px] border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 transition-all font-sans cursor-pointer"
        >
          Cancelar
        </button>
        <button 
          onClick={handleSave}
          className={`bg-slate-900 dark:bg-indigo-600 text-white py-3.5 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-xl transform transition-transform active:scale-95 cursor-pointer ${isDarkMode ? 'shadow-none' : 'shadow-slate-200'}`}
          aria-label="Salvar alterações do produto"
          title="Salvar Produto"
        >
          <Save size={14} /> Salvar Produto
        </button>
      </div>
      <CalculatorModal
        isOpen={!!calcModal}
        onClose={() => setCalcModal(null)}
        isDarkMode={isDarkMode}
        initialValue={calcModal?.value || 0}
        onResult={(res) => {
            if (!calcModal) return;
            if (calcModal.field === 'costPrice') setCostPrice(res.toString());
            if (calcModal.field === 'salePrice') setSalePrice(res.toString());
            if (calcModal.field === 'costPriceAdjustmentAmount') setCostPriceAdjustmentAmount(res.toString());
            if (calcModal.field === 'salePriceAdjustmentAmount') setSalePriceAdjustmentAmount(res.toString());
        }}
      />
    </div>
  );
}

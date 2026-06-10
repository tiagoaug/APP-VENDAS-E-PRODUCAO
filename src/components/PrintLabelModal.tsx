import React, { useState, useMemo, useEffect } from 'react';
import { Tag, Check, X, Printer, CheckCircle2, Box, Layers, Settings2 } from 'lucide-react';
import Modal from './Modal';
import { Product, Variation, SaleType, LabelLayout } from '../types';
import { labelService } from '../services/labelService';
import LabelEditor from './LabelEditor';
import { toast } from '../utils/toast';

interface PrintLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  isDarkMode: boolean;
}

export default function PrintLabelModal({ isOpen, onClose, product, isDarkMode }: PrintLabelModalProps) {
  const [selectedVariationId, setSelectedVariationId] = useState<string>(product.variations[0]?.id || '');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [useStockQuantities, setUseStockQuantities] = useState(false);
  const [isBoxLabel, setIsBoxLabel] = useState(product.type === SaleType.WHOLESALE);
  const [customQuantity, setCustomQuantity] = useState<number>(1);
  const [labelSize, setLabelSize] = useState<string>('40x30');
  const [activeTab, setActiveTab] = useState<'print' | 'config'>('print');
  
  const dimensions = useMemo(() => {
    const [w, h] = labelSize.split('x').map(Number);
    return [w, h] as [number, number];
  }, [labelSize]);

  const [layout, setLayout] = useState<LabelLayout>(() => {
    const saved = localStorage.getItem(`label_layout_${labelSize}`);
    return saved ? JSON.parse(saved) : labelService.getDefaultLayout(dimensions);
  });

  // Update layout when labelSize changes if not in localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`label_layout_${labelSize}`);
    if (saved) {
      setLayout(JSON.parse(saved));
    } else {
      setLayout(labelService.getDefaultLayout(dimensions));
    }
  }, [labelSize, dimensions]);

  // Persist layout changes
  useEffect(() => {
    localStorage.setItem(`label_layout_${labelSize}`, JSON.stringify(layout));
  }, [layout, labelSize]);

  const selectedVariation = product.variations.find(v => v.id === selectedVariationId);
  const availableSizes = selectedVariation ? Object.keys(selectedVariation.stock).filter(s => s !== 'WHOLESALE') : [];
  
  const currentStockQty = useMemo(() => {
    if (!selectedVariation) return 0;
    if (isBoxLabel) return selectedVariation.stock['WHOLESALE'] || 0;
    return 0;
  }, [selectedVariation, isBoxLabel]);

  const toggleSize = (size: string) => {
    setSelectedSizes(prev => 
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  };

  const toggleAllSizes = () => {
    if (selectedSizes.length === availableSizes.length) {
      setSelectedSizes([]);
    } else {
      setSelectedSizes([...availableSizes]);
    }
  };

  const handlePrint = async () => {
    if (!selectedVariation) return;
    
    if (isBoxLabel) {
      let qty = customQuantity;
      if (useStockQuantities) {
        qty = selectedVariation.stock['WHOLESALE'] || 0;
      }
      
      if (qty > (selectedVariation.stock['WHOLESALE'] || 0)) {
        toast.show(`Quantidade indisponível no estoque (Máximo: ${selectedVariation.stock['WHOLESALE'] || 0})`);
        return;
      }
      
      if (qty <= 0) {
        toast.show('Selecione uma quantidade válida.');
        return;
      }

      await labelService.printWholesaleLabel(product, selectedVariation, qty, dimensions, layout);
    } else {
      const sizesToPrint = selectedSizes.length > 0 ? selectedSizes : availableSizes;
      
      let quantities: Record<string, number> | undefined;
      if (useStockQuantities) {
        quantities = {};
        sizesToPrint.forEach(size => {
          quantities![size] = selectedVariation.stock[size] || 0;
        });
      }

      await labelService.printProductLabels(product, selectedVariation, sizesToPrint, quantities, dimensions, layout);
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Imprimir Etiquetas" maxWidth="max-w-md" zIndex={60000}>
      <div className="flex flex-col gap-6 py-4">
        {/* Tab Selection */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
           <button 
             onClick={() => setActiveTab('print')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
               activeTab === 'print' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'
             }`}
           >
             <Printer size={14} /> Impressão
           </button>
           <button 
             onClick={() => setActiveTab('config')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
               activeTab === 'config' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'
             }`}
           >
             <Settings2 size={14} /> Ajustar Layout
           </button>
        </div>

        {activeTab === 'config' ? (
          <LabelEditor 
            dimensions={dimensions}
            layout={layout}
            onChange={setLayout}
            productName={product.name}
            reference={product.reference || '---'}
            colorName={selectedVariation?.colorName || ''}
            isDarkMode={isDarkMode}
          />
        ) : (
          <>
            {/* Product Info */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
               <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white shadow-lg">
                  <Tag size={24} />
               </div>
               <div>
                  <h3 className="font-black uppercase text-sm text-slate-800 dark:text-white leading-tight">{product.name}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">REF: {product.reference || '---'}</p>
               </div>
            </div>

            {/* Print Strategy Toggle */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Modo de Impressão</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsBoxLabel(false)}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    !isBoxLabel 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                      : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400'
                  }`}
                >
                  <Tag size={14} /> Por Tamanho
                </button>
                <button
                  onClick={() => setIsBoxLabel(true)}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    isBoxLabel 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                      : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400'
                  }`}
                >
                  <Layers size={14} /> Etiqueta de Caixa
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setUseStockQuantities(false)}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    !useStockQuantities 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                      : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400'
                  }`}
                >
                  <Check size={14} /> Apenas 1
                </button>
                <button
                  onClick={() => setUseStockQuantities(true)}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    useStockQuantities 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                      : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400'
                  }`}
                >
                  <Box size={14} /> Qtd em Estoque
                </button>
              </div>

              {isBoxLabel && !useStockQuantities && (
                <div className="mt-2 flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Qtd para Imprimir:</label>
                    <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full uppercase">Estoque: {currentStockQty}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number"
                      min="1"
                      max={currentStockQty}
                      value={customQuantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setCustomQuantity(Math.min(currentStockQty, Math.max(1, val)));
                      }}
                      className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-black text-indigo-600 dark:text-indigo-400 outline-none focus:border-indigo-500"
                    />
                  </div>
                  {customQuantity >= currentStockQty && currentStockQty > 0 && (
                    <p className="text-[9px] font-bold text-rose-500 uppercase text-center mt-1">Limite do estoque atingido</p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 mt-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Tamanho da Etiqueta (mm)</label>
                <div className="flex flex-wrap gap-2">
                  {['30x20', '40x25', '40x30', '40x40', '50x25', '50x30', '50x40', '50x50'].map(size => (
                    <button
                      key={size}
                      onClick={() => setLabelSize(size)}
                      className={`min-w-[50px] py-2 px-1 rounded-xl border-2 font-black text-[9px] uppercase tracking-tighter transition-all ${
                        labelSize === size 
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                          : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Variation Selection */}
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Selecione a Cor</label>
              <div className="grid grid-cols-2 gap-2">
                {product.variations.map(v => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVariationId(v.id);
                      setSelectedSizes([]);
                    }}
                    className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      selectedVariationId === v.id 
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                        : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div 
                      className="w-4 h-4 rounded-full border border-black/10 shrink-0" 
                      style={{ backgroundColor: v.color }} 
                    />
                    <span className={`text-[10px] font-black uppercase truncate ${
                      selectedVariationId === v.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'
                    }`}>
                      {v.colorName}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Size Selection */}
            {!isBoxLabel && selectedVariation && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tamanhos</label>
                  <button 
                    onClick={toggleAllSizes}
                    className="text-[9px] font-black uppercase tracking-widest text-indigo-500"
                  >
                    {selectedSizes.length === availableSizes.length ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map(size => {
                    const stockQty = selectedVariation.stock[size] || 0;
                    return (
                      <button
                        key={size}
                        onClick={() => toggleSize(size)}
                        className={`min-w-[56px] h-14 rounded-xl border-2 font-black transition-all flex flex-col items-center justify-center ${
                          selectedSizes.includes(size)
                            ? 'border-indigo-500 bg-indigo-500 text-white shadow-md'
                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="text-xs">{size}</span>
                        {useStockQuantities && (
                          <span className={`text-[8px] mt-0.5 ${selectedSizes.includes(size) ? 'text-white/80' : 'text-slate-400'}`}>
                            Qtd: {stockQty}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer Actions */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest text-[10px]"
          >
            Cancelar
          </button>
          <button
            onClick={handlePrint}
            className="flex-2 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Printer size={16} /> Gerar Etiquetas
          </button>
        </div>
      </div>
    </Modal>
  );
}

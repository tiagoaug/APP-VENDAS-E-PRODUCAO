import React, { useState } from "react";
import { Product, SaleType } from "../types";
import {
  Search,
  Package,
  Filter,
  ChevronDown,
  AlertCircle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface StockViewProps {
  products: Product[];
  onUpdateProduct: (product: Product) => Promise<void>;
  isDarkMode: boolean;
}

export default function StockView({
  products,
  onUpdateProduct,
  isDarkMode,
}: StockViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedStocks, setEditedStocks] = useState<Record<string, Product>>({});
  const [isSaving, setIsSaving] = useState(false);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.reference.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleStartEditing = () => {
    const initialStocks: Record<string, Product> = {};
    products.forEach(p => {
      initialStocks[p.id] = JSON.parse(JSON.stringify(p));
    });
    setEditedStocks(initialStocks);
    setIsEditing(true);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      for (const productId of Object.keys(editedStocks)) {
        const original = products.find(p => p.id === productId);
        const edited = editedStocks[productId];
        
        // Only save if changed
        if (JSON.stringify(original) !== JSON.stringify(edited)) {
          await onUpdateProduct(edited);
        }
      }
      setIsEditing(false);
      setEditedStocks({});
    } catch (error) {
      console.error("Erro ao salvar balanço:", error);
      alert("Erro ao salvar balanço de estoque.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateProductStock = (productId: string, variationId: string, key: string, value: number) => {
    setEditedStocks(prev => {
      const newStocks = { ...prev };
      const product = newStocks[productId];
      const variation = product.variations.find(v => v.id === variationId);
      if (variation) {
        variation.stock[key] = value;
      }
      return newStocks;
    });
  };

  return (
    <div className="flex flex-col gap-4 pb-32 px-4 bg-[#fafafa] dark:bg-slate-950 min-h-screen">
      <div className="flex flex-col gap-3 pt-4">
        <div className="flex items-center justify-between mb-2">
          <div>
             <h2 className={`text-xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Estoque</h2>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Balanço e Inventário</p>
          </div>
          
          {!isEditing ? (
            <button 
              onClick={handleStartEditing}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 active:scale-95"
              title="Iniciar Balanço de Estoque"
              aria-label="Entrar no modo de edição de estoque para fazer balanço"
            >
              <TrendingUp size={14} strokeWidth={3} /> Fazer Balanço
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-4 py-3 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                title="Cancelar Balanço"
                aria-label="Sair do modo de edição sem salvar"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveAll}
                disabled={isSaving}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 active:scale-95"
                title="Salvar Balanço"
                aria-label="Salvar todas as alterações de estoque"
              >
                {isSaving ? 'Salvando...' : 'Salvar Balanço'}
              </button>
            </div>
          )}
        </div>

        <div className={`p-6 rounded-[2rem] border shadow-xl relative overflow-hidden mb-2 ${
          isDarkMode 
            ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border-slate-800' 
            : 'bg-gradient-to-br from-indigo-600 via-indigo-600 to-indigo-800 border-indigo-500 text-white'
        }`}>
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${isDarkMode ? 'text-slate-500' : 'text-indigo-100/70'}`}>Valor Estimado em Estoque</p>
            <p className={`text-3xl font-black italic tracking-tighter ${isDarkMode ? 'text-white' : 'text-white'}`}>
                <span className="text-sm not-italic opacity-50 mr-2">R$</span>
                {products.reduce((acc, p) => acc + (p.variations.reduce((vAcc, v) => vAcc + (Object.values(v.stock) as number[]).reduce((sum, s) => sum + s, 0), 0) * (p.costPrice || 0)), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
        </div>

        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Procurar no estoque..."
            className={`w-full border rounded-[1.2rem] py-4 pl-12 pr-4 text-[11px] font-black uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-indigo-500/5 dark:focus:ring-indigo-500/10 placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-800 dark:text-slate-100 transition-all ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm"}`}
            value={searchTerm}
            title="Pesquisar no Estoque"
            aria-label="Campo de pesquisa de produtos no estoque"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filteredProducts.map((product) => (
          <StockCard
            key={product.id}
            product={isEditing ? editedStocks[product.id] || product : product}
            isDarkMode={isDarkMode}
            isEditing={isEditing}
            onUpdateStock={(variationId, key, value) => updateProductStock(product.id, variationId, key, value)}
          />
        ))}

        {filteredProducts.length === 0 && (
          <div className={`p-10 text-center border-2 border-dashed rounded-3xl ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
             <Package size={40} className="mx-auto mb-3 opacity-20" />
             <p className="text-xs font-bold uppercase tracking-widest">Nenhum produto em estoque</p>
          </div>
        )}
      </div>
    </div>
  );
}

const StockCard: React.FC<{ 
  product: Product; 
  isDarkMode: boolean;
  isEditing: boolean;
  onUpdateStock: (variationId: string, key: string, value: number) => void;
}> = ({ product, isDarkMode, isEditing, onUpdateStock }) => {
  const totalStock = product.variations.reduce((acc, v) => {
    return acc + (Object.values(v.stock) as number[]).reduce((sum, s) => sum + s, 0);
  }, 0);

  const isLowStock = totalStock <= product.minStockInBoxes * 12; 

  return (
    <div className={`p-5 rounded-[2.5rem] border shadow-sm flex flex-col gap-4 transition-all ${isEditing ? 'ring-2 ring-indigo-500/20' : ''} ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
       <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                <Package size={24} className="text-indigo-500" />
             </div>
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{product.reference}</p>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">{product.name}</h3>
             </div>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isLowStock ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20'}`}>
             {isLowStock ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
             {isLowStock ? 'Estoque Baixo' : 'Estoque OK'}
          </div>
       </div>

       <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50 dark:border-slate-800">
          <div>
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Estoque Total</p>
             <p className={`text-2xl font-black italic tracking-tighter ${isLowStock ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                {totalStock} <span className="text-xs font-bold not-italic text-slate-400">{product.type === SaleType.WHOLESALE ? 'GRADES' : 'UNIDADES'}</span>
             </p>
          </div>
          <div className="text-right">
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Mínimo (Caixas)</p>
             <p className="text-2xl font-black italic tracking-tighter text-indigo-500">
                {product.minStockInBoxes} <span className="text-xs font-bold not-italic text-slate-400">CAIXAS</span>
             </p>
          </div>
       </div>

        <div className="flex flex-col gap-3">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Variações em Estoque</p>
          <div className="space-y-3">
             {product.variations.map(v => {
                const varStock = (Object.values(v.stock) as number[]).reduce((sum, s) => sum + s, 0);
                return (
                  <div key={v.id} className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="w-4 h-4 rounded-full border border-white dark:border-slate-700 shadow-sm" style={{ backgroundColor: v.color }} />
                           <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase">{v.colorName}</span>
                        </div>
                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{varStock} {product.type === SaleType.WHOLESALE ? 'GR' : 'UN'}</span>
                     </div>
                     
                     {product.type === SaleType.RETAIL ? (
                        <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 mt-1">
                           {Object.entries(v.stock).map(([size, qty]) => (
                              <div key={size} className="flex flex-col items-center p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                                 <span className="text-[7px] font-black text-slate-400 uppercase leading-none mb-1">{size}</span>
                                 {isEditing ? (
                                   <input 
                                     type="number"
                                     className="w-full bg-slate-50 dark:bg-slate-800 border-none text-center text-[11px] font-black p-0 focus:ring-0"
                                     value={qty === 0 ? '' : qty}
                                     placeholder="0"
                                     title={`Estoque Tamanho ${size}`}
                                     aria-label={`Editar estoque do tamanho ${size}`}
                                     onChange={(e) => onUpdateStock(v.id, size, e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                                   />
                                 ) : (
                                   <span className="text-[10px] font-bold text-slate-800 dark:text-slate-100 leading-none">{qty}</span>
                                 )}
                              </div>
                           ))}
                        </div>
                     ) : (
                        <div className="flex items-center justify-between px-1">
                           <div className="flex items-center gap-2">
                              <Package size={10} className="text-slate-400" />
                              <span className="text-[8px] font-black text-slate-400 uppercase italic tracking-widest">Estoque Global</span>
                           </div>
                           {isEditing && (
                              <div className="flex items-center gap-2">
                                 <span className="text-[9px] font-black text-slate-400 uppercase">Grades:</span>
                                 <input 
                                   type="number"
                                   className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center text-[11px] font-black py-1 focus:ring-2 focus:ring-indigo-500/10"
                                   value={v.stock['WHOLESALE'] === 0 ? '' : v.stock['WHOLESALE'] || ''}
                                   placeholder="0"
                                   title="Estoque Grade"
                                   aria-label="Editar estoque da grade atacado"
                                   onChange={(e) => onUpdateStock(v.id, 'WHOLESALE', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                                 />
                              </div>
                           )}
                        </div>
                     )}
                  </div>
                );
             })}
          </div>
        </div>
    </div>
  );
};

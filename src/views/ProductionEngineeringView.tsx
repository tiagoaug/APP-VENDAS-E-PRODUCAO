import { useState } from "react";
import { Product, ProductStatus, SaleType, ViewType, AppModulesConfig, Category } from "../types";
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Package,
  Filter,
  ChevronDown,
  ChevronRight,
  Database,
  Hammer
} from "lucide-react";

interface ProductionEngineeringViewProps {
  products: Product[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, status: ProductStatus) => void;
  isDarkMode: boolean;
  categories: Category[];
  onBack: () => void;
}

export default function ProductionEngineeringView({
  products,
  onAdd,
  onEdit,
  onDelete,
  onToggleStatus,
  isDarkMode,
  categories,
  onBack,
}: ProductionEngineeringViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.reference.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4 pb-24 px-4 bg-[#fafafa] dark:bg-slate-950 h-screen overflow-y-auto overflow-x-hidden force-scrollbar">
      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[100] flex animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setItemToDelete(null)}
          />
          <div className="relative m-auto w-[90%] max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-2xl">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-2">Excluir Modelo?</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
              Deseja realmente excluir este modelo da engenharia? Esta ação removerá todas as fichas técnicas e consumos associados.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-3 px-4 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDelete(itemToDelete);
                  setItemToDelete(null);
                }}
                className="flex-1 py-3 px-4 rounded-xl font-bold bg-rose-500 text-white hover:bg-rose-600 active:scale-95 transition-all text-sm shadow-sm opacity-90"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Database size={24} />
             </div>
             <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Engenharia de Produto
                </h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Fichas Técnicas e Configurações
                </p>
             </div>
          </div>
        </div>
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Procurar modelos na engenharia..."
            className={`w-full border rounded-[1rem] py-4 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 dark:focus:ring-indigo-500/10 placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-800 dark:text-slate-100 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <button
        onClick={onAdd}
        className="mt-2 text-white bg-indigo-600 rounded-[1.5rem] py-5 flex items-center justify-center gap-3 font-black tracking-widest hover:bg-indigo-700 transition-all cursor-pointer shadow-lg shadow-indigo-500/20 active:scale-95 text-[11px] uppercase"
      >
        <Plus size={18} strokeWidth={3} /> Iniciar Nova Engenharia
      </button>

      {filteredProducts.length === 0 ? (
        <div
          className={`flex items-center justify-center text-center p-8 border rounded-[2rem] mt-2 border-dashed ${isDarkMode ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-100"}`}
        >
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
            Nenhum modelo em desenvolvimento encontrado.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mt-4">
          {filteredProducts.map((product) => (
            <EngineeringCard
              key={product.id}
              product={product}
              onEdit={() => onEdit(product.id)}
              onDelete={() => setItemToDelete(product.id)}
              onToggleStatus={() => onToggleStatus(product.id, product.status === ProductStatus.ACTIVE ? ProductStatus.INACTIVE : ProductStatus.ACTIVE)}
              isDarkMode={isDarkMode}
              categories={categories}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface EngineeringCardProps {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  isDarkMode: boolean;
  categories: Category[];
}

function EngineeringCard({
  product,
  onEdit,
  onDelete,
  onToggleStatus,
  isDarkMode,
  categories,
}: EngineeringCardProps) {
  const variationsCount = (product.variations || []).length;
  
  return (
    <div
      className={`rounded-[2rem] border shadow-sm dark:shadow-none overflow-hidden transition-all hover:shadow-md ${isDarkMode ? "bg-slate-900 border-slate-800 hover:border-slate-700" : "bg-white border-slate-100 hover:border-slate-200"}`}
    >
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 shrink-0 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-slate-50 border-slate-100 text-indigo-600'}`}>
               <Hammer size={28} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 block truncate">
                REF: {product.reference}
              </span>
              <h3 className="font-black text-lg text-slate-800 dark:text-white uppercase tracking-tight leading-tight line-clamp-2">
                {product.name}
              </h3>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button 
              onClick={onToggleStatus}
              className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${product.status === ProductStatus.ACTIVE ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}
            >
              <span className="text-[7.5px] font-black uppercase tracking-wider">
                {product.status === ProductStatus.ACTIVE ? 'Em Uso' : 'Inativo'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
           <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
              <Package size={14} className="text-indigo-500" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{variationsCount} Cores</span>
           </div>
           {product.categoryId && (
             <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  {categories.find(c => c.id === product.categoryId)?.name || 'S/ Cat'}
                </span>
             </div>
           )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
          >
            Editar Engenharia <ChevronRight size={16} />
          </button>
          <button
            onClick={onDelete}
            className={`w-12 h-12 flex items-center justify-center rounded-2xl border-2 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-slate-50 border-slate-100 text-rose-500 hover:bg-rose-500 hover:text-white'}`}
            title="Excluir Modelo"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}


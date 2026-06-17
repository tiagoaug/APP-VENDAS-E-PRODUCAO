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
  Hammer,
  Copy
} from "lucide-react";

interface ProductionEngineeringViewProps {
  products: Product[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
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
  onDuplicate,
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
        type="button"
        onClick={onAdd}
        className={`relative mt-2 rounded-[1.5rem] py-4 flex items-center justify-center gap-3 font-black tracking-widest transition-all cursor-pointer active:scale-[0.98] text-[11px] uppercase overflow-hidden ${
          isDarkMode
            ? 'bg-gradient-to-b from-slate-700 to-slate-900 border border-slate-600/40 text-white'
            : 'bg-gradient-to-b from-white to-slate-100 border border-slate-200/60 text-slate-700'
        } shadow-[0_6px_24px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-2px_0_rgba(0,0,0,0.07)]`}
      >
        <div className="absolute top-0 left-6 right-6 h-[1px] rounded-full bg-gradient-to-r from-transparent via-white to-transparent opacity-80 pointer-events-none" />
        <Plus size={16} strokeWidth={3} /> Iniciar Nova Engenharia
      </button>

      {filteredProducts.length === 0 ? (
        <div
          className={`flex items-center justify-center text-center p-8 border rounded-[2rem] mt-2 border-dashed ${isDarkMode ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-100"}`}
        >
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest">
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
              onDuplicate={() => onDuplicate(product.id)}
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
  onDuplicate: () => void;
  onToggleStatus: () => void;
  isDarkMode: boolean;
  categories: Category[];
}

function EngineeringCard({
  product,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
  isDarkMode,
  categories,
}: EngineeringCardProps) {
  const variationsCount = (product.variations || []).length;
  
  return (
    <div
      className={`rounded-[2rem] border shadow-sm dark:shadow-none overflow-hidden transition-all hover:shadow-md ${isDarkMode ? "bg-slate-900 border-slate-800 hover:border-slate-700" : "bg-white border-slate-100 hover:border-slate-200"}`}
    >
      {/* Card Header — full width */}
      <div className={`flex items-center justify-between px-5 py-3.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
        <div className="min-w-0 flex-1">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">
            REF: {product.reference}
          </span>
          <h3 className={`font-black text-base uppercase tracking-tight leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {product.name}
          </h3>
        </div>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ml-3 ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
          <Hammer size={16} />
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-3">
        {/* Actions row */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggleStatus}
            title={`Mudar para ${product.status === ProductStatus.ACTIVE ? 'Inativo' : 'Ativo'}`}
            aria-label={`Mudar status do produto para ${product.status === ProductStatus.ACTIVE ? 'Inativo' : 'Ativo'}`}
            className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap text-[10px] font-black uppercase tracking-wider ${product.status === ProductStatus.ACTIVE ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}
          >
            {product.status === ProductStatus.ACTIVE ? 'Em Uso' : 'Inativo'}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDuplicate}
              title="Duplicar Engenharia"
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-indigo-400' : 'bg-slate-100 text-slate-400 hover:text-indigo-500'}`}
            >
              <Copy size={15} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Excluir Modelo"
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 ${isDarkMode ? 'bg-slate-800 text-slate-500 hover:text-rose-400' : 'bg-slate-100 text-slate-400 hover:text-rose-500'}`}
            >
              <Trash2 size={15} />
            </button>
            <button
              type="button"
              onClick={onEdit}
              title="Editar Engenharia"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-amber-300 hover:bg-amber-400 text-amber-900 active:scale-90 transition-all shadow-sm"
            >
              <ChevronRight size={18} strokeWidth={3} />
            </button>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <Package size={11} className="text-slate-400" /> {variationsCount} Cores
          </span>
          {product.categoryId && (
            <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black text-slate-400 uppercase tracking-widest ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
              {categories.find(c => c.id === product.categoryId)?.name || 'S/ Cat'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


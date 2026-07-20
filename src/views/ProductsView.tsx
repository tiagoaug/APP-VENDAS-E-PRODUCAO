import { useState } from "react";
import { Product, ProductStatus, SaleType, AppModulesConfig } from "../types";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Package,
  Filter,
  ChevronDown,
  ChevronUp,
  Copy
} from "lucide-react";
import PrintLabelEditorModal from "../components/PrintLabelEditorModal";

interface ProductsViewProps {
  products: Product[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, status: ProductStatus) => void;
  onDuplicate: (product: Product) => void;
  isDarkMode: boolean;
  modulesConfig: AppModulesConfig;
}

export default function ProductsView({
  products,
  onAdd,
  onEdit,
  onDelete,
  onToggleStatus,
  onDuplicate,
  isDarkMode,
  modulesConfig,
}: ProductsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [productForLabels, setProductForLabels] = useState<Product | null>(null);

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
            <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-2">Excluir Produto?</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
              Deseja realmente excluir este produto? Esta ação não pode ser desfeita e todas as combinações de variações serão perdidas.
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
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {modulesConfig.production ? "Ficha Técnica de Produtos" : "Gestão de Produtos"}
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {modulesConfig.production ? "Produção e Modelos" : "Catálogo de Vendas"}
            </p>
          </div>
        </div>
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Procurar modelos..."
            className={`w-full border rounded-[1rem] py-4 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 dark:focus:ring-indigo-500/10 placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-800 dark:text-slate-100 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          className={`w-full border rounded-[1rem] py-4 px-4 text-sm font-medium flex items-center justify-between text-slate-600 dark:text-slate-300 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
        >
          <div className="flex items-center gap-3">
            <Filter size={16} className="text-slate-400" />
            Filtrar por Categoria
          </div>
          <ChevronDown size={18} className="text-slate-400" />
        </button>
      </div>

      <button
        onClick={onAdd}
        className="mt-2 text-white bg-indigo-600 rounded-[1rem] py-5 flex items-center justify-center gap-2 font-black tracking-widest hover:bg-indigo-700 transition-all cursor-pointer shadow-lg shadow-indigo-500/20 active:scale-95 text-[11px] uppercase"
      >
        <Plus size={18} strokeWidth={3} /> Cadastrar Novo Modelo
      </button>

      {filteredProducts.length === 0 ? (
        <div
          className={`flex items-center justify-center text-center p-8 border rounded-[1rem] mt-2 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}
        >
          <p className="text-slate-500 text-sm">
            Nenhum produto encontrado com os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mt-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={() => onEdit(product.id)}
              onDelete={() => setItemToDelete(product.id)}
              onToggleStatus={() => onToggleStatus(product.id, product.status === ProductStatus.ACTIVE ? ProductStatus.INACTIVE : ProductStatus.ACTIVE)}
              onDuplicate={() => onDuplicate(product)}
              isDarkMode={isDarkMode}
            />
          ))}
        </div>
      )}

      {productForLabels && (
        <PrintLabelEditorModal
          isOpen={!!productForLabels}
          onClose={() => setProductForLabels(null)}
          product={productForLabels}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onDuplicate: () => void;
  isDarkMode: boolean;
  key?: string;
}

function ProductCard({
  product,
  onEdit,
  onDelete,
  onToggleStatus,
  onDuplicate,
  isDarkMode,
}: ProductCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div
      className={`rounded-3xl border shadow-sm dark:shadow-none relative flex flex-col ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
    >
      {/* Linha 1: info — toca pra abrir/fechar as ações (acordeão) */}
      <button
        type="button"
        onClick={() => setIsExpanded(v => !v)}
        className="px-4 pt-4 pb-3 flex items-center gap-3 w-full text-left"
      >
        <div className="w-11 h-11 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700 flex-shrink-0">
          <Package size={22} className="text-indigo-500" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
            {product.reference}
          </span>
          <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight truncate">
            {product.name}
          </h3>
        </div>
        {isExpanded ? (
          <ChevronUp size={18} className="text-slate-400 shrink-0" />
        ) : (
          <ChevronDown size={18} className="text-slate-400 shrink-0" />
        )}
      </button>

      {/* Linha 2: ações — cápsulas neutras (fundo branco/3D), texto colorido */}
      {isExpanded && (
        <div className={`mx-4 mt-0.5 flex items-center gap-2 pb-3 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <button
            type="button"
            onClick={onDuplicate}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full border text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-[0_2px_6px_rgba(0,0,0,0.06)] ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
            title="Duplicar Modelo"
          >
            <Copy size={14} strokeWidth={2.5} /> Duplicar
          </button>
          <button
            type="button"
            onClick={onEdit}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full border text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-[0_2px_6px_rgba(0,0,0,0.06)] ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
            title="Editar"
          >
            <Edit size={14} strokeWidth={2.5} /> Editar
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={`w-10 h-10 flex items-center justify-center rounded-full border text-rose-500 active:scale-95 transition-all shadow-[0_2px_6px_rgba(0,0,0,0.06)] ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-rose-900/30' : 'bg-white border-slate-200 hover:bg-rose-50'}`}
            title="Excluir"
          >
            <Trash2 size={16} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Badges */}
      <div className="px-4 py-2.5 flex gap-2 items-center flex-wrap">
        {product.saleTypes?.includes(SaleType.WHOLESALE) && (
          <div className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 rounded-md">
            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Atacado</span>
          </div>
        )}
        {product.saleTypes?.includes(SaleType.RETAIL) && (
          <div className="px-2 py-0.5 bg-violet-50 dark:bg-violet-900/40 rounded-md">
            <span className="text-[9px] font-black text-violet-500 uppercase tracking-widest">Varejo</span>
          </div>
        )}
        {!product.saleTypes?.length && product.type === SaleType.WHOLESALE && (
          <div className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 rounded-md">
            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Atacado</span>
          </div>
        )}
        {!product.saleTypes?.length && product.type === SaleType.RETAIL && (
          <div className="px-2 py-0.5 bg-violet-50 dark:bg-violet-900/40 rounded-md">
            <span className="text-[9px] font-black text-violet-500 uppercase tracking-widest">Varejo</span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleStatus}
          className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${product.status === ProductStatus.ACTIVE ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200'}`}
        >
          <span className="text-[9px] font-black uppercase tracking-widest">
            {product.status === ProductStatus.ACTIVE ? 'Ativo' : 'Inativo'}
          </span>
        </button>
      </div>
    </div>
  );
}


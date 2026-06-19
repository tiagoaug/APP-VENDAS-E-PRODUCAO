import React from 'react';
import { X, Filter, Eraser } from 'lucide-react';
import Modal from './Modal';

export type PCPFilters = {
  mapa: string;
  cliente: string;
  referencia: string;
  cor: string;
  data: string;
};

interface PCPFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: PCPFilters;
  setFilters: (filters: PCPFilters) => void;
  isDarkMode: boolean;
  options?: {
    mapas: string[];
    clientes: string[];
    referencias: string[];
    cores: string[];
  };
}

export function PCPFilterModal({
  isOpen,
  onClose,
  filters,
  setFilters,
  isDarkMode,
  options = { mapas: [], clientes: [], referencias: [], cores: [] }
}: PCPFilterModalProps) {
  const handleClear = () => {
    setFilters({
      mapa: '',
      cliente: '',
      referencia: '',
      cor: '',
      data: ''
    });
    onClose();
  };

  const updateFilter = (key: keyof PCPFilters, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Filtros e Configurações"
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-6 p-2">
        
        {/* Filtros: Datalists para autocomplete */}
        <datalist id="mapas-list">
          {options.mapas.map((opt, i) => <option key={i} value={opt} />)}
        </datalist>
        <datalist id="clientes-list">
          {options.clientes.map((opt, i) => <option key={i} value={opt} />)}
        </datalist>
        <datalist id="referencias-list">
          {options.referencias.map((opt, i) => <option key={i} value={opt} />)}
        </datalist>
        <datalist id="cores-list">
          {options.cores.map((opt, i) => <option key={i} value={opt} />)}
        </datalist>

        {/* Filtro: Mapa */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Nº do Mapa
          </label>
          <input
            type="text"
            list="mapas-list"
            placeholder="Ex: 008, 120"
            value={filters.mapa}
            onChange={(e) => updateFilter('mapa', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border text-sm font-bold transition-colors ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500' 
                : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
            }`}
          />
        </div>

        {/* Filtro: Cliente */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Cliente / Pedido
          </label>
          <input
            type="text"
            list="clientes-list"
            placeholder="Nome do cliente ou nº do pedido"
            value={filters.cliente}
            onChange={(e) => updateFilter('cliente', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border text-sm font-bold transition-colors ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500' 
                : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
            }`}
          />
        </div>

        {/* Filtro: Referência */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Referência
          </label>
          <input
            type="text"
            list="referencias-list"
            placeholder="Ref. do modelo"
            value={filters.referencia}
            onChange={(e) => updateFilter('referencia', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border text-sm font-bold transition-colors ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500' 
                : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
            }`}
          />
        </div>

        {/* Filtro: Cor */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Cor / Combinação
          </label>
          <input
            type="text"
            list="cores-list"
            placeholder="Ex: Preto, Caramelo"
            value={filters.cor}
            onChange={(e) => updateFilter('cor', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border text-sm font-bold transition-colors ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500' 
                : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
            }`}
          />
        </div>

        {/* Filtro: Data */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Data (Emissão)
          </label>
          <input
            type="date"
            value={filters.data}
            onChange={(e) => updateFilter('data', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border text-sm font-bold transition-colors ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500 [color-scheme:dark]' 
                : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
            }`}
          />
        </div>

        {/* Botões Ação */}
        <div className="flex flex-col gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest flex justify-center items-center gap-2 transition-transform active:scale-95"
          >
            <Filter size={16} /> Ver Resultados
          </button>

          <button
            type="button"
            onClick={handleClear}
            className={`w-full py-3.5 rounded-xl border-2 text-xs font-black uppercase tracking-widest flex justify-center items-center gap-2 transition-transform active:scale-95 ${
              isDarkMode 
                ? 'border-rose-900/50 text-rose-500 hover:bg-rose-900/20' 
                : 'border-rose-100 text-rose-500 hover:bg-rose-50'
            }`}
          >
            <Eraser size={16} /> Limpar Filtros
          </button>
        </div>

      </div>
    </Modal>
  );
}

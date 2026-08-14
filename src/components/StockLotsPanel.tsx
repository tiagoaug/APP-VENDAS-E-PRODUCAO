import React, { useMemo } from "react";
import { StockLot } from "../types";
import { Boxes, User } from "lucide-react";

const StockLotCard: React.FC<{
  lot: StockLot;
  isDarkMode: boolean;
  showCustomer?: boolean;
}> = ({ lot, isDarkMode, showCustomer }) => {
  const orderNumber = lot.productionOrderNumber || lot.saleOrderNumber;
  const sizeEntries = Object.entries(lot.sizeBreakdown || {})
    .sort(([a], [b]) => parseFloat(a) - parseFloat(b));

  return (
    <div className={`p-4 rounded-2xl border flex flex-col gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
      <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight truncate">
        {lot.productReference && <span className="text-indigo-500 mr-1">{lot.productReference}</span>}
        {lot.productName} · {lot.variationName}
      </p>

      <div className="flex items-baseline gap-1.5">
        {lot.boxQty !== undefined ? (
          <>
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{lot.boxQty}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">caixas · {lot.totalPairs} pares</span>
          </>
        ) : (
          <>
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{lot.totalPairs}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">pares</span>
          </>
        )}
      </div>

      {sizeEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sizeEntries.map(([sz, qty]) => (
            <div key={sz} className={`px-2.5 py-1.5 rounded-xl border-2 text-center min-w-[36px] ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}>
              <p className="text-[7px] font-bold text-slate-400 leading-none">{sz}</p>
              <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 leading-none mt-0.5">{qty}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {lot.lotOrderNumber && (
          <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            Mapa #{lot.lotOrderNumber}
          </span>
        )}
        {orderNumber && (
          <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            Pedido #{orderNumber}
          </span>
        )}
        {showCustomer && lot.customerName && (
          <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
            {lot.customerName}
          </span>
        )}
        {lot.boxQty !== undefined && (
          <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            {lot.pkgName || 'Avulso'}
          </span>
        )}
      </div>
    </div>
  );
};

const StockLotsPanel: React.FC<{
  stockLots: StockLot[];
  isDarkMode: boolean;
  searchTerm: string;
}> = ({ stockLots, isDarkMode, searchTerm }) => {
  const term = searchTerm.toLowerCase();

  const filtered = useMemo(() => stockLots.filter(l =>
    l.productName.toLowerCase().includes(term) ||
    l.variationName.toLowerCase().includes(term) ||
    (l.customerName || '').toLowerCase().includes(term)
  ), [stockLots, term]);

  const emEstoque = filtered.filter(l => l.status === 'EM_ESTOQUE');
  const reservado = filtered.filter(l => l.status === 'RESERVADO');

  const totalPairs = (lots: StockLot[]) => lots.reduce((s, l) => s + l.totalPairs, 0);
  // boxQty representa quantas caixas aquela entrada cobre (ex.: 8 caixas de 12 pares).
  // Entradas sem boxQty (produtos sem embalagem padrão) contam como 1 caixa cada.
  const totalBoxes = (lots: StockLot[]) => lots.reduce((s, l) => s + (l.boxQty ?? 1), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-violet-100 dark:bg-violet-950/30">
          <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            <Boxes size={16} className="text-indigo-500" /> Registro de Produção
          </h3>
          <div className="px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-violet-700 text-white text-center leading-tight">
            <p>{totalBoxes(emEstoque)} caixa(s)</p>
            <p>{totalPairs(emEstoque)} pares</p>
          </div>
        </div>

        {emEstoque.length === 0 ? (
          <div className={`p-8 text-center border-2 border-dashed rounded-3xl ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
            <Boxes size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">Nenhuma caixa em estoque livre</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {emEstoque.map(lot => (
              <StockLotCard key={lot.id} lot={lot} isDarkMode={isDarkMode} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-violet-100 dark:bg-violet-950/30">
          <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            <User size={16} className="text-sky-500" /> Reservado p/ Pedidos
          </h3>
          <div className="px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-violet-700 text-white text-center leading-tight">
            <p>{totalBoxes(reservado)} caixa(s)</p>
            <p>{totalPairs(reservado)} pares</p>
          </div>
        </div>

        {reservado.length === 0 ? (
          <div className={`p-8 text-center border-2 border-dashed rounded-3xl ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
            <User size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">Nenhuma caixa reservada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {reservado.map(lot => (
              <StockLotCard key={lot.id} lot={lot} isDarkMode={isDarkMode} showCustomer />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockLotsPanel;

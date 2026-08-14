import React, { useMemo } from "react";
import { Product, Sale, SaleType, SaleStatus, ProductionOrder, StockLot } from "../types";
import { ChevronDown, ChevronRight, Truck, Clock, CheckCircle2, Users, Factory } from "lucide-react";
import { buildReservedBySale, getStockReadyQty as getStockReadyQtyUtil, isReadyToShip as isReadyToShipUtil } from '../utils/salesReadiness';

// Precisa ficar em escopo de módulo (fora de PedidosClientesPanel) — definida dentro, era
// recriada como um componente NOVO a cada render do painel (qualquer state mudando: busca,
// balanço, etc.), e o React desmontava/remontava a Section inteira, resetando `open` pro
// `defaultOpen` sempre. Por isso os acordeões nunca ficavam abertos/fechados de propósito.
const Section: React.FC<{
  title: string; icon: React.ReactNode; color: string; items: Sale[]; defaultOpen?: boolean;
  isDarkMode: boolean; renderItem: (item: Sale) => React.ReactNode;
}> = ({ title, icon, color, items, defaultOpen = true, isDarkMode, renderItem }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center justify-between gap-3 p-3 rounded-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100 shadow-sm'}`}
      >
        <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          <span className={color}>{icon}</span> {title}
        </h3>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
            {items.length}
          </span>
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        items.length === 0 ? (
          <div className={`p-8 text-center border-2 border-dashed rounded-3xl ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
            <p className="text-xs font-bold uppercase tracking-widest">Nenhum pedido</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(renderItem)}
          </div>
        )
      )}
    </div>
  );
};

const PedidosClientesPanel: React.FC<{
  sales: Sale[];
  stockLots: StockLot[];
  productionOrders: ProductionOrder[];
  products: Product[];
  isDarkMode: boolean;
  searchTerm: string;
}> = ({ sales, stockLots, productionOrders, products, isDarkMode, searchTerm }) => {
  const term = searchTerm.toLowerCase();

  // RESERVADO lots grouped by saleId
  const reservedBySale = useMemo(() => buildReservedBySale(stockLots), [stockLots]);

  const getStockReadyQty = (sale: Sale) => getStockReadyQtyUtil(sale, products);

  // Customer orders: all non-cancelled SALE status orders, excluding explicit STOCK destination
  const customerSales = useMemo(() => {
    return sales
      .filter(s =>
        s.status === SaleStatus.SALE &&
        s.saleDestination !== 'STOCK' &&
        (
          !term ||
          (s.customerName || '').toLowerCase().includes(term) ||
          (s.orderNumber || '').toLowerCase().includes(term)
        )
      )
      .sort((a, b) => b.date - a.date);
  }, [sales, term]);

  const isReadyToShip = (s: Sale) => isReadyToShipUtil(s, reservedBySale, products);

  const prontos = customerSales.filter(s => s.deliveryStatus !== 'DELIVERED' && isReadyToShip(s));
  const aguardando = customerSales.filter(s => s.deliveryStatus !== 'DELIVERED' && !isReadyToShip(s));
  const entregues = customerSales.filter(s => s.deliveryStatus === 'DELIVERED');

  const SaleRow: React.FC<{ sale: Sale }> = ({ sale }) => {
    const lots = reservedBySale.get(sale.id) || [];
    const po = productionOrders.find(o => o.id === sale.productionOrderId);
    const stockReadyQty = getStockReadyQty(sale);
    const fromGeneralStock = lots.length === 0 && stockReadyQty > 0;
    const totalBoxes = lots.reduce((s, l) => s + (l.boxQty ?? 1), 0);
    const totalPairs = lots.reduce((s, l) => s + l.totalPairs, 0);
    const isDelivered = sale.deliveryStatus === 'DELIVERED';
    const isReady = !isDelivered && (lots.length > 0 || stockReadyQty > 0);
    const isWaiting = !isDelivered && !isReady;

    return (
      <div className={`p-3 rounded-2xl border ${
        isDelivered
          ? (isDarkMode ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-100')
          : isReady
            ? (isDarkMode ? 'bg-emerald-900/15 border-emerald-800/40' : 'bg-emerald-50 border-emerald-100')
            : (isDarkMode ? 'bg-orange-900/15 border-orange-800/30' : 'bg-orange-50 border-orange-100')
      }`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${
                isDelivered
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  : isReady
                    ? 'bg-emerald-500 text-white'
                    : 'bg-orange-400 text-white'
              }`}>
                {isDelivered ? 'Entregue' : isReady ? 'Pronto para Expedir' : 'Aguardando'}
              </span>
              <span className="text-[9px] font-bold text-slate-400">#{sale.orderNumber}</span>
            </div>
            <p className={`text-[12px] font-black uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              {sale.customerName || 'Cliente não informado'}
            </p>
          </div>
          <div className="text-right shrink-0">
            {isReady && lots.length > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">{totalBoxes} cx</span>
                <span className="text-[9px] font-bold text-slate-400">{totalPairs} pares</span>
              </div>
            )}
            {isReady && fromGeneralStock && (
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                  {stockReadyQty} {sale.items.some(it => it.saleType === SaleType.WHOLESALE) ? 'cx' : 'pares'}
                </span>
                <span className="text-[9px] font-bold text-slate-400">estoque comum</span>
              </div>
            )}
            {isWaiting && po && (
              <span className="text-[9px] font-black uppercase tracking-widest text-orange-500">
                {po.status === 'IN_PRODUCTION' ? 'Em Produção' : 'Ag. Produção'}
              </span>
            )}
          </div>
        </div>

        {/* Lot details (when ready) */}
        {isReady && lots.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {lots.map(lot => {
              const prod = products.find(p => p.id === lot.productId);
              return (
                <div key={lot.id} className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl ${isDarkMode ? 'bg-emerald-900/20' : 'bg-emerald-100/60'}`}>
                  <div className="min-w-0">
                    <p className={`text-[10px] font-black uppercase truncate ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>
                      {prod?.reference ? `${prod.reference} · ` : ''}{lot.productName}
                    </p>
                    <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-500 mt-0.5">
                      {lot.variationName} · {lot.gradeLabel}
                    </p>
                  </div>
                  <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 shrink-0">
                    {lot.boxQty ?? 1} cx
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Production order link */}
        {po && !isDelivered && (
          <div className={`mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg ${isDarkMode ? 'bg-slate-800/60' : 'bg-white/70'}`}>
            <Factory size={10} className="text-indigo-500 shrink-0" />
            <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500">
              OP #{po.orderNumber} · {po.status === 'COMPLETED' ? 'Concluída' : po.status === 'IN_PRODUCTION' ? 'Em Produção' : 'Pendente'}
            </span>
          </div>
        )}
      </div>
    );
  };

  if (customerSales.length === 0 && !term) {
    return (
      <div className={`p-12 text-center border-2 border-dashed rounded-3xl ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
        <Users size={40} className="mx-auto mb-3 opacity-20" />
        <p className="text-xs font-bold uppercase tracking-widest">Nenhum pedido de cliente</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Prontos para Expedir"
        icon={<Truck size={16} />}
        color="text-emerald-500"
        items={prontos}
        defaultOpen={false}
        isDarkMode={isDarkMode}
        renderItem={(s) => <SaleRow key={s.id} sale={s} />}
      />
      <Section
        title="Aguardando Expedição"
        icon={<Clock size={16} />}
        color="text-orange-500"
        items={aguardando}
        defaultOpen={false}
        isDarkMode={isDarkMode}
        renderItem={(s) => <SaleRow key={s.id} sale={s} />}
      />
      {entregues.length > 0 && (
        <Section
          title="Entregues"
          icon={<CheckCircle2 size={16} />}
          color="text-slate-400"
          items={entregues}
          defaultOpen={false}
          isDarkMode={isDarkMode}
          renderItem={(s) => <SaleRow key={s.id} sale={s} />}
        />
      )}
    </div>
  );
};

export default PedidosClientesPanel;

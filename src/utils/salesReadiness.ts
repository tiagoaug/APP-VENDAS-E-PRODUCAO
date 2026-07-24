import { Product, Sale, SaleStatus, SaleType, StockLot } from '../types';

// Fonte única de "pedido pronto pra expedir" — antes vivia só dentro de StockView.tsx
// (PedidosClientesPanel). Extraído aqui pra o módulo Entregas (builder de rota) usar
// exatamente a mesma lógica, sem duas implementações divergindo com o tempo.

export function buildReservedBySale(stockLots: StockLot[]): Map<string, StockLot[]> {
  const map = new Map<string, StockLot[]>();
  stockLots.filter(l => l.status === 'RESERVADO' && l.saleId).forEach(l => {
    const arr = map.get(l.saleId!) || [];
    arr.push(l);
    map.set(l.saleId!, arr);
  });
  return map;
}

// Quantidade já disponível no estoque comum para os itens ainda não separados de uma
// venda SEM ordem de produção — vendas com produção só podem separar a partir do lote
// reservado (nunca caem no estoque agregado), por isso retornam sempre 0 aqui.
export function getStockReadyQty(sale: Sale, products: Product[]): number {
  if (sale.productionOrderId) return 0;
  return sale.items.reduce((sum, item) => {
    if (item.fulfilled === true) return sum;
    const needed = item.quantity - (item.boxesSeparated || 0);
    if (needed <= 0) return sum;
    const product = products.find(p => p.id === item.productId);
    const variation = product?.variations.find(v => v.id === item.variationId);
    const key = item.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (item.size || '');
    const available = variation?.stock[key] || 0;
    return sum + Math.min(available, needed);
  }, 0);
}

// Pronta para expedir: tem lote reservado da produção OU (sem ordem de produção) já
// tem estoque comum suficiente para separar pelo menos um item. Sem nenhum dos dois, é
// uma venda genuinamente aguardando — produção, no caso de pedidos com OP, ou reposição
// de estoque, no caso de vendas de estoque comum.
export function isReadyToShip(sale: Sale, reservedBySale: Map<string, StockLot[]>, products: Product[]): boolean {
  return (reservedBySale.get(sale.id) || []).length > 0 || getStockReadyQty(sale, products) > 0;
}

export function bucketSalesByReadiness(
  sales: Sale[],
  stockLots: StockLot[],
  products: Product[],
): { prontos: Sale[]; aguardando: Sale[]; entregues: Sale[]; reservedBySale: Map<string, StockLot[]> } {
  const reservedBySale = buildReservedBySale(stockLots);
  const customerSales = sales.filter(s => s.status === SaleStatus.SALE && s.saleDestination !== 'STOCK');
  const prontos = customerSales.filter(s => s.deliveryStatus !== 'DELIVERED' && isReadyToShip(s, reservedBySale, products));
  const aguardando = customerSales.filter(s => s.deliveryStatus !== 'DELIVERED' && !isReadyToShip(s, reservedBySale, products));
  const entregues = customerSales.filter(s => s.deliveryStatus === 'DELIVERED');
  return { prontos, aguardando, entregues, reservedBySale };
}

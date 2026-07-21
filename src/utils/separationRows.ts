import { Sale, SaleItem, Product, Variation, StockLot, SaleType } from '../types';

export interface SeparationRow {
  idx: number;
  item: SaleItem;
  product: Product | undefined;
  variation: Variation | undefined;
  unit: string;
  separated: number;
  remaining: number;
  itemLots: StockLot[];
  hasReserved: boolean;
  stockAvailable: number;
  maxSeparable: number;
}

/**
 * Monta, por item da venda, quanto ainda falta separar e o teto do que pode ser separado
 * agora (a partir de lotes reservados de produção OU do estoque geral, conforme a venda
 * tenha ou não Pedido de Produção vinculado). Usado pela UI (SeparacaoCaixasModal,
 * SalesView) só para exibir/limitar quantidade — a seleção do StockLot específico a
 * consumir acontece depois, no momento de confirmar (ver src/utils/stockLotPicker.ts),
 * não aqui. Extraído porque essa mesma conta existia triplicada.
 */
export function buildSeparationRows(sale: Sale, products: Product[], stockLots: StockLot[]): SeparationRow[] {
  const reservedLots = stockLots.filter(l => l.saleId === sale.id && l.status === 'RESERVADO');

  return sale.items.map((item, idx) => {
    const product = products.find(p => p.id === item.productId);
    const variation = product?.variations.find(v => v.id === item.variationId);
    const unit = item.saleType === SaleType.WHOLESALE ? 'cx' : 'pares';
    const separated = item.boxesSeparated || 0;
    const remaining = Math.max(0, item.quantity - separated);

    const itemLots = reservedLots.filter(l => l.productId === item.productId && l.variationId === item.variationId);
    const hasReserved = itemLots.length > 0;

    const stockKey = item.saleType === SaleType.WHOLESALE ? 'WHOLESALE' : (item.size || '');
    const stockAvailable = (variation?.stock as any)?.[stockKey] || 0;

    // Venda com produção atrelada = grade avulsa feita sob medida para o cliente (o
    // produto padrão não atendia) — nunca cai no estoque agregado, só pode vir do lote
    // reservado para esta venda (mesma composição exata). Vale pra qualquer saleType.
    const maxFromLots = itemLots.reduce((s, l) => s + (l.boxQty || 1), 0);
    const maxSeparable = sale.productionOrderId
      ? (hasReserved ? Math.min(remaining, maxFromLots) : 0)
      : Math.min(remaining, stockAvailable);

    return { idx, item, product, variation, unit, separated, remaining, itemLots, hasReserved, stockAvailable, maxSeparable };
  });
}

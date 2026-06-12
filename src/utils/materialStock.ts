import { ProductionConfigItem } from '../types';

// Insumos com cores cadastradas (metadata.colorIds) controlam o estoque por cor em
// metadata.stockByColor — o campo metadata.stock genérico não é mantido para eles.
// Estas funções centralizam essa regra para que qualquer tela que precise do estoque
// de um insumo (necessidades de compra, alertas de estoque mínimo, etc.) leia o valor
// correto independente de como o insumo foi cadastrado.

/** Estoque total de um insumo, somando por cor quando o cadastro usa metadata.colorIds + stockByColor. */
export function getTotalMaterialStock(item: ProductionConfigItem | undefined | null): number {
  if (!item) return 0;
  if (item.metadata?.colorIds?.length) {
    return Object.values(item.metadata.stockByColor || {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
  }
  return Number(item.metadata?.stock) || 0;
}

/** Estoque de uma cor específica de um insumo (ou estoque geral se o insumo não usa cores). */
export function getMaterialStockForColor(item: ProductionConfigItem | undefined | null, colorId?: string): number {
  if (!item) return 0;
  if (colorId && item.metadata?.colorIds?.length) {
    return Number(item.metadata?.stockByColor?.[colorId]) || 0;
  }
  return Number(item.metadata?.stock) || 0;
}

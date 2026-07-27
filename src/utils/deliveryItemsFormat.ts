import { DeliveryItemRef, Product, SaleType } from '../types';

// Formata um checklist de itens de entrega em modo lista compacto — ex.:
// "2 cx 300 preto, 1 cx 320 castor" — usado tanto no card da venda (prévia do que foi
// cadastrado) quanto na tela de entrega (conferência da parada).
export function formatDeliveryItemsList(items: DeliveryItemRef[] | undefined, products: Product[]): string {
  if (!items || items.length === 0) return '';
  return items
    .map(item => {
      const product = products.find(p => p.id === item.productId);
      const variation = product?.variations.find(v => v.id === item.variationId);
      const unit = item.saleType === SaleType.WHOLESALE ? 'cx' : 'pares';
      const ref = product?.reference || product?.name || '?';
      const color = variation?.colorName ? ` ${variation.colorName}` : '';
      const size = item.size ? ` Nº${item.size}` : '';
      return `${item.quantity} ${unit} ${ref}${color}${size}`;
    })
    .join(', ');
}

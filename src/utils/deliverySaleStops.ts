import { Carrier, DeliveryItemRef, Sale } from '../types';

export type SaleStopLocation = {
  lat: number;
  lng: number;
  addressLabel?: string;
  // Presente quando este ponto é atendido por uma transportadora — do endereço adicional
  // (AdditionalDeliveryAddress.carrierId), não do Sale.carrierId do endereço principal (esse
  // continua identificado só pelo próprio Sale.carrierId de quem chama esta função).
  carrierId?: string;
  // Checklist de itens cadastrado pra este endereço específico (Sale.deliveryItems no
  // principal, AdditionalDeliveryAddress.deliveryItems nos adicionais) — opcional.
  deliveryItems?: DeliveryItemRef[];
  // Observação cadastrada junto do checklist (Sale.deliveryItemsNote / AdditionalDeliveryAddress.deliveryItemsNote).
  deliveryItemsNote?: string;
};

function carrierLocation(carrierId: string, carriers: Carrier[]): { lat: number; lng: number } | null {
  const carrier = carriers.find(c => c.id === carrierId);
  if (carrier?.address?.lat !== undefined && carrier?.address?.lng !== undefined) {
    return { lat: carrier.address.lat, lng: carrier.address.lng };
  }
  return null;
}

// Ponto de entrega do endereço PRINCIPAL do pedido — o endereço CADASTRADO da transportadora
// se o pedido usa uma (Sale.carrierId; o motorista leva ATÉ ela, que faz a última milha),
// senão o próprio Sale.deliveryAddress.
export function getMainStopLocation(sale: Sale, carriers: Carrier[]): SaleStopLocation | null {
  const deliveryItems = sale.deliveryItems && sale.deliveryItems.length > 0 ? sale.deliveryItems : undefined;
  const deliveryItemsNote = sale.deliveryItemsNote || undefined;
  if (sale.carrierId) {
    const loc = carrierLocation(sale.carrierId, carriers);
    return loc ? { ...loc, deliveryItems, deliveryItemsNote } : null;
  }
  if (sale.deliveryAddress?.lat !== undefined && sale.deliveryAddress?.lng !== undefined) {
    return { lat: sale.deliveryAddress.lat, lng: sale.deliveryAddress.lng, deliveryItems, deliveryItemsNote };
  }
  return null;
}

// Pontos de entrega dos endereços ADICIONAIS do pedido (Sale.additionalDeliveryAddresses) —
// cada um independente do endereço principal, podendo ir direto ou por transportadora própria.
export function getAdditionalStopLocations(sale: Sale, carriers: Carrier[]): SaleStopLocation[] {
  return (sale.additionalDeliveryAddresses || [])
    .map((entry, i): SaleStopLocation | null => {
      const addressLabel = `Endereço ${i + 2}`;
      const deliveryItems = entry.deliveryItems && entry.deliveryItems.length > 0 ? entry.deliveryItems : undefined;
      const deliveryItemsNote = entry.deliveryItemsNote || undefined;
      if (entry.carrierId) {
        const loc = carrierLocation(entry.carrierId, carriers);
        return loc ? { ...loc, addressLabel, carrierId: entry.carrierId, deliveryItems, deliveryItemsNote } : null;
      }
      if (entry.address?.lat !== undefined && entry.address?.lng !== undefined) {
        return { lat: entry.address.lat, lng: entry.address.lng, addressLabel, deliveryItems, deliveryItemsNote };
      }
      return null;
    })
    .filter((l): l is SaleStopLocation => l !== null);
}

// Todos os pontos de entrega de um pedido, na ordem em que devem virar paradas de rota:
// endereço principal primeiro, depois cada endereço adicional com pin válido. Usada onde não
// precisa distinguir principal de adicional (elegibilidade, "adicionar pedido" avulso) — pra
// montar a rota de fato com o agrupamento de pedidos na mesma transportadora, ver
// getMainStopLocation/getAdditionalStopLocations em separado (DeliveryRouteBuilderView).
export function getSaleStopLocations(sale: Sale, carriers: Carrier[]): SaleStopLocation[] {
  const main = getMainStopLocation(sale, carriers);
  return [...(main ? [main] : []), ...getAdditionalStopLocations(sale, carriers)];
}

import { firebaseService } from '../services/firebaseService';
import { ProductionOrder, ProductionLot, ServiceOrder } from '../types';

// Funções de "seed" para firebaseService.getNextSequence — calculam o maior número
// já emitido na coleção (via regex sobre o campo de número exibido) para inicializar
// o contador persistido na primeira chamada, sem precisar de migração manual.

function maxFromPattern(values: (string | undefined)[], pattern: RegExp): number {
  let max = 0;
  values.forEach(value => {
    if (!value) return;
    const match = value.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > max) max = num;
    }
  });
  return max;
}

export async function seedProductionOrderSequence(): Promise<number> {
  const orders = await firebaseService.getCollection<ProductionOrder>('productionOrders');
  return maxFromPattern(orders.map(o => o.orderNumber), /OP #(\d+)/);
}

// Cobre os dois formatos usados hoje ("013" no PCP e "Lote #013" no fluxo de venda) —
// ambos terminam em dígitos, então a mesma regex serve para os dois.
export async function seedProductionLotSequence(): Promise<number> {
  const lots = await firebaseService.getCollection<ProductionLot>('productionLots');
  return maxFromPattern(lots.map(l => l.orderNumber), /(\d+)\s*$/);
}

export async function seedServiceOrderSequence(): Promise<number> {
  const orders = await firebaseService.getCollection<ServiceOrder>('serviceOrders');
  return maxFromPattern(orders.map(o => o.osNumber), /OS-(\d+)/i);
}

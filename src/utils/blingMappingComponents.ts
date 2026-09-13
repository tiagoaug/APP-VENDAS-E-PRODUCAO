import { BlingProductMapping, BlingMappingComponent } from '../types';

// Ponto único de leitura de um BlingProductMapping — nunca ler mapping.productId/variationId/
// size direto num consumidor novo, sempre passar pela normalização aqui, pra já funcionar tanto
// pro vínculo simples (1 produto, components ausente) quanto pro kit (vários produtos).
export function getMappingComponents(mapping: BlingProductMapping): BlingMappingComponent[] {
  if (mapping.components && mapping.components.length > 0) return mapping.components;
  return [{
    productId: mapping.productId,
    productName: mapping.productName,
    variationId: mapping.variationId,
    variationName: mapping.variationName,
    size: mapping.size,
    quantidade: 1,
  }];
}

export function isKitMapping(mapping: BlingProductMapping): boolean {
  return !!mapping.components && mapping.components.length > 1;
}

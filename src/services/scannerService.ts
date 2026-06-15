import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { toast } from '../utils/toast';
import { firebaseService } from './firebaseService';
import type { Product, ProductionLot } from '../types';

export const SCAN_HISTORY_KEY = 'dashboard_scan_history';

export type ScanHistoryEntry = {
  id: string;
  kind: 'PRODUCT' | 'LOT' | 'SOLE' | 'OS';
  label: string;
  sublabel?: string;
  sectorId?: string;
  timestamp: number;
};

export type ScanNavigationTarget = {
  sectorId?: string;
  lotId?: string;
  orderId?: string;
  itemIdx?: string | number;
  // Identificador único por leitura — usado para forçar o PCP a reprocessar o
  // foco no pedido escaneado mesmo quando o mesmo Mapa/pedido já está aberto.
  scanNonce?: number;
};

export type ScanResolution =
  | { ok: true; entry: ScanHistoryEntry; nav: ScanNavigationTarget }
  | { ok: false; error: string };

// Mensagens de erro compartilhadas entre os Scanners Rápidos (cabeçalho/Dashboard,
// via resolveScanResult) e o botão "Escanear" do PCP (handleScanLotResult em
// PCPView.tsx), para que o usuário veja a mesma explicação independente de qual
// scanner usou.
export const SCAN_ERRORS = {
  noRoute: 'Esta etiqueta não está vinculada a um pedido/Mapa. Reimprima a etiqueta a partir do MAPA para habilitar a abertura direta.',
  lotNotFound: (lotId: string) => `Mapa #${lotId} não encontrado. Ele pode ter sido excluído.`,
  sole: 'Código de molde de solado não pode ser aberto pelo Scanner do PCP.',
};

export const scannerService = {
  async checkPermissions(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'web') return true;

    const status = await BarcodeScanner.checkPermissions();
    if (status.camera === 'granted') return true;

    const request = await BarcodeScanner.requestPermissions();
    if (request.camera !== 'granted') {
      toast.show('Permissão de câmera negada. Acesse as configurações do celular e permita o acesso à câmera para este app.');
      return false;
    }
    return true;
  },

  async ensureModuleInstalled(): Promise<boolean> {
    if (Capacitor.getPlatform() !== 'android') return true;
    try {
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        toast.show('Instalando módulo de leitura QR Code. Aguarde alguns segundos e tente novamente.');
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        // Give it a moment to install
        await new Promise(r => setTimeout(r, 3000));
        const check = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        return check.available;
      }
      return true;
    } catch (e) {
      console.warn('Módulo Google Barcode Scanner:', e);
      // Module might already be built-in — try anyway
      return true;
    }
  },

  async scan(): Promise<string | null> {
    if (Capacitor.getPlatform() === 'web') {
      // On web, scanning is handled by WebCameraScanner component embedded in the modal.
      // This path is only reached as a last resort (e.g. from ScannerModal on web).
      return null;
    }

    const hasPermission = await this.checkPermissions();
    if (!hasPermission) return null;

    const moduleReady = await this.ensureModuleInstalled();
    if (!moduleReady) {
      toast.show('Módulo de câmera não disponível. Use a entrada manual.');
      return null;
    }

    try {
      const result = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode, BarcodeFormat.Code128, BarcodeFormat.Ean13],
      });

      if (result.barcodes.length > 0) {
        return result.barcodes[0].displayValue;
      }
      return null;
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error('Erro ao escanear:', msg);

      // User cancelled — not an error
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('dismiss')) {
        return null;
      }

      toast.show(`Erro ao abrir câmera: ${msg}\n\nUse a entrada manual abaixo.`);
      return null;
    }
  },

  parseScanResult(data: string) {
    const parts = data.split('|');
    if (parts[0] === 'PRD' && parts.length >= 4) {
      const result: { type: 'PRODUCT'; productId: string; variationId: string; size: string; lotId?: string; orderId?: string; itemIdx?: string } = {
        type: 'PRODUCT', productId: parts[1], variationId: parts[2], size: parts[3],
      };
      // Etiquetas de pedido vinculado embutem o mapa/pedido de origem para roteamento.
      if (parts.length >= 6 && parts[4] && parts[5]) {
        result.lotId = parts[4];
        result.orderId = parts[5];
        if (parts[6] !== undefined && parts[6] !== '') result.itemIdx = parts[6];
      }
      return result;
    }
    if (parts[0] === 'LOT' && parts.length >= 2) {
      return { type: 'LOT' as const, lotId: parts[1] };
    }
    if (parts[0] === 'SOL' && parts.length >= 4) {
      return { type: 'SOLE' as const, moldId: parts[1], colorId: parts[2], size: parts[3] };
    }
    if (parts[0] === 'OS' && parts.length >= 2) {
      return { type: 'OS' as const, osId: parts[1] };
    }
    return null;
  },

  // Busca um Mapa por ID primeiro na lista local (já sincronizada) e, se não
  // encontrar, vai direto ao Firestore — "carrega diretamente" o Mapa mesmo que
  // a subscription local ainda não tenha esse documento (ex.: leitura logo após
  // a criação/edição do Mapa em outra sessão).
  async findLotById(lotId: string, productionLots: ProductionLot[]): Promise<ProductionLot | null> {
    const local = productionLots.find(l => l.id === lotId);
    if (local) return local;
    return firebaseService.getDocument<ProductionLot>('productionLots', lotId);
  },

  // Resolve um resultado já parseado (parseScanResult) em uma entrada de histórico
  // e nos parâmetros de navegação do PCP, usados por ambos os scanners rápidos
  // (cabeçalho e Dashboard) — garante que os dois tenham o mesmo comportamento.
  //
  // Diferente da versão anterior (síncrona, apenas consultava a lista local
  // `productionLots`), esta versão é assíncrona e busca o Mapa direto no
  // Firestore quando ele não está na lista local, evitando o caso em que o
  // scanner "navega" para o PCP mas não encontra nada para abrir. Também retorna
  // mensagens de erro específicas (`ok: false`) para cada motivo de falha, em vez
  // de simplesmente deixar o app cair na tela de Setores sem explicação.
  async resolveScanResult(parsed: any, products: Product[], productionLots: ProductionLot[]): Promise<ScanResolution> {
    if (parsed?.type === 'PRODUCT') {
      if (!parsed.lotId || !parsed.orderId) {
        return { ok: false, error: SCAN_ERRORS.noRoute };
      }
      const lot = await this.findLotById(parsed.lotId, productionLots);
      if (!lot) {
        return { ok: false, error: SCAN_ERRORS.lotNotFound(parsed.lotId) };
      }
      const product = products.find(p => p.id === parsed.productId);
      const variation = product?.variations?.find((v: any) => v.id === parsed.variationId);
      const sectorId = lot.route?.[lot.currentSectorIndex];
      const subParts = [variation?.colorName, `Tam ${parsed.size}`, `Mapa #${lot.orderNumber}`].filter(Boolean);
      return {
        ok: true,
        entry: { id: `${Date.now()}`, kind: 'PRODUCT', label: product?.name || 'Produto', sublabel: subParts.join(' • '), sectorId, timestamp: Date.now() },
        nav: { sectorId, lotId: parsed.lotId, orderId: parsed.orderId, itemIdx: parsed.itemIdx, scanNonce: Date.now() },
      };
    }
    if (parsed?.type === 'LOT') {
      const lot = await this.findLotById(parsed.lotId, productionLots);
      if (!lot) {
        return { ok: false, error: SCAN_ERRORS.lotNotFound(parsed.lotId) };
      }
      const product = products.find(p => p.id === lot.productId);
      const sectorId = lot.route?.[lot.currentSectorIndex];
      return {
        ok: true,
        entry: { id: `${Date.now()}`, kind: 'LOT', label: `Mapa #${lot.orderNumber}`, sublabel: product?.name, sectorId, timestamp: Date.now() },
        nav: { sectorId, lotId: parsed.lotId, scanNonce: Date.now() },
      };
    }
    if (parsed?.type === 'SOLE') {
      return { ok: false, error: 'Código de molde de solado não pode ser aberto pelo Scanner Rápido.' };
    }
    if (parsed?.type === 'OS') {
      return { ok: false, error: 'Para abrir uma Ordem de Serviço, use o botão "Escanear" dentro do Mapa, no PCP.' };
    }
    return { ok: false, error: 'Código não reconhecido.' };
  },

  // Adiciona uma entrada ao histórico de scans compartilhado (chave usada pelo
  // Dashboard) e retorna a lista atualizada.
  pushScanHistory(entry: ScanHistoryEntry): ScanHistoryEntry[] {
    try {
      const existing = JSON.parse(localStorage.getItem(SCAN_HISTORY_KEY) || '[]');
      const updated = [entry, ...existing].slice(0, 10);
      localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    } catch {
      return [entry];
    }
  },

  async toggleTorch(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try { await BarcodeScanner.toggleTorch(); } catch (e) { /* ignore */ }
    }
  },

  async installGoogleBarcodeScanner(): Promise<void> {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
      } catch (e) {
        console.warn('Google Barcode Scanner installation failed or already installed', e);
      }
    }
  },
};

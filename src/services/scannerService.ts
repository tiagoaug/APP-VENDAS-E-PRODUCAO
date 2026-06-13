import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { toast } from '../utils/toast';

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

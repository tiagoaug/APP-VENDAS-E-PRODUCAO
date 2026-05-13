import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';

export const scannerService = {
  async checkPermissions(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'web') return true;

    const status = await BarcodeScanner.checkPermissions();
    if (status.camera === 'granted') return true;
    
    const request = await BarcodeScanner.requestPermissions();
    return request.camera === 'granted';
  },

  async scan(): Promise<string | null> {
    if (Capacitor.getPlatform() === 'web') {
      const manualCode = prompt('Modo Web: Insira o código manualmente ou use um leitor USB:');
      return manualCode || null;
    }

    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      alert('Permissão de câmera negada.');
      return null;
    }

    try {
      // For a simple single scan, we use scan()
      // Note: scan() requires the Google Barcode Scanner module on Android
      const result = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode, BarcodeFormat.Code128, BarcodeFormat.Ean13],
      });

      if (result.barcodes.length > 0) {
        return result.barcodes[0].displayValue;
      }
      return null;
    } catch (error) {
      console.error('Erro ao escanear:', error);
      return null;
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

  parseScanResult(data: string) {
    const parts = data.split('|');
    if (parts[0] === 'PRD' && parts.length >= 4) {
      return {
        type: 'PRODUCT',
        productId: parts[1],
        variationId: parts[2],
        size: parts[3]
      };
    }
    if (parts[0] === 'LOT' && parts.length >= 2) {
      return {
        type: 'LOT',
        lotId: parts[1]
      };
    }
    if (parts[0] === 'SOL' && parts.length >= 4) {
      return {
        type: 'SOLE',
        moldId: parts[1],
        colorId: parts[2],
        size: parts[3]
      };
    }
    return null;
  },

  async toggleTorch(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await BarcodeScanner.toggleTorch();
    }
  }
};

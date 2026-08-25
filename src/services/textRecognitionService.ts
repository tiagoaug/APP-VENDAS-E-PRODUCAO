import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import { Capacitor } from '@capacitor/core';
import { toast } from '../utils/toast';

// OCR local (ML Kit, mesmo pacote/família do scanner de código de barras — ver
// scannerService.ts) — usado pelo "Colar Pedido Digitado" (PasteOrderModal) pra extrair texto
// de um print/foto direto pro textarea, em vez de digitar. Diferente do barcode-scanning, os
// modelos de idioma do Text Recognition vêm EMBUTIDOS no app: não tem a dança de "instalar
// módulo do Google Play Services" que o scanner precisa.
export const textRecognitionService = {
  isSupported(): boolean {
    return Capacitor.getPlatform() !== 'web';
  },

  // `path` precisa ser um caminho de arquivo local (photo.path do Camera.getPhoto com
  // resultType: Uri) — não aceita data URL base64.
  async extractText(path: string): Promise<string | null> {
    if (!this.isSupported()) {
      toast.show('Reconhecimento de texto só funciona no aplicativo instalado (não no navegador).');
      return null;
    }
    try {
      const result = await TextRecognition.processImage({ path });
      const text = (result.text || '').trim();
      if (!text) {
        toast.show('Nenhum texto foi encontrado nesta imagem. Tente uma foto mais nítida ou digite manualmente.');
        return null;
      }
      return text;
    } catch (error: any) {
      const msg = String(error?.message || error || '');
      if (/cancel/i.test(msg)) return null;
      toast.show('Erro ao reconhecer texto da imagem: ' + msg);
      return null;
    }
  },
};

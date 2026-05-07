import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { jsPDF } from 'jspdf';

/**
 * Shares a jsPDF document using native share on mobile or downloads it on web.
 */
export const sharePDF = async (doc: jsPDF, filename: string) => {
  // Ensure filename has .pdf extension
  if (!filename.toLowerCase().endsWith('.pdf')) {
    filename += '.pdf';
  }

  if (Capacitor.getPlatform() === 'web') {
    doc.save(filename);
  } else {
    try {
      // Get PDF as base64 string
      const pdfOutput = doc.output('arraybuffer');
      const base64 = arrayBufferToBase64(pdfOutput);

      // Save to cache directory
      const result = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });

      // Share the file
      await Share.share({
        title: filename,
        text: 'Arquivo PDF gerado pelo App Vendas e Produção',
        url: result.uri,
      });
    } catch (error) {
      console.error('Error sharing PDF:', error);
      // Fallback for some mobile browsers that might fail
      try {
          doc.save(filename);
      } catch (e) {
          alert('Erro ao compartilhar PDF. Tente novamente.');
      }
    }
  }
};

/**
 * Helper to convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

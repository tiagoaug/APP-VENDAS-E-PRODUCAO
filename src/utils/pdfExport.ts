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
      // Use native datauristring and strip prefix for better compatibility
      const dataUri = doc.output('datauristring');
      const base64 = dataUri.split('base64,')[1];

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
      // Fallback for some mobile browsers
      try {
        doc.save(filename);
      } catch (e) {
        alert('Erro ao compartilhar PDF. Tente novamente.');
      }
    }
  }
};

/**
 * Shares a base64 image using native share on mobile or downloads it on web.
 */
export const shareImage = async (base64: string, filename: string) => {
  if (!filename.toLowerCase().endsWith('.jpg') && !filename.toLowerCase().endsWith('.jpeg')) {
    filename += '.jpg';
  }

  if (Capacitor.getPlatform() === 'web') {
    const link = document.createElement('a');
    link.href = base64;
    link.download = filename;
    link.click();
  } else {
    try {
      // Data is usually "data:image/jpeg;base64,..."
      const base64Data = base64.includes('base64,') ? base64.split('base64,')[1] : base64;

      const result = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: filename,
        text: 'Imagem gerada pelo App Vendas e Produção',
        url: result.uri,
      });
    } catch (error) {
      console.error('Error sharing image:', error);
      alert('Erro ao compartilhar imagem. Tente novamente.');
    }
  }
};


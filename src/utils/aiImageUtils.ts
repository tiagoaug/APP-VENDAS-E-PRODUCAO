import type { Photo } from '@capacitor/camera';

export type CompressedImage = {
  dataUrl: string;
  mediaType: 'image/jpeg';
  data: string;
};

const MAX_SIDE = 1536;
const JPEG_QUALITY = 0.85;

function compressFromDataUrl(srcDataUrl: string): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Falha ao carregar a imagem.'));
    img.onload = () => {
      const ratio = Math.min(MAX_SIDE / img.width, MAX_SIDE / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível processar a imagem.'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const data = dataUrl.split(',')[1] ?? '';
      resolve({ dataUrl, mediaType: 'image/jpeg', data });
    };
    img.src = srcDataUrl;
  });
}

export function compressImageFile(file: File): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      compressFromDataUrl(result).then(resolve, reject);
    };
    reader.readAsDataURL(file);
  });
}

export function photoToCompressedImage(photo: Photo): Promise<CompressedImage> {
  if (!photo.base64String) {
    return Promise.reject(new Error('Foto sem dados.'));
  }
  const format = photo.format || 'jpeg';
  const srcDataUrl = `data:image/${format};base64,${photo.base64String}`;
  return compressFromDataUrl(srcDataUrl);
}

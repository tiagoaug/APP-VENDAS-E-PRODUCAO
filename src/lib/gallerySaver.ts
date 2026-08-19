import { registerPlugin, Capacitor } from '@capacitor/core';

interface GallerySaverPlugin {
  saveImage(options: { path: string; album?: string }): Promise<{ saved: boolean; uri: string }>;
}

const GallerySaver = registerPlugin<GallerySaverPlugin>('GallerySaver');

export function isGallerySaverPlatform(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/** `path`: URI de arquivo já salvo pelo lado web (ver Filesystem.writeFile), nunca base64 bruto —
 * mesma convenção do AbleMarkPrinterPlugin. */
export async function saveImageToGallery(path: string, album?: string): Promise<{ saved: boolean; error?: string }> {
  if (!isGallerySaverPlatform()) {
    return { saved: false, error: 'Salvar na galeria disponível apenas no app Android.' };
  }
  try {
    const result = await GallerySaver.saveImage({ path, album });
    return { saved: result.saved };
  } catch (err: any) {
    return { saved: false, error: err?.message || String(err) };
  }
}

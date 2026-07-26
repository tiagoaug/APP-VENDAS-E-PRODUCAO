// Resolve um link curto de localização do Google Maps (maps.app.goo.gl/xxxx) pra sua
// URL completa (com lat/lng) — precisa rodar no servidor por causa de CORS no
// redirecionamento (ver comentário na Cloud Function resolveMapsShortLink).
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';

const functions = getFunctions(app, 'us-central1');

export async function resolveMapsShortLink(url: string): Promise<string | null> {
  const fn = httpsCallable<{ url: string }, { resolvedUrl: string }>(functions, 'resolveMapsShortLink');
  try {
    const result = await fn({ url });
    return result.data.resolvedUrl || null;
  } catch {
    return null;
  }
}

// Init MÍNIMO e ISOLADO do Firebase pra este bundle público — de propósito NUNCA importa
// src/lib/firebase.ts nem src/services/firebaseService.ts (que dependem de sessão
// autenticada). Só precisa de `functions` (as duas Cloud Functions públicas), nada de
// `firestore`/`auth` aqui — quem resolve token/dono é sempre o Cloud Function, nunca este
// bundle. Ver plano da feature: isso é o que torna estruturalmente impossível esta página
// acessar dado autenticado por engano.
import { initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, 'us-central1');

export const getPublicCatalogRequest = httpsCallable<{ token: string }, {
  personId: string;
  products: {
    productId: string;
    reference: string;
    name: string;
    photoUrl?: string;
    brandName?: string;
    categoryId?: string;
    categoryName?: string;
    pricePerPair?: number;
    pricePerBox?: number;
    variations: {
      variationId: string;
      colorName: string;
      photoUrl?: string;
      photoAlbum?: string[];
      saleType: 'RETAIL' | 'WHOLESALE';
      sizes: { size?: string; available: number }[];
    }[];
  }[];
}>(functions, 'getPublicCatalogRequest');

export const submitCatalogRequestCall = httpsCallable<{
  token: string;
  items: { productId: string; saleType: 'RETAIL' | 'WHOLESALE'; variations: { variationId: string; size?: string; quantity: number }[] }[];
  customerNote?: string;
}, { requestId: string }>(functions, 'submitCatalogRequestCall');

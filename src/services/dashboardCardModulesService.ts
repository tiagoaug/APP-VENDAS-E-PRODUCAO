import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { deepClean } from './firebaseService';

// Correção do módulo de cada card de Dashboard (ex.: um card que hoje nasce marcado 'sales' no
// código mas é, na prática, só de Produção) — só a conta de desenvolvimento publica; qualquer
// conta lê, porque isso decide quais cards aparecem pra ela (ver App.tsx, effectiveDefaultDashboardConfig).
// Doc único fixo, mesmo desenho de dashboard_config/nav_config (sem coleção por conta).
const COLLECTION = 'appConfig';
const DOC_ID = 'dashboardCardModules';

export type CardModuleOverrides = Record<string, string>; // cardId -> module key

export function subscribeToCardModuleOverrides(callback: (overrides: CardModuleOverrides) => void) {
  return onSnapshot(
    doc(db, COLLECTION, DOC_ID),
    (snap) => callback(snap.exists() ? ((snap.data().overrides as CardModuleOverrides) ?? {}) : {}),
    (error) => console.error('[dashboardCardModulesService] Falha ao assinar', error)
  );
}

export async function saveCardModuleOverrides(overrides: CardModuleOverrides): Promise<void> {
  await setDoc(doc(db, COLLECTION, DOC_ID), deepClean({ overrides }));
}

import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { deepClean } from './firebaseService';

// Unidades de Medida sugeridas pro botão "Carregar Unidades Padrão" (ver DEFAULT_UNITS em
// ProductionConfigView.tsx, usado como fallback caso este doc ainda não exista) — só a conta de
// desenvolvimento publica um novo padrão; qualquer conta lê, pois decide o que aparece pra ela
// clicar quando a lista de Unidades está vazia (conta nova).
const COLLECTION = 'appDefaultUnits';
const DOC_ID = 'units';

export interface DefaultUnitItem {
  name: string;
  description: string;
}

export function subscribeToDefaultUnits(callback: (items: DefaultUnitItem[] | null) => void) {
  return onSnapshot(
    doc(db, COLLECTION, DOC_ID),
    (snap) => callback(snap.exists() ? ((snap.data().items as DefaultUnitItem[]) ?? null) : null),
    (error) => console.error('[defaultUnitsService] Falha ao assinar', error)
  );
}

export async function saveDefaultUnits(items: DefaultUnitItem[]): Promise<void> {
  await setDoc(doc(db, COLLECTION, DOC_ID), deepClean({ items }));
}

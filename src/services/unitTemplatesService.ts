import { collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UnitTemplate } from '../types';
import { generateId } from '../utils/id';
import { deepClean } from './firebaseService';

// Coleção de topo (fora de users/{uid}) — mesmo desenho de categoryTemplatesService.ts.
const COLLECTION = 'unitTemplates';

export function subscribeToUnitTemplates(callback: (templates: UnitTemplate[]) => void) {
  const q = query(collection(db, COLLECTION));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as UnitTemplate[]);
  }, (error) => {
    console.error('[unitTemplatesService] Falha ao assinar unitTemplates:', error);
  });
}

export async function saveUnitTemplate(template: Omit<UnitTemplate, 'id' | 'createdBy' | 'createdAt'>): Promise<void> {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const id = generateId();
  await setDoc(doc(db, COLLECTION, id), deepClean({
    ...template,
    createdBy: auth.currentUser.uid,
    createdAt: Date.now(),
  }));
}

export async function deleteUnitTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

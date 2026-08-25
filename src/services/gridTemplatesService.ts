import { collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { GridTemplate } from '../types';
import { generateId } from '../utils/id';
import { deepClean } from './firebaseService';

// Coleção de topo (fora de users/{uid}) — mesmo desenho de categoryTemplatesService.ts.
const COLLECTION = 'gridTemplates';

export function subscribeToGridTemplates(callback: (templates: GridTemplate[]) => void) {
  const q = query(collection(db, COLLECTION));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as GridTemplate[]);
  }, (error) => {
    console.error('[gridTemplatesService] Falha ao assinar gridTemplates:', error);
  });
}

export async function saveGridTemplate(template: Omit<GridTemplate, 'id' | 'createdBy' | 'createdAt'>): Promise<void> {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const id = generateId();
  await setDoc(doc(db, COLLECTION, id), deepClean({
    ...template,
    createdBy: auth.currentUser.uid,
    createdAt: Date.now(),
  }));
}

export async function deleteGridTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

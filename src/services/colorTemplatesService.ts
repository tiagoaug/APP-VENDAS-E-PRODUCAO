import { collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ColorTemplate } from '../types';
import { generateId } from '../utils/id';
import { deepClean } from './firebaseService';

// Coleção de topo (fora de users/{uid}) — mesmo desenho de categoryTemplatesService.ts.
const COLLECTION = 'colorTemplates';

export function subscribeToColorTemplates(callback: (templates: ColorTemplate[]) => void) {
  const q = query(collection(db, COLLECTION));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ColorTemplate[]);
  }, (error) => {
    console.error('[colorTemplatesService] Falha ao assinar colorTemplates:', error);
  });
}

export async function saveColorTemplate(template: Omit<ColorTemplate, 'id' | 'createdBy' | 'createdAt'>): Promise<void> {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const id = generateId();
  await setDoc(doc(db, COLLECTION, id), deepClean({
    ...template,
    createdBy: auth.currentUser.uid,
    createdAt: Date.now(),
  }));
}

export async function deleteColorTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

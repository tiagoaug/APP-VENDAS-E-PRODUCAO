import { collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { PackagingTemplate } from '../types';
import { generateId } from '../utils/id';
import { deepClean } from './firebaseService';

// Coleção de topo (fora de users/{uid}) — mesmo desenho de gridTemplatesService.ts.
const COLLECTION = 'packagingTemplates';

export function subscribeToPackagingTemplates(callback: (templates: PackagingTemplate[]) => void) {
  const q = query(collection(db, COLLECTION));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as PackagingTemplate[]);
  }, (error) => {
    console.error('[packagingTemplatesService] Falha ao assinar packagingTemplates:', error);
  });
}

export async function savePackagingTemplate(template: Omit<PackagingTemplate, 'id' | 'createdBy' | 'createdAt'>): Promise<void> {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const id = generateId();
  await setDoc(doc(db, COLLECTION, id), deepClean({
    ...template,
    createdBy: auth.currentUser.uid,
    createdAt: Date.now(),
  }));
}

export async function deletePackagingTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

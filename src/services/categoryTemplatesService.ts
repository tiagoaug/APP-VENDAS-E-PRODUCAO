import { collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { CategoryTemplate } from '../types';
import { generateId } from '../utils/id';
import { deepClean } from './firebaseService';

// Coleção de topo (fora de users/{uid}) — os modelos de categoria são compartilhados
// entre todas as contas, então não passam por firebaseService (que sempre prefixa o
// caminho com a conta do usuário logado).
const COLLECTION = 'categoryTemplates';

export function subscribeToCategoryTemplates(callback: (templates: CategoryTemplate[]) => void) {
  const q = query(collection(db, COLLECTION));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as CategoryTemplate[]);
  }, (error) => {
    console.error('[categoryTemplatesService] Falha ao assinar categoryTemplates:', error);
  });
}

export async function saveCategoryTemplate(template: Omit<CategoryTemplate, 'id' | 'createdBy' | 'createdAt'>): Promise<void> {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const id = generateId();
  await setDoc(doc(db, COLLECTION, id), deepClean({
    ...template,
    createdBy: auth.currentUser.uid,
    createdAt: Date.now(),
  }));
}

export async function deleteCategoryTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

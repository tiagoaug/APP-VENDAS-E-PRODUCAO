import { collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { LabelFileTemplate } from '../types';
import { deepClean } from './firebaseService';

// Coleção de topo (fora de users/{uid}) — os modelos de etiqueta "prontos" são compartilhados
// entre todas as contas, mesmo desenho de categoryTemplatesService.ts.
const COLLECTION = 'labelFileTemplates';

export function subscribeToLabelFileTemplates(callback: (templates: LabelFileTemplate[]) => void) {
  const q = query(collection(db, COLLECTION));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as LabelFileTemplate[]);
  }, (error) => {
    console.error('[labelFileTemplatesService] Falha ao assinar labelFileTemplates:', error);
  });
}

/** `id` = mesmo id do LabelFile de origem (não gerado aqui) — permite checar "essa etiqueta já
 * está publicada?" comparando o id local com a lista de templates, sem precisar de um campo
 * extra salvo no LabelFile em si. */
export async function saveLabelFileTemplate(id: string, template: Omit<LabelFileTemplate, 'id' | 'createdBy' | 'createdAt'>): Promise<void> {
  if (!auth.currentUser) throw new Error('Not authenticated');
  await setDoc(doc(db, COLLECTION, id), deepClean({
    ...template,
    createdBy: auth.currentUser.uid,
    createdAt: Date.now(),
  }));
}

export async function deleteLabelFileTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

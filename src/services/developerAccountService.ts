import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Delegação da conta de desenvolvimento (ver TEMPLATE_ADMIN_EMAIL/isTemplateAdmin em
// templateAdmin.ts) — permite trocar qual e-mail tem os poderes de dev (salvar modelos
// compartilhados, configurações padrão pra contas novas etc.) sem editar código nem
// firestore.rules. Doc único fixo; a regra do servidor só deixa escrever aqui quem já é
// isTemplateAdmin() hoje (o e-mail fixo OU quem estiver aqui dentro no momento), então a troca é
// sempre feita "de dev pra dev" — nunca uma conta comum pode se autopromover.
const COLLECTION = 'appConfig';
const DOC_ID = 'developerAccount';

export function subscribeToDeveloperAccount(callback: (email: string | null) => void) {
  return onSnapshot(
    doc(db, COLLECTION, DOC_ID),
    (snap) => callback(snap.exists() ? ((snap.data().email as string) || null) : null),
    (error) => console.error('[developerAccountService] Falha ao assinar', error)
  );
}

export async function saveDeveloperAccount(email: string | null): Promise<void> {
  await setDoc(doc(db, COLLECTION, DOC_ID), { email: email || null });
}

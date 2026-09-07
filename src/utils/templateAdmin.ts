import { auth } from '../lib/firebase';

// Modelos (categoryTemplates/gridTemplates/colorTemplates/flowTagTemplates/sectorTemplates)
// são coleções COMPARTILHADAS entre todas as contas — qualquer usuário pode ler pra usar como
// sugestão, mas só a conta de desenvolvimento pode publicar novos exemplos (ver firestore.rules,
// que aplica essa mesma regra do lado do servidor — isso aqui é só pra esconder o botão na UI).
export const TEMPLATE_ADMIN_EMAIL = 'fabricananet@gmail.com';

export function isTemplateAdmin(): boolean {
  return auth.currentUser?.email === TEMPLATE_ADMIN_EMAIL;
}

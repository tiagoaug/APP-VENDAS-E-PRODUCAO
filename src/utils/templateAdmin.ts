import { auth } from '../lib/firebase';

// Modelos (categoryTemplates/gridTemplates/colorTemplates/flowTagTemplates/sectorTemplates)
// são coleções COMPARTILHADAS entre todas as contas — qualquer usuário pode ler pra usar como
// sugestão, mas só a conta de desenvolvimento pode publicar novos exemplos (ver firestore.rules,
// que aplica essa mesma regra do lado do servidor — isso aqui é só pra esconder o botão na UI).
export const TEMPLATE_ADMIN_EMAIL = 'fabricananet@gmail.com';

// Além do e-mail fixo acima (âncora de segurança que nunca muda sem um deploy), a conta de
// desenvolvimento pode ser DELEGADA pra outro e-mail via Firestore (appConfig/developerAccount,
// ver developerAccountService.ts) — pensado pra quando a conta de desenvolvimento trocar sem
// precisar editar código/firestore.rules toda vez. App.tsx assina esse doc e mantém este valor em
// dia via setDeveloperAccountEmail(); se o doc não existir ou for apagado, cai de volta pro e-mail
// fixo acima (nunca fica sem nenhuma conta de desenvolvimento).
let developerAccountEmail: string | null = null;

export function setDeveloperAccountEmail(email: string | null): void {
  developerAccountEmail = email;
}

export function getDeveloperAccountEmail(): string | null {
  return developerAccountEmail;
}

export function isTemplateAdmin(): boolean {
  const email = auth.currentUser?.email;
  if (!email) return false;
  return email === TEMPLATE_ADMIN_EMAIL || email === developerAccountEmail;
}

// Diagnóstico temporário do bug "sessão nunca é gravada no iOS". Duas rodadas de toast
// (chamado direto, depois via fila com flush registrável) não mostraram NADA além do aviso já
// existente em LoginView.tsx — nem "platform", nem "_isAvailable()", nada — o que é estranho
// demais pra ser só timing de mount. Pra tirar QUALQUER dependência do sistema de toast/evento
// (que já falhou em revelar algo duas vezes), esses diagnósticos agora gravam direto no
// localStorage — se ESSE mecanismo funcionar (e ele TEM que funcionar, é a mesma API que
// capacitorPreferencesPersistence.ts usa pra tentar salvar a sessão), App.tsx lê e mostra num
// painel fixo na tela, sem passar por CustomEvent/listener nenhum. Remover depois de achar a
// causa real do bug.
const STORAGE_KEY = '__auth_diag_log__';

export function logAuthDiag(message: string) {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    const list: string[] = existing ? JSON.parse(existing) : [];
    list.push(`${new Date().toISOString().slice(11, 19)} — ${message}`);
    // Mantém só as últimas 30 pra não crescer sem limite entre sessões de teste.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-30)));
  } catch {
    // Se ISSO falhar, o próprio localStorage está quebrado — não tem diagnóstico que ajude.
  }
}

export function readAuthDiagLog(): string[] {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch {
    return [];
  }
}

export function clearAuthDiagLog() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

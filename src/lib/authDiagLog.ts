// "Modo Diagnóstico" — painel de log gravado em localStorage (não toast/CustomEvent, que se
// perde se disparado antes de algum componente montar pra escutar) pra depurar bugs nativos
// difíceis de reproduzir sem Mac/Xcode (sem Safari Web Inspector, sem console do dispositivo).
// Nasceu da investigação do login do Google não persistindo no iOS — ver
// [[project_ios_wkwebview_auth_hang]] pra essa história e [[feedback_ios_debug_no_mac]] pra o
// padrão geral. Fica desligado por padrão (toggle em Configurações > Acessibilidade); quando
// ligado, qualquer chamada a `logAuthDiag` em qualquer parte do app grava uma linha aqui,
// visível no painel fixo renderizado em App.tsx — reaproveitável pra qualquer bug futuro
// parecido, não só esse de auth.
const ENABLED_KEY = '@app:diag_mode_enabled';
const LOG_KEY = '__auth_diag_log__';

export function isAuthDiagEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAuthDiagEnabled(enabled: boolean) {
  try {
    if (enabled) {
      window.localStorage.setItem(ENABLED_KEY, '1');
    } else {
      window.localStorage.removeItem(ENABLED_KEY);
      window.localStorage.removeItem(LOG_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function logAuthDiag(message: string) {
  if (!isAuthDiagEnabled()) return;
  try {
    const existing = window.localStorage.getItem(LOG_KEY);
    const list: string[] = existing ? JSON.parse(existing) : [];
    list.push(`${new Date().toISOString().slice(11, 19)} — ${message}`);
    // Mantém só as últimas 30 pra não crescer sem limite entre sessões de teste.
    window.localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(-30)));
  } catch {
    // Se ISSO falhar, o próprio localStorage está quebrado — não tem diagnóstico que ajude.
  }
}

export function readAuthDiagLog(): string[] {
  try {
    const existing = window.localStorage.getItem(LOG_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch {
    return [];
  }
}

export function clearAuthDiagLog() {
  try {
    window.localStorage.removeItem(LOG_KEY);
  } catch {
    /* ignore */
  }
}

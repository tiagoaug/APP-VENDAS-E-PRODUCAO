import type { Persistence } from 'firebase/auth';
import { logAuthDiag } from './authDiagLog';

// Persistência custom do Firebase Auth pro iOS — ver comentário grande em firebase.ts sobre o
// bug do WKWebView: as CLASSES de persistência do próprio SDK (`indexedDBLocalPersistence`,
// `browserLocalPersistence`) fazem checagens internas extras (ex.: IndexedDB como mecanismo de
// sincronização multi-aba, mesmo pro tipo "local") que nunca resolvem nem rejeitam nesse
// WebView, travando não só o login como o boot inteiro do app (ver
// [[project_ios_wkwebview_auth_hang]] na memória).
//
// Uma primeira tentativa de corrigir isso usou `@capacitor/preferences` (ponte nativa via
// plugin) — mas isso reproduziu o MESMO tipo de travamento por outro canal.
//
// A saída de verdade: usar `window.localStorage` DIRETAMENTE (chamadas SÍNCRONAS da própria
// JavaScriptCore do WKWebView, sem round-trip pra nenhuma ponte nativa e sem nenhum mecanismo
// de evento/listener esperando algo que nunca chega — não tem como travar).
//
// CAUSA REAL do "sessão nunca é gravada" (achada via diagnóstico em localStorage, ver
// authDiagLog.ts): initializeAuth() lançava "INTERNAL ASSERTION FAILED: Expected a class
// definition" de forma SÍNCRONA — capturado pelo try/catch em firebase.ts, que caía pro
// fallback `[inMemoryPersistence]` pra SESSÃO INTEIRA, sem eu nunca saber (o catch só logava no
// console, invisível sem Xcode). O motivo: `_getInstance()` internamente faz
// `debugAssert(cls instanceof Function, 'Expected a class definition')` — a SDK exige que cada
// persistência seja uma CLASSE (ela mesma instancia com `new cls()` e cacheia o singleton), não
// um objeto literal como este arquivo tentava usar antes. `inMemoryPersistence`/
// `browserLocalPersistence` são exportadas como a CLASSE em si, nunca uma instância pronta —
// daí o formato abaixo, espelhando exatamente `InMemoryPersistence` do próprio SDK
// (@firebase/auth, função `_getInstance`).
class CapacitorPreferencesPersistence {
  type = 'LOCAL' as const;

  async _isAvailable(): Promise<boolean> {
    try {
      const testKey = '__persistence_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      logAuthDiag('_isAvailable() = true');
      return true;
    } catch (e) {
      logAuthDiag('_isAvailable() FALHOU: ' + (e instanceof Error ? e.message : String(e)));
      return false;
    }
  }

  async _set(key: string, value: unknown): Promise<void> {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      logAuthDiag('_set() gravou em ' + key);
    } catch (e) {
      logAuthDiag('_set() FALHOU: ' + (e instanceof Error ? e.message : String(e)));
      throw e;
    }
  }

  async _get(key: string): Promise<unknown> {
    const value = window.localStorage.getItem(key);
    logAuthDiag('_get(' + key + ') = ' + (value ? 'encontrado' : 'vazio'));
    return value ? JSON.parse(value) : null;
  }

  async _remove(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  }

  // Só pra sincronizar sessão entre abas de um navegador de verdade — sem sentido numa WebView
  // isolada de um app nativo, então ficam como no-op (mesmo padrão de InMemoryPersistence).
  _addListener(): void { /* no-op */ }
  _removeListener(): void { /* no-op */ }
}
// Propriedade estática, mesmo padrão de `InMemoryPersistence.type = 'NONE'` no SDK — algumas
// checagens internas leem `cls.type` sem instanciar.
(CapacitorPreferencesPersistence as unknown as { type: string }).type = 'LOCAL';

// Exporta a CLASSE em si (não `new CapacitorPreferencesPersistence()`) — é isso que
// `_getInstance()` espera, e é exatamente como `inMemoryPersistence`/`browserLocalPersistence`
// são exportadas pelo próprio firebase/auth.
export const capacitorPreferencesPersistence = CapacitorPreferencesPersistence as unknown as Persistence;

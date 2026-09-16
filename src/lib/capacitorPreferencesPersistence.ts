import type { Persistence } from 'firebase/auth';

// Persistência custom do Firebase Auth pro iOS — ver comentário grande em firebase.ts sobre o
// bug do WKWebView: as CLASSES de persistência do próprio SDK (`indexedDBLocalPersistence`,
// `browserLocalPersistence`) fazem checagens internas extras (ex.: IndexedDB como mecanismo de
// sincronização multi-aba, mesmo pro tipo "local") que nunca resolvem nem rejeitam nesse
// WebView, travando não só o login como o boot inteiro do app (ver
// [[project_ios_wkwebview_auth_hang]] na memória).
//
// Uma primeira tentativa de corrigir isso usou `@capacitor/preferences` (ponte nativa via
// plugin) — mas isso reproduziu o MESMO tipo de travamento por outro canal: chamar um plugin
// Capacitor bem no boot do app (antes da ponte nativa estar 100% pronta pra rotear a resposta)
// nunca resolvia, e a sessão nunca persistia (sempre caía no fallback de timeout).
//
// A saída de verdade: usar `window.localStorage` DIRETAMENTE (não a classe
// `browserLocalPersistence` do Firebase, que teria a mesma lógica extra problemática) —
// `getItem`/`setItem`/`removeItem` são chamadas SÍNCRONAS da própria JavaScriptCore do
// WKWebView, sem round-trip pra nenhuma ponte nativa e sem nenhum mecanismo de evento/listener
// esperando algo que nunca chega. Não tem como travar: ou retorna na hora, ou lança na hora (e
// aí o try/catch abaixo cobre). O WKWebView do Capacitor usa um WKWebsiteDataStore persistente
// por padrão, então esse localStorage sobrevive normalmente ao fechamento do app.
export const capacitorPreferencesPersistence: Persistence = {
  type: 'LOCAL',
  _isAvailable: async () => {
    try {
      const testKey = '__persistence_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  },
  _set: async (key: string, value: unknown) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  },
  _get: async (key: string) => {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  _remove: async (key: string) => {
    window.localStorage.removeItem(key);
  },
  // Só pra sincronizar sessão entre abas de um navegador de verdade — sem sentido numa WebView
  // isolada de um app nativo, então ficam como no-op.
  _addListener: () => { /* no-op */ },
  _removeListener: () => { /* no-op */ },
} as unknown as Persistence;

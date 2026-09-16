import type { Persistence } from 'firebase/auth';
import { toast } from '../utils/toast';

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
//
// Ainda assim, um teste real no iOS mostrou "login OK, mas sessão NÃO gravada" — ou seja, esse
// objeto não está sendo de fato usado pra escrever (a SDK deve estar caindo pro fallback
// inMemoryPersistence sem eu saber o motivo, ver PersistenceUserManager.create() em
// @firebase/auth: `selectedPersistence = availablePersistences[0] || inMemoryPersistence`,
// decidido a partir de `_isAvailable()`). Os toasts de diagnóstico abaixo (só no iOS) mostram
// exatamente quando cada função daqui é chamada e o que ela retorna, pra confirmar se o
// problema é _isAvailable() nunca resolvendo true, ou outra coisa. Remover depois de achar a
// causa real.
const isIOS = () => {
  try {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  } catch {
    return false;
  }
};

export const capacitorPreferencesPersistence: Persistence = {
  type: 'LOCAL',
  _isAvailable: async () => {
    try {
      const testKey = '__persistence_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      if (isIOS()) toast.show('DIAGNÓSTICO: _isAvailable() = true');
      return true;
    } catch (e) {
      if (isIOS()) toast.show('DIAGNÓSTICO: _isAvailable() FALHOU: ' + (e instanceof Error ? e.message : String(e)));
      return false;
    }
  },
  _set: async (key: string, value: unknown) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      if (isIOS()) toast.show('DIAGNÓSTICO: _set() gravou em ' + key);
    } catch (e) {
      if (isIOS()) toast.show('DIAGNÓSTICO: _set() FALHOU: ' + (e instanceof Error ? e.message : String(e)));
      throw e;
    }
  },
  _get: async (key: string) => {
    const value = window.localStorage.getItem(key);
    if (isIOS()) toast.show('DIAGNÓSTICO: _get(' + key + ') = ' + (value ? 'encontrado' : 'vazio'));
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

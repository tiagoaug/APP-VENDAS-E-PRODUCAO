import { Preferences } from '@capacitor/preferences';
import type { Persistence } from 'firebase/auth';

// Persistência custom do Firebase Auth pro iOS — ver comentário grande em firebase.ts sobre o
// bug do WKWebView: QUALQUER persistência baseada em storage do próprio WebView (IndexedDB,
// localStorage, sessionStorage) trava a Promise pra sempre em vez de rejeitar, então a SDK do
// Firebase Auth nunca cai pro próximo item da cadeia de fallback. `inMemoryPersistence` evita o
// travamento mas não sobrevive ao fechamento do app — daí o "precisa logar de novo toda vez".
//
// A saída é uma persistência que não usa NENHUMA API de storage do WebView: `@capacitor/preferences`
// é uma ponte nativa direta (UserDefaults no iOS, SharedPreferences no Android), nunca toca em
// IndexedDB/localStorage, então não tem como reproduzir o MESMO travamento. O Firebase Auth só
// exige que o objeto tenha essas funções (a interface completa — `_isAvailable`, `_set`, `_get`,
// `_remove`, `_addListener`, `_removeListener` — é interna, não exportada publicamente pelo SDK,
// por isso o cast final `as Persistence`). `_addListener`/`_removeListener` existem só pra
// sincronizar sessão entre abas de um navegador de verdade — sem sentido numa WebView isolada de
// um app nativo, então ficam como no-op.
//
// Toda chamada nativa aqui passa por `withTimeout`: uma ponte de plugin Capacitor que nunca
// resolve (por qualquer motivo — bug de inicialização, versão de plugin, etc.) reproduziria
// EXATAMENTE o mesmo tipo de travamento eterno que motivou abandonar IndexedDB/localStorage aqui,
// só que por outro canal — e trava não só o login, mas o boot inteiro do app (tela branca), já
// que `initializeAuth` roda antes de qualquer outra coisa. Com o timeout, na pior das hipóteses a
// sessão simplesmente não persiste (mesmo comportamento de antes, com inMemoryPersistence), nunca
// trava o app.
function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 3000): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

export const capacitorPreferencesPersistence: Persistence = {
  type: 'LOCAL',
  _isAvailable: async () => withTimeout(
    Preferences.get({ key: '__persistence_probe__' }).then(() => true),
    false,
  ),
  _set: async (key: string, value: unknown) => {
    await withTimeout(Preferences.set({ key, value: JSON.stringify(value) }), undefined);
  },
  _get: async (key: string) => {
    const result = await withTimeout(Preferences.get({ key }), { value: null } as { value: string | null });
    return result.value ? JSON.parse(result.value) : null;
  },
  _remove: async (key: string) => {
    await withTimeout(Preferences.remove({ key }), undefined);
  },
  _addListener: () => { /* sem multi-aba pra sincronizar dentro do app nativo */ },
  _removeListener: () => { /* idem */ },
} as unknown as Persistence;

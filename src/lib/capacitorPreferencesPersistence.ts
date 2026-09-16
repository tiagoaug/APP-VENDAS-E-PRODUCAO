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
// IndexedDB/localStorage, então não tem como reproduzir o mesmo travamento. O Firebase Auth só
// exige que o objeto tenha essas funções (a interface completa — `_isAvailable`, `_set`, `_get`,
// `_remove`, `_addListener`, `_removeListener` — é interna, não exportada publicamente pelo SDK,
// por isso o cast final `as Persistence`). `_addListener`/`_removeListener` existem só pra
// sincronizar sessão entre abas de um navegador de verdade — sem sentido numa WebView isolada de
// um app nativo, então ficam como no-op.
export const capacitorPreferencesPersistence: Persistence = {
  type: 'LOCAL',
  _isAvailable: async () => true,
  _set: async (key: string, value: unknown) => {
    await Preferences.set({ key, value: JSON.stringify(value) });
  },
  _get: async (key: string) => {
    const { value } = await Preferences.get({ key });
    return value ? JSON.parse(value) : null;
  },
  _remove: async (key: string) => {
    await Preferences.remove({ key });
  },
  _addListener: () => { /* sem multi-aba pra sincronizar dentro do app nativo */ },
  _removeListener: () => { /* idem */ },
} as unknown as Persistence;

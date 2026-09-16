import { initializeApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithCredential, signOut,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { capacitorPreferencesPersistence } from './capacitorPreferencesPersistence';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
// Só fotos de produto ficam aqui (ver src/utils/uploadProductPhoto.ts) — tudo mais no app
// continua no Firestore.
export const storage = getStorage(app);
// `getAuth()` puro trava indefinidamente dentro do WKWebView do iOS (não acontece no Android,
// que usa Chromium) — problema conhecido do SDK JS do Firebase Auth quando a inicialização do
// IndexedDB não sai limpa nesse WebView. A ideia original era usar `initializeAuth` com uma
// cadeia de fallback de persistência (IndexedDB → localStorage → sessionStorage → memória), mas
// isso só funciona se cada opção FALHAR de forma limpa (rejeita a Promise) — e no WKWebView
// tanto o IndexedDB quanto (aparentemente) as checagens de localStorage/sessionStorage/
// popupRedirectResolver não rejeitam, só ficam pendurados pra sempre, então a SDK nunca chega
// a tentar a próxima opção. Isso trava não só a checagem inicial de sessão, mas QUALQUER
// operação de auth que dependa de persistência — inclusive um login ativo (e-mail/senha ou
// Google), travando o botão sem erro nenhum (ver [[project_ios_wkwebview_auth_hang]] na
// memória). Por isso, no iOS especificamente, usamos `capacitorPreferencesPersistence` (ver
// capacitorPreferencesPersistence.ts) — uma persistência custom que salva a sessão via
// `window.localStorage` DIRETO (chamadas síncronas, sem round-trip de ponte nativa nem
// mecanismo de evento/listener — só a CLASSE `browserLocalPersistence` do próprio Firebase tem
// a lógica extra que trava; localStorage puro não tem como travar). Uma tentativa anterior
// usou `@capacitor/preferences` (ponte de plugin nativo) e reproduziu o MESMO tipo de
// travamento por outro canal — motivo pelo qual não é isso que essa persistência usa.
// `inMemoryPersistence` continua na cadeia só como último fallback. Android usa Chromium (sem
// esse bug) e mantém a cadeia normal de fallback.
const platform = Capacitor.getPlatform();
const authOptions = {
  persistence: platform === 'ios'
    ? [capacitorPreferencesPersistence, inMemoryPersistence]
    : platform === 'android'
      ? [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
      : [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
  // `popupRedirectResolver` precisa ser passado explicitamente aqui — ao contrário de
  // `getAuth()` (que registra o resolver padrão do navegador sozinho), `initializeAuth()` não
  // registra nada por conta própria. Sem isso, `signInWithPopup` (usado no login com Google na
  // web) falha com "auth/argument-error". Só é necessário na web — nativo usa
  // `signInWithCredential`, nunca popup — e evita mais uma inicialização baseada em storage do
  // WebView no iOS.
  ...(platform === 'web' ? { popupRedirectResolver: browserPopupRedirectResolver } : {}),
};
// `initializeAuth` roda na carga do módulo, antes de qualquer outra coisa no app — um erro
// síncrono aqui (ex.: algo na persistência custom do iOS que a SDK não aceite numa versão
// futura do Firebase) travaria o app inteiro numa tela branca, sem nem chegar a renderizar.
// Fallback pra só inMemoryPersistence garante que o app sempre abre, mesmo que sem lembrar
// login nesse cenário extremo.
export const auth = (() => {
  try {
    return initializeAuth(app, authOptions);
  } catch (err) {
    console.error('initializeAuth falhou com a config normal, caindo pra inMemoryPersistence:', err);
    return initializeAuth(app, { ...authOptions, persistence: [inMemoryPersistence] });
  }
})();
export const googleProvider = new GoogleAuthProvider();
// 'apple.com' é tratado pelo SDK do Firebase como um OAuthProvider genérico (não tem uma classe
// própria tipo GoogleAuthProvider) — mesmo padrão usado pra qualquer provider OAuth custom.
export const appleProvider = new OAuthProvider('apple.com');

// `skipNativeAuth: true` é OBRIGATÓRIO aqui pelo mesmo motivo do Apple logo abaixo: com o
// padrão `skipNativeAuth: false` do capacitor.config.ts, o plugin nativo JÁ loga no Firebase
// sozinho ao terminar o Google Sign-In — daí o código abaixo tentava logar DE NOVO via
// signInWithCredential com o mesmo idToken, uma segunda troca de credencial competindo com a
// que o nativo acabou de fazer. No Android isso às vezes só duplicava trabalho sem quebrar
// nada visível, mas no WKWebView do iOS caía direto no bug conhecido do SDK JS do Firebase Auth
// (a Promise de signInWithCredential nunca resolve NEM rejeita, ver resolveAuthCall acima) —
// reportado como "Tempo esgotado ao conectar" mesmo com o login do Google concluído com sucesso
// do lado nativo. Com skipNativeAuth:true o nativo só devolve o idToken, sem logar sozinho, e a
// troca no Firebase acontece uma única vez, aqui.
export const signInWithGoogle = async () => {
  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    const credential = GoogleAuthProvider.credential(result.credential?.idToken);
    return signInWithCredential(auth, credential);
  } else {
    return signInWithPopup(auth, googleProvider);
  }
};

// Precisa do idToken E do rawNonce pra montar a credential do lado do Firebase JS SDK — sem o
// nonce, o Firebase rejeita o credential da Apple com "auth/invalid-credential" mesmo com um
// idToken válido (a Apple exige esse nonce pra provar que o token não foi reaproveitado).
//
// `skipNativeAuth: true` é OBRIGATÓRIO aqui (ao contrário do Google, que funciona sem) — com o
// padrão `skipNativeAuth: false` do capacitor.config.ts, o plugin nativo JÁ completa o login no
// Firebase Auth nativo sozinho, consumindo o nonce/idToken. Quando o código também tentava
// montar a credential e chamar signInWithCredential de novo aqui, a Apple rejeitava como
// token/nonce já usado: "Firebase: Duplicate credential received... (auth/missing-or-invalid-nonce)".
// Passando skipNativeAuth:true só nesta chamada, o nativo NÃO loga sozinho — só devolve
// idToken+nonce, e a troca no Firebase acontece uma única vez, aqui.
export const signInWithApple = async () => {
  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
    const credential = appleProvider.credential({
      idToken: result.credential?.idToken,
      rawNonce: result.credential?.nonce,
    });
    return signInWithCredential(auth, credential);
  } else {
    return signInWithPopup(auth, appleProvider);
  }
};
export const logout = () => signOut(auth);

const AUTH_CALL_TIMEOUT_MS = 15000;
const AUTH_POLL_INTERVAL_MS = 400;

// Bug conhecido do SDK JS do Firebase Auth dentro do WKWebView do iOS: a Promise de uma
// chamada de login (signInWithEmailAndPassword, signInWithCredential etc.) às vezes nunca
// resolve NEM rejeita, mesmo quando o login é concluído com sucesso no servidor e
// `auth.currentUser` já foi atualizado — só o aviso pro código que chamou nunca chega. Por
// isso, em vez de só aguardar a Promise, ficamos de olho em `auth.currentUser` em paralelo:
// se ele populares antes da Promise resolver, tratamos como sucesso mesmo assim. Se nada
// acontecer dentro do tempo limite, mostramos um erro em vez de travar pra sempre em "Entrando...".
export async function resolveAuthCall<T extends { user: any }>(authCall: Promise<T>): Promise<T> {
  let settled: { ok: true; value: T } | { ok: false; error: any } | null = null;
  authCall.then(
    (value) => { settled = { ok: true, value }; },
    (error) => { settled = { ok: false, error }; },
  );

  const start = Date.now();
  while (Date.now() - start < AUTH_CALL_TIMEOUT_MS) {
    if (settled) {
      if ((settled as any).ok) return (settled as any).value;
      throw (settled as any).error;
    }
    if (auth.currentUser) {
      return { user: auth.currentUser } as T;
    }
    await new Promise((r) => setTimeout(r, AUTH_POLL_INTERVAL_MS));
  }
  throw new Error('Tempo esgotado ao conectar. Verifique sua internet e tente novamente.');
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase connection successful');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    } else {
      console.warn('Firebase test connection:', error);
    }
  }
}

testConnection();

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

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
// Só fotos de produto ficam aqui (ver src/utils/uploadProductPhoto.ts) — tudo mais no app
// continua no Firestore.
export const storage = getStorage(app);
// `getAuth()` puro trava indefinidamente dentro do WKWebView do iOS (não acontece no Android,
// que usa Chromium) — problema conhecido do SDK JS do Firebase Auth quando a inicialização do
// IndexedDB não sai limpa nesse WebView. A ideia original era usar `initializeAuth` com uma
// cadeia de fallback de persistência (IndexedDB → localStorage → sessionStorage → memória), mas
// isso só funciona se o IndexedDB FALHAR de forma limpa (rejeita a Promise) — no WKWebView ele
// não rejeita, só fica pendurado pra sempre, então a SDK nunca chega a tentar o próximo da
// lista. Isso trava não só a checagem inicial de sessão, mas QUALQUER operação de auth que
// dependa de persistência — inclusive um login ativo (e-mail/senha ou Google), travando o botão
// sem erro nenhum. Por isso, no iOS/Android nativos, NEM TENTA IndexedDB — vai direto pro
// primeiro que realmente funciona nesses WebViews.
// `popupRedirectResolver` precisa ser passado explicitamente aqui — ao contrário de
// `getAuth()` (que registra o resolver padrão do navegador sozinho), `initializeAuth()`
// não registra nada por conta própria. Sem isso, `signInWithPopup` (usado no login com
// Google na web) falha com "auth/argument-error" mesmo com tudo mais configurado certo.
export const auth = initializeAuth(app, {
  persistence: Capacitor.isNativePlatform()
    ? [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
    : [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const googleProvider = new GoogleAuthProvider();
// 'apple.com' é tratado pelo SDK do Firebase como um OAuthProvider genérico (não tem uma classe
// própria tipo GoogleAuthProvider) — mesmo padrão usado pra qualquer provider OAuth custom.
export const appleProvider = new OAuthProvider('apple.com');

export const signInWithGoogle = async () => {
  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const credential = GoogleAuthProvider.credential(result.credential?.idToken);
    return signInWithCredential(auth, credential);
  } else {
    return signInWithPopup(auth, googleProvider);
  }
};

// Precisa do idToken E do rawNonce pra montar a credential do lado do Firebase JS SDK — sem o
// nonce, o Firebase rejeita o credential da Apple com "auth/invalid-credential" mesmo com um
// idToken válido (a Apple exige esse nonce pra provar que o token não foi reaproveitado).
export const signInWithApple = async () => {
  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithApple();
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

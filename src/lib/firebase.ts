import { initializeApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider, signInWithPopup, signInWithCredential, signOut,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
// `getAuth()` puro trava indefinidamente dentro do WKWebView do iOS (não acontece no Android,
// que usa Chromium) — problema conhecido do SDK JS do Firebase Auth quando a inicialização do
// IndexedDB não sai limpa nesse WebView. `initializeAuth` com uma cadeia explícita de fallback
// de persistência resolve: se IndexedDB falhar, cai pra localStorage, depois sessionStorage,
// depois memória, em vez de ficar esperando pra sempre.
// `popupRedirectResolver` precisa ser passado explicitamente aqui — ao contrário de
// `getAuth()` (que registra o resolver padrão do navegador sozinho), `initializeAuth()`
// não registra nada por conta própria. Sem isso, `signInWithPopup` (usado no login com
// Google na web) falha com "auth/argument-error" mesmo com tudo mais configurado certo.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithGoogle();
    const credential = GoogleAuthProvider.credential(result.credential?.idToken);
    return signInWithCredential(auth, credential);
  } else {
    return signInWithPopup(auth, googleProvider);
  }
};
export const logout = () => signOut(auth);

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

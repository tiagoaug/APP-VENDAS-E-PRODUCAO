import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  Timestamp,
  orderBy,
  deleteField,
  runTransaction
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
  TRANSACTION = 'transaction',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.group('Firestore Error Detail');
  console.error('Error Message:', error instanceof Error ? error.message : String(error));
  console.error('Operation:', operationType);
  console.error('Path:', path);
  console.error('Auth State:', JSON.stringify(errInfo.authInfo));
  console.groupEnd();
  throw new Error(JSON.stringify(errInfo));
}

export const firebaseService = {
  runAtomic: async (operation: (transaction: any) => Promise<void>) => {
    try {
      console.log('[firebaseService] Starting atomic operation');
      await runTransaction(db, operation);
      console.log('[firebaseService] Atomic operation completed');
    } catch (error) {
      console.error('[firebaseService] Atomic operation failed', error);
      handleFirestoreError(error, OperationType.TRANSACTION, 'transaction-atomic');
    }
  },

  getCollection: async <T>(path: string) => {
    if (!auth.currentUser) return [];
    const fullPath = `users/${auth.currentUser.uid}/${path}`;
    try {
      const q = query(collection(db, fullPath));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (T & { id: string })[];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, fullPath);
      return [];
    }
  },

  subscribeToCollection: <T>(path: string, callback: (data: (T & { id: string })[]) => void) => {
    if (!auth.currentUser) return () => {};
    const fullPath = `users/${auth.currentUser.uid}/${path}`;
    const q = query(collection(db, fullPath));
    
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (T & { id: string })[];
      callback(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, fullPath);
    });
  },

  saveDocument: async <T extends object>(path: string, data: T) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const id = (data as any).id || doc(collection(db, 'temp')).id;
    const fullPath = `users/${auth.currentUser.uid}/${path}`;
    const docRef = doc(db, fullPath, id);
    
    // Remove id from payload if it exists
    const { id: _, ...payload } = data as any;
    
    // Recursive clean to remove undefined values
    const deepClean = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(deepClean);
      } else if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
          Object.entries(obj)
            .filter(([_, value]) => value !== undefined)
            .map(([key, value]) => [key, deepClean(value)])
        );
      }
      return obj;
    };

    const cleanPayload = deepClean(payload);
    
    try {
      await setDoc(docRef, cleanPayload, { merge: true });
      return { id, ...payload };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${fullPath}/${id}`);
    }
  },

  updateDocument: async (path: string, id: string, data: any) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const fullPath = `users/${auth.currentUser.uid}/${path}`;
    const docRef = doc(db, fullPath, id);
    
    console.log(`Updating document at ${fullPath}/${id} with data`, data);
    
    // Recursive clean to remove undefined values
    const deepClean = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(deepClean);
      } else if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
          Object.entries(obj)
            .filter(([_, value]) => value !== undefined)
            .map(([key, value]) => [key, deepClean(value)])
        );
      }
      return obj;
    };

    const cleanData = deepClean(data);
    
    try {
      await updateDoc(docRef, cleanData);
      console.log(`Successfully updated document at ${fullPath}/${id}`);
    } catch (error) {
      console.error(`Failed to update document at ${fullPath}/${id}`, error);
      handleFirestoreError(error, OperationType.UPDATE, `${fullPath}/${id}`);
    }
  },

  deleteDocument: async (path: string, id: string) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const fullPath = `users/${auth.currentUser.uid}/${path}`;
    const docRef = doc(db, fullPath, id);
    
    console.log(`Deleting document at ${fullPath}/${id}`);
    
    try {
      await deleteDoc(docRef);
      console.log(`Successfully deleted document at ${fullPath}/${id}`);
    } catch (error) {
      console.error(`Failed to delete document at ${fullPath}/${id}`, error);
      handleFirestoreError(error, OperationType.DELETE, `${fullPath}/${id}`);
    }
  }
};

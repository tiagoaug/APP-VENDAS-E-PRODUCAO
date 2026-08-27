import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  Timestamp,
  orderBy,
  deleteField,
  runTransaction,
  writeBatch
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

const isPlainObject = (obj: any) => {
  return obj !== null && typeof obj === 'object' && (obj.constructor === Object || !obj.constructor);
};

export const deepClean = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(deepClean);
  } else if (isPlainObject(obj)) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, deepClean(value)])
    );
  }
  return obj;
};

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

  // Lê o documento fresco e grava só o que `mergeFn` devolver, dentro de uma transação real
  // — pra mesclar uma chave dentro de um campo tipo mapa (ex.: `metadata.repairAcknowledged`,
  // `metadata.orderSectors`) sem perder outras chaves gravadas por uma ação concorrente entre
  // a leitura local (possivelmente desatualizada) e a escrita. `updateDocument`/`saveDocument`
  // comuns gravam o objeto já calculado em cima do estado local do componente — se duas ações
  // no MESMO documento acontecerem próximas (ex.: descartar 2 itens de "Reparar Caixas" do
  // mesmo Mapa em sequência rápida), a segunda pode sobrescrever o campo inteiro com uma base
  // desatualizada e apagar o que a primeira acabou de gravar. `mergeFn` recebe o documento
  // como está no servidor NESTE exato momento, então isso não acontece.
  mergeFieldAtomic: async (path: string, id: string, mergeFn: (fresh: any) => any): Promise<void> => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const uid = auth.currentUser.uid;
    const ref = doc(db, `users/${uid}/${path}`, id);
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) return;
        const fresh = { id: snap.id, ...snap.data() };
        const updates = mergeFn(fresh);
        if (!updates) return;
        transaction.update(ref, deepClean(updates));
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.TRANSACTION, `merge-atomic-${path}`);
    }
  },

  // Contador persistido (users/{uid}/counters/{counterId}) para gerar números
  // sequenciais (OP, OS, Mapa/Lote) sem depender de contar quantos registros já
  // estão carregados em memória — isso evitava duplicidade tanto por carregamento
  // parcial quanto por duas criações quase simultâneas antes de sincronizar.
  // Na primeira chamada (contador ainda não existe), usa `seed` para calcular o
  // maior número já emitido na coleção e inicializar o contador a partir dele —
  // sem precisar de nenhuma migração manual.
  getNextSequence: async (counterId: string, seed?: () => Promise<number>): Promise<number> => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const fullPath = `users/${auth.currentUser.uid}/counters`;
    const counterRef = doc(db, fullPath, counterId);
    try {
      const existing = await getDoc(counterRef);
      if (!existing.exists() && seed) {
        const seedValue = await seed();
        await setDoc(counterRef, { value: seedValue });
      }
      return await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(counterRef);
        const current = snap.exists() ? (snap.data().value || 0) : 0;
        const next = current + 1;
        transaction.set(counterRef, { value: next });
        return next;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.TRANSACTION, `${fullPath}/${counterId}`);
      throw error;
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

  // Busca um único documento direto do Firestore por ID, sem depender de uma
  // subscription já ativa — usado pelo scanner de QR Code para "carregar
  // diretamente" um Mapa/pedido mesmo que a lista local (`productionLots`)
  // ainda não tenha sincronizado.
  getDocument: async <T>(path: string, id: string): Promise<(T & { id: string }) | null> => {
    if (!auth.currentUser) return null;
    if (!id) return null;
    const fullPath = `users/${auth.currentUser.uid}/${path}`;
    try {
      const snapshot = await getDoc(doc(db, fullPath, id));
      if (!snapshot.exists()) return null;
      return { id: snapshot.id, ...snapshot.data() } as T & { id: string };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${fullPath}/${id}`);
      return null;
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

  // Como subscribeToCollection, mas em vez de baixar a coleção inteira para sempre,
  // mantém só "recentes" (dateField >= cutoffMs) UNIDO com "ainda em aberto"
  // (openField in openValues) — usado em coleções que só crescem (sales, purchases,
  // transactions) para não acumular o histórico inteiro na memória/listener, sem
  // perder nada que ainda esteja pendente, independente da idade do registro.
  subscribeToRecentOrOpen: <T>(
    path: string,
    opts: { dateField: string; cutoffMs: number; openField: string; openValues: string[] },
    callback: (data: (T & { id: string })[]) => void,
  ) => {
    if (!auth.currentUser) return () => {};
    const fullPath = `users/${auth.currentUser.uid}/${path}`;
    const colRef = collection(db, fullPath);

    let recentDocs: Record<string, T & { id: string }> = {};
    let openDocs: Record<string, T & { id: string }> = {};
    const emit = () => {
      const merged = { ...recentDocs, ...openDocs };
      callback(Object.values(merged));
    };

    const qRecent = query(colRef, where(opts.dateField, '>=', opts.cutoffMs));
    const qOpen = query(colRef, where(opts.openField, 'in', opts.openValues));

    const unsubRecent = onSnapshot(qRecent, (snapshot) => {
      recentDocs = Object.fromEntries(snapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as T & { id: string }]));
      emit();
    }, (error) => handleFirestoreError(error, OperationType.LIST, fullPath));

    const unsubOpen = onSnapshot(qOpen, (snapshot) => {
      openDocs = Object.fromEntries(snapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as T & { id: string }]));
      emit();
    }, (error) => handleFirestoreError(error, OperationType.LIST, fullPath));

    return () => { unsubRecent(); unsubOpen(); };
  },

  saveDocument: async <T extends object>(path: string, data: T) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const id = (data as any).id || doc(collection(db, 'temp')).id;
    console.log(`[firebaseService] saveDocument: path=${path}, id=${id}`, { dataType: typeof data, data });
    const fullPath = `users/${auth.currentUser.uid}/${path}`;
    if (!id || typeof id !== 'string') {
      console.error('[firebaseService] Invalid ID for saveDocument:', id, typeof id);
      throw new Error(`ID inválido para salvamento: ${typeof id === 'object' ? JSON.stringify(id) : id} (${typeof id})`);
    }
    const docRef = doc(db, fullPath, id);
    console.log(`[firebaseService] docRef created: ${docRef.path}`);
    
    // Remove id from payload if it exists
    const { id: _, ...payload } = data as any;
    
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
    console.log(`[firebaseService] updateDocument: path=${path}, id=${id}`, { dataType: typeof data, data });
    const fullPath = `users/${auth.currentUser.uid}/${path}`;
    if (!id || typeof id !== 'string') {
      console.error('[firebaseService] Invalid ID for updateDocument:', id, typeof id);
      throw new Error(`ID inválido para atualização: ${typeof id === 'object' ? JSON.stringify(id) : id} (${typeof id})`);
    }
    const docRef = doc(db, fullPath, id);
    console.log(`[firebaseService] docRef created for update: ${docRef.path}`);
    
    console.log(`Updating document at ${fullPath}/${id} with data`, data);
    
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
  },

  // Aplica várias escritas (em coleções possivelmente diferentes) num único WriteBatch —
  // ou tudo é gravado, ou nada é (ao contrário de uma sequência de saveDocument/
  // updateDocument separados, onde uma falha no meio deixa gravações anteriores
  // "penduradas" sem as que vinham depois). Usado por fluxos como Separar Caixas/Expedir
  // Venda, onde estoque + StockLot + venda precisam mudar juntos ou não mudar nenhum,
  // pra uma falha parcial nunca debitar estoque sem marcar a venda como separada (o que
  // deixava um novo clique repetir o débito).
  runBatchWrites: async (writes: Array<
    | { type: 'set' | 'update' | 'delete'; path: string; id: string; data?: any }
    // Crédito de estoque "seguro contra corrida": em vez de mandar o array `variations`
    // já calculado em cima do cache local (que pode estar desatualizado se duas baixas
    // do MESMO produto acontecerem próximas — ver applyExpedicaoStockUpdate em
    // PCPView.tsx), manda só o delta. Quando há pelo menos 1 escrita desse tipo, o método
    // roda tudo dentro de uma transação real que relê o produto na hora de gravar —
    // fecha a corrida que causou o incidente de 26/08/2026 (duas baixas de Acabamento do
    // mesmo produto quase juntas, a segunda sobrescrevendo o array inteiro e apagando o
    // crédito da primeira mesmo os dois StockLots tendo sido criados normalmente).
    | { type: 'increment_stock'; path: string; id: string; deltas: { variationId: string; key: string; delta: number; pkgId?: string; pkgDelta?: number }[] }
  >): Promise<void> => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    if (writes.length === 0) return;
    const uid = auth.currentUser.uid;

    const incrementWrites = writes.filter((w): w is Extract<typeof writes[number], { type: 'increment_stock' }> => w.type === 'increment_stock');
    const plainWrites = writes.filter((w): w is Extract<typeof writes[number], { type: 'set' | 'update' | 'delete' }> => w.type !== 'increment_stock');

    if (incrementWrites.length === 0) {
      const batch = writeBatch(db);
      plainWrites.forEach(w => {
        const fullPath = `users/${uid}/${w.path}`;
        const ref = doc(db, fullPath, w.id);
        if (w.type === 'delete') { batch.delete(ref); return; }
        const clean = deepClean(w.data);
        if (w.type === 'set') batch.set(ref, clean, { merge: true });
        else batch.update(ref, clean);
      });
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch-write');
      }
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        // Todos os `get` primeiro (regra de transação do Firestore) — um por produto
        // distinto, mesmo que ele receba deltas de várias variações/cores no mesmo lote.
        const productRefs = new Map<string, any>();
        const freshProducts = new Map<string, any>();
        for (const w of incrementWrites) {
          if (productRefs.has(w.id)) continue;
          const ref = doc(db, `users/${uid}/${w.path}`, w.id);
          productRefs.set(w.id, ref);
          const snap = await transaction.get(ref);
          if (snap.exists()) freshProducts.set(w.id, { id: snap.id, ...snap.data() });
        }

        for (const w of incrementWrites) {
          const prod = freshProducts.get(w.id);
          if (!prod) continue; // produto excluído entre o cálculo e a gravação — nada a incrementar
          const variations = (prod.variations || []).map((v: any) => ({
            ...v,
            stock: { ...(v.stock || {}) },
            stockPkgAllocations: (v.stockPkgAllocations || []).map((a: any) => ({ ...a })),
          }));
          w.deltas.forEach(d => {
            const idx = variations.findIndex((v: any) => v.id === d.variationId);
            if (idx < 0) return;
            const v = variations[idx];
            v.stock[d.key] = (v.stock[d.key] || 0) + d.delta;
            if (d.pkgId && d.pkgDelta) {
              const allocs = v.stockPkgAllocations;
              const ai = allocs.findIndex((a: any) => a.pkgId === d.pkgId);
              if (ai >= 0) allocs[ai] = { ...allocs[ai], qty: allocs[ai].qty + d.pkgDelta };
              else allocs.push({ pkgId: d.pkgId, qty: d.pkgDelta });
            }
          });
          transaction.set(productRefs.get(w.id), deepClean({ variations }), { merge: true });
        }

        plainWrites.forEach(w => {
          const ref = doc(db, `users/${uid}/${w.path}`, w.id);
          if (w.type === 'delete') { transaction.delete(ref); return; }
          const clean = deepClean(w.data);
          if (w.type === 'set') transaction.set(ref, clean, { merge: true });
          else transaction.update(ref, clean);
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.TRANSACTION, 'batch-write-atomic');
    }
  },

  // Move documentos de uma coleção para outra (copia + apaga da original) em lotes —
  // usado pelo arquivamento (DataCleanupView): cada "move" é 1 set + 1 delete = 2
  // operações, e o Firestore limita a 500 operações por batch, então no máximo 250
  // documentos por lote, com lotes sequenciais se precisar de mais.
  moveDocumentsBatch: async (fromPath: string, toPath: string, docs: { id: string; data: any }[]): Promise<void> => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    if (docs.length === 0) return;
    const fromFullPath = `users/${auth.currentUser.uid}/${fromPath}`;
    const toFullPath = `users/${auth.currentUser.uid}/${toPath}`;
    const CHUNK_SIZE = 250;
    try {
      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(({ id, data }) => {
          const { id: _omit, ...payload } = data;
          batch.set(doc(db, toFullPath, id), deepClean(payload));
          batch.delete(doc(db, fromFullPath, id));
        });
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${fromFullPath} -> ${toFullPath}`);
    }
  }
};

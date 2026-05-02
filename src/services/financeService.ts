import { doc, getDoc, Transaction as FirestoreTransaction, collection } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { firebaseService } from './firebaseService';
import { Transaction, TransactionType, Account } from '../types';

const cleanPayload = (obj: any) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj;
};

export const financeService = {
  /**
   * Realiza a baixa de uma transação e atualiza o saldo da conta de forma atômica.
   */
  settleTransaction: async (transactionId: string) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const userId = auth.currentUser.uid;
    
    await firebaseService.runAtomic(async (tx: FirestoreTransaction) => {
      // 1. All References
      const txRef = doc(db, `users/${userId}/transactions`, transactionId);
      
      // 2. All Reads
      const txSnap = await tx.get(txRef);
      if (!txSnap.exists()) throw new Error('Transação não encontrada');
      
      const transaction = { id: txSnap.id, ...txSnap.data() } as Transaction;
      if (transaction.status === 'COMPLETED') return;

      const accRef = doc(db, `users/${userId}/accounts`, transaction.accountId);
      const accSnap = await tx.get(accRef);
      if (!accSnap.exists()) throw new Error('Conta bancária não encontrada');
      
      const account = accSnap.data() as Account;

      // 3. All Calculations
      const amount = Number(transaction.amount) || 0;
      const currentBalance = Number(account.balance) || 0;
      const diff = transaction.type === TransactionType.INCOME ? amount : -amount;
      const newBalance = currentBalance + diff;

      // 4. All Writes
      tx.update(txRef, { status: 'COMPLETED', updatedAt: Date.now() });
      tx.update(accRef, { balance: newBalance, updatedAt: Date.now() });
    });
  },

  /**
   * Exclui uma transação e reverte o saldo da conta se já estivesse liquidada.
   */
  deleteTransaction: async (transactionId: string) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const userId = auth.currentUser.uid;

    await firebaseService.runAtomic(async (tx: FirestoreTransaction) => {
      // 1. All References
      const txRef = doc(db, `users/${userId}/transactions`, transactionId);
      
      // 2. All Reads
      const txSnap = await tx.get(txRef);
      if (!txSnap.exists()) return;

      const transaction = { id: txSnap.id, ...txSnap.data() } as Transaction;
      
      let accountSnapData = null;
      let accRef = null;
      if (transaction.status === 'COMPLETED' && transaction.accountId) {
        accRef = doc(db, `users/${userId}/accounts`, transaction.accountId);
        const accSnap = await tx.get(accRef);
        if (accSnap.exists()) {
          accountSnapData = accSnap.data() as Account;
        }
      }

      // 3. All Writes
      if (accountSnapData && accRef) {
        const amount = Number(transaction.amount) || 0;
        const currentBalance = Number(accountSnapData.balance) || 0;
        const revertDiff = transaction.type === TransactionType.INCOME ? -amount : amount;
        tx.update(accRef, { balance: currentBalance + revertDiff, updatedAt: Date.now() });
      }

      tx.delete(txRef);
    });
  },

  /**
   * Cria uma nova transação e atualiza saldo se for à vista (COMPLETED).
   */
  createTransaction: async (data: any) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const userId = auth.currentUser.uid;

    await firebaseService.runAtomic(async (tx: FirestoreTransaction) => {
      // 1. References
      const txId = doc(collection(db, `users/${userId}/transactions`)).id;
      const txRef = doc(db, `users/${userId}/transactions`, txId);
      
      const payload = cleanPayload({ 
        ...data, 
        amount: Number(data.amount) || 0,
        createdAt: Date.now(), 
        updatedAt: Date.now() 
      });
      delete payload.id;

      // 2. Reads
      let accountSnapData = null;
      let accRef = null;
      if (payload.status === 'COMPLETED' && payload.accountId) {
        accRef = doc(db, `users/${userId}/accounts`, payload.accountId);
        const accSnap = await tx.get(accRef);
        if (accSnap.exists()) {
          accountSnapData = accSnap.data() as Account;
        }
      }

      // 3. Writes
      if (accountSnapData && accRef) {
        const currentBalance = Number(accountSnapData.balance) || 0;
        const diff = payload.type === TransactionType.INCOME ? payload.amount : -payload.amount;
        tx.update(accRef, { balance: currentBalance + diff, updatedAt: Date.now() });
      }

      tx.set(txRef, payload);
    });
  },

  /**
   * Atualiza uma transação e ajusta o saldo das contas envolvidas se necessário.
   */
  updateTransaction: async (id: string, updates: any) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const userId = auth.currentUser.uid;

    console.log(`[FinanceService] Updating transaction ${id}`, updates);

    try {
      await firebaseService.runAtomic(async (tx: FirestoreTransaction) => {
        const txRef = doc(db, `users/${userId}/transactions`, id);
        const txSnap = await tx.get(txRef);
        
        if (!txSnap.exists()) throw new Error('Transação não encontrada');
        const oldTx = { id: txSnap.id, ...txSnap.data() } as Transaction;
        const updatedTx = { ...oldTx, ...updates };

        // 1. Identify all needed accounts
        const accountIds = new Set<string>();
        if (oldTx.status === 'COMPLETED' && oldTx.accountId) accountIds.add(oldTx.accountId);
        if (updatedTx.status === 'COMPLETED' && updatedTx.accountId) accountIds.add(updatedTx.accountId);

        // 2. Perform all READS first
        const accountSnaps: Record<string, any> = {};
        for (const accId of accountIds) {
          const accRef = doc(db, `users/${userId}/accounts`, accId);
          const snap = await tx.get(accRef);
          if (snap.exists()) {
            accountSnaps[accId] = snap.data();
          }
        }

        // 3. Perform calculations and WRITES
        const accountChanges: Record<string, number> = {};

        // Revert old balance if it was completed
        if (oldTx.status === 'COMPLETED' && oldTx.accountId && accountSnaps[oldTx.accountId]) {
          const oldAmount = Number(oldTx.amount) || 0;
          const revertDiff = oldTx.type === TransactionType.INCOME ? -oldAmount : oldAmount;
          accountChanges[oldTx.accountId] = (accountChanges[oldTx.accountId] || 0) + revertDiff;
        }

        // Apply new balance if it is completed
        if (updatedTx.status === 'COMPLETED' && updatedTx.accountId && accountSnaps[updatedTx.accountId]) {
          const newAmount = Number(updatedTx.amount) || 0;
          const diff = updatedTx.type === TransactionType.INCOME ? newAmount : -newAmount;
          accountChanges[updatedTx.accountId] = (accountChanges[updatedTx.accountId] || 0) + diff;
        }

        // Update accounts
        for (const [accId, change] of Object.entries(accountChanges)) {
          if (change === 0) continue;
          const accRef = doc(db, `users/${userId}/accounts`, accId);
          const currentBalance = Number(accountSnaps[accId].balance) || 0;
          tx.update(accRef, { 
            balance: currentBalance + change, 
            updatedAt: Date.now() 
          });
        }

        const payload = cleanPayload({ ...updates, updatedAt: Date.now() });
        if (payload.amount !== undefined) payload.amount = Number(payload.amount);
        delete payload.id;
        tx.update(txRef, payload);
      });
      console.log(`[FinanceService] Successfully updated transaction: ${id}`);
    } catch (error) {
      console.error(`[FinanceService] Error updating transaction:`, error);
      throw error;
    }
  }
};

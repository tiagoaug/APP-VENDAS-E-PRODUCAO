import type { firestore } from "firebase-admin";

/**
 * "Notas de terceiros" — um talão físico de notas pré-impressas comprado fora do Bling (não é a
 * NF-e eletrônica emitida por lá, que já tem seu próprio fluxo em sync.ts). O usuário cadastra
 * quantas notas tem no talão; cada par vendido consome uma nota desse saldo automaticamente
 * (ver `consumeNotesForNewOrder`, chamado de dentro de `syncBlingOrders`); devoluções devolvem
 * pro saldo (ver `registerBlingDevolucao`); e o saldo pode ser corrigido manualmente a qualquer
 * momento (ver `adjustThirdPartyNotes`). Tudo registrado em `blingNoteAdjustments` pra auditoria.
 */
export interface BlingNotesCounterData {
  total: number; // saldo disponível agora
  totalCadastrado: number; // soma histórica de tudo que já foi cadastrado/somado manualmente
  totalConsumido: number; // soma histórica de pares vendidos consumidos
  totalDevolvido: number; // soma histórica de pares devolvidos
  updatedAt: number;
}

export type BlingNoteAdjustmentType = "CADASTRO" | "AJUSTE_MANUAL" | "CONSUMO_VENDA" | "DEVOLUCAO";

const EMPTY_COUNTER: BlingNotesCounterData = { total: 0, totalCadastrado: 0, totalConsumido: 0, totalDevolvido: 0, updatedAt: 0 };

function counterRef(db: firestore.Firestore, uid: string) {
  return db.collection("users").doc(uid).collection("blingNotesCounter").doc("counter");
}

function adjustmentsRef(db: firestore.Firestore, uid: string) {
  return db.collection("users").doc(uid).collection("blingNoteAdjustments");
}

function logAdjustment(
  db: firestore.Firestore,
  uid: string,
  tx: firestore.Transaction,
  type: BlingNoteAdjustmentType,
  delta: number,
  balanceAfter: number,
  extra?: { motivo?: string; blingOrderId?: string }
) {
  const ref = adjustmentsRef(db, uid).doc();
  tx.set(ref, { id: ref.id, type, delta, balanceAfter, motivo: extra?.motivo || null, blingOrderId: extra?.blingOrderId || null, createdAt: Date.now() });
}

/**
 * Ajuste manual do saldo — soma/subtrai (`delta`) ou fixa um valor absoluto (`setTo`, usado no
 * cadastro inicial do talão ou pra corrigir uma contagem errada). Cria o contador na primeira
 * chamada se ainda não existir.
 */
export async function adjustThirdPartyNotes(
  db: firestore.Firestore,
  uid: string,
  input: { delta?: number; setTo?: number; motivo?: string }
): Promise<BlingNotesCounterData> {
  const ref = counterRef(db, uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current: BlingNotesCounterData = snap.exists ? (snap.data() as BlingNotesCounterData) : EMPTY_COUNTER;
    const isFirstSetup = !snap.exists;

    const delta = input.setTo !== undefined ? input.setTo - current.total : input.delta || 0;
    const newTotal = current.total + delta;
    const next: BlingNotesCounterData = {
      total: newTotal,
      totalCadastrado: current.totalCadastrado + (delta > 0 ? delta : 0),
      totalConsumido: current.totalConsumido,
      totalDevolvido: current.totalDevolvido,
      updatedAt: Date.now(),
    };
    tx.set(ref, next, { merge: true });
    logAdjustment(db, uid, tx, isFirstSetup ? "CADASTRO" : "AJUSTE_MANUAL", delta, newTotal, { motivo: input.motivo });
    return next;
  });
}

/**
 * Consome (subtrai) do saldo a quantidade de pares de um pedido recém-importado — chamado de
 * dentro de `syncBlingOrders` só na primeira vez que um pedido aparece (nunca em resyncs do
 * mesmo pedido). Não faz nada se o contador nunca foi cadastrado (usuário que não usa esse
 * recurso não deve ver ajustes fantasmas), e não bloqueia o sync se o saldo ficar negativo — só
 * fica negativo mesmo, o painel de Saúde avisa visualmente.
 */
export async function consumeNotesForNewOrder(db: firestore.Firestore, uid: string, blingOrderId: string, pares: number): Promise<void> {
  if (pares <= 0) return;
  const ref = counterRef(db, uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const current = snap.data() as BlingNotesCounterData;
    const newTotal = current.total - pares;
    tx.set(ref, { ...current, total: newTotal, totalConsumido: current.totalConsumido + pares, updatedAt: Date.now() }, { merge: true });
    logAdjustment(db, uid, tx, "CONSUMO_VENDA", -pares, newTotal, { blingOrderId });
  });
}

/**
 * Devolução "só nota" — o cliente devolveu, mas não há produto/estoque envolvido nessa
 * devolução específica (ex.: nota emitida errada, ou o par nunca chegou a sair do estoque por
 * fora do fluxo do app). Só devolve a quantidade pro saldo de notas de terceiros, sem tocar em
 * `products`. Cria o contador na primeira chamada se ainda não existir.
 */
export async function registerNotesOnlyReturn(db: firestore.Firestore, uid: string, input: { quantidade: number; motivo?: string }): Promise<BlingNotesCounterData> {
  if (!input.quantidade || input.quantidade <= 0) throw new Error("Quantidade precisa ser maior que zero.");
  const ref = counterRef(db, uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current: BlingNotesCounterData = snap.exists ? (snap.data() as BlingNotesCounterData) : EMPTY_COUNTER;
    const newTotal = current.total + input.quantidade;
    const next: BlingNotesCounterData = { ...current, total: newTotal, totalDevolvido: current.totalDevolvido + input.quantidade, updatedAt: Date.now() };
    tx.set(ref, next, { merge: true });
    logAdjustment(db, uid, tx, "DEVOLUCAO", input.quantidade, newTotal, { motivo: input.motivo });
    return next;
  });
}

export interface RegisterDevolucaoInput {
  productId: string;
  variationId: string;
  size?: string; // ausente = ATACADO/WHOLESALE
  quantidade: number;
}

export interface BlingDevolucaoResult {
  ok: boolean;
  message: string;
}

/**
 * Devolução avulsa (por referência/tamanho/quantidade — não vinculada a um pedido Bling
 * específico). Soma de volta em `Variation.stock[tamanho]` (mesma convenção de chave usada em
 * `abaterEstoqueBling`), registra o histórico em `blingDevolucoes`, e devolve a quantidade pro
 * saldo de notas de terceiros (a venda que tinha consumido aquela nota está sendo desfeita) —
 * só se o contador já tiver sido cadastrado.
 */
export async function registerBlingDevolucao(db: firestore.Firestore, uid: string, input: RegisterDevolucaoInput): Promise<BlingDevolucaoResult> {
  if (!input.quantidade || input.quantidade <= 0) throw new Error("Quantidade precisa ser maior que zero.");

  const usersRef = db.collection("users").doc(uid);
  const productRef = usersRef.collection("products").doc(input.productId);
  const notesRef = counterRef(db, uid);

  await db.runTransaction(async (tx) => {
    // Firestore exige TODAS as leituras da transação antes de qualquer escrita — por isso os
    // dois tx.get() (produto e contador de notas) rodam aqui em cima, antes dos tx.set()
    // abaixo. Tinha um tx.get(notesRef) depois dos sets do produto/devolução que disparava
    // "Firestore transactions require all reads to be executed before all writes.".
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists) throw new Error("Produto não encontrado.");
    const notesSnap = await tx.get(notesRef);

    const product = productSnap.data() as any;
    const variIdx = (product.variations || []).findIndex((v: any) => v.id === input.variationId);
    if (variIdx < 0) throw new Error("Variação não encontrada.");
    const variation = product.variations[variIdx];
    const key = input.size || "WHOLESALE";
    variation.stock = { ...(variation.stock || {}) };
    variation.stock[key] = (variation.stock[key] || 0) + input.quantidade;
    tx.set(productRef, product, { merge: true });

    const devRef = usersRef.collection("blingDevolucoes").doc();
    tx.set(devRef, {
      id: devRef.id,
      productId: input.productId,
      productReference: product.reference || "",
      productName: product.name || "",
      variationId: input.variationId,
      variationName: variation.colorName || "",
      size: input.size || null,
      quantidade: input.quantidade,
      createdAt: Date.now(),
    });

    if (notesSnap.exists) {
      const current = notesSnap.data() as BlingNotesCounterData;
      const newTotal = current.total + input.quantidade;
      tx.set(notesRef, { ...current, total: newTotal, totalDevolvido: current.totalDevolvido + input.quantidade, updatedAt: Date.now() }, { merge: true });
      logAdjustment(db, uid, tx, "DEVOLUCAO", input.quantidade, newTotal, {
        motivo: `Devolução ${product.reference || ""} · ${variation.colorName || ""}${input.size ? " · " + input.size : ""}`,
      });
    }
  });

  return { ok: true, message: `Devolução registrada — ${input.quantidade} par(es) de volta ao estoque.` };
}

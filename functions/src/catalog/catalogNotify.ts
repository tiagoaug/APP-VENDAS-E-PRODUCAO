import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

// Dispara um push (Firebase Cloud Messaging) pro dono da conta sempre que um pedido novo chega
// pelo Catálogo Público (Exclusivo ou Grupo) — ver functions/src/catalog/publicCatalog.ts
// (submitCatalogRequest, que grava o doc que este gatilho escuta) e
// src/services/pushNotificationService.ts (registro do token no aparelho, coleção
// users/{uid}/fcmTokens). Roda mesmo com o app fechado — é exatamente o ponto de usar push em
// vez de só um listener em tempo real (que só funciona com o app aberto).
export const notifyNewCatalogRequest = onDocumentCreated(
  "users/{uid}/catalogRequests/{requestId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const request = snap.data();
    const uid = event.params.uid;
    const db = admin.firestore();

    const tokensSnap = await db.collection("users").doc(uid).collection("fcmTokens").get();
    if (tokensSnap.empty) return;
    const tokens = tokensSnap.docs.map((d) => d.id);

    // Nome de quem pediu: Link Exclusivo tem personId (busca o nome do Cliente), Link de Grupo
    // já vem com customerName (nome que a própria pessoa digitou) — ver CatalogRequest em
    // src/types.ts.
    let who = "Alguém";
    if (request.customerName) {
      who = request.customerName;
    } else if (request.personId) {
      try {
        const personSnap = await db.collection("users").doc(uid).collection("people").doc(request.personId).get();
        who = (personSnap.data() as any)?.name || who;
      } catch {
        // Melhor esforço — nunca falha a notificação por causa disso, só usa o nome genérico.
      }
    }

    const itemCount = Array.isArray(request.items) ? request.items.length : 0;
    const body = `${who} enviou um pedido com ${itemCount} ${itemCount === 1 ? "produto" : "produtos"}.`;

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "Novo pedido pelo catálogo!",
        body,
      },
      data: {
        type: "catalog_request",
        requestId: event.params.requestId,
      },
      android: {
        priority: "high",
        notification: {
          channelId: "catalog_new_order",
          sound: "reminder_tone_urgent.wav",
        },
      },
    });

    // Limpa token que o Android/FCM já não reconhece mais (app desinstalado, token expirado)
    // — evita reenviar pra um destino morto pra sempre.
    const deadTokens: string[] = [];
    response.responses.forEach((r, idx) => {
      const code = (r.error as any)?.code;
      if (!r.success && (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token")) {
        deadTokens.push(tokens[idx]);
      }
    });
    if (deadTokens.length > 0) {
      await Promise.all(deadTokens.map((t) => db.collection("users").doc(uid).collection("fcmTokens").doc(t).delete().catch(() => {})));
    }
  }
);

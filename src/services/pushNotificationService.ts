import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { firebaseService } from './firebaseService';

// Canal do Android pro aviso de "pedido novo pelo catálogo" — som próprio (reaproveita um dos
// 30 toques de lembrete já embutidos no app, ver android/app/src/main/res/raw/), separado dos
// canais de Lembrete (notificationService.ts) porque é um alerta de negócio, não uma tarefa
// agendada pelo usuário.
const CATALOG_ORDER_CHANNEL_ID = 'catalog_new_order';
const CATALOG_ORDER_SOUND = 'reminder_tone_urgent.wav';

let initialized = false;

// Salva o token FCM deste aparelho em users/{uid}/fcmTokens/{token} — a Cloud Function
// notifyNewCatalogRequest (functions/src/catalog/catalogNotify.ts) lê essa coleção pra saber
// pra quais aparelhos mandar o push quando um pedido novo chega pelo Catálogo Público. Um doc
// por token (não por aparelho) porque o mesmo login pode ter vários aparelhos registrados ao
// mesmo tempo (celular do dono, tablet no balcão, etc.) — todos recebem o aviso.
async function saveToken(token: string): Promise<void> {
  try {
    await firebaseService.saveDocument('fcmTokens', {
      id: token,
      token,
      platform: Capacitor.getPlatform(),
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error('[pushNotificationService] saveToken failed', e);
  }
}

// Chamado uma vez, já autenticado (ver App.tsx) — pede permissão, registra no FCM e liga os
// listeners. `onOpenCatalogRequests` é chamado quando o usuário toca na notificação (leva
// direto pra tela de Pedidos Recebidos).
export async function initPushNotifications(onOpenCatalogRequests: () => void): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return;
  initialized = true;

  try {
    await PushNotifications.createChannel({
      id: CATALOG_ORDER_CHANNEL_ID,
      name: 'Pedidos pelo Catálogo',
      description: 'Avisa quando um cliente envia um pedido pelo Link de Pedido/Catálogo Público',
      importance: 5,
      visibility: 1,
      sound: CATALOG_ORDER_SOUND,
      vibration: true,
      lights: true,
      lightColor: '#4f46e5',
    });
  } catch (e) {
    console.error('[pushNotificationService] createChannel failed', e);
  }

  try {
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') {
      const req = await PushNotifications.requestPermissions();
      if (req.receive !== 'granted') return;
    }
    await PushNotifications.register();
  } catch (e) {
    console.error('[pushNotificationService] register failed', e);
    return;
  }

  PushNotifications.addListener('registration', (token) => {
    saveToken(token.value);
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('[pushNotificationService] registrationError', err);
  });

  // Com o app aberto (foreground), o Android NÃO mostra a notificação sozinho — precisa
  // reagendar como uma notificação local pra tocar o som e aparecer na bandeja igual quando o
  // app está fechado.
  PushNotifications.addListener('pushNotificationReceived', async (notification) => {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 1_000_000_000),
            title: notification.title || 'Novo pedido pelo catálogo!',
            body: notification.body || '',
            channelId: CATALOG_ORDER_CHANNEL_ID,
            schedule: { at: new Date(Date.now() + 300) },
          },
        ],
      });
    } catch (e) {
      console.error('[pushNotificationService] foreground reschedule failed', e);
    }
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    if (action.notification.data?.type === 'catalog_request') {
      onOpenCatalogRequests();
    }
  });
}

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Converte uma string de id em um inteiro positivo estável — a API nativa de
// notificações exige um id numérico, mas nossos lembretes são identificados
// por strings (os-<id>, sale-<id>, order-<id>-<productId>-<variationId>...).
function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

export interface ReminderNotification {
  id: string;
  title: string;
  body: string;
  at: number;
}

const isSupported = () => Capacitor.isNativePlatform();

// Canal próprio (Android) com prioridade máxima + vibração — faz o lembrete se
// comportar como um alarme (heads-up + vibra) em vez de uma notificação silenciosa.
const ALARM_CHANNEL_ID = 'reminders_alarm';
const ALARM_ACTION_TYPE_ID = 'reminder_alarm_actions';
const STOP_ACTION_ID = 'stop';
let channelReady = false;
let actionsReady = false;
let listenersReady = false;

async function ensureAlarmChannel(): Promise<void> {
  if (!isSupported() || channelReady) return;
  try {
    await LocalNotifications.createChannel({
      id: ALARM_CHANNEL_ID,
      name: 'Lembretes (Alarme)',
      description: 'Lembretes agendados com som e vibração, como um alarme',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#4f46e5',
    });
    channelReady = true;
  } catch (e) {
    console.error('[notificationService] ensureAlarmChannel failed', e);
  }
}

async function ensureAlarmActions(): Promise<void> {
  if (!isSupported() || actionsReady) return;
  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: ALARM_ACTION_TYPE_ID,
          actions: [{ id: STOP_ACTION_ID, title: 'Parar Alarme', destructive: true }],
        },
      ],
    });
    actionsReady = true;
  } catch (e) {
    console.error('[notificationService] ensureAlarmActions failed', e);
  }
}

// Botão "Parar Alarme" na notificação — dispensa o lembrete assim que tocado
function ensureListeners(): void {
  if (!isSupported() || listenersReady) return;
  listenersReady = true;
  LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    if (action.actionId === STOP_ACTION_ID) {
      LocalNotifications.cancel({ notifications: [{ id: action.notification.id }] }).catch(() => {});
    }
  });
}

export const notificationService = {
  async requestPermission(): Promise<boolean> {
    if (!isSupported()) return false;
    try {
      const result = await LocalNotifications.requestPermissions();
      await ensureAlarmChannel();
      await ensureAlarmActions();
      ensureListeners();
      return result.display === 'granted';
    } catch (e) {
      console.error('[notificationService] requestPermission failed', e);
      return false;
    }
  },

  async checkPermission(): Promise<boolean> {
    if (!isSupported()) return false;
    try {
      const result = await LocalNotifications.checkPermissions();
      return result.display === 'granted';
    } catch (e) {
      console.error('[notificationService] checkPermission failed', e);
      return false;
    }
  },

  async scheduleReminder({ id, title, body, at }: ReminderNotification): Promise<void> {
    if (!isSupported()) return;
    const numericId = hashId(id);
    if (!at || at <= Date.now()) {
      await this.cancelReminder(id);
      return;
    }
    try {
      await ensureAlarmChannel();
      await ensureAlarmActions();
      ensureListeners();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: numericId,
            title,
            body,
            channelId: ALARM_CHANNEL_ID,
            actionTypeId: ALARM_ACTION_TYPE_ID,
            schedule: { at: new Date(at), allowWhileIdle: true },
          },
        ],
      });
    } catch (e) {
      console.error('[notificationService] scheduleReminder failed', e);
    }
  },

  async cancelReminder(id: string): Promise<void> {
    if (!isSupported()) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: hashId(id) }] });
    } catch (e) {
      console.error('[notificationService] cancelReminder failed', e);
    }
  },

  async rescheduleAll(reminders: ReminderNotification[]): Promise<void> {
    if (!isSupported()) return;
    for (const reminder of reminders) {
      await this.scheduleReminder(reminder);
    }
  },
};

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ReminderTonePattern } from '../types';
import { REMINDER_TONE_LIBRARY } from '../data/reminderTones';

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
  // Compatibilidade: chamadas antigas não passam esses dois campos e continuam
  // se comportando exatamente como antes (alarme insistente, canal único).
  alarmMode?: boolean;
  soundPattern?: ReminderTonePattern;
  // "Alarme + Notificação": além do alarme insistente, dispara uma segunda notificação
  // (canal do padrão de toque escolhido) — só tem efeito quando alarmMode é true.
  combineMode?: boolean;
}

const isSupported = () => Capacitor.isNativePlatform();

// Canal (Android) com prioridade máxima + vibração — usado quando "alarmMode"
// está ativo: o lembrete se comporta como um alarme (heads-up, insistente,
// precisa ser dispensado pelo botão "Parar Alarme").
const ALARM_CHANNEL_ID = 'reminders_alarm';
const ALARM_ACTION_TYPE_ID = 'reminder_alarm_actions';
const STOP_ACTION_ID = 'stop';

// 30 padrões de toque + vibração pra lembretes "sem alarme" (biblioteca completa
// em src/data/reminderTones.ts) — cada um é o seu próprio canal Android porque,
// a partir do Android 8, o som de um canal não pode mais ser trocado depois de
// criado (é preciso um canal por som).
export const REMINDER_TONE_META: { id: ReminderTonePattern; label: string; description: string }[] =
  REMINDER_TONE_LIBRARY.map(t => ({ id: t.id, label: t.label, description: t.description }));

const toneChannelId = (toneId: string) => `reminder_tone_${toneId}`;
const toneSoundFile = (toneId: string) => `reminder_tone_${toneId}.wav`;
// Canal de ALARME por som — antes o modo Alarme usava sempre ALARM_CHANNEL_ID (sem `sound`
// nenhum, só o som padrão do Android), ignorando por completo o toque escolhido no perfil.
// Precisa ser um canal por som (não dá pra reaproveitar ALARM_CHANNEL_ID) pelo mesmo motivo dos
// canais de toque acima: a partir do Android 8, o som de um canal já criado não muda mais.
const alarmToneChannelId = (toneId: string) => `reminder_alarm_${toneId}`;

const DEFAULT_TONE: ReminderTonePattern = 'standard';

let channelsReady = false;
let actionsReady = false;
let listenersReady = false;

async function ensureChannels(): Promise<void> {
  if (!isSupported() || channelsReady) return;
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
  } catch (e) {
    console.error('[notificationService] createChannel (alarm) failed', e);
  }

  for (const meta of REMINDER_TONE_META) {
    try {
      await LocalNotifications.createChannel({
        id: toneChannelId(meta.id),
        name: `Lembrete — ${meta.label}`,
        description: meta.description,
        importance: meta.id === 'urgent' ? 5 : 4,
        visibility: 1,
        sound: toneSoundFile(meta.id),
        vibration: true,
        lights: true,
        lightColor: '#4f46e5',
      });
    } catch (e) {
      console.error(`[notificationService] createChannel (${meta.id}) failed`, e);
    }

    // Mesmo som, só que em prioridade máxima (igual ALARM_CHANNEL_ID) — usado quando o
    // perfil está em modo Alarme, pra tocar o som escolhido em vez do padrão do sistema.
    try {
      await LocalNotifications.createChannel({
        id: alarmToneChannelId(meta.id),
        name: `Lembrete Alarme — ${meta.label}`,
        description: meta.description,
        importance: 5,
        visibility: 1,
        sound: toneSoundFile(meta.id),
        vibration: true,
        lights: true,
        lightColor: '#4f46e5',
      });
    } catch (e) {
      console.error(`[notificationService] createChannel (alarm ${meta.id}) failed`, e);
    }
  }
  channelsReady = true;
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

async function ensureReady(): Promise<void> {
  await ensureChannels();
  await ensureAlarmActions();
  ensureListeners();
}

const PREVIEW_ID = 999999001;

export const notificationService = {
  async requestPermission(): Promise<boolean> {
    if (!isSupported()) return false;
    try {
      const result = await LocalNotifications.requestPermissions();
      await ensureReady();
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

  async scheduleReminder({ id, title, body, at, alarmMode, soundPattern, combineMode }: ReminderNotification): Promise<void> {
    if (!isSupported()) return;
    const numericId = hashId(id);
    const combineNumericId = hashId(id + '::notify');
    if (!at || at <= Date.now()) {
      await this.cancelReminder(id);
      return;
    }
    const useAlarm = alarmMode !== false; // default: alarme (mantém comportamento anterior)
    try {
      await ensureReady();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: numericId,
            title,
            body,
            channelId: useAlarm ? alarmToneChannelId(soundPattern || DEFAULT_TONE) : toneChannelId(soundPattern || DEFAULT_TONE),
            ...(useAlarm ? { actionTypeId: ALARM_ACTION_TYPE_ID } : {}),
            schedule: { at: new Date(at), allowWhileIdle: true },
          },
        ],
      });
      // "Alarme + Notificação": além do alarme insistente (acima), agenda uma segunda
      // notificação comum, no canal do padrão de toque — fica na bandeja mesmo depois
      // do alarme ser dispensado, já que "Parar Alarme" só cancela a notificação dele.
      if (useAlarm && combineMode) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: combineNumericId,
              title,
              body,
              channelId: toneChannelId(soundPattern || DEFAULT_TONE),
              schedule: { at: new Date(at), allowWhileIdle: true },
            },
          ],
        });
      } else {
        await LocalNotifications.cancel({ notifications: [{ id: combineNumericId }] }).catch(() => {});
      }
    } catch (e) {
      console.error('[notificationService] scheduleReminder failed', e);
    }
  },

  async cancelReminder(id: string): Promise<void> {
    if (!isSupported()) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: hashId(id) }, { id: hashId(id + '::notify') }] });
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

  // Cancela TODAS as notificações locais pendentes no aparelho, sem exceção — usado no logout
  // (ver App.tsx, handleLogout). Lembretes locais são agendados no sistema operacional, não
  // filtrados por conta/usuário logado: sem isso, trocar de conta no mesmo aparelho deixava os
  // lembretes da conta anterior (vencimentos de compra, pedidos, etc.) continuarem disparando
  // pra quem estivesse usando o aparelho depois, mesmo sem estar logado naquela conta. A conta
  // que acabou de sair recupera os próprios lembretes sozinha da próxima vez que logar (o efeito
  // em App.tsx que assina sales/purchases/etc. já reagenda tudo a partir dos dados dela).
  async cancelAll(): Promise<void> {
    if (!isSupported()) return;
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      }
    } catch (e) {
      console.error('[notificationService] cancelAll failed', e);
    }
  },

  // Dispara uma notificação de teste ~2s no futuro, no canal do padrão escolhido —
  // usado pelo seletor de toque pra ouvir a diferença antes de salvar.
  async previewTone(soundPattern: ReminderTonePattern, alarmMode: boolean): Promise<void> {
    if (!isSupported()) return;
    try {
      await ensureReady();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: PREVIEW_ID,
            title: 'Prévia do lembrete',
            body: alarmMode ? 'Assim soa no modo alarme' : `Assim soa: ${REMINDER_TONE_META.find(m => m.id === soundPattern)?.label || soundPattern}`,
            channelId: alarmMode ? alarmToneChannelId(soundPattern || DEFAULT_TONE) : toneChannelId(soundPattern),
            ...(alarmMode ? { actionTypeId: ALARM_ACTION_TYPE_ID } : {}),
            schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
          },
        ],
      });
    } catch (e) {
      console.error('[notificationService] previewTone failed', e);
    }
  },
};

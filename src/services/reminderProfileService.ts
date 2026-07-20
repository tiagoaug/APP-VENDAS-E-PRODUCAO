import { firebaseService } from './firebaseService';
import { ReminderProfile } from '../types';

const PROFILES_PATH = 'reminderProfiles';

export const DEFAULT_REMINDER_PROFILES: Omit<ReminderProfile, 'id'>[] = [
  { name: 'Alarme insistente', alarmMode: true, soundPattern: 'standard' },
  { name: 'Aviso silencioso', alarmMode: false, soundPattern: 'silent' },
  { name: 'Urgente', alarmMode: false, soundPattern: 'urgent' },
];

export async function seedDefaultReminderProfilesIfEmpty(): Promise<void> {
  const existing = await firebaseService.getCollection<ReminderProfile>(PROFILES_PATH);
  if (existing.length > 0) return;
  for (const profile of DEFAULT_REMINDER_PROFILES) {
    await firebaseService.saveDocument(PROFILES_PATH, { ...profile });
  }
}

export function subscribeToReminderProfiles(callback: (profiles: ReminderProfile[]) => void) {
  return firebaseService.subscribeToCollection<ReminderProfile>(PROFILES_PATH, callback);
}

export async function saveReminderProfile(profile: Omit<ReminderProfile, 'id'> & { id?: string }): Promise<void> {
  await firebaseService.saveDocument(PROFILES_PATH, profile);
}

export async function deleteReminderProfile(id: string): Promise<void> {
  await firebaseService.deleteDocument(PROFILES_PATH, id);
}

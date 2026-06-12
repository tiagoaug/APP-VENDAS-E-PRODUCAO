import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

export function isVoiceInputSupported(): boolean {
  return Capacitor.isNativePlatform();
}

export async function isVoiceInputAvailable(): Promise<boolean> {
  if (!isVoiceInputSupported()) return false;
  try {
    const { available } = await SpeechRecognition.available();
    return available;
  } catch {
    return false;
  }
}

export async function ensureVoicePermission(): Promise<boolean> {
  try {
    const status = await SpeechRecognition.checkPermissions();
    if (status.speechRecognition === 'granted') return true;
    const requested = await SpeechRecognition.requestPermissions();
    return requested.speechRecognition === 'granted';
  } catch {
    return false;
  }
}

export async function startVoiceListening(onPartial: (text: string) => void, onEnd: () => void): Promise<void> {
  await SpeechRecognition.removeAllListeners();
  await SpeechRecognition.addListener('partialResults', (data) => {
    if (data.matches && data.matches.length > 0) {
      onPartial(data.matches[0]);
    }
  });
  await SpeechRecognition.addListener('listeningState', (data) => {
    if (data.status === 'stopped') onEnd();
  });

  await SpeechRecognition.start({
    language: 'pt-BR',
    popup: false,
    partialResults: true,
    maxResults: 1,
  });
}

export async function stopVoiceListening(): Promise<void> {
  try {
    await SpeechRecognition.stop();
  } finally {
    await SpeechRecognition.removeAllListeners();
  }
}

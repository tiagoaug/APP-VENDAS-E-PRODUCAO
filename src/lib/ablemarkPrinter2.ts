import { Capacitor, registerPlugin } from '@capacitor/core';
import { toast } from '../utils/toast';
import { AbleMarkPairedDevice } from './ablemarkPrinter';

interface AbleMarkPrinterPlugin2 {
  isBluetoothEnabled(): Promise<{ enabled: boolean }>;
  requestEnableBluetooth(): Promise<{ enabled: boolean }>;
  listPairedDevices(): Promise<{ devices: AbleMarkPairedDevice[] }>;
  connect(options: { address: string }): Promise<{ connected: boolean }>;
  disconnect(): Promise<void>;
  resetConnection(): Promise<void>;
  isConnected(): Promise<{ connected: boolean }>;
  printLabel(options: { imagePath: string; paperType?: number; density?: number }): Promise<{ sent: boolean }>;
}

const AbleMarkPrinter2 = registerPlugin<AbleMarkPrinterPlugin2>('AbleMarkPrinter2');

// Segundo módulo Ablemark — mesma ideia do módulo original (ablemarkPrinter.ts), plugin nativo
// independente (ver android/.../printstudio/printer2/), pra testar lado a lado sem afetar o
// módulo original.
export function isAblemarkPlatform2(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export async function listAbleMarkPairedDevices2(): Promise<AbleMarkPairedDevice[]> {
  if (!isAblemarkPlatform2()) return [];
  try {
    const result = await AbleMarkPrinter2.listPairedDevices();
    return result.devices;
  } catch (err: any) {
    toast.show('Erro ao listar dispositivos pareados: ' + (err?.message || err));
    return [];
  }
}

export async function connectAbleMarkPrinter2(address: string): Promise<{ connected: boolean; error?: string }> {
  if (!isAblemarkPlatform2()) {
    return { connected: false, error: 'Impressora disponível apenas no app Android.' };
  }
  try {
    const result = await AbleMarkPrinter2.connect({ address });
    return { connected: result.connected };
  } catch (err: any) {
    const message = err?.message || String(err);
    toast.show('Erro ao conectar na impressora: ' + message);
    return { connected: false, error: message };
  }
}

export async function disconnectAbleMarkPrinter2(): Promise<void> {
  if (!isAblemarkPlatform2()) return;
  try {
    await AbleMarkPrinter2.disconnect();
  } catch {
    // best-effort — se a ponte nativa já estiver num estado ruim, não há o que fazer aqui
  }
}

export async function resetAbleMarkPrinter2(): Promise<void> {
  if (!isAblemarkPlatform2()) return;
  try {
    await AbleMarkPrinter2.resetConnection();
  } catch (err: any) {
    toast.show('Erro ao resetar conexão: ' + (err?.message || err));
  }
}

export async function isAbleMarkPrinterConnected2(): Promise<boolean> {
  if (!isAblemarkPlatform2()) return false;
  try {
    const result = await AbleMarkPrinter2.isConnected();
    return result.connected;
  } catch {
    return false;
  }
}

export async function printAbleMarkLabel2(imagePath: string, paperType = 2, density = 2): Promise<{ sent: boolean; error?: string }> {
  if (!isAblemarkPlatform2()) {
    return { sent: false, error: 'Impressora disponível apenas no app Android.' };
  }
  try {
    const result = await AbleMarkPrinter2.printLabel({ imagePath, paperType, density });
    return { sent: result.sent };
  } catch (err: any) {
    const message = err?.message || String(err);
    toast.show('Erro ao imprimir: ' + message);
    return { sent: false, error: message };
  }
}

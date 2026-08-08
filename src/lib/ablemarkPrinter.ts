import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { toast } from '../utils/toast';

export interface AbleMarkPairedDevice {
  name: string;
  address: string;
}

interface AbleMarkPrinterPlugin {
  isBluetoothEnabled(): Promise<{ enabled: boolean }>;
  requestEnableBluetooth(): Promise<{ enabled: boolean }>;
  listPairedDevices(): Promise<{ devices: AbleMarkPairedDevice[] }>;
  connect(options: { address: string }): Promise<{ connected: boolean }>;
  disconnect(): Promise<void>;
  resetConnection(): Promise<void>;
  isConnected(): Promise<{ connected: boolean }>;
  printLabel(options: { imagePath: string; paperType?: number; density?: number }): Promise<{ sent: boolean }>;
}

const AbleMarkPrinter = registerPlugin<AbleMarkPrinterPlugin>('AbleMarkPrinter');

// Cliente da impressora de etiqueta Ablemark BR-L100 (Bluetooth Classic/SPP, protocolo X4 —
// ver android/app/src/main/java/com/musgo/vendaseproducao/printstudio/printer/) — só funciona
// no app Android nativo, não tem equivalente web. `imagePath` precisa ser uma URI de arquivo já
// salva (ex.: retorno de Filesystem.writeFile), nunca base64 bruto — mesma convenção do Print
// Studio (ver printStudio.ts).
// Checagem/pedido de Bluetooth ligado — usado antes de abrir a área de impressão, pra pedir
// pro usuário ligar o Bluetooth em vez de só falhar depois na conexão com a impressora.
export async function isBluetoothEnabled(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await AbleMarkPrinter.isBluetoothEnabled();
    return result.enabled;
  } catch {
    return false;
  }
}

export async function requestEnableBluetooth(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await AbleMarkPrinter.requestEnableBluetooth();
    return result.enabled;
  } catch (err: any) {
    toast.show('Erro ao pedir ativação do Bluetooth: ' + (err?.message || err));
    return false;
  }
}

export async function listAbleMarkPairedDevices(): Promise<AbleMarkPairedDevice[]> {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    const result = await AbleMarkPrinter.listPairedDevices();
    return result.devices;
  } catch (err: any) {
    toast.show('Erro ao listar dispositivos pareados: ' + (err?.message || err));
    return [];
  }
}

export async function connectAbleMarkPrinter(address: string): Promise<{ connected: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { connected: false, error: 'Impressora disponível apenas no app Android.' };
  }
  try {
    const result = await AbleMarkPrinter.connect({ address });
    return { connected: result.connected };
  } catch (err: any) {
    const message = err?.message || String(err);
    toast.show('Erro ao conectar na impressora: ' + message);
    return { connected: false, error: message };
  }
}

export async function disconnectAbleMarkPrinter(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await AbleMarkPrinter.disconnect();
}

// Apaga só os PNGs temporários gerados pra impressão (label_*/ablemark_test_*, ver
// LabelEditorView e AblemarkPrinterTestModal) — best-effort, uma falha aqui não deve impedir o
// reset da conexão em si.
async function clearLabelPrintCache(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { files } = await Filesystem.readdir({ path: '', directory: Directory.Cache });
    const toDelete = files.filter(f => f.name.startsWith('label_') || f.name.startsWith('ablemark_test_'));
    for (const f of toDelete) {
      try {
        await Filesystem.deleteFile({ path: f.name, directory: Directory.Cache });
      } catch {
        // ignora arquivo individual que não puder ser apagado, segue pros próximos
      }
    }
  } catch {
    // pasta de cache vazia/inacessível — nada a fazer
  }
}

/**
 * Recuperação pra quando uma impressão falha de um jeito que não é só "não conectado" —
 * descarta o cliente/socket nativo inteiro (força um BluetoothSocket novo na próxima conexão,
 * em vez de reusar um que pode ter ficado num estado ruim) e limpa os PNGs temporários de
 * impressão. Depois disso o usuário precisa conectar de novo.
 */
export async function resetAbleMarkPrinter(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AbleMarkPrinter.resetConnection();
  } catch (err: any) {
    toast.show('Erro ao resetar conexão: ' + (err?.message || err));
  }
  await clearLabelPrintCache();
}

export async function isAbleMarkPrinterConnected(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const result = await AbleMarkPrinter.isConnected();
  return result.connected;
}

export async function printAbleMarkLabel(imagePath: string, paperType = 2, density = 2): Promise<{ sent: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { sent: false, error: 'Impressora disponível apenas no app Android.' };
  }
  try {
    const result = await AbleMarkPrinter.printLabel({ imagePath, paperType, density });
    return { sent: result.sent };
  } catch (err: any) {
    const message = err?.message || String(err);
    toast.show('Erro ao imprimir: ' + message);
    return { sent: false, error: message };
  }
}

import { Capacitor, registerPlugin } from '@capacitor/core';
import { toast } from '../utils/toast';

export interface EpsonDiscoveredPrinter {
  name: string;
  /** Identificador de conexão no formato que o SDK da Epson usa (ex.: "TCP:192.168.x.x" pra
   * rede/Wi-Fi Direct) — nome exato do campo depende da API real, ainda não integrada. */
  target: string;
}

interface EpsonPrinterPlugin {
  discoverPrinters(): Promise<{ printers: EpsonDiscoveredPrinter[] }>;
  connect(options: { target: string }): Promise<{ connected: boolean }>;
  disconnect(): Promise<void>;
  isConnected(): Promise<{ connected: boolean }>;
  printLabel(options: { imagePath: string }): Promise<{ sent: boolean }>;
}

const EpsonPrinter = registerPlugin<EpsonPrinterPlugin>('EpsonPrinter');

// Estrutura BASE pro suporte a impressoras Epson (linha TM-m, Wi-Fi Direct) — mesmo formato de
// funções do ablemarkPrinter.ts, pra tela de impressão poder tratar as duas marcas de forma
// parecida. O lado nativo (EpsonPrinterPlugin.kt) ainda não integra o SDK real da Epson — todo
// método aqui rejeita com uma mensagem clara em vez de fingir sucesso, até o SDK oficial (Epson
// ePOS SDK for Android) ser adicionado ao projeto e a impressora estar disponível pra validar.
const NOT_IMPLEMENTED_MSG = 'Impressão Epson ainda não disponível — aguardando integração do SDK oficial da Epson.';

export async function discoverEpsonPrinters(): Promise<EpsonDiscoveredPrinter[]> {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    const result = await EpsonPrinter.discoverPrinters();
    return result.printers;
  } catch (err: any) {
    toast.show(err?.message || NOT_IMPLEMENTED_MSG);
    return [];
  }
}

export async function connectEpsonPrinter(target: string): Promise<{ connected: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { connected: false, error: 'Impressora disponível apenas no app Android.' };
  }
  try {
    const result = await EpsonPrinter.connect({ target });
    return { connected: result.connected };
  } catch (err: any) {
    const message = err?.message || NOT_IMPLEMENTED_MSG;
    toast.show(message);
    return { connected: false, error: message };
  }
}

export async function disconnectEpsonPrinter(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await EpsonPrinter.disconnect();
  } catch {
    // sem implementação nativa ainda em nenhuma plataforma — nada a fazer
  }
}

export async function isEpsonPrinterConnected(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await EpsonPrinter.isConnected();
    return result.connected;
  } catch {
    return false;
  }
}

export async function printEpsonLabel(imagePath: string): Promise<{ sent: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { sent: false, error: 'Impressora disponível apenas no app Android.' };
  }
  try {
    const result = await EpsonPrinter.printLabel({ imagePath });
    return { sent: result.sent };
  } catch (err: any) {
    const message = err?.message || NOT_IMPLEMENTED_MSG;
    toast.show(message);
    return { sent: false, error: message };
  }
}

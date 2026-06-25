import { Capacitor, registerPlugin } from '@capacitor/core';
import { toast } from '../utils/toast';

interface PrintStudioPlugin {
  open(options: { images?: string[] }): Promise<void>;
}

const PrintStudio = registerPlugin<PrintStudioPlugin>('PrintStudio');

// Abre a tela nativa do Print Studio (módulo Kotlin/Compose, android/app/src/main/java/
// com/musgo/vendaseproducao/printstudio/) — não existe equivalente web, só funciona no app
// Android instalado. `images`, quando informado, já precisa ser URIs de arquivo (ex.: o
// retorno de Filesystem.writeFile) — nunca base64 bruto, pra não sobrecarregar a ponte
// JS↔nativo com payloads grandes (ver utils/pcpShareExport.ts:sendPCPItemsToPrintStudio).
export async function openPrintStudio(images?: string[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    toast.show('Print Studio disponível apenas no app Android.');
    return;
  }
  await PrintStudio.open({ images });
}

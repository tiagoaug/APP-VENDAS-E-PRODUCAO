import type { Wllama as WllamaClass, LoadModelParams } from '@wllama/wllama/esm/index.js';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Capacitor } from '@capacitor/core';
import type { AIChatMessage } from './aiService';

// IA "embutida": roda 100% no aparelho via WASM (llama.cpp compilado pra WebAssembly),
// sem servidor e sem custo — o usuário baixa um .gguf pelo Hugging Face no próprio
// celular e importa esse arquivo aqui. Só funciona bem com modelos pequenos (até ~3B
// parâmetros) por causa da memória/CPU do celular, e não tem acesso às ferramentas de
// dados do app (só chat de texto) nem é persistido entre sessões — o arquivo continua
// salvo no celular, mas precisa ser selecionado de novo a cada vez que o app reabre.
const WASM_CONFIG_PATHS = { default: '/wllama/wllama.wasm' };

const SYSTEM_PROMPT =
  'Você é um assistente de IA rodando OFFLINE, localmente no celular do usuário, dentro do "LIM.O APP" (gestão de vendas e produção de calçados). Você NÃO tem acesso aos dados do sistema (produtos, pedidos, financeiro, estoque) — responda apenas com base no que o usuário disser nesta conversa, sem inventar dados do negócio dele. Responda sempre em português do Brasil, de forma direta e objetiva.';

const MAX_LOCAL_HISTORY_MESSAGES = 12;
const MAX_OUTPUT_TOKENS = 512;

export interface LocalModelInfo {
  name: string;
  sizeBytes: number;
}

export class LocalModelPickCancelledError extends Error {}

let wllamaInstance: WllamaClass | null = null;
let loadedModelInfo: LocalModelInfo | null = null;

// A lib (~300KB) só é buscada quando alguém realmente usa o provedor "IA local" —
// import dinâmico pra não engordar o bundle inicial de quem nunca usa esse recurso.
async function getWllama(): Promise<WllamaClass> {
  if (!wllamaInstance) {
    const { Wllama } = await import('@wllama/wllama/esm/index.js');
    wllamaInstance = new Wllama(WASM_CONFIG_PATHS);
  }
  return wllamaInstance;
}

export function getLoadedLocalModelInfo(): LocalModelInfo | null {
  return loadedModelInfo;
}

export function isLocalModelLoaded(): boolean {
  return !!loadedModelInfo && !!wllamaInstance?.isModelLoaded();
}

async function readPickedFileAsBlob(file: { blob?: Blob; path?: string }): Promise<Blob> {
  if (file.blob) return file.blob;
  if (file.path) {
    // No Android/iOS não dá pra ler arquivos grandes via base64 (estoura memória/bridge) —
    // convertFileSrc expõe o arquivo local direto pra WebView, e o fetch lê os bytes sem
    // passar pela ponte nativa<->JS.
    const url = Capacitor.convertFileSrc(file.path);
    const res = await fetch(url);
    if (!res.ok) throw new Error('Não foi possível ler o arquivo selecionado.');
    return res.blob();
  }
  throw new Error('Não foi possível acessar o arquivo selecionado.');
}

/** Abre o seletor de arquivos, valida que é um .gguf e carrega como o modelo ativo.
 * Lança LocalModelPickCancelledError se o usuário cancelar a seleção. */
export async function pickAndLoadLocalModel(): Promise<LocalModelInfo> {
  const result = await FilePicker.pickFiles({ limit: 1, readData: false });
  const file = result.files[0];
  if (!file) throw new LocalModelPickCancelledError();
  if (!file.name.toLowerCase().endsWith('.gguf')) {
    throw new Error('Selecione um arquivo de modelo no formato .gguf (baixado do Hugging Face).');
  }

  const blob = await readPickedFileAsBlob(file);

  await unloadLocalModel();
  const wllama = await getWllama();
  const params: LoadModelParams = { n_ctx: 4096 };
  await wllama.loadModel([blob], params);

  loadedModelInfo = { name: file.name, sizeBytes: file.size };
  return loadedModelInfo;
}

export async function unloadLocalModel(): Promise<void> {
  if (wllamaInstance) {
    try {
      await wllamaInstance.exit();
    } catch {
      // ignora — já pode estar descarregado
    }
  }
  wllamaInstance = null;
  loadedModelInfo = null;
}

export interface LocalChatResult {
  text: string;
  usage: { input_tokens: number; output_tokens: number };
}

export async function runLocalChatCompletion(
  messages: AIChatMessage[],
  onPartial?: (text: string) => void
): Promise<LocalChatResult> {
  if (!isLocalModelLoaded()) {
    throw new Error('Nenhum modelo local carregado. Selecione um arquivo .gguf em Ajustes > Assistente de IA.');
  }
  const wllama = await getWllama();

  const history = messages
    .filter((m) => !!m.content && m.content.trim().length > 0)
    .slice(-MAX_LOCAL_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content }));

  const chunks = await wllama.createChatCompletion({
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    stream: true,
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.6,
  });

  let text = '';
  let usage = { input_tokens: 0, output_tokens: 0 };
  for await (const chunk of chunks) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      text += delta;
      onPartial?.(text);
    }
    if (chunk.usage) {
      usage = { input_tokens: chunk.usage.prompt_tokens, output_tokens: chunk.usage.completion_tokens };
    }
  }

  return { text, usage };
}

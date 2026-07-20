// Contrato comum que os três adaptadores (Anthropic, OpenAI, Gemini) implementam.
// Cada adaptador cuida do próprio formato de mensagem/imagem/tool-call internamente —
// aqui fica só a forma de entrada/saída que o resto do backend (index.ts) enxerga.

export interface AIProviderImage {
  mediaType: string;
  data: string;
}

export interface AIProviderMessage {
  role: "user" | "assistant";
  content: string;
  images?: AIProviderImage[];
}

// JSON Schema simples (mesma forma que a Anthropic já usa em `input_schema`).
// Cada adaptador converte para o formato nativo do respectivo provedor.
export interface AIJsonSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  enum?: string[];
  items?: AIJsonSchema;
  description?: string;
  [key: string]: any;
}

export interface AIToolDef {
  name: string;
  description: string;
  input_schema: AIJsonSchema;
  // Marcador de cache específico da Anthropic (ignorado pelos demais adaptadores).
  cache_control?: { type: "ephemeral" };
}

export interface AIProviderUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface AIProviderProposal {
  toolName: string;
  input: any;
}

export interface AIProviderResult {
  text: string;
  usage: AIProviderUsage;
  proposal?: AIProviderProposal;
}

export interface RunChatParams {
  apiKey: string;
  model: string;
  systemPrompt: string;
  tools: AIToolDef[];
  messages: AIProviderMessage[];
  proposalToolNames: Set<string>;
  maxToolIterations: number;
  executeTool: (name: string, input: any) => Promise<any>;
}

export type RunChatFn = (params: RunChatParams) => Promise<AIProviderResult>;

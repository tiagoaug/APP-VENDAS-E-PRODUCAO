import { RunChatParams, AIProviderResult } from "./types";
import { runOpenAICompatibleChat } from "./openai";

// Hugging Face expõe um roteador de "Inference Providers" compatível com o
// formato de chat completions da OpenAI (mesmo SDK, só troca a baseURL e a
// chave). É a alternativa gratuita: basta um token de leitura da conta
// Hugging Face (https://huggingface.co/settings/tokens), sem custo de cartão
// — só sujeito a limites de uso do plano gratuito do provedor por trás do
// modelo escolhido. Nem todo modelo aceita "tools" (function calling); os
// que não aceitam ainda respondem em texto normalmente, só não conseguem
// abrir os formulários de proposta (cadastro/compra).
const HUGGINGFACE_BASE_URL = "https://router.huggingface.co/v1";

export async function runHuggingFaceChat(params: RunChatParams): Promise<AIProviderResult> {
  return runOpenAICompatibleChat(params, HUGGINGFACE_BASE_URL);
}

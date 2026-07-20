import { GoogleGenerativeAI, Content, Part } from "@google/generative-ai";
import { RunChatParams, AIProviderResult, AIProviderMessage, AIJsonSchema } from "./types";

// A API do Gemini usa o mesmo JSON Schema, mas com "type" em maiúsculas
// (OBJECT/STRING/NUMBER/...) em vez do padrão json-schema ("object"/"string"/...).
function toGeminiSchema(schema: AIJsonSchema | undefined): any {
  if (!schema || typeof schema !== "object") return schema;
  const out: any = { ...schema };
  if (typeof out.type === "string") out.type = out.type.toUpperCase();
  if (out.properties) {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([k, v]) => [k, toGeminiSchema(v as AIJsonSchema)])
    );
  }
  if (out.items) out.items = toGeminiSchema(out.items);
  return out;
}

function toGeminiRole(role: "user" | "assistant"): "user" | "model" {
  return role === "assistant" ? "model" : "user";
}

function toGeminiParts(m: AIProviderMessage, includeImages: boolean): Part[] {
  const parts: Part[] = [];
  if (m.content) parts.push({ text: m.content });
  if (includeImages) {
    for (const img of m.images || []) {
      if (img?.data) parts.push({ inlineData: { mimeType: img.mediaType, data: img.data } });
    }
  } else if ((m.images?.length || 0) > 0) {
    parts.push({ text: "[Imagem enviada anteriormente nesta conversa]" });
  }
  if (parts.length === 0) parts.push({ text: "" });
  return parts;
}

export async function runGeminiChat(params: RunChatParams): Promise<AIProviderResult> {
  const { apiKey, model, systemPrompt, tools, messages, proposalToolNames, maxToolIterations, executeTool } = params;

  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    tools: [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: toGeminiSchema(t.input_schema),
        })) as any,
      },
    ],
  });

  const lastIndex = messages.length - 1;
  const history: Content[] = messages.slice(0, lastIndex).map((m) => ({
    role: toGeminiRole(m.role),
    parts: toGeminiParts(m, false),
  }));

  const chat = genModel.startChat({ history });

  let currentParts: Part[] = toGeminiParts(messages[lastIndex], true);
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let i = 0; i < maxToolIterations; i++) {
    const result = await chat.sendMessage(currentParts);
    const usageMeta = result.response.usageMetadata;
    totalInputTokens += usageMeta?.promptTokenCount || 0;
    totalOutputTokens += usageMeta?.candidatesTokenCount || 0;
    const usage = { input_tokens: totalInputTokens, output_tokens: totalOutputTokens };

    const functionCalls = result.response.functionCalls() || [];
    const proposalCall = functionCalls.find((c) => proposalToolNames.has(c.name));
    if (proposalCall) {
      return { text: result.response.text() || "", usage, proposal: { toolName: proposalCall.name, input: proposalCall.args } };
    }

    if (functionCalls.length > 0) {
      const functionResponseParts: Part[] = [];
      for (const call of functionCalls) {
        const toolResult = await executeTool(call.name, call.args);
        functionResponseParts.push({ functionResponse: { name: call.name, response: { result: toolResult } } });
      }
      currentParts = functionResponseParts;
      continue;
    }

    return { text: result.response.text() || "", usage };
  }

  throw new Error("O assistente não conseguiu concluir a resposta (muitas etapas de ferramentas).");
}

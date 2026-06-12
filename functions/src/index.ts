import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { TOOLS, executeTool } from "./tools";

admin.initializeApp();
const db = admin.firestore();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const MODEL = "claude-sonnet-4-6";
const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_ITERATIONS = 5;

function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Você é o assistente de IA do "Gestão Pro", um app de gestão de vendas e produção de calçados (cabedais e solados).
Data de hoje: ${today}.

Você tem acesso a ferramentas de LEITURA dos dados do negócio do usuário (produtos, pedidos de compra/venda, financeiro, estoque de solados, clientes/fornecedores). Use-as sempre que precisar de dados reais antes de responder.

Diretrizes:
- Responda sempre em português do Brasil, de forma direta e objetiva.
- Use as ferramentas para buscar dados reais em vez de supor valores.
- Ao sugerir um "pedido de compra de solados", baseie-se no estoque atual e no fornecedor de cada molde retornado por get_sole_stock.
- Você ainda NÃO pode criar, editar ou excluir cadastros — apenas consultar e analisar. Se o usuário pedir uma ação de escrita, explique que essa função chega em uma próxima atualização e ofereça a informação/análise que puder.
- Formate valores monetários como "R$ X.XXX,XX".
- O usuário pode enviar fotos (ex: etiqueta de produto, ficha técnica, nota fiscal, foto de calçado ou solado). Quando receber uma imagem, extraia e organize as informações relevantes (nome/referência, cores, medidas, valores, fornecedor, quantidades etc.) e, se fizer sentido, compare com os dados já cadastrados usando as ferramentas disponíveis.`;
}

export const aiChat = onCall(
  {
    secrets: [anthropicApiKey],
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "É necessário estar autenticado para usar o assistente de IA.");
    }
    const uid = request.auth.uid;

    const incomingMessages = request.data?.messages;
    if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
      throw new HttpsError("invalid-argument", "É necessário enviar ao menos uma mensagem.");
    }

    const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

    const conversation: Anthropic.MessageParam[] = incomingMessages
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m: any) => {
        const role: "user" | "assistant" = m.role === "assistant" ? "assistant" : "user";
        const images = Array.isArray(m.images) ? m.images : [];

        if (images.length === 0) {
          return { role, content: String(m.content || "") };
        }

        const blocks: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];
        for (const img of images) {
          if (img?.data && ALLOWED_IMAGE_TYPES.has(img.mediaType)) {
            blocks.push({
              type: "image",
              source: { type: "base64", media_type: img.mediaType, data: img.data },
            });
          }
        }
        if (m.content) {
          blocks.push({ type: "text", text: String(m.content) });
        }
        return { role, content: blocks };
      });

    const anthropic = new Anthropic({ apiKey: anthropicApiKey.value() });

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: buildSystemPrompt(),
        tools: TOOLS,
        messages: conversation,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      if (response.stop_reason === "tool_use") {
        conversation.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === "tool_use") {
            const result = await executeTool(db, uid, block.name, block.input);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }
        conversation.push({ role: "user", content: toolResults });
        continue;
      }

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      await db.collection("users").doc(uid).collection("aiUsage").add({
        timestamp: Date.now(),
        model: MODEL,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
      });

      return {
        text,
        usage: { input_tokens: totalInputTokens, output_tokens: totalOutputTokens },
      };
    }

    throw new HttpsError("internal", "O assistente não conseguiu concluir a resposta (muitas etapas de ferramentas).");
  }
);

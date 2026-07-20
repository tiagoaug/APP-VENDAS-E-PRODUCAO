import Anthropic from "@anthropic-ai/sdk";
import type {
  PromptCachingBetaMessageParam,
  PromptCachingBetaTextBlockParam,
  PromptCachingBetaImageBlockParam,
  PromptCachingBetaToolResultBlockParam,
  PromptCachingBetaTool,
} from "@anthropic-ai/sdk/resources/beta/prompt-caching/messages";
import { RunChatParams, AIProviderResult } from "./types";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function runAnthropicChat(params: RunChatParams): Promise<AIProviderResult> {
  const { apiKey, model, systemPrompt, tools, messages, proposalToolNames, maxToolIterations, executeTool } = params;

  const anthropicTools: PromptCachingBetaTool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as any,
    ...(t.cache_control ? { cache_control: t.cache_control } : {}),
  }));

  const lastIndex = messages.length - 1;
  const conversation: PromptCachingBetaMessageParam[] = messages.map((m, idx) => {
    const images = idx === lastIndex ? m.images || [] : [];
    const hadOlderImages = idx !== lastIndex && (m.images?.length || 0) > 0;

    if (images.length === 0) {
      const text = hadOlderImages
        ? `${m.content ? m.content + "\n" : ""}[Imagem enviada anteriormente nesta conversa]`
        : m.content;
      return { role: m.role, content: text };
    }

    const blocks: Array<PromptCachingBetaTextBlockParam | PromptCachingBetaImageBlockParam> = [];
    for (const img of images) {
      if (img?.data && ALLOWED_IMAGE_TYPES.has(img.mediaType)) {
        blocks.push({
          type: "image",
          source: { type: "base64", media_type: img.mediaType as any, data: img.data },
        });
      }
    }
    if (m.content) {
      blocks.push({ type: "text", text: m.content });
    }
    return { role: m.role, content: blocks };
  });

  const anthropic = new Anthropic({ apiKey });

  // System prompt + tools marcados como cacheáveis: idênticos em toda chamada
  // (dentro do mesmo dia), então a Anthropic cobra ~10% a partir da 2ª chamada
  // dentro da janela de cache, em vez do preço cheio.
  const system: PromptCachingBetaTextBlockParam[] = [
    { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheCreationTokens = 0;

  for (let i = 0; i < maxToolIterations; i++) {
    const response = await anthropic.beta.promptCaching.messages.create({
      model,
      max_tokens: 2048,
      system,
      tools: anthropicTools,
      messages: conversation,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
    totalCacheReadTokens += response.usage.cache_read_input_tokens || 0;
    totalCacheCreationTokens += response.usage.cache_creation_input_tokens || 0;

    const usage = {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      cache_read_input_tokens: totalCacheReadTokens,
      cache_creation_input_tokens: totalCacheCreationTokens,
    };

    const proposalBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && proposalToolNames.has(b.name)
    );
    if (proposalBlock) {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return { text, usage, proposal: { toolName: proposalBlock.name, input: proposalBlock.input } };
    }

    if (response.stop_reason === "tool_use") {
      conversation.push({ role: "assistant", content: response.content });

      const toolResults: PromptCachingBetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await executeTool(block.name, block.input);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
        }
      }
      conversation.push({ role: "user", content: toolResults });
      continue;
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return { text, usage };
  }

  throw new Error("O assistente não conseguiu concluir a resposta (muitas etapas de ferramentas).");
}

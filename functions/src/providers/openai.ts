import OpenAI from "openai";
import { RunChatParams, AIProviderResult } from "./types";

export async function runOpenAIChat(params: RunChatParams): Promise<AIProviderResult> {
  const { apiKey, model, systemPrompt, tools, messages, proposalToolNames, maxToolIterations, executeTool } = params;

  const openai = new OpenAI({ apiKey });

  const openaiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema as any },
  }));

  const conversation: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt }];

  const lastIndex = messages.length - 1;
  messages.forEach((m, idx) => {
    const images = idx === lastIndex ? m.images || [] : [];
    const hadOlderImages = idx !== lastIndex && (m.images?.length || 0) > 0;

    if (images.length === 0) {
      const text = hadOlderImages
        ? `${m.content ? m.content + "\n" : ""}[Imagem enviada anteriormente nesta conversa]`
        : m.content;
      conversation.push({ role: m.role, content: text });
      return;
    }

    const content: OpenAI.Chat.ChatCompletionContentPart[] = [];
    if (m.content) content.push({ type: "text", text: m.content });
    for (const img of images) {
      if (img?.data) {
        content.push({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.data}` } });
      }
    }
    conversation.push({ role: "user", content });
  });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let i = 0; i < maxToolIterations; i++) {
    const response = await openai.chat.completions.create({
      model,
      messages: conversation,
      tools: openaiTools,
      max_tokens: 2048,
    });

    const choice = response.choices[0];
    totalInputTokens += response.usage?.prompt_tokens || 0;
    totalOutputTokens += response.usage?.completion_tokens || 0;
    const usage = { input_tokens: totalInputTokens, output_tokens: totalOutputTokens };

    const toolCalls = choice.message.tool_calls || [];
    const proposalCall = toolCalls.find((c) => c.type === "function" && proposalToolNames.has(c.function.name));
    if (proposalCall && proposalCall.type === "function") {
      let input: any = {};
      try {
        input = JSON.parse(proposalCall.function.arguments || "{}");
      } catch {
        input = {};
      }
      return { text: choice.message.content || "", usage, proposal: { toolName: proposalCall.function.name, input } };
    }

    if (toolCalls.length > 0) {
      conversation.push(choice.message);
      for (const call of toolCalls) {
        if (call.type !== "function") continue;
        let input: any = {};
        try {
          input = JSON.parse(call.function.arguments || "{}");
        } catch {
          input = {};
        }
        const result = await executeTool(call.function.name, input);
        conversation.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue;
    }

    return { text: choice.message.content || "", usage };
  }

  throw new Error("O assistente não conseguiu concluir a resposta (muitas etapas de ferramentas).");
}

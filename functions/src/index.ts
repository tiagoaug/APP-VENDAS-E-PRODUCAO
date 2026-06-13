import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import type {
  PromptCachingBetaMessageParam,
  PromptCachingBetaTextBlockParam,
  PromptCachingBetaImageBlockParam,
  PromptCachingBetaToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/beta/prompt-caching/messages";
import { TOOLS, executeTool } from "./tools";

admin.initializeApp();
const db = admin.firestore();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const MODEL = "claude-sonnet-4-6";
const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_ITERATIONS = 5;

// Ferramentas que não consultam o Firestore — seu "input" é a própria proposta
// devolvida ao frontend para o usuário revisar e preencher um formulário manualmente.
const PROPOSAL_TOOL_NAMES = new Set([
  "propose_person_registration",
  "propose_purchase_registration",
  "propose_sole_purchase_registration",
  "propose_provider_service_report",
]);

function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Você é o assistente de IA do "Gestão Pro", um app de gestão de vendas e produção de calçados (cabedais e solados).
Data de hoje: ${today}.

Você tem acesso a ferramentas de LEITURA dos dados do negócio do usuário (produtos, pedidos de compra/venda, financeiro, estoque de solados, clientes/fornecedores). Use-as sempre que precisar de dados reais antes de responder.

Diretrizes:
- Responda sempre em português do Brasil, de forma direta e objetiva.
- Use as ferramentas para buscar dados reais em vez de supor valores.
- Ao sugerir um "pedido de compra de solados", baseie-se no estoque atual e no fornecedor de cada molde retornado por get_sole_stock.
- Você ainda NÃO pode criar, editar ou excluir cadastros diretamente — apenas consultar e analisar. Se o usuário pedir uma ação de escrita que não seja cadastro de cliente/fornecedor, explique que essa função chega em uma próxima atualização e ofereça a informação/análise que puder.
- Formate valores monetários como "R$ X.XXX,XX".
- O usuário pode enviar fotos (ex: etiqueta de produto, ficha técnica, nota fiscal, foto de calçado ou solado). Quando receber uma imagem, extraia e organize as informações relevantes (nome/referência, cores, medidas, valores, fornecedor, quantidades etc.) e, se fizer sentido, compare com os dados já cadastrados usando as ferramentas disponíveis.
- Se o usuário fornecer (texto ou foto) os dados de um novo cliente ou fornecedor e pedir para cadastrar, use 'list_people' para checar se já existe um cadastro parecido e, em seguida, use a ferramenta 'propose_person_registration' com os campos que conseguir extrair com confiança (sem inventar dados). Essa ferramenta NÃO salva nada — ela abre o formulário de cadastro já preenchido para o usuário revisar e salvar manualmente. Avise o usuário se encontrou um cadastro parecido.
- Se o usuário fornecer (texto ou foto de nota/ficha) os itens de uma compra (material, aviamento, embalagem etc.) e pedir para cadastrar, use 'list_people' (type='supplier') para tentar localizar o fornecedor pelo nome e, em seguida, use a ferramenta 'propose_purchase_registration' com os itens e valores que conseguir extrair com confiança (sem inventar dados). Essa ferramenta NÃO salva nada — ela abre o formulário de "Compra Geral" já preenchido para o usuário revisar e salvar manualmente.
- Para planejamento estratégico de solados: quando o usuário informar a grade/quantidade que deseja MANTER em estoque para um molde/cor (ex.: "quero ter sempre 12 pares de cada tamanho da grade 37-44 do molde X cor Y"), use 'get_sole_stock' para obter, de cada tamanho/grade do molde/cor em questão, os campos 'available' (disponível real = estoque - reservado pela produção ativa) e 'pending' (já comprado e ainda não recebido). Some available[tamanho] + pending[tamanho] para obter a quantidade que ficará disponível em breve ("previsto") e calcule a diferença por tamanho como previsto - quantidade desejada. Se a diferença for negativa (déficit), use 'propose_sole_purchase_registration' incluindo no 'grid' apenas os tamanhos com déficit > 0 (valor = quantidade desejada - previsto[tamanho]), preenchendo moldId/colorId/supplierId a partir do resultado de 'get_sole_stock'. Não invente moldes, cores ou tamanhos que não existam no estoque. Se houver pending[tamanho] > 0 em algum tamanho, mencione ao usuário que já existe compra em andamento para esse tamanho (e a quantidade), para não parecer que a IA está sugerindo comprar de novo o que já foi comprado. Se a diferença for positiva (previsto maior do que o solicitado), informe ao usuário, tamanho a tamanho, que já há excedente/sobra acima do nível desejado e por quanto. Se não houver déficit em nenhum tamanho, informe ao usuário que o estoque previsto já atende à necessidade (apontando os excedentes, se houver), sem chamar 'propose_sole_purchase_registration'.
- Para perguntas como "em qual setor está o pedido/lote do cliente X?", "onde está o pedido NNN?" ou "quais pedidos estão com o prestador de serviço Y?", use 'search_production_lots' com o termo informado (nome do cliente, número do pedido/lote ou nome do prestador) e responda em texto citando o(s) pedido(s) encontrados, o setor atual ('currentSectorName') e, se houver 'activeServiceOrder', o prestador, a O.S. e o valor. Se nada for encontrado, informe isso ao usuário sem inventar dados.
- Para perguntas como "quanto tenho que pagar para o prestador X" (com ou sem período) ou um pedido de "relatório de serviços terceirizados do prestador X": primeiro chame 'get_provider_service_orders' com o nome do prestador (convertendo períodos em linguagem natural, ex. "este mês" ou "última semana", para 'fromDate'/'toDate' no formato YYYY-MM-DD usando a data de hoje informada acima). Em seguida, chame 'propose_provider_service_report' repassando EXATAMENTE os mesmos dados retornados por 'get_provider_service_orders' (sem inventar ou alterar valores), para que o app mostre um card de relatório com opções de copiar e exportar em PDF/imagem. Na resposta em texto, resuma os totais (pares, valor total, já pago, pendente) e cite os números das O.S. Se não houver O.S. para o prestador no período, informe isso ao usuário sem chamar 'propose_provider_service_report'.
- Para perguntas sobre "saldo em aberto", "valores a pagar/receber", "o que devo a fornecedores" ou "o que clientes me devem": chame 'list_people' (sem filtro de nome, para pegar todos) e use os campos 'totalPayable' (a pagar a esse fornecedor) e 'totalReceivable' (a receber desse cliente) — NÃO use o campo 'credit' para isso, ele é um saldo de crédito interno separado. Liste apenas as pessoas com 'totalPayable' > 0 ou 'totalReceivable' > 0, com os respectivos valores. Se o usuário pedir para destacar "em vermelho" ou "valores em aberto", apenas cite os valores normalmente (você não controla cores, mas pode descrever que esses são os valores pendentes).`;
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

    const slicedMessages = incomingMessages.slice(-MAX_HISTORY_MESSAGES);
    const lastIndex = slicedMessages.length - 1;

    // Apenas a última mensagem pode levar imagens — evita reenviar (e re-cobrar)
    // fotos já enviadas em mensagens anteriores da mesma conversa.
    const conversation: PromptCachingBetaMessageParam[] = slicedMessages.map((m: any, idx: number) => {
      const role: "user" | "assistant" = m.role === "assistant" ? "assistant" : "user";
      const images = idx === lastIndex && Array.isArray(m.images) ? m.images : [];
      const hadOlderImages = idx !== lastIndex && Array.isArray(m.images) && m.images.length > 0;

      if (images.length === 0) {
        const text = hadOlderImages
          ? `${m.content ? String(m.content) + "\n" : ""}[Imagem enviada anteriormente nesta conversa]`
          : String(m.content || "");
        return { role, content: text };
      }

      const blocks: Array<PromptCachingBetaTextBlockParam | PromptCachingBetaImageBlockParam> = [];
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
    let totalCacheReadTokens = 0;
    let totalCacheCreationTokens = 0;

    // System prompt + tools são marcados como cacheáveis: são idênticos em toda
    // chamada (dentro do mesmo dia), então a Anthropic cobra ~10% por esses tokens
    // em vez do preço cheio a partir da segunda chamada dentro da janela de cache.
    const system: PromptCachingBetaTextBlockParam[] = [
      { type: "text", text: buildSystemPrompt(), cache_control: { type: "ephemeral" } },
    ];

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await anthropic.beta.promptCaching.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system,
        tools: TOOLS,
        messages: conversation,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;
      totalCacheReadTokens += response.usage.cache_read_input_tokens || 0;
      totalCacheCreationTokens += response.usage.cache_creation_input_tokens || 0;

      const proposalBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && PROPOSAL_TOOL_NAMES.has(b.name)
      );
      if (proposalBlock) {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");

        await db.collection("users").doc(uid).collection("aiUsage").add({
          timestamp: Date.now(),
          model: MODEL,
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
          cache_read_input_tokens: totalCacheReadTokens,
          cache_creation_input_tokens: totalCacheCreationTokens,
        });

        const proposalType =
          proposalBlock.name === "propose_purchase_registration"
            ? "purchase"
            : proposalBlock.name === "propose_sole_purchase_registration"
            ? "sole_purchase"
            : proposalBlock.name === "propose_provider_service_report"
            ? "provider_service_report"
            : "person";

        return {
          text,
          usage: {
            input_tokens: totalInputTokens,
            output_tokens: totalOutputTokens,
            cache_read_input_tokens: totalCacheReadTokens,
            cache_creation_input_tokens: totalCacheCreationTokens,
          },
          formProposal: { type: proposalType, data: proposalBlock.input },
        };
      }

      if (response.stop_reason === "tool_use") {
        conversation.push({ role: "assistant", content: response.content });

        const toolResults: PromptCachingBetaToolResultBlockParam[] = [];
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
        cache_read_input_tokens: totalCacheReadTokens,
        cache_creation_input_tokens: totalCacheCreationTokens,
      });

      return {
        text,
        usage: {
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
          cache_read_input_tokens: totalCacheReadTokens,
          cache_creation_input_tokens: totalCacheCreationTokens,
        },
      };
    }

    throw new HttpsError("internal", "O assistente não conseguiu concluir a resposta (muitas etapas de ferramentas).");
  }
);

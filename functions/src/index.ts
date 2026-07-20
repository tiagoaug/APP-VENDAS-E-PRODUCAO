import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { TOOLS, executeTool } from "./tools";
import { runAnthropicChat } from "./providers/anthropic";
import { runOpenAIChat } from "./providers/openai";
import { runGeminiChat } from "./providers/gemini";
import { AIProviderMessage, RunChatFn } from "./providers/types";

admin.initializeApp();
const db = admin.firestore();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

type AIProviderId = "anthropic" | "openai" | "gemini";

const DEFAULT_MODELS: Record<AIProviderId, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4.1",
  gemini: "gemini-2.0-flash",
};

const RUNNERS: Record<AIProviderId, RunChatFn> = {
  anthropic: runAnthropicChat,
  openai: runOpenAIChat,
  gemini: runGeminiChat,
};

const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_ITERATIONS = 5;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

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

    const slicedMessages = incomingMessages.slice(-MAX_HISTORY_MESSAGES);
    const messages: AIProviderMessage[] = slicedMessages.map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
      images: Array.isArray(m.images)
        ? m.images.filter((img: any) => img?.data && ALLOWED_IMAGE_TYPES.has(img.mediaType))
        : [],
    }));

    // Provedor ativo + chave própria (OpenAI/Gemini) configurados em Mais Opções >
    // Sistema & Backup > Assistente de IA. Ficam na árvore do próprio usuário no
    // Firestore (mesma proteção por conta que todo o resto dos dados do negócio).
    // O Claude é o padrão embutido e usa a chave fixa do servidor (secret) — não
    // depende de o usuário configurar nada.
    const configSnap = await db.collection("users").doc(uid).collection("aiSettings").doc("providerConfig").get();
    const config = configSnap.exists ? (configSnap.data() as any) : null;
    const activeProvider: AIProviderId =
      config?.activeProvider === "openai" || config?.activeProvider === "gemini" ? config.activeProvider : "anthropic";

    let apiKey: string;
    let model: string;
    if (activeProvider === "openai") {
      apiKey = config?.openai?.apiKey;
      model = config?.openai?.model || DEFAULT_MODELS.openai;
      if (!apiKey) {
        throw new HttpsError("failed-precondition", "Configure a chave da OpenAI em Mais Opções > Assistente de IA.");
      }
    } else if (activeProvider === "gemini") {
      apiKey = config?.gemini?.apiKey;
      model = config?.gemini?.model || DEFAULT_MODELS.gemini;
      if (!apiKey) {
        throw new HttpsError("failed-precondition", "Configure a chave do Gemini em Mais Opções > Assistente de IA.");
      }
    } else {
      apiKey = anthropicApiKey.value();
      model = DEFAULT_MODELS.anthropic;
    }

    let result;
    try {
      result = await RUNNERS[activeProvider]({
        apiKey,
        model,
        systemPrompt: buildSystemPrompt(),
        tools: TOOLS,
        messages,
        proposalToolNames: PROPOSAL_TOOL_NAMES,
        maxToolIterations: MAX_TOOL_ITERATIONS,
        executeTool: (name, input) => executeTool(db, uid, name, input),
      });
    } catch (err: any) {
      throw new HttpsError("internal", err?.message || "Falha ao consultar o assistente de IA.");
    }

    await db.collection("users").doc(uid).collection("aiUsage").add({
      timestamp: Date.now(),
      model,
      provider: activeProvider,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      cache_read_input_tokens: result.usage.cache_read_input_tokens || 0,
      cache_creation_input_tokens: result.usage.cache_creation_input_tokens || 0,
    });

    if (result.proposal) {
      const proposalType =
        result.proposal.toolName === "propose_purchase_registration"
          ? "purchase"
          : result.proposal.toolName === "propose_sole_purchase_registration"
          ? "sole_purchase"
          : result.proposal.toolName === "propose_provider_service_report"
          ? "provider_service_report"
          : "person";

      return {
        text: result.text,
        usage: result.usage,
        formProposal: { type: proposalType, data: result.proposal.input },
      };
    }

    return { text: result.text, usage: result.usage };
  }
);

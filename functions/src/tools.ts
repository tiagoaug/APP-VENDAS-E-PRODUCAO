import { Firestore } from "firebase-admin/firestore";
import type { PromptCachingBetaTool } from "@anthropic-ai/sdk/resources/beta/prompt-caching/messages";
import { computeSoleMapaReservations } from "./soleNeeds";

// Tool schemas exposed to Claude (Anthropic Messages API "tools" format).
// All tools are READ-ONLY for now — they only query the user's Firestore data.
export const TOOLS: PromptCachingBetaTool[] = [
  {
    name: "search_products",
    description:
      "Busca produtos cadastrados pelo nome ou referência. Retorna estoque por cor/tamanho, preço de custo e de venda. Use para 'relatório do produto X' ou perguntas sobre estoque/preço de um modelo.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Termo de busca (nome ou referência do produto). Se vazio, retorna os primeiros produtos cadastrados.",
        },
      },
    },
  },
  {
    name: "get_overdue_orders",
    description:
      "Lista as compras e vendas em atraso (vencimento já passou e ainda não pagas/entregues), ordenadas da mais atrasada para a menos atrasada. Use para responder 'qual pedido está mais atrasado'.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_financial_overview",
    description:
      "Retorna um resumo financeiro: total a pagar (despesas pendentes), total a receber (receitas pendentes), saldo consolidado (lançamentos concluídos) e as principais categorias de gasto/recebimento pendentes.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_sole_stock",
    description:
      "Consulta o estoque de solados (moldes/cores), seus fornecedores e a disponibilidade real considerando reservas da produção ativa. " +
      "Para cada item, 'stock' é o estoque total por grade/tamanho, 'reserved' é o quanto já está reservado pela produção em andamento, e 'available' " +
      "é o disponível real (stock - reserved, por grade). Use 'available' para planejamento estratégico e sugestão de pedidos de compra de solados.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Termo de busca opcional (nome do molde, cor ou fornecedor).",
        },
      },
    },
  },
  {
    name: "list_people",
    description:
      "Lista clientes e/ou fornecedores cadastrados, com documento, telefone e saldo (crédito/débito) em aberto.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Termo de busca opcional pelo nome.",
        },
        type: {
          type: "string",
          enum: ["customer", "supplier"],
          description: "Filtra apenas clientes ('customer') ou apenas fornecedores ('supplier'). Se omitido, retorna ambos.",
        },
      },
    },
  },
  {
    name: "propose_person_registration",
    description:
      "Use quando o usuário fornecer (por texto ou foto de cartão/documento) os dados de um novo cliente ou fornecedor e pedir para cadastrá-lo. " +
      "Extraia apenas os campos que tiver certeza, sem inventar valores. " +
      "Esta ferramenta NÃO grava nada no banco — ela apenas envia os dados extraídos para o usuário revisar no formulário de cadastro e salvar manualmente. " +
      "Recomenda-se usar 'list_people' antes para verificar se já existe um cadastro parecido e avisar o usuário caso exista.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Nome completo da pessoa ou empresa (obrigatório).",
        },
        phone: {
          type: "string",
          description: "Telefone/WhatsApp, se identificado.",
        },
        email: {
          type: "string",
          description: "E-mail, se identificado.",
        },
        document: {
          type: "string",
          description: "CPF ou CNPJ, se identificado.",
        },
        isCustomer: {
          type: "boolean",
          description: "true se deve ser cadastrado como cliente.",
        },
        isSupplier: {
          type: "boolean",
          description: "true se deve ser cadastrado como fornecedor.",
        },
        observations: {
          type: "string",
          description: "Observações adicionais relevantes (ex: contexto de onde vieram os dados).",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "propose_purchase_registration",
    description:
      "Use quando o usuário fornecer (por texto ou foto de nota/ficha de material, aviamento, embalagem etc.) os itens de uma compra geral e pedir para cadastrá-la. " +
      "Extraia apenas os itens e valores que tiver certeza, sem inventar dados. " +
      "Esta ferramenta NÃO grava nada no banco — ela apenas envia os dados extraídos para o usuário revisar no formulário de 'Compra Geral' e salvar manualmente. " +
      "Recomenda-se usar 'list_people' (type='supplier') antes para tentar localizar o fornecedor pelo nome.",
    input_schema: {
      type: "object",
      properties: {
        supplierId: {
          type: "string",
          description: "ID do fornecedor, se encontrado via 'list_people'.",
        },
        supplierName: {
          type: "string",
          description: "Nome do fornecedor extraído da foto/texto, mesmo que não tenha sido encontrado um cadastro correspondente.",
        },
        items: {
          type: "array",
          description: "Itens da compra.",
          items: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "Descrição do item (obrigatório).",
              },
              quantity: {
                type: "number",
                description: "Quantidade, se identificada.",
              },
              unit: {
                type: "string",
                description: "Unidade (ex: 'un', 'par', 'm', 'kg'), se identificada.",
              },
              value: {
                type: "number",
                description: "Valor unitário ou total do item, se identificado.",
              },
            },
            required: ["description"],
          },
        },
        notes: {
          type: "string",
          description: "Observações adicionais relevantes (ex: número da nota, contexto de onde vieram os dados).",
        },
      },
      required: ["items"],
    },
  },
  {
    name: "propose_sole_purchase_registration",
    description:
      "Use para propor um pedido de compra de solados (matéria-prima) com base no planejamento estratégico de estoque. " +
      "Antes de usar, consulte 'get_sole_stock' para obter o campo 'available' (disponível = estoque - reservado pela produção ativa) de cada molde/cor. " +
      "Quando o usuário informar a grade/quantidade que deseja manter em estoque para um molde/cor, calcule o déficit por tamanho como " +
      "max(0, quantidade desejada - available[tamanho]) e inclua no 'grid' apenas os tamanhos com déficit maior que zero. " +
      "Não invente moldes, cores ou tamanhos que não existam no estoque retornado por 'get_sole_stock'. " +
      "Esta ferramenta NÃO grava nada no banco — ela apenas envia os dados para o usuário revisar no formulário de 'Compra de Solados' e salvar manualmente.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Itens do pedido de solados (um por molde/cor).",
          items: {
            type: "object",
            properties: {
              moldId: {
                type: "string",
                description: "ID do molde, obtido de 'get_sole_stock' (obrigatório).",
              },
              moldName: {
                type: "string",
                description: "Nome do molde.",
              },
              colorId: {
                type: "string",
                description: "ID da cor da sola, se houver.",
              },
              colorName: {
                type: "string",
                description: "Nome da cor da sola.",
              },
              supplierId: {
                type: "string",
                description: "ID do fornecedor, se conhecido.",
              },
              supplierName: {
                type: "string",
                description: "Nome do fornecedor, se conhecido.",
              },
              grid: {
                type: "object",
                description: "Déficit de pares por tamanho/grade (apenas tamanhos com déficit > 0). Ex: { \"37\": 5, \"38\": 8 }.",
                additionalProperties: { type: "number" },
              },
            },
            required: ["moldId", "grid"],
          },
        },
        notes: {
          type: "string",
          description: "Observações adicionais relevantes (ex: contexto do planejamento, urgência).",
        },
      },
      required: ["items"],
    },
    // Marca o fim do bloco "tools" para cache — Anthropic cacheia tudo até este ponto
    // (system prompt + definição das tools), evitando reprocessar esses tokens em toda chamada.
    cache_control: { type: "ephemeral" },
  },
];

async function getCollection(db: Firestore, uid: string, name: string) {
  const snap = await db.collection("users").doc(uid).collection(name).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
}

function sumStock(stock: Record<string, number> | undefined): number {
  if (!stock) return 0;
  return Object.values(stock).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

async function searchProducts(db: Firestore, uid: string, input: { query?: string }) {
  const products = await getCollection(db, uid, "products");
  const q = (input.query || "").trim().toLowerCase();
  const filtered = q
    ? products.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.reference || "").toLowerCase().includes(q)
      )
    : products;

  return filtered.slice(0, 15).map((p) => ({
    id: p.id,
    reference: p.reference,
    name: p.name,
    status: p.status,
    costPrice: p.costPrice,
    salePrice: p.salePrice,
    variations: (p.variations || []).map((v: any) => ({
      colorName: v.colorName,
      minStock: v.minStock,
      totalStock: sumStock(v.stock),
      stock: v.stock,
    })),
  }));
}

async function getOverdueOrders(db: Firestore, uid: string) {
  const [purchases, sales, people] = await Promise.all([
    getCollection(db, uid, "purchases"),
    getCollection(db, uid, "sales"),
    getCollection(db, uid, "people"),
  ]);

  const now = Date.now();
  const dayMs = 1000 * 60 * 60 * 24;
  const personName = (id?: string) => people.find((p) => p.id === id)?.name || "Desconhecido";

  const overduePurchases = purchases
    .filter((p) => p.dueDate && p.paymentStatus !== "PAID" && p.dueDate < now)
    .map((p) => ({
      tipo: "compra",
      id: p.id,
      contraparte: personName(p.supplierId),
      dueDate: p.dueDate,
      diasAtraso: Math.floor((now - p.dueDate) / dayMs),
      valor: p.total,
      status: p.paymentStatus,
    }));

  const overdueSales = sales
    .filter(
      (s) =>
        s.dueDate &&
        s.dueDate < now &&
        (s.paymentStatus !== "PAID" || s.deliveryStatus === "PENDING")
    )
    .map((s) => ({
      tipo: "venda",
      id: s.id,
      orderNumber: s.orderNumber,
      contraparte: s.customerName || personName(s.customerId),
      dueDate: s.dueDate,
      diasAtraso: Math.floor((now - s.dueDate) / dayMs),
      valor: s.total,
      status: s.paymentStatus,
      deliveryStatus: s.deliveryStatus,
    }));

  return [...overduePurchases, ...overdueSales]
    .sort((a, b) => b.diasAtraso - a.diasAtraso)
    .slice(0, 10);
}

async function getFinancialOverview(db: Firestore, uid: string) {
  const [transactions, categories] = await Promise.all([
    getCollection(db, uid, "transactions"),
    getCollection(db, uid, "categories"),
  ]);

  const categoryName = (id?: string) => categories.find((c) => c.id === id)?.name || "Sem categoria";

  let totalAPagar = 0;
  let totalAReceber = 0;
  let saldoConsolidado = 0;
  const pagarPorCategoria: Record<string, number> = {};
  const receberPorCategoria: Record<string, number> = {};

  for (const t of transactions) {
    const amount = Number(t.amount) || 0;
    if (t.status === "PENDING") {
      if (t.type === "EXPENSE") {
        totalAPagar += amount;
        const cat = categoryName(t.categoryId);
        pagarPorCategoria[cat] = (pagarPorCategoria[cat] || 0) + amount;
      } else if (t.type === "INCOME") {
        totalAReceber += amount;
        const cat = categoryName(t.categoryId);
        receberPorCategoria[cat] = (receberPorCategoria[cat] || 0) + amount;
      }
    } else if (t.status === "COMPLETED") {
      saldoConsolidado += t.type === "INCOME" ? amount : -amount;
    }
  }

  const topCategorias = (map: Record<string, number>) =>
    Object.entries(map)
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

  return {
    totalAPagar,
    totalAReceber,
    saldoConsolidado,
    topCategoriasAPagar: topCategorias(pagarPorCategoria),
    topCategoriasAReceber: topCategorias(receberPorCategoria),
  };
}

async function getSoleStock(db: Firestore, uid: string, input: { query?: string }) {
  const [entries, products, lots] = await Promise.all([
    getCollection(db, uid, "soleStockEntries"),
    getCollection(db, uid, "products"),
    getCollection(db, uid, "productionLots"),
  ]);
  const q = (input.query || "").trim().toLowerCase();
  const filtered = q
    ? entries.filter(
        (e) =>
          (e.moldName || "").toLowerCase().includes(q) ||
          (e.colorName || "").toLowerCase().includes(q) ||
          (e.supplierName || "").toLowerCase().includes(q)
      )
    : entries;

  const reservations = computeSoleMapaReservations(lots, products, entries);

  return filtered.slice(0, 20).map((e) => {
    const key = `${String(e.moldId || "").trim()}_${String(e.colorId || "").trim() || "default"}`;
    const reservedByGrade = reservations[key]?.reservedByGrade || {};
    const stock: Record<string, number> = e.stock || {};
    const available: Record<string, number> = {};
    let totalReserved = 0;
    let totalAvailable = 0;
    Object.entries(stock).forEach(([grade, qty]) => {
      const reserved = reservedByGrade[grade] || 0;
      const avail = Math.max(0, (Number(qty) || 0) - reserved);
      available[grade] = avail;
      totalReserved += reserved;
      totalAvailable += avail;
    });

    return {
      moldId: e.moldId,
      moldName: e.moldName,
      colorId: e.colorId,
      colorName: e.colorName,
      supplierId: e.supplierId,
      supplierName: e.supplierName,
      stock,
      reserved: reservedByGrade,
      available,
      totalPairs: e.totalPairs,
      totalReserved,
      totalAvailable,
      unitCost: e.unitCost,
    };
  });
}

async function listPeople(db: Firestore, uid: string, input: { query?: string; type?: "customer" | "supplier" }) {
  const people = await getCollection(db, uid, "people");
  const q = (input.query || "").trim().toLowerCase();

  return people
    .filter((p) => (q ? (p.name || "").toLowerCase().includes(q) : true))
    .filter((p) => {
      if (input.type === "customer") return !!p.isCustomer;
      if (input.type === "supplier") return !!p.isSupplier;
      return true;
    })
    .slice(0, 20)
    .map((p) => ({
      name: p.name,
      document: p.document,
      phone: p.phone,
      credit: p.credit || 0,
      isCustomer: !!p.isCustomer,
      isSupplier: !!p.isSupplier,
    }));
}

export async function executeTool(
  db: Firestore,
  uid: string,
  name: string,
  input: any
): Promise<any> {
  switch (name) {
    case "search_products":
      return searchProducts(db, uid, input);
    case "get_overdue_orders":
      return getOverdueOrders(db, uid);
    case "get_financial_overview":
      return getFinancialOverview(db, uid);
    case "get_sole_stock":
      return getSoleStock(db, uid, input);
    case "list_people":
      return listPeople(db, uid, input);
    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}

import { Firestore } from "firebase-admin/firestore";
import type { PromptCachingBetaTool } from "@anthropic-ai/sdk/resources/beta/prompt-caching/messages";
import { computeSoleMapaReservations, computeSolePendingOrders } from "./soleNeeds";

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
      "Consulta o estoque de solados (moldes/cores), seus fornecedores e a disponibilidade real considerando reservas da produção ativa e pedidos de compra já feitos. " +
      "Para cada item, 'stock' é o estoque total por grade/tamanho, 'reserved' é o quanto já está reservado pela produção em andamento, 'available' " +
      "é o disponível real (stock - reserved, por grade), e 'pending' é o quanto já foi COMPRADO (pedido de compra registrado) e ainda não chegou no estoque, por grade. " +
      "Para planejamento estratégico, considere available + pending como a quantidade que ficará disponível em breve, para não sugerir comprar algo que já foi comprado.",
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
      "Lista clientes e/ou fornecedores cadastrados, com documento, telefone, crédito interno ('credit') e os valores em aberto: " +
      "'totalPayable' (quanto AINDA FALTA PAGAR a esse fornecedor, somando compras a prazo não pagas — igual à aba Financeiro > 'A Pagar') " +
      "e 'totalReceivable' (quanto esse cliente ainda deve, somando vendas a prazo não pagas). " +
      "Para perguntas sobre 'saldo em aberto', 'o que tenho a pagar/receber' ou 'valores pendentes' por cliente/fornecedor, use 'totalPayable'/'totalReceivable' (não 'credit').",
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
      "Antes de usar, consulte 'get_sole_stock' para obter os campos 'available' (disponível = estoque - reservado pela produção ativa) e 'pending' " +
      "(já comprado e ainda não recebido) de cada molde/cor. " +
      "Quando o usuário informar a grade/quantidade que deseja manter em estoque para um molde/cor, calcule o déficit por tamanho como " +
      "max(0, quantidade desejada - available[tamanho] - pending[tamanho]) e inclua no 'grid' apenas os tamanhos com déficit maior que zero. " +
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
  },
  {
    name: "search_production_lots",
    description:
      "Busca pedidos/lotes de produção (mapas do PCP) por nome do cliente, número do pedido/lote ou nome do prestador de serviço terceirizado. " +
      "Retorna, para cada resultado, o setor atual (ou 'Finalizado'), prioridade, quantidade de pares e, se houver uma O.S. terceirizada ativa " +
      "no setor atual, o prestador e o valor dessa O.S. Use para responder perguntas como 'em qual setor está o pedido do cliente X?' ou " +
      "'quais pedidos estão com o prestador Y?'.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Nome do cliente, número do pedido/lote ou nome do prestador de serviço.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_provider_service_orders",
    description:
      "Lista as O.S. (ordens de serviço) terceirizadas de um prestador de serviço, opcionalmente filtradas por período (data de conclusão) e status. " +
      "Para cada OS, retorna setor, quantidade de pares, valor por par, valor total, status de pagamento (via transação financeira vinculada) e o " +
      "detalhamento dos pedidos/modelos (referência e cor) incluídos na OS. Também retorna totais agregados (pares, valor total, já pago, pendente). " +
      "Use para responder 'quanto tenho que pagar para o prestador X' ou para montar um relatório de serviços terceirizados.",
    input_schema: {
      type: "object",
      properties: {
        providerName: {
          type: "string",
          description: "Nome (ou parte do nome) do prestador de serviço.",
        },
        fromDate: {
          type: "string",
          description: "Data inicial (YYYY-MM-DD), baseada na data de conclusão da OS. Opcional.",
        },
        toDate: {
          type: "string",
          description: "Data final (YYYY-MM-DD), inclusive. Opcional.",
        },
        statusFilter: {
          type: "string",
          enum: ["PENDING", "COMPLETED", "ALL"],
          description: "Filtra por status da OS ('PENDING' = em andamento, 'COMPLETED' = concluída). Padrão: ALL.",
        },
      },
      required: ["providerName"],
    },
  },
  {
    name: "propose_provider_service_report",
    description:
      "Use SEMPRE depois de 'get_provider_service_orders', repassando EXATAMENTE os mesmos dados retornados por ela (sem inventar ou alterar " +
      "valores), para que o app exiba ao usuário um card de 'Relatório de Serviços Terceirizados' com opções de copiar os dados e exportar em " +
      "PDF/Imagem. Esta ferramenta NÃO grava nada no banco.",
    input_schema: {
      type: "object",
      properties: {
        providerName: { type: "string", description: "Nome do prestador de serviço." },
        fromDate: { type: "string", description: "Data inicial do período (YYYY-MM-DD), se informada." },
        toDate: { type: "string", description: "Data final do período (YYYY-MM-DD), se informada." },
        totalPairs: { type: "number", description: "Soma de pares de todas as OS retornadas." },
        totalAmount: { type: "number", description: "Soma do valor total de todas as OS retornadas." },
        totalPaid: { type: "number", description: "Soma do valor já pago (transações concluídas)." },
        totalPending: { type: "number", description: "Soma do valor ainda pendente (transações pendentes)." },
        orders: {
          type: "array",
          description: "Lista de O.S. retornadas por 'get_provider_service_orders'.",
          items: {
            type: "object",
            properties: {
              osNumber: { type: "string" },
              sectorName: { type: "string" },
              status: { type: "string", enum: ["PENDING", "COMPLETED"] },
              paymentStatus: { type: "string", enum: ["PENDING", "COMPLETED"] },
              quantity: { type: "number" },
              valuePerPair: { type: "number" },
              totalValue: { type: "number" },
              finishedAt: { type: "number" },
              items: {
                type: "array",
                description: "Pedidos/modelos incluídos na OS.",
                items: {
                  type: "object",
                  properties: {
                    productName: { type: "string" },
                    reference: { type: "string" },
                    colorName: { type: "string" },
                    quantity: { type: "number" },
                  },
                  required: ["productName", "quantity"],
                },
              },
            },
            required: ["osNumber", "sectorName", "status", "paymentStatus", "quantity", "valuePerPair", "totalValue", "items"],
          },
        },
      },
      required: ["providerName", "totalPairs", "totalAmount", "totalPaid", "totalPending", "orders"],
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
  const [entries, products, lots, purchases] = await Promise.all([
    getCollection(db, uid, "soleStock"),
    getCollection(db, uid, "products"),
    getCollection(db, uid, "productionLots"),
    getCollection(db, uid, "purchases"),
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
  const pendingOrders = computeSolePendingOrders(purchases);

  return filtered.slice(0, 20).map((e) => {
    const key = `${String(e.moldId || "").trim()}_${String(e.colorId || "").trim() || "default"}`;
    const reservedByGrade = reservations[key]?.reservedByGrade || {};
    const pendingByGrade = pendingOrders[key]?.pendingByGrade || {};
    const stock: Record<string, number> = e.stock || {};
    const available: Record<string, number> = {};
    const pending: Record<string, number> = {};
    let totalReserved = 0;
    let totalAvailable = 0;
    let totalPending = 0;
    Object.entries(stock).forEach(([grade, qty]) => {
      const reserved = reservedByGrade[grade] || 0;
      const avail = Math.max(0, (Number(qty) || 0) - reserved);
      available[grade] = avail;
      totalReserved += reserved;
      totalAvailable += avail;
      const p = pendingByGrade[grade] || 0;
      pending[grade] = p;
      totalPending += p;
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
      pending,
      totalPairs: e.totalPairs,
      totalReserved,
      totalAvailable,
      totalPending,
      unitCost: e.unitCost,
    };
  });
}

function remainingAmount(record: { total: number; paymentHistory?: { amount: number }[] }): number {
  const paid = (record.paymentHistory || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  return Math.max(0, (Number(record.total) || 0) - paid);
}

async function listPeople(db: Firestore, uid: string, input: { query?: string; type?: "customer" | "supplier" }) {
  const [people, purchases, sales] = await Promise.all([
    getCollection(db, uid, "people"),
    getCollection(db, uid, "purchases"),
    getCollection(db, uid, "sales"),
  ]);
  const q = (input.query || "").trim().toLowerCase();

  // Saldo em aberto (a pagar/receber) por pessoa, com base em compras/vendas a prazo ainda não pagas
  // (mesmo critério usado na tela Financeiro > "A Pagar").
  const payableByPerson: Record<string, number> = {};
  for (const p of purchases) {
    if (p.paymentTerm !== "INSTALLMENTS" || p.paymentStatus === "PAID" || !p.supplierId) continue;
    payableByPerson[p.supplierId] = (payableByPerson[p.supplierId] || 0) + remainingAmount(p);
  }
  const receivableByPerson: Record<string, number> = {};
  for (const s of sales) {
    if (s.paymentTerm !== "INSTALLMENTS" || s.paymentStatus === "PAID" || !s.customerId) continue;
    receivableByPerson[s.customerId] = (receivableByPerson[s.customerId] || 0) + remainingAmount(s);
  }

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
      totalPayable: payableByPerson[p.id] || 0,
      totalReceivable: receivableByPerson[p.id] || 0,
      isCustomer: !!p.isCustomer,
      isSupplier: !!p.isSupplier,
    }));
}

async function searchProductionLots(db: Firestore, uid: string, input: { query: string }) {
  const [lots, sectors, serviceOrders, products] = await Promise.all([
    getCollection(db, uid, "productionLots"),
    getCollection(db, uid, "sectors"),
    getCollection(db, uid, "serviceOrders"),
    getCollection(db, uid, "products"),
  ]);

  const q = (input.query || "").trim().toLowerCase();
  const sectorName = (id?: string) => sectors.find((s) => s.id === id)?.name || "Desconhecido";
  const productName = (id?: string) => products.find((p) => p.id === id)?.name || "";

  const activeOSForLot = (lotId: string) =>
    serviceOrders.find(
      (os) =>
        os.status === "PENDING" &&
        os.type === "OUTSOURCED" &&
        (os.lotId === lotId || (Array.isArray(os.lotIds) && os.lotIds.includes(lotId)))
    );

  const matches = lots.filter((lot) => {
    const searchable: any[] = [lot.orderNumber, lot.saleOrderNumber, lot.customerName, productName(lot.productId)];
    if (Array.isArray(lot.metadata?.groups)) {
      lot.metadata.groups.forEach((g: any) => searchable.push(g.productName));
    }
    const os = activeOSForLot(lot.id);
    if (os) {
      searchable.push(os.providerName, os.osNumber);
    }
    return searchable.some((s) => String(s || "").toLowerCase().includes(q));
  });

  matches.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return matches.slice(0, 15).map((lot) => {
    const route: string[] = lot.route || [];
    const currentSectorId = lot.finishedAt ? route[route.length - 1] : route[lot.currentSectorIndex ?? 0];
    const os = activeOSForLot(lot.id);
    return {
      lotId: lot.id,
      orderNumber: lot.orderNumber,
      customerName: lot.customerName,
      saleOrderNumber: lot.saleOrderNumber,
      quantity: lot.quantity,
      prioridade: lot.prioridade,
      deliveryDate: lot.deliveryDate,
      status: lot.finishedAt ? "Finalizado" : "Em produção",
      currentSectorName: sectorName(currentSectorId),
      activeServiceOrder: os
        ? {
            osNumber: os.osNumber,
            providerName: os.providerName,
            sectorName: os.sectorName || sectorName(os.sectorId),
            valuePerPair: os.valuePerPair,
            totalValue: os.totalValue,
            status: os.status,
          }
        : null,
    };
  });
}

async function getProviderServiceOrders(
  db: Firestore,
  uid: string,
  input: { providerName: string; fromDate?: string; toDate?: string; statusFilter?: "PENDING" | "COMPLETED" | "ALL" }
) {
  const [serviceOrders, lots, products, transactions] = await Promise.all([
    getCollection(db, uid, "serviceOrders"),
    getCollection(db, uid, "productionLots"),
    getCollection(db, uid, "products"),
    getCollection(db, uid, "transactions"),
  ]);

  const q = (input.providerName || "").trim().toLowerCase();
  let filtered = serviceOrders.filter(
    (os) => os.type === "OUTSOURCED" && String(os.providerName || "").toLowerCase().includes(q)
  );

  const fromMs = input.fromDate ? new Date(`${input.fromDate}T00:00:00`).getTime() : undefined;
  const toMs = input.toDate ? new Date(`${input.toDate}T23:59:59.999`).getTime() : undefined;
  if (fromMs !== undefined || toMs !== undefined) {
    filtered = filtered.filter((os) => {
      const ts = os.finishedAt ?? os.createdAt;
      if (!ts) return false;
      if (fromMs !== undefined && ts < fromMs) return false;
      if (toMs !== undefined && ts > toMs) return false;
      return true;
    });
  }

  if (input.statusFilter && input.statusFilter !== "ALL") {
    filtered = filtered.filter((os) => os.status === input.statusFilter);
  }

  filtered.sort((a, b) => (b.finishedAt ?? b.createdAt ?? 0) - (a.finishedAt ?? a.createdAt ?? 0));
  filtered = filtered.slice(0, 30);

  const resolveProductInfo = (productId?: string, variationId?: string) => {
    const product = products.find((p) => p.id === productId);
    const variation = (product?.variations || []).find((v: any) => v.id === variationId);
    return {
      productName: product?.name as string | undefined,
      reference: product?.reference as string | undefined,
      colorName: variation?.colorName as string | undefined,
    };
  };

  let totalPairs = 0;
  let totalAmount = 0;
  let totalPaid = 0;
  let totalPending = 0;

  const orders = filtered.map((os) => {
    const lotIds: string[] = Array.isArray(os.lotIds) && os.lotIds.length > 0 ? os.lotIds : [os.lotId];
    const items: { productName: string; reference?: string; colorName?: string; quantity: number }[] = [];

    lotIds.forEach((lotId) => {
      const lot = lots.find((l) => l.id === lotId);
      if (!lot) return;
      if (Array.isArray(lot.metadata?.groups) && lot.metadata.groups.length > 0) {
        lot.metadata.groups.forEach((g: any) => {
          const info = resolveProductInfo(g.productId, g.variationId);
          items.push({
            productName: g.productName || info.productName || "",
            reference: info.reference,
            colorName: info.colorName,
            quantity: g.quantity || 0,
          });
        });
      } else {
        const info = resolveProductInfo(lot.productId, lot.variationId);
        items.push({
          productName: info.productName || os.productName || "",
          reference: info.reference,
          colorName: info.colorName,
          quantity: lot.quantity || 0,
        });
      }
    });

    if (items.length === 0) {
      items.push({
        productName: os.productName || "",
        colorName: os.variationName,
        quantity: os.quantity || 0,
      });
    }

    const transaction = transactions.find((t) => t.id === os.transactionId);
    const paymentStatus: "PENDING" | "COMPLETED" = transaction?.status ?? os.status;

    totalPairs += os.quantity || 0;
    totalAmount += os.totalValue || 0;
    if (paymentStatus === "COMPLETED") {
      totalPaid += os.totalValue || 0;
    } else {
      totalPending += os.totalValue || 0;
    }

    return {
      osNumber: os.osNumber,
      sectorName: os.sectorName,
      status: os.status,
      paymentStatus,
      quantity: os.quantity,
      valuePerPair: os.valuePerPair,
      totalValue: os.totalValue,
      finishedAt: os.finishedAt,
      items,
    };
  });

  return {
    providerName: filtered[0]?.providerName || input.providerName,
    fromDate: input.fromDate,
    toDate: input.toDate,
    osCount: orders.length,
    totalPairs,
    totalAmount,
    totalPaid,
    totalPending,
    orders,
  };
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
    case "search_production_lots":
      return searchProductionLots(db, uid, input);
    case "get_provider_service_orders":
      return getProviderServiceOrders(db, uid, input);
    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}

import { Firestore } from "firebase-admin/firestore";
import type Anthropic from "@anthropic-ai/sdk";

// Tool schemas exposed to Claude (Anthropic Messages API "tools" format).
// All tools are READ-ONLY for now — they only query the user's Firestore data.
export const TOOLS: Anthropic.Tool[] = [
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
      "Consulta o estoque de solados (moldes/cores) e seus fornecedores. Use para sugerir pedidos de compra de solados com base no estoque atual.",
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
  const entries = await getCollection(db, uid, "soleStockEntries");
  const q = (input.query || "").trim().toLowerCase();
  const filtered = q
    ? entries.filter(
        (e) =>
          (e.moldName || "").toLowerCase().includes(q) ||
          (e.colorName || "").toLowerCase().includes(q) ||
          (e.supplierName || "").toLowerCase().includes(q)
      )
    : entries;

  return filtered.slice(0, 20).map((e) => ({
    moldName: e.moldName,
    colorName: e.colorName,
    supplierName: e.supplierName,
    stock: e.stock,
    totalPairs: e.totalPairs,
    unitCost: e.unitCost,
  }));
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

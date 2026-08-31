import { ViewType } from '../types';
import type { Collaborator, SectorId, DashboardCardConfig, TaskPermissionLevel } from '../types';

export type { Collaborator, SectorId, TaskPermissionLevel };

export interface SectorTask { id: string; label: string; }

// Cada setor agrupa as telas (ViewType) que ele libera, e uma lista curta de "funções"
// (antes só texto pra exibição; agora com `id` estável, refinável por colaborador em
// 'none'/'view'/'edit' — ver taskPermissions em Collaborator e getTaskLevel abaixo). O `id` não
// pode mudar depois de publicado (é a chave salva em taskPermissions dos colaboradores já
// cadastrados); só o `label` é livre pra editar.
// COLLABORATORS_CONFIG propositalmente não aparece em nenhum setor — só quem é
// isUnrestricted (ou ninguém logado em nenhum colaborador ainda) alcança aquela tela.
export const SECTORS: { id: SectorId; label: string; icon: string; tasks: SectorTask[]; views: ViewType[] }[] = [
  {
    id: 'vendas', label: 'Vendas', icon: 'ShoppingBag',
    tasks: [
      { id: 'vender', label: 'Vender' },
      { id: 'emitir_orcamentos', label: 'Emitir Orçamentos' },
      { id: 'imprimir_etiquetas', label: 'Imprimir Etiquetas' },
    ],
    views: [ViewType.SALES, ViewType.SALE_FORM, ViewType.PRINT_CENTER, ViewType.STOCK_GLANCE],
  },
  {
    id: 'compras', label: 'Compras', icon: 'ShoppingCart',
    tasks: [
      { id: 'lancar_pedidos', label: 'Lançar Pedidos de Compra' },
      { id: 'gerenciar_fornecedores', label: 'Gerenciar Fornecedores' },
    ],
    views: [ViewType.PURCHASES, ViewType.PURCHASE_FORM],
  },
  {
    id: 'cadastro_produtos', label: 'Cadastro de Produtos', icon: 'Package',
    tasks: [
      { id: 'produtos_variacoes', label: 'Produtos e Variações' },
      { id: 'categorias', label: 'Categorias' },
      { id: 'grades', label: 'Grades de Tamanho' },
      { id: 'cores', label: 'Cores' },
      { id: 'ficha_tecnica', label: 'Ficha Técnica' },
    ],
    views: [ViewType.PRODUCTS, ViewType.PRODUCT_FORM, ViewType.PRODUCT_DETAIL, ViewType.CATEGORIES, ViewType.GRIDS, ViewType.COLORS, ViewType.CATEGORY_CONFIG, ViewType.PRODUCTION_ENGINEERING, ViewType.PRODUCT_SHEET],
  },
  {
    id: 'cadastro_insumos', label: 'Cadastro de Insumos', icon: 'Boxes',
    tasks: [
      { id: 'solados', label: 'Solados' },
      { id: 'palmilhas', label: 'Palmilhas' },
      { id: 'recebimento_compras', label: 'Recebimento de Compras' },
      { id: 'pesagem_contagem', label: 'Pesagem e Contagem' },
    ],
    views: [ViewType.PRODUCTION_SOLE_PURCHASE, ViewType.PRODUCTION_SOLE_RECEIPT, ViewType.PRODUCTION_SOLE_STOCK, ViewType.PRODUCTION_PALMILHA_STOCK, ViewType.PRODUCTION_PALMILHA_PURCHASE, ViewType.PRODUCTION_GENERAL_RECEIPT, ViewType.PRODUCTION_ESTOQUES_MENU, ViewType.PRODUCTION_WEIGHING],
  },
  {
    id: 'producao_pcp', label: 'Produção (PCP)', icon: 'Factory',
    tasks: [
      { id: 'mapas_producao', label: 'Mapas de Produção' },
      { id: 'setores_fabrica', label: 'Setores de Fábrica' },
      { id: 'necessidade_compras', label: 'Necessidade de Compras' },
      { id: 'ordens_servico', label: 'Ordens de Serviço' },
    ],
    views: [ViewType.PRODUCTION_MENU, ViewType.PRODUCTION_PCP, ViewType.PRODUCTION_STOCK, ViewType.PRODUCTION_PURCHASE_NEEDS, ViewType.PRODUCTION_CONFIG, ViewType.PRODUCTION_SERVICE_ORDER_FORM],
  },
  {
    id: 'estoque', label: 'Estoque e Expedição', icon: 'PackageOpen',
    tasks: [
      { id: 'estoque_pronto', label: 'Estoque de Produtos Prontos' },
      { id: 'expedicao', label: 'Expedição' },
    ],
    views: [ViewType.STOCK, ViewType.STOCK_GLANCE],
  },
  {
    id: 'entregas', label: 'Entregas', icon: 'Truck',
    tasks: [
      { id: 'montar_rotas', label: 'Montar Rotas de Entrega' },
      { id: 'marcar_entregas', label: 'Marcar Entregas Realizadas' },
    ],
    views: [ViewType.DELIVERY_MENU, ViewType.DELIVERY_ROUTE_BUILDER, ViewType.DELIVERY_ROUTE_DETAIL, ViewType.DELIVERY_CONFIG, ViewType.DELIVERY_NAV_PREFS, ViewType.DELIVERY_PRINT_CONFIG],
  },
  {
    id: 'bling', label: 'Integração Bling', icon: 'Building2',
    tasks: [
      { id: 'vincular_produtos', label: 'Vincular Produtos' },
      { id: 'lista_separacao', label: 'Lista de Separação' },
      { id: 'emitir_notas', label: 'Emitir Notas Fiscais' },
      { id: 'estoque_bling', label: 'Estoque Bling' },
      { id: 'notas_fiscais', label: 'Notas Fiscais' },
      { id: 'saude_negocio', label: 'Saúde do Negócio' },
      { id: 'devolucoes', label: 'Devoluções' },
    ],
    views: [ViewType.BLING_CONNECTION, ViewType.BLING_PRODUCT_MAPPING, ViewType.BLING_INVOICE_EMISSION, ViewType.BLING_PICKING_LIST, ViewType.BLING_STOCK, ViewType.BLING_INVOICES, ViewType.BLING_HEALTH, ViewType.BLING_DEVOLUCOES],
  },
  {
    id: 'financeiro', label: 'Financeiro', icon: 'Wallet',
    tasks: [
      { id: 'fluxo_caixa', label: 'Fluxo de Caixa' },
      { id: 'contas_movimentacao', label: 'Contas de Movimentação' },
      { id: 'relatorios', label: 'Relatórios' },
      { id: 'meios_recebimento', label: 'Meios de Recebimento' },
    ],
    views: [ViewType.FINANCIAL, ViewType.ACCOUNTS, ViewType.REPORTS, ViewType.REPORT_DETAILED, ViewType.PAYMENT_METHODS],
  },
  {
    id: 'clientes_fornecedores', label: 'Clientes e Fornecedores', icon: 'Users',
    tasks: [{ id: 'cadastro_pessoas', label: 'Cadastro de Pessoas' }],
    views: [ViewType.PEOPLE, ViewType.PERSON_DETAIL],
  },
  {
    id: 'pessoal', label: 'Financeiro Pessoal', icon: 'Landmark',
    tasks: [{ id: 'financas_familia', label: 'Finanças Pessoais e Família' }],
    views: [ViewType.PERSONAL_FINANCIAL],
  },
  {
    id: 'sistema', label: 'Sistema e Backup', icon: 'Database',
    tasks: [
      { id: 'backup', label: 'Backup' },
      { id: 'modulos', label: 'Módulos' },
      { id: 'dashboard_config', label: 'Dashboard' },
      { id: 'manual', label: 'Manual' },
    ],
    views: [ViewType.BACKUP, ViewType.MODULES_CONFIG, ViewType.DASHBOARD_CONFIG, ViewType.MANUAL],
  },
];

// Nível de permissão de uma função específica — 'edit' (padrão) se o setor está liberado e não
// há refinamento salvo; 'none' se o setor nem está liberado; senão o que foi salvo em
// taskPermissions. Sem colaborador ativo (ou Acesso Total) = sempre 'edit' (acesso irrestrito).
export function getTaskLevel(collab: Collaborator | null, sectorId: SectorId, taskId: string): TaskPermissionLevel {
  if (!collab || collab.isUnrestricted) return 'edit';
  if (!collab.sectors.includes(sectorId)) return 'none';
  return collab.taskPermissions?.[`${sectorId}:${taskId}`] ?? 'edit';
}

// Pode executar a ação de verdade (criar/editar) — usado pra esconder o BOTÃO da função.
export function canEditTask(collab: Collaborator | null, sectorId: SectorId, taskId: string): boolean {
  return getTaskLevel(collab, sectorId, taskId) === 'edit';
}

// Pode pelo menos ver a função (inclui quem também pode editar) — usado pra esconder a função
// inteira (aba/atalho) de quem está em 'none'.
export function canViewTask(collab: Collaborator | null, sectorId: SectorId, taskId: string): boolean {
  return getTaskLevel(collab, sectorId, taskId) !== 'none';
}

// Views que pertencem a UMA função específica (não à tela toda de um setor multi-função, tipo
// Vendas/Compras — essas têm gate próprio dentro do componente, ver SaleFormView/PurchasesView).
// Usado pelo gate central em App.tsx: 'none' na função bloqueia a tela inteira (redireciona pro
// Dashboard), 'view'/'edit' liberam normalmente — ainda sem diferenciar view de edit dentro da
// tela em si (isso exigiria mexer tela por tela, como já foi feito em Vendas/Compras).
// Telas-menu/hub (PRODUCTION_MENU, DELIVERY_MENU etc.) e views compartilhadas entre setores
// (STOCK_GLANCE) ficam de fora de propósito — continuam só no gate de setor.
export const VIEW_TASK_MAP: Partial<Record<ViewType, [SectorId, string]>> = {
  [ViewType.PRINT_CENTER]: ['vendas', 'imprimir_etiquetas'],

  [ViewType.PRODUCTS]: ['cadastro_produtos', 'produtos_variacoes'],
  [ViewType.PRODUCT_FORM]: ['cadastro_produtos', 'produtos_variacoes'],
  [ViewType.PRODUCT_DETAIL]: ['cadastro_produtos', 'produtos_variacoes'],
  [ViewType.CATEGORIES]: ['cadastro_produtos', 'categorias'],
  [ViewType.CATEGORY_CONFIG]: ['cadastro_produtos', 'categorias'],
  [ViewType.GRIDS]: ['cadastro_produtos', 'grades'],
  [ViewType.COLORS]: ['cadastro_produtos', 'cores'],
  [ViewType.PRODUCTION_ENGINEERING]: ['cadastro_produtos', 'ficha_tecnica'],
  [ViewType.PRODUCT_SHEET]: ['cadastro_produtos', 'ficha_tecnica'],

  [ViewType.PRODUCTION_SOLE_PURCHASE]: ['cadastro_insumos', 'solados'],
  [ViewType.PRODUCTION_SOLE_RECEIPT]: ['cadastro_insumos', 'solados'],
  [ViewType.PRODUCTION_SOLE_STOCK]: ['cadastro_insumos', 'solados'],
  [ViewType.PRODUCTION_PALMILHA_STOCK]: ['cadastro_insumos', 'palmilhas'],
  [ViewType.PRODUCTION_PALMILHA_PURCHASE]: ['cadastro_insumos', 'palmilhas'],
  [ViewType.PRODUCTION_GENERAL_RECEIPT]: ['cadastro_insumos', 'recebimento_compras'],
  [ViewType.PRODUCTION_WEIGHING]: ['cadastro_insumos', 'pesagem_contagem'],

  [ViewType.PRODUCTION_PCP]: ['producao_pcp', 'mapas_producao'],
  [ViewType.PRODUCTION_CONFIG]: ['producao_pcp', 'setores_fabrica'],
  [ViewType.PRODUCTION_PURCHASE_NEEDS]: ['producao_pcp', 'necessidade_compras'],
  [ViewType.PRODUCTION_SERVICE_ORDER_FORM]: ['producao_pcp', 'ordens_servico'],

  [ViewType.STOCK]: ['estoque', 'estoque_pronto'],

  [ViewType.DELIVERY_ROUTE_BUILDER]: ['entregas', 'montar_rotas'],
  [ViewType.DELIVERY_ROUTE_DETAIL]: ['entregas', 'marcar_entregas'],

  [ViewType.BLING_PRODUCT_MAPPING]: ['bling', 'vincular_produtos'],
  [ViewType.BLING_PICKING_LIST]: ['bling', 'lista_separacao'],
  [ViewType.BLING_INVOICE_EMISSION]: ['bling', 'emitir_notas'],
  [ViewType.BLING_STOCK]: ['bling', 'estoque_bling'],
  [ViewType.BLING_INVOICES]: ['bling', 'notas_fiscais'],
  [ViewType.BLING_HEALTH]: ['bling', 'saude_negocio'],
  [ViewType.BLING_DEVOLUCOES]: ['bling', 'devolucoes'],

  [ViewType.FINANCIAL]: ['financeiro', 'fluxo_caixa'],
  [ViewType.ACCOUNTS]: ['financeiro', 'contas_movimentacao'],
  [ViewType.REPORTS]: ['financeiro', 'relatorios'],
  [ViewType.REPORT_DETAILED]: ['financeiro', 'relatorios'],
  [ViewType.PAYMENT_METHODS]: ['financeiro', 'meios_recebimento'],

  [ViewType.BACKUP]: ['sistema', 'backup'],
  [ViewType.MODULES_CONFIG]: ['sistema', 'modulos'],
  [ViewType.DASHBOARD_CONFIG]: ['sistema', 'dashboard_config'],
  [ViewType.MANUAL]: ['sistema', 'manual'],
};

export function isViewTaskAllowed(collab: Collaborator | null, view: ViewType): boolean {
  const mapped = VIEW_TASK_MAP[view];
  if (!mapped) return true;
  return canViewTask(collab, mapped[0], mapped[1]);
}

// Ferramentas genéricas da seção "Extras" das Configurações — não pertencem a nenhum
// setor de negócio (não mexem em dados do sistema, só utilidades: OCR de texto, ajuste
// de PDF/JPG, calculadora de regra de três), então ficam liberadas pra QUALQUER
// colaborador, junto com Dashboard/Configurações, em vez de dependerem de um setor.
const BASELINE_VIEWS: ViewType[] = [
  ViewType.DASHBOARD,
  ViewType.SETTINGS,
  ViewType.OCR_TEXT_EXTRACTOR,
  ViewType.RULE_OF_THREE,
  ViewType.LABEL_PRINT_STUDIO,
];

// null = acesso total (sem colaborador ativo, ou colaborador isUnrestricted)
export function getAllowedViews(collab: Collaborator | null): ViewType[] | null {
  if (!collab || collab.isUnrestricted) return null;
  const set = new Set<ViewType>(BASELINE_VIEWS);
  collab.sectors.forEach(sectorId => {
    SECTORS.find(s => s.id === sectorId)?.views.forEach(v => set.add(v));
  });
  return Array.from(set);
}

export function isViewAllowed(collab: Collaborator | null, view: ViewType): boolean {
  const allowed = getAllowedViews(collab);
  if (allowed === null) return true;
  return allowed.includes(view);
}

export function isSectorAllowed(collab: Collaborator | null, sectorId: SectorId): boolean {
  if (!collab || collab.isUnrestricted) return true;
  return collab.sectors.includes(sectorId);
}

// A que setor(es) cada card do Dashboard pertence — usado pra mostrar, no
// Dashboard, somente os cards do(s) setor(es) do colaborador ativo. Cards
// ausentes daqui (ex. "activity", um feed genérico) ficam sempre visíveis.
// "ai_assistant" não entra aqui de propósito — é controlado por canUseAI.
export const DASHBOARD_CARD_SECTORS: Record<string, SectorId[]> = {
  balance: ['financeiro'],
  sales_products: ['cadastro_produtos'],
  manual_entries: ['financeiro'],
  report_center: ['financeiro'],
  quick_reports: ['financeiro'],
  dashboard_rankings: ['vendas'],
  cash_flow: ['financeiro'],
  receivables: ['financeiro'],
  stock_alerts: ['estoque'],
  customers: ['clientes_fornecedores'],
  suppliers: ['compras'],
  debt_management: ['financeiro'],
  commission_to_sellers: ['financeiro'],
  provider_service_orders: ['financeiro'],
  stock_value: ['estoque'],
  estimated_profit: ['financeiro'],
  checks: ['financeiro'],
  monthly_profit_detailed: ['financeiro'],
  engineering_config: ['cadastro_produtos'],
  production_stock_control: ['producao_pcp', 'cadastro_insumos'],
  factory_config: ['producao_pcp'],
  personal_balance: ['pessoal'],
  print_center: ['vendas'],
  pcp_sector_map: ['producao_pcp'],
  pcp_purchase_needs: ['producao_pcp', 'compras'],
  qr_scanner: ['producao_pcp', 'estoque'],
};

export function isDashboardCardAllowed(collab: Collaborator | null, cardId: string): boolean {
  if (!collab || collab.isUnrestricted) return true;
  const sectors = DASHBOARD_CARD_SECTORS[cardId];
  if (!sectors) return true;
  return sectors.some(s => collab.sectors.includes(s));
}

export function collaboratorCanUseAI(collab: Collaborator | null): boolean {
  return !collab || collab.isUnrestricted || collab.canUseAI;
}

// true = sessão do dono da conta (sem colaborador ativo, ou colaborador de Acesso Total) —
// usado pra gatear funcionalidades que só o dono deve ver, ex. o Assistente de Configuração.
export function isAccountOwnerSession(collab: Collaborator | null): boolean {
  return !collab || collab.isUnrestricted;
}

// Lista de cards efetiva pro Dashboard: sem colaborador ativo (ou de Acesso Total)
// usa a config global de sempre; colaborador restrito vê só os cards dos seus
// setores, com a personalização (visível/ordem) que ele próprio já salvou — cards
// recém-liberados (setor adicionado depois) caem no padrão global até ele ajustar.
export function getEffectiveDashboardCards(globalCards: DashboardCardConfig[], collab: Collaborator | null): DashboardCardConfig[] {
  if (!collab || collab.isUnrestricted) return globalCards;
  const allowed = globalCards.filter(c => isDashboardCardAllowed(collab, c.id));
  const personalMap = new Map((collab.dashboardConfig || []).map(c => [c.id, c]));
  return allowed.map(c => personalMap.get(c.id) || c);
}

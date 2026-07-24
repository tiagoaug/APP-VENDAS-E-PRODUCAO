export interface LabelLayout {
  refX: number;
  refY: number;
  refSize: number;
  refFontFamily?: string;
  qrX: number;
  qrY: number;
  qrSize: number;
  colorX: number;
  colorY: number;
  colorSize: number;
  colorFontFamily?: string;
  footerX: number;
  footerY: number;
  footerSize: number;
  footerFontFamily?: string;
  showSize: boolean;
  sizeX: number;
  sizeY: number;
  sizeSize: number;
  sizeFontFamily?: string;
  showPhoto?: boolean;
  photoX?: number;
  photoY?: number;
  photoW?: number;
  photoH?: number;
  showGrade?: boolean;
  gradeX?: number;
  gradeY?: number;
  gradeW?: number;
  gradeH?: number;
  gradeFontFamily?: string;
  showOsData?: boolean;
  osDataX?: number;
  osDataY?: number;
  osDataW?: number;
  osDataH?: number;
  osDataSize?: number;
  osDataText?: string;
  osDataFontFamily?: string;
  showSectorNotes?: boolean;
  sectorNotesX?: number;
  sectorNotesY?: number;
  sectorNotesW?: number;
  sectorNotesH?: number;
  sectorNotesSize?: number;
  sectorNotesText?: string; // pre-formatted multi-line text built in the modal
  sectorNotesHasHeader?: boolean; // true when sectorNotesText has alternating "SETOR — NOME"/texto pairs
  sectorNotesFontFamily?: string;
}

export enum SaleType {
  RETAIL = 'RETAIL',
  WHOLESALE = 'WHOLESALE',
}

export enum PurchaseType {
  REPLENISHMENT = 'REPLENISHMENT', // Abastecimento de estoque
  GENERAL = 'GENERAL', // Compras gerais
  SOLE = 'SOLE', // Compra de solados
  PALMILHA = 'PALMILHA', // Compra/produção de palmilhas
}

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum GridType {
  FORMA = 'FORMA',
  SOLADO = 'SOLADO',
  FACA = 'FACA',
  EMBALAGEM = 'EMBALAGEM',
}

export type Grid = {
  id: string;
  name: string;
  type: GridType;
  sizes: string[]; // List of sizes in this grid, e.g. ["37", "38", "39", "40"]
  configuration: { [size: string]: number }; // e.g., { "37": 2, "38": 4, "39": 4, "40": 2 }
};

export type TechSheetItem = {
  id: string;
  configItemId: string; // Reference to ProductionConfigItem of type 'MATERIAL'
  quantity: number;
};

// Categorias fixas + categorias customizadas (ProductionConfigItem do tipo 'CONSUMPTION_CATEGORY', usando o id do item)
export type ComponentCategory = 'CUTTING_PIECE' | 'PACKAGING' | 'CHEMICAL' | 'TRIMMING' | (string & {});

export type ComponentConsumption = {
  id: string;
  category: ComponentCategory;
  name: string; // Piece name, e.g., "Gáspea", "Lateral"
  materialId: string;
  colorId?: string; // Optional specific color for the component
  quantity: number; // Consumo per unit/pair
  unitId?: string;
  unitValue?: number; // Valor unitário manual inserido pelo usuário
  
  // Cutting Piece specific
  toolId?: string; // Link to Faca (ProductionConfigItem type TOOL)
  piecesPerPair?: number; // Usually 2
  
  // Ignore flags for conditional requirements
  ignoreColor?: boolean;
  ignoreQuantity?: boolean;
  consumptionBasis?: 'pair' | 'grade'; // 'grade' = 1 unidade por grade (caixa coletiva), não por par

  // Outsourced services
  services?: {
    serviceId: string; // Link to FlowTag subcategory
    cost: number;
  }[];
  toolMapping?: { [size: string]: string };
};

export type Variation = {
  id: string;
  color: string;
  colorName: string;
  minStock: number;
  // Current stock per size (Pairs)
  stock: { [size: string]: number };
  // Optional prices per size for Retail
  sizePrices?: { [size: string]: { cost: number; sale: number } };
  techSheet?: TechSheetItem[]; // Keep for legacy
  consumptions?: ComponentConsumption[];
  soleColorId?: string;
  soleMapping?: { [size: string]: string };
  subRef?: string;
  sku?: string;
  stockPkgId?: string; // Padrão de embalagem legado (substituído por stockPkgAllocations)
  stockPkgAllocations?: StockPkgAllocation[]; // Múltiplos padrões de embalagem por variação
  photoUrl?: string;   // Optional photo URL for this variation (used in labels)
  sectorNotes?: Record<string, SectorNote[]>; // sectorId → list of named notes for that sector
  stockNote?: string; // Observação livre sobre o estoque desta cor (ver "Disponível em Estoque")
};

export type SectorNote = {
  id: string;
  name: string; // short label/identifier e.g. "BORDADO", "COSTURA ESPECIAL"
  text: string; // full instruction text
};

export type StockPkgAllocation = {
  pkgId: string; // 'AVULSA' para grades sem padrão definido
  qty: number; // Quantidade de grades neste padrão
  customBreakdown?: Record<string, number>; // Composição manual para grades avulsas
};


export type Product = {
  id: string;
  reference: string;
  name: string;
  supplierId: string;
  categoryId?: string;
  defaultGridId: string;
  type: SaleType;
  status: ProductStatus;
  costPrice: number;
  unitCostPrice?: number;
  salePrice: number;
  unitSalePrice?: number;
  minStockInBoxes: number;
  minStockRetailPairs?: number; // mínimo do pool varejo (pares), só usado em produtos híbridos
  priceAdjustmentDate?: number;
  costPriceAdjustmentAmount?: number;
  salePriceAdjustmentAmount?: number;
  productionGridId?: string;
  moldId?: string;
  soleMapping?: { [size: string]: string };
  toolMapping?: { [size: string]: string };
  variations: Variation[];
  saleTypes?: SaleType[];
  productionRoute?: string[]; // Sector IDs in order
  sectorPrices?: Record<string, number>; // Price per pair per sector (sectorId → R$/par)
  photoUrl?: string; // Foto miniatura do produto (base64) usada em etiquetas, PCP e estoque
  createdAt: number;
};

export type PurchaseItem = {
  productId: string;
  variationId: string;
  size?: string; // specific size if Retail
  quantity: number; // For General: total units. For Replenishment (Wholesale): boxes. For Replenishment (Retail): pairs.
  isBox: boolean;
  cost: number;
  note?: string;
  unitCost?: number;
  saleType?: SaleType; // pool de estoque a reabastecer (produtos híbridos); ausente = usa product.type
  // Identidade estável da linha (productId+variationId+saleType), preservada entre reedições
  // do pedido — usada para rastrear a caixa/linha até o Mapa de Produção e o Estoque. Ver
  // src/utils/lineIdentity.ts.
  lineId?: string;
  // Um ID por caixa física (só ATACADO) — length === quantity. Fatiado proporcionalmente no
  // fracionamento (PCPView.tsx, buildFractionSourceItem) para manter rastreabilidade por caixa.
  boxIds?: string[];
};

export type GeneralPurchaseItem = {
  id: string;
  description: string;
  materialId?: string;  // Link to ProductionConfigItem (type MATERIAL/PACKAGING)
  colorId?: string;     // Optional color for colored materials
  colorName?: string;   // Color name snapshot
  quantity?: number;    // Quantity purchased
  unit?: string;        // Unit label (e.g., "ML", "UN", "KG")
  value: number;        // Unit price
  kind?: 'material' | 'person' | 'general'; // ausente = 'material' (padrão); 'person' = pagamento a fornecedor/terceirizado cadastrado; 'general' = despesa genérica com descrição livre
  personId?: string;    // Link to Person (fornecedor/terceirizado), usado quando kind === 'person'
};

export type CompanyCheck = {
  id: string;
  number: string;
  value: number;
  dueDate: number;
  status: 'PENDING' | 'CLEARED' | 'OVERDUE';
};

export type PaymentHistory = {
  id: string;
  date: number;
  amount: number;
  accountId: string;
  paymentMethodId?: string;
  note?: string;
};

// Id de um toque da biblioteca de lembretes (30 opções — ver src/data/reminderTones.ts,
// arquivos .wav correspondentes em android/app/src/main/res/raw/). String solta (não union
// fechada) porque a biblioteca é maior e pode crescer sem precisar editar este tipo.
export type ReminderTonePattern = string;

// Perfil salvo de configuração de lembrete (alarme + padrão de toque), reutilizável
// em qualquer tela que agende lembretes — não inclui data/hora, que é sempre por caso.
export interface ReminderProfile {
  id: string;
  name: string;
  alarmMode: boolean;
  combineMode?: boolean; // true = também dispara uma notificação de texto junto do alarme
  soundPattern: ReminderTonePattern;
}

export type Purchase = {
  id: string;
  supplierId: string;
  date: number;
  dueDate?: number; // Vencimento, para compras gerais
  paymentTerm?: PaymentTerm; // A vista ou a prazo
  reminderAt?: number | null; // Lembrete programado (data e hora) — exibido no card de Lembretes do Dashboard
  reminderTitle?: string | null; // Título curto do lembrete
  reminderAlarmMode?: boolean | null; // true = alarme insistente (precisa dispensar), false = notificação normal
  reminderCombineMode?: boolean | null; // true = também dispara uma notificação de texto junto do alarme
  reminderSoundPattern?: ReminderTonePattern | null;
  type: PurchaseType;
  items?: PurchaseItem[];
  generalItems?: GeneralPurchaseItem[];
  soleItems?: SolePurchaseItem[];
  palmilhaItems?: PalmilhaPurchaseItem[];
  total: number;
  notes?: string;
  batchNumber?: string; // Controle por lote
  checks?: CompanyCheck[];
  categoryId?: string;
  accountId?: string;
  generateTransaction?: boolean;
  registerAsReceived?: boolean;  // Se true, atualiza estoque e solicitação de compra ao salvar
  paymentStatus?: PaymentStatus;
  paymentHistory?: PaymentHistory[];
  isAccounting?: boolean;
  isProductionOrder?: boolean;   // Se true, gera mapa de estoque no PCP
  productionOrderId?: string;
  sellerId?: string;
  sellerName?: string;
  requestId?: string;
  prioridade?: string;
  deliveryDate?: number;
};

export enum SaleStatus {
  QUOTE = 'QUOTE',
  CONFIRMED = 'CONFIRMED',
  SALE = 'SALE',
  CANCELLED = 'CANCELLED'
}

export enum PaymentTerm {
  CASH = 'CASH',
  INSTALLMENTS = 'INSTALLMENTS'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID'
}

export type SaleItem = {
  productId: string;
  variationId: string;
  size?: string; // specific size if Retail
  saleType: SaleType;
  quantity: number; // pairs or boxes
  price: number;    // preço por grade (atacado) ou por par (varejo)
  unitPrice?: number; // preço por par (atacado)
  fulfilled?: boolean; // true = estoque já abatido; false/undefined = aguardando estoque
  boxesSeparated?: number; // qtd já separada fisicamente (cx para atacado, pares para varejo)
  separatedPkgAllocations?: StockPkgAllocation[]; // snapshot das alocações de embalagem consumidas na separação (para restaurar no revert)
  // Identidade estável da linha, preservada entre reedições — ver PurchaseItem.lineId e
  // src/utils/lineIdentity.ts.
  lineId?: string;
  // Um ID por caixa física (só ATACADO) — ver PurchaseItem.boxIds.
  boxIds?: string[];
  // Ids de StockLot reservados por esta separação (Separar Caixas/Expedir Venda) — tanto
  // lotes pool-picked do estoque geral quanto lotes nativos de produção casada. Ausência
  // (item legado ou estoque sem StockLot, ex. reposição sem Pedido de Produção) cai no
  // fallback de contador/separatedPkgAllocations acima. Ver src/utils/stockLotPicker.ts.
  separatedStockLotIds?: string[];
};

export type SaleExtraItem = {
  id: string;
  description: string;
  value: number;
};

export type SalePayment = {
  id: string;
  amount: number;
  date: number;
  paymentMethodId: string;
  accountId: string;
  note?: string;
  transactionId?: string;
};

export type Sale = {
  id: string;
  orderNumber: string;
  date: number;
  customerId?: string;
  customerName?: string;
  items: SaleItem[];
  extraItems?: SaleExtraItem[];
  subtotal: number;
  discount: number;
  discountType?: 'fixed' | 'percentage';
  total: number;
  status: SaleStatus;
  paymentTerm: PaymentTerm;
  paymentMethodId?: string;
  accountId?: string;
  dueDate?: number;
  deliveryDate?: number;
  prioridade?: string;
  paymentStatus?: PaymentStatus;
  paymentHistory?: SalePayment[];
  notes?: string;
  sellerId?: string;
  sellerName?: string;
  productionOrderId?: string;
  isProductionOrder?: boolean;
  saleDestination?: 'CUSTOMER' | 'STOCK';
  isAccounting?: boolean; // false = não gera lançamento financeiro
  deliveryStatus?: 'PENDING' | 'DELIVERED';
  deliveredAt?: number;
  reminderAt?: number | null; // Lembrete programado (data e hora) — exibido no card de Lembretes do Dashboard
  reminderTitle?: string | null; // Título curto do lembrete
  reminderAlarmMode?: boolean | null;
  reminderCombineMode?: boolean | null;
  reminderSoundPattern?: ReminderTonePattern | null;
  deliveryAddress?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zip?: string;
    complement?: string;
    lat?: number;
    lng?: number;
    geocodedAt?: number;
    geocodeSource?: 'GEOCODED' | 'MANUAL_PIN';
  };
  // Prioridade de roteirização de entrega (módulo Entregas) — distinta de `prioridade`,
  // que é SLA de produção/PCP e não tem relação com a ordem de uma rota de entrega.
  deliveryPriority?: 'URGENT' | 'NORMAL';
  deliveryRouteId?: string;
};

export type DeliveryStop = {
  id: string;
  saleId: string;
  order: number;
  lat: number;
  lng: number;
  priority: 'URGENT' | 'NORMAL';
  status: 'PENDING' | 'DELIVERED' | 'SKIPPED';
  deliveredAt?: number;
  note?: string;
};

export type DeliveryRoute = {
  id: string;
  createdAt: number;
  date: number;
  driverId?: string;
  driverName?: string;
  originLat: number;
  originLng: number;
  // Array embutido no próprio documento — mesmo padrão de Sale.items /
  // ProductionLot.metadata.sourceItems — não é subcoleção.
  stops: DeliveryStop[];
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
  optimizedAt?: number;
  notes?: string;
  // Posição do motorista em tempo real — só atualiza enquanto a tela de entrega
  // (DeliveryRouteDetailView) está aberta no celular de quem está dirigindo; não
  // rastreia em segundo plano/tela bloqueada.
  driverLocation?: { lat: number; lng: number; updatedAt: number };
};

export type Person = {
  id: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  isCustomer: boolean;
  isSupplier: boolean;
  isPersonal?: boolean;
  avatar?: string;
  isSeller?: boolean;
  isBuyer?: boolean;
  isServiceProvider?: boolean;
  isDeliveryDriver?: boolean;
  associatedSellerIds?: string[];
  associatedContactIds?: string[]; // Para compradores internos e outros contatos
  observations?: string;
  internalContacts?: { name: string; role: 'Vendedor' | 'Comprador' }[];
  credit?: number;
};

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export type TransactionItem = {
  id: string;
  description: string;
  amount: number;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  amount: number;
  date: number;
  description: string;
  status: 'PENDING' | 'COMPLETED';
  contactId?: string; // ID for Customer/Supplier
  contactName?: string;
  personId?: string; // Beneficiário/Prestador (OS de corte, mão de obra)
  relatedId?: string;
  memberId?: string; // For Family Members in personal finance
  isPersonal?: boolean;
  isManual?: boolean; // true = lançamento manual pelo usuário; false/undefined = gerado automaticamente
  referenceNumber?: string; // número de indicação / referência do lançamento
  items?: TransactionItem[];
  // Despesa pessoal recorrente/parcelada — cada parcela é o seu próprio Transaction,
  // ligado às demais pelo mesmo recurrenceGroupId (ver Financeiro Pessoal).
  isRecurring?: boolean;
  recurrenceGroupId?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  dueDate?: number;
  paymentHistory?: PaymentHistory[];
};

export enum CategoryType {
  PRODUCT = 'PRODUCT',
  EXPENSE = 'EXPENSE',
  REVENUE = 'REVENUE',
  PRODUCTION = 'PRODUCTION',
  GENERAL = 'GENERAL',
  SUPPLY = 'SUPPLY',
  CUTTING_TOOL = 'CUTTING_TOOL',
  OTHER = 'OTHER',
}

export type Category = {
  id: string;
  name: string;
  color: string;
  type: CategoryType;
  isPersonal?: boolean;
  module?: keyof AppModulesConfig;
  parentId?: string;
  isRoot?: boolean;
};

export type ColorValue = {
  id: string;
  name: string;
  hex: string;
};

export type PaymentMethod = {
  id: string;
  name: string;
  icon: string;
  value?: string; // e.g., Pix key
};

export enum AccountType {
  BANK = 'BANK',
  CASH = 'CASH',
  SAVINGS = 'SAVINGS',
  PERSONAL = 'PERSONAL',
}

export type Account = {
  id: string;
  name: string;
  balance: number;
  color: string;
  type: AccountType;
  isDefault?: boolean;
};

export enum ViewType {
  DASHBOARD = 'DASHBOARD',
  PRODUCTS = 'PRODUCTS',
  PURCHASES = 'PURCHASES',
  SALES = 'SALES',
  SETTINGS = 'SETTINGS',
  PRODUCT_FORM = 'PRODUCT_FORM',
  PURCHASE_FORM = 'PURCHASE_FORM',
  SALE_FORM = 'SALE_FORM',
  PRODUCTION_SERVICE_ORDER_FORM = 'PRODUCTION_SERVICE_ORDER_FORM',
  PRODUCT_DETAIL = 'PRODUCT_DETAIL',
  PEOPLE = 'PEOPLE',
  CATEGORIES = 'CATEGORIES',
  GRIDS = 'GRIDS',
  COLORS = 'COLORS',
  PAYMENT_METHODS = 'PAYMENT_METHODS',
  REPORTS = 'REPORTS',
  BACKUP = 'BACKUP',
  FINANCIAL = 'FINANCIAL',
  ACCOUNTS = 'ACCOUNTS',
  STOCK = 'STOCK',
  STOCK_GLANCE = 'STOCK_GLANCE',
  PERSON_DETAIL = 'PERSON_DETAIL',
  PERSONAL_FINANCIAL = 'PERSONAL_FINANCIAL',
  REPORT_DETAILED = 'REPORT_DETAILED',
  DASHBOARD_CONFIG = 'DASHBOARD_CONFIG',
  DATA_CLEANUP = 'DATA_CLEANUP',
  PRODUCTION_MENU = 'PRODUCTION_MENU',
  PRODUCTION_PCP = 'PRODUCTION_PCP',
  PRODUCTION_STOCK = 'PRODUCTION_STOCK',
  PRODUCTION_PURCHASE_NEEDS = 'PRODUCTION_PURCHASE_NEEDS',
  PRODUCTION_CONFIG = 'PRODUCTION_CONFIG',
  PRODUCTION_TECH_SHEET = 'PRODUCTION_TECH_SHEET',
  PRODUCT_SHEET = 'PRODUCT_SHEET',
  MODULES_CONFIG = 'MODULES_CONFIG',
  PRODUCTION_WEIGHING = 'PRODUCTION_WEIGHING',
  PRODUCTION_SOLE_PURCHASE = 'PRODUCTION_SOLE_PURCHASE',
  PRODUCTION_SOLE_RECEIPT = 'PRODUCTION_SOLE_RECEIPT',
  PRODUCTION_SOLE_STOCK = 'PRODUCTION_SOLE_STOCK',
  PRODUCTION_PALMILHA_STOCK = 'PRODUCTION_PALMILHA_STOCK',
  PRODUCTION_PALMILHA_PURCHASE = 'PRODUCTION_PALMILHA_PURCHASE',
  PRODUCTION_ENGINEERING = 'PRODUCTION_ENGINEERING',
  CATEGORY_CONFIG = 'CATEGORY_CONFIG',
  PRODUCTION_ESTOQUES_MENU = 'PRODUCTION_ESTOQUES_MENU',
  PRODUCTION_GENERAL_RECEIPT = 'PRODUCTION_GENERAL_RECEIPT',
  MANUAL = 'MANUAL',
  PRINT_CENTER = 'PRINT_CENTER',
  COLLABORATORS_CONFIG = 'COLLABORATORS_CONFIG',
  // Sem view React própria — só um id estável pro item de menu que abre o módulo nativo
  // Android (ver src/lib/printStudio.ts); onClick nunca chama onNavigate com este valor.
  PRINT_STUDIO = 'PRINT_STUDIO',
  MARKETPLACE_MENU = 'MARKETPLACE_MENU',
  MARKETPLACE_CONNECTION = 'MARKETPLACE_CONNECTION',
  MARKETPLACE_ORDERS = 'MARKETPLACE_ORDERS',
  MARKETPLACE_SKU_MAPPING = 'MARKETPLACE_SKU_MAPPING',
  DELIVERY_MENU = 'DELIVERY_MENU',
  DELIVERY_ROUTE_BUILDER = 'DELIVERY_ROUTE_BUILDER',
  DELIVERY_ROUTE_DETAIL = 'DELIVERY_ROUTE_DETAIL',
  DELIVERY_CONFIG = 'DELIVERY_CONFIG',
}

export type DashboardCardConfig = {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  initialScreen?: ProductionScreenType;
  module?: keyof AppModulesConfig | 'any';
};

export type DashboardConfig = {
  cards: DashboardCardConfig[];
};

// Resumo permanente de um mês — gerado no arquivamento (ver DataCleanupView), nunca
// recalculado a partir dos registros detalhados (que podem já ter sido arquivados).
export type MonthlySnapshot = {
  id: string; // "YYYY-MM"
  month: string; // "YYYY-MM"
  generatedAt: number;
  totalPairsProduced: number;
  salesTotal: number;
  salesCount: number;
  purchasesTotal: number;
  purchasesCount: number;
  financialIncome: number;
  financialExpense: number;
  topCustomers: { id: string; name: string; total: number; count: number }[];
  topProducts: { id: string; name: string; colorName: string; quantity: number; total: number }[];
  supplierTotals: { id: string; name: string; total: number; count: number }[];
};

export type CleanupConfig = {
  id: 'main';
  intervalMonths: number;
  lastRunAt?: number;
};

export type FamilyMember = {
  id: string;
  name: string;
  avatar?: string;
  isPersonal?: boolean;
};

export type Budget = {
  id: string;
  categoryId: string;
  amount: number;
  memberIds: string[];
  alertPercentage: number; // e.g., 80 for 80%
  isPersonal?: boolean;
};

export type FlowTag = {
  id: string;
  name: string;
  subcategories: string[];
  isCuttingFlowTag?: boolean;
};

export type Sector = {
  id: string;
  name: string;
  color: string;
  order: number;
  flowTagIds: string[];
  defaultServiceValue?: number;
  defaultServiceProviderId?: string;
  defaultServiceProviderName?: string;
  isProductionCycleEnd?: boolean; // marca este setor como "fim do ciclo de produção": habilita a finalização (baixa de estoque/reserva) por pedido, independente do nome do setor
  hidden?: boolean; // oculta o setor do PCP (dashboard, seletor de setor etc.) — só pode ser ativado se não houver pedidos pendentes nele
};

export type ProductionScreenType = 'MENU' | 'SECTORS' | 'FLOW_TAGS' | 'UNIDADES' | 'FACAS' | 'INFESTO' | 'PRAZOS' | 'FICHAS' | 'EMBALAGENS' | 'INSUMOS' | 'MATRIZES' | 'PECAS';

// Production sub-screens moved to types.ts

export type AppModulesConfig = {
  personal: boolean;
  sales: boolean;
  production: boolean;
  marketplace: boolean;
  entregas: boolean;
};

// ─── Marketplace (integração com plataformas externas, ex.: Shopee) ────────

export type MarketplaceChannel = 'SHOPEE';

// Status de conexão da loja — NUNCA contém token; tokens ficam em
// users/{uid}/shopeeIntegration (só Admin SDK, ver firestore.rules).
export type MarketplaceConnection = {
  id: string; // = channel
  channel: MarketplaceChannel;
  shopId: string;
  shopName?: string;
  connected: boolean;
  connectedAt?: number;
  lastOrderSyncAt?: number;
  lastStockPushAt?: number;
};

export type MarketplaceSkuMapping = {
  id: string;
  channel: MarketplaceChannel;
  externalItemId: string; // Shopee item_id
  externalModelId?: string; // Shopee model_id (variação) — ausente = item sem variação
  externalSkuLabel?: string; // texto da Shopee, só exibição
  productId: string;
  productName?: string; // denormalizado, só exibição
  variationId: string;
  variationName?: string; // denormalizado, só exibição
  size?: string; // ausente = mapeado como ATACADO (stock['WHOLESALE'])
  saleType: SaleType;
  createdAt: number;
  updatedAt?: number;
};

export type MarketplaceOrderStatus = 'PENDING_IMPORT' | 'PARTIALLY_MAPPED' | 'STOCK_DEBITED' | 'RETURNED' | 'ERROR';

export type MarketplaceOrderItem = {
  externalItemId: string;
  externalModelId?: string;
  externalName: string; // nome da Shopee, exibido quando o item ainda não tem mapeamento
  quantity: number;
  price: number;
  mapping?: { productId: string; variationId: string; size?: string; saleType: SaleType };
};

export type MarketplaceOrder = {
  id: string;
  channel: MarketplaceChannel;
  externalOrderId: string; // Shopee order_sn
  orderNumber: string; // sequência interna, ex. "MKT #0001"
  status: MarketplaceOrderStatus;
  buyerName?: string;
  items: MarketplaceOrderItem[];
  total: number;
  errorReason?: string;
  createdAt: number;
  updatedAt?: number;
  importedAt?: number;
  returnedAt?: number;
};

export type SectorId =
  | 'vendas' | 'compras' | 'cadastro_produtos' | 'cadastro_insumos'
  | 'producao_pcp' | 'estoque' | 'financeiro' | 'clientes_fornecedores'
  | 'pessoal' | 'sistema' | 'entregas';

export type Collaborator = {
  id: string;
  name: string;
  pin: string;
  colorHex: string;
  isUnrestricted: boolean;
  sectors: SectorId[];
  canUseAI: boolean;
  themePref?: string;
  fontScalePref?: number;
  fontFamilyPref?: string;
  navIconModePref?: string;
  navMonoColorPref?: string;
  failedAttempts?: number;
  locked?: boolean;
  dashboardConfig?: DashboardCardConfig[];
};

export type ProductionConfigItem = {
  id: string;
  name: string;
  description: string;
  type: 'UNIT' | 'TOOL' | 'INFESTO' | 'DEADLINE' | 'TECH_SHEET' | 'PACKAGING' | 'MATERIAL' | 'MOLD' | 'PIECE' | 'CONSUMPTION_CATEGORY';
  imageUrl?: string;
  metadata?: {
    // Shared or existing
    conjugation?: number;
    sizes?: string[];
    sizeAreas?: Record<string, number>;
    
    // Material specific
    masterCategory?: string;
    reference?: string;
    flowTagId?: string;
    supplierId?: string;
    unitId?: string;
    baseCost?: number;
    width?: number;
    colorIds?: string[];

    // Mold (Sole Matrix) specific
    category?: string;
    moldReference?: string;
    hasTransfer?: boolean;
    colorVariations?: { colorId: string; colorName?: string; subRef: string }[];
    sizeWeights?: Record<string, number>;
    averageWeight?: number;
    colorWeights?: Record<string, number>;
    colorSizeWeights?: Record<string, Record<string, number>>;
    composition?: { 
      materialId: string; 
      quantity: number; 
      type: 'weight' | 'percentage';
    }[];
    extraServices?: { name: string, cost: number }[];

    // Palmilha (Insole) specific - on TOOL (faca) items
    palmilha?: {
      subtype: 'MONTAGEM' | 'ACABAMENTO';
      colorVariations: { colorId: string; colorName?: string; subRef?: string }[];
      silkServiceId?: string; // Link to FlowTag/Sector, apenas para ACABAMENTO
    };

    // Insumo / Peça specific
    stock?: number;
    minStock?: number;
    stockByColor?: Record<string, number>;
    priceByColor?: Record<string, number>;

    [key: string]: any;
  };
  createdAt: number;
};

export type WeighingRecord = {
  id: string;
  moldId: string;
  moldName: string;
  colorId?: string;
  colorName?: string;
  size?: string;
  weightKg: number;
  quantity: number;
  unitWeight: number;
  date: number;
  note?: string;
};

export type SoleStockEntry = {
  id: string;
  moldId: string;
  moldName: string;
  colorId: string;
  colorName: string;
  supplierId: string;
  supplierName: string;
  stock: { [size: string]: number };
  totalPairs: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: number;
  source?: string;
  sourceRecordId?: string;
  notes?: string;
  updatedAt?: number;
};

export type ProductionLotHistory = {
  sectorId: string;
  statusId: string; // FlowTag ID
  timestamp: number;
  userId?: string;
  userName?: string;
  notes?: string;
};

export type SolePurchase = {
  id: string;
  supplierId: string;
  supplierName: string;
  date: number;
  items: SolePurchaseItem[];
  total: number;
  notes?: string;
  status: 'PENDING' | 'COMPLETED';
};

export type SolePurchaseItem = {
  moldId: string;
  moldName: string;
  colorId: string;
  colorName: string;
  quantities: { [size: string]: number };
  totalPairs?: number;
  unitCost: number;
  totalCost: number;
};

export type PalmilhaStockEntry = {
  id: string;
  toolId: string;
  toolName: string;
  subtype: 'MONTAGEM' | 'ACABAMENTO';
  colorId: string;
  colorName: string;
  supplierId?: string;
  supplierName?: string;
  stock: { [grade: string]: number }; // pares por tamanho/grade da faca
  totalPairs: number;
  unitCost: number;
  totalCost: number;
  purchaseDate: number;
  notes?: string;
  updatedAt?: number;
};

export type PalmilhaPurchaseItem = {
  toolId: string;
  toolName: string;
  subtype: 'MONTAGEM' | 'ACABAMENTO';
  colorId: string;
  colorName: string;
  quantities: { [grade: string]: number };
  totalPairs?: number;
  unitCost: number;
  totalCost: number;
};

export type ProductionOrderItem = {
  productId: string;
  productName: string;
  variationId: string;
  variationName: string;
  saleType: SaleType;
  sizes: Record<string, { total: number; fromStock: number; toProduction: number }>;
  totalQuantity: number;
  fromStockQty: number;
  toProductionQty: number;
  pkgId?: string; // id do ProductionConfigItem (PACKAGING) usado para montar a grade deste item, se houver
  notes?: string;
  reminderAt?: number | null; // Lembrete programado (data e hora) — exibido no card de Lembretes do Dashboard
  reminderTitle?: string | null; // Título curto do lembrete
  reminderAlarmMode?: boolean | null;
  reminderCombineMode?: boolean | null;
  reminderSoundPattern?: ReminderTonePattern | null;
  // Identidade estável da linha, herdada do PurchaseItem/SaleItem que a originou — ver
  // src/utils/lineIdentity.ts. Propaga automaticamente para ProductionLot.metadata.sourceItems
  // e StockLot ao longo de todo o fluxo de produção.
  lineId?: string;
  boxIds?: string[];
};

export type ProductionOrder = {
  id: string;
  orderNumber: string;
  saleId: string;
  saleOrderNumber: string;
  customerId?: string;
  customerName: string;
  orderDate: number;
  deliveryDate: number;
  items: ProductionOrderItem[];
  status: 'PENDING' | 'IN_PRODUCTION' | 'COMPLETED';
  lotIds: string[];
  notes?: string;
  createdAt: number;
};

export type PurchaseRequestStatus = 'PENDING' | 'IN_PROGRESS' | 'ORDERED' | 'RECEIVED';

export type PurchaseRequest = {
  id: string;
  requestKey: string; // item.id from materialReqs: materialId or "SOLE_moldId_colorId"
  type: 'MATERIAL' | 'SOLE';
  name: string;
  unit: string;
  requiredQty: number;
  sizeBreakdown?: Record<string, number>;
  receivedQty?: number;
  receivedBreakdown?: Record<string, number>;
  status: PurchaseRequestStatus;
  requestedAt: number;
  requestedBy?: string;
  contributingLots?: string[];
  materialId?: string;
  moldId?: string;
  colorId?: string;
  notes?: string;
  updatedAt?: number;
};

export type ProductionLot = {
  id: string;
  orderNumber: string; // "Lote #001"
  saleId?: string; // Optional link to a sale
  productionOrderId?: string;
  saleOrderNumber?: string;
  customerName?: string;
  deliveryDate?: number;
  productId: string;
  variationId: string;
  quantity: number;
  route: string[]; // Sector IDs inherited from product
  currentSectorIndex: number;
  currentStatusId?: string; // FlowTag ID (the current status in the sector)
  history: ProductionLotHistory[];
  prioridade: string;
  notes?: string;
  createdAt: number;
  finishedAt?: number;
  
  // Fields from duplicate/legacy definition
  batchId?: string;
  gridId?: string;
  number?: string;
  pairs?: { [size: string]: number };
  gradesQty?: number; // número de grades (caixas) do lote — salvo no ato da criação
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  currentSectorId?: string;
  metadata?: {
    // Nota: forma real em runtime é mais ampla que este tipo declarado — inclui também
    // itemIdx, qty, productId, sizes, fractionLabel, fractionRootKey, lineId, boxIds. Todo
    // ponto de leitura em PCPView.tsx trata isso como `any[]` por esse motivo histórico.
    sourceItems?: Array<{ orderId: string; variationId?: string; variationName?: string; productName?: string; lineId?: string; boxIds?: string[] }>;
    [key: string]: unknown;
  };
};

export type StockLotStatus = 'EM_ESTOQUE' | 'RESERVADO' | 'ENTREGUE';

// Registro individual de uma caixa/lote produzido — granularidade "por grade/caixa".
// Preserva a composição exata de tamanhos (grade) e o destino (estoque livre vs.
// reservado para uma venda específica).
export type StockLot = {
  id: string;
  productId: string;
  productName: string;
  productReference?: string; // referência do produto (denormalizado, ex: "300")
  variationId: string;
  variationName: string; // nome da cor (denormalizado)

  sizeBreakdown: Record<string, number>; // ex: {"37": 2, "38": 4, "39": 2}
  totalPairs: number;
  gradeLabel: string; // ex: "37x2-38x4-39x2"

  status: StockLotStatus;

  // Rastreabilidade da produção
  lotId: string;
  lotOrderNumber?: string;
  productionOrderId?: string;
  productionOrderNumber?: string; // nº do pedido de produção (denormalizado, ex: "P-0123")
  itemIdx?: number;
  // Identidade estável, herdada do PurchaseItem/SaleItem original (ver src/utils/lineIdentity.ts)
  // — sobrevive a reordenação/edição do pedido, ao contrário de itemIdx.
  lineId?: string;
  // Subconjunto de boxIds da linha original que esta entrada de estoque representa (após
  // eventual fracionamento). Só presente para linhas ATACADO.
  boxIds?: string[];
  // Snapshot de getSourceItemKey(si) no momento da criação — chave única já resolvida
  // (lineId ou orderId::itemIdx, mais sufixo de fração), usada por ferramentas de
  // auditoria/reparo para casar esta entrada com o sourceItem que a originou sem
  // reimplementar a lógica de fallback em cada consumidor.
  sourceItemKey?: string;

  // Vínculo com venda (RESERVADO / ENTREGUE)
  saleId?: string;
  saleOrderNumber?: string;
  customerName?: string;
  // true só quando Separar Caixas/Expedir Venda reservou este lote a partir do pool
  // EM_ESTOQUE (src/utils/stockLotPicker.ts) — distingue de RESERVADO nativo de produção
  // (criado direto como RESERVADO em applyExpedicaoStockUpdate), que nunca mexe em
  // estoque/contador ao reverter uma separação. Ausente/false = produção-casada nativa.
  reservedViaSeparation?: boolean;
  // Quando este doc nasceu de um split parcial de outro StockLot (só uma fração das
  // caixas/pares foi separada), aponta pro id do doc original que ficou com o
  // remanescente — usado pra remontar as duas metades no revert.
  splitFromLotId?: string;
  // true quando o desconto no contador de estoque do produto já foi aplicado pra este
  // registro (marcado no momento da reserva, ou pela ferramenta de reconciliação —
  // "Reconciliar Separações" no PCP — pra registros de um período com bug em que a
  // reserva não descontava o contador). Idempotência: evita descontar duas vezes.
  stockDeductionApplied?: boolean;

  // Caixas/embalagem (produtos ATACADO, registrado em applyExpedicaoStockUpdate)
  boxQty?: number; // quantidade de CAIXAS desta entrada (conversão pares -> caixas)
  pkgId?: string; // id do ProductionConfigItem (PACKAGING) usado na conversão, se houver
  pkgName?: string; // nome da embalagem (denormalizado); ausente => "Avulso"

  createdAt: number;
  deliveredAt?: number;
  updatedAt?: number;

  // Usuário confirmou manualmente que essa entrada já foi corrigida por fora (ex.: Balanço
  // de Estoque / edição direta) — some da varredura "Reparar Caixas" sem alterar estoque de novo.
  repairAcknowledged?: boolean;
};

// Pré-visualização (e resumo, após executar) do que reverter um StockLot vai
// desfazer: usado para exibir um popup de devolução com os valores de
// estoque (produto e solados) antes/depois.
export type StockLotRevertPreview = {
  productName: string;
  productReference?: string;
  variationName: string;
  gradeLabel: string;
  totalPairs: number;
  boxQty?: number;
  pkgName?: string;
  stockReverted: boolean; // true se houve baixa do estoque do produto (status EM_ESTOQUE)
  productStockRows: { label: string; before: number; after: number }[];
  sole?: {
    moldName: string;
    colorName: string;
    rows: { size: string; before: number; after: number }[];
  };
  lotOrderNumber?: string;
  orderNumber?: string;
  orderReturnedToExpedicao: boolean;
  lotReopened: boolean;
};

export interface ServiceOrder {
  id: string;
  osNumber: string; // automatic sequential or manual e.g. "OS-0001"
  lotId: string; // Reference to ProductionLot ID
  lotNumber: string; // e.g. "MAPA #001"
  lotIds?: string[]; // Array of associated ProductionLot IDs for group OS
  lotNumbers?: string[]; // Array of associated lot numbers for group OS
  productId: string;
  productName: string;
  variationId: string;
  variationName: string;
  sectorId: string;
  sectorName: string;
  type: 'INTERNAL' | 'OUTSOURCED';
  providerId?: string; // Reference to Person ID
  providerName: string; // Provider Name
  quantity: number; // total pairs of the lot
  valuePerPair: number;
  totalValue: number;
  notes?: string;
  status: 'PENDING' | 'COMPLETED';
  transactionId?: string; // Reference to financial transaction
  createdAt: number;
  finishedAt?: number;
  sourceOrderIds?: string[]; // Order IDs covered by this OS (for per-order OS tracking)
  sourceItemKeys?: string[]; // Specific source item keys (e.g. lotId::orderId::siIdx) covered by this OS
  itemPrices?: Record<string, number>; // Custom pricing per item
  // Print extras
  productPhotoUrl?: string; // URL of the product/variation photo for label printing
  sizeGrid?: string;        // Human-readable size range, e.g. "37-38-39-40-41"
  reminderAt?: number | null; // Lembrete programado (data e hora) — exibido no card de Lembretes do Dashboard
  reminderTitle?: string | null; // Título curto do lembrete
  reminderAlarmMode?: boolean | null;
  reminderCombineMode?: boolean | null;
  reminderSoundPattern?: ReminderTonePattern | null;
  // Navigation helpers (derived from linked lot, not persisted)
  currentSectorIndex?: number;
  route?: string[];
}

export interface AIQuickPrompt {
  id: string;
  label: string;
  prompt: string;
  icon: string;
  autoSend: boolean;
  order: number;
}

export interface AIUsageLimits {
  dailyTokenLimit: number;
  weeklyTokenLimit: number;
}

export type AIProvider = 'anthropic' | 'openai' | 'gemini';

export interface AIProviderKeyConfig {
  apiKey: string;
  model?: string;
}

export interface AIProviderConfig {
  activeProvider: AIProvider;
  openai?: AIProviderKeyConfig;
  gemini?: AIProviderKeyConfig;
}

export interface AIUsageEntry {
  id: string;
  timestamp: number;
  model: string;
  provider?: AIProvider;
  input_tokens: number;
  output_tokens: number;
}




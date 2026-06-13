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

export type Purchase = {
  id: string;
  supplierId: string;
  date: number;
  dueDate?: number; // Vencimento, para compras gerais
  paymentTerm?: PaymentTerm; // A vista ou a prazo
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
  PERSON_DETAIL = 'PERSON_DETAIL',
  PERSONAL_FINANCIAL = 'PERSONAL_FINANCIAL',
  REPORT_DETAILED = 'REPORT_DETAILED',
  DASHBOARD_CONFIG = 'DASHBOARD_CONFIG',
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
  PRODUCTION_SOLE_STOCK = 'PRODUCTION_SOLE_STOCK',
  PRODUCTION_PALMILHA_STOCK = 'PRODUCTION_PALMILHA_STOCK',
  PRODUCTION_PALMILHA_PURCHASE = 'PRODUCTION_PALMILHA_PURCHASE',
  PRODUCTION_ENGINEERING = 'PRODUCTION_ENGINEERING',
  CATEGORY_CONFIG = 'CATEGORY_CONFIG',
  PRODUCTION_ESTOQUES_MENU = 'PRODUCTION_ESTOQUES_MENU',
  PRODUCTION_GENERAL_RECEIPT = 'PRODUCTION_GENERAL_RECEIPT',
  MANUAL = 'MANUAL',
  PRINT_CENTER = 'PRINT_CENTER',
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
};

export type ProductionScreenType = 'MENU' | 'SECTORS' | 'FLOW_TAGS' | 'UNIDADES' | 'FACAS' | 'INFESTO' | 'PRAZOS' | 'FICHAS' | 'EMBALAGENS' | 'INSUMOS' | 'MATRIZES' | 'PECAS';

// Production sub-screens moved to types.ts

export type AppModulesConfig = {
  personal: boolean;
  sales: boolean;
  production: boolean;
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
  notes?: string;
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
    sourceItems?: Array<{ orderId: string; variationId?: string; variationName?: string; productName?: string }>;
    [key: string]: unknown;
  };
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
  // Print extras
  productPhotoUrl?: string; // URL of the product/variation photo for label printing
  sizeGrid?: string;        // Human-readable size range, e.g. "37-38-39-40-41"
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

export interface AIUsageEntry {
  id: string;
  timestamp: number;
  model: string;
  input_tokens: number;
  output_tokens: number;
}




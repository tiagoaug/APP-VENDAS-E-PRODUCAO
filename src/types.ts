export enum SaleType {
  RETAIL = 'RETAIL',
  WHOLESALE = 'WHOLESALE',
}

export enum PurchaseType {
  REPLENISHMENT = 'REPLENISHMENT', // Abastecimento de estoque
  GENERAL = 'GENERAL', // Compras gerais
}

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum GridType {
  FORMA = 'FORMA',
  SOLADO = 'SOLADO',
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

export type ComponentCategory = 'CUTTING_PIECE' | 'PACKAGING' | 'CHEMICAL' | 'TRIMMING';

export type ComponentConsumption = {
  id: string;
  category: ComponentCategory;
  name: string; // Piece name, e.g., "Gáspea", "Lateral"
  materialId: string;
  colorId?: string; // Optional specific color for the component
  quantity: number; // Consumo per unit/pair
  unitId?: string;
  
  // Cutting Piece specific
  toolId?: string; // Link to Faca (ProductionConfigItem type TOOL)
  piecesPerPair?: number; // Usually 2
  
  // Outsourced services
  services?: {
    serviceId: string; // Link to FlowTag subcategory
    cost: number;
  }[];
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
  subRef?: string;
  sku?: string;
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
  salePrice: number;
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
};

export type GeneralPurchaseItem = {
  id: string;
  description: string;
  value: number;
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
  items: PurchaseItem[];
  generalItems?: GeneralPurchaseItem[];
  total: number;
  notes?: string;
  batchNumber?: string; // Controle por lote
  checks?: CompanyCheck[];
  categoryId?: string;
  accountId?: string;
  generateTransaction?: boolean;
  paymentStatus?: PaymentStatus;
  paymentHistory?: PaymentHistory[];
  isAccounting?: boolean;
};

export enum SaleStatus {
  QUOTE = 'QUOTE',
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
  price: number;
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
  subtotal: number;
  discount: number;
  total: number;
  status: SaleStatus;
  paymentTerm: PaymentTerm;
  paymentMethodId?: string;
  accountId?: string;
  dueDate?: number;
  paymentStatus?: PaymentStatus;
  paymentHistory?: SalePayment[];
  notes?: string;
};

export type Person = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  isCustomer: boolean;
  isSupplier: boolean;
  isPersonal?: boolean;
  avatar?: string;
  document?: string;
  credit?: number; // Haver/Crédito do cliente
};

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

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
  relatedId?: string;
  memberId?: string; // For Family Members in personal finance
  isPersonal?: boolean;
};

export enum CategoryType {
  PRODUCT = 'PRODUCT',
  EXPENSE = 'EXPENSE',
  REVENUE = 'REVENUE',
  PRODUCTION = 'PRODUCTION',
  GENERAL = 'GENERAL',
  SUPPLY = 'SUPPLY',
  OTHER = 'OTHER',
}

export type Category = {
  id: string;
  name: string;
  color: string;
  type: CategoryType;
  isPersonal?: boolean;
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
}

export type DashboardCardConfig = {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  initialScreen?: ProductionScreenType;
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
};

export type Sector = {
  id: string;
  name: string;
  color: string;
  order: number;
  flowTagIds: string[];
};

export type ProductionScreenType = 'MENU' | 'SECTORS' | 'FLOW_TAGS' | 'UNIDADES' | 'FACAS' | 'INFESTO' | 'PRAZOS' | 'FICHAS' | 'EMBALAGENS' | 'INSUMOS' | 'MATRIZES';

// Production sub-screens moved to types.ts

export type ProductionConfigItem = {
  id: string;
  name: string;
  description: string;
  type: 'UNIT' | 'TOOL' | 'INFESTO' | 'DEADLINE' | 'TECH_SHEET' | 'PACKAGING' | 'MATERIAL' | 'MOLD';
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
    colorIds?: string[];

    // Mold (Sole Matrix) specific
    category?: string;
    moldReference?: string;
    hasTransfer?: boolean;
    colorVariations?: { colorId: string, subRef: string }[];
    sizeWeights?: Record<string, number>;
    averageWeight?: number;
    composition?: { 
      materialId: string; 
      quantity: number; 
      type: 'weight' | 'percentage';
    }[];
    extraServices?: { name: string, cost: number }[];
    
    [key: string]: any;
  };
  createdAt: number;
};


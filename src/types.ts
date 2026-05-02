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

export type Grid = {
  id: string;
  name: string;
  sizes: string[]; // List of sizes in this grid, e.g. ["37", "38", "39", "40"]
  configuration: { [size: string]: number }; // e.g., { "37": 2, "38": 4, "39": 4, "40": 2 }
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
  variations: Variation[];
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
}

export type DashboardCardConfig = {
  id: string;
  label: string;
  visible: boolean;
  order: number;
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

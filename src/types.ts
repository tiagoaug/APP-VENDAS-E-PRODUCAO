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

// Tamanho de papel/etiqueta pra impressão térmica (Print Studio Ablemark). Não reaproveita
// `Grid` — aqueles campos (sizes/configuration) são pra grade de numeração, não fazem sentido
// pra dimensão de papel. Presets fixos (THERMAL_SIZES) não viram documento — só os cadastrados
// pelo usuário (isCustom) são persistidos.
export type LabelPaperSize = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  isCustom: true;
};

// Elemento de um arquivo de etiqueta no editor de propósito geral (Print Studio Ablemark).
export type LabelElementType = 'text' | 'image' | 'qr' | 'line' | 'shape' | 'grade';

// Campo de venda/produção que um elemento pode "puxar" automaticamente em vez de conteúdo
// estático — mesmos dados que PrintLabelEditorModal.tsx (sistema de blocos fixos) já resolve pra
// Vendas e PCP (ver LabelBindingContext/resolveLabelBinding em src/utils/labelFieldResolvers.ts).
// 'osdata'/'sectornotes' só resolvem de verdade quando o editor foi aberto a partir do PCP
// (LabelEditorSession.productionContext presente) — fora daí ficam em branco/placeholder.
export type LabelDataBinding =
  | 'reference' | 'name' | 'color' | 'size'
  | 'qr' | 'photo' | 'grade'
  | 'customer' | 'recipient' | 'packaging'
  | 'osdata' | 'sectornotes';

export type LabelElement = {
  id: string;
  type: LabelElementType;
  x: number; // mm, a partir do canto superior esquerdo da etiqueta
  y: number;
  w: number;
  h: number;
  rotation: number; // graus
  hidden?: boolean; // oculta na tela E na impressão/exportação (camada desligada) — global, não por propriedade
  // Travas por propriedade (independentes — ex.: travar largura sem travar altura).
  lockWidth?: boolean;
  lockHeight?: boolean;
  lockRotation?: boolean;
  lockFontSize?: boolean; // relevante pros types 'text' e 'grade' (tamanho da fonte das células)
  lockPosition?: boolean; // trava arrastar (mover x/y) — vale pra todos os tipos, inclusive linha
  // Quando presente, o conteúdo do elemento (texto/imagem/qr/grade) vem de
  // `resolveLabelBinding` em vez do conteúdo estático abaixo — usado pelo modo de teste de
  // impressão em Vendas (ver LabelEditorView.tsx). Ausente = comportamento de sempre (elemento
  // estático, como no editor livre "Nova Etiqueta").
  dataBinding?: LabelDataBinding;
  // type 'text'
  text?: string;
  fontSize?: number;
  fontFamily?: 'helvetica' | 'arial' | 'times' | 'courier' | 'avenir'; // mesmo conjunto do editor de etiqueta de produto (PrintLabelEditorModal)
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
  letterSpacing?: number; // px, na mesma escala usada pelo canvas de impressão
  lineHeight?: number; // multiplicador (1 = normal)
  // Efeito "chip": fundo preto arredondado com o texto em branco por cima — mesmo recurso já
  // existente em PrintLabelEditorModal.tsx (Elem.invert).
  invert?: boolean;
  // Só quando dataBinding === 'reference': junta Referência/Nome/Cor num único texto, em
  // qualquer combinação (ex.: só Ref+Cor) — mesma ideia de PrintLabelEditorModal.tsx
  // (Elem.combineFields / "Combinar Campos Neste Elemento"). Ausente/['reference'] = só a
  // referência, comportamento de sempre.
  combineFields?: ('reference' | 'name' | 'color')[];
  // Só quando dataBinding === 'sectornotes': restringe a um setor+nota específicos em vez de
  // concatenar todas as notas da variação (mesma ideia do noteFilter de PrintLabelEditorModal.tsx).
  // Ausente = todas as notas, com cabeçalho por setor (comportamento padrão de getSectorNotesText).
  sectorNoteFilter?: { sectorId: string; noteName: string };
  // type 'image'
  imageDataUrl?: string;
  grayscale?: boolean; // converte a imagem original pra tons de cinza (só na exibição/impressão, não altera o arquivo original)
  // type 'qr'
  qrValue?: string;
  // type 'line' | 'shape': usa x/y/w/h/rotation acima; 'shape' desenha um retângulo
  // type 'grade': tabela tamanho×quantidade (só faz sentido com dataBinding: 'grade'); usa
  // `fontSize` pro texto das células, igual 'text'.
  // Só type 'grade': estilo da PÍLULA DA NUMERAÇÃO (tamanho) — 'filled'/ausente = fundo preto
  // com número branco (padrão de sempre); 'inverted' = fundo branco com contorno preto e número
  // preto; 'plain' = sem pílula nenhuma, só o número preto direto sobre o fundo da etiqueta. Não
  // afeta a quantidade abaixo de cada pílula, que continua sempre preta, independente deste campo.
  gradeSizeStyle?: 'filled' | 'inverted' | 'plain';
  // Raio dos cantos, em mm — 'shape' (retângulo, contorno) e o chip do 'text' com invert=true.
  // Ausente: 'shape' fica com cantos retos (comportamento de sempre); o chip do invert usa um
  // raio automático (metade da altura, até 1.2mm) até o usuário mexer explicitamente.
  borderRadius?: number;
};

// Arquivo de etiqueta salvo (Print Studio Ablemark) — design reutilizável, reabrível/reeditável.
export type LabelFile = {
  id: string;
  name: string;
  paperSizeId: string;
  widthMm: number;
  heightMm: number;
  elements: LabelElement[];
  updatedAt: number;
  // Marca este modelo como feito pra impressão em lote de Vendas (elementos com dataBinding) —
  // usado pra filtrar a lista de modelos ao abrir o editor a partir do popup de impressão da
  // venda (ver LabelPrintStudioView.tsx). Ausente = modelo genérico do editor livre.
  isSalesTemplate?: boolean;
  // Marca este modelo como feito pro PCP (setores de produção) — aparece agrupado por setor na
  // seção "Setores" do seletor de perfil (ver LabelProfilePickerModal.tsx). Independente de
  // isSalesTemplate (um arquivo não costuma ter os dois, mas nada impede).
  isProductionTemplate?: boolean;
  // Setor (Sector.id) que este modelo foi criado pra atender — usado só pra agrupar na lista do
  // seletor de perfil. Ausente = cai no grupo "Sem Setor".
  sectorId?: string;
};

// Um item físico do lote de impressão de etiquetas de uma Venda (uma caixa/tamanho) — mesma
// forma que PrintLabelEditorModal.tsx já usa e resolve (handleOpenSaleLabels em
// src/views/SalesView.tsx). Compartilhado pelos dois editores de etiqueta pra não duplicar essa
// montagem de dados.
export type BatchLabelItem = {
  product: Product;
  variation: Variation;
  sizeGrid: string; // ex. "38x2-39x3"
  lotId?: string;
  orderId?: string;
  itemIdx?: number;
  // Id da Venda que originou esta etiqueta (ver handleOpenSaleLabels em SalesView.tsx) —
  // embutido no QR Code (marcador "SALE") quando não há lotId/orderId de Mapa, pra escanear
  // a etiqueta e ir direto pra venda em vez de cair no erro "não vinculada a um Mapa".
  saleId?: string;
  // Nome do padrão de embalagem real dessa caixa (Variation.stockPkgAllocations ou StockLot já
  // resolvido). Ausente = etiqueta não mostra esse campo mesmo se deixado visível.
  packagingName?: string;
  // Cliente da venda (revendedor) e destinatário final (cliente do cliente) — mesmo valor
  // repetido em todas as caixas do mesmo pedido (ver handleOpenSaleLabels em SalesView.tsx).
  customerName?: string;
  recipientName?: string;
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
  name: string; // Piece name, e.g., "Gáspea", "Lateral" — ou nome livre do item quando entryType === 'GENERIC'
  materialId: string;
  colorId?: string; // Optional specific color for the component
  quantity: number; // Consumo per unit/pair
  unitId?: string;
  unitValue?: number; // Valor unitário manual inserido pelo usuário
  // 'GENERIC' = item sem material/peça/faca cadastrados (mão de obra, serviço avulso — ex:
  // "Corte", "Costura") — formulário simplificado: Nome + Unidade (cadastrada, via unitId) +
  // Qtd + Valor Unit. Ausente/'PIECE' = formulário completo atual (Material, Faca, Cor).
  // Ignorado quando category === 'CUTTING_PIECE' (sempre exige Faca/Material).
  entryType?: 'PIECE' | 'GENERIC';
  // Só para itens de categoria Impostos (TAXES) — cadastro dedicado, sem material nem Faca:
  // define se `unitValue` é uma alíquota (%) ou um valor fixo (R$). Quando 'percentage',
  // `percentageBase` decide sobre qual base ela incide no Custo Total do Produto.
  valueType?: 'percentage' | 'fixed';
  percentageBase?: 'COST' | 'SALE'; // 'COST' = sobre o custo do produto antes de impostos; 'SALE' = sobre o Preço de Venda cadastrado

  // Cutting Piece specific
  toolId?: string; // Link to Faca (ProductionConfigItem type TOOL)
  piecesPerPair?: number; // Usually 2
  
  // Ignore flags for conditional requirements
  ignoreColor?: boolean;
  ignoreQuantity?: boolean;
  consumptionBasis?: 'pair' | 'grade'; // 'grade' = 1 unidade por grade (caixa coletiva), não por par
  // Restringe em qual canal de venda este consumo entra na Necessidade de Compra — usado
  // sobretudo em embalagem (ex: caixa coletiva de atacado vs caixa unitária de varejo) em
  // produtos híbridos, que vendem nos dois canais e não devem somar as duas embalagens pro
  // mesmo par. Ausente/'BOTH' = sempre soma (comportamento anterior, sem filtro).
  salesChannel?: 'WHOLESALE' | 'RETAIL' | 'BOTH';
  // Por padrão, qualquer consumo com materialId entra na Necessidade de Compra do PCP. Marque
  // true pra excluir esse item específico (ex: um material já em excesso no estoque, ou um
  // insumo cujo controle de compra é feito fora do sistema) sem precisar remover o vínculo com
  // o material (que ainda é usado no custo do produto).
  excludeFromPurchaseNeed?: boolean;

  // Outsourced services
  services?: {
    serviceId: string; // Link to FlowTag subcategory
    cost: number;
    name?: string; // Nome do serviço em si (ex: "Revisão Geral") — mostrado na lista deste card; NÃO sincroniza com Instruções por Setor/etiqueta térmica
    noteName?: string; // Identificador curto da instrução por setor (ex: "BORDADO PEITO") — vira SectorNote.name ao sincronizar, usado na etiqueta térmica
    note?: string; // Descrição da instrução por setor — vira SectorNote.text ao sincronizar para "Instruções por Setor" (Variation.sectorNotes) da cor sendo editada
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
  // Serviços terceirizados que se aplicam ao cabedal inteiro (o conjunto), não a uma peça
  // de corte específica — ex: revisão geral, montagem completa.
  assemblyServices?: {
    serviceId: string;
    cost: number;
    name?: string; // Nome do serviço em si (ex: "Revisão Geral") — rótulo deste item na lista, NÃO sincroniza com Instruções por Setor
    noteName?: string; // Identificador curto da instrução por setor (ex: "BORDADO PEITO") — vira SectorNote.name ao sincronizar, usado na etiqueta térmica
    note?: string; // Descrição da instrução por setor — vira SectorNote.text ao sincronizar para "Instruções por Setor"
  }[];
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
  // Miniatura específica pra etiqueta térmica — diferente de `photoUrl` (foto real do
  // produto): é um desenho/ícone de linhas do modelo, sem meio-tom/gradiente, porque uma foto
  // normal sai borrada/escura numa impressora térmica monocromática de baixa resolução. Usada
  // no lugar de `photoUrl` no elemento "Foto" do Editor de Etiquetas quando cadastrada.
  labelThumbnailUrl?: string;
  createdAt: number;
  // Usados para diluir itens de categoria Custo Fixo (Ficha Técnica) em custo por par: valor
  // mensal do item ÷ diasTrabalhadosMes ÷ paresDia. Preenchidos uma vez por produto, em vez de
  // por item — cada modelo tem seu próprio ritmo de produção.
  estimatedPairsPerDay?: number;
  workDaysPerMonth?: number;
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
  // Id do "bloco" (modelo) do formulário de Compra que originou este item — igual ao
  // `PurchaseBlock.id` no momento do save. Preservado entre reedições (PurchaseFormView
  // reconstrói o bloco com esse mesmo id), diferente de `lineId` (que é intencionalmente
  // compartilhado por todos os itens do mesmo produto+cor+modalidade). Permite manter dois
  // blocos "duplicados como itens separados" distintos na Cesta de Compras e no Pedido de
  // Produção gerado, em vez de sempre somá-los numa única linha — ver `blockTag` em
  // ProductionOrderItem e src/utils/productionOrderMerge.ts.
  blockTag?: string;
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
  // Origem em uma Ordem de Serviço (ver card "Ordens de Serviço a Fornecedores" em
  // FinancialView.tsx) — quando presente, ao esta Compra ser marcada como paga (ver
  // PurchasesView.tsx onPartialPay), o transactionId gerado é gravado de volta nessa OS
  // (serviceOrders/{serviceOrderId}), fechando o saldo "em aberto" dela sozinho.
  serviceOrderId?: string;
};

export type CompanyCheck = {
  id: string;
  number: string;
  value: number;
  dueDate: number;
  status: 'PENDING' | 'CLEARED' | 'OVERDUE';
  // Lembrete individual do vencimento deste cheque — mesmo mecanismo do lembrete de compra
  // (notificationService), agendado por cheque em vez de um único lembrete pra compra toda.
  reminderAt?: number | null;
  reminderTitle?: string | null;
  reminderAlarmMode?: boolean | null;
  reminderCombineMode?: boolean | null;
  reminderSoundPattern?: ReminderTonePattern | null;
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
  // Compra recorrente/parcelada — cada ocorrência é sua própria Purchase, ligada às demais
  // pelo mesmo recurrenceGroupId (mesmo padrão de Transaction, ver Financeiro Pessoal). Gerada
  // toda de uma vez no momento de salvar (uma por mês a partir do vencimento informado), não
  // por um agendador em segundo plano.
  isRecurring?: boolean;
  recurrenceGroupId?: string;
  installmentNumber?: number;
  totalInstallments?: number;
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
  // Divisão das caixas deste item (ATACADO, sem size) entre diferentes clientes finais
  // ("cliente do cliente") — preenchido na tela "Dividir entre Clientes" do cadastro do
  // pedido. Soma das quantidades pode ser menor que SaleItem.quantity (divisão parcial é
  // permitida); caixas não cobertas saem sem destinatário nas etiquetas. Ver
  // SalesView.handleOpenSaleLabels, que consome isso pra atribuir recipientName por caixa.
  boxRecipients?: { name: string; quantity: number }[];
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

// Compartilhado entre Sale.deliveryAddress (endereço da entrega em si) e
// Person.defaultDeliveryAddress (endereço padrão cadastrado no cliente, usado pra
// preencher o de uma venda sem digitar tudo de novo — ver DeliveryAddressForm).
export type DeliveryAddress = {
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
  geocodeSource?: 'GEOCODED' | 'MANUAL_PIN' | 'PASTED_LOCATION';
};

// Um item do pedido marcado pra conferência numa parada específica (ver
// Sale.deliveryItems / AdditionalDeliveryAddress.deliveryItems) — puramente informativo:
// não divide estoque nem financeiro, só ajuda a conferir o que sai em cada endereço.
// `quantity` é independente da quantidade vendida no item original (SaleItem.quantity) —
// não precisa somar ao total do pedido entre as paradas.
export type DeliveryItemRef = {
  productId: string;
  variationId: string;
  size?: string; // varejo
  saleType: SaleType;
  quantity: number;
};

// Um endereço de entrega adicional do pedido (ver Sale.additionalDeliveryAddresses) —
// carrega sua própria transportadora opcional, independente da transportadora do endereço
// principal (Sale.carrierId).
export type AdditionalDeliveryAddress = {
  address: DeliveryAddress;
  carrierId?: string;
  // Checklist opcional de itens do pedido a conferir NESTE endereço (ver DeliveryItemRef).
  deliveryItems?: DeliveryItemRef[];
  // Observação cadastrada junto do checklist de itens (ex.: "item X com avaria", "cliente
  // pediu pra não empilhar") — distinta de DeliveryStop.note, que é a observação que o
  // motorista digita na própria tela de entrega. Mostrada como observação EXTRA lá (ver
  // DeliveryRouteDetailView) e também no rodapé da lista de itens, em laranja.
  deliveryItemsNote?: string;
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
  // Comissão do colaborador-vendedor (ver Collaborator.isSeller/commissionPercent) — "assada"
  // no valor de agora a cada salvamento, pra não mudar retroativamente o histórico se a % de
  // comissão do colaborador for alterada depois. Ausente quando o vendedor não é um
  // colaborador-vendedor (ex.: vendedor é uma Pessoa comum, ou não tem comissão configurada).
  sellerCommissionPercent?: number;
  commissionAmount?: number;
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
  deliveryAddress?: DeliveryAddress;
  // Checklist opcional de itens do pedido a conferir no endereço PRINCIPAL (ver
  // DeliveryItemRef) — pra endereços adicionais, ver AdditionalDeliveryAddress.deliveryItems.
  deliveryItems?: DeliveryItemRef[];
  // Observação do checklist de itens do endereço PRINCIPAL — ver
  // AdditionalDeliveryAddress.deliveryItemsNote.
  deliveryItemsNote?: string;
  // Endereços de entrega adicionais — mesmo pedido, produtos a entregar em mais de um
  // lugar (ex.: parte pro cliente, parte pra outra obra/loja dele). Cada um vira sua
  // própria parada ao montar a rota (ver getSaleStopLocations), sem dividir os itens do
  // pedido entre eles — o pedido inteiro aparece listado em cada endereço. Cada endereço
  // adicional pode ir por uma transportadora própria (independente de `carrierId`, que só
  // vale pro endereço principal) ou direto pela rota do app, se `carrierId` estiver vazio.
  additionalDeliveryAddresses?: AdditionalDeliveryAddress[];
  // Prioridade de roteirização de entrega (módulo Entregas) — distinta de `prioridade`,
  // que é SLA de produção/PCP e não tem relação com a ordem de uma rota de entrega.
  deliveryPriority?: 'URGENT' | 'NORMAL';
  deliveryRouteId?: string;
  // Entrega via transportadora cadastrada (Configurações de Entrega > Transportadoras) —
  // alternativa a entregar pela própria rota do app (DeliveryRoute); as duas coisas não
  // têm relação uma com a outra, o pedido usa uma OU outra.
  carrierId?: string;
};

// Transportadora cadastrada (Configurações de Entrega) — usada em Sale.carrierId pra
// indicar que aquele pedido é entregue por ela, não pela rota própria do app.
export type Carrier = {
  id: string;
  name: string;
  phone?: string;
  address?: DeliveryAddress;
};

export type DeliveryStop = {
  id: string;
  // Ausente = parada manual (hospital, posto, oficina, ponto marcado no mapa) — não tem
  // pedido nenhum atrelado, só serve pra passar por um lugar fora da entrega em si.
  // Numa parada de transportadora com 2+ pedidos, é o primeiro deles (compatibilidade
  // com código que só olha pra um pedido só) — `saleIds` abaixo tem a lista completa.
  saleId?: string;
  // TODOS os pedidos entregues nessa parada — normalmente 1 (mesmo valor de `saleId`),
  // mas pode ter vários quando dois ou mais pedidos vão pra mesma transportadora (mesmo
  // endereço físico): em vez de uma parada duplicada por pedido, vira uma parada só.
  saleIds?: string[];
  // Nome de exibição da parada manual (ex.: "Posto Ipiranga", "Hospital Municipal").
  // Paradas de venda usam o nome do cliente, não isto.
  label?: string;
  // Presente quando o pedido tem mais de um endereço de entrega (Sale.additionalDeliveryAddresses)
  // e esta parada corresponde a um dos endereços extras — ex.: "Endereço 2". Ausente = endereço
  // principal (Sale.deliveryAddress) ou parada sem relação com múltiplos endereços.
  addressLabel?: string;
  // Transportadora que atende ESTA parada especificamente — só usado quando ela vem de um
  // endereço adicional com transportadora própria (AdditionalDeliveryAddress.carrierId). A
  // parada do endereço principal continua identificando a transportadora via Sale.carrierId
  // do(s) pedido(s) da parada, não por este campo.
  carrierId?: string;
  order: number;
  lat: number;
  lng: number;
  priority: 'URGENT' | 'NORMAL';
  status: 'PENDING' | 'DELIVERED' | 'SKIPPED';
  deliveredAt?: number;
  note?: string;
  // Checklist de itens a conferir nesta parada — cópia do checklist cadastrado no card da
  // venda (Sale.deliveryItems ou AdditionalDeliveryAddress.deliveryItems, ver
  // getSaleStopLocations) no momento em que a parada foi criada. Ausente/vazio = nenhum
  // item específico anotado (não é obrigatório).
  deliveryItems?: DeliveryItemRef[];
  // Observação cadastrada junto do checklist de itens (Sale.deliveryItemsNote ou
  // AdditionalDeliveryAddress.deliveryItemsNote) — distinta de `note` acima, que o motorista
  // escreve na própria tela de entrega. Mostrada como observação EXTRA (somente leitura) lá.
  deliveryItemsNote?: string;
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
  // "Iniciar Entregas" — quando o motorista sai de fato pra rua. Alimenta o relógio ao
  // vivo (tempo decorrido) na tela de execução; completedAt trava esse tempo quando a
  // última parada é entregue (ver handleMark, App.tsx).
  startedAt?: number;
  completedAt?: number;
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
  // Endereço de entrega padrão do cliente — pré-preenche o de uma venda nova sem digitar
  // tudo de novo (ver "Usar Endereço Cadastrado" em SalesView/DeliveryAddressForm).
  defaultDeliveryAddress?: DeliveryAddress;
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
  module?: keyof AppModulesConfig | 'any' | (keyof AppModulesConfig | 'any')[];
  parentId?: string;
};

// Modelo de categoria compartilhado ENTRE CONTAS (não fica em users/{uid} como o resto dos
// dados) — qualquer conta pode ler pra oferecer como sugestão pronta pra tocar e adicionar
// (ex.: no Assistente de Configuração Inicial de uma conta nova), mas só quem criou pode
// editar/apagar o próprio modelo.
export type CategoryTemplate = {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  module?: Category['module'];
  isPersonal?: boolean;
  createdBy: string;
  createdAt: number;
};

export type ColorValue = {
  id: string;
  name: string;
  hex: string;
  isComposite?: boolean; // false/ausente = cor primária; true = cor composta (ex.: "Preto Dourado")
};

// Modelo de cor compartilhado ENTRE CONTAS — mesmo desenho de CategoryTemplate (ver types.ts).
export type ColorTemplate = {
  id: string;
  name: string;
  hex: string;
  isComposite?: boolean;
  createdBy: string;
  createdAt: number;
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
  ONBOARDING_WELCOME = 'ONBOARDING_WELCOME',
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
  COMPANY_PROFILE = 'COMPANY_PROFILE',
  // Hub da impressora térmica Ablemark BR-L100 (conexão, tamanhos, arquivos) — editor de
  // etiqueta livre, sem relação com o antigo módulo nativo HP/Epson (removido).
  LABEL_PRINT_STUDIO = 'LABEL_PRINT_STUDIO',
  LABEL_EDITOR = 'LABEL_EDITOR',
  BLING_CONNECTION = 'BLING_CONNECTION',
  BLING_PRODUCT_MAPPING = 'BLING_PRODUCT_MAPPING',
  BLING_INVOICE_EMISSION = 'BLING_INVOICE_EMISSION',
  BLING_PICKING_LIST = 'BLING_PICKING_LIST',
  BLING_STOCK = 'BLING_STOCK',
  BLING_INVOICES = 'BLING_INVOICES',
  BLING_HEALTH = 'BLING_HEALTH',
  BLING_DEVOLUCOES = 'BLING_DEVOLUCOES',
  DELIVERY_MENU = 'DELIVERY_MENU',
  DELIVERY_ROUTE_BUILDER = 'DELIVERY_ROUTE_BUILDER',
  DELIVERY_ROUTE_DETAIL = 'DELIVERY_ROUTE_DETAIL',
  DELIVERY_CONFIG = 'DELIVERY_CONFIG',
  DELIVERY_CARRIERS = 'DELIVERY_CARRIERS',
  DELIVERY_NAV_PREFS = 'DELIVERY_NAV_PREFS',
  DELIVERY_PRINT_CONFIG = 'DELIVERY_PRINT_CONFIG',
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
  ai: boolean;
  entregas: boolean;
  bling: boolean;
};

// Identidade visual da empresa — nome/logo/telefone/endereço, opcionalmente inseridos no
// cabeçalho ou rodapé dos PDFs e JPGs compartilhados pelo programa (ver applyCompanyBranding em
// utils/companyBranding.ts). Documento único no Firestore, mesmo padrão de AppModulesConfig.
export type CompanyProfile = {
  name?: string;
  logoUrl?: string; // base64, mesmo padrão de Product.photoUrl
  phone?: string;
  address?: string;
  document?: string; // CNPJ/CPF — opcional
  exportPosition: 'none' | 'header' | 'footer';
  showLogo: boolean;
  showName: boolean;
  showPhone: boolean;
  showAddress: boolean;
};

export type BusinessType = 'REVENDA' | 'FABRICACAO' | 'HIBRIDO';

export interface OnboardingStatus {
  id: string; // sempre 'main_onboarding_status'
  businessType?: BusinessType;
  completedAt?: number;
  skippedAt?: number;
}

// ─── Integração Bling (ERP + emissão de NF-e) ──────────────────────────────
// Nada de credencial/token nos tipos usados no cliente — client_secret e tokens ficam só
// em Cloud Functions/Firestore admin-only (ver firestore.rules). O usuário cadastra Client
// ID/Secret do PRÓPRIO app Bling — cada empresa registra o dela no portal de desenvolvedor.

// Status de conexão — nunca contém client_secret nem tokens. Esses ficam em
// users/{uid}/blingIntegration (só Admin SDK).
export type BlingConnection = {
  id: string; // fixo: 'bling'
  connected: boolean;
  hasCredentials: boolean; // true assim que Client ID/Secret foram salvos, mesmo antes de autorizar
  companyName?: string; // denormalizado da conta Bling, só exibição
  connectedAt?: number;
  lastProductSyncAt?: number;
  lastOrderSyncAt?: number;
  // null/ausente = só sincronização manual. Em minutos — checado pelo blingAutoSyncScheduler
  // (functions/src/index.ts), que roda a cada 5min e dispara syncBlingOrders quando já passou
  // esse intervalo desde lastOrderSyncAt.
  autoSyncIntervalMinutes?: number | null;
};

export type BlingMatchOrigin = 'AUTOMATICO_GTIN' | 'AUTOMATICO_SKU' | 'MANUAL';

export type BlingProductMapping = {
  id: string;
  blingProdutoId: string;
  blingSku?: string;
  blingNome?: string; // denormalizado, só exibição
  productId: string;
  productName?: string; // denormalizado, só exibição
  variationId: string;
  variationName?: string; // denormalizado, só exibição
  size?: string; // ausente = mapeado como ATACADO (stock['WHOLESALE'])
  saleType: SaleType;
  origem: BlingMatchOrigin;
  createdAt: number;
  updatedAt?: number;
};

// Produto do Bling que o usuário marcou "Ignorar" no assistente de vinculação — não é uma
// vinculação, só evita que o mesmo produto continue aparecendo na aba "Pendentes".
export type BlingIgnoredProduct = {
  id: string; // = blingProdutoId
  blingNome?: string; // denormalizado, só exibição
  ignoredAt: number;
};

export type BlingOrderOrigin = 'PROPRIO' | 'MERCADO_LIVRE' | 'SHOPEE' | 'LOJA_VIRTUAL' | 'OUTRO';
export type BlingOrderStatus = 'PENDENTE' | 'PRONTO_PARA_EMITIR' | 'EMITINDO' | 'EMITIDA' | 'REJEITADA' | 'CONCLUIDA';

export type BlingOrderItem = {
  blingProdutoId: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  mapeado: boolean; // true quando existe BlingProductMapping pra este blingProdutoId
  separado?: boolean; // true quando o estoque já foi abatido pra este item (ver Lista de Separação)
};

export type BlingOrder = {
  id: string;
  blingPedidoId: string;
  numero: string;
  origem: BlingOrderOrigin;
  cliente: string;
  valorTotal: number;
  itens: BlingOrderItem[];
  status: BlingOrderStatus;
  notaFiscalId?: string;
  notaNumero?: string;
  danfeUrl?: string;
  pdfUrl?: string;
  etiquetaTransporte?: {
    nome?: string;
    endereco?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
  };
  motivoRejeicao?: string;
  createdAt: number;
  updatedAt?: number;
};

// "Livro de vendas" — um registro por pedido Bling com NF-e autorizada/emitida (situação
// Autorizada/Emitida DANFE), independente de o pedido ainda estar em BlingOrders (que só guarda
// pedidos "Em aberto") — ver comentário completo em functions/src/bling/sync.ts. Usado só pelo
// Painel de Saúde pra contar pares vendidos de forma completa, sem depender de o app ter
// sincronizado o pedido enquanto ainda estava em aberto.
export type BlingSalesLedgerEntry = {
  id: string; // = blingPedidoId
  numero: string;
  origem: BlingOrderOrigin;
  totalPares: number;
  valorTotal: number;
  dataVenda: number; // data real do pedido no Bling — usar pra filtro de período, não createdAt
  createdAt: number; // quando o app registrou a venda no livro (auditoria, não pra filtro)
};

// "Notas de terceiros" — talão físico pré-impresso comprado fora do Bling (não é a NF-e
// eletrônica, que já tem seu próprio fluxo em BlingOrder). Ver functions/src/bling/notes.ts.
export type BlingNotesCounter = {
  id: 'counter';
  total: number;
  totalCadastrado: number;
  totalConsumido: number;
  totalDevolvido: number;
  updatedAt: number;
};

export type BlingNoteAdjustmentType = 'CADASTRO' | 'AJUSTE_MANUAL' | 'CONSUMO_VENDA' | 'DEVOLUCAO';

export type BlingNoteAdjustment = {
  id: string;
  type: BlingNoteAdjustmentType;
  delta: number;
  balanceAfter: number;
  motivo?: string;
  blingOrderId?: string;
  createdAt: number;
};

export type BlingDevolucao = {
  id: string;
  productId: string;
  productReference: string;
  productName: string;
  variationId: string;
  variationName: string;
  size?: string; // ausente = Atacado
  quantidade: number;
  createdAt: number;
};

export type SectorId =
  | 'vendas' | 'compras' | 'cadastro_produtos' | 'cadastro_insumos'
  | 'producao_pcp' | 'estoque' | 'financeiro' | 'clientes_fornecedores'
  | 'pessoal' | 'sistema' | 'entregas' | 'bling';

// Nível de permissão de uma função específica dentro de um setor liberado (ver SECTORS em
// utils/collaborators.ts) — 'edit' é o padrão implícito (mesmo comportamento de sempre, acesso
// total ao setor); 'view' restringe a só visualizar (esconde a ação de criar/editar daquela
// função específica); 'none' esconde a função inteira, mesmo com o setor liberado.
export type TaskPermissionLevel = 'none' | 'view' | 'edit';

export type Collaborator = {
  id: string;
  name: string;
  pin: string;
  colorHex: string;
  // Foto do colaborador (base64), mesmo padrão de Product.photoUrl — usada no lugar do
  // círculo com a inicial nas telas de seleção/troca de colaborador. Ausente = mostra a
  // inicial do nome sobre colorHex, comportamento de sempre.
  photoUrl?: string;
  isUnrestricted: boolean;
  sectors: SectorId[];
  // Refinamento por função dentro de um setor liberado — chave "sectorId:taskId" (ver
  // SECTOR_TASKS em utils/collaborators.ts). Ausente = 'edit' (acesso total, como sempre foi).
  taskPermissions?: Record<string, TaskPermissionLevel>;
  canUseAI: boolean;
  // Colaborador pode ser escolhido como "Vendedor/Responsável" no Lançamento de Venda (junto
  // das Pessoas marcadas isSeller) — commissionPercent (0-100) é aplicado sobre o total de cada
  // venda dele pra alimentar o painel "Comissão a Vendedores" em Financeiro (ver Sale.
  // commissionAmount, calculado e "assado" na venda a cada salvamento).
  isSeller?: boolean;
  commissionPercent?: number;
  themePref?: string;
  fontScalePref?: number;
  fontFamilyPref?: string;
  navIconModePref?: string;
  navMonoColorPref?: string;
  // Provedor de navegação preferido nas entregas ('waze' | 'google_maps' | 'apple_maps' |
  // 'embedded_sdk') — só pré-destaca a opção no popup de escolha (NavigationProviderModal),
  // nunca dispara navegação sozinho. Não confundir com navIconModePref/navMonoColorPref
  // acima, que são sobre a cor dos ÍCONES DA BARRA INFERIOR do app, assunto totalmente
  // diferente.
  deliveryNavProviderPref?: string;
  failedAttempts?: number;
  locked?: boolean;
  dashboardConfig?: DashboardCardConfig[];
};

// Config central única (doc id sempre 'main_config', mesmo padrão de DashboardConfig) —
// hoje só guarda as preferências da "Navegação Integrada" (ver DeliveryRouteDetailView.tsx):
// modo 100% web (Geolocation + OSRM), sem SDK nativo nem custo de API nenhum.
export type NavConfig = {
  id: string;
  // Distância (metros) da parada a partir da qual a Navegação Integrada passa a atualizar a
  // localização com mais frequência e centraliza o mapa na parada — ajuda o entregador a
  // achar o endereço exato na reta final. Ausente = usa o padrão definido em
  // DeliveryRouteDetailView.tsx (ver APPROACH_DEFAULT_DISTANCE_METERS).
  approachDistanceMeters?: number;
  // Intervalo (ms) de atualização/foco do mapa quando dentro da distância de aproximação
  // acima — ex.: 1000 = a cada 1 segundo. Ausente = usa o padrão.
  approachFastUpdateMs?: number;
  // Intervalo (ms) de checagem (foco do mapa + recálculo de rota) enquanto NENHUMA parada
  // está dentro da distância de aproximação — mais espaçado que approachFastUpdateMs.
  // Ausente = usa o padrão.
  approachFarUpdateMs?: number;
};

// Config central única (doc id sempre 'main_config', mesmo padrão de NavConfig acima) —
// preferências PADRÃO da Central de Impressão de Entregas (Configurações de Entrega).
// Só define o que vem pré-marcado ao abrir o modal de impressão de dentro de uma rota
// (DeliveryExportModal) — o usuário ainda pode ajustar cada campo naquele momento sem
// alterar este padrão salvo.
// 'none' = não mostra produtos/caixas; 'summary' = uma linha por produto/cor, só com a
// contagem de caixas (ex.: "300 Preto — 2 CX"); 'full' = tabela detalhada por caixa
// (produto, cor, pares, caixas), como já era antes de virar duas opções separadas.
export type DeliveryPrintBoxesMode = 'none' | 'summary' | 'full';

export type DeliveryPrintPrefs = {
  id: string;
  showOrders: boolean;
  showCustomers: boolean;
  boxesMode: DeliveryPrintBoxesMode;
  // Exibe uma linha de assinatura ("Assinatura do Recebedor" + data) ao final de cada
  // parada, pra colher confirmação física de recebimento na entrega.
  showSignatureField: boolean;
  // Exibe uma caixinha de checagem (quadrado vazio) ao lado do número de cada parada, pra
  // marcar manualmente à caneta conforme vai entregando.
  showCheckbox: boolean;
  // Quantas entregas (paradas) forçar por folha impressa — 0 = automático (encaixa o
  // máximo que couber sem NUNCA cortar os dados de uma entrega entre duas folhas); N>0 =
  // sempre N paradas por folha (mesmo sobrando espaço em branco).
  stopsPerPage: number;
  pageSize: 'a4' | '100x150';
  format: 'pdf' | 'jpg';
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

    // Categoria de consumo (CONSUMPTION_CATEGORY, inclusive as fixas embutidas — Embalagens,
    // Químicos, Aviamentos, Impostos, Fretes, Folha de Pagamento, Serviços, Outros) — natureza
    // do custo pra diluição no Custo Total do Produto. Ausente = 'VARIABLE' (soma direto, sem
    // diluir por produção estimada).
    costType?: 'FIXED' | 'VARIABLE';

    // Material specific
    masterCategory?: string;
    reference?: string;
    flowTagId?: string;
    supplierId?: string;
    unitId?: string;
    baseCost?: number;
    width?: number;
    // Material vendido em KG: peso e preço da embalagem/pacote comprado — baseCost (R$/kg) é
    // calculado a partir desses dois (packagePrice ÷ packageWeight) em vez de digitado direto.
    packageWeight?: number;
    packagePrice?: number;
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
  // Herdado de PurchaseItem.blockTag — ver comentário lá. Usado por
  // src/utils/productionOrderMerge.ts pra não somar itens do mesmo produto+cor+modalidade
  // quando eles vêm de blocos que o usuário duplicou como "itens separados" no formulário.
  blockTag?: string;
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
  // Fechado (saiu do "Em Aberto" de Ordens de Serviço a Fornecedores) por uma Compra marcada
  // "Não Contábil" (Purchase.generateTransaction === false) — esse tipo de compra nunca gera
  // Transaction (não entra no fluxo de contas a pagar), então não tem como usar transactionId
  // pra fechar o saldo; ver isOsPaid em FinancialView.tsx, que trata os dois casos como "pago".
  paidNaoContabil?: boolean;
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




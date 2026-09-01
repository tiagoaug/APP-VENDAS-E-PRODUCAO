# Progresso — Ajuda e Cadastro Guiado

Checklist de acompanhamento das três frentes de "app autoexplicativo" (ver memória
`feedback_help_system_coverage`): a **Central de Ajuda** (tópico por tela), os
**Tours Guiados / Cadastro Guiado** (passo a passo tocando na tela real) e o
**"Me Guie"** (toggle único que liga o tour automático da tela atual + libera o "?"
arrastável pra explicar qualquer campo). Marque aqui conforme for implementando — este
arquivo não precisa ficar 100% atualizado sozinho, é pra você (e eu, em conversas
futuras) saber rápido o que falta.

Mapeado em 30/08/2026 a partir do código real (`ViewType` em `src/types.ts`,
`HELP_TOPICS` em `src/data/helpKnowledgeBase.ts`, `JOURNEYS` em `src/data/journeys.ts`,
`FIELD_HELP` em `src/data/fieldHelp.ts`, contagem de `data-guide-anchor` em todo o `src/`).

## As três frentes — onde mexer

1. **Central de Ajuda** (ícone de interrogação no cabeçalho → `HelpCenterModal.tsx`):
   busca por palavra-chave numa base offline, sem IA. Pra adicionar/editar uma tela,
   mexa só em `src/data/helpKnowledgeBase.ts` (`HELP_TOPICS`) — um objeto novo com
   `view`, `title`, `summary`, `sections` e `keywords`. Nenhum outro arquivo precisa mudar.
2. **Cadastro Guiado** (tours de processo, `GuidedTourOverlay.tsx`): passo a passo que
   destaca o botão real na tela e espera o toque. Pra adicionar um tour novo:
   - Adicione `data-guide-anchor="algumChave"` no(s) elemento(s) real(is) da tela
     (botão "Novo", botão "Salvar" etc.).
   - Registre um objeto novo em `JOURNEYS` (`src/data/journeys.ts`) usando essa(s)
     `anchorKey`.
3. **"Me Guie" — ajuda por campo** (`DraggableHelpPoint.tsx` + `src/data/fieldHelp.ts`):
   o toggle "Me Guie" (Central de Ajuda → topo) libera um "?" arrastável — soltar ele
   perto de QUALQUER elemento com `data-guide-anchor` mostra um popup explicando aquele
   campo específico, usando o mesmo `anchorKey` dos tours. Pra cobrir um anchor novo,
   basta adicionar uma linha em `FIELD_HELP` (chave = o mesmo `anchorKey`, valor = `{
   text: '...' }`) — não precisa de tour nem de anchor novo se um já existir.

Existe ainda um quarto conteúdo, o **Manual do Sistema** (`ManualView.tsx`,
`src/views/ManualView.tsx`) — texto corrido por módulo, não é 1:1 por tela/anchor e não
entra neste checklist (já está razoavelmente populado; se quiser rastrear ele também, me
avisa que crio uma seção separada).

**Legenda:** `[x]` feito · `[ ]` falta · `[-]` não se aplica (tela sem cadastro/lista pura,
não precisa de tour) — se discordar de um `[-]`, é só trocar por `[ ]`.

---

## 1. Central de Ajuda — um tópico por tela (`HELP_TOPICS`)

Progresso atual: **64 de 64 telas aplicáveis** têm tópico (68 `ViewType` no total, 4 marcadas `[-]` abaixo: `SETTINGS`/`MANUAL` são menu/conteúdo-de-ajuda em si, `PRODUCT_DETAIL`/`PRODUCTION_TECH_SHEET` são enums sem tela implementada). ✅ Concluído em 30/08/2026.

### Cadastros essenciais
- [x] Painel Inicial — `DASHBOARD`
- [x] Cadastro de Produtos (lista) — `PRODUCTS`
- [x] Cadastro/Edição de Produto — `PRODUCT_FORM`
- [-] Detalhe do Produto — `PRODUCT_DETAIL` (enum existe mas a tela não está implementada/roteada em lugar nenhum hoje — sem `case` em `App.tsx`)
- [x] Categorias e Grupos — `CATEGORIES`
- [x] Hierarquia de Módulos das Categorias — `CATEGORY_CONFIG`
- [x] Grades de Tamanho — `GRIDS`
- [x] Paleta de Cores — `COLORS`
- [x] Clientes e Fornecedores (lista) — `PEOPLE`
- [x] Detalhe de Cliente/Fornecedor — `PERSON_DETAIL`

### Vendas
- [x] Vendas (lista) — `SALES`
- [x] Pedido de Venda — `SALE_FORM`
- [x] Central de Impressão (etiquetas/pedido) — `PRINT_CENTER`
- [x] Consulta Rápida de Estoque — `STOCK_GLANCE`

### Compras
- [x] Compras (lista) — `PURCHASES`
- [x] Pedido de Compra — `PURCHASE_FORM`

### Financeiro
- [x] Financeiro (Fluxo de Caixa Vendas) — `FINANCIAL`
- [x] Contas de Movimentação — `ACCOUNTS`
- [x] Meios de Recebimento — `PAYMENT_METHODS`
- [x] Relatórios — `REPORTS`
- [x] Relatório Detalhado — `REPORT_DETAILED`
- [x] Financeiro Pessoal — `PERSONAL_FINANCIAL`

### Estoque e Expedição
- [x] Estoque — `STOCK`

### Produção — PCP e Fábrica
- [x] PCP — Planejamento e Controle de Produção — `PRODUCTION_PCP`
- [x] Menu de Produção (hub) — `PRODUCTION_MENU`
- [x] Estoque de Materiais — `PRODUCTION_STOCK`
- [x] Necessidade de Compras (produção) — `PRODUCTION_PURCHASE_NEEDS`
- [x] Configuração de Fábrica (setores, facas, matrizes...) — `PRODUCTION_CONFIG`
- [x] Ordem de Serviço (terceirizado) — `PRODUCTION_SERVICE_ORDER_FORM`
- [x] Engenharia de Produto (ficha técnica) — `PRODUCTION_ENGINEERING`
- [x] Ficha Técnica (mesma tela, outro atalho) — `PRODUCT_SHEET`
- [-] Ficha Técnica (visão produção) — `PRODUCTION_TECH_SHEET` (enum existe mas não está roteada em lugar nenhum hoje)

### Produção — Insumos
- [x] Menu de Estoques (insumos, hub) — `PRODUCTION_ESTOQUES_MENU`
- [x] Compra de Solados — `PRODUCTION_SOLE_PURCHASE`
- [x] Recebimento de Solados — `PRODUCTION_SOLE_RECEIPT`
- [x] Estoque de Solados — `PRODUCTION_SOLE_STOCK`
- [x] Compra de Palmilhas — `PRODUCTION_PALMILHA_PURCHASE`
- [x] Estoque de Palmilhas — `PRODUCTION_PALMILHA_STOCK`
- [x] Recebimento Geral (materiais/embalagens) — `PRODUCTION_GENERAL_RECEIPT`
- [x] Pesagem e Contagem — `PRODUCTION_WEIGHING`

### Módulo Entregas
- [x] Menu de Entregas (hub) — `DELIVERY_MENU`
- [x] Montar Rota de Entrega — `DELIVERY_ROUTE_BUILDER`
- [x] Detalhe/Execução da Rota — `DELIVERY_ROUTE_DETAIL`
- [x] Configurações de Entrega — `DELIVERY_CONFIG`
- [x] Transportadoras — `DELIVERY_CARRIERS`
- [x] Preferências de Navegação — `DELIVERY_NAV_PREFS`
- [x] Configuração de Impressão de Entrega — `DELIVERY_PRINT_CONFIG`

### Integração Bling
- [x] Conexão Bling — `BLING_CONNECTION`
- [x] Vínculo de Produtos Bling — `BLING_PRODUCT_MAPPING`
- [x] Emissão de Notas Fiscais — `BLING_INVOICE_EMISSION`
- [x] Lista de Separação (picking) — `BLING_PICKING_LIST`
- [x] Estoque Bling — `BLING_STOCK`
- [x] Notas Fiscais Emitidas — `BLING_INVOICES`
- [x] Saúde do Negócio (Bling) — `BLING_HEALTH`
- [x] Devoluções (Bling) — `BLING_DEVOLUCOES`

### Sistema, Configurações e Colaboradores
- [x] Colaboradores — `COLLABORATORS_CONFIG`
- [x] Personalizar Empresa — `COMPANY_PROFILE`
- [x] Módulos do Sistema — `MODULES_CONFIG`
- [x] Personalizar Dashboard — `DASHBOARD_CONFIG`
- [x] Ajustes Técnicos / Backup — `BACKUP`
- [x] Limpeza de Dados (arquivamento) — `DATA_CLEANUP`
- [x] Boas-vindas / Configuração Inicial — `ONBOARDING_WELCOME`
- [-] Configurações (menu) — `SETTINGS` (só um menu de atalhos)
- [-] Manual do Sistema — `MANUAL` (é o próprio conteúdo de ajuda)

### Ferramentas Extras
- [x] Extrator de Texto (OCR) — `OCR_TEXT_EXTRACTOR`
- [x] Ajustes de PDF e JPG — `LABEL_PRINT_STUDIO`
- [x] Editor de Etiquetas — `LABEL_EDITOR`
- [x] Calculadora de Regra de Três — `RULE_OF_THREE`

---

## 2. Cadastro Guiado — tours de processo (`JOURNEYS`)

Tours são por **ação** (não 1:1 por tela) — uma tela pode ter mais de um tour (ex.:
Pessoas tem "cadastrar cliente" e "cadastrar fornecedor" separados). Progresso atual:
**26 de 26 tours mapeados**. ✅ Bloco concluído em 30/08/2026.

### Prontos
- [x] Como fazer uma venda — `tour_fazer_venda` (Dashboard → Vendas → Pedido)
- [x] Como lançar uma compra — `tour_fazer_compra` (Dashboard → Compras → Pedido)
- [x] Como cadastrar uma categoria — `tour_cadastrar_categoria`
- [x] Como cadastrar uma cor — `tour_cadastrar_cor`
- [x] Como cadastrar uma grade — `tour_cadastrar_grade` (produção)
- [x] Como criar um Mapa de Produção — `tour_criar_mapa_producao` (produção)
- [x] Como cadastrar um padrão de embalagem — `tour_cadastrar_embalagem` (produção)
- [x] Como cadastrar uma unidade de medida — `tour_cadastrar_unidade` (produção)
- [x] Como cadastrar um cliente — `tour_cadastrar_cliente`
- [x] Como cadastrar um fornecedor — `tour_cadastrar_fornecedor`
- [x] Como cadastrar uma conta — `tour_cadastrar_conta`
- [x] Como cadastrar um meio de recebimento — `tour_cadastrar_meio_pagamento`
- [x] Como cadastrar um produto novo — `tour_cadastrar_produto` (`products.novo` + `productForm.salvar`, anchors novos)
- [x] Como cadastrar um colaborador — `tour_cadastrar_colaborador` (`collab.novo`/`collab.salvar`, anchors novos)
- [x] Como criar uma Ordem de Serviço — `tour_emitir_os` (reaproveita `pcp.detalheEmitirOS` + `serviceOrder.emitir` novo)
- [x] Como registrar uma compra de solados — `tour_registrar_compra_solados` (`solePurchase.confirmar` novo)
- [x] Como registrar o recebimento de solados — `tour_registrar_recebimento_solados` (`soleReceipt.confirmar` novo)
- [x] Como cadastrar um setor de fábrica — `tour_cadastrar_setor` (`sector.novo`/`sector.salvar`, anchors novos)
- [x] Como cadastrar uma faca de corte — `tour_cadastrar_faca` (reaproveita `prodcfg.addRegistro`/`salvarRegistro`, sem anchor novo)
- [x] Como cadastrar uma matriz de solado — `tour_cadastrar_matriz` (reaproveita `prodcfg.addRegistro`/`salvarRegistro`, sem anchor novo)
- [x] Como cadastrar uma peça — `tour_cadastrar_peca` (`peca.adicionar` novo)
- [x] Como montar uma rota de entrega — `tour_montar_rota_entrega` (`delivery.montarRota`/`deliveryRoute.otimizar`/`deliveryRoute.salvar`, anchors novos)
- [x] Como cadastrar uma transportadora — `tour_cadastrar_transportadora` (`carrier.novo`/`carrier.salvar`, anchors novos)
- [x] Como conectar a conta Bling — `tour_conectar_bling` (`bling.salvarCredenciais`/`bling.conectar`, anchors novos)
- [x] Como vincular um produto ao Bling — `tour_vincular_produto_bling` (`blingMapping.confirmar` novo)
- [x] Como registrar uma devolução (Bling) — `tour_registrar_devolucao_bling` (`blingDevolucao.somenteNota`/`confirmarNota`, anchors novos)
- [x] Como montar a Ficha Técnica de um produto — `tour_ficha_tecnica` (`productForm.abaFichaTecnica`, `productForm.fichaTecnicaAdicionar`, `engineeringEditor.confirmar` — todos novos; editor real é `components/EngineeringEditor.tsx`)

### Telas sem cadastro (não precisam de tour)
- [-] Painel Inicial, Estoque, Relatórios, Detalhes (Produto/Pessoa), todos os
  hubs/menus (`*_MENU`), telas de configuração de preferência única (Módulos,
  Personalizar Empresa, Personalizar Dashboard, Backup) e as ferramentas Extras
  (OCR, PDF/JPG, Regra de Três — usar já é autoexplicativo, sem "salvar um cadastro").

---

## 3. "Me Guie" — ajuda por campo (`FIELD_HELP`)

Cobertura por **anchor** (cada `data-guide-anchor` da tela é um "campo" que o "?" pode
explicar), não por tela — a mesma chave (`anchorKey`) alimenta o tour (seção 2, quando
existe um) e o "?" arrastável ao mesmo tempo. Progresso atual: **351 de 351 anchors
mapeados na tela têm entrada em `FIELD_HELP`** (100%). ✅ Mapeado e concluído em 30/08/2026
— contagem automática via `grep -rn data-guide-anchor src` comparada com as chaves de
`FIELD_HELP`.

Este bloco já vinha quase inteiramente pronto de um trabalho anterior (praticamente toda
a área de Vendas, Compras e PCP/Matrizes já estava coberta) — o único trecho preenchido
nesta sessão foi o de anchors novos, criados junto com os tours da seção 2.

### Mapa por área (nº de anchors com `FIELD_HELP`)
- [x] Vendas — `sales.*` (122) + `saleForm.*` (32) = 154
- [x] Compras — `purchaseForm.*` (39) + `purchases.*` (2) = 41
- [x] PCP / Produção — `pcp.*` (43) + `sector.*` (2) + `prodcfg.*` (2) + `prodmenu.*` (1) + `serviceOrder.*` (1) = 49
- [x] Solados / Matrizes — `mold.*` (31) + `solePurchase.*` (1) + `soleReceipt.*` (1) + `peca.*` (1) = 34
- [x] Ferramentas Extras — `ocrTool.*` (13) + `ruleOfThree.*` (12) + `pasteOrder.*` (9) + `export.*` (2) + `labelEditor.*` (1) = 37
- [x] Cadastros essenciais / Sistema — `cat.*`, `color.*`, `grade.*`, `people.*`, `person.*`, `account.*`, `paymethod.*`, `products.*`, `productForm.*`, `engineeringEditor.*`, `collab.*` = 19
- [x] Estoque — `stock.*` = 4
- [x] Navegação (barra inferior) — `nav.*` = 3
- [x] Entregas — `delivery.*` (1) + `deliveryRoute.*` (2) + `carrier.*` (2) = 5
- [x] Bling — `bling.*` (2) + `blingDevolucao.*` (2) + `blingMapping.*` (1) = 5

### Como manter isso em dia
Sempre que adicionar um `data-guide-anchor` novo numa tela (pra um tour novo ou não),
adicione a explicação correspondente em `FIELD_HELP` (`src/data/fieldHelp.ts`) no mesmo
commit — é só uma linha (`'algumAnchor': { text: '...' }`), sem precisar de tour nem de
entrada na Central de Ajuda pra isso valer. Pra reconferir a cobertura a qualquer momento:
compare a saída de `grep -rn "data-guide-anchor" src` com as chaves de `FIELD_HELP` —
qualquer anchor que apareça só do lado do grep está sem explicação.

**Importante — isso NÃO é a cobertura real do "?" no app inteiro.** A seção 3 acima só
mede os anchors que **já existem** no código (100% deles têm explicação). Mas a maioria
dos botões/elementos clicáveis do app **ainda não tem nenhum anchor** — ou seja, soltar o
"?" em cima deles hoje não acha nada. A cobertura de verdade, contando TODO botão
(`onClick`) de toda tela, é medida na seção 4 abaixo.

---

## 4. "?" em todo ponto clicável do app — mapa por módulo

Pedido: soltar o "?" arrastável em **qualquer** elemento clicável do programa (inclusive
todo card do Painel Inicial) deve sempre mostrar uma explicação — não só nos anchors que
já existem hoje. Isso exige adicionar `data-guide-anchor` + entrada em `FIELD_HELP` em
cada botão/card que ainda não tem, tela por tela.

Contagem automática em 30/08/2026: `grep -c "onClick=" <arquivo>` (pontos clicáveis) vs
`grep -c "data-guide-anchor" <arquivo>` (já cobertos), por arquivo, agrupado por módulo.

**Progresso atual: 1727 de 2537 pontos clicáveis do app têm anchor — 68%.** É um escopo
bem maior que a seção 3 (que só mediu os ~350 anchors que já existiam) — cobrir tudo é
um trabalho de várias sessões, tela por tela. Esta tabela é o mapa pra ir avançando nisso
aos poucos, sem perder de vista quanto falta em cada módulo.

| Módulo | Cobertos / Total | % |
|---|---|---|
| **Painel Inicial (Dashboard)** | **156 / 172** | **91% — módulo praticamente fechado em 30/08/2026 (só sobra o que for pedido novo)** |
| Vendas | 336 / 351 | 96% — módulo praticamente fechado em 31/08/2026 (o resto são backdrops/wrappers sem ação própria) |
| Ferramentas Extras (OCR/Regra de Três) | 27 / 58 | 47% |
| Compras | 143 / 151 | 95% — módulo praticamente fechado em 31/08/2026 (inclui `GeneralReceiptsView.tsx` e `PurchaseNeedsView.tsx`, recategorizados de Solados e PCP para Compras nesta etapa; o resto são backdrops/wrappers sem ação própria) |
| Central de Ajuda / Onboarding guiado | 8 / 30 | 27% |
| Produção / PCP | 464 / 588 | 79% |
| Etiquetas / Impressão | 314 / 331 | 95% — módulo praticamente fechado em 31/08/2026 (o resto são backdrops/wrappers sem ação própria) |
| App.tsx (nav/menus globais) | 4 / 30 | 13% |
| Cadastros (Produtos/Categorias/Cores/Grades/Pessoas) | 130 / 134 | 97% — módulo praticamente fechado em 31/08/2026 (o resto são backdrops/wrappers sem ação própria) |
| Bling | 5 / 88 | 6% |
| Entregas | 4 / 78 | 5% |
| Estoque (produtos prontos) | 4 / 91 | 4% |
| Financeiro | 4 / 109 | 4% |
| Colaboradores / Sistema / Configurações | 2 / 92 | 2% |
| Solados / Palmilhas / Insumos | 121 / 140 | 86% |
| Assistente de IA | 0 / 43 | 0% |
| Componentes Genéricos / Utilitários (Modal, DatePicker, ComboBox...) | 1 / 40 | 3% |
| **Total geral** | **1727 / 2537** | **68%** |

### Painel Inicial — detalhe (o que foi pedido explicitamente)
`DashboardView.tsx` (cards de Assistente IA, Produtos, Saldo Consolidado, Lançamentos
Manuais, Relatórios Rápidos, Central de Relatórios, Rankings, Fluxo de Caixa, A Receber,
Financeiro Pessoal, Necessidade de Compras, Estoque de Solados/Palmilhas, Débitos/Créditos
de Clientes e Fornecedores, Valor em Estoque, Lembretes, Cheques, Lucro Estimado,
Atividade Recente, Central de Impressão, atalhos de Produção/PCP e o Scanner Rápido) está
**100% coberto** (68/71 — os 3 restantes são backdrops/wrappers sem ação própria).
Os 3 cards "filhos" (`BusinessOverviewCard.tsx`, `CommissionToSellersCard.tsx`,
`ProviderServiceOrdersCard.tsx`), a tela `DashboardConfigView.tsx` ("Personalizar
Dashboard") e os popups de diagnóstico de estoque que abrem a partir do Dashboard
(`StockDiagnosticsModal`, `StockDuplicateDiagnosticModal`, `StockDuplicateBanner`,
`StockRepairBanner`, `StockEntryHistoryModal`) também estão completos — cada um só com
backdrops/wrappers sem ação própria como exceção. **Módulo Painel Inicial concluído.**

### Etapas da Seção 4 (plano por sessão — 30/08/2026)

Divisão do trabalho que falta em blocos do tamanho de uma sessão cada. Ordem sugerida
de cima pra baixo, mas dá pra pular pra qualquer etapa a qualquer momento — são
independentes entre si. Ao concluir uma etapa (arquivo 100% coberto + `FIELD_HELP`
escrito + typecheck/build passando), marque o `[x]` e atualize a tabela de módulos acima.

- [x] **Etapa 0 — Painel Inicial (Dashboard)** — `DashboardView.tsx` (68/71),
  `BusinessOverviewCard.tsx` (24/34), `CommissionToSellersCard.tsx` (10/10),
  `ProviderServiceOrdersCard.tsx` (24/25). ~126 pontos. **Concluída em 30/08/2026.**
- [x] **Etapa 0b — Painel Inicial, sobras** — `DashboardConfigView.tsx` (6/6),
  `StockDiagnosticsModal.tsx` (15/15), `StockDuplicateDiagnosticModal.tsx` (4/6),
  `StockDuplicateBanner.tsx` (1/1), `StockRepairBanner.tsx` (1/1),
  `StockEntryHistoryModal.tsx` (3/3). **Concluída em 30/08/2026 — módulo Painel Inicial
  fechado em 91% (156/172, o resto são backdrops/wrappers sem ação própria).**
- [x] **Etapa 1 — PCP, mapa de produção** — `PCPView.tsx` (240/265 — os 25 restantes são
  backdrops de popup e wrappers `stopPropagation()` sem ação própria, sem contar como
  gap real). 179 anchors novos + entradas em `FIELD_HELP` correspondentes.
  **Concluída em 31/08/2026.**
- [x] **Etapa 2 — Produção / Engenharia** — `ProductionConfigView.tsx` (108/125 — o
  resto são backdrops/wrappers `stopPropagation()`), `EngineeringEditor.tsx` (34/34),
  `CompletedServiceOrdersModal.tsx` (26/32), `MaterialFormFields.tsx` (15/15),
  `ProductionEngineeringView.tsx` (7/8), `ProductionOrderModal.tsx` (6/7),
  `ConsumptionCalculatorModal.tsx` (5/5), `PackagingBuilderModal.tsx` (4/5),
  `EngineeringModal.tsx` (4/4), `EngineeringPickerModal.tsx` (3/4),
  `GradeBuilderModal.tsx` (3/4), `ProductCostSummaryModal.tsx` (3/4),
  `ProductSheetMenuView.tsx` (4/4), `PCPFilterModal.tsx` (2/2). ~185 anchors novos +
  entradas em `FIELD_HELP` correspondentes. **Concluída em 31/08/2026.**
- [x] **Etapa 3 — Solados / Palmilhas / Insumos** — `SoleStockView.tsx` (29/34),
  `WeighingView.tsx` (26/31), `SoleReceiptView.tsx` (18/20 — já tinha `soleReceipt.confirmar`
  de antes), `SolePurchaseModal.tsx` (9/10), `PalmilhaPurchaseModal.tsx` (9/10),
  `SolePurchaseView.tsx` (7/9 — já tinha `solePurchase.confirmar` de antes),
  `PrintSoleLabelModal.tsx` (9/9), `PalmilhaStockView.tsx` (9/11),
  `SoleNeedsFormModal.tsx` (5/6 — o resto em cada arquivo são backdrops/wrappers
  `stopPropagation()` sem ação própria). 106 anchors novos + entradas em `FIELD_HELP`
  correspondentes. **Concluída em 31/08/2026.**
- [x] **Etapa 4a — Etiquetas / Impressão, parte 1** — `PrintLabelEditorModal.tsx` (72/84 —
  os 12 restantes são backdrops/wrappers `stopPropagation()` sem ação própria),
  `LabelEditorView.tsx` (69/69), `PrintCenterView.tsx` (41/41). 182 anchors novos + entradas
  em `FIELD_HELP` correspondentes (137 delas realmente novas — `labelEditor.travarArea` já
  existia de antes). Etapa 4b (o resto do módulo Etiquetas/Impressão) ainda falta.
  **Concluída em 31/08/2026.**
- [x] **Etapa 4b — Etiquetas / Impressão, parte 2** — `PdfPageSelectModal.tsx` (42/42),
  `PrintOSModal.tsx` (28/30), `LabelPrintPreviewModal.tsx` (15/15),
  `LabelPrintStudioView.tsx` (14/14), `PrintLabelModal.tsx` (12/12),
  `LabelProfilePickerModal.tsx` (7/9), `PrinterConnectionCard.tsx` (7/7),
  `PrintDocumentModal.tsx` (5/6), `LabelEditor.tsx` (2/2 — os restantes nos arquivos acima
  são backdrops/wrappers `stopPropagation()` sem ação própria). 132 anchors novos + entradas
  em `FIELD_HELP` correspondentes. **Concluída em 31/08/2026 — fecha o módulo
  Etiquetas/Impressão em 95% (314/331).**
- [x] **Etapa 5 — Vendas, sobras** — `ExportNoteModal.tsx` (55/63), `SaleFormView.tsx`
  (77/76), `SalesView.tsx` (155/158), `SalePaymentModal.tsx` (9/9), `PasteOrderModal.tsx`
  (15/15), `ConsolidatedMessageModal.tsx` (6/7), `SeparacaoCaixasModal.tsx` (5/7),
  `NavigationProviderModal.tsx` (4/6), `DeliveryItemsPicker.tsx` (5/5),
  `PartialPaymentModal.tsx` (5/5 — o resto em cada arquivo são backdrops/wrappers
  `stopPropagation()` sem ação própria). 145 anchors novos + entradas em `FIELD_HELP`
  correspondentes. **Concluída em 31/08/2026 — fecha o módulo Vendas em 96% (336/351).**
- [x] **Etapa 6 — Compras** — `PurchaseNeedsView.tsx` (20/26), `GeneralReceiptsView.tsx`
  (25/26), `PurchasesView.tsx` (22/26), `PurchaseFormView.tsx` (63/57 — anchors de
  container cobrindo mais de um onClick), `AddPurchaseEntriesModal.tsx` (8/9),
  `PurchaseNeedsModal.tsx` (5/7 — o resto em cada arquivo são backdrops/wrappers
  `stopPropagation()` sem ação própria). 101 anchors novos + entradas em `FIELD_HELP`
  correspondentes (99 novas). `GeneralReceiptsView.tsx` e `PurchaseNeedsView.tsx` foram
  recategorizados de Solados e PCP para Compras na tabela acima, por pertencerem
  funcionalmente ao módulo. **Concluída em 31/08/2026 — fecha o módulo Compras em 95%
  (143/151).**
- [x] **Etapa 7 — Cadastros (Produtos/Categorias/Cores/Grades/Pessoas)** —
  `ProductFormView.tsx` (56/57), `CategoriesView.tsx` (13/13), `PeopleView.tsx` (10/10),
  `PersonModal.tsx` (8/10), `GradeModal.tsx` (9/9), `ProductsView.tsx` (8/9),
  `ColorsView.tsx` (7/7), `GradesView.tsx` (7/7), `ProductCreationChoiceModal.tsx` (3/3),
  `CategoryConfigView.tsx` (3/3), `CategoryModal.tsx` (3/3), `ColorModal.tsx` (2/2),
  `PersonDetailView.tsx` (1/1 — o resto em cada arquivo são backdrops/wrappers
  `stopPropagation()` sem ação própria). 118 anchors novos + entradas em `FIELD_HELP`
  correspondentes (105 novas). **Concluída em 31/08/2026 — fecha o módulo Cadastros em
  97% (130/134).**
- [ ] **Etapa 8 — Financeiro + Estoque (produtos prontos)** — `StockView.tsx` (44),
  `StockGlanceView.tsx` (30), `FinancialView.tsx` (22), `PersonalFinancialView.tsx` (22),
  `TransactionModal.tsx` (12), `FinancialQueryModal.tsx` (9), `ChecksModal.tsx` (6),
  `ReportDetailedView.tsx` (7), `AccountsView.tsx` (5), `PersonalContactModal.tsx` (4),
  `AccountModal.tsx` (3), `PaymentMethodsView.tsx` (3), `BudgetModal.tsx` (3),
  `TransferToPersonalModal.tsx` (3), `FamilyMemberModal.tsx` (2), `ReportsView.tsx` (2),
  `PaymentMethodModal.tsx` (1), `FinancialHistoryModal.tsx` (1). ~179 pontos.
- [ ] **Etapa 9 — Entregas** — `DeliveryRouteDetailView.tsx` (23),
  `DeliveryRouteBuilderView.tsx` (20), `DeliveryExportModal.tsx` (9),
  `DeliveryAddressForm.tsx` (7), `DeliveryPrintConfigView.tsx` (6),
  `DeliveryCarriersView.tsx` (3), `DeliveryNavPreferencesView.tsx` (3),
  `DeliveryMap.tsx` (2), `DeliveryMapGL.tsx` (1). ~74 pontos.
- [ ] **Etapa 10 — Bling** — `BlingPickingExportModal.tsx` (19),
  `BlingProductMappingView.tsx` (15), `BlingStockView.tsx` (13), `BlingHealthView.tsx`
  (10), `BlingDevolucoesView.tsx` (9), `BlingInvoiceEmissionView.tsx` (9),
  `BlingConnectionView.tsx` (8), `BlingInvoicesView.tsx` (7), `BlingPickingListView.tsx`
  (6). ~96 pontos.
- [ ] **Etapa 11 — Colaboradores / Sistema / Configurações + App.tsx +
  Componentes Genéricos** — `SettingsView.tsx` (32), `App.tsx` (26),
  `CollaboratorsConfigView.tsx` (21), `CollaboratorGateView.tsx` (11), `DateTimePicker.tsx`
  (9), `BackupView.tsx` (9), `ComboBox.tsx` (6), `LoginView.tsx` (5),
  `DatePickerPopover.tsx` (5), `DataCleanupView.tsx` (4), `CompanyProfileView.tsx` (4),
  `StepWizardBar.tsx` (4), `Modal.tsx` (3), `WebCameraScanner.tsx` (3), `ConfirmDialog.tsx`
  (2), `ImageSourcePickerModal.tsx` (2), `ModuleConfigView.tsx` (2),
  `OnboardingWelcomeView.tsx` (2), `ScannerModal.tsx` (2), `DatePicker.tsx` (1),
  `PedidosClientesPanel.tsx` (1), `ToastContainer.tsx` (1). ~155 pontos.
- [ ] **Etapa 12 — Assistente de IA + sobras de Ferramentas Extras/Central de Ajuda** —
  `AIAssistantModal.tsx` (23), `AIAssistantSettings.tsx` (20), `CalculatorPopover.tsx`
  (14), `ReminderPickerModal.tsx` (14), `RuleOfThreeView.tsx` (11), `HelpCenterModal.tsx`
  (6), `CalculatorModal.tsx` (3), `OcrTextExtractorView.tsx` (3), `AIQuickPrompts.tsx`
  (1), `DraggableHelpPoint.tsx` (1). ~96 pontos.
- [ ] **Etapa 13 — Ordens de Serviço / Provedores avulsos** —
  `ServiceOrderFormView.tsx` (13), `ProviderServiceReportFormModal.tsx` (8). ~21 pontos
  — pequeno, bom pra encaixar no fim de outra sessão.

Somadas, as etapas 0b–13 cobrem os ~2029 pontos clicáveis restantes. Os números de
"pontos faltando" por arquivo podem mudar levemente entre sessões se o código for
alterado por outro motivo — reconfira com os comandos abaixo antes de começar cada etapa.

**Comando pra reconferir a qualquer momento** (não precisa decorar, só rodar):
```
grep -rc "onClick=" src --include="*.tsx" | grep -v ":0$"
grep -rc "data-guide-anchor" src --include="*.tsx" | grep -v ":0$"
```
Compare as duas listas por arquivo pra saber onde falta. **Atenção a um falso-positivo
conhecido:** componentes que recebem a âncora via prop (ex.: `ConfigMenuItem` recebe
`anchor="algumaCoisa"` e ele mesmo é quem grava `data-guide-anchor` no botão interno) não
aparecem no grep do arquivo que os chama — antes de contar como gap, confira se o
`onClick` "sem anchor" não é, na verdade, repassado assim pra um componente filho.

---

## Como usar este arquivo

- Ao fechar um tópico de ajuda, tour ou lote de anchors, marque a linha correspondente
  aqui no mesmo commit/sessão.
- Se adicionar uma tela nova (`ViewType` novo), adicione uma linha nova na seção 1
  (e na seção 2 se for tela de cadastro).
- Se adicionar um `data-guide-anchor` novo (com ou sem tour), adicione a explicação em
  `FIELD_HELP` e atualize a contagem da área correspondente na seção 3.
- Reordene/agrupe à vontade — a estrutura é só um ponto de partida, não uma regra fixa.

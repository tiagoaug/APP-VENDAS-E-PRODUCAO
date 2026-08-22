# SPEC — Assistente Local (Guia de Cadastros + Ajuda Contextual Offline)

> **Projeto:** App Vendas e Produção de Calçados (Android / Kotlin)
> **Documento para:** Agente Antigravity (condução do desenvolvimento)
> **Local sugerido:** `docs/SPEC_ASSISTENTE_LOCAL.md`
> **Status:** Especificação inicial — v1.0
> **Dependência de internet:** NENHUMA. Todo o assistente funciona 100% offline.

---

## 1. Visão Geral

Criar um **Assistente Local** embutido no aplicativo com três responsabilidades:

1. **Onboarding Guiado (Recepção):** um roteiro passo a passo, didático e conversacional, que conduz o usuário novo por todos os cadastros necessários para deixar o programa operacional — do zero até o primeiro produto completo cadastrado.
2. **Ajuda Contextual ("Ajuda sobre esta tela"):** em qualquer tela do app, um botão de ajuda abre o assistente já sabendo onde o usuário está, explicando aquela tela específica com texto + screenshot de referência.
3. **Banco de Sugestões de Categorias:** categorias pré-cadastradas (despesas, receitas, produtos, gerais) que o usuário pode aceitar com um toque ou substituir/complementar com as suas próprias.

### 1.1 Por que NÃO é um LLM (decisão de arquitetura)

O assistente é uma **IA simbólica/determinística**: uma base de conhecimento local (JSON empacotado no APK + Room) + máquina de estados de roteiro + busca por palavras-chave. Motivos:

- Funciona offline sempre, sem download de modelo (LLMs on-device custam 1–4 GB).
- Respostas 100% previsíveis e auditáveis — essencial em software de gestão.
- Zero latência, zero consumo de bateria relevante.
- A base de conhecimento é a MESMA que documenta o manual — manutenção única.

> **Fase futura (opcional, fora do escopo v1):** plugar um modelo on-device (ex.: Gemma 2B via MediaPipe LLM Inference) usando esta mesma base de conhecimento como contexto (RAG local). A arquitetura abaixo já deixa o ponto de extensão pronto (`AssistantBackend` como Strategy).

---

## 2. Arquitetura (padrão do projeto: Engine isolado + Strategy + StateFlow)

```
assistant/
├── engine/
│   ├── AssistantEngine.kt          // Núcleo. Funções puras + StateFlow. Sem Android deps.
│   ├── AssistantBackend.kt         // interface (Strategy) — v1: RuleBasedBackend
│   ├── RuleBasedBackend.kt         // matching por intents/keywords na KB local
│   ├── OnboardingFlowEngine.kt     // máquina de estados do roteiro de cadastros
│   └── model/
│       ├── AssistantMessage.kt     // sealed class: BotText, BotImage, BotOptions, UserReply, ActionChip
│       ├── OnboardingStep.kt
│       ├── HelpTopic.kt
│       └── Intent.kt
├── kb/                             // Base de conhecimento (assets)
│   ├── knowledge_base.json         // tópicos de ajuda por tela + FAQ + sinônimos
│   ├── onboarding_script.json      // roteiro completo do onboarding
│   └── categories_seed.json        // banco de sugestões de categorias
├── data/
│   ├── AssistantRepository.kt      // carrega KB dos assets, cache em memória
│   └── OnboardingStateDao.kt       // Room: progresso do onboarding (retomável)
└── ui/
    ├── AssistantSheetFragment.kt   // BottomSheet estilo chat (usado na ajuda contextual)
    ├── OnboardingActivity.kt       // fluxo de recepção em tela cheia
    └── HelpFabDelegate.kt          // injeta o botão "?" em qualquer tela
```

### 2.1 Regras de isolamento (obrigatórias)

- `AssistantEngine` e `OnboardingFlowEngine` **não importam nada de Android** — apenas Kotlin puro + coroutines. Toda saída via `StateFlow<AssistantUiState>`.
- Backend por Strategy: `interface AssistantBackend { suspend fun answer(query: String, context: ScreenContext): AssistantResponse }`. v1 implementa `RuleBasedBackend`. Futuro: `LocalLlmBackend`.
- **Flag modular central** (padrão do projeto): `FeatureFlags.ASSISTANT_ENABLED`, `FeatureFlags.ONBOARDING_ENABLED`, `FeatureFlags.CONTEXTUAL_HELP_ENABLED`. Desligar a flag remove FAB, menus e deep links sem quebrar build.

### 2.2 ScreenContext — como o assistente sabe onde o usuário está

Cada tela registra-se com um ID estável:

```kotlin
enum class ScreenId(val key: String) {
    HOME("home"),
    PRODUTO_LISTA("produto_lista"),
    PRODUTO_CADASTRO("produto_cadastro"),
    MATERIAL_CADASTRO("material_cadastro"),
    GRADE_TAMANHOS("grade_tamanhos"),
    CORES("cores"),
    CATEGORIAS("categorias"),
    FORNECEDOR_CADASTRO("fornecedor_cadastro"),
    CLIENTE_CADASTRO("cliente_cadastro"),
    PEDIDO_VENDA("pedido_venda"),
    ORDEM_PRODUCAO("ordem_producao"),
    FINANCEIRO_DESPESAS("financeiro_despesas"),
    FINANCEIRO_RECEITAS("financeiro_receitas"),
    ESTOQUE("estoque"),
    RELATORIOS("relatorios"),
    CONFIGURACOES("configuracoes")
    // Antigravity: completar com TODAS as telas reais do app ao implementar
}
```

- Um `BaseFragment`/`BaseActivity` expõe `open val screenId: ScreenId`.
- `HelpFabDelegate` lê o `screenId` atual e abre `AssistantSheetFragment` já filtrado no `HelpTopic` daquela tela.
- O botão de ajuda: ícone "?" na toolbar (padrão) OU FAB secundário — decidir por tela; nunca cobrir botões de ação primária.

---

## 3. Onboarding Guiado — Roteiro de Recepção

### 3.1 Princípios de UX (obrigatórios)

- **Tom conversacional e natural**, uma pergunta por vez. Nunca formulário gigante.
- Cada passo mostra: mensagem do assistente → campo(s) simples → botões de resposta rápida quando aplicável.
- **Sempre retomável:** progresso salvo no Room a cada passo (`OnboardingStateDao`). Se fechar o app, retoma de onde parou.
- **Sempre pulável:** botão "Pular por agora" em todo passo não-crítico; passo pulado entra numa lista de "Pendências" na Home.
- Barra de progresso com etapas nomeadas (ex.: "Etapa 3 de 7 — Materiais").
- Ao final de cada etapa, mini-resumo: "✅ Você cadastrou 4 cores e 2 grades. Vamos para os materiais?"

### 3.2 Ordem do roteiro (dependências de um produto completo)

Um produto de calçado no sistema depende de cadastros-base. O roteiro segue a ordem de dependência:

| Etapa | Cadastro | Por que antes | Crítico? |
|---|---|---|---|
| 1 | **Dados da empresa** (nome, logo, contato) | Aparece em pedidos/PDF | Não |
| 2 | **Categorias** (produtos, despesas, receitas, gerais) | Classificam tudo | Sim |
| 3 | **Cores** | Compõem variações do produto | Sim |
| 4 | **Grades de tamanho** (ex.: 34–39, 38–43, infantil) | Compõem variações | Sim |
| 5 | **Materiais/Insumos** (couro, sola, cadarço, cola...) + unidade e custo | Ficha técnica e custo do produto | Sim |
| 6 | **Fornecedores** | Vinculados aos materiais/compras | Não |
| 7 | **Produto completo** (modelo + categoria + cores + grade + ficha técnica + preço) | Objetivo final | Sim |
| 8 | **Formas de pagamento e condições** | Necessário para vender | Sim |
| 9 | **Clientes** (ao menos 1 ou "Consumidor Final") | Necessário para vender | Não |
| 10 | **Estoque inicial** (opcional: lançar saldo atual) | Ponto de partida real | Não |

> **Antigravity:** validar essa lista contra as entidades reais do banco do app. Se existir entidade que compõe produto e não está aqui (ex.: marca, linha, solado como entidade própria), inserir na posição correta de dependência e atualizar `onboarding_script.json`.

### 3.3 Formato do roteiro — `onboarding_script.json`

O roteiro é **dado, não código**. A `OnboardingFlowEngine` apenas interpreta:

```json
{
  "version": 1,
  "steps": [
    {
      "id": "welcome",
      "type": "message",
      "text": "Olá! 👋 Eu sou o assistente do programa. Vou te acompanhar na configuração inicial. Em poucos minutos você terá seu primeiro produto pronto para vender. Vamos começar?",
      "options": [
        { "label": "Vamos lá!", "goto": "empresa_nome" },
        { "label": "Já uso o programa, pular guia", "goto": "finish_skip" }
      ]
    },
    {
      "id": "empresa_nome",
      "type": "input_text",
      "text": "Primeiro, como se chama a sua empresa ou marca?",
      "field": "empresa.nome",
      "validation": { "required": true, "minLength": 2 },
      "goto": "categorias_intro"
    },
    {
      "id": "categorias_intro",
      "type": "message",
      "text": "Agora vamos organizar as categorias. Elas classificam seus produtos, despesas e receitas — e deixam os relatórios muito mais úteis. Preparei sugestões prontas: é só marcar as que fizerem sentido para você.",
      "options": [ { "label": "Ver sugestões", "goto": "categorias_produtos_pick" } ]
    },
    {
      "id": "categorias_produtos_pick",
      "type": "multi_select_seed",
      "text": "Quais categorias de PRODUTOS você quer usar? Marque as sugestões ou crie as suas:",
      "seedRef": "categories_seed.json#produtos",
      "allowCustom": true,
      "persistAction": "insertCategorias(tipo=PRODUTO)",
      "goto": "categorias_despesas_pick"
    }
  ]
}
```

Tipos de passo suportados pela engine (v1): `message`, `input_text`, `input_number`, `single_select`, `multi_select_seed`, `entity_form` (abre o formulário real do app em modo guiado e retorna), `summary`, `finish`.

> **Importante:** nos passos de cadastro pesado (produto, material), o assistente **abre a tela real do app** (`entity_form`) em **Modo Guiado** (seção 3.5), em vez de duplicar formulário dentro do chat. Assim o usuário aprende a tela verdadeira.

### 3.5 Modo Guiado — feedback visual campo a campo (spotlight)

Quando um passo `entity_form` abre uma tela real, ela entra em **Modo Guiado**: um overlay conduz o usuário campo por campo, com destaque visual de exatamente onde ele deve preencher agora.

**Comportamento visual:**

1. **Scrim + Spotlight:** a tela inteira recebe uma camada escura semitransparente (scrim ~60%) e apenas o campo da vez fica "recortado" e iluminado (spotlight com cantos arredondados + leve pulso/glow animado). O resto da tela fica visível porém atenuado — o usuário vê o contexto, mas o olho vai direto ao campo certo.
2. **Balão do assistente:** ancorado ao campo destacado (acima ou abaixo, conforme espaço), com a instrução em linguagem natural: *"Digite aqui o nome do modelo. Ex.: Tênis Casual Urban."* Inclui o avatar/ícone do assistente para manter a identidade da recepção.
3. **Foco automático:** ao destacar um campo de texto, o teclado abre já focado nele; ao destacar um seletor (categoria, cor, grade), o toque no spotlight abre o seletor real.
4. **Auto-scroll:** se o campo estiver fora da viewport, a tela rola suavemente até centralizá-lo antes do spotlight aparecer.
5. **Feedback de conclusão:** ao preencher válido, o campo ganha um check verde ✓ e uma micro-animação; o spotlight desliza para o próximo campo da sequência.
6. **Validação em tempo real:** se o valor for inválido, o balão troca para tom de correção (borda âmbar): *"Ops — o preço precisa ser maior que zero."* Sem modal, sem interromper.
7. **Controles do balão:** `Próximo` (só habilita quando o campo obrigatório está válido), `Voltar`, `Pular campo` (apenas campos opcionais) e `Sair do guia` (com confirmação; salva rascunho).
8. **Barra fina de progresso do formulário** no topo (ex.: "Campo 3 de 8").
9. Ao concluir o formulário, retorna ao fluxo do chat com o resumo humano: *"✅ Produto 'Tênis Casual Urban' criado!"*

**Arquitetura:**

```
assistant/ui/guided/
├── GuidedFormOverlay.kt        // View de overlay: scrim + spotlight + balão. Desenha por cima da tela real.
├── GuidedFormController.kt     // Lê a sequência de campos do JSON, controla avanço/validação
├── FieldAnchorRegistry.kt      // Mapeia fieldKey -> View real da tela (via viewId ou tag)
└── SpotlightShape.kt           // Recorte (rect arredondado / circle) + animação de pulso
```

- **`FieldAnchorRegistry`:** cada tela guiável registra seus campos com chaves estáveis: `registry.bind("produto.nome", binding.etNomeProduto)`. O overlay localiza a View pelo `fieldKey`, mede posição/tamanho na tela (`getLocationInWindow`) e posiciona spotlight + balão. Nada de coordenadas fixas — sempre medido em runtime (funciona em qualquer resolução/fonte).
- O overlay é adicionado ao `decorView` (ou um `FrameLayout` raiz), **sem modificar o layout da tela** — o Modo Guiado é 100% removível pela flag sem tocar nas telas.
- A tela real não sabe que está em modo guiado, exceto pelo registro de anchors no `BaseFragment` (função `registerGuidedAnchors(registry)` opcional).
- Recomendação: implementar o spotlight próprio (é ~200 linhas: `Canvas` com `PorterDuff.CLEAR` no recorte) em vez de depender de lib externa tipo TapTargetView — controle total da animação e zero dependência.

**A sequência de campos é dado, no `onboarding_script.json`:**

```json
{
  "id": "produto_form_guiado",
  "type": "entity_form",
  "screen": "produto_cadastro",
  "guidedFields": [
    { "fieldKey": "produto.nome",      "text": "Digite o nome do modelo. Ex.: Tênis Casual Urban.", "required": true },
    { "fieldKey": "produto.categoria", "text": "Escolha a categoria. Você criou elas há pouco, lembra? 😉", "required": true },
    { "fieldKey": "produto.cores",     "text": "Marque as cores disponíveis deste modelo.", "required": true },
    { "fieldKey": "produto.grade",     "text": "Selecione a grade de tamanhos.", "required": true },
    { "fieldKey": "produto.ficha",     "text": "Monte a ficha técnica: quais materiais compõem este calçado e em que quantidade.", "required": false, "skipLabel": "Montar depois" },
    { "fieldKey": "produto.preco",     "text": "Defina o preço de venda. O custo calculado pela ficha aparece logo abaixo para te ajudar na margem.", "required": true }
  ],
  "onComplete": { "goto": "produto_resumo" }
}
```

**Reuso além do onboarding:** o mesmo `GuidedFormOverlay` serve para a ajuda contextual — na resposta de um `HelpTopic`, um `ActionChip` "Me mostre na tela" pode disparar o tour guiado daquela tela a qualquer momento, não só na recepção.

### 3.4 Perguntas naturais — diretrizes de escrita

- Falar como um colega experiente, não como manual: "Todo calçado precisa de uma grade de tamanhos. Você vende mais adulto ou infantil?"
- Explicar o PORQUÊ em uma frase antes de pedir o dado.
- Confirmar em linguagem humana: "Perfeito — 'Tênis Casual' criado na categoria Tênis, cores Preto e Branco, grade 38–43."
- Nunca usar jargão do banco de dados (ex.: dizer "grade de tamanhos", não "SKU matrix").

---

## 3-A. Perfis de Operação — Modo Revenda × Modo Revenda + Produção

O programa opera em **dois perfis**, escolhidos logo no início do onboarding (e alteráveis depois em Configurações). O perfil filtra TODO o conteúdo do assistente: roteiro de recepção, tours guiados, tópicos de ajuda e seeds de categorias.

```kotlin
enum class OperationProfile { REVENDA, REVENDA_PRODUCAO }
```

| | **REVENDA** | **REVENDA_PRODUCAO** |
|---|---|---|
| Público | Compra pronto e revende | Fabrica (ou fabrica + revende) |
| Onboarding | Enxuto: empresa → categorias → cores/grades → produtos (custo = preço de compra) → fornecedores → pagamento → clientes | Robusto: tudo do Revenda **+** materiais/insumos, ficha técnica, custo calculado, ordens de produção, embalagens de produção |
| Produto | Custo digitado (preço de compra) | Custo calculado pela ficha técnica |
| Tours extras | Venda, entrada de compra, embalagem de envio | + Ordem de produção, apontamento, embalagem de produção |
| Categorias seed | Sem grupo "Matéria-prima / Produção" | Seeds completos |

**Regras:**
- O perfil é salvo em `SettingsRepository.operationProfile` (DataStore). Primeira pergunta prática do onboarding: *"Como funciona o seu negócio? 🏪 Só revendo produtos prontos / 🏭 Eu fabrico (ou fabrico e revendo)"*.
- Trocar de perfil depois NUNCA apaga dados — apenas mostra/oculta módulos e conteúdos de guia. Ao mudar de REVENDA → REVENDA_PRODUCAO, o assistente oferece o mini-onboarding só dos passos novos (materiais, ficha técnica, produção).
- Todo item de conteúdo (step, tour, topic, seed) declara `"modes": ["REVENDA", "REVENDA_PRODUCAO"]`. Omitido = vale para ambos. A engine filtra na carga.

```json
{
  "id": "materiais_intro",
  "modes": ["REVENDA_PRODUCAO"],
  "type": "message",
  "text": "Como você fabrica, vamos cadastrar os materiais (couro, solado, cola...). Com eles, o programa calcula o custo real de cada par automaticamente."
}
```

> **Antigravity:** o filtro por `modes` deve estar em UM único ponto (`AssistantRepository.load()`), nunca espalhado em `if`s pela UI. Módulos inteiros do app (ex.: Ordens de Produção) também respeitam o perfil via flag derivada: `FeatureFlags.PRODUCTION_MODULE = (profile == REVENDA_PRODUCAO)`.

---

## 3-B. Tours Guiados de Processo (Guided Journeys) — o guia para TODO o programa

O Modo Guiado (3.5) não serve só para o onboarding: ele vira um **sistema de tours** que ensina qualquer processo operacional do programa, atravessando múltiplas telas — como fazer uma venda, gravar a embalagem de um produto, dar entrada numa compra, abrir uma ordem de produção.

### Diferença entre os dois tipos de guia

| | Onboarding (3.3) | Tour de Processo (3-B) |
|---|---|---|
| Quando | Primeira configuração | Qualquer momento, sob demanda |
| Escopo | Cadastros-base | Fluxos operacionais completos |
| Telas | Principalmente formulários | **Atravessa várias telas** (lista → formulário → confirmação) |
| Acesso | Automático na recepção | Menu "Guias" no assistente + chip "Me mostre como" na ajuda contextual |

### Arquitetura: `journeys.json` (assets/kb/)

Um tour é uma sequência de passos que mistura **navegação**, **destaque de elemento** e **preenchimento guiado** — mesma `GuidedFormOverlay`, novo controlador:

```json
{
  "version": 1,
  "journeys": [
    {
      "id": "tour_fazer_venda",
      "title": "Como fazer uma venda",
      "modes": ["REVENDA", "REVENDA_PRODUCAO"],
      "entryScreen": "home",
      "steps": [
        { "type": "highlight_tap", "screen": "home", "anchorKey": "menu.vendas",
          "text": "Toque aqui para abrir as Vendas." },
        { "type": "highlight_tap", "screen": "pedido_venda_lista", "anchorKey": "fab.nova_venda",
          "text": "Este botão cria um novo pedido de venda." },
        { "type": "guided_field", "screen": "pedido_venda", "fieldKey": "venda.cliente",
          "text": "Escolha o cliente — ou use 'Consumidor Final' para venda de balcão." },
        { "type": "guided_field", "screen": "pedido_venda", "fieldKey": "venda.itens",
          "text": "Adicione os produtos: modelo, cor e tamanho. O estoque daquela variação aparece aqui." },
        { "type": "guided_field", "screen": "pedido_venda", "fieldKey": "venda.pagamento",
          "text": "Defina a forma e condição de pagamento." },
        { "type": "highlight_tap", "screen": "pedido_venda", "anchorKey": "btn.finalizar",
          "text": "Finalize. O estoque baixa automaticamente e a receita entra no financeiro. 🎉" }
      ]
    },
    {
      "id": "tour_embalagem_produto",
      "title": "Como gravar a embalagem de um produto",
      "modes": ["REVENDA", "REVENDA_PRODUCAO"],
      "entryScreen": "produto_lista",
      "steps": [
        { "type": "highlight_tap", "screen": "produto_lista", "anchorKey": "item.produto",
          "text": "Abra o produto que você quer configurar." },
        { "type": "highlight_tap", "screen": "produto_cadastro", "anchorKey": "tab.embalagem",
          "text": "Aqui ficam os dados de embalagem." },
        { "type": "guided_field", "screen": "produto_embalagem", "fieldKey": "emb.tipo",
          "text": "Escolha o tipo: caixa individual, saco, caixa master..." },
        { "type": "guided_field", "screen": "produto_embalagem", "fieldKey": "emb.dimensoes",
          "text": "Informe comprimento, largura e altura (cm). Esses dados alimentam o frete dos marketplaces (Mercado Livre/Shopee via Bling)." },
        { "type": "guided_field", "screen": "produto_embalagem", "fieldKey": "emb.peso",
          "text": "Peso com embalagem (kg) — o peso que a transportadora cobra." },
        { "type": "guided_field", "screen": "produto_embalagem", "fieldKey": "emb.custo",
          "text": "Custo da embalagem por unidade. Ele entra no custo total do produto.", "required": false }
      ]
    },
    {
      "id": "tour_ordem_producao",
      "title": "Como abrir uma ordem de produção",
      "modes": ["REVENDA_PRODUCAO"],
      "entryScreen": "ordem_producao",
      "steps": [ "..." ]
    }
  ]
}
```

**Tipos de passo do tour:** `highlight_tap` (spotlight num botão/menu; avança quando o usuário toca no alvo real), `guided_field` (idem 3.5), `navigate_auto` (app navega sozinho com animação, para atalhos), `message` (balão informativo sem alvo), `checkpoint` (confirma que uma condição existe — ex.: "você precisa ter ao menos 1 produto; quer cadastrar agora?" → encadeia outro tour).

### `JourneyController`

```
assistant/ui/guided/
├── JourneyController.kt   // Orquestra passos entre telas; sobrevive a navegação
└── JourneyProgressStore.kt // Room: tours concluídos/abandonados (retomável)
```

- O controller vive num escopo acima das telas (ex.: `ActivityRetainedScope`/singleton observando `NavController`). Ao mudar de destino, verifica se o passo atual pertence à nova tela e reanexa o overlay.
- `highlight_tap` intercepta o toque **apenas dentro do recorte do spotlight** — o resto da tela fica bloqueado durante o passo (evita o usuário se perder), com botão "Sair do guia" sempre visível.
- `checkpoint` consulta os repositórios reais (ex.: `produtoRepository.count() > 0`). Tours podem se encadear: o tour de venda pode puxar o de cadastro de produto se não houver nenhum.
- Tours concluídos ganham ✓ no menu "Guias"; o assistente pode sugerir o próximo tour lógico ao final ("Agora que você fez uma venda, quer aprender a gravar a embalagem para envio?").

### Menu "Guias" (catálogo de tours)

Dentro do `AssistantSheetFragment`, aba **Guias**: lista de todos os journeys do perfil atual, com status (novo / concluído ✓), busca, e agrupamento por área (Cadastros, Vendas, Produção, Financeiro, Estoque). É a porta de entrada permanente do "como fazer" — o manual vivo do programa.

> **Antigravity — regra de ouro:** todo fluxo operacional relevante do app DEVE ter: (1) um journey em `journeys.json`, (2) um topic em `knowledge_base.json`, (3) uma seção no `MANUAL.md` com screenshot. Os três compartilham o mesmo vocabulário e IDs. Ao criar uma feature nova, esses 3 artefatos entram no mesmo PR (adicionar ao checklist).



Seed empacotado no APK. Na primeira execução (ou no passo do onboarding), o usuário marca as desejadas; podem ser editadas/excluídas depois, e ele pode criar novas a qualquer momento (o seed nunca sobrescreve categorias do usuário). **Itens exclusivos de produção declaram `"modes": ["REVENDA_PRODUCAO"]`** — ex.: "Matéria-prima / Insumos", "Mão de obra de Produção", "Manutenção de Máquinas", "Produção Própria" só aparecem nesse perfil; no perfil REVENDA entram no lugar "Compra de Mercadorias para Revenda" e "Revenda".

```json
{
  "version": 1,
  "produtos": [
    "Tênis", "Sapatênis", "Sapato Social", "Sapato Casual", "Bota", "Coturno",
    "Sandália", "Rasteirinha", "Chinelo", "Sapatilha", "Scarpin", "Mocassim",
    "Papete", "Tamanco", "Infantil", "Esportivo", "Segurança/EPI", "Acessórios (meias, palmilhas, cadarços)"
  ],
  "despesas": [
    "Matéria-prima / Insumos", "Mão de obra / Salários", "Pró-labore", "Frete e Entregas",
    "Embalagens", "Taxas de Marketplace (Mercado Livre, Shopee)", "Taxas de Cartão/Pix",
    "Impostos e Tributos", "Aluguel", "Energia Elétrica", "Água", "Internet e Telefone",
    "Manutenção de Máquinas", "Combustível", "Marketing e Anúncios", "Software e Assinaturas",
    "Material de Escritório", "Despesas Bancárias", "Outras Despesas"
  ],
  "receitas": [
    "Venda no Balcão / Loja Física", "Venda Mercado Livre", "Venda Shopee",
    "Venda WhatsApp / Direta", "Venda Atacado", "Encomenda / Sob Medida",
    "Serviços (conserto, customização)", "Frete Cobrado do Cliente", "Outras Receitas"
  ],
  "gerais": [
    "Clientes Varejo", "Clientes Atacado", "Fornecedores de Couro", "Fornecedores de Solado",
    "Fornecedores de Aviamentos", "Produção Própria", "Revenda", "Promoção / Liquidação",
    "Lançamento", "Linha Verão", "Linha Inverno"
  ]
}
```

> **Antigravity:** ajustar os nomes ao vocabulário já usado nas entidades do app (ex.: se o app chama "gerais" de "tags" ou "grupos", alinhar). Marketplace: manter alinhado ao contexto Bling/Mercado Livre/Shopee do projeto.

---

## 5. Ajuda Contextual — `knowledge_base.json`

Um tópico por tela + FAQ transversal. Cada tópico referencia o **screenshot oficial da tela** (mesmo asset usado no manual — fonte única).

```json
{
  "version": 1,
  "topics": [
    {
      "screenId": "produto_cadastro",
      "title": "Cadastro de Produto",
      "screenshot": "manual/screenshots/produto_cadastro.png",
      "summary": "Aqui você cria um produto completo: modelo, categoria, cores, grade de tamanhos, ficha técnica de materiais e preço de venda.",
      "sections": [
        { "heading": "Passo a passo", "body": "1. Informe o nome do modelo...\n2. Escolha a categoria...\n3. Selecione as cores...\n4. Escolha a grade...\n5. Monte a ficha técnica...\n6. Defina o preço..." },
        { "heading": "Campos obrigatórios", "body": "Nome, categoria e grade são obrigatórios. Sem grade, o estoque por tamanho não funciona." },
        { "heading": "Dicas", "body": "O custo é calculado automaticamente pela ficha técnica de materiais. Cadastre os materiais antes." }
      ],
      "keywords": ["produto", "modelo", "cadastrar produto", "novo produto", "criar tenis", "ficha tecnica", "preço", "custo"],
      "relatedScreens": ["material_cadastro", "grade_tamanhos", "cores", "categorias"]
    }
  ],
  "faq": [
    {
      "question": "Como o custo do produto é calculado?",
      "keywords": ["custo", "calculo", "preço de custo", "margem"],
      "answer": "O custo soma os materiais da ficha técnica (quantidade × custo unitário de cada insumo). Atualize o custo dos materiais para refletir no produto.",
      "linkScreen": "material_cadastro"
    }
  ]
}
```

### 5.1 Como o `RuleBasedBackend` responde

1. Usuário toca "?" → abre o tópico do `screenId` atual (resposta imediata, sem digitar nada).
2. Se o usuário digitar uma pergunta: normalizar (minúsculas, remover acentos), tokenizar, pontuar tópicos/FAQ por interseção de `keywords` + título (score simples TF por keyword; empate → priorizar tópico da tela atual).
3. Score abaixo do limiar → resposta honesta: "Não encontrei isso na ajuda. Veja os tópicos relacionados:" + lista das telas com maior score parcial. **Nunca inventar resposta.**
4. Toda resposta pode incluir `ActionChip` de navegação: "Ir para Cadastro de Materiais" (deep link interno).

---

## 6. Manual do Programa com Screenshots

### 6.1 Estrutura

```
docs/manual/
├── MANUAL.md                     // manual completo, seção por tela
├── screenshots/
│   ├── home.png
│   ├── produto_lista.png
│   ├── produto_cadastro.png
│   └── ... (uma imagem por ScreenId, mesmo nome do key)
└── CHANGELOG_MANUAL.md
```

### 6.2 Regras

- **Nome do arquivo = `ScreenId.key`** (`produto_cadastro.png`). Isso amarra manual ↔ KB ↔ app.
- Cada seção do `MANUAL.md` segue o template: Título → Screenshot → Para que serve → Passo a passo numerado → Campos e significados → Erros comuns → Telas relacionadas.
- Os screenshots são copiados para `app/src/main/assets/manual/screenshots/` no build (ou tarefa Gradle de cópia) para o assistente exibir offline.
- Resolução alvo: capturar em device 1080×2400, comprimir para WebP ≤ 150 KB cada.
- **Sempre que uma tela mudar visualmente, o PR deve atualizar o screenshot correspondente** (adicionar item no checklist de PR).

---

## 7. Arquivo de Compreensão do Agente — `docs/AGENT_CONTEXT.md`

Criar (e manter atualizado) um arquivo que o Antigravity consulta antes de qualquer tarefa neste módulo. Conteúdo mínimo:

```markdown
# AGENT_CONTEXT — Assistente Local

## O que é este módulo
Assistente offline determinístico (NÃO é LLM): onboarding guiado + ajuda contextual + seed de categorias.

## Invariantes (nunca violar)
1. Engines (`AssistantEngine`, `OnboardingFlowEngine`) sem dependências de Android.
2. Todo conteúdo (roteiro, ajuda, categorias) vive em JSON de assets — nunca hardcoded em Kotlin.
3. Backend via Strategy `AssistantBackend`; UI nunca conhece a implementação.
4. Flags: ASSISTANT_ENABLED / ONBOARDING_ENABLED / CONTEXTUAL_HELP_ENABLED desligam tudo sem quebrar build.
5. Nome de screenshot = ScreenId.key. Fonte única entre manual e KB.
6. O assistente nunca inventa resposta: sem match na KB → admite e sugere tópicos.
7. Onboarding retomável (Room) e pulável; nunca bloquear o uso do app.
8. Seed de categorias nunca sobrescreve dados criados pelo usuário.
9. Perfis: REVENDA e REVENDA_PRODUCAO filtram todo conteúdo via campo "modes" nos JSONs, em UM único ponto (AssistantRepository). Trocar de perfil nunca apaga dados.
10. Toda feature/fluxo operacional novo exige no MESMO PR: journey em journeys.json + topic em knowledge_base.json + seção no MANUAL.md com screenshot.
11. Tours (JourneyController) sobrevivem à navegação entre telas e são retomáveis; highlight_tap só libera toque dentro do spotlight, com "Sair do guia" sempre visível.

## Onde ficam as coisas
- Roteiro: assets/kb/onboarding_script.json
- Tours de processo: assets/kb/journeys.json
- Ajuda: assets/kb/knowledge_base.json
- Categorias: assets/kb/categories_seed.json
- Perfil de operação: SettingsRepository.operationProfile (DataStore)
- Manual: docs/manual/MANUAL.md + docs/manual/screenshots/

## Como adicionar uma tela nova (checklist)
1. Adicionar valor em ScreenId.
2. Expor screenId no Fragment/Activity (Base).
3. Capturar screenshot e salvar com o nome do key.
4. Escrever seção no MANUAL.md (template padrão).
5. Adicionar topic no knowledge_base.json com keywords.
6. Se a tela entrar no onboarding, adicionar step no onboarding_script.json.

## Dúvidas → onde consultar
1º este arquivo → 2º SPEC_ASSISTENTE_LOCAL.md → 3º MANUAL.md. Se ainda houver ambiguidade, perguntar ao Tiago antes de implementar.
```

---

## 8. Plano de Implementação (fases para o Antigravity)

**Fase 1 — Fundação (sem UI):**
`ScreenId` completo com telas reais · modelos · `AssistantRepository` carregando os 3 JSONs · `RuleBasedBackend` com matching + testes unitários do score.

**Fase 2 — Ajuda Contextual:**
`HelpFabDelegate` + `AssistantSheetFragment` (BottomSheet chat) · abrir tópico da tela atual · busca digitada · ActionChips de navegação · flag `CONTEXTUAL_HELP_ENABLED`.

**Fase 3 — Onboarding com Perfis:**
Pergunta de perfil (REVENDA / REVENDA_PRODUCAO) + `SettingsRepository.operationProfile` · filtro `modes` no `AssistantRepository` · `OnboardingFlowEngine` (máquina de estados dirigida pelo JSON) · persistência de progresso (Room) · passos `multi_select_seed` gravando categorias filtradas por perfil · **Modo Guiado completo (seção 3.5): `GuidedFormOverlay` com scrim/spotlight/balão, `FieldAnchorRegistry`, validação em tempo real e auto-scroll** · pendências na Home · mini-onboarding incremental na troca de perfil.

**Fase 4 — Tours de Processo (Journeys):**
`JourneyController` + `JourneyProgressStore` · tipos `highlight_tap`, `navigate_auto`, `checkpoint` e encadeamento de tours · `journeys.json` com os tours essenciais dos dois perfis (fazer venda, gravar embalagem, entrada de compra; produção: ordem de produção, apontamento) · aba "Guias" no assistente com status e agrupamento · chip "Me mostre como" na ajuda contextual.

**Fase 5 — Manual e Conteúdo:**
Capturar screenshots de todas as telas · escrever `MANUAL.md` · popular `knowledge_base.json` completo · tarefa Gradle de cópia dos screenshots para assets · checklist de PR.

**Fase 6 (futura/opcional):** `LocalLlmBackend` (Gemma on-device via MediaPipe) usando a KB como contexto. Não implementar sem solicitação explícita.

### Critérios de aceite (v1)
- [ ] App em modo avião: onboarding completo e ajuda funcionam normalmente.
- [ ] Fechar o app no meio do onboarding e reabrir → retoma do mesmo passo.
- [ ] Tocar "?" em qualquer tela → ajuda daquela tela com screenshot em < 300 ms.
- [ ] Pergunta sem resposta na KB → assistente admite e sugere tópicos (nunca inventa).
- [ ] Usuário cria categoria própria durante o onboarding e ela aparece nos cadastros.
- [ ] Modo Guiado: spotlight destaca o campo correto em qualquer tamanho de tela/fonte (posição medida em runtime, nunca fixa).
- [ ] Campo inválido → balão de correção âmbar sem modal; campo válido → check ✓ e avanço automático do spotlight.
- [ ] Sair do Modo Guiado no meio → rascunho salvo, retomável pelas Pendências.
- [ ] "Me mostre na tela" na ajuda contextual dispara o tour guiado da tela atual fora do onboarding.
- [ ] Perfil REVENDA: nenhum passo/tour/tópico/seed de produção aparece em lugar algum.
- [ ] Trocar REVENDA → REVENDA_PRODUCAO: nada é apagado; assistente oferece mini-onboarding só dos passos novos.
- [ ] Tour "Como fazer uma venda" atravessa 3+ telas mantendo o overlay, e é retomável se abandonado.
- [ ] Tour "Gravar embalagem": dimensões/peso salvos refletem no cálculo de frete (integração Bling).
- [ ] `checkpoint` sem produto cadastrado encadeia o tour de cadastro de produto e retorna ao tour original.
- [ ] Durante `highlight_tap`, somente o alvo do spotlight aceita toque; "Sair do guia" sempre acessível.
- [ ] Desligar as 3 flags → app compila e funciona sem nenhum vestígio do assistente (incluindo overlay, anchors e tours).

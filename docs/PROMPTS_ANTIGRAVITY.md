# PROMPTS_ANTIGRAVITY — Copiar e colar para cada fase

> **Como usar:** copie um dos prompts abaixo, cole no Antigravity e execute.
> **Referências:** Sempre inclua: SPEC_ASSISTANTE_LOCAL.md, AGENT_CONTEXT.md, KB_EXAMPLES.md

---

## FASE 1 — Fundação (Modelos + Engines)

### Prompt FASE 1

```
=== CONTEXT ===
Estou implementando um Assistente Local (offline, determinístico, SEM LLM) para um app Android de vendas e produção de calçados.

Referências:
- SPEC_ASSISTENTE_LOCAL.md (especificação completa, seção 2 + 3-A/3-B/3.5)
- AGENT_CONTEXT.md (invariantes e estrutura de diretórios)
- KB_EXAMPLES.md (exemplos dos JSONs)

=== TAREFA: FASE 1 — FUNDAÇÃO ===

Implemente (APENAS MODELOS + ENGINES, sem UI ainda):

ENTREGA ESPERADA:
✅ Modelos de dados (sealed classes, enums)
✅ AssistantEngine (puro Kotlin, sem Android)
✅ OnboardingFlowEngine (máquina de estados)
✅ RuleBasedBackend (strategy de matching)
✅ FieldAnchorRegistry (mapear campo → View)
✅ AssistantRepository (carregar + cache JSONs)
✅ Estrutura de diretórios conforme AGENT_CONTEXT.md
✅ Testes unitários (matching score, transições, validações)

INVARIANTES OBRIGATÓRIOS (nunca violar):
1. AssistantEngine e OnboardingFlowEngine: puro Kotlin, ZERO importações Android
   ❌ Não importar Context, Fragment, View, Activity, Repository DB (ainda não)
   ✅ Importar: kotlin.*, kotlinx.coroutines.*, dataclasses, sealed classes
2. Todo conteúdo em JSON (assets/kb/), NUNCA hardcoded
   ❌ val steps = listOf(Step(...))
   ✅ data class vindo de JSON desserializado
3. Backend via Strategy (interface AssistantBackend)
   - RuleBasedBackend v1 implementa: score por keywords (TF simples)
   - Futuro: LocalLlmBackend can plugar sem mexer em Engine/UI
4. Flags de feature (FeatureFlags.ASSISTANT_ENABLED, etc.) — código condicional pronto
5. Screenshot = ScreenId.key (convenção: "produto_cadastro.png" = ScreenId.PRODUTO_CADASTRO.key)

=== CLASSES E INTERFACES ESPERADAS ===

# Enums
ScreenId(key: String) — PRODUTO_CADASTRO, PEDIDO_VENDA, CORES, GRADE_TAMANHOS, MATERIAL_CADASTRO, etc. (usar ScreenIds reais do app)
OperationProfile — REVENDA, REVENDA_PRODUCAO
IntentType — HELP_REQUEST, ONBOARDING_STEP, JOURNEY_STEP, etc.

# Data Classes
AssistantMessage (sealed class: BotText, BotImage, BotOptions, UserReply, ActionChip)
OnboardingStep (id, type, text, field?, validation?, goto, modes?, etc.)
HelpTopic (screenId, title, screenshot, summary, sections, keywords, relatedScreens)
Intent (type, query, score, confidence)
OperationProfile — enum: REVENDA, REVENDA_PRODUCAO

# Engines (PURO KOTLIN, SEM ANDROID)
AssistantEngine
  - fun processQuery(query: String, context: ScreenContext): StateFlow<AssistantUiState>
  - fun nextStep(currentStepId: String): StateFlow<OnboardingUiState>
  - Nenhuma side effect, tudo via StateFlow

OnboardingFlowEngine
  - fun loadScript(profile: OperationProfile): OnboardingScript
  - fun validateStep(stepId, userInput): ValidationResult
  - fun getCurrentStep(): OnboardingStep
  - fun advance(userInput): StateFlow<OnboardingUiState>
  - Dirigida por JSON, não por if/else

# Strategy
interface AssistantBackend { suspend fun answer(query, context): AssistantResponse }
class RuleBasedBackend : AssistantBackend
  - Implementar score() por interseção de keywords (TF simples)
  - Nunca inventar resposta; se score < threshold, retornar "sem match"

# Mapeamento
FieldAnchorRegistry
  - fun bind(fieldKey: String, fieldMetadata: FieldMetadata)
  - fun getAnchor(fieldKey: String): FieldMetadata?
  - fieldMetadata contém: label, type (text, number, select, multi_select), required, etc.
  - (Não precisa de referência à View ainda — só metadados)

# Repository
AssistantRepository
  - fun loadKnowledge(profile: OperationProfile): KnowledgeBase
  - Carregar JSONs de assets (AssetManager)
  - Filtro "modes" aplicado aqui (centralizado)
  - Cache em memória (HashMap)
  - Nunca tocar em banco Room (Fase 3)

=== TESTES UNITÁRIOS (v1 mínimo) ===
✅ RuleBasedBackend.score() — teste TF com keywords conhecidas
✅ OnboardingFlowEngine — teste transição de steps (A -> B)
✅ OnboardingFlowEngine.validateStep() — campo obrigatório faltando
✅ AssistantRepository.loadKnowledge(REVENDA) — filtro "modes" aplicado
✅ AssistantRepository.loadKnowledge(REVENDA_PRODUCAO) — itens com "modes": ["REVENDA_PRODUCAO"] aparecem

=== ESTRUTURA DE DIRETÓRIOS ESPERADA ===
app/src/main/kotlin/com/yourcompany/app/
  assistant/
  ├── engine/
  │   ├── AssistantEngine.kt
  │   ├── OnboardingFlowEngine.kt
  │   └── model/
  │       ├── AssistantMessage.kt (sealed class)
  │       ├── OnboardingStep.kt
  │       ├── HelpTopic.kt
  │       ├── Intent.kt
  │       └── OperationProfile.kt
  ├── backend/
  │   ├── AssistantBackend.kt (interface)
  │   └── RuleBasedBackend.kt
  └── data/
      ├── AssistantRepository.kt
      └── FieldAnchorRegistry.kt

app/src/main/assets/kb/
  ├── onboarding_script.json
  ├── journeys.json
  ├── knowledge_base.json
  └── categories_seed.json

app/src/test/kotlin/.../assistant/
  ├── engine/
  │   ├── AssistantEngineTest.kt
  │   └── OnboardingFlowEngineTest.kt
  └── backend/
      └── RuleBasedBackendTest.kt

=== CHECKLIST DE ENTREGA ===
- [ ] Todos os modelos compilam (sem warnings)
- [ ] Engines pure Kotlin (sem Android) — compilam sozinhos se for lib
- [ ] RuleBasedBackend implementa score por TF
- [ ] AssistantRepository carrega e cacheia JSONs, filtra por "modes"
- [ ] Testes passam (4+)
- [ ] Código segue padrão do projeto (Kotlin style guide, camelCase, etc.)
- [ ] Desligar ASSISTANT_ENABLED → código não compila com erro (ou compila sem feature)

=== PRÓXIMOS PASSOS APÓS FASE 1 ===
Fase 2 (Ajuda Contextual): HelpFabDelegate, AssistantSheetFragment, integração com RuleBasedBackend.
```

---

## FASE 2 — Ajuda Contextual (BottomSheet Chat)

### Prompt FASE 2

```
=== CONTEXT ===
Fase 1 está pronta (modelos + engines + backend).
Agora: UI de ajuda contextual + botão "?" em qualquer tela.

Referências:
- SPEC_ASSISTENTE_LOCAL.md (seção 5 — Ajuda Contextual)
- AGENT_CONTEXT.md
- KB_EXAMPLES.md (knowledge_base.json)

=== TAREFA: FASE 2 — AJUDA CONTEXTUAL ===

Implemente:
✅ BaseFragment/BaseActivity expõe open val screenId: ScreenId
✅ HelpFabDelegate — injeta botão "?" em qualquer tela
✅ AssistantSheetFragment — BottomSheet estilo chat
✅ Integração com RuleBasedBackend (matching por keywords)
✅ Exibir screenshot da tela atual (carregar de assets/manual/screenshots/)
✅ ActionChip de navegação (deep link interno)
✅ FAQ transversal ("Como o custo é calculado?")
✅ Teste: tocar "?" → ajuda < 300 ms

FUNCIONAMENTO:
1. Usuário toca "?" → AssistantSheetFragment abre, já filtrado no tópico do screenId atual
2. Se usuário digita pergunta → RuleBasedBackend faz matching (score por keywords)
3. Resultado: texto + screenshot + seções relacionadas
4. ActionChip "Ir para Cadastro de Materiais" → deep link

INVARIANTES:
- AssistantSheetFragment NÃO importa Activity (recebe context via Fragment)
- Screenshot sempre de assets/manual/screenshots/ (nome = screenId.key)
- Sem resposta inventada; score baixo → "Não encontrei, veja tópicos relacionados"
- Botão "?" nunca cobrir botões de ação primária (decidir posição por tela)
- Desligar CONTEXTUAL_HELP_ENABLED → FAB e menu desaparecem

CHECKLIST:
- [ ] BaseFragment expõe screenId (override)
- [ ] HelpFabDelegate cria FAB "?" em qualquer Activity via BaseActivity
- [ ] AssistantSheetFragment é um BottomSheetDialogFragment (não Fragment comum)
- [ ] Primeira abertura: mostra tópico do screenId sem usuário digitar nada
- [ ] Busca digitada: RuleBasedBackend.answer() retorna Top 3 tópicos por score
- [ ] Screenshot carrega de assets, renderiza em ImageView
- [ ] ActionChip com deep link (ex.: "navegar para material_cadastro")
- [ ] Teste: em app.modo avião, ajuda funciona (offline 100%)
```

---

## FASE 3 — Onboarding + Modo Guiado + Perfis

### Prompt FASE 3A — Perfis

```
=== CONTEXT ===
Fase 1 e 2 prontas.
Agora: Perfis de Operação (REVENDA vs REVENDA_PRODUCAO) + filtro centralizado.

Referências:
- SPEC_ASSISTENTE_LOCAL.md (seção 3-A)
- AGENT_CONTEXT.md (invariante 4)

=== TAREFA: FASE 3A — PERFIS ===

Implemente:
✅ SettingsRepository.operationProfile (DataStore)
✅ Filtro "modes" centralizado em AssistantRepository.loadKnowledge()
✅ Seeds de categorias com "modes" (ex.: "Matéria-prima" só em REVENDA_PRODUCAO)
✅ Troca de perfil sem apagar dados (apenas mostra/oculta módulos)
✅ Teste: REVENDA → nenhum item/tour/tópico de produção aparece

COMPORTAMENTO:
- Primeiro passo do onboarding: pergunta de perfil
- Perfil salvo em SettingsRepository (DataStore)
- AssistantRepository.loadKnowledge(profile) filtra na carga
- Seeds de categorias também filtrados por "modes"
- Trocar perfil depois: oferece mini-onboarding dos passos novos

CHECKLIST:
- [ ] SettingsRepository tem operationProfile (DataStore + getter/setter)
- [ ] AssistantRepository.loadKnowledge() filtra todos os JSONs por "modes"
- [ ] Categories_seed.json tem "modes" nos itens (Matéria-prima, Mão-de-obra, etc.)
- [ ] Teste: REVENDA → onboarding curto (sem materiais/produção)
- [ ] Teste: REVENDA_PRODUCAO → onboarding completo
- [ ] Teste: trocar REVENDA → REVENDA_PRODUCAO → oferece mini-onboarding, nada apagado
```

### Prompt FASE 3B — Onboarding

```
=== CONTEXT ===
Fase 1, 2, 3A prontas.
Agora: Roteiro de recepção completo + persistência + modo guiado básico.

Referências:
- SPEC_ASSISTENTE_LOCAL.md (seção 3.3 + 3.4 + 3.5)
- KB_EXAMPLES.md (onboarding_script.json)

=== TAREFA: FASE 3B — ONBOARDING + MODO GUIADO ===

Implemente:
✅ OnboardingActivity (tela cheia)
✅ OnboardingFlowEngine interpretar onboarding_script.json completo
✅ Persistência: OnboardingStateDao (Room) — progresso retomável
✅ Passo multi_select_seed — apresentar sugestões, guardar categorias
✅ Barra de progresso + resumo ao fim de cada etapa
✅ "Pular por agora" → pendências na Home
✅ Modo Guiado básico: GuidedFormOverlay + spotlight animado + balão + validação
✅ FieldAnchorRegistry.bind() mapeando campos reais
✅ Teste: fechar app no meio → reabrir retoma do mesmo passo
✅ Teste: spotlight posiciona corretamente em qualquer resolução

FLUXO DO ONBOARDING (10 etapas):
1. Welcome (mensagem)
2. Perfil (REVENDA / REVENDA_PRODUCAO)
3. Nome da empresa (input_text)
4. Categorias: Produtos (multi_select_seed)
5. Categorias: Despesas (multi_select_seed)
6. Categorias: Receitas (multi_select_seed)
7. Cores (entity_form guiado)
8. Grades (seleção + entity_form guiado)
9. Materiais (entity_form guiado, só REVENDA_PRODUCAO)
10. Produto (entity_form guiado COM spotlight)
11. Fornecedores (entity_form, opcional)
12. Formas de Pagamento (entity_form)
13. Clientes (entity_form, opcional)
14. Summary + finish

MODO GUIADO (seção 3.5):
- GuidedFormOverlay (View: scrim ~60%, spotlight recorte arredondado, pulso animado)
- Balão ancorado ao campo (acima/abaixo conforme espaço)
- Validação em tempo real:
  ✅ Válido → check ✓, spotlight desliza pro próximo
  ❌ Inválido → balão âmbar "Ops — o preço precisa ser maior que zero"
  → Sem modal, sem interromper
- FieldAnchorRegistry.bind("produto.nome", viewBinding.etProdutoNome)
- Auto-scroll para o campo se fora da viewport
- Controles: Próximo, Voltar, Pular campo (só opcionais), Sair do guia (com confirmação)
- Barra fina de progresso: "Campo 3 de 8"

PERSISTÊNCIA (OnboardingStateDao + Room):
- Salvar a cada passo concluído
- Ao reabrir app: ler último passo + Context do usuario
- Botão "Pular" salva em Pendências (Home mostra lista de tarefas não concluídas)

CHECKLIST:
- [ ] OnboardingActivity abre no primeiro uso ou via Configurações
- [ ] OnboardingFlowEngine interpretar 100% de onboarding_script.json (copy/pasta de KB_EXAMPLES)
- [ ] Multi_select_seed: renderiza sugestões com checkboxes + campo "Criar novo"
- [ ] Persistência: Room dao criando/atualizando OnboardingProgress a cada passo
- [ ] Reabrir app no meio → retoma exatamente de onde parou (mesma instância)
- [ ] GuidedFormOverlay: spotlight recorta o campo real (não é overlay falso)
- [ ] Spotlight animação: pulso suave 1s, auto-scroll suave
- [ ] FieldAnchorRegistry: bind() armazena referência/metadados (não View em si)
- [ ] Validação em tempo real: sem modal, só balão âmbar
- [ ] Teste online-only: fechar app 3x no meio do onboarding, reabrir → retoma 3 vezes
- [ ] Desligar ONBOARDING_ENABLED → activity não abre, sem erro
```

---

## FASE 4 — Tours de Processo (Journeys)

### Prompt FASE 4

```
=== CONTEXT ===
Fase 1, 2, 3 prontas (modelos, ajuda, onboarding, modo guiado, perfis).
Agora: Sistema de tours atravessando múltiplas telas.

Referências:
- SPEC_ASSISTENTE_LOCAL.md (seção 3-B)
- KB_EXAMPLES.md (journeys.json)

=== TAREFA: FASE 4 — JOURNEYS (TOURS DE PROCESSO) ===

Implemente:
✅ JourneyController (orquestra passos, sobrevive à navegação)
✅ JourneyProgressStore (Room: tours concluídos/abandonados)
✅ Tipos de passo: highlight_tap, guided_field, navigate_auto, checkpoint, message
✅ journeys.json populado com 4 tours essenciais:
   - "Como fazer uma venda" (home → lista → pedido → finalizar)
   - "Como gravar embalagem" (produto → aba embalagem → dimensões/peso)
   - "Como abrir ordem de produção" (REVENDA_PRODUCAO)
   - "Como registrar entrada de compra" (material/estoque)
✅ Aba "Guias" no AssistantSheetFragment (catálogo, status ✓, busca, agrupamento)
✅ Encadeamento: checkpoint sem pré-requisito puxa outro tour
✅ Sugestão de próximo tour ao finalizar
✅ Teste: tour atravessa 3+ telas e é retomável se abandonado

FUNCIONAMENTO:

highlight_tap:
- Destaca um botão/menu real com spotlight (mesma GuidedFormOverlay)
- Bloqueia toque fora do spotlight ("Sair do guia" sempre visível)
- Avança quando usuário toca o alvo

guided_field:
- Reusa GuidedFormController da Fase 3B

navigate_auto:
- App navega sozinho com animação (para atalhos)

checkpoint:
- Valida pré-requisitos (ex.: "você precisa de 1 produto")
- Se não atender: abre diálogo "Quer cadastrar um produto agora?"
- Se aceita: puxa outro journey (cadastro de produto) e volta

message:
- Balão informativo sem alvo específico

JourneyController:
- Escopo ActivityRetainedScope (sobrevive a rotação + trocas de tela)
- Observa NavController
- Ao mudar de destino, verifica se próximo passo é da nova tela
- Reanexa overlay/balão conforme necessário

Aba "Guias":
- Lista de todos os journeys do perfil atual
- Agrupamento por área (Cadastros, Vendas, Produção, Financeiro, Estoque)
- Status: "Novo", "✓ Concluído", "⏸ Em progresso"
- Busca por título/descrição
- Toque em tour → inicia (ou retoma se em progresso)

CHECKLIST:
- [ ] JourneyController é singleton/retained (observa NavController)
- [ ] journeys.json populado com exemplos de KB_EXAMPLES (copiar + ajustar)
- [ ] Highlight_tap spotlight bloqueia toque fora (só alvo + "Sair" aceita)
- [ ] Guided_field reusa GuidedFormController de Fase 3B
- [ ] Checkpoint: validar pré-requisito (ex.: produtoRepository.count() > 0)
- [ ] Encadeamento: checkpoint puxa outro journey, volta automaticamente
- [ ] Aba "Guias": renderiza lista com status + filtros
- [ ] Tour atravessa 3 telas: home → lista → detalhe → salvar (tudo num flow)
- [ ] Teste: abandonar tour → home → reabrir "Guias" → mesmo tour em "⏸ Em progresso"
- [ ] Sugestão automática: ao finalizar venda, "Agora aprenda a gravar embalagem?"
- [ ] Teste: REVENDA → sem tour de Ordem de Produção
- [ ] Teste: REVENDA_PRODUCAO → tour de Ordem de Produção aparece
```

---

## FASE 5 — Manual + Conteúdo (JSONs Completos)

### Prompt FASE 5

```
=== CONTEXT ===
Fase 1–4 prontas (engines, UI, onboarding, tours).
Agora: Manual do programa + JSONs populados completamente.

Referências:
- SPEC_ASSISTENTE_LOCAL.md (seção 6)
- KB_EXAMPLES.md (exemplos dos JSONs)

=== TAREFA: FASE 5 — MANUAL + CONTEÚDO ===

Entrega esperada:
✅ Capturar screenshot de TODAS as telas (1080×2400 PNG → WebP ~150 KB)
✅ Escrever MANUAL.md (seção por tela: para quê / passo / campos / erros / relacionadas)
✅ Preencher knowledge_base.json (1 topic por ScreenId + FAQ completo)
✅ Preencher onboarding_script.json (10 etapas conforme Fase 3B)
✅ Preencher journeys.json (5–10 tours essenciais, ambos perfis)
✅ Preencher categories_seed.json (produtos/despesas/receitas/gerais completo)
✅ Tarefa Gradle: copiar screenshots → app/src/main/assets/manual/screenshots/
✅ Checklist de PR: tela nova = screenshot + seção manual + topic KB + journey

ESTRUTURA ESPERADA:

docs/manual/
├── MANUAL.md
├── CHANGELOG_MANUAL.md (histórico de mudanças)
└── screenshots/
    ├── home.png
    ├── produto_cadastro.png
    ├── produto_lista.png
    ├── pedido_venda.png
    ├── pedido_venda_lista.png
    ├── cores.png
    ├── grade_tamanhos.png
    ├── material_cadastro.png
    ├── ordem_producao.png
    ├── ordem_producao_lista.png
    ├── estoque.png
    ├── entrada_compra.png
    ├── financeiro_receitas.png
    ├── financeiro_despesas.png
    ├── cliente_cadastro.png
    ├── cliente_lista.png
    ├── fornecedor_cadastro.png
    ├── configuracoes.png
    └── ... (uma por ScreenId)

MANUAL.md — Seções (template por tela):

## Tela Xyz

**Para que serve:**
Descrição em 2–3 frases do objetivo prático.

**Screenshot:**
[Imagem da tela real]

**Passo a passo:**
1. Abra o menu Xyz
2. Toque em + ou Adicionar
3. Preencha os campos
4. Toque em Salvar

**Campos e significados:**
- Campo A: O que é, exemplo
- Campo B: O que é, exemplo

**Erros comuns:**
- "Erro: Campo obrigatório" — preencheu tudo? Verifique se faltou algo
- ... (3–5 erros reais)

**Telas relacionadas:**
- [Link] Cadastro de Produtos
- [Link] Estoque

---

KNOWLEDGE_BASE.JSON — Exemplo mínimo de 3 topics + 5 FAQs

(Ver KB_EXAMPLES.md para estrutura completa)

---

ONBOARDING_SCRIPT.JSON — 10+ etapas completas

(Copy/pasta de KB_EXAMPLES.md, validar contra telas reais)

---

JOURNEYS.JSON — 5+ tours

(Copy/pasta de KB_EXAMPLES.md + adicionar tours de Estoque/Entrada/Compra/NF)

---

CATEGORIES_SEED.JSON — Completo por tipo

(Copy/pasta de KB_EXAMPLES.md, ajustar nomes do seu modelo financeiro)

---

TAREFA GRADLE (add ao build.gradle):

task copyManualScreenshots(type: Copy) {
  from 'docs/manual/screenshots/'
  into 'src/main/assets/manual/screenshots/'
  include '*.png'
  include '*.webp'
}

preBuild.dependsOn copyManualScreenshots

---

CHECKLIST DE ENTREGA:

- [ ] 15+ screenshots capturados (1 por ScreenId)
- [ ] Todos os screenshots com ~150 KB (WebP comprimido)
- [ ] MANUAL.md estruturado (5+ seções, links internos)
- [ ] knowledge_base.json: 1 topic por ScreenId (home, produto_cadastro, pedido_venda, etc.)
- [ ] knowledge_base.json: 5+ FAQ transversais (custo, venda, perfis, etc.)
- [ ] onboarding_script.json: 10+ steps de welcome até finish_success
- [ ] journeys.json: 4 tours = fazer venda + embalagem + entrada compra + OP (se REVENDA_PRODUCAO)
- [ ] categories_seed.json: ~40 sugestões (produtos 15+, despesas 20+, receitas 10+)
- [ ] Tarefa Gradle copyManualScreenshots funciona (compila, copia assets)
- [ ] Todos os JSONs validam (sem erros de sintaxe)
- [ ] Teste: offline → abre ajuda de qualquer tela + screenshot renderiza

---

CHECKLIST DE PR (adicionar ao template de PR do projeto):

- [ ] Nova tela / screen_id adicionado?
  - [ ] 1. ScreenId enum (valor + key estável)
  - [ ] 2. Fragment/Activity expõe screenId
  - [ ] 3. Screenshot capturado (docs/manual/screenshots/[key].png)
  - [ ] 4. Seção adicionada a MANUAL.md
  - [ ] 5. Topic adicionado a knowledge_base.json
  - [ ] 6. Journey adicionado a journeys.json (se fluxo operacional)
  - [ ] 7. Campos registrados em FieldAnchorRegistry (se tiver Modo Guiado)
  - [ ] 8. Verificado: desligar ASSISTANT_ENABLED → sem erro

RESULTADO FINAL:
Um app 100% documentado internamente, com tour guiado para qualquer operação, ajuda contextual offline em qualquer tela, e manual vivo amarrado à KB (fonte única).
```

---

## Copiar e colar direto

### Se você quer apenas começar AGORA

Copie **este prompt completo** e mande pro Antigravity:

```
Sou desenvolvedor Android Kotlin. Tenho um app de vendas/produção de calçados.

Quero um assistente local offline (determinístico, sem LLM) com:
1. Onboarding guiado (10 etapas)
2. Ajuda por tela
3. Tours de processo (venda, embalagem, produção)
4. Perfis: REVENDA vs REVENDA+PRODUÇÃO
5. Modo guiado com spotlight animado
6. Tudo offline, funciona sem internet

Referências completas:
- https://[link para SPEC_ASSISTENTE_LOCAL.md]
- https://[link para AGENT_CONTEXT.md]
- https://[link para KB_EXAMPLES.md]

Comece pela FASE 1: modelos + engines.

Estrutura de diretórios: conforme AGENT_CONTEXT.md
Invariantes: conforme SPEC_ASSISTENTE_LOCAL.md

Gere código testável, comentado, seguindo Kotlin style guide.
```

Se precisar de uma fase específica, copie o prompt da seção acima (FASE 1, 2, 3A, 3B, 4, 5) e adapte.

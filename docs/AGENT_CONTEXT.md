# AGENT_CONTEXT — Assistente Local (Offline)

> **Documento para:** Agente Antigravity (consultar antes de qualquer tarefa neste módulo)
> **Referência completa:** SPEC_ASSISTENTE_LOCAL.md
> **Local no projeto:** `docs/AGENT_CONTEXT.md`

---

## O que é este módulo

**Assistente Local Offline** — um sistema determinístico (não é LLM) que oferece:
1. **Onboarding guiado** passo a passo, didático e retomável
2. **Modo Guiado** com spotlight animado sobre campos reais (tela real com destaque + balão)
3. **Tours de Processo** — como fazer venda, embalagem, produção (Journeys atravessando múltiplas telas)
4. **Ajuda contextual** por tela com screenshot + FAQ
5. **Perfis de operação** — REVENDA × REVENDA_PRODUCAO (filtram todo conteúdo)
6. **Banco de categorias** pré-cadastradas (despesas, receitas, produtos, gerais)

**Por que NÃO é LLM:** funciona offline, zero latência, respostas previsíveis, base de conhecimento = manual do programa (fonte única).

---

## Invariantes (NUNCA violar)

### 1. Puro Kotlin — sem Android

```
❌ AssistantEngine.kt NÃO importa: Context, Fragment, Activity, View
✅ Importa: kotlin.*, kotlinx.coroutines, dataclasses, sealed classes

❌ OnboardingFlowEngine.kt NÃO chama: repository.insertProduto()
✅ Emite eventos: StateFlow<UiState> que a UI consome
```

**Por que:** facilita testes, reutilização em backend/CLI, e isola lógica.

### 2. Todo conteúdo em JSON (assets/kb/)

```
❌ Hardcoded em Kotlin:
val steps = listOf(
  Step("empresa_nome", "Como se chama..."),
  Step("categorias_intro", "Agora vamos...")
)

✅ Em assets/kb/onboarding_script.json:
{ "id": "empresa_nome", "text": "Como se chama..." }
```

**Por que:** não recompila para editar roteiro; Antigravity edita JSON, não Kotlin.

### 3. Backend via Strategy (interface)

```kotlin
interface AssistantBackend {
  suspend fun answer(query: String, context: ScreenContext): AssistantResponse
}

class RuleBasedBackend : AssistantBackend { ... }
// Futuro: class LocalLlmBackend : AssistantBackend { ... }
```

**Por que:** trocar de backend sem tocar UI; v1 = regras, futuro = LLM, ambos funcionam.

### 4. Filtro de perfis em UM único ponto

```kotlin
// ✅ CERTO: em AssistantRepository.load()
suspend fun loadKnowledge(profile: OperationProfile): KnowledgeBase {
  val raw = loadJson<KnowledgeBase>("knowledge_base.json")
  return raw.copy(
    topics = raw.topics.filter { it.modes.contains(profile) }
  )
}

// ❌ ERRADO: espalhado em if(profile == REVENDA) por toda UI
```

**Por que:** manutenção centralizada; adicionar novo perfil = editar JSON, não varrer o código.

### 5. Flags de Feature (desligáveis)

```kotlin
FeatureFlags.ASSISTANT_ENABLED         // tudo
FeatureFlags.ONBOARDING_ENABLED         // recepção
FeatureFlags.CONTEXTUAL_HELP_ENABLED    // botão "?"
FeatureFlags.PRODUCTION_MODULE          // (derivada do perfil)
```

**Teste:** desligar as 3 → app compila SEM ERROS, roda sem nenhum vestígio do assistente.

### 6. Screenshot = ScreenId.key (fonte única)

```
ScreenId.PRODUTO_CADASTRO.key = "produto_cadastro"
  ↓
Screenshot: docs/manual/screenshots/produto_cadastro.png
  ↓
KB reference: "screenshot": "manual/screenshots/produto_cadastro.png"
  ↓
Manual seção: "## Cadastro de Produto"
```

**Por que:** mesma imagem em tudo (manual + KB + tour); atualizar 1 imagem = sincronizado.

### 7. Sem LLM v1; ponto de extensão pronto

- RuleBasedBackend usa score simples (TF por keywords).
- Nunca retorna resposta inventada — admite quando não sabe.
- Interface `AssistantBackend` deixa `LocalLlmBackend` (Gemma etc.) pronta para plugar.

---

## Estrutura de diretórios esperada

```
app/src/main/kotlin/com/yourcompany/app/

assistant/
├── engine/
│   ├── AssistantEngine.kt                    // Núcleo. Funções puras + StateFlow. Sem Android.
│   ├── OnboardingFlowEngine.kt              // Máquina de estados do onboarding
│   ├── model/
│   │   ├── AssistantMessage.kt              // sealed class: BotText, BotImage, BotOptions, UserReply, ActionChip
│   │   ├── OnboardingStep.kt
│   │   ├── HelpTopic.kt
│   │   ├── Intent.kt
│   │   └── OperationProfile.kt              // enum: REVENDA, REVENDA_PRODUCAO
│   ├── backend/
│   │   ├── AssistantBackend.kt              // interface (Strategy)
│   │   └── RuleBasedBackend.kt              // v1: matching por keywords
│   └── journal/
│       └── JourneyController.kt             // Orquestra tours entre telas
├── data/
│   ├── AssistantRepository.kt               // Carrega KB dos assets, cache em memória, filtra por perfil
│   ├── OnboardingStateDao.kt                // Room: progresso do onboarding (retomável)
│   └── JourneyProgressStore.kt              // Room: tours concluídos/abandonados
└── ui/
    ├── AssistantSheetFragment.kt            // BottomSheet estilo chat (ajuda + menu guias)
    ├── OnboardingActivity.kt                // Recepção em tela cheia
    ├── HelpFabDelegate.kt                   // Injeta botão "?" em qualquer tela
    └── guided/
        ├── GuidedFormOverlay.kt             // View: scrim + spotlight + balão
        ├── GuidedFormController.kt          // Lê sequência de campos do JSON
        ├── FieldAnchorRegistry.kt           // Mapeia fieldKey → View real
        ├── SpotlightShape.kt                // Recorte animado + pulso
        └── JourneyRenderer.kt               // Renderiza journeys em múltiplas telas

app/src/main/assets/kb/
├── onboarding_script.json                   // Roteiro: steps + navegação
├── journeys.json                            // Tours de processo (venda, embalagem, produção...)
├── knowledge_base.json                      // Tópicos de ajuda + FAQ + screenshots
└── categories_seed.json                     // Sugestões: produtos, despesas, receitas, gerais

docs/
├── SPEC_ASSISTENTE_LOCAL.md                 // Especificação completa (este que enviamos)
├── AGENT_CONTEXT.md                         // Este arquivo (checklist + invariantes)
├── KB_EXAMPLES.md                           // Exemplos reais dos 4 JSONs
├── MANUAL.md                                // Manual do programa (seção por tela)
├── manual/
│   └── screenshots/                         // PNG: home.png, produto_cadastro.png, etc.
└── PROMPTS_ANTIGRAVITY.md                   // Prompts prontos para cada fase (copiar/colar)
```

---

## Fases de implementação (Antigravity)

### FASE 1 — Fundação (1–2 sprints)

**Saída:** Modelos + Engines + Backend de regras

- ✅ ScreenId enum (todas as telas reais)
- ✅ Modelos: AssistantMessage, OnboardingStep, HelpTopic, Intent, OperationProfile
- ✅ AssistantEngine (puro, sem Android)
- ✅ OnboardingFlowEngine (máquina de estados dirigida por JSON)
- ✅ RuleBasedBackend (matching simples)
- ✅ FieldAnchorRegistry (mapear fieldKey → View)
- ✅ AssistantRepository (load JSON, cache, filtro de perfis)
- ✅ Testes unitários: score de matching, validação de steps, transições de estado
- ✅ Flags de feature (ASSISTANT_ENABLED, ONBOARDING_ENABLED, etc.)

**Nenhuma UI ainda.** Só Engine + modelos testáveis.

---

### FASE 2 — Ajuda Contextual (1 sprint)

**Saída:** botão "?", ajuda por tela, busca

- ✅ HelpFabDelegate (injeta FAB/botão "?" em BaseActivity/BaseFragment)
- ✅ AssistantSheetFragment (BottomSheet com chat + menu guias)
- ✅ RuleBasedBackend integrando `HelpTopic` (match por keywords)
- ✅ ActionChip de navegação (deep link interno)
- ✅ Exibir screenshot (carregar do assets/manual/screenshots/)
- ✅ Teste: tocar "?" em qualquer tela → ajuda específica < 300 ms

**Integração:** BaseFragment expõe `open val screenId: ScreenId` e HelpFabDelegate observa.

---

### FASE 3 — Onboarding + Modo Guiado + Perfis (2–3 sprints)

**Saída:** Recepção completa, spotlight animado, perfis funcionando

**Parte A — Perfis:**
- ✅ OperationProfile (REVENDA, REVENDA_PRODUCAO)
- ✅ SettingsRepository.operationProfile (DataStore)
- ✅ Primeiro passo do onboarding: pergunta de perfil
- ✅ Filtro "modes" centralizado em AssistantRepository
- ✅ Seeds de categorias por perfil (categories_seed.json com "modes")

**Parte B — Onboarding:**
- ✅ OnboardingActivity (tela cheia para recepção)
- ✅ OnboardingFlowEngine completo (interpretar onboarding_script.json)
- ✅ Persistência em Room: OnboardingStateDao (progresso retomável)
- ✅ Passo multi_select_seed: apresentar sugestões, guardar categorias criadas
- ✅ Barra de progresso + resumo ao final de cada etapa
- ✅ "Pular por agora" (passos pulados → Pendências na Home)
- ✅ Teste: fechar app no meio do onboarding → reabrir retoma do mesmo passo

**Parte C — Modo Guiado (Spotlight):**
- ✅ GuidedFormOverlay (View: scrim + spotlight + balão)
- ✅ SpotlightShape (Canvas com `PorterDuff.CLEAR`, animação de pulso)
- ✅ GuidedFormController (lê sequência de campos, valida, avança)
- ✅ FieldAnchorRegistry (fieldKey → View, getLocationInWindow, auto-scroll)
- ✅ Validação em tempo real (campo inválido → balão âmbar, sem modal)
- ✅ Teste: destacar campo real em qualquer resolução (posição medida runtime)
- ✅ Teste: desligar flag → overlay desaparece, telas funcionam normais

---

### FASE 4 — Tours de Processo (Journeys) (2–3 sprints)

**Saída:** Sistema de tours atravessando múltiplas telas

- ✅ JourneyController (orquestra passos, sobrevive à navegação)
- ✅ JourneyProgressStore (Room: tours concluídos/abandonados)
- ✅ Tipos de passo: `highlight_tap`, `guided_field`, `navigate_auto`, `checkpoint`, `message`
- ✅ journeys.json com exemplos:
  - "Como fazer uma venda" (home → lista → pedido → finalizar)
  - "Como gravar embalagem" (produto → aba embalagem → dimensões/peso → custo)
  - "Como abrir ordem de produção" (REVENDA_PRODUCAO apenas)
- ✅ Aba "Guias" no AssistantSheetFragment (catálogo, status ✓, busca, agrupamento por área)
- ✅ Encadeamento: checkpoint sem pré-requisito puxa outro tour e volta
- ✅ Sugestão de próximo tour ao finalizar
- ✅ Teste: tour atravessa 3+ telas e é retomável

---

### FASE 5 — Manual + Conteúdo (1–2 sprints)

**Saída:** Manual completo + JSONs populados

- ✅ Capturar screenshot de TODAS as telas reais (1080×2400 → WebP ~150 KB)
- ✅ Escrever MANUAL.md: seção por tela (para quê, passo a passo, campos, erros comuns, relacionadas)
- ✅ Populear knowledge_base.json: 1 topic por ScreenId + FAQ transversal
- ✅ Preencher onboarding_script.json: 10 etapas (empresa → produto)
- ✅ Preencher journeys.json: 5–10 tours essenciais (venda, embalagem, compra, produção)
- ✅ Tarefa Gradle: copiar screenshots de docs/manual/screenshots/ → app/src/main/assets/manual/screenshots/
- ✅ Checklist de PR: "Tela X adicionada/modificada → screenshot + seção manual + topic KB + journey (se aplicável)"

---

### FASE 6 (futura, SÓ se pedir) — LocalLlmBackend

Implementar `LocalLlmBackend : AssistantBackend` com Gemma 2B on-device (MediaPipe LLM Inference).
Usar os JSONs como contexto (RAG local).
Não fazer sem solicitação explícita.

---

## Checklist — Como adicionar uma tela NOVA ao programa

Toda vez que você adiciona uma feature/tela nova, estes artefatos entram no MESMO PR:

- [ ] 1. Criar `ScreenId.NOVA_TELA("nova_tela")` em `ScreenId.kt`
- [ ] 2. Expor `open val screenId: ScreenId = ScreenId.NOVA_TELA` no BaseFragment/Activity
- [ ] 3. Capturar screenshot: docs/manual/screenshots/nova_tela.png
- [ ] 4. Escrever seção em docs/MANUAL.md (template: para quê / passo / campos / erros / relacionadas)
- [ ] 5. Adicionar topic em assets/kb/knowledge_base.json com keywords + screenshot reference
- [ ] 6. Se for um fluxo operacional, adicionar journey em assets/kb/journeys.json
- [ ] 7. Registrar anchors no BaseFragment se tiver Modo Guiado: `registerGuidedAnchors(registry)`
- [ ] 8. Se afetar categorias/seed, editar assets/kb/categories_seed.json
- [ ] 9. Verificar: desligar flags de assistente → tela funciona normal, zero crash

---

## Dúvidas — ordem de consulta

1. **Este arquivo** (AGENT_CONTEXT.md) — invariantes + estrutura
2. **SPEC_ASSISTENTE_LOCAL.md** — detalhes de arquitetura + algoritmos
3. **KB_EXAMPLES.md** — exemplos reais dos JSONs
4. **PROMPTS_ANTIGRAVITY.md** — prompts prontos para cada fase
5. **Tiago** — ambiguidade não resolvida nos 4 acima

---

## Resumo: Como usar com Antigravity

1. **Lê:** AGENT_CONTEXT.md (este arquivo)
2. **Consulta:** SPEC_ASSISTENTE_LOCAL.md (detalhes)
3. **Vê exemplos:** KB_EXAMPLES.md
4. **Copia prompt:** PROMPTS_ANTIGRAVITY.md (fase X)
5. **Cola no Antigravity:** prompt + "Implemente FASE X conforme SPEC_ASSISTENTE_LOCAL.md"
6. **Antigravity entrega:** código + JSONs
7. **Você revisa + aprova**

Repete para Fase 2, 3, 4, 5.

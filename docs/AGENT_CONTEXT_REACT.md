# AGENT_CONTEXT_REACT — Central de Ajuda (adaptação React/TS da spec original)

> A spec original (`SPEC_ASSISTENTE_LOCAL.md`, `AGENT_CONTEXT.md`, `KB_EXAMPLES.md`,
> `PROMPTS_ANTIGRAVITY.md`, `INDEX.md`) foi escrita pra um app Android nativo em Kotlin
> (Fragments, Room, Views, `BottomSheetDialogFragment`). Este projeto real é **React +
> TypeScript + Vite, empacotado com Capacitor** — a interface roda inteira dentro de uma
> WebView como HTML/DOM, não como Views Android. Este arquivo documenta a tradução de
> conceitos e o que já existia no projeto antes de começar (pra não duplicar).

## Nome do módulo

**"Central de Ajuda"** — nome escolhido de propósito pra não colidir com o **Assistente
IA** (`src/components/AIAssistantModal.tsx`), que já existe no app e é outro recurso,
na nuvem (Cloud Functions + LLM, voz/foto, preenche formulários). São dois módulos
completamente separados: o Assistente IA continua como está; a Central de Ajuda é nova,
local, determinística, sem rede.

## O que já existia e foi reaproveitado (não reconstruído)

| Conceito da spec (Kotlin) | Onde já existe neste projeto |
|---|---|
| `OperationProfile` (REVENDA × REVENDA_PRODUCAO) | `modulesConfig.production` (boolean) — já gateia dezenas de telas no app inteiro. `BusinessType` do onboarding é só a pergunta que *seta* esse boolean uma vez; não é reconsultado depois, então a Central de Ajuda filtra por `modulesConfig.production` direto, não por `BusinessType`. |
| `categories_seed.json` (sugestões de categoria) | `CategoryTemplate`/`ColorTemplate` — coleção compartilhada entre contas, com UI de "Modelos" já pronta em `CategoriesView`/`ColorsView` (toca pra adicionar). Não recriar; se precisar de mais sugestões, é conteúdo (popular os templates), não código novo. |
| `ScreenId` enum | `ViewType` (`src/types.ts`) — já é a chave usada em toda navegação/gate do app. Os tópicos de ajuda usam `ViewType` direto como chave, sem enum paralelo. |
| Onboarding guiado, retomável, pulável | Já existe (`OnboardingStatus` em Firestore, `StepWizardBar`, array de steps com `isComplete` derivado reativamente dos dados já carregados). Funcional, mais simples que a spec original (sem tom conversacional nem spotlight) — não foi refeito nesta rodada. |
| `AssistantSheetFragment` (BottomSheet chat) | `src/components/Modal.tsx` (portal, header com ícone/título, corpo rolável) — reaproveitado como base do `HelpCenterModal`. |

## O que é genuinamente novo (implementado)

- `src/data/helpKnowledgeBase.ts` — conteúdo da Central de Ajuda: `HELP_TOPICS` (1 por
  `ViewType`) + `HELP_FAQ` (perguntas transversais). Puro dado (arrays TS tipados), sem
  lógica — igual ao espírito de "roteiro é dado, não código" da spec original, só que
  aqui não precisa de JSON separado porque o Vite já compila TS no bundle sem custo de
  "recompilar o app" (diferente de mexer em Kotlin).
- `src/utils/helpMatching.ts` — motor de busca determinístico por palavras-chave (TF
  simples, sem acento, sem IA/rede). `getTopicForView`, `getAllFaq`, `searchHelp`. Nunca
  inventa resposta: sem match, mostra "não encontrei" + sugestões (mesma regra da spec).
- `src/components/HelpCenterModal.tsx` — UI: busca + tópico da tela atual (aberto na
  hora, sem precisar digitar) + telas relacionadas + FAQ em acordeão.
- Botão "?" no header do app (`src/App.tsx`, ao lado do Assistente IA) — sempre visível,
  sem gate de módulo (ajuda deve funcionar mesmo sem Produção/IA ligados).

## Como adicionar um tópico de ajuda pra uma tela nova

1. Abra `src/data/helpKnowledgeBase.ts`.
2. Adicione um objeto em `HELP_TOPICS`: `view` (o `ViewType` da tela), `title`, `summary`,
   `sections` (heading + body), `keywords` (termos de busca, sem acento tudo bem — o
   motor normaliza), e opcionalmente `relatedViews` e `productionOnly: true` se o
   conteúdo só faz sentido com `modulesConfig.production` ligado.
3. Nenhum outro arquivo precisa mudar — o botão "?" já resolve pela tela atual
   automaticamente via `ViewType`.

## Pendências (fases da spec original ainda não traduzidas/implementadas)

- **Modo Guiado / spotlight campo-a-campo** (seção 3.5 da spec) — não existe nenhuma lib
  de tour instalada no projeto; precisaria ser construído do zero como overlay
  CSS/DOM (`getBoundingClientRect` no elemento real + camada fixa por cima), sem
  equivalente a `FieldAnchorRegistry`/Views nativas.
- **Journeys / tours de processo entre telas** (seção 3-B) — depende do spotlight acima.
- **Manual populado tela a tela** — `ManualView.tsx` já existe (busca + seções), mas é
  referência estática; não foi ligado à Central de Ajuda nesta rodada.
- **Onboarding com tom conversacional + spotlight** — o onboarding atual (`StepWizardBar`)
  não foi alterado; só a Central de Ajuda foi construída até aqui.

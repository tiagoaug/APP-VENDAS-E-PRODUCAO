# 📚 ASSISTENTE LOCAL — Índice Completo

> **Projeto:** App Vendas e Produção de Calçados (Android / Kotlin)
> **Data:** Agosto 2026
> **Status:** Pronto para implementação (Antigravity)
> **Arquivo-chave:** Este é o seu guia de orientação

---

## 📖 Ordem de leitura (por papel)

### 👨‍💼 Se você é o Tiago (Product Owner / Coordenador)

1. **SPEC_ASSISTENTE_LOCAL.md** — Leia tudo. É o documento definidor.
   - Seção 1: Visão geral (5 min)
   - Seção 2: Arquitetura (importante para aprovações)
   - Seção 3-A/3-B: Perfis e Journeys (decisões de negócio)
   - Seção 3.5: Modo Guiado (UX)

2. **AGENT_CONTEXT.md** — Checklist prático.
   - Invariantes (copiar para seu board de gestão)
   - Estrutura de diretórios
   - Fases de implementação (calendário)
   - Checklist de tela nova (para PRs futuros)

3. **PROMPTS_ANTIGRAVITY.md** — Quando for pedir ao Antigravity.
   - Copiar um prompt por fase
   - Colar no Antigravity (com as 3 referências)

**Tempo total:** 30–40 min

---

### 👨‍💻 Se você é o Antigravity (Agente de Implementação)

1. **AGENT_CONTEXT.md** — Leia primeiro (ENTRADA).
   - Invariantes (regras de ouro)
   - Estrutura de diretórios
   - Qual é a sua fase

2. **SPEC_ASSISTENTE_LOCAL.md** — Consulte conforme precisa.
   - Seção 2 (arquitetura geral)
   - Seção 3 (seu fluxo específico)
   - Seção 6 (referência de dados)

3. **KB_EXAMPLES.md** — Copie os exemplos.
   - JSONs com templates
   - Copy/paste dos 4 arquivos de conteúdo

4. **PROMPTS_ANTIGRAVITY.md** — Seu briefing.
   - Prompt da sua FASE
   - Checklist de entrega
   - Critérios de aceite

**Workflow:**
```
Antigravity recebe:
  ↓
  Lê AGENT_CONTEXT.md (5 min)
  ↓
  Abre prompt da FASE em PROMPTS_ANTIGRAVITY.md
  ↓
  Consulta SPEC_ASSISTENTE_LOCAL.md conforme precisa
  ↓
  Copy/paste de KB_EXAMPLES.md para JSONs
  ↓
  Implementa + testa
  ↓
  Checkllist de PR (AGENT_CONTEXT.md)
```

---

### 👨‍🔬 Se você é desenvolvedor do time (revisão de PR)

1. **AGENT_CONTEXT.md** — Seção "Checklist — Como adicionar uma tela NOVA"
   - 9 itens que o PR deve incluir

2. **SPEC_ASSISTENTE_LOCAL.md** — Seção 5 (conhecimento base) e 7 (implementação)
   - Para validar completude do journey/topic/screenshot

**Tempo:** 10 min / PR

---

## 📋 Estrutura dos 4 arquivos

### 1. SPEC_ASSISTENTE_LOCAL.md (34 KB)
**O QUÊ:** Especificação técnica completa.

**Contém:**
- Visão geral (seção 1)
- Arquitetura + padrões (seção 2)
- Onboarding guiado (seção 3.3)
- Modo Guiado com spotlight (seção 3.5)
- Perfis de Operação (seção 3-A)
- Tours de Processo / Journeys (seção 3-B)
- Banco de Categorias (seção 4)
- Ajuda Contextual (seção 5)
- Manual com screenshots (seção 6)
- Plano de implementação (fase 1–5) (seção 7)
- Critérios de aceite (seção 8)

**Use quando:**
- Precisa entender a arquitetura
- Quer detalhe de um componente específico
- Vai revisar um PR

**Tamanho:** 34 KB, 546 linhas

---

### 2. AGENT_CONTEXT.md (13 KB)
**O QUÊ:** Contexto para o Antigravity + checklist prático.

**Contém:**
- Resumo (O que é, por que assim)
- 7 Invariantes obrigatórios
- Estrutura de diretórios esperada (copy/paste)
- Fases 1–6 detalhadas (o que sai de cada fase)
- Checklist de tela nova (para PRs)
- Como consultar em caso de dúvida

**Use quando:**
- Está começando (checklist de setup)
- Quer briefar o Antigravity
- Vai revisar uma tela nova

**Tamanho:** 13 KB, 380 linhas

---

### 3. KB_EXAMPLES.md (34 KB)
**O QUÊ:** Exemplos reais dos 4 JSONs (copiar e estender).

**Contém:**
- `onboarding_script.json` (10 steps completos)
- `journeys.json` (4 tours: venda, embalagem, compra, OP)
- `knowledge_base.json` (3 topics + 5 FAQ)
- `categories_seed.json` (140+ categorias por tipo)

**Use quando:**
- Precisa escrever um JSON novo
- Quer ver o padrão de estrutura
- Vai fazer PR com novo journey/topic

**Tamanho:** 34 KB, 800+ linhas

---

### 4. PROMPTS_ANTIGRAVITY.md (22 KB)
**O QUÊ:** Prompts prontos para colar no Antigravity (um por fase).

**Contém:**
- Prompt FASE 1 — Fundação (modelos + engines)
- Prompt FASE 2 — Ajuda Contextual (BottomSheet)
- Prompt FASE 3A — Perfis (REVENDA / REVENDA_PRODUCAO)
- Prompt FASE 3B — Onboarding + Spotlight
- Prompt FASE 4 — Journeys (tours de processo)
- Prompt FASE 5 — Manual + Conteúdo
- Como copiar e colar

**Use quando:**
- Vai pedir implementação ao Antigravity
- Quer briefing estruturado (copiar/colar)

**Tamanho:** 22 KB, 600+ linhas

---

## 🚀 Fluxo prático: Do zero até production

### Semana 1: Setup + Aprovação

```
TÁ (Você)
  ↓
  Lê SPEC + AGENT_CONTEXT (45 min)
  ↓
  Aprova arquitetura?
  ├─ Sim → próximo
  └─ Não → faz comentários, volta versão pra Claude
  ↓
  Fornece ScreenIds reais do seu app
  ↓
  Briefings o Antigravity:
    "Implementa FASE 1 conforme arquivo anexado (PROMPTS_ANTIGRAVITY.md)"
  ↓
Antigravity (Agente)
  ↓
  Lê AGENT_CONTEXT (5 min)
  ↓
  Copia prompt FASE 1 de PROMPTS_ANTIGRAVITY
  ↓
  Consulta SPEC conforme precisa
  ↓
  Copy/paste de KB_EXAMPLES para JSONs iniciais
  ↓
  Implementa FASE 1 (modelos + engines + testes)
  ↓
  PR com checklist completo
  ↓
```

### Semana 2–4: Fases 2–5

```
Você revisa PR (usando checklist AGENT_CONTEXT)
  ↓
  Aprova ou pede ajustes
  ↓
  Próxima FASE inicia (Antigravity + você colaboram no conteúdo JSON)
```

---

## 📱 Como usar os arquivos no projeto

### Local recomendado

```
seu-projeto/
├── docs/
│   ├── SPEC_ASSISTENTE_LOCAL.md       ← Colar aqui
│   ├── AGENT_CONTEXT.md               ← Colar aqui
│   ├── KB_EXAMPLES.md                 ← Referência (copiar de)
│   ├── PROMPTS_ANTIGRAVITY.md         ← Referência (copiar de)
│   ├── MANUAL.md                      ← Seu manual vivo (vai vir na Fase 5)
│   └── manual/
│       └── screenshots/               ← PNGs/WebPs (vai vir na Fase 5)
│
├── app/src/main/assets/kb/            ← Assets offline
│   ├── onboarding_script.json          ← De KB_EXAMPLES (vai evoluir)
│   ├── journeys.json
│   ├── knowledge_base.json
│   └── categories_seed.json
│
└── app/src/main/kotlin/com/yourcompany/app/assistant/
    ├── engine/
    │   ├── AssistantEngine.kt          ← De FASE 1
    │   ├── OnboardingFlowEngine.kt
    │   ├── model/
    │   └── backend/
    ├── data/
    │   ├── AssistantRepository.kt
    │   └── ...
    └── ui/
        ├── AssistantSheetFragment.kt   ← De FASE 2
        ├── OnboardingActivity.kt       ← De FASE 3
        └── guided/
            └── ...                      ← De FASE 3.5 + 4
```

---

## ✅ Checklist de uso

### Antes de briefar o Antigravity

- [ ] Li SPEC_ASSISTENTE_LOCAL.md (tudo)
- [ ] Li AGENT_CONTEXT.md (invariantes + estrutura)
- [ ] Validei ScreenIds reais do meu app contra o enumerado na SPEC
- [ ] Salvei os 4 arquivos no repo (docs/)
- [ ] Selecionei qual FASE começar (recomendado: FASE 1)

### Ao briefar o Antigravity

- [ ] Copiei o prompt da FASE escolhida (PROMPTS_ANTIGRAVITY.md)
- [ ] Colei no Antigravity
- [ ] Incluí as 3 referências (caminhos ou links dos 3 arquivos)
- [ ] Mencionei: "Siga invariantes em AGENT_CONTEXT.md"

### Ao revisar PR (seu time)

- [ ] Usei checklist de PR (AGENT_CONTEXT.md)
- [ ] Verifiquei: screenshot + topic + journey + manual (se tela nova)
- [ ] Testei offline (desligar internet)
- [ ] Desativei flags → sem erro, sem crash

---

## 🎯 TL;DR (Super-rápido)

### Copiar/colar imediato?

1. Pegue o arquivo `.md` que você precisa (4 opções no outputs)
2. Crie `docs/SPEC_ASSISTENTE_LOCAL.md` no projeto
3. Crie `docs/AGENT_CONTEXT.md` no projeto
4. Quando for briefar Antigravity: copie PROMPTS_ANTIGRAVITY.md (só um prompt, sua FASE)
5. Antigravity copia JSONs de KB_EXAMPLES.md

### Referência para dúvidas?

→ SPEC_ASSISTENTE_LOCAL.md

### Checklist de tela nova?

→ AGENT_CONTEXT.md (última seção)

### Começar desenvolvimento?

→ PROMPTS_ANTIGRAVITY.md (prompt FASE 1)

---

## 📧 Próximas ações

### Você (Tiago)

1. **Agora:** Copie os 4 arquivos para `docs/` do seu projeto
2. **Hoje:** Leia SPEC (1h) + AGENT_CONTEXT (30 min)
3. **Amanhã:** Liste ScreenIds reais do seu app (todos os Fragment/Activity)
4. **Depois:** Briefa o Antigravity com prompt FASE 1 + referências

### Antigravity (quando receber o brief)

1. Leia AGENT_CONTEXT.md
2. Abra PROMPTS_ANTIGRAVITY.md (encontre sua FASE)
3. Copy/paste de KB_EXAMPLES.md conforme precisa
4. Implemente + siga checklist

### Seu time (revisores)

- Estudem AGENT_CONTEXT.md (seção "Checklist de tela nova")
- Usem esse checklist em toda PR do assistente

---

## 📞 Perguntas frequentes (FAQ)

### P: Posso começar já com Fase 2 sem fazer Fase 1?
**R:** Não. Fase 1 (modelos + engines) é pré-requisito. FASE 2 depende de Fase 1.

### P: Preciso mudar os JSONs toda vez que mudo uma tela?
**R:** Sim, mas é simples: 1 screenshot novo, 1 topic novo, 1 seção manual nova, 1 journey (se processo). Checklist de PR garante isso.

### P: E se quiser LLM depois?
**R:** Interface `AssistantBackend` já existe vazia. Fase 6 plugaria `LocalLlmBackend`. A KB e todos os JSONs reutilizam.

### P: Modo offline garante 100%?
**R:** Sim. Todos os 4 JSONs vão em `assets/kb/` (empacotados no APK). Zero rede necessária.

### P: Quantas linhas de código?
**R:** Fase 1–3: ~2–3K linhas. Fase 4–5: +1K (tours + conteúdo).

### P: Desligar flags quebra o app?
**R:** Não. Se desativar ASSISTANT_ENABLED, módulo inteiro desaparece sem erro.

---

## 📝 Versão deste índice
- **Data:** 21 de agosto de 2026
- **Versão:** 1.0
- **Atualizado por:** Claude (sistema de spec para Tiago)
- **Próxima revisão:** Após Fase 1 (feedback do Antigravity)

---

**Pronto para começar?** Copie os 4 arquivos e siga o checklist acima. 🚀

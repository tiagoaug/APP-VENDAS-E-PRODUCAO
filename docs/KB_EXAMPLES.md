# KB_EXAMPLES — Exemplos dos JSONs (copie e estenda)

> **Uso:** Antigravity copia estes exemplos como base para preencher/estender os 4 JSONs
> **Local:** `assets/kb/` do app

---

## 1. onboarding_script.json — Roteiro de Recepção

Salvar em: `app/src/main/assets/kb/onboarding_script.json`

**Copie e estenda este modelo:**

```json
{
  "version": 1,
  "steps": [
    {
      "id": "welcome",
      "type": "message",
      "text": "Olá! 👋 Eu sou o assistente do programa. Vou te acompanhar na configuração inicial. Em poucos minutos você terá seu primeiro produto pronto para vender. Vamos começar?",
      "options": [
        { "label": "Vamos lá!", "goto": "profile_choice" },
        { "label": "Já uso o programa, pular guia", "goto": "finish_skip" }
      ]
    },
    {
      "id": "profile_choice",
      "type": "single_select",
      "text": "Como funciona o seu negócio? 🏪",
      "options": [
        { "label": "Só revendo produtos prontos", "value": "REVENDA", "goto": "empresa_nome" },
        { "label": "Eu fabrico (ou fabrico e revendo)", "value": "REVENDA_PRODUCAO", "goto": "empresa_nome" }
      ],
      "persistAction": "saveProfile(${value})"
    },
    {
      "id": "empresa_nome",
      "type": "input_text",
      "text": "Primeiro, como se chama a sua empresa ou marca?",
      "field": "empresa.nome",
      "placeholder": "Ex.: Calçados XYZ",
      "validation": { "required": true, "minLength": 2, "maxLength": 100 },
      "hint": "Este nome aparecerá em pedidos e documentos.",
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
      "modes": ["REVENDA", "REVENDA_PRODUCAO"],
      "type": "multi_select_seed",
      "text": "Quais categorias de PRODUTOS você quer usar? Marque as sugestões ou crie as suas:",
      "seedRef": "categories_seed.json#produtos",
      "allowCustom": true,
      "validation": { "required": true, "minSelected": 1 },
      "persistAction": "insertCategorias(tipo=PRODUTO)",
      "goto": "categorias_despesas_pick"
    },
    {
      "id": "categorias_despesas_pick",
      "modes": ["REVENDA", "REVENDA_PRODUCAO"],
      "type": "multi_select_seed",
      "text": "E as categorias de DESPESAS?",
      "seedRef": "categories_seed.json#despesas",
      "allowCustom": true,
      "persistAction": "insertCategorias(tipo=DESPESA)",
      "goto": "categorias_receitas_pick"
    },
    {
      "id": "categorias_receitas_pick",
      "modes": ["REVENDA", "REVENDA_PRODUCAO"],
      "type": "multi_select_seed",
      "text": "E as categorias de RECEITAS?",
      "seedRef": "categories_seed.json#receitas",
      "allowCustom": true,
      "persistAction": "insertCategorias(tipo=RECEITA)",
      "goto": "cores_intro"
    },
    {
      "id": "cores_intro",
      "type": "message",
      "text": "Perfeito! ✅ Agora vamos cadastrar as cores que você trabalha. Assim você consegue controlar o estoque por cor e tamanho.",
      "options": [ { "label": "Adicionar cores", "goto": "cores_form" } ]
    },
    {
      "id": "cores_form",
      "type": "entity_form",
      "screen": "cores",
      "title": "Adicionar Cores",
      "guidedFields": [
        { "fieldKey": "cor.nome", "text": "Nome da cor. Ex.: Preto, Vermelho, Azul Marinho." },
        { "fieldKey": "cor.codigo_hex", "text": "Código hexadecimal (opcional). Ex.: #000000 para preto.", "required": false }
      ],
      "persistAction": "insertCor()",
      "repeatLabel": "Adicionar outra cor?",
      "onComplete": { "goto": "grades_intro" }
    },
    {
      "id": "grades_intro",
      "type": "message",
      "text": "Agora as grades de tamanho. Você vende mais adulto ou infantil? Ou ambos?",
      "options": [
        { "label": "Adulto (34–43)", "goto": "grades_adulto" },
        { "label": "Infantil (22–36)", "goto": "grades_infantil" },
        { "label": "Ambas", "goto": "grades_adulto_infantil" },
        { "label": "Outra grade", "goto": "grades_custom" }
      ]
    },
    {
      "id": "grades_adulto",
      "type": "entity_form",
      "screen": "grade_tamanhos",
      "persistAction": "insertGrade(nome='Adulto', tamanhos='34,35,36,37,38,39,40,41,42,43')",
      "onComplete": { "goto": "materiais_intro" }
    },
    {
      "id": "grades_infantil",
      "type": "entity_form",
      "screen": "grade_tamanhos",
      "persistAction": "insertGrade(nome='Infantil', tamanhos='22,23,24,25,26,27,28,29,30,31,32,33,34,35,36')",
      "onComplete": { "goto": "materiais_intro" }
    },
    {
      "id": "grades_adulto_infantil",
      "type": "message",
      "text": "Vou cadastrar as duas. Um momento...",
      "persistAction": "insertGrade(nome='Adulto', tamanhos='34,35,36,37,38,39,40,41,42,43'); insertGrade(nome='Infantil', tamanhos='22,23,24,25,26,27,28,29,30,31,32,33,34,35,36')",
      "goto": "materiais_intro"
    },
    {
      "id": "grades_custom",
      "type": "entity_form",
      "screen": "grade_tamanhos",
      "onComplete": { "goto": "materiais_intro" }
    },
    {
      "id": "materiais_intro",
      "modes": ["REVENDA_PRODUCAO"],
      "type": "message",
      "text": "Como você fabrica, vamos cadastrar os materiais que você usa: couro, sola, cadarço, cola... Com eles, o programa calcula o custo real de cada par automaticamente.",
      "options": [
        { "label": "Cadastrar materiais", "goto": "materiais_form" },
        { "label": "Pular por agora", "goto": "produto_intro" }
      ]
    },
    {
      "id": "materiais_form",
      "modes": ["REVENDA_PRODUCAO"],
      "type": "entity_form",
      "screen": "material_cadastro",
      "title": "Novo Material",
      "guidedFields": [
        { "fieldKey": "material.nome", "text": "Nome do material. Ex.: Couro Premium, Sola Borracha, Cadarço Nylon." },
        { "fieldKey": "material.unidade", "text": "Unidade. Ex.: m², kg, m, unidade." },
        { "fieldKey": "material.custo_unitario", "text": "Custo unitário. Ex.: R$ 50,00 / m²." }
      ],
      "persistAction": "insertMaterial()",
      "repeatLabel": "Adicionar outro material?",
      "onComplete": { "goto": "produto_intro" }
    },
    {
      "id": "produto_intro",
      "type": "message",
      "text": "Agora vamos criar seu primeiro produto. 👟",
      "options": [ { "label": "Criar produto", "goto": "produto_form" } ]
    },
    {
      "id": "produto_form",
      "type": "entity_form",
      "screen": "produto_cadastro",
      "title": "Novo Produto",
      "guidedFields": [
        { "fieldKey": "produto.nome", "text": "Digite o nome do modelo. Ex.: Tênis Casual Urban, Sandália Conforto, Bota Explorer." },
        { "fieldKey": "produto.categoria", "text": "Escolha a categoria. Você criou elas há pouco, lembra? 😉" },
        { "fieldKey": "produto.cores", "text": "Marque as cores disponíveis deste modelo." },
        { "fieldKey": "produto.grade", "text": "Selecione a grade de tamanhos." },
        { "fieldKey": "produto.ficha_tecnica", "text": "Monte a ficha técnica: quais materiais compõem este calçado e em que quantidade.", "required": false, "skipLabel": "Montar depois" },
        { "fieldKey": "produto.preco_venda", "text": "Defina o preço de venda." },
        { "fieldKey": "produto.preco_custo", "text": "Preço de custo (será calculado automaticamente pela ficha). Se for revenda, digite o preço de compra." }
      ],
      "persistAction": "insertProduto()",
      "onComplete": { "goto": "fornecedor_intro" }
    },
    {
      "id": "fornecedor_intro",
      "type": "message",
      "text": "Ótimo! 🎉 Seu primeiro produto foi criado. Agora vamos vincular os fornecedores dos materiais (opcional — você faz depois se preferir).",
      "options": [
        { "label": "Cadastrar fornecedores", "goto": "fornecedor_form" },
        { "label": "Pular", "goto": "pagamento_intro" }
      ]
    },
    {
      "id": "fornecedor_form",
      "type": "entity_form",
      "screen": "fornecedor_cadastro",
      "title": "Novo Fornecedor",
      "persistAction": "insertFornecedor()",
      "repeatLabel": "Adicionar outro fornecedor?",
      "onComplete": { "goto": "pagamento_intro" }
    },
    {
      "id": "pagamento_intro",
      "type": "message",
      "text": "Agora as formas de pagamento que você oferece (dinheiro, cartão, PIX, etc.).",
      "options": [ { "label": "Definir formas", "goto": "pagamento_form" } ]
    },
    {
      "id": "pagamento_form",
      "type": "entity_form",
      "screen": "formas_pagamento",
      "title": "Formas de Pagamento",
      "persistAction": "insertFormaPagamento()",
      "repeatLabel": "Adicionar outra forma?",
      "onComplete": { "goto": "cliente_intro" }
    },
    {
      "id": "cliente_intro",
      "type": "message",
      "text": "Quase pronto! ✨ Você quer cadastrar clientes específicos agora, ou começar vendendo direto para 'Consumidor Final'?",
      "options": [
        { "label": "Cadastrar clientes", "goto": "cliente_form" },
        { "label": "Começar logo", "goto": "finish_success" }
      ]
    },
    {
      "id": "cliente_form",
      "type": "entity_form",
      "screen": "cliente_cadastro",
      "title": "Novo Cliente",
      "persistAction": "insertCliente()",
      "repeatLabel": "Adicionar outro cliente?",
      "onComplete": { "goto": "finish_success" }
    },
    {
      "id": "finish_success",
      "type": "summary",
      "title": "Parabéns! 🎉",
      "sections": [
        { "heading": "Você concluiu a configuração inicial", "body": "✅ Empresa criada\n✅ Categorias definidas\n✅ Cores, grades e produto cadastrados\n✅ Formas de pagamento configuradas" },
        { "heading": "Próximos passos", "body": "1. Faça sua primeira venda (veja o guia 'Como fazer uma venda')\n2. Cadastre mais produtos conforme precisar\n3. Configure suas integrações com Bling, Mercado Livre e Shopee em Configurações" }
      ],
      "options": [
        { "label": "Começar a usar o programa", "goto": "finish_close_home" }
      ]
    },
    {
      "id": "finish_skip",
      "type": "message",
      "text": "Beleza! Você pode acessar este guia a qualquer momento no assistente (ícone de ajuda). Bom trabalho! 💪",
      "goto": "finish_close_home"
    },
    {
      "id": "finish_close_home",
      "type": "finish",
      "action": "closeAndNavigateTo(SCREEN_HOME)"
    }
  ]
}
```

---

## 2. journeys.json — Tours de Processo

Salvar em: `app/src/main/assets/kb/journeys.json`

**Copie e estenda este modelo:**

```json
{
  "version": 1,
  "journeys": [
    {
      "id": "tour_fazer_venda",
      "title": "Como fazer uma venda",
      "description": "Passo a passo para vender um produto direto ou para um cliente",
      "modes": ["REVENDA", "REVENDA_PRODUCAO"],
      "entryScreen": "home",
      "estimatedMinutes": 5,
      "steps": [
        {
          "id": "step_1",
          "type": "message",
          "screen": "home",
          "text": "Vamos fazer sua primeira venda! 📦 Abra o menu 'Vendas' para começar."
        },
        {
          "id": "step_2",
          "type": "highlight_tap",
          "screen": "pedido_venda_lista",
          "anchorKey": "fab.nova_venda",
          "text": "Toque aqui para criar um novo pedido de venda.",
          "timeout": 30
        },
        {
          "id": "step_3",
          "type": "guided_field",
          "screen": "pedido_venda",
          "fieldKey": "venda.cliente",
          "text": "Escolha o cliente — ou use 'Consumidor Final' para venda de balcão.",
          "required": true
        },
        {
          "id": "step_4",
          "type": "guided_field",
          "screen": "pedido_venda",
          "fieldKey": "venda.itens",
          "text": "Adicione os produtos: modelo, cor e tamanho. O estoque daquela variação aparece aqui.",
          "required": true
        },
        {
          "id": "step_5",
          "type": "guided_field",
          "screen": "pedido_venda",
          "fieldKey": "venda.pagamento",
          "text": "Defina a forma e a condição de pagamento (à vista, 30 dias, etc.).",
          "required": true
        },
        {
          "id": "step_6",
          "type": "highlight_tap",
          "screen": "pedido_venda",
          "anchorKey": "btn.finalizar",
          "text": "Finalize a venda. O estoque baixa automaticamente e a receita entra no financeiro. 🎉"
        },
        {
          "id": "step_7",
          "type": "message",
          "screen": "pedido_venda_lista",
          "text": "Pronto! A venda foi registrada. Agora você pode imprimir o pedido, emitir NF (se necessário) ou gravar a embalagem.",
          "options": [
            { "label": "Aprender sobre embalagens", "action": "startJourney(tour_gravar_embalagem)" }
          ]
        }
      ]
    },
    {
      "id": "tour_gravar_embalagem",
      "title": "Como gravar a embalagem de um produto",
      "description": "Configure dimensões, peso e custo da embalagem para cálculo de frete",
      "modes": ["REVENDA", "REVENDA_PRODUCAO"],
      "entryScreen": "produto_lista",
      "estimatedMinutes": 3,
      "steps": [
        {
          "id": "step_1",
          "type": "message",
          "screen": "produto_lista",
          "text": "As informações de embalagem são usadas para calcular o frete nos marketplaces (Mercado Livre, Shopee) via Bling. Vamos configurar!"
        },
        {
          "id": "step_2",
          "type": "highlight_tap",
          "screen": "produto_lista",
          "anchorKey": "item.produto",
          "text": "Abra um produto para editar sua embalagem."
        },
        {
          "id": "step_3",
          "type": "highlight_tap",
          "screen": "produto_cadastro",
          "anchorKey": "tab.embalagem",
          "text": "Vá para a aba 'Embalagem'."
        },
        {
          "id": "step_4",
          "type": "guided_field",
          "screen": "produto_embalagem",
          "fieldKey": "emb.tipo",
          "text": "Escolha o tipo de embalagem: Caixa individual, Saco, Caixa Master, Embalagem Personalizada, etc.",
          "required": true
        },
        {
          "id": "step_5",
          "type": "guided_field",
          "screen": "produto_embalagem",
          "fieldKey": "emb.comprimento",
          "text": "Comprimento em cm.",
          "required": true
        },
        {
          "id": "step_6",
          "type": "guided_field",
          "screen": "produto_embalagem",
          "fieldKey": "emb.largura",
          "text": "Largura em cm.",
          "required": true
        },
        {
          "id": "step_7",
          "type": "guided_field",
          "screen": "produto_embalagem",
          "fieldKey": "emb.altura",
          "text": "Altura em cm.",
          "required": true
        },
        {
          "id": "step_8",
          "type": "guided_field",
          "screen": "produto_embalagem",
          "fieldKey": "emb.peso",
          "text": "Peso total com embalagem, em kg. Este é o peso que a transportadora cobra.",
          "required": true
        },
        {
          "id": "step_9",
          "type": "guided_field",
          "screen": "produto_embalagem",
          "fieldKey": "emb.custo",
          "text": "Custo unitário da embalagem (R$). Entra no custo total do produto.",
          "required": false,
          "skipLabel": "Sem custo de embalagem"
        },
        {
          "id": "step_10",
          "type": "highlight_tap",
          "screen": "produto_embalagem",
          "anchorKey": "btn.salvar",
          "text": "Salve as informações. Pronto! 👍"
        }
      ]
    },
    {
      "id": "tour_entrada_compra",
      "title": "Como registrar entrada de compra de material",
      "description": "Receba materiais/insumos do fornecedor e atualize o estoque",
      "modes": ["REVENDA_PRODUCAO"],
      "entryScreen": "estoque",
      "estimatedMinutes": 4,
      "steps": [
        {
          "id": "step_1",
          "type": "message",
          "screen": "estoque",
          "text": "Quando você recebe materiais do fornecedor, registra aqui. Assim o programa sabe quanto você tem disponível para produzir."
        },
        {
          "id": "step_2",
          "type": "highlight_tap",
          "screen": "estoque",
          "anchorKey": "btn.entrada_compra",
          "text": "Toque em 'Entrada de Compra'."
        },
        {
          "id": "step_3",
          "type": "guided_field",
          "screen": "entrada_compra",
          "fieldKey": "compra.fornecedor",
          "text": "Selecione o fornecedor.",
          "required": true
        },
        {
          "id": "step_4",
          "type": "guided_field",
          "screen": "entrada_compra",
          "fieldKey": "compra.data",
          "text": "Data de recebimento.",
          "required": true
        },
        {
          "id": "step_5",
          "type": "guided_field",
          "screen": "entrada_compra",
          "fieldKey": "compra.itens",
          "text": "Adicione os materiais: qual, quanto você recebeu, qual o custo.",
          "required": true
        },
        {
          "id": "step_6",
          "type": "highlight_tap",
          "screen": "entrada_compra",
          "anchorKey": "btn.finalizar",
          "text": "Finalize. O estoque de materiais aumenta automaticamente e a despesa entra no financeiro."
        }
      ]
    },
    {
      "id": "tour_ordem_producao",
      "title": "Como abrir uma ordem de produção",
      "description": "Organize a produção de um produto com matéria-prima reservada",
      "modes": ["REVENDA_PRODUCAO"],
      "entryScreen": "ordem_producao",
      "estimatedMinutes": 5,
      "steps": [
        {
          "id": "step_1",
          "type": "message",
          "screen": "ordem_producao",
          "text": "Uma Ordem de Produção (OP) reserva os materiais necessários para fazer um lote do produto e acompanha o progresso da produção."
        },
        {
          "id": "step_2",
          "type": "highlight_tap",
          "screen": "ordem_producao_lista",
          "anchorKey": "fab.nova_op",
          "text": "Toque para criar uma nova OP."
        },
        {
          "id": "step_3",
          "type": "guided_field",
          "screen": "ordem_producao",
          "fieldKey": "op.produto",
          "text": "Escolha qual produto você quer produzir.",
          "required": true
        },
        {
          "id": "step_4",
          "type": "guided_field",
          "screen": "ordem_producao",
          "fieldKey": "op.quantidade",
          "text": "Quantos pares você quer fazer?",
          "required": true
        },
        {
          "id": "step_5",
          "type": "message",
          "screen": "ordem_producao",
          "text": "O programa calcula automaticamente os materiais necessários pela ficha técnica e reserva do estoque.",
          "skipLabel": "Continuar"
        },
        {
          "id": "step_6",
          "type": "guided_field",
          "screen": "ordem_producao",
          "fieldKey": "op.data_inicio",
          "text": "Data de início da produção.",
          "required": false
        },
        {
          "id": "step_7",
          "type": "highlight_tap",
          "screen": "ordem_producao",
          "anchorKey": "btn.criar",
          "text": "Crie a OP. Você poderá acompanhar a produção, registrar apontamentos e dar ela como pronta quando terminar."
        }
      ]
    }
  ]
}
```

---

## 3. knowledge_base.json — Ajuda e Tópicos por Tela

Salvar em: `app/src/main/assets/kb/knowledge_base.json`

**Copie e estenda este modelo:**

```json
{
  "version": 1,
  "topics": [
    {
      "screenId": "home",
      "title": "Tela Inicial",
      "screenshot": "manual/screenshots/home.png",
      "summary": "Painel principal do programa. Acesse todos os módulos: Vendas, Cadastros, Estoque, Financeiro e mais.",
      "sections": [
        {
          "heading": "Visão geral",
          "body": "A tela inicial mostra um resumo do seu negócio: vendas do dia, pendências, alertas de estoque baixo e atalhos para as áreas principais."
        },
        {
          "heading": "Seções",
          "body": "📊 Dashboard: gráficos de vendas e receitas\n📦 Vendas: fazer pedidos, acompanhar status\n📋 Cadastros: produtos, clientes, fornecedores\n📦 Estoque: controle de quantidades\n💰 Financeiro: despesas, receitas e fluxo de caixa\n⚙️ Configurações: dados da empresa, integrações"
        },
        {
          "heading": "Botões flutuantes",
          "body": "+ Venda: cria um novo pedido de venda rápido\n+ Cadastro: novo produto ou cliente"
        },
        {
          "heading": "Dicas",
          "body": "Toque no ícone de ajuda (?) em qualquer tela para ver orientações específicas daquela tela.\nVocê também pode acessar guias passo a passo no menu de assistente."
        }
      ],
      "keywords": ["home", "inicial", "painel", "dashboard", "menu", "principal"],
      "relatedScreens": ["pedido_venda_lista", "produto_lista", "estoque", "financeiro_receitas"]
    },
    {
      "screenId": "produto_cadastro",
      "title": "Cadastro de Produto",
      "screenshot": "manual/screenshots/produto_cadastro.png",
      "summary": "Crie um produto completo: nome, categoria, cores, grades, ficha técnica de materiais, preço e embalagem.",
      "sections": [
        {
          "heading": "Abas da tela",
          "body": "📝 Informações: nome, categoria, descrição\n🎨 Cores e Grades: variações disponíveis\n⚙️ Ficha Técnica: materiais que compõem (só produção)\n📦 Embalagem: dimensões, peso, custo\n💰 Preços: venda, custo e margem"
        },
        {
          "heading": "Campos obrigatórios",
          "body": "Nome do produto, Categoria, Pelo menos 1 Cor, Pelo menos 1 Grade de Tamanho.\nSem grade, o estoque por tamanho não funciona."
        },
        {
          "heading": "Ficha Técnica (só produção)",
          "body": "Se você fabrica, monte aqui a receita: quais materiais e quanto de cada um entra em um par.\nO custo calculado automaticamente: soma do custo de todos os materiais × quantidade."
        },
        {
          "heading": "Embalagem",
          "body": "Dimensões (cm) e peso (kg) são usados para calcular frete nos marketplaces (Bling integrado).\nCusto da embalagem entra no custo total do produto."
        },
        {
          "heading": "Dicas",
          "body": "Cadastre cores e grades ANTES de criar o produto.\nPara revenda: deixe 'Ficha Técnica' vazia e use o campo 'Preço de Custo' direto.\nPara produção: monte a ficha técnica e o programa calcula tudo."
        }
      ],
      "keywords": ["produto", "modelo", "cadastrar", "criar", "ficha", "tecnica", "custo", "preco", "cores", "tamanho", "variação"],
      "relatedScreens": ["cores", "grade_tamanhos", "material_cadastro", "produto_embalagem", "categorias"]
    },
    {
      "screenId": "pedido_venda",
      "title": "Pedido de Venda",
      "screenshot": "manual/screenshots/pedido_venda.png",
      "summary": "Registre uma venda: cliente, produtos, quantidades, preço, forma de pagamento.",
      "sections": [
        {
          "heading": "Passo a passo",
          "body": "1. Escolha o cliente (ou 'Consumidor Final')\n2. Adicione produtos: qual modelo, cor, tamanho, quantidade\n3. Revise os preços\n4. Escolha forma e condição de pagamento\n5. Finalize\n\nO estoque baixa automaticamente e a receita entra no financeiro."
        },
        {
          "heading": "Cliente",
          "body": "Selecione um cliente existente ou crie um novo.\nPara vendas sem cliente específico (balcão), use 'Consumidor Final'."
        },
        {
          "heading": "Itens",
          "body": "Escolha o produto, cor e tamanho.\nO programa mostra o estoque daquela variação.\nDigite a quantidade vendida.\nO preço unitário vem do cadastro do produto, mas pode ser alterado aqui."
        },
        {
          "heading": "Pagamento",
          "body": "Forma: Dinheiro, Cartão (débito/crédito), PIX, Cheque, etc.\nCondição: À vista, 30, 60, 90 dias.\nSe for a prazo, você pode lançar as parcelas automaticamente."
        },
        {
          "heading": "Dicas",
          "body": "Você pode adicionar vários produtos no mesmo pedido.\nA nota fiscal (NF) é emitida depois se necessário.\nAntes de finalizar, confira o total e as informações de cliente e pagamento."
        }
      ],
      "keywords": ["venda", "pedido", "cliente", "produto", "quantidade", "preco", "pagamento", "cartao", "dinheiro", "pix"],
      "relatedScreens": ["cliente_cadastro", "produto_lista", "formas_pagamento", "pedido_venda_lista"]
    },
    {
      "screenId": "ordem_producao",
      "title": "Ordem de Produção",
      "screenshot": "manual/screenshots/ordem_producao.png",
      "summary": "Crie um lote de produção: reserva de materiais, acompanhamento e registros de apontamento.",
      "modes": ["REVENDA_PRODUCAO"],
      "sections": [
        {
          "heading": "Para que serve",
          "body": "A Ordem de Produção (OP) organiza a fabricação de um lote:\n✓ Reserva os materiais necessários (calculados pela ficha técnica)\n✓ Acompanha o progresso da produção\n✓ Gera relatório de custo real vs. previsto"
        },
        {
          "heading": "Criar uma OP",
          "body": "1. Escolha o produto a produzir\n2. Informe a quantidade de pares\n3. O programa calcula os materiais necessários\n4. Defina data de início (opcional)\n5. Finalize\n\nOs materiais são reservados do estoque."
        },
        {
          "heading": "Acompanhar produção",
          "body": "Registre apontamentos:\n- Quantos pares foram concluídos hoje\n- Problemas, desperdícios ou ajustes\n- Tempo de produção\n\nO programa calcula o custo real (materiais + mão-de-obra)."
        },
        {
          "heading": "Finalizar OP",
          "body": "Quando o lote estiver pronto:\n1. Registre o resultado final\n2. Marque como concluída\n3. O estoque de produtos aumenta automaticamente"
        },
        {
          "heading": "Dicas",
          "body": "Se faltar material durante a produção, você pode abrir uma entrada de compra rápida.\nOPs concluídas geram relatório detalhado de custo por par."
        }
      ],
      "keywords": ["producao", "ordem", "op", "lote", "material", "apontamento", "fabricacao"],
      "relatedScreens": ["produto_cadastro", "material_cadastro", "entrada_compra", "estoque"]
    }
  ],
  "faq": [
    {
      "question": "Como o custo do produto é calculado?",
      "keywords": ["custo", "calculo", "preco de custo", "margem", "lucro"],
      "answer": "Para REVENDA: o custo é o preço de compra que você digita no cadastro.\nPara PRODUÇÃO: o custo é a soma dos materiais da ficha técnica (quantidade × custo unitário de cada insumo). Atualize o custo dos materiais para refletir no produto.",
      "linkScreen": "material_cadastro"
    },
    {
      "question": "Como fazer para vender?",
      "keywords": ["venda", "vender", "como fazer venda", "cliente", "pedido", "processo"],
      "answer": "1. Vá para a tela 'Vendas'\n2. Toque no + para criar um novo Pedido de Venda\n3. Escolha o cliente (ou 'Consumidor Final')\n4. Adicione os produtos que será vendido\n5. Escolha a forma de pagamento\n6. Finalize\n\nVocê pode seguir o guia passo a passo 'Como fazer uma venda' para aprender com destaque visual.",
      "linkScreen": "pedido_venda"
    },
    {
      "question": "Qual é a diferença entre REVENDA e REVENDA+PRODUÇÃO?",
      "keywords": ["revenda", "producao", "perfil", "modo", "diferenca"],
      "answer": "REVENDA: você compra produtos prontos e revende. Sem ficha técnica, sem ordem de produção.\nREVENDA+PRODUÇÃO: você fabrica seus próprios produtos (ou fabrica e revende). Tem ficha técnica, ordem de produção, controle de materiais.",
      "linkScreen": "home"
    },
    {
      "question": "O que é 'Ficha Técnica'?",
      "keywords": ["ficha", "tecnica", "receita", "material", "composicao"],
      "answer": "A Ficha Técnica lista os materiais que compõem um produto e a quantidade de cada um (ex.: 0,8 m² de couro, 1 sola de borracha, 2 cadarços).\nO programa usa isso para:\n1. Calcular o custo automaticamente (soma do custo de todos os materiais)\n2. Criar ordens de produção (reserva os materiais necessários)",
      "linkScreen": "material_cadastro"
    },
    {
      "question": "Como voltar a um passo anterior do onboarding?",
      "keywords": ["onboarding", "recepção", "guia", "voltar", "passo anterior", "retomar"],
      "answer": "Você pode usar o botão 'Voltar' no balão do assistente durante o onboarding.\nSe fechar e reabrir o app, ele retoma do mesmo passo (salva o progresso automaticamente).\nTambém pode acessar o onboarding novamente em Configurações → Assistente → 'Refazer recepção'.",
      "linkScreen": "home"
    }
  ]
}
```

---

## 4. categories_seed.json — Banco de Sugestões

Salvar em: `app/src/main/assets/kb/categories_seed.json`

**Copie e estenda este modelo:**

```json
{
  "version": 1,
  "produtos": [
    "Tênis",
    "Sapatênis",
    "Sapato Social",
    "Sapato Casual",
    "Bota",
    "Coturno",
    "Sandália",
    "Rasteirinha",
    "Chinelo",
    "Sapatilha",
    "Scarpin",
    "Mocassim",
    "Papete",
    "Tamanco",
    "Infantil",
    "Esportivo",
    "Segurança/EPI",
    "Acessórios (meias, palmilhas, cadarços)"
  ],
  "despesas": [
    {
      "name": "Matéria-prima / Insumos",
      "modes": ["REVENDA_PRODUCAO"]
    },
    {
      "name": "Mão de obra / Salários",
      "modes": ["REVENDA_PRODUCAO"]
    },
    {
      "name": "Mão de obra de Produção",
      "modes": ["REVENDA_PRODUCAO"]
    },
    {
      "name": "Pró-labore",
      "modes": ["REVENDA_PRODUCAO"]
    },
    "Compra de Mercadorias para Revenda",
    "Frete e Entregas",
    "Embalagens",
    "Taxas de Marketplace (Mercado Livre)",
    "Taxas de Marketplace (Shopee)",
    "Taxas de Cartão/Débito",
    "Taxas PIX",
    "Impostos e Tributos",
    "ICMS",
    "PIS/COFINS",
    "Imposto de Renda",
    "Aluguel",
    "Energia Elétrica",
    "Água",
    "Internet e Telefone",
    "Manutenção de Máquinas",
    {
      "name": "Manutenção de Equipamentos",
      "modes": ["REVENDA_PRODUCAO"]
    },
    "Combustível",
    "Marketing e Anúncios",
    "Software e Assinaturas",
    "Material de Escritório",
    "Despesas Bancárias",
    "Seguro",
    "Outras Despesas"
  ],
  "receitas": [
    "Venda no Balcão / Loja Física",
    "Venda Mercado Livre",
    "Venda Shopee",
    "Venda WhatsApp / Direta",
    "Venda Atacado",
    "Venda B2B",
    "Encomenda / Sob Medida",
    "Serviços (conserto, customização)",
    {
      "name": "Serviços de Produção (terceirizados)",
      "modes": ["REVENDA_PRODUCAO"]
    },
    "Frete Cobrado do Cliente",
    "Devolução / Reembolso",
    "Outras Receitas"
  ],
  "gerais": [
    "Clientes Varejo",
    "Clientes Atacado",
    "Clientes B2B",
    "Fornecedores de Couro",
    "Fornecedores de Solado",
    "Fornecedores de Aviamentos",
    {
      "name": "Produção Própria",
      "modes": ["REVENDA_PRODUCAO"]
    },
    "Revenda",
    "Promoção / Liquidação",
    "Lançamento",
    "Linha Verão",
    "Linha Inverno",
    "Linha Premium",
    "Linha Básica"
  ]
}
```

---

## Como usar esses exemplos

### Passo 1: Copiar para o projeto
```bash
# Criar diretório
mkdir -p app/src/main/assets/kb

# Copiar os arquivos JSON (ou criar manualmente)
# Você pode:
# A) Copiar os blocos JSON acima diretamente
# B) Salvar cada seção em um arquivo .json
```

### Passo 2: Estender os exemplos

Os exemplos acima são **mínimos mas funcionais**. Antigravity vai:

1. **Onboarding:** adicionar mais campos conforme suas telas reais (ex.: logotipo da empresa, data de fundação, CNPJ, etc.)
2. **Journeys:** adicionar mais tours (entrada de estoque, recebimento de compra, emissão de nota, integração com Bling, etc.)
3. **Knowledge Base:** adicionar 1 topic por cada ScreenId + FAQ completo
4. **Categories:** ajustar nomes conforme seu modelo financeiro real (ex.: se você usa "Tributação Estadual" em vez de "ICMS", adaptar)

### Passo 3: Validar JSON

Antes de usar, valide os JSONs:

```bash
# Linux/Mac
python3 -m json.tool app/src/main/assets/kb/onboarding_script.json > /dev/null && echo "✅ onboarding_script.json válido"

# No Android Studio (built-in):
# Clicar direito no arquivo > Analyze > Run Inspection
```

---

## Templates de expansão

### Adicionar um novo passo ao onboarding

Copie este template e edite:

```json
{
  "id": "seu_novo_passo",
  "type": "input_text",
  "text": "Sua pergunta aqui?",
  "field": "entidade.campo",
  "placeholder": "Ex.: ...",
  "validation": { "required": true, "minLength": 1 },
  "hint": "Dica para o usuário",
  "goto": "proximo_passo_id"
}
```

### Adicionar um novo tour

```json
{
  "id": "tour_novo_fluxo",
  "title": "Como fazer X",
  "description": "Descrição breve",
  "modes": ["REVENDA", "REVENDA_PRODUCAO"],
  "entryScreen": "home",
  "estimatedMinutes": 5,
  "steps": [
    {
      "id": "step_1",
      "type": "message",
      "screen": "screen_id",
      "text": "Texto introdutório"
    }
  ]
}
```

### Adicionar um novo tópico de ajuda

```json
{
  "screenId": "sua_tela",
  "title": "Título da Tela",
  "screenshot": "manual/screenshots/sua_tela.png",
  "summary": "Uma frase",
  "sections": [
    { "heading": "Seção", "body": "Conteúdo" }
  ],
  "keywords": ["palavra1", "palavra2"],
  "relatedScreens": ["tela1", "tela2"]
}
```

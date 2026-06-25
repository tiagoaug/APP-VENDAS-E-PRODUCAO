package com.musgo.vendaseproducao.printstudio.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.musgo.vendaseproducao.printstudio.model.CutLine
import com.musgo.vendaseproducao.printstudio.model.PAPER_PRESETS
import com.musgo.vendaseproducao.printstudio.model.PaperConfig
import com.musgo.vendaseproducao.printstudio.snap.SnapEngine
import com.musgo.vendaseproducao.printstudio.ui.components.BlockView
import com.musgo.vendaseproducao.printstudio.ui.components.CutLineView
import kotlinx.coroutines.launch

private val DividerColor = Color(0x14000000)

/** Editor de canvas. [onPickImage] delega à Activity (que é quem precisa registrar o
 * ActivityResultLauncher do seletor de imagens) e devolve a URI escolhida pelo callback
 * recebido. O ViewModel é hoisted por quem chama (ver PrintStudioApp) — não usa o factory
 * padrão `viewModel()` aqui porque a mesma instância precisa sobreviver à navegação pra
 * tela de Perfis e voltar.
 *
 * Layout: fundo branco (sem o tom lilás do `surfaceVariant` padrão do M3) com os cards em
 * branco/degradê sutil + elevação pra "flutuarem" sobre o fundo — Perfis/Visualizar/Salvar
 * formam um único subcard de 3 divisões, Papel é um acordeão (fechado mostra só o tamanho
 * escolhido) e Páginas+Linhas de Corte compartilham um card com um subcard de 4 divisões. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditorScreen(
    viewModel: EditorViewModel,
    onPickImage: (onPicked: (uri: String) -> Unit) -> Unit,
    onClose: () -> Unit,
    onOpenProfiles: () -> Unit,
    onSave: (name: String) -> Unit,
    onPreview: () -> Unit,
) {
    val layout by viewModel.layout.collectAsState()
    val selectedBlockId by viewModel.selectedBlockId.collectAsState()
    val currentPageIndex by viewModel.currentPageIndex.collectAsState()
    val missingImageBlockIds by viewModel.missingImageBlockIds.collectAsState()
    val currentProfileName by viewModel.currentProfileName.collectAsState()
    val page = layout.pages.getOrNull(currentPageIndex) ?: layout.pages.first()
    val paper = layout.paper
    val selectedBlock = selectedBlockId?.let { id -> page.blocks.firstOrNull { it.id == id } }
    // Linha de corte que atravessa o bloco selecionado (se houver) — habilita "Separar
    // Bloco" só quando faz sentido (o corte precisa estar DENTRO dos limites do bloco).
    val crossingCutLine = selectedBlock?.let { block ->
        page.cutLines.firstOrNull { cut ->
            if (cut.isVertical) cut.positionMm > block.xMm && cut.positionMm < block.xMm + block.widthMm
            else cut.positionMm > block.yMm && cut.positionMm < block.yMm + block.heightMm
        }
    }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var showSaveDialog by remember { mutableStateOf(false) }
    var paperExpanded by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = Color.White,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Print Studio",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onClose) {
                        Icon(Icons.Filled.Close, contentDescription = "Fechar")
                    }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { onPickImage { uri -> viewModel.addImageBlock(uri, page.id) } },
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text("Imagem") },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White)
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            Text(
                text = "Monte etiquetas e fichas em folhas virtuais: posicione e redimensione imagens, duplique blocos, alinhe com snap automático e gere PDF/JPG ou imprima direto.",
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 12.dp),
            )

            EditorActionBar(
                onOpenProfiles = onOpenProfiles,
                onPreview = onPreview,
                onSaveClick = { showSaveDialog = true },
            )

            PaperControls(
                paper = paper,
                expanded = paperExpanded,
                onToggleExpanded = { paperExpanded = !paperExpanded },
                onPaperChange = viewModel::updatePaper,
            )

            PagesAndCutLinesCard(
                pageCount = layout.pages.size,
                currentPageIndex = currentPageIndex,
                cutLines = page.cutLines,
                onPageSelected = viewModel::setCurrentPageIndex,
                onAddPage = viewModel::addPage,
                onRemovePage = { viewModel.removePage(page.id) },
                onAddCutLine = { isVertical ->
                    val mid = if (isVertical) paper.widthMm / 2f else paper.heightMm / 2f
                    viewModel.addCutLine(page.id, isVertical, mid)
                },
                onRemoveCutLine = { cutLineId -> viewModel.removeCutLine(page.id, cutLineId) },
            )

            Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                Text(
                    text = "Área de Visualização — ${paper.widthMm.toInt()}×${paper.heightMm.toInt()}mm · Pág. ${currentPageIndex + 1}/${layout.pages.size}",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.sp,
                    color = MaterialTheme.colorScheme.primary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
                )

                // Duplicar/Remover ficam ACIMA do canvas (não embaixo) — embaixo, a barra
                // ficava sobreposta pelo FloatingActionButton "+ Imagem", que flutua fixo no
                // canto inferior da tela por cima do conteúdo rolável.
                if (selectedBlockId != null) {
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
                    ) {
                        Row(modifier = Modifier.padding(6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = { viewModel.duplicateBlock(page.id, selectedBlockId!!) },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                            ) {
                                Text("Duplicar")
                            }
                            Button(
                                onClick = { viewModel.removeBlock(page.id, selectedBlockId!!) },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                            ) {
                                Text("Remover")
                            }
                            // Só aparece quando uma linha de corte atravessa o bloco selecionado —
                            // recorta o bitmap de verdade em dois, virando dois blocos independentes
                            // (cada um pode então ir pra uma página diferente, ver "Mover para Página").
                            if (crossingCutLine != null) {
                                OutlinedButton(
                                    onClick = {
                                        val cutLineId = crossingCutLine.id
                                        val blockId = selectedBlockId!!
                                        scope.launch {
                                            viewModel.splitBlockAtCutLine(page.id, blockId, cutLineId, context.contentResolver, context.cacheDir)
                                        }
                                    },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(12.dp),
                                ) {
                                    Text("Separar Bloco")
                                }
                            }
                        }
                    }
                }

                // Mover bloco selecionado pra outra página — só aparece com 2+ páginas.
                if (selectedBlockId != null && layout.pages.size > 1) {
                    Column(modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp)) {
                        Text(
                            text = "Mover bloco para:",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(bottom = 6.dp, start = 4.dp),
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            layout.pages.forEachIndexed { index, otherPage ->
                                if (otherPage.id != page.id) {
                                    AssistChip(
                                        onClick = { viewModel.moveBlockToPage(page.id, selectedBlockId!!, otherPage.id) },
                                        label = { Text("Pág. ${index + 1}") },
                                    )
                                }
                            }
                        }
                    }
                }

                BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                    val density = LocalDensity.current
                    val availableWidthPx = with(density) { maxWidth.toPx() }
                    val scalePxPerMm = if (paper.widthMm > 0f) availableWidthPx / paper.widthMm else 1f
                    val pageWidthDp = with(density) { (paper.widthMm * scalePxPerMm).toDp() }
                    val pageHeightDp = with(density) { (paper.heightMm * scalePxPerMm).toDp() }

                    Card(
                        modifier = Modifier.width(pageWidthDp).height(pageHeightDp),
                        shape = RoundedCornerShape(4.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
                    ) {
                        Box(modifier = Modifier.fillMaxSize()) {
                            page.blocks.sortedBy { it.zIndex }.forEach { block ->
                                BlockView(
                                    block = block,
                                    isSelected = block.id == selectedBlockId,
                                    isMissing = missingImageBlockIds.contains(block.id),
                                    scalePxPerMm = scalePxPerMm,
                                    onDrag = { deltaXMm, deltaYMm ->
                                        val proposedX = block.xMm + deltaXMm
                                        val proposedY = block.yMm + deltaYMm
                                        val others = page.blocks.filterNot { it.id == block.id }
                                        val snap = SnapEngine.snapPosition(
                                            proposedX, proposedY, block.widthMm, block.heightMm, paper, others,
                                        )
                                        viewModel.updateBlockPosition(page.id, block.id, snap.xMm, snap.yMm)
                                    },
                                    onResize = { deltaWidthMm, deltaHeightMm ->
                                        viewModel.updateBlockSize(page.id, block.id, block.widthMm + deltaWidthMm, block.heightMm + deltaHeightMm)
                                    },
                                    onTap = { viewModel.selectBlock(block.id) },
                                )
                            }
                            page.cutLines.forEach { cutLine ->
                                CutLineView(
                                    cutLine = cutLine,
                                    pageWidthDp = pageWidthDp,
                                    pageHeightDp = pageHeightDp,
                                    scalePxPerMm = scalePxPerMm,
                                    onDrag = { deltaMm ->
                                        viewModel.updateCutLinePosition(page.id, cutLine.id, cutLine.positionMm + deltaMm)
                                    },
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(24.dp))
            }
        }
    }

    if (showSaveDialog) {
        SaveProfileDialog(
            initialName = currentProfileName ?: "",
            onDismiss = { showSaveDialog = false },
            onConfirm = { name ->
                onSave(name)
                showSaveDialog = false
            },
        )
    }
}

/** Cartão branco com leve degradê + elevação real — dá o efeito "3D" que destaca os cards
 * sobre o fundo branco da tela, sem cair no tom lilás que o `surfaceVariant` padrão do M3
 * carregava antes. Base de todo card de configuração do editor (Papel, Ações, Páginas). */
@Composable
private fun GradientCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 5.dp),
    ) {
        Column(
            modifier = Modifier
                .background(
                    Brush.verticalGradient(
                        listOf(Color.White, MaterialTheme.colorScheme.primary.copy(alpha = 0.05f)),
                    ),
                )
                .padding(14.dp),
            content = content,
        )
    }
}

/** Cartão com rótulo em destaque — mesmo tratamento visual pra toda seção de configuração
 * do editor (Páginas, Linhas de Corte), pra dar uma cara mais coesa/moderna em vez de
 * linhas soltas direto no fundo da tela. */
@Composable
private fun SectionCard(label: String, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    GradientCard(modifier) {
        Text(
            text = label.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.5.sp,
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.height(10.dp))
        content()
    }
}

/** Mesma casca do [SectionCard], mas com cabeçalho clicável que recolhe o conteúdo —
 * fechado, mostra só [collapsedSummary] ao lado do rótulo (ex.: o tamanho de papel
 * escolhido), evitando ocupar a tela com os presets/campos quando não está em uso. */
@Composable
private fun AccordionSectionCard(
    label: String,
    collapsedSummary: String,
    expanded: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    GradientCard(modifier) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onToggle),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = label.uppercase(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.5.sp,
                    color = MaterialTheme.colorScheme.primary,
                )
                if (!expanded) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = collapsedSummary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF2A2A2A),
                    )
                }
            }
            Icon(
                imageVector = if (expanded) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
                contentDescription = if (expanded) "Recolher" else "Expandir",
                tint = MaterialTheme.colorScheme.primary,
            )
        }
        if (expanded) {
            Spacer(Modifier.height(10.dp))
            content()
        }
    }
}

/** Ações principais (Perfis/Visualizar/Salvar) num único subcard dividido em 3 — em vez de
 * três botões soltos, ficam visualmente unidos num só cartão com divisórias finas entre
 * eles, com "Salvar" destacado (preenchido) por ser a ação primária. */
@Composable
private fun EditorActionBar(onOpenProfiles: () -> Unit, onPreview: () -> Unit, onSaveClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
    ) {
        Row(modifier = Modifier.padding(6.dp), verticalAlignment = Alignment.CenterVertically) {
            ActionBarSegment(text = "Perfis", onClick = onOpenProfiles, modifier = Modifier.weight(1f))
            ActionBarDivider()
            ActionBarSegment(text = "Visualizar", onClick = onPreview, modifier = Modifier.weight(1f))
            ActionBarDivider()
            ActionBarSegment(text = "Salvar", onClick = onSaveClick, modifier = Modifier.weight(1f), highlighted = true)
        }
    }
}

@Composable
private fun ActionBarSegment(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, highlighted: Boolean = false) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(if (highlighted) MaterialTheme.colorScheme.primary else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = if (highlighted) Color.White else MaterialTheme.colorScheme.primary,
        )
    }
}

@Composable
private fun ActionBarDivider() {
    Box(modifier = Modifier.width(1.dp).height(26.dp).background(DividerColor))
}

/** Mesma ideia do [EditorActionBar], com 4 divisões — usado pra reunir as ações de Páginas
 * e Linhas de Corte (que antes eram dois cards/linhas separados) num único subcard. */
@Composable
private fun FourSegmentBar(segments: List<Pair<String, () -> Unit>>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.07f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Row(modifier = Modifier.padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
            segments.forEachIndexed { index, (text, onClick) ->
                TextButton(onClick = onClick, modifier = Modifier.weight(1f)) {
                    Text(text, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                if (index != segments.lastIndex) {
                    Box(
                        modifier = Modifier
                            .width(1.dp)
                            .height(28.dp)
                            .align(Alignment.CenterVertically)
                            .background(DividerColor),
                    )
                }
            }
        }
    }
}

@Composable
private fun PagesAndCutLinesCard(
    pageCount: Int,
    currentPageIndex: Int,
    cutLines: List<CutLine>,
    onPageSelected: (Int) -> Unit,
    onAddPage: () -> Unit,
    onRemovePage: () -> Unit,
    onAddCutLine: (isVertical: Boolean) -> Unit,
    onRemoveCutLine: (cutLineId: String) -> Unit,
) {
    SectionCard(label = "Páginas & Linhas de Corte") {
        if (pageCount > 1) {
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                for (i in 0 until pageCount) {
                    FilterChip(
                        selected = i == currentPageIndex,
                        onClick = { onPageSelected(i) },
                        label = { Text("Pág. ${i + 1}") },
                    )
                }
                AssistChip(onClick = onRemovePage, label = { Text("Remover atual") })
            }
            Spacer(Modifier.height(10.dp))
        }

        FourSegmentBar(
            segments = listOf(
                "Pág. ${currentPageIndex + 1}/$pageCount" to { },
                "+ Página" to onAddPage,
                "+ Vertical" to { onAddCutLine(true) },
                "+ Horizontal" to { onAddCutLine(false) },
            ),
        )

        if (cutLines.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                cutLines.forEach { cutLine ->
                    Row(
                        modifier = Modifier
                            .background(MaterialTheme.colorScheme.errorContainer, shape = RoundedCornerShape(16.dp))
                            .padding(horizontal = 12.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "${if (cutLine.isVertical) "V" else "H"} ${cutLine.positionMm.toInt()}mm",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "×",
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.clickable { onRemoveCutLine(cutLine.id) },
                        )
                    }
                }
            }
        }
    }
}

/** Popup próprio (Dialog) centralizado em vez de AlertDialog — o slot de texto do
 * AlertDialog cortava/desalinhava o OutlinedTextField (label flutuante colada na borda).
 * Aqui o card tem controle total do próprio padding/alinhamento. */
@Composable
private fun SaveProfileDialog(initialName: String, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var name by remember { mutableStateOf(initialName) }
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
        ) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(text = "Salvar Perfil", fontSize = 18.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(18.dp))
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nome do perfil") },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(20.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(14.dp),
                    ) {
                        Text("Cancelar")
                    }
                    Button(
                        onClick = { if (name.isNotBlank()) onConfirm(name) },
                        enabled = name.isNotBlank(),
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(14.dp),
                    ) {
                        Text("Salvar")
                    }
                }
            }
        }
    }
}

@Composable
private fun PaperControls(
    paper: PaperConfig,
    expanded: Boolean,
    onToggleExpanded: () -> Unit,
    onPaperChange: (transform: (PaperConfig) -> PaperConfig) -> Unit,
) {
    val selectedPreset = PAPER_PRESETS.find { it.widthMm == paper.widthMm && it.heightMm == paper.heightMm }
    val summary = selectedPreset?.label ?: "${paper.widthMm.toInt()}×${paper.heightMm.toInt()}mm"

    AccordionSectionCard(
        label = "Papel",
        collapsedSummary = summary,
        expanded = expanded,
        onToggle = onToggleExpanded,
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PAPER_PRESETS.forEach { preset ->
                val selected = paper.widthMm == preset.widthMm && paper.heightMm == preset.heightMm
                FilterChip(
                    selected = selected,
                    onClick = { onPaperChange { it.copy(widthMm = preset.widthMm, heightMm = preset.heightMm) } },
                    label = { Text(preset.label) },
                )
            }
        }
        Spacer(Modifier.height(10.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            NumberField(
                label = "Largura (mm)",
                value = paper.widthMm,
                onValueChange = { newWidth -> onPaperChange { it.copy(widthMm = newWidth) } },
                modifier = Modifier.weight(1f),
            )
            NumberField(
                label = "Altura (mm)",
                value = paper.heightMm,
                onValueChange = { newHeight -> onPaperChange { it.copy(heightMm = newHeight) } },
                modifier = Modifier.weight(1f),
            )
            NumberField(
                label = "DPI",
                value = paper.dpi.toFloat(),
                onValueChange = { newDpi -> onPaperChange { it.copy(dpi = newDpi.toInt()) } },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun NumberField(label: String, value: Float, onValueChange: (Float) -> Unit, modifier: Modifier = Modifier) {
    var text by remember(value) { mutableStateOf(value.toInt().toString()) }
    OutlinedTextField(
        value = text,
        onValueChange = { newText ->
            text = newText
            newText.toFloatOrNull()?.let { if (it > 0f) onValueChange(it) }
        },
        label = { Text(label) },
        singleLine = true,
        shape = RoundedCornerShape(14.dp),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = modifier,
    )
}

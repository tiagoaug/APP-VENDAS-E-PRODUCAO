package com.musgo.vendaseproducao.printstudio.ui

import android.content.ContentResolver
import androidx.lifecycle.ViewModel
import com.musgo.vendaseproducao.printstudio.model.CutLine
import com.musgo.vendaseproducao.printstudio.model.ImageBlock
import com.musgo.vendaseproducao.printstudio.model.PaperConfig
import com.musgo.vendaseproducao.printstudio.model.PrintLayout
import com.musgo.vendaseproducao.printstudio.model.PrintPage
import com.musgo.vendaseproducao.printstudio.model.splitImageAtFraction
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import java.io.File
import java.util.UUID

private const val DEFAULT_BLOCK_WIDTH_MM = 80f
private const val DEFAULT_BLOCK_HEIGHT_MM = 60f
private const val MIN_BLOCK_SIZE_MM = 10f

/** Estado do editor. Mutações são endereçadas por id (não por índice) de propósito — é o
 * que permite o SnapEngine (Fase 4) interceptar a posição proposta antes de gravar, sem
 * precisar reescrever essas assinaturas nem o BlockView. */
class EditorViewModel : ViewModel() {

    private val _layout = MutableStateFlow(defaultLayout())
    val layout: StateFlow<PrintLayout> = _layout

    private val _selectedBlockId = MutableStateFlow<String?>(null)
    val selectedBlockId: StateFlow<String?> = _selectedBlockId

    private val _currentPageIndex = MutableStateFlow(0)
    val currentPageIndex: StateFlow<Int> = _currentPageIndex

    private val _missingImageBlockIds = MutableStateFlow<Set<String>>(emptySet())
    val missingImageBlockIds: StateFlow<Set<String>> = _missingImageBlockIds

    private val _currentProfileId = MutableStateFlow<Long?>(null)
    val currentProfileId: StateFlow<Long?> = _currentProfileId

    private val _currentProfileName = MutableStateFlow<String?>(null)
    val currentProfileName: StateFlow<String?> = _currentProfileName

    // ── Blocos ──────────────────────────────────────────────────────────────────

    fun addImageBlock(uri: String, pageId: String) {
        addImageBlocks(listOf(uri), pageId)
    }

    /** Adiciona vários blocos de uma vez (ex.: fichas geradas pelo PCP, já vindas como
     * arquivo — ver PrintStudioApp.initialImages) — espalhados diagonalmente pra não
     * nascer todos exatamente um em cima do outro. */
    fun addImageBlocks(uris: List<String>, pageId: String) {
        if (uris.isEmpty()) return
        val paper = _layout.value.paper
        var zIndex = nextZIndex(pageId)
        val maxX = (paper.widthMm - DEFAULT_BLOCK_WIDTH_MM).coerceAtLeast(0f)
        val maxY = (paper.heightMm - DEFAULT_BLOCK_HEIGHT_MM).coerceAtLeast(0f)
        val newBlocks = uris.mapIndexed { i, uri ->
            val staggerMm = i * 8f
            ImageBlock(
                id = UUID.randomUUID().toString(),
                imageUri = uri,
                xMm = (paper.marginLeftMm + staggerMm).coerceIn(0f, maxX),
                yMm = (paper.marginTopMm + staggerMm).coerceIn(0f, maxY),
                widthMm = DEFAULT_BLOCK_WIDTH_MM.coerceAtMost(paper.widthMm),
                heightMm = DEFAULT_BLOCK_HEIGHT_MM.coerceAtMost(paper.heightMm),
                zIndex = zIndex++,
            )
        }
        mutatePage(pageId) { page -> page.copy(blocks = page.blocks + newBlocks) }
        _selectedBlockId.value = newBlocks.last().id
    }

    fun updateBlockPosition(pageId: String, blockId: String, xMm: Float, yMm: Float) {
        mutateBlock(pageId, blockId) { block ->
            val paper = _layout.value.paper
            val maxX = (paper.widthMm - block.widthMm).coerceAtLeast(0f)
            val maxY = (paper.heightMm - block.heightMm).coerceAtLeast(0f)
            block.copy(xMm = xMm.coerceIn(0f, maxX), yMm = yMm.coerceIn(0f, maxY))
        }
    }

    fun updateBlockSize(pageId: String, blockId: String, widthMm: Float, heightMm: Float) {
        mutateBlock(pageId, blockId) { block ->
            val paper = _layout.value.paper
            block.copy(
                widthMm = widthMm.coerceIn(MIN_BLOCK_SIZE_MM, paper.widthMm),
                heightMm = heightMm.coerceIn(MIN_BLOCK_SIZE_MM, paper.heightMm),
            )
        }
    }

    fun removeBlock(pageId: String, blockId: String) {
        mutatePage(pageId) { page -> page.copy(blocks = page.blocks.filterNot { it.id == blockId }) }
        if (_selectedBlockId.value == blockId) _selectedBlockId.value = null
    }

    /** Cria uma cópia do bloco com novo id, deslocada 8mm na diagonal (mesmo offset usado
     * em [addImageBlocks]) pra não nascer exatamente sobre o original, e já a seleciona. */
    fun duplicateBlock(pageId: String, blockId: String) {
        val page = _layout.value.pages.firstOrNull { it.id == pageId } ?: return
        val original = page.blocks.firstOrNull { it.id == blockId } ?: return
        val paper = _layout.value.paper
        val maxX = (paper.widthMm - original.widthMm).coerceAtLeast(0f)
        val maxY = (paper.heightMm - original.heightMm).coerceAtLeast(0f)
        val duplicate = original.copy(
            id = UUID.randomUUID().toString(),
            xMm = (original.xMm + 8f).coerceIn(0f, maxX),
            yMm = (original.yMm + 8f).coerceIn(0f, maxY),
            zIndex = nextZIndex(pageId),
        )
        mutatePage(pageId) { p -> p.copy(blocks = p.blocks + duplicate) }
        _selectedBlockId.value = duplicate.id
    }

    fun selectBlock(blockId: String?) {
        _selectedBlockId.value = blockId
    }

    /** Move um bloco de uma página pra outra, mantendo posição/tamanho — só faz sentido
     * porque o papel (PrintLayout.paper) é único pra todo o layout, não por página, então
     * as coordenadas em mm continuam válidas na página de destino. */
    fun moveBlockToPage(fromPageId: String, blockId: String, toPageId: String) {
        if (fromPageId == toPageId) return
        val fromPage = _layout.value.pages.firstOrNull { it.id == fromPageId } ?: return
        val block = fromPage.blocks.firstOrNull { it.id == blockId } ?: return
        _layout.update { layout ->
            layout.copy(pages = layout.pages.map { p ->
                when (p.id) {
                    fromPageId -> p.copy(blocks = p.blocks.filterNot { it.id == blockId })
                    toPageId -> p.copy(blocks = p.blocks + block)
                    else -> p
                }
            })
        }
        _selectedBlockId.value = null
    }

    /** Recorta o bitmap do bloco em dois, na posição onde a linha de corte o atravessa,
     * substituindo o bloco original por dois novos — cada um pode então ser movido pra
     * uma página diferente (ver [moveBlockToPage]). [contentResolver]/[cacheDir] vêm do
     * chamador (Composable) de propósito, mesmo motivo de [loadLayout] não guardar Context. */
    suspend fun splitBlockAtCutLine(pageId: String, blockId: String, cutLineId: String, contentResolver: ContentResolver, cacheDir: File) {
        val page = _layout.value.pages.firstOrNull { it.id == pageId } ?: return
        val block = page.blocks.firstOrNull { it.id == blockId } ?: return
        val cutLine = page.cutLines.firstOrNull { it.id == cutLineId } ?: return

        val fraction = if (cutLine.isVertical) {
            (cutLine.positionMm - block.xMm) / block.widthMm
        } else {
            (cutLine.positionMm - block.yMm) / block.heightMm
        }
        if (fraction <= 0f || fraction >= 1f) return

        val result = splitImageAtFraction(contentResolver, cacheDir, block.imageUri, cutLine.isVertical, fraction) ?: return

        val firstBlock: ImageBlock
        val secondBlock: ImageBlock
        if (cutLine.isVertical) {
            val splitWidth = block.widthMm * fraction
            firstBlock = block.copy(id = UUID.randomUUID().toString(), imageUri = result.firstImageUri, widthMm = splitWidth)
            secondBlock = block.copy(
                id = UUID.randomUUID().toString(), imageUri = result.secondImageUri,
                xMm = block.xMm + splitWidth, widthMm = block.widthMm - splitWidth, zIndex = block.zIndex + 1,
            )
        } else {
            val splitHeight = block.heightMm * fraction
            firstBlock = block.copy(id = UUID.randomUUID().toString(), imageUri = result.firstImageUri, heightMm = splitHeight)
            secondBlock = block.copy(
                id = UUID.randomUUID().toString(), imageUri = result.secondImageUri,
                yMm = block.yMm + splitHeight, heightMm = block.heightMm - splitHeight, zIndex = block.zIndex + 1,
            )
        }

        mutatePage(pageId) { p -> p.copy(blocks = p.blocks.filterNot { it.id == blockId } + firstBlock + secondBlock) }
        _selectedBlockId.value = firstBlock.id
    }

    // ── Papel ───────────────────────────────────────────────────────────────────

    fun updatePaper(transform: (PaperConfig) -> PaperConfig) {
        _layout.update { it.copy(paper = transform(it.paper)) }
    }

    // ── Páginas ─────────────────────────────────────────────────────────────────

    fun addPage() {
        _layout.update { layout -> layout.copy(pages = layout.pages + PrintPage(id = UUID.randomUUID().toString())) }
        _currentPageIndex.value = _layout.value.pages.lastIndex
    }

    fun removePage(pageId: String) {
        _layout.update { layout ->
            if (layout.pages.size <= 1) return@update layout
            layout.copy(pages = layout.pages.filterNot { it.id == pageId })
        }
        _currentPageIndex.value = _currentPageIndex.value.coerceIn(0, (_layout.value.pages.size - 1).coerceAtLeast(0))
        _selectedBlockId.value = null
    }

    fun setCurrentPageIndex(index: Int) {
        _currentPageIndex.value = index.coerceIn(0, (_layout.value.pages.size - 1).coerceAtLeast(0))
        _selectedBlockId.value = null
    }

    // ── Linhas de corte ─────────────────────────────────────────────────────────

    fun addCutLine(pageId: String, isVertical: Boolean, positionMm: Float) {
        val cutLine = CutLine(id = UUID.randomUUID().toString(), isVertical = isVertical, positionMm = positionMm)
        mutatePage(pageId) { page -> page.copy(cutLines = page.cutLines + cutLine) }
    }

    fun updateCutLinePosition(pageId: String, cutLineId: String, positionMm: Float) {
        mutatePage(pageId) { page ->
            val paper = _layout.value.paper
            page.copy(cutLines = page.cutLines.map { cut ->
                if (cut.id != cutLineId) return@map cut
                val max = if (cut.isVertical) paper.widthMm else paper.heightMm
                cut.copy(positionMm = positionMm.coerceIn(0f, max))
            })
        }
    }

    fun removeCutLine(pageId: String, cutLineId: String) {
        mutatePage(pageId) { page -> page.copy(cutLines = page.cutLines.filterNot { it.id == cutLineId }) }
    }

    // ── Perfis (carregar/salvar) ────────────────────────────────────────────────

    /** Substitui o layout em edição por um perfil carregado do Room — reseta seleção e
     * página atual, já que ids antigos não correspondem ao perfil recém-carregado.
     * [missingBlockIds] já vem calculado pelo chamador (precisa de ContentResolver, que o
     * ViewModel não guarda de propósito, pra não reter uma referência de Context/Activity). */
    fun loadLayout(layout: PrintLayout, profileId: Long?, profileName: String?, missingBlockIds: Set<String>) {
        _layout.value = layout
        _selectedBlockId.value = null
        _currentPageIndex.value = 0
        _missingImageBlockIds.value = missingBlockIds
        _currentProfileId.value = profileId
        _currentProfileName.value = profileName
    }

    /** Chamado depois que o chamador salva com sucesso no Room — só atualiza o "ponteiro"
     * de qual perfil está em edição, pra próximos "Salvar" serem update em vez de insert. */
    fun markSaved(profileId: Long, profileName: String) {
        _currentProfileId.value = profileId
        _currentProfileName.value = profileName
    }

    fun newLayout() {
        _layout.value = defaultLayout()
        _selectedBlockId.value = null
        _currentPageIndex.value = 0
        _missingImageBlockIds.value = emptySet()
        _currentProfileId.value = null
        _currentProfileName.value = null
    }

    // ── Internos ────────────────────────────────────────────────────────────────

    private fun nextZIndex(pageId: String): Int {
        val page = _layout.value.pages.firstOrNull { it.id == pageId } ?: return 0
        return (page.blocks.maxOfOrNull { it.zIndex } ?: -1) + 1
    }

    private fun mutatePage(pageId: String, transform: (PrintPage) -> PrintPage) {
        _layout.update { layout ->
            layout.copy(pages = layout.pages.map { page -> if (page.id == pageId) transform(page) else page })
        }
    }

    private fun mutateBlock(pageId: String, blockId: String, transform: (ImageBlock) -> ImageBlock) {
        mutatePage(pageId) { page ->
            page.copy(blocks = page.blocks.map { block -> if (block.id == blockId) transform(block) else block })
        }
    }
}

private fun defaultLayout(): PrintLayout = PrintLayout(
    paper = PaperConfig(
        widthMm = 210f, heightMm = 297f, dpi = 300,
        marginTopMm = 10f, marginBottomMm = 10f, marginLeftMm = 10f, marginRightMm = 10f,
    ),
    pages = listOf(PrintPage(id = UUID.randomUUID().toString())),
)

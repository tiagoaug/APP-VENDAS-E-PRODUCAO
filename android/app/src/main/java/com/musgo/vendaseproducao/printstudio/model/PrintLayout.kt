package com.musgo.vendaseproducao.printstudio.model

import kotlinx.serialization.Serializable

enum class Orientation { PORTRAIT, LANDSCAPE }

/** Papel: tamanho, DPI e margens — tudo em milímetros, convertido pra pixels só na hora de
 * desenhar (ver [MmPx]), pra um mesmo layout valer independente da densidade de tela. */
@Serializable
data class PaperConfig(
    val widthMm: Float,
    val heightMm: Float,
    val dpi: Int,
    val marginTopMm: Float,
    val marginBottomMm: Float,
    val marginLeftMm: Float,
    val marginRightMm: Float,
    val orientation: Orientation = Orientation.PORTRAIT,
)

/** Um bloco de imagem posicionado numa página. [imageUri] é a URI persistida
 * (content://) — nunca os bytes da imagem. */
@Serializable
data class ImageBlock(
    val id: String,
    val imageUri: String,
    val xMm: Float,
    val yMm: Float,
    val widthMm: Float,
    val heightMm: Float,
    val rotationDegrees: Float = 0f,
    val zIndex: Int = 0,
)

/** Linha de corte — divide a folha virtual em sub-regiões físicas de impressão. É geometria
 * de página, não uma tag em cada bloco, porque um bloco pode atravessar o corte de propósito. */
@Serializable
data class CutLine(
    val id: String,
    val isVertical: Boolean,
    val positionMm: Float,
)

@Serializable
data class PrintPage(
    val id: String,
    val blocks: List<ImageBlock> = emptyList(),
    val cutLines: List<CutLine> = emptyList(),
)

@Serializable
data class PrintLayout(
    val paper: PaperConfig,
    val pages: List<PrintPage> = emptyList(),
)

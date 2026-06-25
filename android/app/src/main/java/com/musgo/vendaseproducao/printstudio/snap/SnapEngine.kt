package com.musgo.vendaseproducao.printstudio.snap

import com.musgo.vendaseproducao.printstudio.model.ImageBlock
import com.musgo.vendaseproducao.printstudio.model.PaperConfig
import kotlin.math.abs

data class SnapResult(
    val xMm: Float,
    val yMm: Float,
    val snappedToXGuide: Float?,
    val snappedToYGuide: Float?,
)

/** Lógica pura de snap (sem dependência de Android/Compose) — testável isoladamente. Gera
 * guias candidatas por eixo (margens da página, bordas e centros dos outros blocos da MESMA
 * página) e escolhe a mais próxima dentro do limiar; senão usa a posição não-ajustada. */
object SnapEngine {
    const val SNAP_THRESHOLD_MM = 3f

    fun snapPosition(
        proposedXMm: Float,
        proposedYMm: Float,
        blockWidthMm: Float,
        blockHeightMm: Float,
        paper: PaperConfig,
        otherBlocks: List<ImageBlock>,
    ): SnapResult {
        val xGuides = mutableListOf(
            paper.marginLeftMm,
            paper.widthMm - paper.marginRightMm - blockWidthMm,
        )
        val yGuides = mutableListOf(
            paper.marginTopMm,
            paper.heightMm - paper.marginBottomMm - blockHeightMm,
        )
        otherBlocks.forEach { other ->
            xGuides += other.xMm
            xGuides += other.xMm + other.widthMm - blockWidthMm
            xGuides += other.xMm + other.widthMm / 2f - blockWidthMm / 2f
            yGuides += other.yMm
            yGuides += other.yMm + other.heightMm - blockHeightMm
            yGuides += other.yMm + other.heightMm / 2f - blockHeightMm / 2f
        }

        val (snappedX, usedXGuide) = nearestWithinThreshold(proposedXMm, xGuides)
        val (snappedY, usedYGuide) = nearestWithinThreshold(proposedYMm, yGuides)
        return SnapResult(snappedX, snappedY, usedXGuide, usedYGuide)
    }

    private fun nearestWithinThreshold(proposed: Float, guides: List<Float>): Pair<Float, Float?> {
        var best: Float? = null
        var bestDistance = Float.MAX_VALUE
        for (guide in guides) {
            val distance = abs(proposed - guide)
            if (distance <= SNAP_THRESHOLD_MM && distance < bestDistance) {
                best = guide
                bestDistance = distance
            }
        }
        return if (best != null) best to best else proposed to null
    }
}

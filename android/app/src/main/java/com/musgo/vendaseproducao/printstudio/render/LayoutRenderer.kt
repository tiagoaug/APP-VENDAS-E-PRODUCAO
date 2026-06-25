package com.musgo.vendaseproducao.printstudio.render

import android.content.ContentResolver
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import com.musgo.vendaseproducao.printstudio.model.PrintLayout
import com.musgo.vendaseproducao.printstudio.model.PrintPage

/** Uma sub-região física de impressão — resultado de aplicar as linhas de corte de uma
 * [PrintPage] sobre a folha virtual. Sem linhas de corte, cada página gera exatamente uma
 * PhysicalPage (a folha inteira). [regionMm] é a região da página virtual, em mm, que esta
 * folha física cobre. */
data class PhysicalPage(
    val sourcePage: PrintPage,
    val regionMm: RectF,
)

/** Renderização compartilhada entre o preview (Bitmap) e a impressão real (PdfDocument) —
 * ambos usam android.graphics.Canvas, então a MESMA função desenha os dois, garantindo que
 * nunca divirjam. A única diferença entre os dois usos é [canvasScalePxPerUnit] (pixels de
 * bitmap por mm no preview; pontos de PDF por mm na impressão) — por isso é um parâmetro
 * explícito em vez de calculado internamente a partir do DPI do papel. */
object LayoutRenderer {

    fun computePhysicalPages(layout: PrintLayout): List<PhysicalPage> {
        val physicalPages = mutableListOf<PhysicalPage>()
        layout.pages.forEach { page ->
            val verticalCuts = page.cutLines.filter { it.isVertical }.map { it.positionMm }.sorted()
            val horizontalCuts = page.cutLines.filter { !it.isVertical }.map { it.positionMm }.sorted()

            val xBounds = (listOf(0f) + verticalCuts + listOf(layout.paper.widthMm)).distinct().sorted()
            val yBounds = (listOf(0f) + horizontalCuts + listOf(layout.paper.heightMm)).distinct().sorted()

            for (yi in 0 until yBounds.size - 1) {
                for (xi in 0 until xBounds.size - 1) {
                    physicalPages += PhysicalPage(
                        sourcePage = page,
                        regionMm = RectF(xBounds[xi], yBounds[yi], xBounds[xi + 1], yBounds[yi + 1]),
                    )
                }
            }
        }
        return physicalPages
    }

    fun renderPhysicalPage(
        canvas: Canvas,
        physicalPage: PhysicalPage,
        contentResolver: ContentResolver,
        canvasScalePxPerUnit: Float,
    ) {
        val region = physicalPage.regionMm
        val widthPx = region.width() * canvasScalePxPerUnit
        val heightPx = region.height() * canvasScalePxPerUnit

        canvas.save()
        canvas.clipRect(0f, 0f, widthPx, heightPx)
        canvas.drawColor(Color.WHITE)

        val blocksInRegion = physicalPage.sourcePage.blocks.filter { block ->
            RectF.intersects(RectF(block.xMm, block.yMm, block.xMm + block.widthMm, block.yMm + block.heightMm), region)
        }

        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        blocksInRegion.sortedBy { it.zIndex }.forEach { block ->
            val bitmap = try {
                contentResolver.openInputStream(Uri.parse(block.imageUri))?.use { stream ->
                    BitmapFactory.decodeStream(stream)
                }
            } catch (e: Exception) {
                null
            } ?: return@forEach

            // Posição do bloco relativa ao início DESTA região física, não da página inteira
            // — uma região pode começar em qualquer ponto da folha virtual quando há cortes.
            val left = (block.xMm - region.left) * canvasScalePxPerUnit
            val top = (block.yMm - region.top) * canvasScalePxPerUnit
            val dst = RectF(left, top, left + block.widthMm * canvasScalePxPerUnit, top + block.heightMm * canvasScalePxPerUnit)
            canvas.drawBitmap(bitmap, null, dst, paint)
        }

        canvas.restore()
    }
}

package com.musgo.vendaseproducao.printstudio.print

import android.content.Context
import android.graphics.pdf.PdfDocument
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import com.musgo.vendaseproducao.printstudio.model.PrintLayout
import com.musgo.vendaseproducao.printstudio.render.LayoutRenderer
import java.io.FileOutputStream

private const val POINTS_PER_INCH = 72f
private const val MM_PER_INCH = 25.4f

/** Reaproveita LayoutRenderer.renderPhysicalPage — a MESMA função usada no preview — pra
 * montar o PDF entregue ao PrintManager, garantindo que o que o usuário viu no preview seja
 * exatamente o que sai impresso (só muda o destino do desenho: Bitmap vs Canvas de página
 * de PDF, e a escala: px/mm do preview vs pontos/mm aqui). */
class PrintStudioPrintAdapter(
    private val context: Context,
    private val layout: PrintLayout,
) : PrintDocumentAdapter() {

    private val physicalPages = LayoutRenderer.computePhysicalPages(layout)

    override fun onLayout(
        oldAttributes: PrintAttributes?,
        newAttributes: PrintAttributes,
        cancellationSignal: CancellationSignal?,
        callback: LayoutResultCallback,
        extras: Bundle?,
    ) {
        if (cancellationSignal?.isCanceled == true) {
            callback.onLayoutCancelled()
            return
        }
        val info = PrintDocumentInfo.Builder("print_studio_output.pdf")
            .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
            .setPageCount(physicalPages.size)
            .build()
        callback.onLayoutFinished(info, true)
    }

    override fun onWrite(
        pages: Array<PageRange>,
        destination: ParcelFileDescriptor,
        cancellationSignal: CancellationSignal?,
        callback: WriteResultCallback,
    ) {
        val pdf = PdfDocument()
        try {
            physicalPages.forEachIndexed { index, physicalPage ->
                // Pontos (1/72") são a unidade do PdfDocument — nunca mm nem px de tela.
                val widthPt = (physicalPage.regionMm.width() / MM_PER_INCH * POINTS_PER_INCH).toInt().coerceAtLeast(1)
                val heightPt = (physicalPage.regionMm.height() / MM_PER_INCH * POINTS_PER_INCH).toInt().coerceAtLeast(1)
                val pageInfo = PdfDocument.PageInfo.Builder(widthPt, heightPt, index + 1).create()
                val pdfPage = pdf.startPage(pageInfo)
                LayoutRenderer.renderPhysicalPage(
                    canvas = pdfPage.canvas,
                    physicalPage = physicalPage,
                    contentResolver = context.contentResolver,
                    canvasScalePxPerUnit = POINTS_PER_INCH / MM_PER_INCH,
                )
                pdf.finishPage(pdfPage)
            }
            FileOutputStream(destination.fileDescriptor).use { out -> pdf.writeTo(out) }
            callback.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
        } catch (e: Exception) {
            callback.onWriteFailed(e.message ?: "Erro desconhecido ao gerar PDF")
        } finally {
            pdf.close()
        }
    }
}

package com.musgo.vendaseproducao.printstudio.print

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import com.musgo.vendaseproducao.printstudio.model.PrintLayout
import com.musgo.vendaseproducao.printstudio.render.LayoutRenderer
import java.io.File
import java.io.FileOutputStream

private const val POINTS_PER_INCH = 72f
private const val MM_PER_INCH = 25.4f

/** Gera o PDF completo (mesmo motor do PrintStudioPrintAdapter) e abre o seletor nativo de
 * compartilhamento do Android — de lá o usuário escolhe salvar no Drive/Arquivos, mandar por
 * WhatsApp, etc. Reaproveita o FileProvider já configurado no AndroidManifest (autoridade
 * "${packageName}.fileprovider", cobre todo o cacheDir — ver res/xml/file_paths.xml). */
fun exportLayoutAsPdfAndShare(context: Context, layout: PrintLayout) {
    val physicalPages = LayoutRenderer.computePhysicalPages(layout)
    if (physicalPages.isEmpty()) return

    val pdf = PdfDocument()
    physicalPages.forEachIndexed { index, physicalPage ->
        val widthPt = (physicalPage.regionMm.width() / MM_PER_INCH * POINTS_PER_INCH).toInt().coerceAtLeast(1)
        val heightPt = (physicalPage.regionMm.height() / MM_PER_INCH * POINTS_PER_INCH).toInt().coerceAtLeast(1)
        val pdfPage = pdf.startPage(PdfDocument.PageInfo.Builder(widthPt, heightPt, index + 1).create())
        LayoutRenderer.renderPhysicalPage(pdfPage.canvas, physicalPage, context.contentResolver, POINTS_PER_INCH / MM_PER_INCH)
        pdf.finishPage(pdfPage)
    }

    val file = File(context.cacheDir, "print_studio_${System.currentTimeMillis()}.pdf")
    FileOutputStream(file).use { out -> pdf.writeTo(out) }
    pdf.close()

    shareSingle(context, uriForFile(context, file), "application/pdf")
}

/** Gera uma imagem JPG por página física (na resolução do DPI configurado no papel — a
 * mesma que valeria pra impressão real) e compartilha. Uma página = ACTION_SEND; mais de
 * uma = ACTION_SEND_MULTIPLE. */
fun exportLayoutAsJpgAndShare(context: Context, layout: PrintLayout) {
    val physicalPages = LayoutRenderer.computePhysicalPages(layout)
    if (physicalPages.isEmpty()) return

    val scalePxPerMm = layout.paper.dpi / MM_PER_INCH
    val uris = physicalPages.mapIndexed { index, physicalPage ->
        val widthPx = (physicalPage.regionMm.width() * scalePxPerMm).toInt().coerceAtLeast(1)
        val heightPx = (physicalPage.regionMm.height() * scalePxPerMm).toInt().coerceAtLeast(1)
        val bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
        LayoutRenderer.renderPhysicalPage(Canvas(bitmap), physicalPage, context.contentResolver, scalePxPerMm)

        val file = File(context.cacheDir, "print_studio_${System.currentTimeMillis()}_$index.jpg")
        FileOutputStream(file).use { out -> bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out) }
        uriForFile(context, file)
    }

    if (uris.size == 1) {
        shareSingle(context, uris[0], "image/jpeg")
    } else {
        shareMultiple(context, uris, "image/jpeg")
    }
}

private fun uriForFile(context: Context, file: File): Uri =
    FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)

private fun shareSingle(context: Context, uri: Uri, mimeType: String) {
    val sendIntent = Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(sendIntent, "Compartilhar"))
}

private fun shareMultiple(context: Context, uris: List<Uri>, mimeType: String) {
    val sendIntent = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
        type = mimeType
        putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(sendIntent, "Compartilhar"))
}

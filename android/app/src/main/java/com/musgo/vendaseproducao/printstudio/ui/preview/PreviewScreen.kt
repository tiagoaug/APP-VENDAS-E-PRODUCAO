package com.musgo.vendaseproducao.printstudio.ui.preview

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.musgo.vendaseproducao.printstudio.model.PrintLayout
import com.musgo.vendaseproducao.printstudio.print.exportLayoutAsJpgAndShare
import com.musgo.vendaseproducao.printstudio.print.exportLayoutAsPdfAndShare
import com.musgo.vendaseproducao.printstudio.render.LayoutRenderer
import com.musgo.vendaseproducao.printstudio.render.PhysicalPage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// Resolução de TELA pro preview — independente do DPI de impressão real do papel (que só
// importa pro PdfDocument/JPG exportado, ver PrintStudioPrintAdapter/PrintStudioExport).
private const val PREVIEW_PX_PER_MM = 4f

/** Navega página física a página física (já considerando linhas de corte) usando a MESMA
 * função de desenho (LayoutRenderer.renderPhysicalPage) que o PrintStudioPrintAdapter/
 * PrintStudioExport usam pra imprimir/exportar de verdade — preview e saída nunca divergem.
 *
 * PDF/JPG/Imprimir ficam numa barra inferior (não na TopAppBar) — 3 ações ali espremeriam o
 * título, igual ao que já tinha acontecido no EditorScreen. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PreviewScreen(
    layout: PrintLayout,
    onBack: () -> Unit,
    onPrint: () -> Unit,
) {
    val context = LocalContext.current
    val physicalPages = remember(layout) { LayoutRenderer.computePhysicalPages(layout) }
    val pagerState = rememberPagerState(pageCount = { physicalPages.size.coerceAtLeast(1) })
    val hasPages = physicalPages.isNotEmpty()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Pré-visualização (${physicalPages.size} pág.)",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
            )
        },
        bottomBar = {
            Row(
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(
                    onClick = { exportLayoutAsPdfAndShare(context, layout) },
                    enabled = hasPages,
                    modifier = Modifier.weight(1f),
                ) { Text("PDF") }
                OutlinedButton(
                    onClick = { exportLayoutAsJpgAndShare(context, layout) },
                    enabled = hasPages,
                    modifier = Modifier.weight(1f),
                ) { Text("JPG") }
                Button(
                    onClick = onPrint,
                    enabled = hasPages,
                    modifier = Modifier.weight(1f),
                ) { Text("Imprimir") }
            }
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (!hasPages) {
                Text("Nada para pré-visualizar.", modifier = Modifier.padding(24.dp))
            } else {
                HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { pageIndex ->
                    PreviewPage(physicalPage = physicalPages[pageIndex], contentResolver = context.contentResolver)
                }
            }
        }
    }
}

@Composable
private fun PreviewPage(physicalPage: PhysicalPage, contentResolver: ContentResolver) {
    var bitmap by remember(physicalPage) { mutableStateOf<Bitmap?>(null) }

    LaunchedEffect(physicalPage) {
        bitmap = withContext(Dispatchers.Default) {
            val widthPx = (physicalPage.regionMm.width() * PREVIEW_PX_PER_MM).toInt().coerceAtLeast(1)
            val heightPx = (physicalPage.regionMm.height() * PREVIEW_PX_PER_MM).toInt().coerceAtLeast(1)
            val bmp = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
            LayoutRenderer.renderPhysicalPage(Canvas(bmp), physicalPage, contentResolver, PREVIEW_PX_PER_MM)
            bmp
        }
    }

    Box(modifier = Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.Center) {
        val current = bitmap
        if (current != null) {
            Image(
                bitmap = current.asImageBitmap(),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            CircularProgressIndicator()
        }
    }
}

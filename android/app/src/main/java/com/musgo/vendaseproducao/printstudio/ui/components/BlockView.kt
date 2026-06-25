package com.musgo.vendaseproducao.printstudio.ui.components

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.musgo.vendaseproducao.printstudio.model.ImageBlock
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val HANDLE_SIZE_DP = 22

/** Um bloco de imagem posicionado na página de edição. [scalePxPerMm] é a escala de TELA
 * (px de tela por mm de papel) usada tanto pra desenhar quanto pra converter os deltas de
 * gesto — nunca o DPI de impressão, que só importa na hora de renderizar/imprimir de
 * verdade (ver MmPx / LayoutRenderer da Fase 5). */
@Composable
fun BlockView(
    block: ImageBlock,
    isSelected: Boolean,
    isMissing: Boolean,
    scalePxPerMm: Float,
    onDrag: (deltaXMm: Float, deltaYMm: Float) -> Unit,
    onResize: (deltaWidthMm: Float, deltaHeightMm: Float) -> Unit,
    onTap: () -> Unit,
) {
    val context = LocalContext.current
    val density = LocalDensity.current

    // rememberUpdatedState: a corrotina de gesto dentro do pointerInput roda por toda a
    // duração do arrasto sem reiniciar (key = block.id, que não muda) — sem isso, ela
    // chamaria uma versão antiga (capturada) destes callbacks em vez da mais recente.
    val currentOnDrag by rememberUpdatedState(onDrag)
    val currentOnResize by rememberUpdatedState(onResize)
    val currentOnTap by rememberUpdatedState(onTap)

    val bitmap by produceState<Bitmap?>(initialValue = null, block.imageUri, isMissing) {
        value = if (isMissing) null else withContext(Dispatchers.IO) {
            try {
                context.contentResolver.openInputStream(Uri.parse(block.imageUri))?.use { stream ->
                    BitmapFactory.decodeStream(stream)
                }
            } catch (e: Exception) {
                null
            }
        }
    }

    val widthDp = with(density) { (block.widthMm * scalePxPerMm).toDp() }
    val heightDp = with(density) { (block.heightMm * scalePxPerMm).toDp() }
    val xDp = with(density) { (block.xMm * scalePxPerMm).toDp() }
    val yDp = with(density) { (block.yMm * scalePxPerMm).toDp() }

    Box(
        modifier = Modifier
            .offset(x = xDp, y = yDp)
            .size(width = widthDp, height = heightDp)
            .border(
                width = if (isSelected) 2.dp else 1.dp,
                color = if (isSelected) MaterialTheme.colorScheme.primary else Color.Gray,
            )
            .pointerInput(block.id) {
                detectTapGestures { currentOnTap() }
            }
            .pointerInput(block.id) {
                detectDragGestures { change, dragAmount ->
                    change.consume()
                    currentOnDrag(dragAmount.x / scalePxPerMm, dragAmount.y / scalePxPerMm)
                }
            },
    ) {
        val loadedBitmap = bitmap
        if (loadedBitmap != null) {
            Image(
                bitmap = loadedBitmap.asImageBitmap(),
                contentDescription = null,
                contentScale = ContentScale.FillBounds,
                modifier = Modifier.size(width = widthDp, height = heightDp),
            )
        } else {
            Box(
                modifier = Modifier
                    .size(width = widthDp, height = heightDp)
                    .background(if (isMissing) Color(0xFFFFCDD2) else Color.LightGray),
                contentAlignment = Alignment.Center,
            ) {
                if (isMissing) {
                    Text(
                        text = "Imagem não encontrada",
                        color = Color(0xFFB71C1C),
                        fontSize = 10.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(4.dp),
                    )
                }
            }
        }

        if (isSelected) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .size(HANDLE_SIZE_DP.dp)
                    .background(MaterialTheme.colorScheme.primary)
                    .pointerInput(block.id) {
                        detectDragGestures { change, dragAmount ->
                            change.consume()
                            currentOnResize(dragAmount.x / scalePxPerMm, dragAmount.y / scalePxPerMm)
                        }
                    },
            )
        }
    }
}

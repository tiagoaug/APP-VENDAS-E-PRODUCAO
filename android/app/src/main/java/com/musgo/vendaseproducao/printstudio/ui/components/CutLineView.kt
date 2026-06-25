package com.musgo.vendaseproducao.printstudio.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.musgo.vendaseproducao.printstudio.model.CutLine

private const val LINE_THICKNESS_DP = 4

/** Linha de corte arrastável (1 eixo só) — divide a folha virtual em sub-regiões físicas de
 * impressão (ver LayoutRenderer da Fase 5). Remover uma linha é feito fora do canvas, pela
 * lista de chips no painel de Linhas de Corte do EditorScreen — não há botão sobre o
 * próprio traço, pra não precisar de matemática de posicionamento manual sujeita a erro. */
@Composable
fun CutLineView(
    cutLine: CutLine,
    pageWidthDp: Dp,
    pageHeightDp: Dp,
    scalePxPerMm: Float,
    onDrag: (deltaMm: Float) -> Unit,
) {
    val density = LocalDensity.current
    val currentOnDrag by rememberUpdatedState(onDrag)
    val positionDp = with(density) { (cutLine.positionMm * scalePxPerMm).toDp() }

    if (cutLine.isVertical) {
        Box(
            modifier = Modifier
                .offset(x = positionDp - (LINE_THICKNESS_DP / 2).dp)
                .width(LINE_THICKNESS_DP.dp)
                .height(pageHeightDp)
                .background(Color.Red.copy(alpha = 0.7f))
                .pointerInput(cutLine.id) {
                    detectDragGestures { change, dragAmount ->
                        change.consume()
                        currentOnDrag(dragAmount.x / scalePxPerMm)
                    }
                },
        )
    } else {
        Box(
            modifier = Modifier
                .offset(y = positionDp - (LINE_THICKNESS_DP / 2).dp)
                .height(LINE_THICKNESS_DP.dp)
                .width(pageWidthDp)
                .background(Color.Red.copy(alpha = 0.7f))
                .pointerInput(cutLine.id) {
                    detectDragGestures { change, dragAmount ->
                        change.consume()
                        currentOnDrag(dragAmount.y / scalePxPerMm)
                    }
                },
        )
    }
}

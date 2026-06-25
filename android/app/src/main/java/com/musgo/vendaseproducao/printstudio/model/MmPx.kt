package com.musgo.vendaseproducao.printstudio.model

/** Conversão mm↔px usada na hora de RENDERIZAR/IMPRIMIR em resolução real (a partir do DPI
 * do papel) — nunca usada pra matemática de gesto na tela de edição, que usa sua própria
 * escala de ajuste à tela (ver EditorScreen.scalePxPerMm), bem menor que o DPI de impressão. */
object MmPx {
    private const val MM_PER_INCH = 25.4f

    fun mmToPx(mm: Float, dpi: Int): Float = mm / MM_PER_INCH * dpi

    fun pxToMm(px: Float, dpi: Int): Float = px / dpi * MM_PER_INCH
}

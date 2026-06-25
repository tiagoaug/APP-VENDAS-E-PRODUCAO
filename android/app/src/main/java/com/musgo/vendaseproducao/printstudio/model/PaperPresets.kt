package com.musgo.vendaseproducao.printstudio.model

data class PaperPreset(val label: String, val widthMm: Float, val heightMm: Float)

/** Atalhos de tamanho de papel — os campos de largura/altura/DPI continuam livres pra
 * qualquer valor manual, isso aqui é só um ponto de partida rápido. Inclui os mesmos
 * tamanhos de etiqueta térmica já usados no editor de etiquetas web, pra quem for montar
 * uma folha pra imprimir vários adesivos/etiquetas juntos. */
val PAPER_PRESETS = listOf(
    PaperPreset("A4", 210f, 297f),
    PaperPreset("A5", 148f, 210f),
    PaperPreset("Carta", 216f, 279f),
    PaperPreset("Etiqueta 75×24", 75f, 24f),
    PaperPreset("Etiqueta 80×40", 80f, 40f),
    PaperPreset("Etiqueta 100×50", 100f, 50f),
)
